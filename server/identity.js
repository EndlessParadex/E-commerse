import { randomBytes, randomUUID, createHash, createCipheriv, createDecipheriv } from 'node:crypto';
import { CatalogError } from './catalog.js';
import { logUnexpectedError } from './errorLogging.js';
import { accountIsActive, accountApprovalStatus, approvalSchema } from './accountAccess.js';

const fail = (message, status = 400, code = 'invalid_token') => {
  throw new CatalogError(message, status, code);
};
const digest = (value) => createHash('sha256').update(value).digest('hex');
const generic = {
  ok: true,
  message:
    'Jika alamat tersebut memenuhi syarat, instruksi akan dikirim melalui email. Periksa kotak masuk dan folder spam.',
};
const emailOf = (value) => {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    fail('Alamat email tidak valid.', 422, 'validation_error');
  return email;
};
const validPassword = (value) =>
  typeof value === 'string' && value.length >= 8 && value.length <= 128;

export class IdentityRepository {
  constructor(
    db,
    { now, mailer, config = {}, queue, limiter, passwordCheck, hashPassword, logger, phoneDirectory },
  ) {
    Object.assign(this, { db, now, mailer, queue, limiter, passwordCheck, hashPassword, logger, phoneDirectory });
    this.configureMail(mailer, config);
    db.exec(approvalSchema);
    db.exec(`CREATE TABLE IF NOT EXISTS auth_account_state(user_id TEXT PRIMARY KEY REFERENCES users(id),verified_at INTEGER,credential_revision INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS auth_tokens(token_hash TEXT PRIMARY KEY,purpose TEXT NOT NULL,user_id TEXT REFERENCES users(id),email TEXT NOT NULL,payload TEXT NOT NULL,credential_revision INTEGER NOT NULL,expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS auth_email_daily(address_hash TEXT NOT NULL,created_at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS auth_email_daily_lookup ON auth_email_daily(address_hash,created_at);
      CREATE INDEX IF NOT EXISTS auth_tokens_expiry ON auth_tokens(expires_at);
      CREATE TABLE IF NOT EXISTS auth_mail_outbox(token_hash TEXT PRIMARY KEY REFERENCES auth_tokens(token_hash) ON DELETE CASCADE,payload TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,next_attempt INTEGER NOT NULL,leased_until INTEGER NOT NULL DEFAULT 0);`);
  }
  configureMail(mailer, config = {}) {
    const publicUrl = config.publicUrl ?? process.env.BAM_PUBLIC_URL;
    const queueKey = config.queueKey ?? process.env.BAM_MAIL_QUEUE_KEY;
    const ready = Boolean(mailer.enabled && publicUrl && queueKey);
    let nextUrl, nextKey;
    if (mailer.enabled && !ready)
      throw new Error('SMTP requires BAM_PUBLIC_URL and BAM_MAIL_QUEUE_KEY.');
    if (publicUrl) {
      const url = new URL(publicUrl);
      if (
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        !(
          url.protocol === 'https:' ||
          (process.env.NODE_ENV !== 'production' &&
            url.protocol === 'http:' &&
            ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
        )
      )
        throw new Error('Invalid public account URL.');
      nextUrl = url;
    }
    if (queueKey) {
      if (!/^[a-f\d]{64}$/i.test(queueKey))
        throw new Error('BAM_MAIL_QUEUE_KEY must have 64 hexadecimal characters.');
      nextKey = Buffer.from(queueKey, 'hex');
    }
    Object.assign(this, { mailer, ready, publicUrl: nextUrl, key: nextKey });
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
  verified(id) {
    return (
      this.db.prepare('SELECT verified_at FROM auth_account_state WHERE user_id=?').get(id)
        ?.verified_at != null
    );
  }
  requireEmail() {
    if (!this.ready)
      fail(
        'Layanan email toko belum diaktifkan. Hubungi pengelola toko.',
        503,
        'email_unavailable',
      );
  }
  encrypt(value) {
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const bytes = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), bytes].map((x) => x.toString('base64')).join('.');
  }
  decrypt(value) {
    const [iv, tag, bytes] = value.split('.').map((x) => Buffer.from(x, 'base64'));
    const cipher = createDecipheriv('aes-256-gcm', this.key, iv);
    cipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([cipher.update(bytes), cipher.final()]).toString('utf8'));
  }
  issue(purpose, email, user = null, payload = {}) {
    if (user && !accountIsActive(this.db, user.id)) return;
    if (this.db.prepare('SELECT COUNT(*) AS n FROM auth_mail_outbox').get().n >= 10000)
      fail('Layanan email sedang sibuk. Coba kembali nanti.', 503, 'email_busy');
    const addressHash = digest(email);
    this.db.prepare('DELETE FROM auth_email_daily WHERE created_at<=?').run(this.now() - 86400000);
    if (
      this.db
        .prepare('SELECT COUNT(*) AS n FROM auth_email_daily WHERE address_hash=?')
        .get(addressHash).n >= 6
    )
      return;
    this.db.prepare('INSERT INTO auth_email_daily VALUES(?,?)').run(addressHash, this.now());
    const token = randomBytes(32).toString('base64url'),
      hash = digest(token),
      time = this.now();
    const revision = user
      ? this.db
          .prepare('SELECT credential_revision FROM auth_account_state WHERE user_id=?')
          .get(user.id)?.credential_revision || 0
      : 0;
    const url = new URL(this.publicUrl);
    url.hash = (purpose === 'reset' ? '/reset-password' : '/verifikasi-email') + '?token=' + token;
    const message = {
      to: email,
      subject: purpose === 'reset' ? 'Atur ulang kata sandi akun' : 'Konfirmasi alamat email akun',
      text: `${purpose === 'reset' ? 'Atur ulang kata sandi melalui' : 'Konfirmasi alamat email melalui'} tautan berikut:\n${url.href}\n\nTautan hanya dapat digunakan sekali dan berlaku ${purpose === 'reset' ? '30 menit' : '24 jam'}. Jika Anda tidak meminta tindakan ini, abaikan email ini. Kata sandi akun tidak pernah dikirim melalui email.`,
    };
    this.db
      .prepare('INSERT INTO auth_tokens VALUES(?,?,?,?,?,?,?)')
      .run(
        hash,
        purpose,
        user?.id || null,
        email,
        JSON.stringify(payload),
        revision,
        time + (purpose === 'reset' ? 1800000 : 86400000),
      );
    this.db
      .prepare('INSERT INTO auth_mail_outbox(token_hash,payload,next_attempt) VALUES(?,?,?)')
      .run(hash, this.encrypt(message), time);
  }
  async register(fields, ip) {
    if (!this.limiter.take('register', ip, fields.email)) return this.registrationMessage();
    const encoded = await this.queue.run(ip, () => this.hashPassword(fields.password));
    this.transaction(() => {
      this.cleanup();
      let user = this.db.prepare('SELECT id FROM users WHERE email=?').get(fields.email);
      if (!user) {
        user = { id: randomUUID() };
        this.db
          .prepare("INSERT INTO users VALUES(?,?,?,?,?,?,'user')")
          .run(
            user.id,
            fields.name,
            fields.email,
            fields.address,
            encoded,
            new Date(this.now()).toISOString(),
          );
        this.db.prepare("INSERT INTO account_approvals(user_id,status) VALUES(?,'pending')").run(user.id);
        if (fields.phone && this.phoneDirectory) {
          this.phoneDirectory.claim(user.id, fields.phone);
          this.db.prepare(
            'INSERT INTO user_contact_phones(user_id,phone,revision) VALUES(?,?,?)',
          ).run(user.id, fields.phone, randomUUID());
        }
        if (this.ready) this.issue('verify', fields.email, user);
      } else if (this.ready) this.issue('reset', fields.email, user);
    });
    return this.registrationMessage();
  }
  registrationMessage() {
    return {
      ...generic,
      message: this.ready
        ? 'Permintaan diterima. Jika akun baru berhasil dibuat, email verifikasi otomatis disiapkan. Periksa kotak masuk atau spam sambil menunggu persetujuan Admin atau Pemilik.'
        : 'Permintaan diterima. Akun baru perlu persetujuan Admin atau Pemilik. Pengiriman verifikasi email belum tersedia; hubungi pengelola toko.',
      emailReady: this.ready,
    };
  }
  async resendRegistrationVerification(value, ip) {
    const email = emailOf(value);
    this.requireEmail();
    // The response is identical whether the account exists or not; avoid account enumeration.
    if (!this.limiter.take('email', ip, email)) return generic;
    await this.queue.run(ip, () => this.hashPassword('registration-verification-request'));
    this.transaction(() => {
      this.cleanup();
      const user = this.db.prepare('SELECT id FROM users WHERE email=?').get(email);
      if (user && accountApprovalStatus(this.db, user.id) === 'pending' && !this.verified(user.id))
        this.issue('verify', email, user);
    });
    return generic;
  }
  async forgot(value, ip) {
    const email = emailOf(value);
    this.requireEmail();
    if (!this.limiter.take('email', ip, email)) return generic;
    await this.queue.run(ip, () => this.hashPassword('account-recovery-request'));
    this.transaction(() => {
      this.cleanup();
      const user = this.db.prepare('SELECT id FROM users WHERE email=?').get(email);
      this.issue(user ? 'reset' : 'reset_dummy', email, user);
    });
    return generic;
  }
  requestVerification(user, ip) {
    this.requireEmail();
    if (!this.limiter.take('email', ip, user.email)) return generic;
    this.transaction(() => {
      this.cleanup();
      if (!this.verified(user.id)) this.issue('verify', user.email, user);
    });
    return generic;
  }
  readToken(token, purposes) {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token))
      fail('Tautan tidak valid atau sudah berakhir. Minta tautan baru.');
    const row = this.db.prepare('SELECT * FROM auth_tokens WHERE token_hash=?').get(digest(token));
    if (!row || !purposes.includes(row.purpose) || row.expires_at <= this.now())
      fail('Tautan tidak valid atau sudah berakhir. Minta tautan baru.');
    if (
      row.user_id &&
      (!accountIsActive(this.db, row.user_id) ||
        (this.db
          .prepare('SELECT credential_revision FROM auth_account_state WHERE user_id=?')
          .get(row.user_id)?.credential_revision || 0) !== row.credential_revision)
    )
      fail('Tautan tidak valid atau sudah berakhir. Minta tautan baru.');
    return row;
  }
  async verify(token, password, ip) {
    const row = this.readToken(token, ['register', 'verify']);
    if (!validPassword(password)) fail('Gunakan kata sandi 8–128 karakter.');
    let encoded;
    if (row.purpose === 'verify') {
      const user = this.db.prepare('SELECT password_hash FROM users WHERE id=?').get(row.user_id);
      if (
        !user ||
        !(await this.queue.run(ip, () => this.passwordCheck(password, user.password_hash)))
      )
        fail('Tautan atau kata sandi tidak valid.');
    } else encoded = await this.queue.run(ip, () => this.hashPassword(password));
    this.transaction(() => {
      const current = this.readToken(token, ['register', 'verify']);
      let id = current.user_id;
      if (current.purpose === 'register') {
        if (this.db.prepare('SELECT id FROM users WHERE email=?').get(current.email))
          fail('Tautan tidak valid atau sudah digunakan.');
        const fields = JSON.parse(current.payload);
        id = randomUUID();
        this.db
          .prepare("INSERT INTO users VALUES(?,?,?,?,?,?, 'user')")
          .run(
            id,
            fields.name,
            current.email,
            fields.address,
            encoded,
            new Date(this.now()).toISOString(),
          );
      }
      this.db
        .prepare(
          'INSERT INTO auth_account_state(user_id,verified_at) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET verified_at=excluded.verified_at',
        )
        .run(id, this.now());
      this.db
        .prepare("DELETE FROM auth_tokens WHERE email=? AND purpose IN ('register','verify')")
        .run(current.email);
    });
    const approval = accountApprovalStatus(this.db, row.user_id || this.db.prepare('SELECT id FROM users WHERE email=?').get(row.email)?.id);
    return {
      ok: true,
      message: approval === 'pending'
        ? 'Email dikonfirmasi. Sekarang tunggu persetujuan Admin atau Pemilik sebelum masuk.'
        : approval === 'rejected'
          ? 'Email dikonfirmasi, tetapi pendaftaran belum disetujui. Hubungi pengelola toko.'
          : 'Email dikonfirmasi. Silakan masuk menggunakan kata sandi akun.',
    };
  }
  async reset(token, password, ip) {
    this.readToken(token, ['reset']);
    if (!validPassword(password))
      fail('Gunakan kata sandi 8–128 karakter.', 422, 'validation_error');
    const encoded = await this.queue.run(ip, () => this.hashPassword(password));
    this.transaction(() => {
      const row = this.readToken(token, ['reset']);
      this.setPassword(row.user_id, encoded);
      this.db
        .prepare('UPDATE auth_account_state SET verified_at=? WHERE user_id=?')
        .run(this.now(), row.user_id);
    });
    return {
      ok: true,
      message: 'Kata sandi diperbarui. Semua sesi lama diakhiri. Silakan masuk kembali.',
    };
  }
  setPassword(id, encoded) {
    if (!accountIsActive(this.db, id))
      fail('Akun ini dinonaktifkan. Hubungi pemilik toko.', 403, 'account_disabled');
    this.db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(encoded, id);
    this.db
      .prepare(
        'INSERT INTO auth_account_state(user_id,credential_revision) VALUES(?,1) ON CONFLICT(user_id) DO UPDATE SET credential_revision=credential_revision+1',
      )
      .run(id);
    this.db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);
    this.db.prepare('DELETE FROM auth_tokens WHERE user_id=?').run(id);
  }
  async changePassword(user, currentPassword, password, ip) {
    const stored = this.db.prepare('SELECT password_hash,role FROM users WHERE id=?').get(user.id);
    if (stored?.role !== 'admin')
      fail('Pengaturan kata sandi di halaman akun hanya tersedia untuk admin.', 403, 'forbidden');
    if (
      !validPassword(password) ||
      typeof currentPassword !== 'string' ||
      !currentPassword ||
      currentPassword.length > 128
    )
      fail(
        'Periksa kata sandi saat ini dan gunakan kata sandi baru 8–128 karakter.',
        422,
        'validation_error',
      );
    const matches =
      stored &&
      (await this.queue.run(ip, () => this.passwordCheck(currentPassword, stored.password_hash)));
    if (!matches) {
      this.limiter.take('login', ip, user.email);
      fail('Kata sandi saat ini tidak sesuai.', 401, 'invalid_credentials');
    }
    const encoded = await this.queue.run(ip, () => this.hashPassword(password));
    this.transaction(() => {
      const latest = this.db
        .prepare('SELECT password_hash,role FROM users WHERE id=?')
        .get(user.id);
      if (latest?.role !== 'admin')
        fail('Pengaturan kata sandi di halaman akun hanya tersedia untuk admin.', 403, 'forbidden');
      if (latest.password_hash !== stored.password_hash)
        fail('Kredensial sudah berubah. Masuk kembali.', 409, 'credential_changed');
      this.setPassword(user.id, encoded);
    });
    return { ok: true, message: 'Kata sandi diperbarui. Silakan masuk kembali.' };
  }
  cleanup() {
    this.db.prepare('DELETE FROM auth_tokens WHERE expires_at<=?').run(this.now());
  }
  async flushMail(limit = 4) {
    if (!this.ready) return 0;
    let sent = 0;
    for (let i = 0; i < limit; i++) {
      const row = this.transaction(() => {
        this.cleanup();
        const item = this.db
          .prepare(
            'SELECT auth_mail_outbox.*,auth_tokens.purpose FROM auth_mail_outbox JOIN auth_tokens USING(token_hash) WHERE next_attempt<=? AND leased_until<=? ORDER BY next_attempt LIMIT 1',
          )
          .get(this.now(), this.now());
        if (item)
          this.db
            .prepare('UPDATE auth_mail_outbox SET leased_until=? WHERE token_hash=?')
            .run(this.now() + 60000, item.token_hash);
        return item;
      });
      if (!row) break;
      if (row.purpose.endsWith('_dummy')) {
        this.db.prepare('DELETE FROM auth_tokens WHERE token_hash=?').run(row.token_hash);
        continue;
      }
      try {
        await this.mailer.send(this.decrypt(row.payload));
        this.db.prepare('DELETE FROM auth_mail_outbox WHERE token_hash=?').run(row.token_hash);
        sent++;
      } catch (error) {
        this.db
          .prepare(
            'UPDATE auth_mail_outbox SET attempts=attempts+1,leased_until=0,next_attempt=? WHERE token_hash=?',
          )
          .run(
            this.now() + Math.min(3600000, 60000 * 2 ** Math.min(row.attempts, 6)),
            row.token_hash,
          );
        logUnexpectedError(this.logger, error, { operation: 'account_email_delivery' });
      }
    }
    return sent;
  }
}
