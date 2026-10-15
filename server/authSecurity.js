import { createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
export const DUMMY_PASSWORD_HASH =
  '0d42dabc7e3d8e021fe27c4a8fe8b640:f22d21b19ab41df843ff2d9423da3c82cfacad8dece649223bff00be04dab8e063690390e0b02af8e106f83cf6b59ea967cb0cfcbedf744bea4667576136e739';
export const validPasswordHash = (encoded) =>
  typeof encoded === 'string' && /^[a-f\d]{32}:[a-f\d]{128}$/.test(encoded);
export async function verifyPassword(password, encoded) {
  const valid = validPasswordHash(encoded);
  const [salt, expected] = (valid ? encoded : DUMMY_PASSWORD_HASH).split(':');
  const derived = await scrypt(password, Buffer.from(salt, 'hex'), 64);
  const matches = timingSafeEqual(Buffer.from(expected, 'hex'), derived);
  return valid && matches;
}

const DEFAULT_LIMITS = Object.freeze({
  loginIp: 60,
  loginPair: 10,
  registrationIp: 20,
  emailRequestIp: 20,
  emailRequestAccount: 3,
});
export class AuthRateLimiter {
  constructor(db, now, overrides = {}) {
    this.db = db;
    this.now = now;
    this.limits = { ...DEFAULT_LIMITS, ...overrides };
    for (const [key, value] of Object.entries(this.limits))
      if (
        !Object.hasOwn(DEFAULT_LIMITS, key) ||
        !Number.isSafeInteger(value) ||
        value < 1 ||
        value > 10000
      )
        throw new Error(`Invalid authentication limit: ${key}`);
    db.exec(
      'CREATE TABLE IF NOT EXISTS auth_rate_limits (bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS auth_rate_limits_expiry ON auth_rate_limits(expires_at)',
    );
    db.exec(
      "DELETE FROM auth_rate_limits WHERE bucket LIKE 'loginGlobal:%' OR bucket LIKE 'loginAccount:%' OR bucket LIKE 'registrationGlobal:%'",
    );
  }
  take(kind, ip, email = '') {
    const hash = (value) => createHash('sha256').update(value).digest('hex');
    const scopes =
      kind === 'login'
        ? [
            ['loginIp', ip],
            ['loginPair', ip + ':' + email],
          ]
        : kind === 'register'
          ? [
              ['registrationIp', ip],
              ['emailRequestAccount', email],
            ]
          : [
              ['emailRequestIp', ip],
              ['emailRequestAccount', email],
            ];
    const buckets = scopes.map(([scope, value]) => ({
      key: scope + ':' + hash(value),
      limit: this.limits[scope],
    }));
    const time = this.now();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('DELETE FROM auth_rate_limits WHERE expires_at<=?').run(time);
      const read = this.db.prepare('SELECT attempts FROM auth_rate_limits WHERE bucket=?');
      const allowed = buckets.every(
        (bucket) => (read.get(bucket.key)?.attempts || 0) < bucket.limit,
      );
      // Keep active buckets: evicting them would let rotating identities reset limits.
      const count = this.db.prepare('SELECT COUNT(*) AS n FROM auth_rate_limits').get().n;
      const missing = buckets.filter((bucket) => !read.get(bucket.key)).length;
      if (!allowed || count + missing > 10000) {
        this.db.exec('COMMIT');
        return false;
      }
      const upsert = this.db.prepare(
        'INSERT INTO auth_rate_limits VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1',
      );
      for (const bucket of buckets)
        upsert.run(
          bucket.key,
          time + (bucket.key.startsWith('emailRequestAccount:') ? 3600000 : 60000),
        );
      this.db.exec('COMMIT');
      return true;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  clearLoginPair(ip, email) {
    const key =
      'loginPair:' +
      createHash('sha256')
        .update(ip + ':' + email)
        .digest('hex');
    this.db.prepare('DELETE FROM auth_rate_limits WHERE bucket=?').run(key);
  }
  loginDelay(ip, email) {
    const time = this.now();
    for (const [scope, value] of [
      ['loginIp', ip],
      ['loginPair', ip + ':' + email],
    ]) {
      const key = scope + ':' + createHash('sha256').update(value).digest('hex');
      const row = this.db
        .prepare('SELECT attempts,expires_at FROM auth_rate_limits WHERE bucket=?')
        .get(key);
      if (row && row.expires_at > time && row.attempts >= this.limits[scope]) return 1000;
    }
    return 0;
  }
}

// Bound expensive work without an attacker-controlled quota that closes all logins.
export class PasswordQueue {
  constructor({ maxActive = 8, perIp = 2, maxQueued = 64, perIpQueued = 4 } = {}) {
    this.maxActive = maxActive;
    this.perIp = perIp;
    this.maxQueued = maxQueued;
    this.perIpQueued = perIpQueued;
    this.active = 0;
    this.byIp = new Map();
    this.queues = new Map();
    this.queued = 0;
  }
  run(ip, work) {
    if ((this.queues.get(ip)?.length || 0) >= this.perIpQueued || this.queued >= this.maxQueued) {
      const error = new Error('Layanan akun sedang sibuk. Tunggu sebentar lalu coba lagi.');
      error.code = 'auth_busy';
      error.status = 503;
      return Promise.reject(error);
    }
    return new Promise((resolve, reject) => {
      const queue = this.queues.get(ip) || [];
      queue.push({ work, resolve, reject });
      this.queues.set(ip, queue);
      this.queued++;
      this.drain();
    });
  }
  drain() {
    while (this.active < this.maxActive) {
      const entry = [...this.queues].find(
        ([ip, queue]) => queue.length && (this.byIp.get(ip) || 0) < this.perIp,
      );
      if (!entry) break;
      const [ip, queue] = entry;
      const task = queue.shift();
      this.queues.delete(ip);
      if (queue.length) this.queues.set(ip, queue);
      this.queued--;
      this.active++;
      this.byIp.set(ip, (this.byIp.get(ip) || 0) + 1);
      Promise.resolve()
        .then(task.work)
        .then(task.resolve, task.reject)
        .finally(() => {
          this.active--;
          const n = this.byIp.get(ip) - 1;
          if (n) this.byIp.set(ip, n);
          else this.byIp.delete(ip);
          this.drain();
        });
    }
  }
}
