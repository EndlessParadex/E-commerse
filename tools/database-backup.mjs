import { backup, DatabaseSync } from 'node:sqlite';
import {
  constants,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  realpathSync,
} from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadLocalEnv } from '../server/loadEnv.js';

const checksum = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
function inspect(database) {
  const connection = new DatabaseSync(database, { readOnly: true });
  try {
    if (
      connection.prepare('PRAGMA quick_check').get().quick_check !== 'ok' ||
      connection.prepare('PRAGMA foreign_key_check').all().length
    )
      throw new Error('Pemeriksaan integritas database gagal.');
    const tables = new Set(
      connection
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map((row) => row.name),
    );
    if (!['users', 'orders', 'catalog_meta'].every((name) => tables.has(name)))
      throw new Error('Berkas bukan database BAM yang lengkap.');
    return {
      users: connection.prepare('SELECT COUNT(*) AS n FROM users').get().n,
      orders: connection.prepare('SELECT COUNT(*) AS n FROM orders').get().n,
    };
  } finally {
    connection.close();
  }
}
export async function backupDatabase({ source, directory = 'backups' }) {
  if (!source || !existsSync(source)) throw new Error('Database sumber tidak ditemukan.');
  const input = realpathSync(source);
  inspect(input);
  const root = resolve(directory);
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const folder = join(
    root,
    'bam-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID().slice(0, 8),
  );
  mkdirSync(folder, { mode: 0o700 });
  const output = join(folder, 'database.sqlite');
  const keyPath = input + '.mail-key';
  const keyHash = existsSync(keyPath) ? checksum(keyPath) : null;
  const connection = new DatabaseSync(input, { readOnly: true });
  try {
    await backup(connection, output);
  } finally {
    connection.close();
  }
  if (keyHash) {
    copyFileSync(keyPath, join(folder, 'database.sqlite.mail-key'), constants.COPYFILE_EXCL);
    if (
      checksum(keyPath) !== keyHash ||
      checksum(join(folder, 'database.sqlite.mail-key')) !== keyHash
    )
      throw new Error(
        'Kunci email berubah saat backup. Ulangi backup sebelum memakai salinan ini.',
      );
  }
  const counts = inspect(output);
  const manifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    source: basename(input),
    databaseSha256: checksum(output),
    mailKeySha256: keyHash,
    counts,
  };
  writeFileSync(join(folder, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
  return { folder, ...manifest };
}
export function verifyBackup(directory) {
  const root = realpathSync(directory);
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  const database = join(root, 'database.sqlite');
  if (
    manifest.version !== 1 ||
    !/^[a-f0-9]{64}$/.test(manifest.databaseSha256 || '') ||
    checksum(database) !== manifest.databaseSha256
  )
    throw new Error('Checksum database tidak sesuai manifest.');
  if (
    manifest.mailKeySha256 &&
    checksum(join(root, 'database.sqlite.mail-key')) !== manifest.mailKeySha256
  )
    throw new Error('Kunci email tidak sesuai manifest.');
  return { folder: root, manifest, counts: inspect(database) };
}
export async function restoreBackup({ directory, destination }) {
  if (!destination) throw new Error('Tentukan berkas database tujuan baru.');
  const verified = verifyBackup(directory);
  const output = resolve(destination);
  if (
    existsSync(output) ||
    existsSync(output + '-wal') ||
    existsSync(output + '-shm') ||
    existsSync(output + '.mail-key')
  )
    throw new Error(
      'Tujuan sudah ada. Restore hanya diizinkan ke lokasi baru agar data tidak tertimpa.',
    );
  mkdirSync(dirname(output), { recursive: true, mode: 0o700 });
  // COPYFILE_EXCL reserves a new destination and refuses to overwrite any existing file.
  // The backup is a standalone database snapshot, not a live WAL database.
  copyFileSync(join(verified.folder, 'database.sqlite'), output, constants.COPYFILE_EXCL);
  if (verified.manifest.mailKeySha256)
    copyFileSync(
      join(verified.folder, 'database.sqlite.mail-key'),
      output + '.mail-key',
      constants.COPYFILE_EXCL,
    );
  return { destination: output, counts: inspect(output) };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    loadLocalEnv();
    const [action, ...args] = process.argv.slice(2);
    const option = (key) => {
      const index = args.indexOf(key);
      return index >= 0 ? args[index + 1] : undefined;
    };
    const result =
      action === 'backup'
        ? await backupDatabase({
            source: option('--source') || process.env.BAM_DB_PATH || 'data/bam.sqlite',
            directory: option('--out') || 'backups',
          })
        : action === 'verify'
          ? verifyBackup(option('--from') || '')
          : action === 'restore'
            ? await restoreBackup({
                directory: option('--from') || '',
                destination: option('--to'),
              })
            : (() => {
                throw new Error(
                  'Gunakan backup, verify --from <folder>, atau restore --from <folder> --to <database-baru>.',
                );
              })();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
