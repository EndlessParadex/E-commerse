import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { CatalogRepository, CatalogError } from './catalog.js';

const scrypt = promisify(scryptCallback);
const digest = (token) => createHash('sha256').update(token).digest('hex');
const json = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers }); res.end(JSON.stringify(body));
};
const sendError = (res, status, code, errors) => json(res, status, { error: code, ...(errors ? { errors } : {}) });
export function readBody(req, limit = 100000) {
  return new Promise((resolveBody, reject) => {
    const chunks = []; let size = 0; let failed = false;
    req.on('data', (chunk) => { size += Buffer.byteLength(chunk); if (size > limit) { if (!failed) reject(new CatalogError('Ukuran permintaan terlalu besar.', 413, 'payload_too_large')); failed = true; } else if (!failed) chunks.push(Buffer.from(chunk)); });
    req.on('end', () => { if (failed) return; try { resolveBody(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(new CatalogError('JSON tidak valid.', 400, 'invalid_json')); } });
    req.on('error', reject);
  });
}
function authFields(body, registration) {
  const name = typeof body?.name === 'string' ? body.name.trim() : ''; const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const address = typeof body?.address === 'string' ? body.address.trim() : ''; const password = typeof body?.password === 'string' ? body.password : ''; const errors = {};
  if (registration && (name.length < 2 || name.length > 100)) errors.name = 'Nama harus berisi 2–100 karakter.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) errors.email = 'Email tidak valid.';
  if (!password || password.length > 128 || (registration && password.length < 8)) errors.password = registration ? 'Kata sandi harus 8–128 karakter.' : 'Kata sandi tidak valid.';
  if (registration && (address.length < 10 || address.length > 500)) errors.address = 'Alamat harus berisi 10–500 karakter.';
  return { errors, name, email, address, password };
}
export async function hashPassword(password) {
  const salt = randomBytes(16); const key = await scrypt(password, salt, 64); return `${salt.toString('hex')}:${Buffer.from(key).toString('hex')}`;
}
async function verifyPassword(password, encoded) {
  const [saltHex, keyHex] = String(encoded).split(':'); if (!saltHex || !keyHex) return false;
  const key = await scrypt(password, Buffer.from(saltHex, 'hex'), 64); const expected = Buffer.from(keyHex, 'hex'); return expected.length === key.length && timingSafeEqual(expected, key);
}
const userView = (user) => ({ id: user.id, name: user.name, email: user.email, address: user.address, role: user.role || 'user' });

export function createApp({ dbPath = process.env.BAM_DB_PATH || 'data/bam.sqlite', appOrigin = process.env.BAM_APP_ORIGIN || '', secureCookies = process.env.NODE_ENV === 'production' } = {}) {
  const filename = dbPath === ':memory:' ? dbPath : resolve(dbPath);
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, address TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);`);
  if (!db.prepare('PRAGMA table_info(users)').all().some((entry) => entry.name === 'role')) db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
  const catalog = new CatalogRepository(db); const attempts = new Map();
  const token = (req) => req.headers.cookie?.match(/(?:^|;\s*)bam_session=([A-Za-z0-9_-]{43})(?:;|$)/)?.[1];
  const currentUser = (req) => {
    const value = token(req); if (!value) return null;
    return db.prepare('SELECT u.id,u.name,u.email,u.address,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').get(digest(value), Date.now()) || null;
  };
  const sessionHeaders = (userId) => {
    const value = randomBytes(32).toString('base64url'); db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());
    db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(value), userId, Date.now() + 2592000000);
    return { 'set-cookie': `bam_session=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${secureCookies ? '; Secure' : ''}` };
  };
  const checkOrigin = (req) => {
    if (req.headers['sec-fetch-site'] === 'cross-site') return false;
    if (!req.headers.origin) return true;
    try { const origin = new URL(req.headers.origin); return appOrigin ? origin.origin === appOrigin : origin.host === req.headers.host; } catch { return false; }
  };
  const handler = async (req, res) => {
    try {
      const path = new URL(req.url, 'http://bam.local').pathname;
      if (!path.startsWith('/api/')) return sendError(res, 404, 'not_found');
      const mutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
      if (mutation && !checkOrigin(req)) return sendError(res, 403, 'invalid_origin', { form: 'Permintaan berasal dari situs yang tidak diizinkan.' });
      if (mutation && path !== '/api/auth/logout' && !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return sendError(res, 415, 'unsupported_media_type');
      if (req.method === 'GET' && path === '/api/catalog') return json(res, 200, catalog.snapshot());
      if (path === '/api/admin/catalog' && req.method === 'PUT') {
        const user = currentUser(req); if (!user) return sendError(res, 401, 'unauthorized'); if (user.role !== 'admin') return sendError(res, 403, 'forbidden');
        return json(res, 200, catalog.save(await readBody(req, 20 * 1024 * 1024)));
      }
      if (req.method === 'GET' && path === '/api/auth/me') { const user = currentUser(req); return user ? json(res, 200, { user: userView(user) }) : sendError(res, 401, 'unauthorized'); }
      if (req.method === 'POST' && path === '/api/auth/register') {
        const fields = authFields(await readBody(req), true); if (Object.keys(fields.errors).length) return sendError(res, 422, 'validation_error', fields.errors);
        if (db.prepare('SELECT id FROM users WHERE email=?').get(fields.email)) return sendError(res, 409, 'email_exists', { email: 'Email sudah terdaftar.' });
        const passwordHash = await hashPassword(fields.password); const userId = randomUUID();
        db.prepare('INSERT INTO users(id,name,email,address,password_hash,created_at,role) VALUES(?,?,?,?,?,?,?)').run(userId, fields.name, fields.email, fields.address, passwordHash, new Date().toISOString(), 'user');
        return json(res, 201, { user: userView({ id: userId, ...fields, role: 'user' }) }, sessionHeaders(userId));
      }
      if (req.method === 'POST' && path === '/api/auth/login') {
        const fields = authFields(await readBody(req), false); if (Object.keys(fields.errors).length) return sendError(res, 422, 'validation_error', fields.errors);
        const key = `${req.socket?.remoteAddress || 'local'}:${fields.email}`; const now = Date.now(); let attempt = attempts.get(key);
        if (!attempt || attempt.until <= now) { attempt = { count: 0, until: now + 60000 }; if (attempts.size >= 10000) attempts.delete(attempts.keys().next().value); attempts.set(key, attempt); }
        if (attempt.count >= 10) return sendError(res, 429, 'too_many_attempts', { form: 'Terlalu banyak percobaan. Tunggu satu menit lalu coba lagi.' });
        const user = db.prepare('SELECT * FROM users WHERE email=?').get(fields.email);
        if (!user || !(await verifyPassword(fields.password, user.password_hash))) { attempt.count += 1; return sendError(res, 401, 'invalid_credentials', { form: 'Email atau kata sandi salah.' }); }
        attempts.delete(key); return json(res, 200, { user: userView(user) }, sessionHeaders(user.id));
      }
      if (req.method === 'POST' && path === '/api/auth/logout') {
        const value = token(req); if (value) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(value));
        return json(res, 200, { ok: true }, { 'set-cookie': `bam_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureCookies ? '; Secure' : ''}` });
      }
      if (path.startsWith('/api/admin/users')) {
        const admin = currentUser(req); if (!admin) return sendError(res, 401, 'unauthorized'); if (admin.role !== 'admin') return sendError(res, 403, 'forbidden');
        if (req.method === 'GET' && path === '/api/admin/users') return json(res, 200, { users: db.prepare('SELECT id,name,email,address,role,created_at AS createdAt FROM users ORDER BY created_at DESC').all() });
      }
      if ((req.method === 'PUT' && path === '/api/profile') || (req.method === 'PUT' && path.startsWith('/api/admin/users/'))) {
        const actor = currentUser(req); if (!actor) return sendError(res, 401, 'unauthorized'); const userId = path === '/api/profile' ? actor.id : path.slice('/api/admin/users/'.length);
        const body = await readBody(req); const name = typeof body?.name === 'string' ? body.name.trim() : ''; const address = typeof body?.address === 'string' ? body.address.trim() : '';
        if (name.length < 2 || name.length > 100 || address.length < 10 || address.length > 500) return sendError(res, 422, 'validation_error', { form: 'Nama atau alamat tidak valid.' });
        const user = db.prepare('SELECT id,name,email,address,role FROM users WHERE id=?').get(userId); if (!user) return sendError(res, 404, 'user_not_found');
        db.prepare('UPDATE users SET name=?,address=? WHERE id=?').run(name, address, userId); return json(res, 200, { user: userView({ ...user, name, address }) });
      }
      return sendError(res, 404, 'not_found');
    } catch (error) {
      if (error instanceof CatalogError) return sendError(res, error.status, error.code, { form: error.message });
      if (String(error.message).includes('UNIQUE constraint failed: users.email')) return sendError(res, 409, 'email_exists', { email: 'Email sudah terdaftar.' });
      return sendError(res, 500, 'server_error', { form: 'Server belum dapat menyimpan perubahan. Coba kembali.' });
    }
  };
  return { server: createServer(handler), handler, db, catalog };
}
