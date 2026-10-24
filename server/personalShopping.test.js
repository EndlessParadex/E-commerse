import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { seedSharedCart, sharedRequest } from './sharedCartFixture.js';

function personalOrder(app) {
  const variant = app.catalog
    .snapshot()
    .edits.find((entry) => entry.groupId === 'snack-pedas')
    .variants.find((entry) => entry.id === 'snack-pedas');
  return {
    requestKey: randomUUID(),
    recipient: 'Penerima pribadi',
    address: 'Alamat pribadi pengujian lengkap',
    paymentId: 'cod',
    shippingId: 'regular',
    items: [{ id: variant.id, quantity: 1, expectedPrice: Number(variant.price) }],
  };
}

test('Sales, pembeli toko, dan Admin boleh belanja pribadi; pesanan itu bukan pesanan toko', async () => {
  const app = createApp({ dbPath: ':memory:', logger: () => {} });
  try {
    seedSharedCart(app);
    const storeEvents = () => app.db.prepare('SELECT COUNT(*) AS n FROM cart_events').get().n;
    const before = storeEvents();
    for (const actor of ['sales', 'buyer', 'owner']) {
      const created = await sharedRequest(app, 'POST', '/api/orders', actor, personalOrder(app));
      assert.equal(created.status, 201, actor + ': ' + JSON.stringify(created.body));
      assert.equal(created.body.order.userId, actor, 'pesanan pribadi milik pembuatnya sendiri');
      assert.equal(created.body.order.b2b, undefined, 'pesanan pribadi tidak membawa data toko');
      const listed = await sharedRequest(app, 'GET', '/api/orders', actor);
      assert.ok(
        listed.body.orders.some((entry) => entry.id === created.body.order.id),
        actor + ' melihat pesanan pribadinya sendiri',
      );
    }
    assert.equal(storeEvents(), before, 'belanja pribadi tidak menyentuh keranjang toko');
    const stored = app.db
      .prepare("SELECT COUNT(*) AS n FROM orders WHERE user_id IN ('sales','buyer','owner')")
      .get().n;
    assert.equal(stored, 3);
  } finally {
    app.db.close();
  }
});

test('pembeli toko lain tidak bisa melihat pesanan pribadi Sales', async () => {
  const app = createApp({ dbPath: ':memory:', logger: () => {} });
  try {
    seedSharedCart(app);
    const created = await sharedRequest(app, 'POST', '/api/orders', 'sales', personalOrder(app));
    assert.equal(created.status, 201);
    const other = await sharedRequest(app, 'GET', '/api/orders', 'buyer');
    assert.ok(!other.body.orders.some((entry) => entry.id === created.body.order.id));
  } finally {
    app.db.close();
  }
});
