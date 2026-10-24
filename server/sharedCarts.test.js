import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { createApp } from './app.js';
import { seedSharedCart, sharedRequest } from './sharedCartFixture.js';
import { cartDate } from './sharedCarts.js';

const date = '2026-10-21';
const change = (extra = {}) => ({
  date,
  revision: 0,
  requestId: randomUUID(),
  action: 'add',
  productId: 'snack-pedas-23g',
  quantity: 2,
  ...extra,
});
const url = (store) => '/api/b2b/stores/' + store.id + '/cart';

test('shared cart API shares server-authoritative SKU snapshots, dates, actors and quantities with assigned buyers/Sales only', async () => {
  const app = createApp({ dbPath: ':memory:', logger: () => {} });
  try {
    const { first, second } = seedSharedCart(app);
    assert.equal(
      (await sharedRequest(app, 'GET', '/api/b2b/cart-context', 'buyer')).body.enabled,
      true,
    );
    assert.equal((await sharedRequest(app, 'GET', url(first) + '?date=' + date)).status, 401);
    assert.equal(
      (await sharedRequest(app, 'GET', url(first) + '?date=' + date, 'other')).status,
      404,
    );
    for (const actor of ['buyer', 'sales']) {
      assert.equal(
        (await sharedRequest(app, 'GET', url(second) + '?date=' + date, actor)).status,
        404,
      );
      assert.equal((await sharedRequest(app, 'POST', url(second), actor, change())).status, 404);
      assert.equal((await sharedRequest(app, 'GET', url(second) + 's', actor)).status, 404);
      assert.equal(
        (await sharedRequest(app, 'GET', url(second) + '/events?date=' + date, actor)).status,
        404,
      );
    }
    const stock = app.workflow.stock();
    const saved = await sharedRequest(
      app,
      'POST',
      url(first),
      'buyer',
      change({ price: 1, name: 'forged', actorId: 'owner' }),
    );
    assert.equal(saved.status, 200);
    assert.equal(saved.body.cart.items[0].quantity, 2);
    assert.notEqual(saved.body.cart.items[0].price, 1);
    assert.notEqual(saved.body.cart.items[0].name, 'forged');
    assert.equal(saved.body.cart.events[0].actorName, 'Akun buyer');
    assert.equal(saved.body.cart.events[0].actorRole, 'buyer');
    const fromSales = await sharedRequest(app, 'GET', url(first) + '?date=' + date, 'sales');
    assert.deepEqual(fromSales.body.cart.items, saved.body.cart.items);
    const edited = await sharedRequest(
      app,
      'POST',
      url(first),
      'sales',
      change({ revision: 1, action: 'set', quantity: 5 }),
    );
    assert.equal(edited.body.cart.revision, 2);
    assert.equal(edited.body.cart.events[0].actorRole, 'sales');
    assert.equal(
      (await sharedRequest(app, 'GET', url(first) + '?date=' + date, 'buyer2')).body.cart.items[0]
        .quantity,
      5,
    );
    assert.deepEqual(app.workflow.stock(), stock, 'draft changes must not reserve inventory');
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 0);
    assert.deepEqual(
      (await sharedRequest(app, 'GET', url(first) + '?date=2026-10-22', 'buyer')).body.cart.items,
      [],
    );
    assert.equal(
      (await sharedRequest(app, 'GET', url(first) + '?date=' + date, 'operator')).body.cart.canEdit,
      true,
    );
    const adminEdit = await sharedRequest(
      app,
      'POST',
      url(first),
      'operator',
      change({ revision: 2, action: 'set', quantity: 4, price: 1, actorId: 'buyer' }),
    );
    assert.equal(adminEdit.status, 200);
    assert.equal(adminEdit.body.cart.items[0].quantity, 4);
    assert.equal(adminEdit.body.cart.events[0].actorRole, 'admin');
    assert.equal(adminEdit.body.cart.events[0].actorName, 'Akun operator');
    assert.equal(
      (
        await sharedRequest(
          app,
          'POST',
          url(first),
          'buyer',
          change({ revision: 2 }),
          'https://foreign.test',
        )
      ).status,
      403,
    );
    for (const actor of ['buyer', 'sales']) {
      const invalid = await sharedRequest(app, 'POST', '/api/orders', actor, {});
      assert.notEqual(invalid.body.error, 'shared_cart_required');
      assert.notEqual(invalid.status, 201, 'an invalid private order remains rejected');
    }
    const cleared = await sharedRequest(
      app,
      'POST',
      url(first),
      'buyer2',
      change({ revision: 3, action: 'clear' }),
    );
    assert.deepEqual(cleared.body.cart.items, []);
    assert.equal(cleared.body.cart.events.length, 4);
    assert.equal(cleared.body.cart.events[0].actorRole, 'buyer');
    assert.deepEqual(cleared.body.cart.events[0].details.clearedItems, [
      { productId: 'snack-pedas-23g', quantity: 4 },
    ]);
  } finally {
    app.db.close();
  }
});


test('Admin and Owner edit open carts, audit actors, cannot change locked carts, and Owner can finalize own edits', async () => {
  const app = createApp({ dbPath: ':memory:', logger: () => {} });
  const { first, second } = seedSharedCart(app);
  const path = url(first);
  const adminPath = '/api/admin/b2b/stores/' + first.id + '/cart';
  const adminChange = (action, revision, extra = {}) => ({
    date,
    action,
    revision,
    requestId: randomUUID(),
    ...extra,
  });
  try {
    const ownerAdd = await sharedRequest(app, 'POST', path, 'owner', change());
    assert.equal(ownerAdd.status, 200);
    assert.equal(ownerAdd.body.cart.events[0].actorRole, 'owner');

    const adminSet = await sharedRequest(
      app,
      'POST',
      path,
      'operator',
      change({ action: 'set', revision: 1, quantity: 4 }),
    );
    assert.equal(adminSet.status, 200);
    assert.equal(adminSet.body.cart.items[0].quantity, 4);
    assert.equal(adminSet.body.cart.events[0].actorRole, 'admin');
    assert.equal(adminSet.body.cart.events[0].actorName, 'Akun operator');
    assert.equal(
      (await sharedRequest(app, 'GET', path + '?date=' + date, 'buyer')).body.cart.items[0]
        .quantity,
      4,
    );
    assert.equal(
      (await sharedRequest(app, 'POST', path, 'other', change({ revision: 2 }))).status,
      404,
      'a buyer from a different store cannot edit the cart',
    );
    assert.equal(
      (await sharedRequest(app, 'GET', url(second) + '?date=' + date, 'owner')).body.cart.canEdit,
      true,
      'Owner may edit any active store',
    );

    const locked = await sharedRequest(app, 'POST', adminPath, 'owner', adminChange('lock', 2));
    assert.equal(locked.status, 200);
    assert.equal(locked.body.cart.status, 'locked');
    assert.equal(locked.body.cart.canEdit, false);
    for (const actor of ['owner', 'operator', 'buyer', 'sales']) {
      const blocked = await sharedRequest(
        app,
        'POST',
        path,
        actor,
        change({ revision: locked.body.cart.revision }),
      );
      assert.equal(blocked.status, 409, actor + ' cannot edit a locked cart');
    }

    const unlocked = await sharedRequest(
      app,
      'POST',
      adminPath,
      'owner',
      adminChange('unlock', locked.body.cart.revision, { reason: 'Koreksi barang toko' }),
    );
    assert.equal(unlocked.status, 200);
    assert.equal(unlocked.body.cart.canEdit, true);
    const ownerSet = await sharedRequest(
      app,
      'POST',
      path,
      'owner',
      change({ action: 'set', revision: unlocked.body.cart.revision, quantity: 3 }),
    );
    assert.equal(ownerSet.status, 200);
    assert.equal(ownerSet.body.cart.items[0].quantity, 3);
    const relocked = await sharedRequest(
      app,
      'POST',
      adminPath,
      'owner',
      adminChange('lock', ownerSet.body.cart.revision),
    );
    assert.equal(relocked.status, 200);
    const checked = await sharedRequest(
      app,
      'GET',
      adminPath + '/review?date=' + date,
      'owner',
    );
    assert.equal(checked.status, 200);
    assert.equal(checked.body.review.ready, true, JSON.stringify(checked.body.review));
    const finalized = await sharedRequest(
      app,
      'POST',
      adminPath,
      'owner',
      adminChange('finalize', checked.body.review.revision, {
        reviewToken: checked.body.review.token,
        accepted: true,
      }),
    );
    assert.equal(finalized.status, 200, JSON.stringify(finalized.body));
    assert.equal(finalized.body.cart.status, 'finalized');
    assert.equal(finalized.body.cart.canEdit, false);
    assert.equal(finalized.body.order.b2b.finalizedBy.id, 'owner');
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 1);
    assert.equal(
      (await sharedRequest(app, 'POST', path, 'owner', change({ revision: 7 }))).status,
      409,
    );
  } finally {
    app.db.close();
  }
});

test('shared cart revision conflicts and uncertain-response retries are atomic across connections and survive restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bam-shared-cart-'));
  const dbPath = join(directory, 'test.sqlite');
  let firstApp, secondApp, restarted;
  try {
    firstApp = createApp({ dbPath, logger: () => {} });
    const { first, actors } = seedSharedCart(firstApp);
    secondApp = createApp({ dbPath, logger: () => {} });
    const body = change();
    firstApp.sharedCarts.mutate(actors.buyer, first.id, body);
    assert.throws(() => secondApp.sharedCarts.mutate(actors.sales, first.id, change()), {
      code: 'cart_conflict',
    });
    const retry = secondApp.sharedCarts.mutate(actors.buyer, first.id, body);
    assert.equal(retry.items[0].quantity, 2);
    assert.equal(retry.revision, 1);
    secondApp.sharedCarts.mutate(actors.sales, first.id, change({ revision: 1, quantity: 1 }));
    assert.equal(firstApp.sharedCarts.mutate(actors.buyer, first.id, body).items[0].quantity, 3);
    assert.throws(
      () => firstApp.sharedCarts.mutate(actors.buyer, first.id, { ...body, quantity: 9 }),
      { code: 'request_reused' },
    );
    assert.equal(firstApp.db.prepare('SELECT COUNT(*) AS n FROM cart_events').get().n, 2);
    firstApp.db.close();
    firstApp = null;
    secondApp.db.close();
    secondApp = null;
    restarted = createApp({ dbPath, logger: () => {} });
    const restored = restarted.sharedCarts.read(actors.buyer2, first.id, date);
    assert.equal(restored.items[0].quantity, 3);
    assert.equal(restored.events[0].actorRole, 'sales');
    assert.equal(restored.revision, 2);
  } finally {
    firstApp?.db.close();
    secondApp?.db.close();
    restarted?.db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('shared cart validates dates/quantities, preserves deleted SKUs, refreshes prices, and denies revoked or inactive accounts', async () => {
  const app = createApp({ dbPath: ':memory:', logger: () => {} });
  try {
    const { first } = seedSharedCart(app);
    for (const invalid of ['2026-02-30', '2026-99-99', '2026-2-01', '', null])
      assert.throws(() => cartDate(invalid), { code: 'validation_error' });
    for (const quantity of [0, -1, 1.5, '2', 100])
      assert.equal(
        (await sharedRequest(app, 'POST', url(first), 'buyer', change({ quantity }))).status,
        422,
      );
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM cart_cycles').get().n, 0);
    await sharedRequest(app, 'POST', url(first), 'buyer', change());
    const before = (await sharedRequest(app, 'GET', url(first) + '?date=' + date, 'buyer')).body
      .cart;
    app.db.prepare('UPDATE catalog_variants SET price=price+100 WHERE id=?').run('snack-pedas-23g');
    const refreshed = await sharedRequest(
      app,
      'POST',
      url(first),
      'buyer',
      change({ revision: 1, action: 'refresh' }),
    );
    assert.equal(refreshed.body.cart.items[0].price, before.items[0].price + 100);
    app.db.prepare('DELETE FROM catalog_variants WHERE id=?').run('snack-pedas-23g');
    assert.equal(
      (await sharedRequest(app, 'GET', url(first) + '?date=' + date, 'buyer')).body.cart.items
        .length,
      1,
    );
    assert.equal(
      (await sharedRequest(app, 'POST', url(first), 'buyer', change({ revision: 2 }))).body.error,
      'product_unavailable',
    );
    assert.equal(
      (
        await sharedRequest(
          app,
          'POST',
          url(first),
          'buyer',
          change({ revision: 2, action: 'remove' }),
        )
      ).body.cart.items.length,
      0,
    );
    app.db.prepare('DELETE FROM b2b_sales_assignments WHERE sales_user_id=?').run('sales');
    assert.equal(
      (await sharedRequest(app, 'GET', url(first) + '?date=' + date, 'sales')).status,
      404,
    );
    assert.notEqual(
      (await sharedRequest(app, 'POST', '/api/orders', 'sales', {})).body.error,
      'shared_cart_required',
      'Sales can still place private orders after their store assignment ends',
    );
    app.db.prepare('INSERT INTO account_access(user_id,disabled_at) VALUES(?,?)').run('buyer', 1);
    assert.equal(
      (await sharedRequest(app, 'POST', url(first), 'buyer', change({ revision: 3 }))).status,
      401,
    );
    app.db
      .prepare('INSERT INTO account_approvals(user_id,status) VALUES(?,?)')
      .run('buyer2', 'pending');
    assert.equal(
      (await sharedRequest(app, 'GET', url(first) + '?date=' + date, 'buyer2')).status,
      401,
    );
  } finally {
    app.db.close();
  }
});

test('shared carts paginate historical periods and audit events; locked drafts cannot be changed', () => {
  const app = createApp({ dbPath: ':memory:', logger: () => {} });
  try {
    const { first, actors } = seedSharedCart(app);
    app.sharedCarts.mutate(actors.buyer, first.id, change());
    for (let revision = 1; revision < 35; revision++)
      app.sharedCarts.mutate(
        { id: 'sales' },
        first.id,
        change({ revision, action: 'set', quantity: (revision % 2) + 1 }),
      );
    const snapshot = app.sharedCarts.read({ id: 'buyer' }, first.id, date);
    assert.equal(snapshot.events.length, 30);
    assert.equal(snapshot.hasMore, true);
    const older = app.sharedCarts.events(
      { id: 'buyer' },
      first.id,
      new URLSearchParams({ date, before: '6' }),
    );
    assert.equal(older.events.length, 5);
    for (let i = 1; i <= 27; i++)
      app.sharedCarts.mutate(
        { id: 'buyer' },
        first.id,
        change({ date: '2026-11-' + String(i).padStart(2, '0') }),
      );
    const page = app.sharedCarts.list(
      { id: 'operator' },
      first.id,
      new URLSearchParams({ page: '2' }),
    );
    assert.equal(page.total, 28);
    assert.equal(page.cycles.length, 3);
    app.db.prepare("UPDATE cart_cycles SET status='locked' WHERE delivery_date=?").run(date);
    assert.equal(app.sharedCarts.read({ id: 'buyer' }, first.id, date).canEdit, false);
    assert.throws(
      () => app.sharedCarts.mutate({ id: 'buyer' }, first.id, change({ revision: 35 })),
      { code: 'cart_locked' },
    );
  } finally {
    app.db.close();
  }
});

test('shared cart accepts real uppercase SKUs and packaging, caps 100 SKUs/99 packages, and rolls back invalid changes', () => {
  const app = createApp({ dbPath: ':memory:', logger: () => {} });
  try {
    const { first, actors } = seedSharedCart(app);
    const source = app.db
      .prepare('SELECT * FROM catalog_variants WHERE id=?')
      .get('snack-pedas-23g');
    const insert = app.db
      .prepare(`INSERT INTO catalog_variants(id,product_id,size_value,size_unit,price,old_price,position,packaging_type,units_per_package,packs_per_box)
      VALUES(?,?,?,?,?,?,?,?,?,?)`);
    for (let i = 0; i <= 100; i++)
      insert.run('GORIO-' + i, source.product_id, 1000 + i, 'g', 11750, 0, 1000 + i, 'pack', 10, 0);
    let snapshot;
    for (let revision = 0; revision < 100; revision++)
      snapshot = app.sharedCarts.mutate(
        actors.buyer,
        first.id,
        change({ revision, productId: 'GORIO-' + revision, quantity: 1 }),
      );
    assert.equal(snapshot.items.length, 100);
    assert.equal(snapshot.items[0].packaging.unitsPerPackage, 10);
    assert.equal(snapshot.items[0].packaging.packagingType, 'pack');
    assert.throws(
      () =>
        app.sharedCarts.mutate(
          actors.buyer,
          first.id,
          change({ revision: 100, productId: 'GORIO-100' }),
        ),
      /Maksimal 100 SKU/,
    );
    snapshot = app.sharedCarts.mutate(
      actors.sales,
      first.id,
      change({ revision: 100, productId: 'GORIO-0', action: 'set', quantity: 99 }),
    );
    assert.throws(
      () =>
        app.sharedCarts.mutate(
          actors.buyer,
          first.id,
          change({ revision: 101, productId: 'GORIO-0', quantity: 1 }),
        ),
      /Maksimal 99/,
    );
    assert.equal(app.sharedCarts.read(actors.buyer, first.id, date).revision, snapshot.revision);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM cart_events').get().n, 101);
  } finally {
    app.db.close();
  }
});

test('simultaneous buyer/Sales writes from separate backend workers cannot both accept the same revision', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bam-shared-cart-workers-'));
  const dbPath = join(directory, 'test.sqlite');
  const app = createApp({ dbPath, logger: () => {} });
  const workers = [];
  try {
    const { first, actors } = seedSharedCart(app);
    const results = await Promise.all(
      [actors.buyer, actors.sales].map(
        (actor) =>
          new Promise((resolve, reject) => {
            const worker = new Worker(
              `const { parentPort,workerData:d }=require('node:worker_threads');
        (async()=>{ const {createApp}=await import(d.module); const app=createApp({dbPath:d.dbPath,logger:()=>{}});
        try { const result=app.sharedCarts.mutate(d.actor,d.storeId,d.body); parentPort.postMessage({revision:result.revision}); }
        catch(error){parentPort.postMessage({code:error.code});}finally{app.db.close();} })();`,
              {
                eval: true,
                workerData: {
                  module: new URL('./app.js', import.meta.url).href,
                  dbPath,
                  actor,
                  storeId: first.id,
                  body: change(),
                },
              },
            );
            workers.push(worker);
            let result;
            worker.on('message', (value) => {
              result = value;
            });
            worker.on('error', reject);
            worker.on('exit', (code) =>
              code || !result ? reject(new Error('Worker failed')) : resolve(result),
            );
          }),
      ),
    );
    assert.equal(
      results.filter((result) => result.revision === 1).length,
      1,
      JSON.stringify(results),
    );
    assert.equal(results.filter((result) => result.code === 'cart_conflict').length, 1);
    assert.equal(app.sharedCarts.read(actors.buyer, first.id, date).items[0].quantity, 2);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM cart_events').get().n, 1);
  } finally {
    await Promise.all(workers.map((worker) => worker.terminate()));
    app.db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});


test('B2B buyer and Sales can place private orders without changing shared-store cart', async () => {
  const app = createApp({ dbPath: ':memory:', logger: () => {} });
  try {
    const { first } = seedSharedCart(app);
    const variant = app.catalog.snapshot().edits
      .flatMap((draft) => draft.variants)
      .find((item) => item.id === 'snack-pedas');
    assert.ok(variant, 'fixture product should be available');
    const cartBefore = app.sharedCarts.read({id:'buyer',role:'user'}, first.id, date);
    for (const actor of ['buyer', 'sales']) {
      const response = await sharedRequest(app, 'POST', '/api/orders', actor, {
        requestKey: randomUUID(),
        recipient: 'Pembeli pribadi fixture',
        address: 'Jalan Test Private Nomor 20',
        shippingId: 'regular',
        paymentId: 'cod',
        items: [{
          id: variant.id, quantity: 1, expectedPrice: Number(variant.price),
        }],
      });
      assert.equal(response.status, 201, JSON.stringify(response.body));
      assert.equal(response.body.order.userId, actor);
      assert.equal(response.body.order.b2b ?? null, null);
    }
    const cartAfter = app.sharedCarts.read({id:'buyer',role:'user'}, first.id, date);
    assert.deepEqual(cartAfter.items, cartBefore.items);
    assert.equal(cartAfter.revision, cartBefore.revision);
  } finally { app.db.close(); }
});

test('configured B2B cut-off locks carts once and rejects late writes without finalizing', () => {
  let now = Date.parse('2026-10-19T17:00:00+07:00');
  const app = createApp({ dbPath: ':memory:', logger: () => {},
    now: () => now, b2bCutoff: { daysBefore: 1, time: '18:00' } });
  const { first, actors } = seedSharedCart(app);
  try {
    const before = app.sharedCarts.mutate(actors.buyer, first.id, change());
    assert.equal(before.canEdit, true);
    assert.equal(before.cutoffAt, '2026-10-20T11:00:00.000Z');
    now = Date.parse('2026-10-20T18:00:00+07:00');
    const locked = app.sharedCarts.read(actors.buyer, first.id, date);
    assert.equal(locked.status, 'locked');
    assert.equal(locked.canEdit, false);
    assert.equal(locked.revision, 2);
    assert.equal(locked.items.length, 1);
    assert.equal(app.db.prepare("SELECT COUNT(*) AS n FROM b2b_cycle_lifecycle_events WHERE action='auto_lock'").get().n, 1);
    app.sharedCarts.read(actors.sales, first.id, date);
    assert.equal(app.db.prepare("SELECT COUNT(*) AS n FROM b2b_cycle_lifecycle_events WHERE action='auto_lock'").get().n, 1);
    assert.throws(() => app.sharedCarts.mutate(actors.buyer, first.id, change({ revision: 2 })),
      { code: 'cart_cutoff_passed' });
    now = Date.parse('2026-10-22T00:00:00+07:00');
    assert.equal(app.sharedCarts.read(actors.buyer, first.id, date).overdue, true);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 0);
  } finally { app.db.close(); }
});

test('cut-off configuration and WIB date boundaries are validated', async () => {
  const { b2bCutoffFromEnv, cutoffTime, isPastDeliveryDate } = await import('./b2bCutoff.js');
  assert.equal(b2bCutoffFromEnv({}), null);
  assert.deepEqual(b2bCutoffFromEnv({ BAM_B2B_CUTOFF_DAYS_BEFORE: '1', BAM_B2B_CUTOFF_TIME: '18:00' }),
    { daysBefore: 1, time: '18:00' });
  for (const bad of [
    { BAM_B2B_CUTOFF_DAYS_BEFORE: '1' },
    { BAM_B2B_CUTOFF_TIME: '18:00' },
    { BAM_B2B_CUTOFF_DAYS_BEFORE: '-1', BAM_B2B_CUTOFF_TIME: '18:00' },
    { BAM_B2B_CUTOFF_DAYS_BEFORE: '1', BAM_B2B_CUTOFF_TIME: '26:00' },
  ]) assert.throws(() => b2bCutoffFromEnv(bad));
  assert.equal(cutoffTime('2026-10-26', { daysBefore: 1, time: '18:00' }),
    Date.parse('2026-10-25T18:00:00+07:00'));
  assert.equal(isPastDeliveryDate('2026-10-26', Date.parse('2026-10-26T22:00:00+07:00')), false);
  assert.equal(isPastDeliveryDate('2026-10-26', Date.parse('2026-10-27T00:00:00+07:00')), true);
});
