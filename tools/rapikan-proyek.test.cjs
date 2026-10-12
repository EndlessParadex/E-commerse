const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const os = require('node:os');
const { cleanup, restoreBackup, planCleanup } = require('./rapikan-proyek.cjs');
const hash = bytes => crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + bytes.length + '\0'), bytes])).digest('hex');
function fixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'bam-cleanup-')); const root = path.join(base, 'project');
  const write = (relative, value) => { const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); };
  write('package.json', JSON.stringify({ name: 'e-commerse' })); write('index.html', '<script type="module" src="/src/main.jsx"></script>'); write('src/main.jsx', '// Active entry');
  const originals = new Map([['pages/old.test.js', Buffer.from('// Legacy test\r\n')], ['data/old.js', Buffer.from('// Legacy data\n')], ['assets/photo.png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 255])]]);
  for (const [relative, bytes] of originals) { write(relative, bytes); write('src/' + relative, Buffer.from('// Current file: ' + relative)); }
  write('data/bam.sqlite', Buffer.from('database fixture unchanged')); write('data/bam.sqlite-wal', 'wal fixture'); write('data/custom.js', '// User file outside cleanup manifest'); write('server/app.js', '// API'); write('.git/config', '// Git metadata');
  const list = { version: 1, commit: 'fixture', files: [...originals].map(([relative, bytes]) => ({ path: relative, sha: hash(relative.endsWith('.js') ? Buffer.from(bytes.toString().replace(/\r\n/g, '\n')) : bytes) })) };
  const dispose = () => {
    const resolved = fs.realpathSync(base); const temporary = fs.realpathSync(os.tmpdir());
    assert.ok(resolved.startsWith(temporary + path.sep) && path.basename(resolved).startsWith('bam-cleanup-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  };
  return { base, root, write, list, originals, dispose };
}

test('cleanup archives exact bytes, preserves database/user files/active source, and is idempotent', () => {
  const f = fixture();
  try {
    const preserved = ['src/main.jsx', ...[...f.originals.keys()].map(file => 'src/' + file), 'data/bam.sqlite', 'data/bam.sqlite-wal', 'data/custom.js', 'server/app.js', '.git/config'];
    const before = new Map(preserved.map(file => [file, fs.readFileSync(path.join(f.root, file))]));
    assert.equal(cleanup(f.root, { list: f.list, check: true }).count, 3);
    assert.ok(fs.existsSync(path.join(f.root, 'pages/old.test.js')));
    const result = cleanup(f.root, { list: f.list }); assert.equal(result.count, 3);
    assert.ok(!result.backup.startsWith(fs.realpathSync(f.root) + path.sep), 'backup lives outside test discovery');
    const record = JSON.parse(zlib.gunzipSync(fs.readFileSync(result.backup)));
    for (const entry of record.files) assert.deepEqual(Buffer.from(entry.content, 'base64'), f.originals.get(entry.path));
    for (const [file, bytes] of before) assert.deepEqual(fs.readFileSync(path.join(f.root, file)), bytes);
    assert.equal(cleanup(f.root, { list: f.list }).count, 0);
    assert.equal(restoreBackup(f.root, result.backup, f.list).count, 3);
    for (const [file, bytes] of f.originals) assert.deepEqual(fs.readFileSync(path.join(f.root, file)), bytes);
    assert.equal(restoreBackup(f.root, result.backup, f.list).count, 0);
  } finally { f.dispose(); }
});

test('modified legacy files stop the whole cleanup before any file is removed', () => {
  const f = fixture();
  try {
    f.write('data/old.js', '// Unsaved user edit');
    assert.throws(() => cleanup(f.root, { list: f.list }), /isi telah berubah/);
    assert.ok(fs.existsSync(path.join(f.root, 'pages/old.test.js'))); assert.ok(!fs.existsSync(path.join(f.base, '.bam-code-backups')));
  } finally { f.dispose(); }
});

test('restore checks all conflicts before writing and never overwrites newer files', () => {
  const f = fixture();
  try {
    const result = cleanup(f.root, { list: f.list }); f.write('data/old.js', '// Newer user file');
    assert.throws(() => restoreBackup(f.root, result.backup, f.list), /isi berbeda/);
    assert.equal(fs.readFileSync(path.join(f.root, 'data/old.js'), 'utf8'), '// Newer user file');
    assert.ok(!fs.existsSync(path.join(f.root, 'pages/old.test.js')));
  } finally { f.dispose(); }
});

test('damaged backup is rejected before restoring files', () => {
  const f = fixture();
  try {
    const result = cleanup(f.root, { list: f.list }); const record = JSON.parse(zlib.gunzipSync(fs.readFileSync(result.backup)));
    record.files[0].content = Buffer.from('changed').toString('base64'); fs.writeFileSync(result.backup, zlib.gzipSync(Buffer.from(JSON.stringify(record))));
    assert.throws(() => restoreBackup(f.root, result.backup, f.list), /Pemeriksaan cadangan gagal/);
    assert.ok(!fs.existsSync(path.join(f.root, 'pages/old.test.js')));
  } finally { f.dispose(); }
});

test('cleanup rejects paths outside the legacy allowlist and protected database files', () => {
  const f = fixture();
  try {
    for (const relative of ['../outside.js', '/absolute.js', 'src/main.jsx', 'server/app.js', '.git/config', 'data/bam.sqlite', 'data/BAM.SQLITE-WAL']) {
      assert.throws(() => planCleanup(f.root, { version: 1, files: [{ path: relative, sha: 'a'.repeat(40) }] }), /Jalur di luar/);
    }
    const absentSource = path.join(f.root, 'src/data/old.js'); fs.unlinkSync(absentSource);
    assert.throws(() => cleanup(f.root, { list: f.list }), /pasangan di src/);
    assert.ok(fs.existsSync(path.join(f.root, 'data/old.js')));
  } finally { f.dispose(); }
});

test('cleanup refuses a different project root', () => {
  const f = fixture();
  try {
    f.write('package.json', JSON.stringify({ name: 'different-project' }));
    assert.throws(() => cleanup(f.root, { list: f.list }), /bukan proyek BAM/);
    assert.ok(fs.existsSync(path.join(f.root, 'data/old.js')));
  } finally { f.dispose(); }
});
