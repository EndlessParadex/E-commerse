import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { seedSharedCart } from './sharedCartFixture.js';

const owner = { id: 'owner', role: 'admin' };
const operator = { id: 'operator', role: 'admin' };
const driver = { id: 'driver', role: 'user', name: 'Budi Sopir' };
const otherDriver = { id: 'driver-two', role: 'user', name: 'Andi Sopir' };

function fixture() {
  const app = createApp({ dbPath: ':memory:', logger: () => {} });
  seedSharedCart(app);
  for (const user of [driver, otherDriver])
    app.db
      .prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)')
      .run(
        user.id,
        user.name,
        user.id + '@fixture.test',
        'Alamat lengkap fixture',
        'fixture-not-for-login',
        new Date().toISOString(),
        'user',
      );
  app.b2bStores.appointDriver(owner, driver.id);
  app.b2bStores.appointDriver(owner, otherDriver.id);
  return app;
}

const buy = (app, user) =>
  app.workflow.create(
    user,
    {
      requestKey: randomUUID(),
      recipient: 'Pembeli Uji',
      address: 'Jalan Pengiriman Nomor 10, Kota Uji',
      items: [{ id: 'snack-pedas', quantity: 1, expectedPrice: 18000 }],
      shippingId: 'regular',
      paymentId: 'cod',
    },
    '127.0.0.1',
  );

function shippedOrder(app) {
  const order = buy(app, { id: 'buyer', role: 'user' });
  return app.workflow.update(operator, order.id, {
    action: 'ship',
    driverId: driver.id,
    revision: order.revision,
  });
}

test('only the Owner manages drivers and role conflicts are refused', () => {
  const app = fixture();
  try {
    assert.throws(() => app.b2bStores.appointDriver(operator, 'other'), { status: 403 });
    assert.throws(() => app.b2bStores.appointDriver(owner, 'sales'), { status: 409 });
    assert.throws(() => app.b2bStores.appointDriver(owner, 'buyer'), { status: 409 });
    assert.throws(() => app.b2bStores.appointSales(owner, driver.id), { status: 409 });
    assert.deepEqual(
      app.b2bStores.driverList(operator).map((row) => row.name),
      ['Andi Sopir', 'Budi Sopir'],
    );
    assert.throws(() => app.b2bStores.driverList({ id: driver.id, role: 'user' }), { status: 403 });
    assert.equal(app.b2bStores.removeDriver(owner, otherDriver.id).driver, false);
    assert.equal(app.b2bStores.isDriver(otherDriver.id), false);
  } finally {
    app.db.close();
  }
});

test('a shipped order records our driver and only that driver can finish it', () => {
  const app = fixture();
  try {
    const shipped = shippedOrder(app);
    assert.equal(shipped.status, 'shipped');
    assert.equal(shipped.shipping.driverName, 'Budi Sopir');
    assert.equal(shipped.shipping.driverId, undefined, 'buyers never receive the account id');
    assert.equal(shipped.shipping.trackingNumber, undefined);
    assert.throws(() => app.b2bStores.removeDriver(owner, driver.id), { status: 409 });

    const { active, finished } = app.workflow.driverTasks(driver);
    assert.equal(finished.length, 0);
    assert.equal(active.length, 1);
    assert.equal(active[0].collectAmount, shipped.total);
    assert.equal(active[0].payment, undefined, 'the task omits the payment record');
    assert.deepEqual(app.workflow.driverTasks(otherDriver).active, []);

    const body = { revision: shipped.revision };
    assert.throws(() => app.workflow.deliverAsDriver(otherDriver, shipped.id, body), {
      status: 404,
    });
    assert.throws(() => app.workflow.deliverAsDriver({ id: 'sales' }, shipped.id, body), {
      status: 422,
    });
    assert.throws(() => app.workflow.deliverAsDriver(driver, shipped.id, { revision: 0 }), {
      status: 409,
    });

    const task = app.workflow.deliverAsDriver(driver, shipped.id, body);
    assert.equal(task.status, 'completed');
    const stored = app.workflow.get(operator, shipped.id);
    assert.equal(stored.status, 'completed');
    assert.equal(stored.payment.status, 'paid');
    assert.equal(stored.payment.recordedBy, driver.id);
    assert.throws(
      () => app.workflow.deliverAsDriver(driver, shipped.id, { revision: stored.revision }),
      { status: 409 },
    );
    assert.equal(app.workflow.driverTasks(driver).finished.length, 1);
    assert.equal(app.b2bStores.removeDriver(owner, driver.id).driver, false);
  } finally {
    app.db.close();
  }
});

test('shipping needs an active driver from the list', () => {
  const app = fixture();
  try {
    const order = buy(app, { id: 'buyer', role: 'user' });
    for (const driverId of ['', 'sales', 'tidak-ada'])
      assert.throws(
        () =>
          app.workflow.update(operator, order.id, {
            action: 'ship',
            driverId,
            revision: order.revision,
          }),
        { status: 422 },
      );
  } finally {
    app.db.close();
  }
});
