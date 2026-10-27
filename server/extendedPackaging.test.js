import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app.js';
import { seedSharedCart } from './sharedCartFixture.js';
import { b2bPackingList } from '../src/data/b2bPackingList.js';
test('Box/Renceng persist, reserve the shared unit stock once, and print the final snapshot', () => {
  const app = createApp({
    dbPath: ':memory:',
    now: () => Date.parse('2026-10-27T01:00:00Z'),
    b2bCutoff: null,
    logger: () => {},
  });
  const { actors, first } = seedSharedCart(app);
  const date = '2026-11-02';
  try {
    const catalog = app.catalog.snapshot();
    const group = catalog.edits.find((row) => row.groupId === 'snack-pedas');
    const original = group.variants.find((row) => row.id === 'snack-pedas');
    group.variants.push(
      {
        ...original,
        id: 'NEW-BOX',
        packagingType: 'box',
        unitsPerPackage: '24',
        packsPerBox: '',
        price: '200000',
        oldPrice: '',
      },
      {
        ...original,
        id: 'NEW-RENCENG',
        packagingType: 'renceng',
        unitsPerPackage: '12',
        packsPerBox: '',
        price: '100000',
        oldPrice: '',
      },
    );
    app.catalog.save(catalog);
    const command = (action, details = {}) => ({
      action,
      date,
      requestId: randomUUID(),
      revision: app.sharedCarts.read(actors.owner, first.id, date).revision,
      ...details,
    });
    app.sharedCarts.mutate(
      actors.buyer,
      first.id,
      command('add', { productId: 'NEW-BOX', quantity: 2 }),
    );
    app.sharedCarts.mutate(
      actors.sales,
      first.id,
      command('add', { productId: 'NEW-RENCENG', quantity: 3 }),
    );
    app.b2bFinalization.change(actors.operator, first.id, command('lock'));
    const review = app.b2bFinalization.review(actors.operator, first.id, date);
    const body = command('finalize', { reviewToken: review.token, accepted: true });
    const result = app.b2bFinalization.change(actors.operator, first.id, body);
    const printed = b2bPackingList(result.order);
    assert.equal(printed.totals.box, 2);
    assert.equal(printed.totals.renceng, 3);
    assert.equal(
      result.order.inventory.reduce((sum, row) => sum + row.units, 0),
      84,
    );
    assert.equal(
      app.b2bFinalization.change(actors.operator, first.id, body).order.id,
      result.order.id,
    );
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 1);
    const changed = app.catalog.snapshot();
    changed.edits
      .find((row) => row.groupId === group.groupId)
      .variants.find((row) => row.id === 'NEW-BOX').unitsPerPackage = '48';
    app.catalog.save(changed);
    assert.match(
      b2bPackingList(app.workflow.get(actors.buyer, result.order.id)).rows[0].contents,
      /24 satuan/,
    );
  } finally {
    app.db.close();
  }
});
test('legacy three-packaging catalog migration retains catalog, stock and revision', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'bam-packaging-migration-')), 'db.sqlite');
  let app = createApp({ dbPath: file, logger: () => {} });
  const before = app.catalog.snapshot();
  const inventory = app.db.prepare('SELECT * FROM inventory ORDER BY stock_key').all();
  app.db.exec(`BEGIN IMMEDIATE;
    CREATE TABLE legacy_variants (
      id TEXT PRIMARY KEY COLLATE NOCASE,product_id TEXT REFERENCES catalog_products(id),size_value REAL NOT NULL,size_unit TEXT NOT NULL,
      price INTEGER NOT NULL,old_price INTEGER NOT NULL,position INTEGER NOT NULL,
      packaging_type TEXT NOT NULL CHECK(packaging_type IN ('satuan','pack','dus')),units_per_package INTEGER NOT NULL,packs_per_box INTEGER NOT NULL,
      UNIQUE(product_id,size_value,size_unit,packaging_type,units_per_package));
    INSERT INTO legacy_variants SELECT * FROM catalog_variants; DROP TABLE catalog_variants;
    ALTER TABLE legacy_variants RENAME TO catalog_variants; COMMIT;`);
  app.db.close();
  app = createApp({ dbPath: file, logger: () => {} });
  try {
    assert.deepEqual(app.catalog.snapshot(), before);
    assert.deepEqual(app.db.prepare('SELECT * FROM inventory ORDER BY stock_key').all(), inventory);
    assert.ok(
      app.db
        .prepare("SELECT sql FROM sqlite_master WHERE name='catalog_variants'")
        .get()
        .sql.includes("'renceng'"),
    );
    assert.deepEqual(app.db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    app.db.close();
  }
});
