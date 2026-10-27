import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { backupDatabase, verifyBackup, restoreBackup } from './database-backup.mjs';
test('live WAL backup verifies, restores to a new database, and refuses overwrite or corruption', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bam-backup-test-'));
  const source = join(directory, 'source.sqlite');
  const appOptions = {
    logger: () => {},
    mailConfig: {},
    mailer: { enabled: false },
    mailTransportFactory: () => ({ enabled: false }),
  };
  const app = createApp({ dbPath: source, ...appOptions });
  try {
    app.db
      .prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)')
      .run(
        'backup-user',
        'Contoh',
        'backup@fixture.test',
        'Alamat contoh',
        'unused',
        '2026-10-27',
        'admin',
      );
    app.db
      .prepare('INSERT INTO store_owners(user_id,granted_at) VALUES(?,?)')
      .run('backup-user', '2026-10-27');
    app.emailSettings.save(
      { id: 'backup-user', role: 'admin' },
      {
        revision: 0,
        settings: {
          host: 'smtp.fixture.test',
          port: 587,
          user: 'fixture',
          password: 'backup-fixture-only',
          from: 'sender@fixture.test',
          publicUrl: 'https://fixture.test/',
        },
      },
    );
    const result = await backupDatabase({ source, directory: join(directory, 'backups') });
    assert.equal(verifyBackup(result.folder).counts.users, 1);
    const destination = join(directory, 'restored.sqlite');
    await restoreBackup({ directory: result.folder, destination });
    const restored = createApp({ dbPath: destination, ...appOptions });
    assert.equal(
      restored.db.prepare('SELECT name FROM users WHERE id=?').get('backup-user').name,
      'Contoh',
    );
    assert.equal(restored.emailSettings.runtime().settings.password, 'backup-fixture-only');
    restored.db.close();
    await assert.rejects(restoreBackup({ directory: result.folder, destination }), /sudah ada/);
    assert.deepEqual(readFileSync(destination + '.mail-key'), readFileSync(source + '.mail-key'));
    writeFileSync(join(result.folder, 'database.sqlite'), 'damaged');
    assert.throws(() => verifyBackup(result.folder), /Checksum/);
  } finally {
    app.db.close();
  }
});
