// Start the real BAM server on a fresh demo database for the browser smoke tests.
// The database lives in a temporary folder, so the tests never touch local or production data.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seedPcDemo } from '../tools/seed-pc-demo.mjs';

const dbPath = join(mkdtempSync(join(tmpdir(), 'bam-e2e-')), 'bam-e2e.sqlite');
await seedPcDemo({ dbPath });
// Explicit values win over a developer's .env (process.loadEnvFile never overwrites them).
Object.assign(process.env, {
  BAM_DB_PATH: dbPath,
  PORT: process.env.E2E_PORT || '4610',
  HOST: '127.0.0.1',
  BAM_PUBLIC_URL: '',
});
await import('../server/index.js');
