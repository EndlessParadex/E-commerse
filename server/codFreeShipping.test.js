import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp, hashPassword } from './app.js';

test('COD gratis: total final saat checkout, stok dicadangkan, langsung diproses tanpa konfirmasi pembeli', async () => {
  const app = createApp({ dbPath: ':memory:', logger: () => {} });
  try {
    const passwordHash = await hashPassword('fixture-password-2026');
    for (const [id, role] of [
      ['cod-buyer', 'user'],
      ['cod-admin', 'admin'],
    ]) {
      app.db
        .prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)')
        .run(
          id,
          id,
          id + '@fixture.test',
          'Alamat lengkap fixture',
          passwordHash,
          new Date().toISOString(),
          role,
        );
      app.db
        .prepare(
          'INSERT INTO auth_account_state(user_id,verified_at,credential_revision) VALUES(?,?,0)',
        )
        .run(id, Date.now());
    }
    const buyer = { id: 'cod-buyer', role: 'user' };
    const admin = { id: 'cod-admin', role: 'admin' };
    const input = (paymentId = 'cod', shippingId = 'regular') => ({
      requestKey: randomUUID(),
      recipient: 'Penerima COD',
      address: 'Alamat lengkap penerima COD',
      paymentId,
      shippingId,
      items: [{ id: 'snack-pedas', quantity: 1, expectedPrice: 18000 }],
    });
    assert.equal(app.company.snapshot().commerce.codOnly, true);
    assert.throws(() => app.workflow.create(buyer, input('manual-transfer')), {
      code: 'payment_unavailable',
    });
    assert.throws(() => app.workflow.create(buyer, input('cod', 'express')), {
      code: 'shipping_unavailable',
    });
    const before = app.workflow.stock().stock['snack-pedas:180-g'].available;
    const order = app.workflow.create(buyer, input());
    assert.equal(order.status, 'processing');
    assert.equal(order.codFixedTotal, true);
    assert.equal(order.shipping.quoted, true);
    assert.equal(order.shipping.cost, 0);
    assert.equal(order.total, order.subtotal);
    assert.equal(order.payment.status, 'pay_on_delivery');
    assert.equal(order.inventoryReserved, true);
    assert.equal(app.workflow.stock().stock['snack-pedas:180-g'].available, before - 1);
    assert.equal(order.quote, undefined);
    assert.throws(
      () =>
        app.workflow.update(buyer, order.id, {
          action: 'accept_quote',
          revision: order.revision,
        }),
      { code: 'invalid_status' },
    );
    const shipped = app.workflow.update(admin, order.id, {
      action: 'ship',
      revision: order.revision,
      courier: 'Kurir toko',
      trackingNumber: 'BAM-RESI-1',
    });
    assert.equal(shipped.status, 'shipped');
    assert.equal(shipped.total, order.total);
    assert.equal(shipped.shipping.cost, 0);
    const completed = app.workflow.update(admin, order.id, {
      action: 'complete',
      revision: shipped.revision,
    });
    assert.equal(completed.status, 'completed');
    assert.equal(completed.payment.status, 'paid');
  } finally {
    app.db.close();
  }
});

test('COD langsung diproses tetap dibatasi lima pesanan aktif dan transaksi gagal tidak mengambil stok', async () => {
  const app = createApp({ dbPath: ':memory:', logger: () => {} });
  try {
    app.db
      .prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)')
      .run(
        'limited-buyer',
        'Pelanggan',
        'limited@fixture.test',
        'Alamat lengkap pengujian',
        'unused',
        new Date().toISOString(),
        'user',
      );
    app.db
      .prepare(
        'INSERT INTO auth_account_state(user_id,verified_at,credential_revision) VALUES(?,?,0)',
      )
      .run('limited-buyer', Date.now());
    const user = { id: 'limited-buyer', role: 'user' };
    const makeOrder = () =>
      app.workflow.create(user, {
        requestKey: randomUUID(),
        recipient: 'Penerima pesanan',
        address: 'Alamat lengkap pengujian',
        shippingId: 'regular',
        paymentId: 'cod',
        items: [{ id: 'snack-pedas', quantity: 1, expectedPrice: 18000 }],
      });
    for (let i = 0; i < 5; i++) assert.equal(makeOrder().status, 'processing');
    const before = app.workflow.stock().stock['snack-pedas:180-g'].available;
    assert.throws(makeOrder, { code: 'reservation_limit' });
    assert.equal(app.workflow.stock().stock['snack-pedas:180-g'].available, before);
  } finally {
    app.db.close();
  }
});
