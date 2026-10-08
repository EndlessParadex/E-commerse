import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomBytes, scrypt as scryptCallback, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';

const scrypt = promisify(scryptCallback);
const [emailArg, nameArg, addressArg] = process.argv.slice(2);
const password = process.env.BAM_ADMIN_PASSWORD;
if (!emailArg || !nameArg || !addressArg || !password) throw new Error('Gunakan: BAM_ADMIN_PASSWORD="..." npm run create-admin -- email "Nama Admin" "Alamat lengkap"');
const email = emailArg.trim().toLowerCase();
const name = nameArg.trim();
const address = addressArg.trim();
if (password.length < 8 || password.length > 128 || name.length < 2 || name.length > 100 || address.length < 10 || address.length > 500 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Nama/alamat/email tidak valid; kata sandi harus 8–128 karakter.');
const dbPath = resolve(process.env.BAM_DB_PATH || 'data/bam.sqlite');
mkdirSync(dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, address TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user')");
try { db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'"); } catch (error) { if (!String(error.message).includes('duplicate column')) throw error; }
const salt = randomBytes(16);
const key = await scrypt(password, salt, 64);
const hash = `${salt.toString('hex')}:${Buffer.from(key).toString('hex')}`;
const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
if (existing) db.prepare('UPDATE users SET name = ?, address = ?, password_hash = ?, role = \'admin\' WHERE id = ?').run(name, address, hash, existing.id);
else db.prepare('INSERT INTO users(id,name,email,address,password_hash,created_at,role) VALUES (?, ?, ?, ?, ?, ?, ?)').run(randomUUID(), name, email, address, hash, new Date().toISOString(), 'admin');
db.close(); console.log(`Admin siap: ${email}`);
