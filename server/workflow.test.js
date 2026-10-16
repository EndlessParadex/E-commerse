import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, basename } from 'node:path';
import { Worker } from 'node:worker_threads';
import { createApp } from './app.js';
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9i0AAAAASUVORK5CYII=';
const alice = { id: 'alice', role: 'user' };
const bob = { id: 'bob', role: 'user' };
const admin = { id: 'admin', role: 'admin' };
function users(app) {
  for (const user of [alice, bob, admin]) {
    app.db
      .prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)')
      .run(
        user.id,
        user.id + ' Account',
        user.id + '@fixture.test',
        'Alamat lengkap fixture',
        'fixture-not-for-login',
        new Date().toISOString(),
        user.role,
      );
    const token = user.id[1].repeat(43);
    app.db
      .prepare('INSERT INTO sessions VALUES(?,?,?)')
      .run(createHash('sha256').update(token).digest('hex'), user.id, Date.now() + 86400000);
  }
  app.db.exec(
    'INSERT OR REPLACE INTO auth_account_state(user_id,verified_at) SELECT id,1 FROM users',
  );
  const settings = app.company.snapshot();
  app.company.save({
    ...settings,
    profile: {
      ...settings.profile,
      bankName: 'Bank Fixture',
      bankAccount: '12345678',
      bankHolder: 'Fixture Company',
    },
  });
}

async function request(app, method, path, body, user = alice, extra = {}) {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  req.method = method;
  req.url = path;
  req.headers = {
    host: 'shop.test',
    origin: 'http://shop.test',
    'content-type': 'application/json',
    cookie: user ? 'bam_session=' + user.id[1].repeat(43) : '',
    ...extra,
  };
  let reply;
  await app.handler(req, {
    writeHead(status, headers) {
      reply = { status, headers };
    },
    end(value) {
      reply.body = Buffer.isBuffer(value) ? value : JSON.parse(value);
    },
  });
  return reply;
}
function product(app) {
  const draft = app.catalog.snapshot().edits.find((entry) => entry.groupId === 'snack-pedas');
  const variant = draft.variants.find((entry) => entry.id === 'snack-pedas');
  return { draft, variant, key: draft.groupId + ':' + variant.sizeValue + '-' + variant.sizeUnit };
}
function input(app, extra = {}) {
  const { variant } = product(app);
  return {
    requestKey: randomUUID(),
    recipient: 'Penerima Fixture',
    address: 'Alamat penerima fixture lengkap',
    shippingId: 'regular',
    paymentId: 'manual-transfer',
    note: 'Catatan fixture',
    items: [{ id: variant.id, quantity: 1, expectedPrice: Number(variant.price) }],
    ...extra,
  };
}
function approve(app, order) {
  const quote = app.workflow.update(admin, order.id, {
    action: order.payment.groupId === 'cod' ? 'confirm_cod' : 'approve_payment',
    revision: order.revision,
    shippingCost: 10000,
    courier: 'Kurir fixture',
  });
  return app.workflow.update({ id: order.userId, role: 'user' }, order.id, {
    action: 'accept_quote',
    revision: quote.revision,
  });
}
const clean = (dir) => {
  const target = realpathSync(dir);
  assert.equal(dirname(target), realpathSync(tmpdir()));
  assert.ok(basename(target).startsWith('bam-workflow-'));
  rmSync(target, { recursive: true, force: true });
};

test('stok publik: terjual hanya pesanan selesai, stok tertahan terpisah dan isi kemasan lama tetap benar', async () => {
  let time = Date.now();
  const app = createApp({ legacyCommerceFixture: true, dbPath: ':memory:', now: () => time });
  users(app);
  try {
    const candidate = app.catalog.snapshot();
    const draft = candidate.edits.find((entry) => entry.groupId === 'snack-pedas');
    const base = draft.variants.find((entry) => entry.id === 'snack-pedas');
    draft.variants.push({
      ...base,
      id: 'METRIC-PACK',
      packagingType: 'pack',
      unitsPerPackage: '10',
      price: '150000',
      oldPrice: '',
    });
    app.catalog.save(candidate);
    const { key } = product(app);
    assert.equal(app.workflow.stock().stock[key].soldUnits, 0);
    assert.equal(app.workflow.stock().stock[key].reservedUnits, 0);
    const order = app.workflow.create(
      alice,
      input(app, {
        items: [
          { id: 'METRIC-PACK', quantity: 2, expectedPrice: 150000 },
          { id: base.id, quantity: 3, expectedPrice: Number(base.price) },
        ],
      }),
    );
    assert.equal(app.workflow.stock().stock[key].available, 120);
    approve(app, order);
    assert.deepEqual(app.workflow.stock().stock[key], {
      available: 97,
      revision: 1,
      soldUnits: 0,
      reservedUnits: 23,
    });
    const cancelled = app.workflow.create(bob, input(app));
    app.workflow.update(bob, cancelled.id, {
      action: 'cancel',
      revision: 0,
      reason: 'Berubah pikiran',
    });
    assert.equal(app.workflow.stock().stock[key].soldUnits, 0);
    assert.equal(app.workflow.stock().stock[key].reservedUnits, 23);
    app.workflow.update(admin, order.id, {
      action: 'paid',
      revision: 2,
      reference: 'METRIC-PAID-001',
    });
    assert.equal(app.workflow.stock().stock[key].soldUnits, 0);
    app.workflow.update(admin, order.id, {
      action: 'ship',
      revision: 3,
      courier: 'Kurir Uji',
      trackingNumber: 'METRIC-SHIP-001',
    });
    app.workflow.update(admin, order.id, { action: 'complete', revision: 4 });
    assert.equal(app.workflow.stock().stock[key].soldUnits, 23);
    assert.equal(app.workflow.stock().stock[key].reservedUnits, 0);
    assert.throws(() => app.workflow.update(admin, order.id, { action: 'complete', revision: 4 }));
    assert.equal(app.workflow.stock().stock[key].soldUnits, 23);
    const available = app.workflow.stock().stock[key];
    app.workflow.setStock(admin, { key, available: 500, revision: available.revision });
    assert.equal(
      app.workflow.stock().stock[key].soldUnits,
      23,
      'pengisian stok tidak mengubah penjualan',
    );
    const edited = app.catalog.snapshot();
    edited.edits
      .find((entry) => entry.groupId === 'snack-pedas')
      .variants.find((entry) => entry.id === 'METRIC-PACK').unitsPerPackage = '20';
    app.catalog.save(edited);
    assert.equal(
      app.workflow.stock().stock[key].soldUnits,
      23,
      'ukuran isi kemasan saat pesanan dibuat tetap dipakai',
    );
    const expiring = app.workflow.create(
      bob,
      input(app, { items: [{ id: 'METRIC-PACK', quantity: 1, expectedPrice: 150000 }] }),
    );
    approve(app, expiring);
    assert.equal(app.workflow.stock().stock[key].reservedUnits, 20);
    time += 86400001;
    app.workflow.tick();
    assert.equal(app.workflow.stock().stock[key].available, 500);
    assert.equal(app.workflow.stock().stock[key].reservedUnits, 0);
    assert.equal(app.workflow.stock().stock[key].soldUnits, 23);
    const cod = app.workflow.create(bob, input(app, { paymentId: 'cod' }));
    approve(app, cod);
    app.workflow.update(admin, cod.id, {
      action: 'ship',
      revision: 2,
      courier: 'Kurir COD',
      trackingNumber: 'COD-001',
    });
    app.workflow.update(admin, cod.id, { action: 'complete', revision: 3 });
    assert.equal(app.workflow.stock().stock[key].soldUnits, 24);
    assert.equal(app.workflow.stock().stock[key].available, 499);
    const payload = (await request(app, 'GET', '/api/inventory', undefined, null)).body;
    assert.equal(payload.stock[key].soldUnits, undefined);
    assert.equal(payload.stock[key].reservedUnits, undefined);
    assert.doesNotMatch(
      JSON.stringify(payload),
      /Alice|Alamat|recipient|userId|METRIC-PAID|METRIC-SHIP|requestKey/,
    );
  } finally {
    app.db.close();
  }
});

test('checkout memakai harga/ongkir server, idempotensi, stok bersama Satuan/Pack/Dus dan pembatalan tepat sekali', async () => {
  const app = createApp({ legacyCommerceFixture: true, dbPath: ':memory:' });
  users(app);
  try {
    const catalog = app.catalog.snapshot();
    const { draft, variant, key } = product(app);
    const edited = catalog.edits.find((row) => row.groupId === draft.groupId);
    edited.variants.push({
      ...variant,
      id: 'SERVER-PACK10',
      packagingType: 'pack',
      unitsPerPackage: '10',
      price: '150000',
      oldPrice: '',
    });
    edited.variants.push({
      ...variant,
      id: 'SERVER-DUS40',
      packagingType: 'dus',
      unitsPerPackage: '40',
      price: '450000',
      oldPrice: '',
    });
    app.catalog.save(catalog);
    const body = input(app, {
      items: [
        { id: variant.id, quantity: 9, expectedPrice: Number(variant.price) },
        { id: 'SERVER-PACK10', quantity: 3, expectedPrice: 150000 },
        { id: 'SERVER-DUS40', quantity: 2, expectedPrice: 450000 },
      ],
      total: 1,
      shipping: { cost: 0 },
    });
    const created = await request(app, 'POST', '/api/orders', body);
    assert.equal(created.status, 201);
    let order = created.body.order;
    assert.equal(app.workflow.stock().stock[key].available, 120);
    order = approve(app, order);
    assert.equal(order.subtotal, 9 * Number(variant.price) + 3 * 150000 + 2 * 450000);
    assert.equal(order.total, order.subtotal + 10000);
    assert.deepEqual(order.inventory, [{ key, units: 119 }]);
    assert.equal(app.workflow.stock().stock[key].available, 1);
    assert.equal(
      (
        await request(app, 'PUT', '/api/orders/' + order.id, {
          action: 'paid',
          revision: 2,
          reference: 'CUSTOMER-FAKE',
        })
      ).status,
      403,
      'pelanggan demo juga tidak dapat membuat pembayaran server dianggap lunas',
    );
    const repeated = await request(app, 'POST', '/api/orders', body);
    assert.equal(repeated.body.order.id, order.id);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 1);
    assert.equal(app.workflow.stock().stock[key].available, 1);
    assert.equal(
      (await request(app, 'POST', '/api/orders', { ...body, note: 'Different' })).status,
      409,
    );
    assert.equal(
      (
        await request(
          app,
          'POST',
          '/api/orders',
          input(app, {
            items: [{ id: variant.id, quantity: 2, expectedPrice: Number(variant.price) }],
          }),
          bob,
        )
      ).status,
      409,
    );
    const cancelled = await request(app, 'PUT', '/api/orders/' + order.id, {
      action: 'cancel',
      revision: 2,
      reason: 'Berubah pikiran',
    });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.order.status, 'cancelled');
    assert.equal(app.workflow.stock().stock[key].available, 120);
    assert.equal(
      (
        await request(app, 'PUT', '/api/orders/' + order.id, {
          action: 'cancel',
          revision: 2,
          reason: 'Ulang',
        })
      ).status,
      409,
    );
    assert.equal(app.workflow.stock().stock[key].available, 120);
    const nextCatalog = app.catalog.snapshot();
    nextCatalog.edits
      .find((row) => row.groupId === draft.groupId)
      .variants.push({ ...variant, id: 'SERVER-NEW-SIZE', sizeValue: '190', oldPrice: '' });
    app.catalog.save(nextCatalog);
    assert.equal(
      app.workflow.stock().stock['snack-pedas:190-g'].available,
      0,
      'ukuran baru selalu dimulai tanpa stok, termasuk pada instalasi BAM lama',
    );
  } finally {
    app.db.close();
  }
});
test('akses akun, admin, harga palsu, kegagalan sebagian keranjang dan versi stok dilindungi server', async () => {
  const app = createApp({ legacyCommerceFixture: true, dbPath: ':memory:' });
  users(app);
  try {
    const { key } = product(app);
    const body = input(app);
    const before = app.workflow.stock();
    assert.equal((await request(app, 'GET', '/api/inventory', undefined, null)).status, 200);
    assert.equal((await request(app, 'POST', '/api/orders', body, null)).status, 401);
    assert.equal(
      (
        await request(app, 'POST', '/api/orders', {
          ...body,
          items: [{ ...body.items[0], expectedPrice: 1 }],
        })
      ).status,
      409,
    );
    assert.deepEqual(app.workflow.stock(), before);
    assert.equal(
      (await request(app, 'PUT', '/api/admin/inventory', { key, available: 1, revision: 0 }))
        .status,
      403,
    );
    assert.equal(
      (
        await request(
          app,
          'PUT',
          '/api/admin/inventory',
          { key, available: 1, revision: 0 },
          admin,
          { origin: 'https://other.test' },
        )
      ).status,
      403,
    );
    const adjusted = await request(
      app,
      'PUT',
      '/api/admin/inventory',
      { key, available: 1, revision: 0 },
      admin,
    );
    assert.equal(adjusted.status, 200);
    assert.equal(
      (
        await request(
          app,
          'PUT',
          '/api/admin/inventory',
          { key, available: 99, revision: 0 },
          admin,
        )
      ).status,
      409,
    );
    assert.equal(app.workflow.stock().stock[key].available, 1);
    const beforeFailure = app.workflow.stock();
    const eventCount = app.db.prepare('SELECT COUNT(*) AS n FROM inventory_events').get().n;
    const failed = await request(app, 'POST', '/api/orders', {
      ...body,
      items: [body.items[0], { id: 'missing', quantity: 1, expectedPrice: 1 }],
    });
    assert.equal(failed.status, 409);
    assert.deepEqual(app.workflow.stock(), beforeFailure);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM inventory_events').get().n, eventCount);
    const created = (await request(app, 'POST', '/api/orders', body)).body.order;
    assert.equal(
      (await request(app, 'GET', '/api/orders/' + created.id, undefined, bob)).status,
      404,
    );
    assert.equal(
      (
        await request(
          app,
          'PUT',
          '/api/orders/' + created.id,
          { action: 'cancel', revision: 0 },
          bob,
        )
      ).status,
      404,
    );
    assert.equal((await request(app, 'GET', '/api/orders', undefined, bob)).body.orders.length, 0);
    assert.equal((await request(app, 'GET', '/api/admin/orders', undefined, bob)).status, 403);
    assert.equal(
      (await request(app, 'GET', '/api/admin/orders', undefined, admin)).body.orders.length,
      1,
    );
    assert.equal(
      (
        await request(app, 'PUT', '/api/orders/' + created.id, {
          action: 'ship',
          revision: 0,
          courier: 'JNE',
          trackingNumber: '123',
        })
      ).status,
      403,
    );
  } finally {
    app.db.close();
  }
});
test('batas pembayaran memakai waktu server; kedaluwarsa melepas stok sekali dan tetap setelah restart', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bam-workflow-expiry-'));
  const dbPath = join(dir, 'test.sqlite');
  let time = 1700000000000;
  let app = createApp({ legacyCommerceFixture: true, dbPath, now: () => time });
  users(app);
  try {
    const { key } = product(app);
    const order = approve(app, app.workflow.create(alice, input(app)));
    time += 86400001;
    app.workflow.tick();
    assert.equal(app.workflow.get(alice, order.id).status, 'expired');
    assert.equal(app.workflow.stock().stock[key].available, 120);
    app.workflow.tick();
    const events = app.db
      .prepare("SELECT COUNT(*) AS n FROM inventory_events WHERE action='expire'")
      .get().n;
    assert.equal(events, 1);
    app.db.close();
    app = createApp({ legacyCommerceFixture: true, dbPath, now: () => time });
    assert.equal(app.workflow.get(alice, order.id).status, 'expired');
    assert.equal(app.workflow.stock().stock[key].available, 120);
    assert.equal(
      app.db.prepare("SELECT COUNT(*) AS n FROM inventory_events WHERE action='expire'").get().n,
      1,
    );
  } finally {
    app.db.close();
    clean(dir);
  }
});
test('perusahaan: stok awal 0; pembayaran manual hanya admin; snapshot foto/harga/kemasan tetap setelah katalog diubah', async () => {
  const seed = createApp({ legacyCommerceFixture: true, dbPath: ':memory:' });
  const snapshot = seed.catalog.snapshot();
  seed.db.close();
  const app = createApp({ legacyCommerceFixture: true, dbPath: ':memory:', installMode: 'company' });
  users(app);
  try {
    app.catalog.save({ ...snapshot, revision: 0 });
    const { key } = product(app);
    assert.equal(app.workflow.stock().stock[key].available, 0);
    const updated = app.catalog.snapshot();
    updated.edits.find((draft) => draft.groupId === 'snack-pedas').gallery = [
      { src: png, alt: 'Foto pesanan awal' },
    ];
    app.catalog.save(updated);
    app.workflow.setStock(admin, { key, available: 40, revision: 0 });
    const order = approve(app, app.workflow.create(alice, input(app)));
    assert.equal(
      (await request(app, 'PUT', '/api/orders/' + order.id, { action: 'paid', revision: 2 }))
        .status,
      403,
    );
    assert.equal(
      (await request(app, 'PUT', '/api/orders/' + order.id, { action: 'paid', revision: 2 }, admin))
        .status,
      422,
    );
    const paid = await request(
      app,
      'PUT',
      '/api/orders/' + order.id,
      { action: 'paid', revision: 2, reference: 'BANK-2026-001' },
      admin,
    );
    assert.equal(paid.status, 200);
    assert.equal(paid.body.order.payment.recordedBy, admin.id);
    assert.equal(
      (
        await request(app, 'PUT', '/api/orders/' + order.id, {
          action: 'cancel',
          revision: 2,
          reason: 'Batal',
        })
      ).status,
      409,
    );
    const shipped = await request(
      app,
      'PUT',
      '/api/orders/' + order.id,
      { action: 'ship', revision: 3, courier: 'JNE', trackingNumber: 'RESI-001' },
      admin,
    );
    assert.equal(shipped.status, 200);
    assert.equal(
      (
        await request(
          app,
          'PUT',
          '/api/orders/' + order.id,
          { action: 'complete', revision: 4 },
          admin,
        )
      ).body.order.status,
      'completed',
    );
    assert.equal(app.workflow.stock().stock[key].available, 39);
    const latest = app.catalog.snapshot();
    const draft = latest.edits.find((row) => row.groupId === 'snack-pedas');
    draft.baseName = 'Nama terbaru';
    draft.gallery = [];
    draft.image = '';
    draft.variants.find((row) => row.id === 'snack-pedas').price = '99999';
    draft.variants.find((row) => row.id === 'snack-pedas').oldPrice = '';
    app.catalog.save(latest);
    const preserved = app.workflow.get(alice, order.id);
    assert.equal(preserved.items[0].price, order.items[0].price);
    assert.equal(preserved.items[0].details.name, order.items[0].details.name);
    assert.deepEqual(preserved.items[0].details.packaging, order.items[0].details.packaging);
    const imagePath = order.items[0].details.image;
    assert.ok(imagePath.startsWith('/api/orders/'));
    assert.equal((await request(app, 'GET', imagePath)).body.toString('base64'), png.split(',')[1]);
    assert.equal((await request(app, 'GET', imagePath, undefined, bob)).status, 404);
  } finally {
    app.db.close();
  }
});
test('paginasi riwayat mempertahankan batas akun; stok terakhir hanya dapat dipesan sekali oleh proses bersamaan', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'bam-workflow-concurrent-'));
  const dbPath = join(dir, 'test.sqlite');
  const app = createApp({ legacyCommerceFixture: true, dbPath });
  users(app);
  try {
    const { key } = product(app);
    app.workflow.setStock(admin, { key, available: 1, revision: 0 });
    const task = (body) =>
      new Promise((resolve, reject) => {
        const worker = new Worker(
          `const { parentPort, workerData } = require('node:worker_threads');
          (async () => {
            const { createApp } = await import(workerData.module);
            const app = createApp({ legacyCommerceFixture: true, dbPath: workerData.dbPath });
            try {
              let order = app.workflow.create(workerData.user, workerData.body);
              if (['awaiting_review', 'awaiting_confirmation'].includes(order.status)) {
                try {
                  order = app.workflow.update({ id: 'admin', role: 'admin' }, order.id, {
                    action: order.payment.groupId === 'cod' ? 'confirm_cod' : 'approve_payment',
                    revision: order.revision, shippingCost: 10000, courier: 'Fixture'
                  });
                } catch (error) {
                  // Another worker may have approved this same idempotent request.
                  // A revision conflict is expected only if the stored order has advanced.
                  if (error.code !== 'revision_conflict') throw error;
                  const latest = app.workflow.get(workerData.user, order.id);
                  if (latest.revision <= order.revision || latest.status !== 'awaiting_acceptance') throw error;
                  order = latest;
                }
              }
              if (order.status === 'cancelled') parentPort.postMessage({ code: 'insufficient_stock' });
              else parentPort.postMessage({ id: order.id });
            } catch (error) {
              parentPort.postMessage({ code: error.code, message: error.message });
            } finally { app.db.close(); }
          })().catch(error => { throw error; });`,
          {
            eval: true,
            workerData: {
              module: new URL('./app.js', import.meta.url).href,
              dbPath,
              user: alice,
              body,
            },
          },
        );
        worker.on('message', resolve);
        worker.on('error', reject);
        worker.on('exit', (code) => {
          if (code) reject(new Error('worker failed'));
        });
      });
    const results = await Promise.all(Array.from({ length: 4 }, () => task(input(app))));
    assert.equal(results.filter((row) => row.id).length, 1, JSON.stringify(results));
    assert.equal(app.workflow.stock().stock[key].available, 0);
    const current = app.workflow.stock().stock[key];
    app.workflow.setStock(admin, { key, available: 1, revision: current.revision });
    const same = input(app);
    const retries = await Promise.all(Array.from({ length: 3 }, () => task(same)));
    assert.equal(new Set(retries.map((row) => row.id)).size, 1, JSON.stringify(retries));
    assert.ok(retries.every((row) => row.id));
    assert.equal(app.workflow.stock().stock[key].available, 0);
    const next = app.workflow.stock().stock[key];
    app.workflow.setStock(admin, { key, available: 60, revision: next.revision });
    const beforePagination = app.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n;
    for (let i = 0; i < 52; i++) {
      const order = app.workflow.create(i % 2 ? alice : bob, input(app, { paymentId: 'cod' }));
      approve(app, order);
      // Advance fixture request history; rate limiting is covered separately.
      app.db.prepare('DELETE FROM checkout_limits WHERE bucket LIKE ?').run('account:%');
    }
    const all = app.workflow.list(admin, { admin: true });
    assert.equal(all.orders.length, 50);
    assert.ok(all.nextCursor);
    const remaining = app.workflow.list(admin, { admin: true, before: all.nextCursor });
    assert.equal(remaining.orders.length, beforePagination + 52 - 50);
    assert.equal(
      new Set([...all.orders, ...remaining.orders].map((row) => row.id)).size,
      beforePagination + 52,
    );
    assert.ok(app.workflow.list(bob).orders.every((row) => row.userId === bob.id));
  } finally {
    app.db.close();
    clean(dir);
  }
});

test('impor stok lama harus admin, valid secara utuh dan hanya sebelum stok atau pesanan server digunakan', async () => {
  const app = createApp({ legacyCommerceFixture: true, dbPath: ':memory:' });
  users(app);
  try {
    const { key } = product(app);
    const stock = app.workflow.stock();
    const body = { rows: [{ key, available: 119, revision: 0 }] };
    assert.equal((await request(app, 'POST', '/api/admin/inventory/import', body)).status, 403);
    assert.equal(
      (
        await request(
          app,
          'POST',
          '/api/admin/inventory/import',
          { rows: [...body.rows, { key: 'missing', available: 1, revision: 0 }] },
          admin,
        )
      ).status,
      422,
    );
    assert.deepEqual(app.workflow.stock(), stock);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM workflow_migrations').get().n, 0);
    assert.equal(
      (await request(app, 'POST', '/api/admin/inventory/import', body, admin)).status,
      200,
    );
    assert.equal(app.workflow.stock().stock[key].available, 119);
    assert.equal(app.workflow.stock().canImportPreview, false);
    assert.equal(
      (await request(app, 'POST', '/api/admin/inventory/import', body, admin)).status,
      409,
    );
    assert.equal(app.workflow.stock().stock[key].available, 119);
  } finally {
    app.db.close();
  }
});
