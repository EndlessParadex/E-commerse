import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';

const scrypt = promisify(scryptCallback);
const port = Number(process.env.PORT || 3001);
const dbPath = resolve(process.env.BAM_DB_PATH || 'data/bam.sqlite');
mkdirSync(dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec(`PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, address TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);`);
try { db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'"); } catch (error) { if (!String(error.message).includes('duplicate column')) throw error; }
const json = (res, status, body, headers = {}) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }); res.end(JSON.stringify(body)); };
const readBody = (req) => new Promise((resolveBody, reject) => { let raw = ''; req.on('data', (chunk) => { raw += chunk; if (raw.length > 100_000) reject(new Error('payload_too_large')); }); req.on('end', () => { try { resolveBody(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('invalid_json')); } }); req.on('error', reject); });
const valid = (body, registration) => { const name = typeof body.name === 'string' ? body.name.trim() : ''; const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''; const address = typeof body.address === 'string' ? body.address.trim() : ''; const password = typeof body.password === 'string' ? body.password : ''; const errors = {}; if (registration && (name.length < 2 || name.length > 100)) errors.name = 'Nama harus berisi 2–100 karakter.'; if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) errors.email = 'Email tidak valid.'; if (!password || password.length > 128 || (registration && password.length < 8)) errors.password = registration ? 'Kata sandi harus 8–128 karakter.' : 'Kata sandi tidak valid.'; if (registration && (address.length < 10 || address.length > 500)) errors.address = 'Alamat harus berisi 10–500 karakter.'; return { errors, name, email, address, password }; };
async function hashPassword(password) { const salt = randomBytes(16); const key = await scrypt(password, salt, 64); return `${salt.toString('hex')}:${Buffer.from(key).toString('hex')}`; }
async function verifyPassword(password, encoded) { const [saltHex, keyHex] = String(encoded).split(':'); if (!saltHex || !keyHex) return false; const key = await scrypt(password, Buffer.from(saltHex, 'hex'), 64); const expected = Buffer.from(keyHex, 'hex'); return expected.length === key.length && timingSafeEqual(expected, key); }
function userView(user) { return { id: user.id, name: user.name, email: user.email, address: user.address, role: user.role || 'user' }; }
import { createHash } from 'node:crypto';
function digest(token) { return createHash('sha256').update(token).digest('hex'); }
function setSession(res, userId) { const token = randomBytes(32).toString('base64url'); const expires = Date.now() + 1000 * 60 * 60 * 24 * 30; db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(digest(token), userId, expires); return { 'set-cookie': `bam_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000` }; }
function currentUser(req) { const cookie = req.headers.cookie?.match(/(?:^|;\s*)bam_session=([^;]+)/)?.[1]; if (!cookie) return null; const session = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?').get(digest(cookie)); if (!session || session.expires_at < Date.now()) return null; return db.prepare('SELECT id, name, email, address FROM users WHERE id = ?').get(session.user_id); }
function sendError(res, status, code, errors) { json(res, status, { error: code, ...(errors ? { errors } : {}) }); }

const server = createServer(async (req, res) => {
  try {
    if (!req.url.startsWith('/api/')) return json(res, 404, { error: 'not_found' });
    const path = new URL(req.url, `http://${req.headers.host}`).pathname;
    if (req.method === 'GET' && path === '/api/auth/me') { const user = currentUser(req); return user ? json(res, 200, { user }) : sendError(res, 401, 'unauthorized'); }
    if (req.method === 'POST' && path === '/api/auth/register') { const body = await readBody(req); const fields = valid(body, true); if (Object.keys(fields.errors).length) return sendError(res, 422, 'validation_error', fields.errors); if (db.prepare('SELECT id FROM users WHERE email = ?').get(fields.email)) return sendError(res, 409, 'email_exists', { email: 'Email sudah terdaftar.' }); const userId = randomUUID(); db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)').run(userId, fields.name, fields.email, fields.address, await hashPassword(fields.password), new Date().toISOString()); return json(res, 201, { user: userView({ id: userId, name: fields.name, email: fields.email, address: fields.address }), }, setSession(res, userId)); }
    if (req.method === 'POST' && path === '/api/auth/login') { const body = await readBody(req); const fields = valid(body, false); if (Object.keys(fields.errors).length) return sendError(res, 422, 'validation_error', fields.errors); const user = db.prepare('SELECT * FROM users WHERE email = ?').get(fields.email); if (!user || !(await verifyPassword(fields.password, user.password_hash))) return sendError(res, 401, 'invalid_credentials', { form: 'Email atau kata sandi salah.' }); return json(res, 200, { user: userView(user) }, setSession(res, user.id)); }
    if (req.method === 'POST' && path === '/api/auth/logout') { const cookie = req.headers.cookie?.match(/(?:^|;\s*)bam_session=([^;]+)/)?.[1]; if (cookie) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(cookie)); return json(res, 200, { ok: true }, { 'set-cookie': 'bam_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' }); }
    if (req.method === 'GET' && path === '/api/admin/users') { const admin = currentUser(req); if (!admin) return sendError(res, 401, 'unauthorized'); if (admin.role !== 'admin') return sendError(res, 403, 'forbidden'); const users = db.prepare('SELECT id, name, email, address, role, created_at AS createdAt FROM users ORDER BY created_at DESC').all(); return json(res, 200, { users }); }
    if (req.method === 'PUT' && path.startsWith('/api/admin/users/')) { const admin = currentUser(req); if (!admin) return sendError(res, 401, 'unauthorized'); if (admin.role !== 'admin') return sendError(res, 403, 'forbidden'); const userId = path.slice('/api/admin/users/'.length); const body = await readBody(req); const name = typeof body.name === 'string' ? body.name.trim() : ''; const address = typeof body.address === 'string' ? body.address.trim() : ''; if (name.length < 2 || name.length > 100 || address.length < 10 || address.length > 500) return sendError(res, 422, 'validation_error', { form: 'Nama atau alamat tidak valid.' }); const target = db.prepare('SELECT id, name, email, address, role FROM users WHERE id = ?').get(userId); if (!target) return sendError(res, 404, 'user_not_found'); db.prepare('UPDATE users SET name = ?, address = ? WHERE id = ?').run(name, address, userId); return json(res, 200, { user: userView({ ...target, name, address }) }); }
    if (req.method === 'PUT' && path === '/api/profile') { const user = currentUser(req); if (!user) return sendError(res, 401, 'unauthorized'); const body = await readBody(req); const name = typeof body.name === 'string' ? body.name.trim() : ''; const address = typeof body.address === 'string' ? body.address.trim() : ''; if (name.length < 2 || name.length > 100 || address.length < 10 || address.length > 500) return sendError(res, 422, 'validation_error', { form: 'Nama atau alamat tidak valid.' }); db.prepare('UPDATE users SET name = ?, address = ? WHERE id = ?').run(name, address, user.id); return json(res, 200, { user: userView({ ...user, name, address }) }); }
    return json(res, 404, { error: 'not_found' });
  } catch (error) { return sendError(res, error.message === 'payload_too_large' ? 413 : 400, error.message || 'bad_request'); }
});
server.listen(port, () => console.log(`BAM API listening on http://localhost:${port}`));
