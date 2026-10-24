import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { Worker } from 'node:worker_threads';
import { createApp } from './app.js';
import { seedSharedCart, sharedRequest } from './sharedCartFixture.js';
const date = '2026-10-21';
const body = (action, revision, fields = {}) => ({
  action,
  revision,
  date,
  requestId: randomUUID(),
  ...fields,
});
const add = (app, actor, store, quantity = 2, productId = 'snack-pedas-23g') =>
  app.sharedCarts.mutate(
    actor,
    store.id,
    body('add', app.sharedCarts.read(actor, store.id, date).revision, { productId, quantity }),
  );
const lock = (app, actor, store) =>
  app.b2bFinalization.change(
    actor,
    store.id,
    body('lock', app.sharedCarts.read(actor, store.id, date).revision),
  );
const ready = (app, actor, store) => {
  const review = app.b2bFinalization.review(actor, store.id, date);
  return body('finalize', review.revision, { reviewToken: review.token, accepted: true });
};
const count = (app, table) => app.db.prepare('SELECT COUNT(*) AS n FROM ' + table).get().n;

test('B2B buyer/Sales select payment; Owner configures banks; Admin verifies manual transfer proof without changing selection', async () => {
  const app = createApp({ dbPath: ':memory:', logger: () => {}, passwordCheck: async () => true });
  const { first, second, actors } = seedSharedCart(app);
  const cartUrl = '/api/b2b/stores/' + first.id + '/cart';
  const bankUrl = '/api/admin/b2b/banks';
  const bank = { bank: 'BCA', account: '1234567890', holder: 'BAM Distribusi', revision: 0, currentPassword: 'fixture-password' };
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9i0AAAAASUVORK5CYII=';
  try {
    assert.equal((await sharedRequest(app, 'GET', bankUrl, 'buyer')).status, 403);
    assert.equal((await sharedRequest(app, 'PUT', bankUrl, 'operator', bank)).status, 403);
    assert.equal((await sharedRequest(app, 'PUT', bankUrl, 'owner', { ...bank, account: 'abc' })).status, 422);
    const configured = await sharedRequest(app, 'PUT', bankUrl, 'owner', bank);
    assert.equal(configured.status, 200, JSON.stringify(configured.body));
    assert.equal(configured.body.banks.find((row) => row.bank === 'BCA').revision, 1);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM b2b_bank_events').get().n, 1);
    assert.equal(app.db.prepare('SELECT account_tail FROM b2b_bank_events').get().account_tail, '7890');
    assert.equal((await sharedRequest(app, 'PUT', bankUrl, 'owner', bank)).status, 409);

    add(app, actors.buyer, first);
    const buyerChoice = await sharedRequest(app, 'POST', cartUrl, 'buyer',
      body('payment', 1, { paymentId: 'transfer-bri' }));
    assert.equal(buyerChoice.status, 200);
    assert.equal(buyerChoice.body.cart.paymentId, 'transfer-bri');
    assert.equal(buyerChoice.body.cart.events[0].actorRole, 'buyer');
    assert.equal((await sharedRequest(app, 'POST', cartUrl, 'operator',
      body('payment', 2, { paymentId: 'cod' }))).status, 403);
    assert.equal((await sharedRequest(app, 'POST', '/api/b2b/stores/' + second.id + '/cart',
      'sales', body('payment', 0, { paymentId: 'cod' }))).status, 404);
    const salesChoice = await sharedRequest(app, 'POST', cartUrl, 'sales',
      body('payment', 2, { paymentId: 'transfer-bca' }));
    assert.equal(salesChoice.status, 200);
    assert.equal(salesChoice.body.cart.events[0].actorRole, 'sales');
    assert.equal(salesChoice.body.cart.events[0].details.before, 'transfer-bri');
    assert.equal(salesChoice.body.cart.events[0].details.after, 'transfer-bca');

    const locked = lock(app, actors.operator, first);
    assert.equal(locked.cart.paymentId, 'transfer-bca');
    assert.equal((await sharedRequest(app, 'POST', cartUrl, 'sales',
      body('payment', locked.cart.revision, { paymentId: 'cod' }))).status, 409);
    const checked = app.b2bFinalization.review(actors.owner, first.id, date);
    assert.equal(checked.ready, true);
    assert.equal(checked.payment.id, 'transfer-bca');
    assert.equal(checked.destination.account, bank.account);

    const changeAccount = await sharedRequest(app, 'PUT', bankUrl, 'owner',
      { ...bank, account: '9876543210', revision: 1 });
    assert.equal(changeAccount.status, 200);
    assert.throws(
      () => app.b2bFinalization.change(actors.owner, first.id,
        body('finalize', checked.revision, { reviewToken: checked.token, accepted: true })),
      { code: 'review_changed' },
      'bank edits invalidate a previous review token',
    );
    const refreshed = app.b2bFinalization.review(actors.owner, first.id, date);
    const completed = app.b2bFinalization.change(actors.owner, first.id,
      body('finalize', refreshed.revision, { reviewToken: refreshed.token, accepted: true }));
    let order = completed.order;
    assert.equal(order.payment.id, 'transfer-bca');
    assert.equal(order.payment.status, 'pending');
    assert.equal(order.payment.destination.account, '9876543210');
    assert.equal(order.status, 'processing');
    assert.throws(() => app.workflow.update(actors.owner, order.id, {
      action: 'paid', revision: order.revision, reference: 'TRANSFER-TANPA-BUKTI',
    }), { code: 'invalid_status' });
    assert.throws(() => app.workflow.update(actors.sales, order.id, {
      action: 'cancel', revision: order.revision,
    }), { code: 'admin_required' });
    assert.throws(() => app.workflow.update(actors.other, order.id, {
      action: 'submit_proof', revision: order.revision, image,
    }), { code: 'not_found' });

    const uploaded = await sharedRequest(app, 'POST', '/api/orders/' + order.id + '/proof',
      'sales', { revision: order.revision, image });
    assert.equal(uploaded.status, 200, JSON.stringify(uploaded.body));
    order = uploaded.body.order;
    assert.equal(order.payment.status, 'proof_submitted');
    assert.equal(order.status, 'processing');
    assert.equal(order.payment.proof.status, 'pending');
    assert.equal(app.workflow.proof(actors.buyer, order.id, order.payment.proof.id).mime, 'image/png');
    assert.throws(() => app.workflow.proof(actors.other, order.id, order.payment.proof.id),
      { code: 'not_found' });
    order = app.workflow.update(actors.operator, order.id, {
      action: 'reject_proof', revision: order.revision, reason: 'Nominal tidak sesuai',
    });
    assert.equal(order.payment.status, 'pending');
    assert.equal(order.payment.proof.status, 'rejected');
    assert.equal(order.payment.proof.reviewedBy, 'operator');
    order = app.workflow.update(actors.buyer, order.id, {
      action: 'submit_proof', revision: order.revision, image,
    });
    order = app.workflow.update(actors.operator, order.id, {
      action: 'paid', revision: order.revision, reference: 'BCA-RECEIVED-001',
    });
    assert.equal(order.payment.status, 'paid');
    assert.equal(order.payment.proof.status, 'accepted');
    assert.equal(order.payment.recordedBy, 'operator');
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 1);
    assert.equal(app.workflow.get(actors.buyer2, order.id).payment.status, 'paid');
  } finally {
    app.db.close();
  }
});

test('selected transfer cannot be finalized until the matching B2B bank is configured', async () => {
  const app = createApp({ dbPath: ':memory:', logger: () => {} });
  const { first, actors } = seedSharedCart(app);
  try {
    add(app, actors.buyer, first);
    app.sharedCarts.mutate(actors.buyer, first.id,
      body('payment', 1, { paymentId: 'transfer-mandiri' }));
    lock(app, actors.owner, first);
    const review = app.b2bFinalization.review(actors.owner, first.id, date);
    assert.equal(review.ready, false);
    assert.equal(review.destination, null);
    assert.throws(() => app.b2bFinalization.change(actors.owner, first.id,
      body('finalize', review.revision, { reviewToken: review.token, accepted: true })),
    { code: 'review_not_ready' });
    assert.equal(count(app, 'orders'), 0);
  } finally {
    app.db.close();
  }
});

test('finalization API only allows active Admin; locked carts reject edits; finalized orders are scoped to the store and immutable to buyers/Sales', async () => {
  const app = createApp({ dbPath: ':memory:', logger: () => {} });
  const { first, actors } = seedSharedCart(app);
  const path = '/api/admin/b2b/stores/' + first.id + '/cart';
  try {
    for (const url of [path + '/review?date=' + date, '/api/admin/b2b/carts']) {
      assert.equal((await sharedRequest(app, 'GET', url)).status, 401);
      for (const actor of ['buyer', 'sales', 'other'])
        assert.equal((await sharedRequest(app, 'GET', url, actor)).status, 403);
    }
    assert.equal((await sharedRequest(app, 'POST', path, 'buyer', body('lock', 0))).status, 403);
    assert.equal(
      (await sharedRequest(app, 'POST', path, 'owner', body('lock', 0), 'https://foreign.test'))
        .status,
      403,
    );
    assert.throws(
      () => app.b2bFinalization.change({ id: 'buyer', role: 'admin' }, first.id, body('lock', 0)),
      /Hanya Admin/,
    );
    assert.equal((await sharedRequest(app, 'POST', path, 'owner', body('lock', 0))).status, 409);
    add(app, actors.buyer, first);
    assert.equal((await sharedRequest(app, 'POST', path, 'owner', body('lock', 0))).status, 409);
    const locked = await sharedRequest(app, 'POST', path, 'operator', body('lock', 1));
    assert.equal(locked.status, 200);
    assert.equal(locked.body.cart.status, 'locked');
    assert.equal(count(app, 'orders'), 0);
    for (const actor of ['buyer', 'sales'])
      assert.equal(
        (
          await sharedRequest(
            app,
            'POST',
            '/api/b2b/stores/' + first.id + '/cart',
            actor,
            body('clear', 2),
          )
        ).status,
        409,
      );
    const request = ready(app, actors.owner, first);
    const created = await sharedRequest(app, 'POST', path, 'owner', request);
    assert.equal(created.status, 200, JSON.stringify(created.body));
    const order = created.body.order;
    assert.equal(created.body.cart.status, 'finalized');
    assert.equal(created.body.cart.orderId, order.id);
    assert.equal(order.status, 'processing');
    assert.equal(order.shipping.cost, 0);
    assert.equal(order.payment.status, 'pay_on_delivery');
    assert.equal(order.inventoryReserved, true);
    assert.equal(order.b2b.storeId, first.id);
    assert.equal(order.b2b.finalizedBy.id, 'owner');
    for (const actor of ['buyer', 'buyer2', 'sales']) {
      assert.equal((await sharedRequest(app, 'GET', '/api/orders/' + order.id, actor)).status, 200);
      assert.equal(
        (await sharedRequest(app, 'GET', '/api/orders?q=' + first.storeName, actor)).body.total,
        1,
      );
      assert.equal(
        (
          await sharedRequest(app, 'PUT', '/api/orders/' + order.id, actor, {
            action: 'cancel',
            revision: 0,
          })
        ).status,
        403,
      );
      const personalOrder = await sharedRequest(app, 'POST', '/api/orders', actor, {});
      assert.equal(personalOrder.status, 422, 'private checkout still validates the submitted cart');
      assert.notEqual(personalOrder.body.error, 'shared_cart_required');
    }
    assert.equal(
      app.workflow.list(actors.owner).total,
      0,
      'creator Admin must not receive store orders as personal purchases',
    );
    assert.equal(app.workflow.list(actors.owner, { admin: true }).total, 1);
    assert.equal((await sharedRequest(app, 'GET', '/api/orders/' + order.id, 'other')).status, 404);
    assert.equal(
      (await sharedRequest(app, 'GET', '/api/orders?q=' + order.id, 'other')).body.total,
      0,
    );
    const replay = await sharedRequest(app, 'POST', path, 'owner', request);
    assert.equal(replay.body.order.id, order.id);
    const otherRetry = await sharedRequest(app, 'POST', path, 'operator', {
      ...request,
      requestId: randomUUID(),
    });
    assert.equal(otherRetry.body.order.id, order.id);
    assert.equal(count(app, 'orders'), 1);
    assert.equal(
      app.db.prepare("SELECT COUNT(*) AS n FROM inventory_events WHERE action='reserve'").get().n,
      1,
    );
    assert.equal(
      (await sharedRequest(app, 'POST', path, 'owner', { ...request, reviewToken: 'a'.repeat(64) }))
        .status,
      409,
    );
    assert.equal(
      (
        await sharedRequest(
          app,
          'POST',
          path,
          'owner',
          body('unlock', 3, { reason: 'Periksa ulang' }),
        )
      ).status,
      409,
    );
    const latest = app.b2bStores.store(first.id);
    app.b2bStores.removeLink(actors.owner, first.id, 'sales', {
      userId: 'sales',
      revision: latest.revision,
    });
    assert.equal((await sharedRequest(app, 'GET', '/api/orders/' + order.id, 'sales')).status, 404);
    assert.equal((await sharedRequest(app, 'GET', '/api/orders', 'sales')).body.total, 0);
    const cancelled = app.workflow.update(actors.operator, order.id, {
      action: 'cancel',
      revision: 0,
      reason: 'Permintaan toko',
    });
    assert.equal(cancelled.inventoryReleased, true);
    assert.throws(
      () => app.workflow.update(actors.operator, order.id, { action: 'cancel', revision: 1 }),
      /tidak dapat dibatalkan/,
    );
    assert.equal(
      app.db
        .prepare('SELECT available FROM inventory WHERE stock_key=?')
        .get(order.inventory[0].key).available,
      120,
    );
  } finally {
    app.db.close();
  }
});

test('review aggregates unit/pack stock, exposes changed snapshots, rejects stale catalog/stock/store data and allows explicit unlock corrections', () => {
  const app = createApp({ dbPath: ':memory:', logger: () => {} });
  const { first, actors } = seedSharedCart(app);
  try {
    const catalog = app.catalog.snapshot();
    const group = catalog.edits.find((draft) => draft.groupId === 'snack-pedas');
    const variant = group.variants.find((item) => item.id === 'snack-pedas-23g');
    group.variants.push({
      ...variant,
      id: 'FINAL-PACK',
      packagingType: 'pack',
      unitsPerPackage: '10',
      price: '30000',
      oldPrice: '',
    });
    app.catalog.save(catalog);
    add(app, actors.buyer, first, 5);
    add(app, actors.buyer, first, 2, 'FINAL-PACK');
    lock(app, actors.owner, first);
    let review = app.b2bFinalization.review(actors.owner, first.id, date);
    assert.equal(review.stock.length, 1);
    assert.equal(review.stock[0].required, 25);
    const key = review.stock[0].key;
    app.workflow.setStock(actors.owner, { key, available: 20, revision: review.stock[0].revision });
    const stale = body('finalize', review.revision, { reviewToken: review.token, accepted: true });
    assert.throws(
      () => app.b2bFinalization.change(actors.owner, first.id, stale),
      /berubah sejak pemeriksaan/,
    );
    review = app.b2bFinalization.review(actors.owner, first.id, date);
    assert.equal(review.ready, false);
    assert.throws(
      () => app.b2bFinalization.change(actors.owner, first.id, ready(app, actors.owner, first)),
      /belum memenuhi/,
    );
    const unlockBody = body('unlock', review.revision, { reason: 'Jumlah perlu dikoreksi' });
    const unlocked = app.b2bFinalization.change(actors.owner, first.id, unlockBody);
    assert.equal(
      unlocked.cart.canEdit,
      true,
      'Admin may edit an unlocked store cart before reviewing and finalizing',
    );
    assert.equal(
      app.b2bFinalization.change(actors.owner, first.id, unlockBody).cart.status,
      'open',
    );
    assert.throws(
      () =>
        app.b2bFinalization.change(actors.owner, first.id, { ...unlockBody, reason: 'Berbeda' }),
      /sudah digunakan/,
    );
    app.sharedCarts.mutate(
      actors.sales,
      first.id,
      body('set', unlocked.cart.revision, { productId: 'FINAL-PACK', quantity: 1 }),
    );
    const changed = app.catalog.snapshot();
    changed.edits
      .find((draft) => draft.groupId === group.groupId)
      .variants.find((item) => item.id === 'FINAL-PACK').price = '35000';
    app.catalog.save(changed);
    lock(app, actors.operator, first);
    review = app.b2bFinalization.review(actors.owner, first.id, date);
    assert.equal(review.ready, true);
    assert.equal(review.items.find((item) => item.id === 'FINAL-PACK').changed, true);
    assert.equal(review.items.find((item) => item.id === 'FINAL-PACK').price, 30000);
    assert.equal(review.items.find((item) => item.id === 'FINAL-PACK').current.price, 35000);
    const request = ready(app, actors.owner, first);
    app.b2bStores.update(actors.owner, first.id, {
      ...app.b2bStores.store(first.id),
      storeName: 'Toko diperbarui',
    });
    assert.throws(
      () => app.b2bFinalization.change(actors.owner, first.id, request),
      /berubah sejak pemeriksaan/,
    );
    const result = app.b2bFinalization.change(
      actors.owner,
      first.id,
      ready(app, actors.owner, first),
    );
    assert.equal(result.order.recipient, 'Toko diperbarui');
    assert.equal(result.order.items.find((item) => item.id === 'FINAL-PACK').price, 35000);
    assert.equal(result.cart.items.find((item) => item.id === 'FINAL-PACK').price, 35000);
    assert.equal(
      app.db.prepare('SELECT available FROM inventory WHERE stock_key=?').get(key).available,
      5,
    );
    assert.ok(result.cart.events[0].details.changes.length);
  } finally {
    app.db.close();
  }
});

test('a failure after reservation rolls back order, inventory, mappings and audit; the same request can safely retry', () => {
  const app = createApp({ dbPath: ':memory:', logger: () => {} });
  const { first, actors } = seedSharedCart(app);
  try {
    add(app, actors.buyer, first);
    lock(app, actors.owner, first);
    const request = ready(app, actors.owner, first);
    const inventory = app.workflow.stock();
    const events = count(app, 'cart_events');
    app.db.exec(
      "CREATE TRIGGER fixture_fail_finalization BEFORE INSERT ON b2b_cart_orders BEGIN SELECT RAISE(ABORT,'fixture rollback'); END",
    );
    assert.throws(
      () => app.b2bFinalization.change(actors.owner, first.id, request),
      /fixture rollback/,
    );
    assert.deepEqual(app.workflow.stock(), inventory);
    assert.equal(count(app, 'orders'), 0);
    assert.equal(count(app, 'b2b_cart_orders'), 0);
    assert.equal(count(app, 'cart_events'), events);
    assert.equal(app.sharedCarts.read(actors.buyer, first.id, date).status, 'locked');
    app.db.exec('DROP TRIGGER fixture_fail_finalization');
    assert.ok(app.b2bFinalization.change(actors.owner, first.id, request).order.id);
  } finally {
    app.db.close();
  }
});

test('Admin queue searches all pages literally and excludes buyer access; missing catalog items block finalization', async () => {
  const app = createApp({ dbPath: ':memory:', logger: () => {} });
  const { first, actors } = seedSharedCart(app);
  try {
    for (let index = 1; index <= 28; index++)
      app.sharedCarts.mutate(actors.buyer, first.id, {
        ...body('add', 0, { productId: 'snack-pedas-23g', quantity: 1 }),
        date: '2026-10-' + String(index).padStart(2, '0'),
      });
    const queue = app.b2bFinalization.queue(actors.owner, new URLSearchParams());
    assert.equal(queue.total, 28);
    assert.equal(queue.carts.length, 25);
    assert.equal(
      app.b2bFinalization.queue(actors.owner, new URLSearchParams('page=2')).carts.length,
      3,
    );
    assert.equal(
      app.b2bFinalization.queue(actors.owner, new URLSearchParams('q=2026-10-01')).total,
      1,
    );
    assert.equal(app.b2bFinalization.queue(actors.owner, new URLSearchParams('q=%25_')).total, 0);
    assert.equal((await sharedRequest(app, 'GET', '/api/admin/b2b/carts', 'sales')).status, 403);
    for (const q of ['status=bad', 'page=0', 'q=' + 'a'.repeat(201)])
      assert.equal(
        (await sharedRequest(app, 'GET', '/api/admin/b2b/carts?' + q, 'owner')).status,
        422,
      );
    lock(app, actors.owner, first);
    const candidate = app.catalog.snapshot();
    candidate.edits = candidate.edits.filter((group) => group.groupId !== 'snack-pedas');
    app.catalog.save(candidate);
    const review = app.b2bFinalization.review(actors.owner, first.id, date);
    assert.equal(review.ready, false);
    assert.equal(review.items[0].unavailable, true);
    assert.throws(
      () => app.b2bFinalization.change(actors.owner, first.id, ready(app, actors.owner, first)),
      /belum memenuhi/,
    );
  } finally {
    app.db.close();
  }
});

test('two backend processes compete for the last stock; only one finalizes and retry survives database restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bam-finalization-'));
  const dbPath = join(directory, 'test.sqlite');
  let app = createApp({ dbPath, logger: () => {} });
  const workers = [];
  try {
    const { first, second, actors } = seedSharedCart(app);
    add(app, actors.buyer, first);
    add(app, actors.other, second);
    const key = app.workflow
      .catalogItems()
      .find((item) => item.variant.id === 'snack-pedas-23g').key;
    app.workflow.setStock(actors.owner, { key, available: 2, revision: 0 });
    lock(app, actors.owner, first);
    lock(app, actors.owner, second);
    const requests = [first, second].map((store) => ready(app, actors.owner, store));
    const run = (store, index) =>
      new Promise((resolve, reject) => {
        const worker = new Worker(
          `const {parentPort,workerData:d}=require('node:worker_threads');
        (async()=>{ const {createApp}=await import(d.module);const app=createApp({dbPath:d.dbPath,logger:()=>{}});
        try { parentPort.postMessage({orderId:app.b2bFinalization.change(d.actor,d.storeId,d.body).order.id}); }
        catch(error){parentPort.postMessage({code:error.code});}finally{app.db.close();} })();`,
          {
            eval: true,
            workerData: {
              module: new URL('./app.js', import.meta.url).href,
              dbPath,
              actor: actors.owner,
              storeId: store.id,
              body: requests[index],
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
          code || !result ? reject(Error('Worker failed')) : resolve(result),
        );
      });
    const results = await Promise.all([run(first, 0), run(second, 1)]);
    assert.equal(results.filter((result) => result.orderId).length, 1, JSON.stringify(results));
    assert.equal(results.filter((result) => result.code === 'review_changed').length, 1);
    assert.equal(count(app, 'orders'), 1);
    assert.equal(
      app.db.prepare('SELECT available FROM inventory WHERE stock_key=?').get(key).available,
      0,
    );
    const loserIndex = results.findIndex((result) => !result.orderId);
    const loser = [first, second][loserIndex];
    const latestStock = app.workflow.stock().stock[key];
    app.workflow.setStock(actors.owner, { key, available: 2, revision: latestStock.revision });
    requests[loserIndex] = ready(app, actors.owner, loser);
    const parallelRetries = await Promise.all([run(loser, loserIndex), run(loser, loserIndex)]);
    assert.ok(parallelRetries.every((result) => result.orderId === parallelRetries[0].orderId));
    assert.equal(
      count(app, 'orders'),
      2,
      'parallel finalization of one cart still creates exactly one order',
    );
    app.db.close();
    app = createApp({ dbPath, logger: () => {} });
    const index = results.findIndex((result) => result.orderId);
    const replay = app.b2bFinalization.change(
      actors.owner,
      [first, second][index].id,
      requests[index],
    );
    assert.equal(replay.order.id, results[index].orderId);
    assert.equal(count(app, 'orders'), 2);
  } finally {
    await Promise.all(workers.map((worker) => worker.terminate()));
    app.db.close();
    const absolute = realpathSync(directory);
    assert.equal(dirname(absolute), realpathSync(tmpdir()));
    assert.ok(basename(absolute).startsWith('bam-finalization-'));
    rmSync(absolute, { recursive: true, force: true });
  }
});

test('B2B snapshots preserve prices, packaging, store and images; shipping/completion keeps reservations and sales statistics consistent', () => {
  const app = createApp({ dbPath: ':memory:', logger: () => {} });
  const { first, actors } = seedSharedCart(app);
  try {
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9i0AAAAASUVORK5CYII=';
    const catalog = app.catalog.snapshot();
    const group = catalog.edits.find((draft) => draft.groupId === 'snack-pedas');
    group.variants.find((item) => item.id === 'snack-pedas-23g').gallery = [
      { src: png, alt: 'Foto uji snapshot', label: 'Depan' },
    ];
    app.catalog.save(catalog);
    add(app, actors.buyer, first);
    lock(app, actors.owner, first);
    const { order } = app.b2bFinalization.change(
      actors.owner,
      first.id,
      ready(app, actors.owner, first),
    );
    assert.equal(app.workflow.image(actors.buyer, order.id, 0).contentType, 'image/png');
    assert.throws(() => app.workflow.image(actors.other, order.id, 0), /tidak ditemukan/);
    const updated = app.catalog.snapshot();
    updated.edits = updated.edits.filter((draft) => draft.groupId !== 'snack-pedas');
    app.catalog.save(updated);
    app.b2bStores.update(actors.owner, first.id, {
      ...app.b2bStores.store(first.id),
      storeName: 'Nama toko sesudah final',
    });
    const historical = app.workflow.get(actors.buyer, order.id);
    assert.equal(historical.b2b.storeName, order.b2b.storeName);
    assert.deepEqual(historical.items, order.items);
    assert.ok(app.workflow.image(actors.sales, order.id, 0).bytes.length);
    const key = order.inventory[0].key;
    const shipped = app.workflow.update(actors.operator, order.id, {
      action: 'ship',
      revision: 0,
      courier: 'Armada BAM',
      trackingNumber: 'SURAT-JALAN-0001',
    });
    assert.equal(shipped.status, 'shipped');
    const completed = app.workflow.update(actors.owner, order.id, {
      action: 'complete',
      revision: 1,
    });
    assert.equal(completed.payment.status, 'paid');
    assert.equal(completed.inventoryReserved, false);
    assert.equal(
      app.db
        .prepare('SELECT reserved_units,sold_units FROM inventory_stats WHERE stock_key=?')
        .get(key).reserved_units,
      0,
    );
    assert.equal(
      app.db.prepare('SELECT sold_units FROM inventory_stats WHERE stock_key=?').get(key)
        .sold_units,
      2,
    );
    assert.equal(
      app.db.prepare('SELECT available FROM inventory WHERE stock_key=?').get(key).available,
      118,
    );
    assert.throws(
      () => app.workflow.update(actors.owner, order.id, { action: 'complete', revision: 2 }),
      /dikirim terlebih dahulu/,
    );
  } finally {
    app.db.close();
  }
});

test('upgrade from a database without finalization keeps existing carts, legacy orders and stock unchanged', () => {
  const directory = mkdtempSync(join(tmpdir(), 'bam-finalization-upgrade-'));
  const dbPath = join(directory, 'test.sqlite');
  let app = createApp({ dbPath, logger: () => {} });
  try {
    const { first, actors } = seedSharedCart(app);
    const cart = add(app, actors.buyer, first);
    const historical = app.workflow.create(actors.other, {
      requestKey: randomUUID(),
      recipient: 'Pembeli lama',
      address: 'Alamat pembeli lama yang lengkap',
      shippingId: 'regular',
      paymentId: 'cod',
      items: [{ id: 'snack-pedas', quantity: 1, expectedPrice: 18000 }],
    });
    const stock = app.workflow.stock();
    app.db.exec('DROP TABLE b2b_cart_orders');
    app.db.close();
    app = createApp({ dbPath, logger: () => {} });
    assert.equal(count(app, 'b2b_cart_orders'), 0);
    assert.equal(app.sharedCarts.read(actors.buyer, first.id, date).id, cart.id);
    assert.equal(app.sharedCarts.read(actors.buyer, first.id, date).status, 'open');
    assert.deepEqual(app.workflow.get(actors.other, historical.id), historical);
    assert.deepEqual(app.workflow.stock(), stock);
  } finally {
    app.db.close();
    const absolute = realpathSync(directory);
    assert.equal(dirname(absolute), realpathSync(tmpdir()));
    assert.ok(basename(absolute).startsWith('bam-finalization-upgrade-'));
    rmSync(absolute, { recursive: true, force: true });
  }
});

test('B2B email recipients are store members and Sales; revocation before delivery skips stale recipients', async () => {
  const sent = [];
  const app = createApp({
    dbPath: ':memory:',
    logger: () => {},
    mailer: { enabled: true, send: async (message) => sent.push(message) },
    mailConfig: { publicUrl: 'https://fixture.test', queueKey: 'f'.repeat(64) },
  });
  const { first, actors } = seedSharedCart(app);
  try {
    add(app, actors.buyer, first);
    lock(app, actors.owner, first);
    const { order } = app.b2bFinalization.change(
      actors.owner,
      first.id,
      ready(app, actors.owner, first),
    );
    const recipientIds = app.db
      .prepare('SELECT recipient_id FROM order_mail WHERE admin=0 AND order_id=?')
      .all(order.id)
      .map((row) => row.recipient_id);
    assert.deepEqual(recipientIds.sort(), ['buyer', 'buyer2', 'sales']);
    app.b2bStores.removeLink(actors.owner, first.id, 'sales', {
      userId: 'sales',
      revision: app.b2bStores.store(first.id).revision,
    });
    await app.messages.flush(20);
    assert.ok(!sent.some((message) => message.to === 'sales@fixture.test'));
    assert.ok(sent.some((message) => message.to === 'buyer@fixture.test'));
    assert.ok(app.messages.skippedSummary().some((row) => row.reason === 'store_access_changed'));
  } finally {
    app.db.close();
  }
});

test('overdue cart reschedule by Admin preserves items, audit and request idempotency without duplicating orders', () => {
  let now = Date.parse('2026-10-30T12:00:00+07:00');
  const app = createApp({ dbPath: ':memory:', logger: () => {}, now: () => now });
  const { first, actors } = seedSharedCart(app);
  try {
    add(app, actors.buyer, first, 3);
    const oldCart = app.sharedCarts.read(actors.buyer, first.id, date);
    assert.equal(oldCart.overdue, true);
    const action = body('reschedule', oldCart.revision, {
      targetDate: '2026-11-02', reason: 'Armada pengiriman tidak tersedia',
    });
    assert.throws(() => app.b2bFinalization.change(actors.buyer, first.id, action),
      { code: 'admin_required' });
    const updated = app.b2bFinalization.change(actors.owner, first.id, action).cart;
    assert.equal(updated.date, '2026-11-02');
    assert.equal(updated.id, oldCart.id, 'move the same cart, not copy items');
    assert.equal(updated.status, 'locked', 'Admin must review relocated cart');
    assert.equal(updated.items[0].quantity, 3);
    assert.equal(updated.revision, oldCart.revision + 1);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM cart_cycles').get().n, 1);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM cart_items').get().n, 1);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 0);
    assert.equal(app.db.prepare("SELECT COUNT(*) AS n FROM b2b_cycle_lifecycle_events WHERE action='reschedule'").get().n, 1);
    const audit = app.db.prepare("SELECT details FROM b2b_cycle_lifecycle_events WHERE action='reschedule'").get();
    assert.deepEqual(JSON.parse(audit.details), {
      from: date, to: '2026-11-02', reason: 'Armada pengiriman tidak tersedia',
    });
    const repeated = app.b2bFinalization.change(actors.owner, first.id, action);
    assert.equal(repeated.cart.id, updated.id);
    assert.equal(repeated.cart.revision, updated.revision);
    assert.equal(app.db.prepare("SELECT COUNT(*) AS n FROM b2b_cycle_lifecycle_events WHERE action='reschedule'").get().n, 1);
    assert.throws(() => app.b2bFinalization.change(actors.owner, first.id,
      body('reschedule', updated.revision, { targetDate: '2026-11-09', reason: 'Coba ulang yang bukan lewat' })),
      { code: 'not_overdue' });
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 0);
  } finally { app.db.close(); }
});

test('Admin reschedule rejects destination collisions, invalid dates, and finalization remains Admin-only', () => {
  const now = Date.parse('2026-10-30T12:00:00+07:00');
  const app = createApp({ dbPath: ':memory:', logger: () => {}, now: () => now });
  const { first, actors } = seedSharedCart(app);
  try {
    add(app, actors.buyer, first);
    app.sharedCarts.mutate(actors.buyer, first.id, body('add', 0, {
      date: '2026-11-02', productId: 'snack-pedas-23g', quantity: 1,
    }));
    const base = body('reschedule', 1, {
      targetDate: '2026-11-02', reason: 'Jadwal distribusi terlambat',
    });
    assert.throws(() => app.b2bFinalization.change(actors.operator, first.id, base),
      { code: 'period_conflict' });
    assert.throws(() => app.b2bFinalization.change(actors.operator, first.id,
      { ...base, requestId: randomUUID(), targetDate: '2026-10-29' }),
      { code: 'invalid_target_date' });
    assert.throws(() => app.b2bFinalization.change(actors.operator, first.id,
      { ...base, requestId: randomUUID(), targetDate: '2026-11-03', reason: 'x' }),
      /alasan/i);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM cart_cycles').get().n, 2);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 0);
  } finally { app.db.close(); }
});
