import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { driverNames } from '../src/data/companyProfile.js';

const buyer = { id: 'buyer', role: 'user' };
const admin = { id: 'admin', role: 'admin' };

test('company settings keep one trimmed driver name per line', () => {
  assert.deepEqual(driverNames({ deliveryDrivers: ' Budi \n\nAndi\nBudi\n' }), ['Budi', 'Andi']);
  assert.deepEqual(driverNames({}), []);
});

test('shipping records a driver from the company list without a receipt', () => {
  const app = createApp({ dbPath: ':memory:', logger: () => {} });
  try {
    for (const user of [buyer, admin])
      app.db
        .prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)')
        .run(
          user.id,
          user.id,
          user.id + '@fixture.test',
          'Alamat lengkap fixture',
          'fixture-not-for-login',
          new Date().toISOString(),
          user.role,
        );
    app.db.exec(
      'INSERT OR REPLACE INTO auth_account_state(user_id,verified_at) SELECT id,1 FROM users',
    );
    const settings = app.company.snapshot();
    app.company.save({
      ...settings,
      profile: { ...settings.profile, deliveryDrivers: 'Budi Sopir\nAndi Sopir' },
    });
    const order = app.workflow.create(buyer, {
      requestKey: randomUUID(),
      recipient: 'Pembeli Uji',
      address: 'Jalan Pengiriman Nomor 10, Kota Uji',
      items: [{ id: 'snack-pedas', quantity: 1, expectedPrice: 18000 }],
      shippingId: 'regular',
      paymentId: 'cod',
    });
    const ship = (driverName) =>
      app.workflow.update(admin, order.id, {
        action: 'ship',
        driverName,
        revision: order.revision,
      });
    for (const name of ['', 'Orang Lain', undefined])
      assert.throws(() => ship(name), { status: 422 });
    const shipped = ship('Budi Sopir');
    assert.equal(shipped.status, 'shipped');
    assert.equal(shipped.shipping.driverName, 'Budi Sopir');
    assert.equal(shipped.shipping.trackingNumber, undefined);
  } finally {
    app.db.close();
  }
});
