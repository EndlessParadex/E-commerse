import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { seedSharedCart, sharedRequest } from './sharedCartFixture.js';
import {
  upcomingDeliveries,
  validDeliverySchedule,
  todayWIB,
} from '../src/data/deliverySchedule.js';
const schedule = { weekday: 1, intervalWeeks: 2, anchorDate: '2026-10-19' };
test('weekly schedules use real dates, WIB boundaries, and reject invalid anchor days', () => {
  assert.deepEqual(upcomingDeliveries(schedule, '2026-10-27', 3), [
    '2026-11-02',
    '2026-11-16',
    '2026-11-30',
  ]);
  assert.equal(todayWIB(Date.parse('2026-10-26T17:01:00Z')), '2026-10-27');
  assert.equal(validDeliverySchedule({ ...schedule, anchorDate: '2026-10-20' }), null);
  assert.equal(validDeliverySchedule({ ...schedule, anchorDate: '2026-02-30' }), null);
});
test('Owner manages regions; schedules and account assignments are revision checked and audited', async () => {
  const app = createApp({
    dbPath: ':memory:',
    now: () => Date.parse('2026-10-27T01:00:00Z'),
    logger: () => {},
  });
  const { actors, first } = seedSharedCart(app);
  const url = '/api/admin/delivery/regions';
  const data = { name: 'Wilayah Utara', ...schedule, active: true, revision: 0 };
  try {
    for (const actor of ['buyer', 'sales', 'operator'])
      assert.equal((await sharedRequest(app, 'POST', url, actor, data)).status, 403);
    assert.equal((await sharedRequest(app, 'GET', '/api/delivery/calendar', null)).status, 401);
    assert.equal(
      (await sharedRequest(app, 'POST', url, 'owner', data, 'https://foreign.fixture.test')).status,
      403,
    );
    const created = await sharedRequest(app, 'POST', url, 'owner', data);
    assert.equal(created.status, 200, JSON.stringify(created.body));
    const region = created.body.regions[0];
    app.db
      .prepare("INSERT INTO account_approvals(user_id,status,revision) VALUES('other','pending',0)")
      .run();
    assert.equal(
      (await sharedRequest(app, 'GET', '/api/admin/delivery/accounts?q=other', 'owner')).body.total,
      0,
    );
    assert.equal(
      (
        await sharedRequest(app, 'POST', '/api/admin/delivery/assignment', 'owner', {
          userId: 'other',
          regionId: region.id,
          revision: 0,
        })
      ).status,
      404,
    );
    app.db.prepare("UPDATE account_approvals SET status='approved' WHERE user_id='other'").run();
    assert.equal(
      (
        await sharedRequest(app, 'POST', '/api/admin/delivery/assignment', 'owner', {
          userId: 'buyer',
          regionId: region.id,
          revision: 0,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await sharedRequest(app, 'POST', '/api/admin/delivery/assignment', 'owner', {
          userId: 'buyer',
          regionId: '',
          revision: 0,
        })
      ).status,
      409,
    );
    const buyerCalendar = await sharedRequest(app, 'GET', '/api/delivery/calendar', 'buyer');
    assert.equal(buyerCalendar.body.schedules[0].label, 'Wilayah Utara');
    assert.equal(buyerCalendar.body.schedules[0].dates[0], '2026-11-02');
    app.b2bStores.setSchedule(actors.owner, first.id, {
      ...schedule,
      revision: app.b2bStores.store(first.id).revision,
    });
    const salesCalendar = await sharedRequest(app, 'GET', '/api/delivery/calendar', 'sales');
    assert.equal(salesCalendar.body.schedules.length, 1);
    assert.equal(salesCalendar.body.schedules[0].id, first.id);
    const unrelated = await sharedRequest(app, 'GET', '/api/delivery/calendar', 'other');
    assert.ok(!unrelated.body.schedules.some((row) => row.id === first.id));
    assert.equal(
      (
        await sharedRequest(app, 'POST', url, 'owner', {
          ...data,
          id: region.id,
          name: 'Utara baru',
        })
      ).status,
      200,
    );
    assert.equal(
      (await sharedRequest(app, 'POST', url, 'owner', { ...data, id: region.id, name: 'Stale' }))
        .status,
      409,
    );
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM delivery_schedule_events').get().n, 3);
  } finally {
    app.db.close();
  }
});
test('private checkout snapshots the assigned schedule; retries and old orders keep the same date', () => {
  let now = Date.parse('2026-10-27T01:00:00Z');
  const app = createApp({ dbPath: ':memory:', now: () => now, logger: () => {} });
  const { actors } = seedSharedCart(app);
  try {
    const region = app.deliverySchedules.saveRegion(actors.owner, {
      name: 'Utara',
      ...schedule,
      active: true,
      revision: 0,
    }).regions[0];
    app.deliverySchedules.assign(actors.owner, {
      userId: 'other',
      regionId: region.id,
      revision: 0,
    });
    const body = {
      requestKey: randomUUID(),
      recipient: 'Pembeli contoh',
      address: 'Alamat pengujian lengkap',
      paymentId: 'cod',
      shippingId: 'regular',
      items: [{ id: 'snack-pedas-23g', quantity: 1, expectedPrice: 3500 }],
      storeId: undefined,
    };
    const current = app.workflow
      .catalogItems()
      .find((entry) => entry.variant.id === body.items[0].id);
    body.items[0].expectedPrice = Number(current.variant.price);
    const saved = app.workflow.create(actors.other, body);
    assert.equal(saved.shipping.plannedDate, '2026-11-02');
    now = Date.parse('2026-11-04T01:00:00Z');
    app.deliverySchedules.saveRegion(actors.owner, { ...region, active: true, intervalWeeks: 1 });
    assert.equal(app.workflow.create(actors.other, body).id, saved.id);
    assert.equal(app.workflow.get(actors.other, saved.id).shipping.plannedDate, '2026-11-02');
    const next = app.workflow.create(actors.other, { ...body, requestKey: randomUUID() });
    assert.equal(next.shipping.plannedDate, '2026-11-09');
    app.deliverySchedules.saveRegion(actors.owner, { ...region, revision: 1, active: false });
    assert.throws(
      () => app.workflow.create(actors.other, { ...body, requestKey: randomUUID() }),
      /dinonaktifkan/,
    );
  } finally {
    app.db.close();
  }
});
