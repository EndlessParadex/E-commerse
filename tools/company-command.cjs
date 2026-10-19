const { existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { spawn } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

function companyEnvironment(environment = process.env) {
  const dbPath = resolve(environment.BAM_DB_PATH || 'data/company.sqlite');
  if (existsSync(dbPath)) {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try {
      const settings = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='company_settings'")
        .get();
      const mode =
        settings && db.prepare('SELECT mode FROM company_settings WHERE id=1').get()?.mode;
      const catalog = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='catalog_meta'")
        .get();
      const populated = catalog && db.prepare('SELECT id FROM catalog_meta WHERE id=1').get();
      if (mode === 'demo' || (!mode && populated))
        throw new Error(
          'Database ini milik instalasi BAM/demo. Pilih BAM_DB_PATH yang baru untuk perusahaan. Tidak ada data yang dihapus.',
        );
    } finally {
      db.close();
    }
  }
  return { ...environment, BAM_DB_PATH: dbPath, BAM_INSTALL_MODE: 'company' };
}
module.exports = { companyEnvironment };
if (require.main === module) {
  try {
    if (existsSync('.env')) process.loadEnvFile('.env');
    const [command, ...extra] = process.argv.slice(2);
    const entries = {
      dev: [
        'node_modules/concurrently/dist/bin/concurrently.js',
        '--kill-others-on-fail',
        'node server/index.js',
        'node node_modules/vite/bin/vite.js',
      ],
      server: ['server/index.js'],
      admin: ['server/create-admin.js', ...extra],
      owner: ['server/create-admin.js', '--owner', ...extra],
    };
    if (!entries[command]) throw new Error('Gunakan dev, server, admin, atau owner.');
    const child = spawn(process.execPath, entries[command], {
      env: companyEnvironment(),
      stdio: 'inherit',
      windowsHide: true,
    });
    child.on('error', (error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
    child.on('exit', (code) => {
      process.exitCode = code ?? 1;
    });
    process.on('SIGINT', () => child.kill('SIGINT'));
    process.on('SIGTERM', () => child.kill('SIGTERM'));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
