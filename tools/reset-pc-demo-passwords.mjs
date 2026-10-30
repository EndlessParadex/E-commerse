/**
 * Reset only the six isolated PC-demo identities. This deliberately never
 * reads BAM_DB_PATH or accepts a database path from the CLI.
 * Keep this local-only: its password is public and must not be used online.
 */
import { existsSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { hashPassword } from '../server/app.js';
import { accountSpecs, defaultPcDemoPath, PC_DEMO_PASSWORD } from './seed-pc-demo.mjs';

export async function resetPcDemoPasswords({
  rootDir = process.cwd(),
  password = PC_DEMO_PASSWORD,
} = {}) {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Reset password demo dilarang di lingkungan production.');
  if (typeof rootDir !== 'string' || !rootDir.trim())
    throw new Error('Folder proyek tidak valid.');
  if (typeof password !== 'string' || password.length < 8 || password.length > 128)
    throw new Error('Password demo harus memiliki 8–128 karakter.');

  // Always target the special PC demo filename, never the regular BAM database.
  const filename = resolve(rootDir, defaultPcDemoPath);
  if (!existsSync(filename) || !lstatSync(filename).isFile() || lstatSync(filename).isSymbolicLink())
    throw new Error('Database dummy PC tidak ditemukan: ' + filename);

  const db = new DatabaseSync(filename);
  try {
    db.exec('PRAGMA busy_timeout=1500; PRAGMA foreign_keys=ON;');
    // Verify all six identities and roles before changing a single credential.
    // These checks reject a renamed production DB or a partial demo setup.
    const find = db.prepare('SELECT id,name,email,role FROM users WHERE email=?');
    const accounts = accountSpecs.map((spec) => {
      const row = find.get(spec.email);
      if (!row || row.name !== spec.name || row.role !== spec.role)
        throw new Error('Identitas dummy tidak sesuai. Reset dibatalkan: ' + spec.email);
      if (
        !db
          .prepare('SELECT user_id FROM auth_account_state WHERE user_id=?')
          .get(row.id)
      )
        throw new Error('Status autentikasi akun demo tidak lengkap: ' + spec.email);
      return row;
    });
    if (
      !db.prepare('SELECT user_id FROM store_owners WHERE user_id=?').get(accounts[0].id) ||
      !db.prepare('SELECT user_id FROM b2b_sales_agents WHERE user_id=?').get(accounts[2].id)
    )
      throw new Error('Penanda Owner/Sales dummy tidak cocok; reset dibatalkan.');

    // Each account gets an independently salted hash despite sharing a test password.
    const hashes = await Promise.all(accounts.map(() => hashPassword(password)));
    db.exec('BEGIN IMMEDIATE');
    try {
      const update = db.prepare('UPDATE users SET password_hash=? WHERE id=?');
      const revision = db.prepare(
        'UPDATE auth_account_state SET credential_revision=credential_revision+1 WHERE user_id=?',
      );
      const clearSessions = db.prepare('DELETE FROM sessions WHERE user_id=?');
      const clearTokens = db.prepare('DELETE FROM auth_tokens WHERE user_id=?');
      for (const [index, account] of accounts.entries()) {
        if (update.run(hashes[index], account.id).changes !== 1)
          throw new Error('Password tidak dapat disimpan: ' + account.email);
        if (revision.run(account.id).changes !== 1)
          throw new Error('Revisi autentikasi gagal: ' + account.email);
        clearSessions.run(account.id);
        clearTokens.run(account.id);
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return { path: filename, accounts: accounts.map(({ email }) => email), password };
  } finally {
    db.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 2) {
    console.error('Perintah reset ini tidak menerima argumen lokasi atau akun.');
    process.exitCode = 1;
  } else {
    resetPcDemoPasswords()
      .then((result) => {
        console.log('Password 6 akun dummy berhasil direset tanpa menghapus data toko/pesanan.');
        console.log('Database:', result.path);
        console.log('Email:');
        for (const email of result.accounts) console.log('  ' + email);
        console.log('Password semua akun:', result.password);
        console.log('HANYA untuk localhost. Jangan gunakan password ini di server online.');
      })
      .catch((error) => {
        console.error('Reset password dummy dibatalkan:', error.message);
        process.exitCode = 1;
      });
  }
}
