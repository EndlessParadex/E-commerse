import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { seedPcDemo } from './seed-pc-demo.mjs';
import { sharedRequest } from '../server/sharedCartFixture.js';

test('PC dummy seed creates an isolated login-ready B2B shop without overwriting existing data', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'bam-pc-seed-'));
  const dbPath = join(dir, 'pc-demo.sqlite');
  const password = 'OnlyForFixture!2026';
  try {
    const seeded = await seedPcDemo({
      dbPath,
      password,
      now: new Date('2026-10-26T09:00:00+07:00'),
    });
    assert.equal(seeded.accounts.length, 6);
    assert.equal(seeded.stores.length, 2);
    assert.ok(seeded.products > 0);
    await assert.rejects(
      () => seedPcDemo({ dbPath, password }),
      /sudah ada/,
      'repeat setup cannot alter existing database',
    );

    const app = createApp({ dbPath });
    try {
      const { db, b2bStores, sharedCarts } = app;
      assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 6);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM b2b_sales_assignments').get().n, 2);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM b2b_store_owners').get().n, 2);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM cart_cycles').get().n, 2);
      assert.ok(db.prepare('SELECT SUM(available) AS total FROM inventory').get().total > 0);
      for (const account of seeded.accounts) {
        const login = await sharedRequest(app, 'POST', '/api/auth/login', null, {
          identifier: account.email,
          password,
        });
        assert.equal(login.status, 200, account.email + ': ' + JSON.stringify(login.body));
        assert.equal(login.body.user.email, account.email);
        assert.equal(login.body.user.emailVerified, true);
      }
      const buyer = db
        .prepare('SELECT id,role FROM users WHERE email=?')
        .get('toko.ice.pc-demo@bam.test');
      const sales = db
        .prepare('SELECT id,role FROM users WHERE email=?')
        .get('sales.pc-demo@bam.test');
      const personal = db
        .prepare('SELECT id,role FROM users WHERE email=?')
        .get('pribadi.pc-demo@bam.test');
      const stores = b2bStores.list(buyer);
      assert.equal(stores.length, 1);
      assert.equal(b2bStores.list(sales).length, 2);
      assert.equal(b2bStores.list(personal).length, 0);
      const cart = sharedCarts.read(buyer, stores[0].id, seeded.stores[0].delivery);
      assert.equal(cart.items.length, 1);
      assert.equal(cart.items[0].quantity, 2);
      assert.equal(cart.status, 'open');
    } finally {
      app.db.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
