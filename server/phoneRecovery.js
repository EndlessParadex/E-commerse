import { randomInt } from 'node:crypto';
import { CatalogError } from './catalog.js';
import { normalizeWhatsApp } from '../src/state/whatsappModel.js';
import { accountIsActive, accountIsApproved } from './accountAccess.js';
import { DUMMY_PASSWORD_HASH, verifyPassword } from './authSecurity.js';

const fail = (message, status = 422, code = 'validation_error') => {
  throw new CatalogError(message, status, code);
};
const invalid = () =>
  fail(
    'Nomor, kode, atau masa berlaku kode tidak sesuai. Periksa kembali atau minta kode baru.',
    400,
    'invalid_phone_code',
  );
const TTL = 300000;
const MAX_ATTEMPTS = 5;
export const RESET_REQUEST_MESSAGE =
  'Jika nomor ini terdaftar dan sudah dikonfirmasi, kode dikirim ke WhatsApp. Kode berlaku 5 menit.';

/**
 * "Lupa kata sandi" by WhatsApp, for accounts that have no email. Only a number the owner of the
 * account has already confirmed by OTP can receive a reset code: an unconfirmed number may have
 * been typed wrongly and belong to someone else.
 *
 * Responses never reveal whether a number is registered: the request always answers the same
 * way, hashes a code either way, and does not wait for WhatsApp.
 */
export class PhoneRecovery {
  constructor(db, { phones, identity, phoneDirectory, queue, hashPassword, now, logger }) {
    Object.assign(this, { db, phones, identity, phoneDirectory, queue, hashPassword, now, logger });
    db.exec(`CREATE TABLE IF NOT EXISTS phone_reset_challenges (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      phone TEXT NOT NULL,phone_revision TEXT NOT NULL,credential_revision INTEGER NOT NULL,
      code_hash TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0
    );`);
  }
  phoneOf(value) {
    const phone = typeof value === 'string' && value.length <= 40 ? normalizeWhatsApp(value) : '';
    if (!phone) fail('Isi nomor HP Indonesia yang valid, misalnya 081234567890.');
    return phone;
  }
  /** Account id that may reset by this number, or null. */
  eligible(phone) {
    const userId = this.phoneDirectory.find(phone);
    if (!userId || !accountIsActive(this.db, userId) || !accountIsApproved(this.db, userId))
      return null;
    const contact = this.phones.contact(userId);
    return contact.phone === phone && contact.phoneVerified ? userId : null;
  }
  current(userId, phone) {
    const row = userId
      ? this.db.prepare('SELECT * FROM phone_reset_challenges WHERE user_id=?').get(userId)
      : null;
    if (
      !row ||
      row.phone !== phone ||
      row.phone_revision !== this.phones.contact(userId).phoneRevision ||
      row.credential_revision !== this.phones.credentialRevision(userId) ||
      row.expires_at <= this.now() ||
      row.attempts >= MAX_ATTEMPTS
    )
      return null;
    return row;
  }
  async request(value, ip) {
    const phone = this.phoneOf(value);
    if (!this.phones.ready)
      fail(
        'Pemulihan lewat WhatsApp belum diaktifkan. Hubungi pengelola toko.',
        503,
        'whatsapp_unavailable',
      );
    const userId = this.eligible(phone);
    // Same quotas whether or not the number is registered.
    this.phones.transaction(() =>
      this.phones.takeSendLimit('reset:' + (userId || phone), phone, ip),
    );
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    const encoded = await this.queue.run(ip, () => this.hashPassword(code));
    if (userId) {
      const time = this.now();
      const stored = this.phones.transaction(() => {
        if (this.eligible(phone) !== userId) return false;
        this.db
          .prepare(
            `INSERT INTO phone_reset_challenges(user_id,phone,phone_revision,credential_revision,code_hash,created_at,expires_at,attempts)
            VALUES(?,?,?,?,?,?,?,0) ON CONFLICT(user_id) DO UPDATE SET phone=excluded.phone,
            phone_revision=excluded.phone_revision,credential_revision=excluded.credential_revision,
            code_hash=excluded.code_hash,created_at=excluded.created_at,expires_at=excluded.expires_at,attempts=0`,
          )
          .run(
            userId,
            phone,
            this.phones.contact(userId).phoneRevision,
            this.phones.credentialRevision(userId),
            encoded,
            time,
            time + TTL,
          );
        return true;
      });
      // Not awaited: waiting would make registered numbers answer measurably slower.
      if (stored)
        Promise.resolve()
          .then(() => this.phones.sender.send({ phone, code }))
          .catch(() => this.logger?.({ level: 'warn', operation: 'phone_reset_delivery' }));
    }
    return { ok: true, message: RESET_REQUEST_MESSAGE };
  }
  async confirm(body, ip) {
    const phone = this.phoneOf(body?.phone);
    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!/^\d{6}$/.test(code)) fail('Masukkan kode 6 angka dari WhatsApp.');
    if (password.length < 8 || password.length > 128)
      fail('Gunakan kata sandi baru 8–128 karakter.');
    const userId = this.phoneDirectory.find(phone);
    const row = this.phones.transaction(() => {
      const challenge = this.current(userId, phone);
      if (challenge)
        this.db
          .prepare('UPDATE phone_reset_challenges SET attempts=attempts+1 WHERE user_id=?')
          .run(userId);
      return challenge;
    });
    const matches = await this.queue.run(ip, () =>
      verifyPassword(code, row ? row.code_hash : DUMMY_PASSWORD_HASH),
    );
    if (!row || !matches) invalid();
    const encoded = await this.queue.run(ip, () => this.hashPassword(password));
    this.phones.transaction(() => {
      const latest = this.current(userId, phone);
      if (!latest || latest.created_at !== row.created_at || this.eligible(phone) !== userId)
        invalid();
      this.db.prepare('DELETE FROM phone_reset_challenges WHERE user_id=?').run(userId);
      this.db.prepare('DELETE FROM phone_otp_challenges WHERE user_id=?').run(userId);
      this.identity.setPassword(userId, encoded);
    });
    return {
      ok: true,
      message:
        'Kata sandi diperbarui. Semua sesi lama diakhiri. Silakan masuk dengan nomor HP dan kata sandi baru.',
    };
  }
}

const TEMPORARY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
/** Readable temporary password: no 0/O, 1/l/I. */
export function temporaryPassword(length = 12) {
  let value = '';
  for (let i = 0; i < length; i++)
    value += TEMPORARY_ALPHABET[randomInt(TEMPORARY_ALPHABET.length)];
  return value;
}
