import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, randomUUID, createCipheriv, createDecipheriv } from 'node:crypto';
import { isIP } from 'node:net';
import { CatalogError } from './catalog.js';
import { mailTransportFromEnv } from './mailTransport.js';
import { logUnexpectedError } from './errorLogging.js';
import { accountAccessSchema } from './accountAccess.js';

export const ownerSchema =
  accountAccessSchema +
  `CREATE TABLE IF NOT EXISTS store_owners (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  granted_at TEXT NOT NULL
);`;
export function isStoreOwner(db, user) {
  return Boolean(
    user &&
    db
      .prepare(
        "SELECT u.id FROM store_owners o JOIN users u ON u.id=o.user_id LEFT JOIN account_access a ON a.user_id=u.id WHERE u.id=? AND u.role='admin' AND a.disabled_at IS NULL",
      )
      .get(user.id),
  );
}
const fail = (message, status = 422, code = 'validation_error') => {
  throw new CatalogError(message, status, code);
};
const validEmail = (value) =>
  typeof value === 'string' &&
  value.length <= 254 &&
  /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value);
function validateSettings(value, previous = {}) {
  const text = (key) => (typeof value?.[key] === 'string' ? value[key].trim() : '');
  const host = text('host'),
    user = text('user'),
    from = text('from'),
    publicUrl = text('publicUrl');
  const port = Number(value?.port);
  const password =
    value?.password === '' || value?.password == null ? previous.password : value.password;
  if (
    !host ||
    host.length > 253 ||
    !(isIP(host) || /^(?=.{1,253}$)[a-z\d](?:[a-z\d.-]*[a-z\d])?$/i.test(host))
  )
    fail('Isi alamat server SMTP tanpa awalan http atau https.');
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    fail('Port SMTP harus antara 1 dan 65535.');
  if (!user || user.length > 254 || /[\r\n]/.test(user)) fail('Isi nama pengguna SMTP yang valid.');
  if (
    typeof password !== 'string' ||
    !password ||
    password.length > 1024 ||
    /[\r\n]/.test(password)
  )
    fail('Isi kata sandi atau app password SMTP.');
  const sender = from.match(/^[^<>\r\n]{1,100}<([^<>]+)>$/)?.[1] || from;
  if (from.length > 360 || /[\r\n]/.test(from) || !validEmail(sender.trim()))
    fail('Isi alamat pengirim email yang valid.');
  let url;
  try {
    url = new URL(publicUrl);
  } catch {
    fail('Isi alamat lengkap website.');
  }
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
    fail('Gunakan alamat website HTTPS. Untuk pengujian lokal, localhost diperbolehkan.');
  return { host, port, user, password, from, publicUrl: url.href };
}
const envFor = (settings) => ({
  BAM_SMTP_HOST: settings.host,
  BAM_SMTP_PORT: String(settings.port),
  BAM_SMTP_USER: settings.user,
  BAM_SMTP_PASSWORD: settings.password,
  BAM_MAIL_FROM: settings.from,
});

export class EmailSettingsRepository {
  constructor(
    db,
    {
      filename,
      now,
      mailer,
      mailConfig,
      transportFactory = mailTransportFromEnv,
      logger,
      env = process.env,
    },
  ) {
    Object.assign(this, {
      db,
      now,
      transportFactory,
      logger,
      env,
      providedMailer: mailer,
      providedConfig: mailConfig,
    });
    this.keyPath = filename === ':memory:' ? null : filename + '.mail-key';
    db.exec(
      ownerSchema +
        `CREATE TABLE IF NOT EXISTS store_email_settings (
      id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,payload TEXT NOT NULL,
      updated_at INTEGER NOT NULL,updated_by TEXT NOT NULL REFERENCES users(id),
      last_test_at INTEGER,last_test_status TEXT
    ); CREATE TABLE IF NOT EXISTS store_email_audit (
      id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,action TEXT NOT NULL,result TEXT NOT NULL,created_at INTEGER NOT NULL
    ); CREATE TABLE IF NOT EXISTS store_email_test_limits(user_id TEXT PRIMARY KEY,next_allowed_at INTEGER NOT NULL);`,
    );
  }
  row() {
    return this.db.prepare('SELECT * FROM store_email_settings WHERE id=1').get();
  }
  key(create = false) {
    if (this.encryptionKey) return this.encryptionKey;
    const value = this.providedConfig?.queueKey ?? this.env.BAM_MAIL_QUEUE_KEY;
    if (this.keyPath && existsSync(this.keyPath)) {
      const bytes = readFileSync(this.keyPath);
      if (bytes.length !== 32)
        fail('Kunci email server tidak valid.', 503, 'email_key_unavailable');
      this.encryptionKey = bytes;
    } else if (value) {
      if (!/^[a-f\d]{64}$/i.test(value))
        fail('Kunci email server tidak valid.', 503, 'email_key_unavailable');
      this.encryptionKey = Buffer.from(value, 'hex');
    } else if (create) {
      const bytes = randomBytes(32);
      if (this.keyPath) {
        try {
          writeFileSync(this.keyPath, bytes, { flag: 'wx', mode: 0o600 });
        } catch (error) {
          if (error.code !== 'EEXIST') throw error;
          return this.key(false);
        }
      }
      this.encryptionKey = bytes;
    } else
      fail(
        'Kunci email server tidak tersedia. Pulihkan berkas kunci dari cadangan.',
        503,
        'email_key_unavailable',
      );
    return this.encryptionKey;
  }
  encrypt(settings) {
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', this.key(true), iv);
    const bytes = Buffer.concat([cipher.update(JSON.stringify(settings), 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), bytes].map((x) => x.toString('base64')).join('.');
  }
  decrypt(payload) {
    const key = this.key();
    try {
      const [iv, tag, bytes] = payload.split('.').map((x) => Buffer.from(x, 'base64'));
      const cipher = createDecipheriv('aes-256-gcm', key, iv);
      cipher.setAuthTag(tag);
      return JSON.parse(Buffer.concat([cipher.update(bytes), cipher.final()]).toString('utf8'));
    } catch {
      fail(
        'Pengaturan email tidak dapat dibaca. Periksa kunci dan cadangan server.',
        503,
        'email_key_unavailable',
      );
    }
  }
  runtime() {
    const row = this.row(),
      revision = row?.revision || 0;
    if (this.cached?.revision === revision) return this.cached;
    if (row) {
      const settings = this.decrypt(row.payload);
      return (this.cached = {
        revision,
        settings,
        source: 'website',
        mailer: this.transportFactory(envFor(settings)),
        config: { publicUrl: settings.publicUrl, queueKey: this.key().toString('hex') },
      });
    }
    const settings = {
      host: this.env.BAM_SMTP_HOST || '',
      port: Number(this.env.BAM_SMTP_PORT || 587),
      user: this.env.BAM_SMTP_USER || '',
      password: this.env.BAM_SMTP_PASSWORD || '',
      from: this.env.BAM_MAIL_FROM || '',
      publicUrl: this.providedConfig?.publicUrl ?? this.env.BAM_PUBLIC_URL ?? '',
    };
    return (this.cached = {
      revision,
      settings,
      source: settings.host ? 'environment' : 'unconfigured',
      mailer: this.providedMailer ?? this.transportFactory(this.env),
      config: this.providedConfig ?? {
        publicUrl: this.env.BAM_PUBLIC_URL,
        queueKey: this.env.BAM_MAIL_QUEUE_KEY,
      },
    });
  }
  sync(identity) {
    const runtime = this.runtime();
    if (this.appliedRevision === runtime.revision) return false;
    identity.configureMail(runtime.mailer, runtime.config);
    this.appliedRevision = runtime.revision;
    return true;
  }
  snapshot() {
    const runtime = this.runtime(),
      row = this.row();
    const { password, ...settings } = runtime.settings;
    return {
      revision: runtime.revision,
      source: runtime.source,
      settings,
      passwordSet: Boolean(password),
      lastTest: row?.last_test_at ? { at: row.last_test_at, status: row.last_test_status } : null,
    };
  }
  audit(user, action, result) {
    this.db
      .prepare('INSERT INTO store_email_audit VALUES(?,?,?,?,?)')
      .run(randomUUID(), user.id, action, result, this.now());
  }
  save(user, body) {
    if (!isStoreOwner(this.db, user))
      fail('Hanya pemilik toko yang dapat mengelola email.', 403, 'forbidden');
    const current = this.runtime();
    if (!Number.isSafeInteger(body?.revision) || body.revision !== current.revision)
      fail('Pengaturan telah berubah. Muat ulang sebelum menyimpan.', 409, 'settings_conflict');
    const settings = validateSettings(body.settings, current.settings);
    // Build the transport before committing; invalid configuration never replaces a working setup.
    this.transportFactory(envFor(settings));
    const payload = this.encrypt(settings);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (!isStoreOwner(this.db, user))
        fail('Hanya pemilik toko yang dapat mengelola email.', 403, 'forbidden');
      if ((this.row()?.revision || 0) !== body.revision)
        fail('Pengaturan telah berubah. Muat ulang sebelum menyimpan.', 409, 'settings_conflict');
      this.db
        .prepare(
          `INSERT INTO store_email_settings(id,revision,payload,updated_at,updated_by) VALUES(1,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,updated_at=excluded.updated_at,updated_by=excluded.updated_by,last_test_at=NULL,last_test_status=NULL`,
        )
        .run(body.revision + 1, payload, this.now(), user.id);
      this.audit(user, 'save', 'saved');
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return this.snapshot();
  }
  async sendTest(user, revision) {
    if (!isStoreOwner(this.db, user))
      fail('Hanya pemilik toko yang dapat mengelola email.', 403, 'forbidden');
    const runtime = this.runtime();
    if (runtime.source !== 'website' || runtime.revision !== revision)
      fail('Simpan pengaturan terbaru sebelum mengirim email uji.', 409, 'settings_conflict');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (!isStoreOwner(this.db, user))
        fail('Hanya pemilik toko yang dapat mengelola email.', 403, 'forbidden');
      const row = this.db
        .prepare('SELECT next_allowed_at FROM store_email_test_limits WHERE user_id=?')
        .get(user.id);
      if (row?.next_allowed_at > this.now())
        fail('Tunggu satu menit sebelum mengirim email uji lagi.', 429, 'rate_limited');
      this.db
        .prepare(
          'INSERT INTO store_email_test_limits VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET next_allowed_at=excluded.next_allowed_at',
        )
        .run(user.id, this.now() + 60000);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    let status = 'sent';
    try {
      const target = this.db.prepare('SELECT email FROM users WHERE id=?').get(user.id);
      await runtime.mailer.send({
        to: target.email,
        subject: 'Uji email toko',
        text: 'Pengaturan email toko berhasil digunakan untuk mengirim pesan uji. Pesan ini dikirim atas permintaan pemilik toko.',
      });
    } catch (error) {
      status = 'failed';
      logUnexpectedError(this.logger, error, { operation: 'owner_email_test' });
    }
    this.db
      .prepare(
        'UPDATE store_email_settings SET last_test_at=?,last_test_status=? WHERE id=1 AND revision=?',
      )
      .run(this.now(), status, revision);
    this.audit(user, 'test', status);
    if (status === 'failed')
      fail(
        'Email uji belum berhasil dikirim. Periksa server, port, pengirim dan kredensial SMTP.',
        503,
        'email_test_failed',
      );
    return {
      ok: true,
      message:
        'Email uji telah diserahkan ke layanan email. Periksa kotak masuk dan spam akun pemilik.',
      ...this.snapshot(),
    };
  }
}
