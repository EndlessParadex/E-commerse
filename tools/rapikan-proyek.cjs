const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const manifest = require('./legacy-duplicates.json');
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const blobHash = (bytes) =>
  crypto
    .createHash('sha1')
    .update(Buffer.concat([Buffer.from('blob ' + bytes.length + '\0'), bytes]))
    .digest('hex');
const matchesBlob = (bytes, sha) =>
  blobHash(bytes) === sha ||
  blobHash(Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'))) === sha;
const samePath = (first, second) =>
  process.platform === 'win32' ? first.toLowerCase() === second.toLowerCase() : first === second;

function projectRoot(directory) {
  const root = fs.realpathSync(directory);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  if (pkg.name !== 'e-commerse' || !/src=["']\/src\/main\.jsx["']/.test(html))
    throw new Error('Folder ini bukan proyek BAM yang memakai src/main.jsx.');
  const entry = fs.realpathSync(path.join(root, 'src', 'main.jsx'));
  if (!samePath(entry, path.join(root, 'src', 'main.jsx')))
    throw new Error('Sumber aplikasi memakai tautan ke folder lain.');
  return root;
}

function safeFile(root, relative) {
  if (
    typeof relative !== 'string' ||
    relative.includes('\\') ||
    relative.split('/').some((part) => !part || part === '.' || part === '..') ||
    !/^(?:App\.jsx|main\.jsx|(?:assets|components|data|pages|state|styles)\/.+)$/.test(relative) ||
    /\.sqlite(?:$|[.-])|\.(?:db|env)$/i.test(relative)
  )
    throw new Error('Jalur di luar daftar kode lama: ' + relative);
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep)) throw new Error('Jalur keluar dari folder proyek.');
  // Check existing parents too: a junction/symlink must never lead outside the project.
  let parent = path.dirname(file);
  while (!fs.existsSync(parent)) parent = path.dirname(parent);
  if (
    parent !== root &&
    (fs.lstatSync(parent).isSymbolicLink() || !samePath(fs.realpathSync(parent), parent))
  )
    throw new Error('Folder memakai tautan ke lokasi lain: ' + relative);
  if (fs.existsSync(file)) {
    if (
      !fs.lstatSync(file).isFile() ||
      fs.lstatSync(file).isSymbolicLink() ||
      !samePath(fs.realpathSync(file), file)
    )
      throw new Error('File atau tautan tidak aman: ' + relative);
  }
  return file;
}

function planCleanup(directory, list = manifest) {
  const root = projectRoot(directory);
  const files = [];
  const changed = [];
  const seen = new Set();
  if (list.version !== 1 || !Array.isArray(list.files))
    throw new Error('Daftar perapihan tidak valid.');
  for (const entry of list.files) {
    const file = safeFile(root, entry.path);
    if (seen.has(entry.path) || !/^[a-f0-9]{40}$/.test(entry.sha))
      throw new Error('Daftar file duplikat tidak valid.');
    seen.add(entry.path);
    if (!fs.existsSync(file)) continue;
    const counterpart = path.join(root, 'src', entry.path);
    if (
      !fs.existsSync(counterpart) ||
      !fs.statSync(counterpart).isFile() ||
      !samePath(fs.realpathSync(counterpart), counterpart)
    ) {
      changed.push(entry.path + ' (pasangan di src tidak tersedia)');
      continue;
    }
    const bytes = fs.readFileSync(file);
    if (!matchesBlob(bytes, entry.sha)) {
      changed.push(entry.path + ' (isi telah berubah)');
      continue;
    }
    files.push({ path: entry.path, file, bytes, sha256: sha256(bytes) });
  }
  if (changed.length)
    throw new Error(
      'Perapihan dihentikan karena ada file yang perlu diperiksa terlebih dahulu:\n' +
        changed.join('\n'),
    );
  return { root, files };
}

function verifyBackup(record, root, list) {
  if (
    record.version !== 1 ||
    record.projectRoot !== root ||
    !Array.isArray(record.files) ||
    record.files.length > list.files.length
  )
    throw new Error('Cadangan tidak sesuai dengan proyek ini.');
  const allowed = new Map(list.files.map((entry) => [entry.path, entry.sha]));
  const seen = new Set();
  return record.files.map((entry) => {
    const file = safeFile(root, entry.path);
    if (!allowed.has(entry.path) || seen.has(entry.path) || typeof entry.content !== 'string')
      throw new Error('Isi cadangan tidak sesuai daftar kode lama.');
    seen.add(entry.path);
    const bytes = Buffer.from(entry.content, 'base64');
    if (sha256(bytes) !== entry.sha256 || !matchesBlob(bytes, allowed.get(entry.path)))
      throw new Error('Pemeriksaan cadangan gagal: ' + entry.path);
    return { ...entry, file, bytes };
  });
}

function cleanup(directory, { check = false, list = manifest } = {}) {
  const plan = planCleanup(directory, list);
  if (check || !plan.files.length) return { count: plan.files.length, backup: null, check };
  const parent = path.dirname(plan.root);
  const backupDir = path.resolve(parent, '.bam-code-backups');
  if (!backupDir.startsWith(parent + path.sep) || backupDir.startsWith(plan.root + path.sep))
    throw new Error('Folder cadangan harus di samping proyek.');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
  if (
    !fs.lstatSync(backupDir).isDirectory() ||
    fs.lstatSync(backupDir).isSymbolicLink() ||
    fs.realpathSync(backupDir) !== backupDir
  )
    throw new Error('Folder cadangan tidak aman.');
  const backup = path.join(
    backupDir,
    'BAM-duplikat-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex') + '.json.gz',
  );
  const record = {
    version: 1,
    projectRoot: plan.root,
    commit: list.commit,
    files: plan.files.map((entry) => ({
      path: entry.path,
      sha256: entry.sha256,
      content: entry.bytes.toString('base64'),
    })),
  };
  fs.writeFileSync(backup, zlib.gzipSync(Buffer.from(JSON.stringify(record))), {
    flag: 'wx',
    mode: 0o600,
  });
  const verified = verifyBackup(
    JSON.parse(
      zlib
        .gunzipSync(fs.readFileSync(backup), { maxOutputLength: 64 * 1024 * 1024 })
        .toString('utf8'),
    ),
    plan.root,
    list,
  );
  if (verified.length !== plan.files.length)
    throw new Error('Cadangan belum lengkap; file lama tetap tersedia.');
  const removed = [];
  try {
    for (const entry of plan.files) {
      const file = safeFile(plan.root, entry.path);
      if (sha256(fs.readFileSync(file)) !== entry.sha256)
        throw new Error('File berubah saat perapihan: ' + entry.path);
      fs.unlinkSync(file);
      removed.push(entry);
    }
  } catch (error) {
    for (const entry of removed)
      if (!fs.existsSync(entry.file)) fs.writeFileSync(entry.file, entry.bytes, { flag: 'wx' });
    throw new Error('Perapihan belum selesai. Cadangan: ' + backup + '\n' + error.message);
  }
  // Only remove empty legacy directories; a data folder containing SQLite stays.
  const directories = new Set();
  for (const entry of plan.files) {
    let dir = path.dirname(entry.file);
    while (dir !== plan.root) {
      directories.add(dir);
      dir = path.dirname(dir);
    }
  }
  for (const dir of [...directories].sort((a, b) => b.length - a.length)) {
    if (
      dir.startsWith(plan.root + path.sep) &&
      fs.existsSync(dir) &&
      !fs.lstatSync(dir).isSymbolicLink() &&
      fs.realpathSync(dir).startsWith(plan.root + path.sep) &&
      !fs.readdirSync(dir).length
    )
      fs.rmdirSync(dir);
  }
  return { count: removed.length, backup, check: false };
}

function restoreBackup(directory, backup, list = manifest) {
  const root = projectRoot(directory);
  const record = JSON.parse(
    zlib
      .gunzipSync(fs.readFileSync(backup), { maxOutputLength: 64 * 1024 * 1024 })
      .toString('utf8'),
  );
  const files = verifyBackup(record, root, list);
  for (const entry of files)
    if (fs.existsSync(entry.file) && sha256(fs.readFileSync(entry.file)) !== entry.sha256)
      throw new Error('Pemulihan dihentikan: file sudah ada dengan isi berbeda: ' + entry.path);
  let count = 0;
  for (const entry of files) {
    if (fs.existsSync(entry.file)) continue;
    safeFile(root, entry.path);
    fs.mkdirSync(path.dirname(entry.file), { recursive: true });
    fs.writeFileSync(entry.file, entry.bytes, { flag: 'wx' });
    count++;
  }
  return { count };
}

module.exports = { planCleanup, cleanup, restoreBackup };
if (require.main === module) {
  try {
    const root = path.resolve(__dirname, '..');
    const args = process.argv.slice(2);
    if (args[0] === '--restore' && args.length === 2)
      console.log('Pemulihan selesai: ' + restoreBackup(root, args[1]).count + ' file.');
    else if (!args.length || (args.length === 1 && args[0] === '--check')) {
      const result = cleanup(root, { check: args[0] === '--check' });
      console.log(
        result.check
          ? result.count + ' file duplikat dapat dirapikan.'
          : result.count
            ? result.count + ' file duplikat telah diarsipkan.'
            : 'Proyek sudah rapi; tidak ada file lama dalam daftar.',
      );
      if (result.backup) {
        console.log('Cadangan: ' + result.backup);
        console.log(
          "Untuk memulihkan: npm run cleanup -- --restore '" +
            result.backup.replace(/'/g, "''") +
            "'",
        );
      }
    } else
      throw new Error(
        'Gunakan npm run cleanup, npm run cleanup -- --check, atau npm run cleanup -- --restore <cadangan>.',
      );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
