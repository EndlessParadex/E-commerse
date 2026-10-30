import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { verifyPassword } from '../server/authSecurity.js';
import { accountSpecs, PC_DEMO_PASSWORD, seedPcDemo } from './seed-pc-demo.mjs';
import { resetPcDemoPasswords } from './reset-pc-demo-passwords.mjs';

test('reset existing six PC demo accounts keeps shared carts and invalidates old sessions', async () => {
  const rootDir = mkdtempSync(join(tmpdir(), 'bam-reset-pc-'));
  const dbPath = join(rootDir, 'data', 'bam-pc-demo.sqlite');
  try {
    await seedPcDemo({
      dbPath,
      password: 'OldTestDemoPassword!2',
      now: new Date('2026-10-30T03:00:00Z'),
    });
    const db = new DatabaseSync(dbPath);
    const owner = db.prepare('SELECT id FROM users WHERE email=?').get(accountSpecs[0].email);
    const baseline = {
      stores: db.prepare('SELECT COUNT(*) AS n FROM b2b_stores').get().n,
      items: db.prepare('SELECT COUNT(*) AS n FROM cart_items').get().n,
      owners: db.prepare('SELECT COUNT(*) AS n FROM store_owners').get().n,
    };
    db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(
      'test-session',
      owner.id,
      Date.now() + 86400000,
    );
    db.close();

    const result = await resetPcDemoPasswords({ rootDir });
    assert.equal(result.accounts.length, 6);
    assert.equal(result.password, PC_DEMO_PASSWORD);
    const after = new DatabaseSync(dbPath);
    try {
      const hashes = new Set();
      for (const account of accountSpecs) {
        const row = after
          .prepare(
            'SELECT u.password_hash,s.credential_revision,s.verified_at FROM users u JOIN auth_account_state s ON u.id=s.user_id WHERE u.email=?',
          )
          .get(account.email);
        assert.ok(row);
        assert.equal(await verifyPassword(PC_DEMO_PASSWORD, row.password_hash), true);
        assert.equal(await verifyPassword('OldTestDemoPassword!2', row.password_hash), false);
        assert.equal(row.credential_revision, 1);
        assert.ok(row.verified_at);
        hashes.add(row.password_hash);
      }
      assert.equal(hashes.size, 6, 'password hash must use a different salt for every account');
      assert.equal(after.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 0);
      assert.deepEqual(
        {
          stores: after.prepare('SELECT COUNT(*) AS n FROM b2b_stores').get().n,
          items: after.prepare('SELECT COUNT(*) AS n FROM cart_items').get().n,
          owners: after.prepare('SELECT COUNT(*) AS n FROM store_owners').get().n,
        },
        baseline,
      );
    } finally {
      after.close();
    }
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('reset refuses missing database and mismatched demo identities without partial changes', async () => {
  const rootDir = mkdtempSync(join(tmpdir(), 'bam-reset-guard-'));
  const dbPath = join(rootDir, 'data', 'bam-pc-demo.sqlite');
  try {
    await assert.rejects(resetPcDemoPasswords({ rootDir }), /tidak ditemukan/);
    await seedPcDemo({ dbPath, password: 'OldTestDemoPassword!2', now: new Date('2026-10-30T03:00:00Z') });
    const db = new DatabaseSync(dbPath);
    db.prepare('UPDATE users SET name=? WHERE email=?').run('Akun diganti', accountSpecs[2].email);
    const prior = db
      .prepare('SELECT password_hash FROM users WHERE email=?')
      .get(accountSpecs[0].email).password_hash;
    db.close();
    await assert.rejects(resetPcDemoPasswords({ rootDir }), /tidak sesuai/);
    const after = new DatabaseSync(dbPath);
    try {
      const same = after
        .prepare('SELECT password_hash FROM users WHERE email=?')
        .get(accountSpecs[0].email);
      assert.equal(same.password_hash, prior);
    } finally {
      after.close();
    }
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});
