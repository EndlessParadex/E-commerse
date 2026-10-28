import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { seedSharedCart, sharedRequest } from './sharedCartFixture.js';

const date = '2026-10-21';
const body = (revision, action, details = {}) => ({
  date,
  revision,
  action,
  requestId: randomUUID(),
  ...details,
});
const cartUrl = (store) => '/api/b2b/stores/' + store.id + '/cart';
const adminQueue = '/api/admin/b2b/carts?status=pending';

test('Sales/buyer can request review without creating order; duplicate requests are idempotent', async () => {
  const app = createApp({ dbPath: ':memory:', logger: () => {} });
  try {
    const { first, second, actors } = seedSharedCart(app);
    assert.equal(
      (await sharedRequest(app, 'POST', cartUrl(first), 'sales', body(0, 'request_review'))).body
        .error,
      'empty_cart',
    );
    assert.equal(
      (await sharedRequest(app, 'POST', cartUrl(second), 'sales', body(0, 'request_review')))
        .status,
      404,
    );
    const saved = app.sharedCarts.mutate(
      actors.buyer,
      first.id,
      body(0, 'add', { productId: 'snack-pedas-23g', quantity: 2 }),
    );
    assert.equal(saved.revision, 1);
    assert.equal(
      (await sharedRequest(app, 'POST', cartUrl(first), 'operator', body(1, 'request_review')))
        .status,
      403,
    );
    const request = body(1, 'request_review');
    const raised = await sharedRequest(app, 'POST', cartUrl(first), 'sales', request);
    assert.equal(raised.status, 200);
    assert.equal(raised.body.cart.status, 'open');
    assert.equal(raised.body.cart.canEdit, true);
    assert.equal(raised.body.cart.reviewRequested, true);
    assert.equal(raised.body.cart.events[0].actorRole, 'sales');
    assert.equal(raised.body.cart.events[0].action, 'request_review');
    assert.equal(app.db.prepare('SELECT COUNT(*) n FROM orders').get().n, 0);
    const queue = await sharedRequest(app, 'GET', adminQueue, 'operator');
    assert.equal(queue.status, 200);
    assert.equal(queue.body.carts.find((x) => x.storeId === first.id).reviewRequested, 1);
    const retry = await sharedRequest(app, 'POST', cartUrl(first), 'sales', request);
    assert.equal(retry.body.cart.revision, 2);
    assert.equal(
      (await sharedRequest(app, 'POST', cartUrl(first), 'buyer', body(2, 'request_review'))).body
        .cart.revision,
      2,
    );
    assert.equal(app.db.prepare('SELECT COUNT(*) n FROM cart_events').get().n, 2);
    const changed = await sharedRequest(
      app,
      'POST',
      cartUrl(first),
      'buyer',
      body(2, 'set', { productId: 'snack-pedas-23g', quantity: 4 }),
    );
    assert.equal(changed.status, 200);
    assert.equal(changed.body.cart.reviewRequested, false);
    assert.equal(
      (await sharedRequest(app, 'GET', adminQueue, 'operator')).body.carts.find(
        (x) => x.storeId === first.id,
      ).reviewRequested,
      0,
    );
    const renewed = await sharedRequest(
      app,
      'POST',
      cartUrl(first),
      'buyer',
      body(3, 'request_review'),
    );
    assert.equal(renewed.body.cart.reviewRequested, true);
    assert.equal(renewed.body.cart.revision, 4);
  } finally {
    app.db.close();
  }
});

test('Sales review requests fail for locked carts and after store assignment revocation', async () => {
  const app = createApp({ dbPath: ':memory:', logger: () => {} });
  try {
    const { first, actors } = seedSharedCart(app);
    app.sharedCarts.mutate(
      actors.sales,
      first.id,
      body(0, 'add', { productId: 'snack-pedas-23g', quantity: 1 }),
    );
    app.b2bFinalization.change(actors.operator, first.id, body(1, 'lock'));
    const blocked = await sharedRequest(
      app,
      'POST',
      cartUrl(first),
      'sales',
      body(2, 'request_review'),
    );
    assert.equal(blocked.status, 409);
    assert.equal(app.db.prepare('SELECT COUNT(*) n FROM cart_events').get().n, 2);
    const version = app.b2bStores.store(first.id).revision;
    app.b2bStores.removeLink(actors.owner, first.id, 'sales', {
      userId: 'sales',
      revision: version,
    });
    assert.equal(
      (await sharedRequest(app, 'POST', cartUrl(first), 'sales', body(2, 'request_review'))).status,
      404,
    );
  } finally {
    app.db.close();
  }
});
