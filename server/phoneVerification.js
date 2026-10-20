import { createHash, randomInt, randomUUID } from 'node:crypto';
import { CatalogError } from './catalog.js';
import { normalizeWhatsApp } from '../src/state/whatsappModel.js';
import { accountIsActive, accountIsApproved } from './accountAccess.js';
import { verifyPassword } from './authSecurity.js';

const fail = (message, status = 400, code = 'invalid_phone_code') => {
  throw new CatalogError(message, status, code);
};
const invalid = () =>
  fail('Kode tidak sesuai, sudah digunakan, atau kedaluwarsa. Periksa kode atau minta kode baru.');
export class PhoneVerificationRepository {
  constructor(db, { now, sender, queue, hashPassword }) {
    Object.assign(this, { db, now, sender, queue, hashPassword });
    const columns = db
      .prepare('PRAGMA table_info(user_contact_phones)')
      .all()
      .map((c) => c.name);
    if (!columns.includes('verified_at'))
      db.exec('ALTER TABLE user_contact_phones ADD COLUMN verified_at INTEGER');
    if (!columns.includes('revision'))
      db.exec("ALTER TABLE user_contact_phones ADD COLUMN revision TEXT NOT NULL DEFAULT ''");
    db.exec("UPDATE user_contact_phones SET revision=lower(hex(randomblob(16))) WHERE revision=''");
    db.exec(`CREATE TABLE IF NOT EXISTS phone_otp_challenges (
      user_id TEXT PRIMARY KEY REFERENCES user_contact_phones(user_id) ON DELETE CASCADE,
      id TEXT NOT NULL UNIQUE,phone TEXT NOT NULL,phone_revision TEXT NOT NULL,credential_revision INTEGER NOT NULL,
      code_hash TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0
    ); CREATE TABLE IF NOT EXISTS phone_otp_limits(bucket TEXT PRIMARY KEY,attempts INTEGER NOT NULL,expires_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS phone_otp_limits_expiry ON phone_otp_limits(expires_at);`);
  }
  get ready() {
    return this.sender.enabled === true;
  }
  transaction(work) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  requireActive(userId) {
    if (!accountIsActive(this.db, userId) || !accountIsApproved(this.db, userId))
      fail('Sesi berakhir atau akses akun berubah. Masuk kembali.', 401, 'unauthorized');
  }
  contact(userId) {
    const row = this.db
      .prepare('SELECT phone,verified_at,revision FROM user_contact_phones WHERE user_id=?')
      .get(userId);
    return {
      phone: row?.phone || '',
      phoneVerified: row?.verified_at != null,
      phoneVerifiedAt: row?.verified_at ?? null,
      phoneRevision: row?.revision || '',
    };
  }
  save(userId, value) {
    if (typeof value !== 'string' || value.length > 40)
      fail('Nomor HP tidak valid.', 422, 'validation_error');
    const phone = normalizeWhatsApp(value);
    if (value.trim() && !phone)
      fail('Isi nomor HP Indonesia yang valid, misalnya 081234567890.', 422, 'validation_error');
    return this.transaction(() => {
      this.requireActive(userId);
      if (phone) {
        const previous = this.contact(userId);
        if (previous.phone !== phone) {
          this.db.prepare('DELETE FROM phone_otp_challenges WHERE user_id=?').run(userId);
          this.db
            .prepare(
              `INSERT INTO user_contact_phones(user_id,phone,revision) VALUES(?,?,?)
            ON CONFLICT(user_id) DO UPDATE SET phone=excluded.phone,verified_at=NULL,revision=excluded.revision`,
            )
            .run(userId, phone, randomUUID());
        }
      } else this.db.prepare('DELETE FROM user_contact_phones WHERE user_id=?').run(userId);
      return this.contact(userId);
    });
  }
  credentialRevision(userId) {
    return (
      this.db
        .prepare('SELECT credential_revision AS revision FROM auth_account_state WHERE user_id=?')
        .get(userId)?.revision || 0
    );
  }
  currentChallenge(userId, expectedId) {
    const row = this.db.prepare('SELECT * FROM phone_otp_challenges WHERE user_id=?').get(userId);
    const contact = this.contact(userId);
    if (
      !row ||
      (expectedId && row.id !== expectedId) ||
      row.phone !== contact.phone ||
      row.phone_revision !== contact.phoneRevision ||
      row.expires_at <= this.now() ||
      row.credential_revision !== this.credentialRevision(userId)
    )
      return null;
    return row;
  }
  status(userId) {
    const row = this.currentChallenge(userId);
    return {
      ready: this.ready,
      ...this.contact(userId),
      challenge: row
        ? {
            id: row.id,
            expiresAt: row.expires_at,
            resendAt: row.created_at + 60000,
            attemptsRemaining: Math.max(0, 5 - row.attempts),
          }
        : null,
    };
  }
  takeSendLimit(userId, phone, ip) {
    const time = this.now();
    this.db.prepare('DELETE FROM phone_otp_limits WHERE expires_at<=?').run(time);
    const buckets = [
      ['minute-user', userId, 1, 60000],
      ['daily-user', userId, 10, 86400000],
      ['daily-phone', phone, 10, 86400000],
      ['hourly-ip', ip, 20, 3600000],
    ].map(([scope, value, limit, ttl]) => ({
      key: scope + ':' + createHash('sha256').update(value).digest('hex'),
      limit,
      ttl,
    }));
    const read = this.db.prepare('SELECT attempts FROM phone_otp_limits WHERE bucket=?');
    if (buckets.some((b) => (read.get(b.key)?.attempts || 0) >= b.limit))
      fail(
        'Batas pengiriman kode tercapai. Tunggu setidaknya satu menit; batas harian juga berlaku.',
        429,
        'phone_rate_limited',
      );
    const count = this.db.prepare('SELECT COUNT(*) AS n FROM phone_otp_limits').get().n;
    if (count + buckets.filter((b) => !read.get(b.key)).length > 10000)
      fail('Layanan kode sedang sibuk. Coba kembali nanti.', 503, 'phone_busy');
    const write = this.db.prepare(
      'INSERT INTO phone_otp_limits VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1',
    );
    for (const b of buckets) write.run(b.key, time + b.ttl);
  }
  async request(actor, expectedPhone, ip) {
    if (!this.ready)
      fail(
        'Verifikasi WhatsApp belum diaktifkan. Pengelola perlu menyambungkan layanan WhatsApp resmi.',
        503,
        'whatsapp_unavailable',
      );
    this.requireActive(actor.id);
    const contact = this.contact(actor.id);
    if (!contact.phone || expectedPhone !== contact.phone)
      fail(
        'Nomor akun berubah. Simpan atau muat ulang nomor sebelum meminta kode.',
        409,
        'phone_changed',
      );
    if (contact.phoneVerified)
      return { ...this.status(actor.id), message: 'Nomor HP sudah dikonfirmasi.' };
    const id = randomUUID(),
      code = String(randomInt(0, 1000000)).padStart(6, '0');
    const credentialRevision = this.credentialRevision(actor.id);
    const time = this.now();
    // Reserve quotas before hashing/network work. A failed delivery still consumes its quota.
    this.transaction(() => {
      this.requireActive(actor.id);
      this.takeSendLimit(actor.id, contact.phone, ip);
    });
    const encoded = await this.queue.run(ip, () => this.hashPassword(code));
    this.transaction(() => {
      this.requireActive(actor.id);
      if (
        this.contact(actor.id).phoneRevision !== contact.phoneRevision ||
        this.credentialRevision(actor.id) !== credentialRevision
      )
        fail(
          'Nomor atau sesi akun berubah. Muat ulang sebelum meminta kode.',
          409,
          'phone_changed',
        );
      this.db
        .prepare(
          'INSERT INTO phone_otp_challenges(user_id,id,phone,phone_revision,credential_revision,code_hash,created_at,expires_at,attempts) VALUES(?,?,?,?,?,?,?,?,0) ON CONFLICT(user_id) DO UPDATE SET id=excluded.id,phone=excluded.phone,phone_revision=excluded.phone_revision,credential_revision=excluded.credential_revision,code_hash=excluded.code_hash,created_at=excluded.created_at,expires_at=excluded.expires_at,attempts=0',
        )
        .run(
          actor.id,
          id,
          contact.phone,
          contact.phoneRevision,
          credentialRevision,
          encoded,
          time,
          time + 300000,
        );
    });
    try {
      await this.sender.send({ phone: contact.phone, code });
    } catch {
      fail(
        'Pengiriman belum dapat dipastikan. Jika kode tiba di WhatsApp, masukkan kode tersebut. Jika tidak, tunggu sebelum meminta kode baru.',
        503,
        'whatsapp_delivery_unknown',
      );
    }
    this.requireActive(actor.id);
    if (this.contact(actor.id).phoneRevision !== contact.phoneRevision)
      fail('Nomor akun berubah. Muat ulang profil.', 409, 'phone_changed');
    return {
      ...this.status(actor.id),
      message:
        'Permintaan kode dikirim ke layanan WhatsApp. Periksa WhatsApp Anda; kode berlaku 5 menit.',
    };
  }
  async confirm(actor, body, ip) {
    if (
      typeof body.code !== 'string' ||
      !/^\d{6}$/.test(body.code) ||
      typeof body.challengeId !== 'string' ||
      !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/.test(body.challengeId)
    )
      fail('Masukkan kode 6 angka dari WhatsApp.', 422, 'validation_error');
    const row = this.transaction(() => {
      this.requireActive(actor.id);
      const challenge = this.currentChallenge(actor.id, body.challengeId);
      if (!challenge || challenge.phone !== body.phone || challenge.attempts >= 5) invalid();
      this.db
        .prepare('UPDATE phone_otp_challenges SET attempts=attempts+1 WHERE id=?')
        .run(challenge.id);
      return challenge;
    });
    const matches = await this.queue.run(ip, () => verifyPassword(body.code, row.code_hash));
    return this.transaction(() => {
      this.requireActive(actor.id);
      const current = this.currentChallenge(actor.id, row.id);
      if (!current || current.code_hash !== row.code_hash || !matches) invalid();
      this.db
        .prepare('UPDATE user_contact_phones SET verified_at=? WHERE user_id=? AND revision=?')
        .run(this.now(), actor.id, row.phone_revision);
      this.db.prepare('DELETE FROM phone_otp_challenges WHERE user_id=?').run(actor.id);
      return {
        ...this.status(actor.id),
        message: 'Nomor HP berhasil dikonfirmasi melalui WhatsApp.',
      };
    });
  }
}
