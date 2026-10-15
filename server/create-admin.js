import { loadLocalEnv } from './loadEnv.js';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomBytes, scrypt as scryptCallback, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { ownerSchema } from './emailSettings.js';

loadLocalEnv();

const scrypt = promisify(scryptCallback);
const args = process.argv.slice(2);
const owner = args[0] === '--owner';
const [emailArg, nameArg, addressArg] = owner ? args.slice(1) : args;
const password = process.env.BAM_ADMIN_PASSWORD;
if (!emailArg || !nameArg || !addressArg || !password)
  throw new Error(
    `Gunakan: BAM_ADMIN_PASSWORD="..." npm run ${owner ? 'create-owner' : 'create-admin'} -- email "Nama Admin" "Alamat lengkap"`,
  );
const email = emailArg.trim().toLowerCase();
const name = nameArg.trim();
const address = addressArg.trim();
if (
  password.length < 8 ||
  password.length > 128 ||
  name.length < 2 ||
  name.length > 100 ||
  address.length < 10 ||
  address.length > 500 ||
  email.length > 254 ||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
)
  throw new Error('Nama/alamat/email tidak valid; kata sandi harus 8–128 karakter.');
const dbPath = resolve(process.env.BAM_DB_PATH || 'data/bam.sqlite');
mkdirSync(dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec(
  "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, address TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user')",
);
try {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
} catch (error) {
  if (!String(error.message).includes('duplicate column')) throw error;
}
const salt = randomBytes(16);
const key = await scrypt(password, salt, 64);
const hash = `${salt.toString('hex')}:${Buffer.from(key).toString('hex')}`;
const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
db.exec(ownerSchema);
db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; BEGIN IMMEDIATE');
try {
  if (existing) {
    db.prepare(
      "UPDATE users SET name = ?, address = ?, password_hash = ?, role = 'admin' WHERE id = ?",
    ).run(name, address, hash, existing.id);
    const tables = new Set(
      db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map((row) => row.name),
    );
    if (tables.has('sessions')) db.prepare('DELETE FROM sessions WHERE user_id=?').run(existing.id);
    if (tables.has('auth_tokens'))
      db.prepare('DELETE FROM auth_tokens WHERE user_id=?').run(existing.id);
    if (tables.has('auth_account_state'))
      db.prepare(
        'INSERT INTO auth_account_state(user_id,credential_revision) VALUES(?,1) ON CONFLICT(user_id) DO UPDATE SET credential_revision=credential_revision+1',
      ).run(existing.id);
  } else
    db.prepare(
      'INSERT INTO users(id,name,email,address,password_hash,created_at,role) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(randomUUID(), name, email, address, hash, new Date().toISOString(), 'admin');
  if (owner) {
    const row = db.prepare('SELECT id FROM users WHERE email=?').get(email);
    db.prepare(
      'INSERT INTO store_owners(user_id,granted_at) VALUES(?,?) ON CONFLICT(user_id) DO NOTHING',
    ).run(row.id, new Date().toISOString());
    db.prepare(
      "INSERT INTO account_access(user_id,revision) VALUES(?,1) ON CONFLICT(user_id) DO UPDATE SET revision=revision+1,disabled_at=NULL,disabled_by=NULL,reason='Pemulihan pemilik dari server'",
    ).run(row.id);
  } else if (existing) {
    db.prepare(
      'INSERT INTO account_access(user_id,revision) VALUES(?,1) ON CONFLICT(user_id) DO UPDATE SET revision=revision+1',
    ).run(existing.id);
  }
  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
}
db.close();
console.log(`${owner ? 'Pemilik toko' : 'Admin'} siap: ${email}`);
