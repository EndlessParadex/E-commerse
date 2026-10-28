import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { seedSharedCart, sharedRequest } from './sharedCartFixture.js';

const date = '2026-10-21';
const cartPath = (storeId) => `/api/b2b/stores/${storeId}/cart`;
const change = (revision, action, extra = {}) => ({
  date,
  revision,
  action,
  requestId: randomUUID(),
  ...extra,
});

test('Sales readiness: store contact, search and shared-cart access follow assigned stores only', async () => {
  const app = createApp({ dbPath: ':memory:', logger: () => {} });
  try {
    const { first, second, actors } = seedSharedCart(app);
    const assigned = app.b2bStores.page(
      actors.sales,
      new URLSearchParams({ page: '1', q: 'Toko Bersama' }),
    );
    assert.equal(assigned.total, 1);
    assert.equal(assigned.stores[0].id, first.id);
    assert.equal(assigned.stores[0].phone, '+6281234567890');
    assert.equal(app.b2bStores.page(actors.sales, new URLSearchParams()).total, 1);
    assert.equal(
      app.b2bStores.page(actors.sales, new URLSearchParams({ q: 'Toko Lain' })).total,
      0,
    );
    assert.equal(app.b2bStores.page(actors.buyer, new URLSearchParams()).total, 1);
    assert.equal(
      (await sharedRequest(app, 'GET', cartPath(second.id) + '?date=' + date, 'sales'))
        .status,
      404,
    );

    const request = change(0, 'add', { productId: 'snack-pedas-23g', quantity: 2 });
    const saved = await sharedRequest(app, 'POST', cartPath(first.id), 'sales', request);
    assert.equal(saved.status, 200);
    assert.equal(saved.body.cart.items[0].quantity, 2);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 0);

    const revision = app.b2bStores.store(first.id).revision;
    app.b2bStores.removeLink(actors.owner, first.id, 'sales', {
      userId: actors.sales.id,
      revision,
    });
    assert.equal(app.b2bStores.page(actors.sales, new URLSearchParams()).total, 0);
    assert.equal(
      (await sharedRequest(app, 'GET', cartPath(first.id) + '?date=' + date, 'sales'))
        .status,
      404,
    );
    assert.equal(
      (await sharedRequest(app, 'POST', cartPath(first.id), 'sales', request)).status,
      404,
      'even an idempotent retry must not bypass a revoked store assignment',
    );
    assert.equal(
      (await sharedRequest(app, 'GET', cartPath(first.id) + '?date=' + date, 'buyer'))
        .body.cart.items[0].quantity,
      2,
      'revoking Sales access must not remove the store buyer draft',
    );
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 0);
  } finally {
    app.db.close();
  }
});

test('Sales readiness: buyer/Sales revisions stay atomic and only Admin can finalize a draft', async () => {
  const app = createApp({ dbPath: ':memory:', logger: () => {} });
  try {
    const { first, actors } = seedSharedCart(app);
    const buyerDraft = app.sharedCarts.mutate(
      actors.buyer,
      first.id,
      change(0, 'add', { productId: 'snack-pedas-23g', quantity: 2 }),
    );
    assert.equal(buyerDraft.revision, 1);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 0);

    const salesEdit = app.sharedCarts.mutate(
      actors.sales,
      first.id,
      change(1, 'set', { productId: 'snack-pedas-23g', quantity: 3 }),
    );
    assert.equal(salesEdit.revision, 2);
    assert.equal(salesEdit.events[0].actorRole, 'sales');
    assert.throws(
      () =>
        app.sharedCarts.mutate(
          actors.buyer,
          first.id,
          change(1, 'set', { productId: 'snack-pedas-23g', quantity: 5 }),
        ),
      { code: 'cart_conflict' },
    );
    assert.equal(app.sharedCarts.read(actors.buyer, first.id, date).items[0].quantity, 3);
    assert.equal(
      (await sharedRequest(
        app,
        'POST',
        `/api/admin/b2b/stores/${first.id}/cart`,
        'sales',
        change(2, 'lock'),
      )).status,
      403,
    );

    const locked = app.b2bFinalization.change(
      actors.operator,
      first.id,
      change(2, 'lock'),
    );
    assert.equal(locked.cart.status, 'locked');
    assert.throws(
      () =>
        app.sharedCarts.mutate(
          actors.sales,
          first.id,
          change(locked.cart.revision, 'set', {
            productId: 'snack-pedas-23g',
            quantity: 9,
          }),
        ),
      { code: 'cart_locked' },
    );
    const review = app.b2bFinalization.review(actors.operator, first.id, date);
    assert.equal(review.ready, true);
    const finalRequest = change(review.revision, 'finalize', {
      reviewToken: review.token,
      accepted: true,
    });
    const finalized = app.b2bFinalization.change(actors.operator, first.id, finalRequest);
    assert.equal(finalized.cart.status, 'finalized');
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 1);
    const retry = app.b2bFinalization.change(actors.operator, first.id, finalRequest);
    assert.equal(retry.order.id, finalized.order.id);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 1);
    assert.equal(app.sharedCarts.read(actors.sales, first.id, date).orderId, finalized.order.id);
  } finally {
    app.db.close();
  }
});
