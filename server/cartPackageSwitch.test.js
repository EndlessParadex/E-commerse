import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { seedSharedCart, sharedRequest } from './sharedCartFixture.js';

const date = '2026-10-21';
const sourceSku = 'snack-pedas-23g';
const destSku = 'snack-pedas-DUS-12';
const request = (revision, action, extras = {}) => ({
  date,
  revision,
  requestId: randomUUID(),
  action,
  ...extras,
});
const itemRequest = (revision, action, extras = {}) =>
  request(revision, action, { productId: sourceSku, ...extras });

function addPackageVariant(app) {
  const source = app.db.prepare('SELECT * FROM catalog_variants WHERE id=?').get(sourceSku);
  assert.ok(source);
  app.db
    .prepare(
      `INSERT INTO catalog_variants
    (id,product_id,size_value,size_unit,price,old_price,position,packaging_type,units_per_package,packs_per_box)
    VALUES(?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      destSku,
      source.product_id,
      source.size_value,
      source.size_unit,
      36000,
      0,
      100,
      'dus',
      12,
      0,
    );
}

test('switch_package atomically changes matching SKU, price, quantity and audit once', async () => {
  const app = createApp({ dbPath: ':memory:', logger: () => {} });
  try {
    const { first, actors } = seedSharedCart(app);
    addPackageVariant(app);
    const added = app.sharedCarts.mutate(
      actors.buyer,
      first.id,
      itemRequest(0, 'add', { quantity: 2 }),
    );
    assert.deepEqual(
      added.items[0].packageOptions.map((option) => option.id),
      [sourceSku, destSku],
    );
    assert.equal(added.items[0].packageOptions[1].price, 36000);
    assert.equal(added.items[0].packageOptions[1].packaging.unitsPerPackage, 12);

    const payload = itemRequest(1, 'switch_package', { targetProductId: destSku });
    const switched = await sharedRequest(
      app,
      'POST',
      `/api/b2b/stores/${first.id}/cart`,
      'sales',
      payload,
    );
    assert.equal(switched.status, 200);
    assert.equal(switched.body.cart.status, 'open');
    assert.equal(switched.body.cart.revision, 2);
    assert.equal(switched.body.cart.items.length, 1);
    assert.equal(switched.body.cart.items[0].id, destSku);
    assert.equal(switched.body.cart.items[0].quantity, 2);
    assert.equal(switched.body.cart.items[0].price, 36000);
    assert.equal(switched.body.cart.items[0].packaging.packagingType, 'dus');
    assert.equal(switched.body.cart.events[0].action, 'switch_package');
    assert.equal(switched.body.cart.events[0].details.fromSku, sourceSku);
    assert.equal(switched.body.cart.events[0].details.toSku, destSku);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 0);

    const retry = await sharedRequest(
      app,
      'POST',
      `/api/b2b/stores/${first.id}/cart`,
      'sales',
      payload,
    );
    assert.equal(retry.status, 200);
    assert.equal(retry.body.cart.revision, 2);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM cart_events').get().n, 2);
    assert.equal(
      (
        await sharedRequest(
          app,
          'POST',
          `/api/b2b/stores/${first.id}/cart`,
          'other',
          request(2, 'switch_package', { productId: destSku, targetProductId: sourceSku }),
        )
      ).status,
      404,
    );
  } finally {
    app.db.close();
  }
});

test('switch_package rejects invalid, stale, locked and over-capacity changes without losing source', () => {
  const app = createApp({ dbPath: ':memory:', logger: () => {} });
  try {
    const { first, actors } = seedSharedCart(app);
    addPackageVariant(app);
    app.sharedCarts.mutate(actors.buyer, first.id, itemRequest(0, 'add', { quantity: 2 }));
    const unchanged = () => app.sharedCarts.read(actors.buyer, first.id, date);

    assert.throws(
      () =>
        app.sharedCarts.mutate(
          actors.buyer,
          first.id,
          itemRequest(1, 'switch_package', { targetProductId: 'bumbu-rendang-130g' }),
        ),
      { code: 'invalid_package_switch' },
    );
    assert.throws(
      () =>
        app.sharedCarts.mutate(
          actors.buyer,
          first.id,
          itemRequest(0, 'switch_package', { targetProductId: destSku }),
        ),
      { code: 'cart_conflict' },
    );
    assert.equal(unchanged().items[0].id, sourceSku);
    assert.equal(unchanged().revision, 1);

    app.sharedCarts.mutate(
      actors.buyer,
      first.id,
      request(1, 'add', { productId: destSku, quantity: 98 }),
    );
    assert.throws(
      () =>
        app.sharedCarts.mutate(
          actors.buyer,
          first.id,
          itemRequest(2, 'switch_package', { targetProductId: destSku }),
        ),
      { code: 'quantity_limit' },
    );
    assert.equal(unchanged().revision, 2);
    assert.equal(unchanged().items.length, 2);
    assert.equal(unchanged().items.find((item) => item.id === sourceSku).quantity, 2);
    assert.equal(unchanged().items.find((item) => item.id === destSku).quantity, 98);

    app.sharedCarts.mutate(
      actors.buyer,
      first.id,
      request(2, 'set', { productId: destSku, quantity: 3 }),
    );
    const merge = app.sharedCarts.mutate(
      actors.sales,
      first.id,
      itemRequest(3, 'switch_package', { targetProductId: destSku }),
    );
    assert.equal(merge.items.length, 1);
    assert.equal(merge.items[0].quantity, 5);

    app.b2bFinalization.change(actors.operator, first.id, request(4, 'lock'));
    assert.throws(
      () =>
        app.sharedCarts.mutate(
          actors.buyer,
          first.id,
          request(5, 'switch_package', { productId: destSku, targetProductId: sourceSku }),
        ),
      { code: 'cart_locked' },
    );
  } finally {
    app.db.close();
  }
});
