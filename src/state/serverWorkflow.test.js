import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../server/app.js';
import {
  configureWorkflowSession,
  serverWorkflowSnapshot,
  createServerOrder,
  fetchServerOrder,
  refreshServerWorkflow,
  searchServerOrders,
} from './serverWorkflow.js';

test('angka penjualan tidak valid membuat stok gagal dimuat; server lama tetap dapat mengirim stok tanpa statistik', async () => {
  const previousFetch = globalThis.fetch;
  let metrics = { soldUnits: -1, reservedUnits: 0 };
  try {
    globalThis.fetch = async (path) => ({
      ok: true,
      json: async () =>
        path === '/api/inventory'
          ? { version: 1, stock: { 'test:1-pcs': { available: 7, revision: 0, ...metrics } } }
          : { version: 1, orders: [], nextCursor: null },
    });
    await configureWorkflowSession(null);
    assert.equal(serverWorkflowSnapshot().failed, true);
    assert.deepEqual(serverWorkflowSnapshot().stock, {});
    metrics = {};
    await configureWorkflowSession(null);
    assert.equal(serverWorkflowSnapshot().failed, false);
    assert.equal(serverWorkflowSnapshot().stock['test:1-pcs'].available, 7);
    assert.equal(serverWorkflowSnapshot().stock['test:1-pcs'].soldUnits, undefined);
    metrics = { soldUnits: 3, reservedUnits: 2 };
    await configureWorkflowSession(null);
    assert.equal(serverWorkflowSnapshot().stock['test:1-pcs'].soldUnits, 3);
    assert.equal(serverWorkflowSnapshot().stock['test:1-pcs'].reservedUnits, 2);
  } finally {
    await configureWorkflowSession(null, true);
    globalThis.fetch = previousFetch;
  }
});

test('respons pesanan yang terlambat dari akun sebelumnya tidak tampil setelah akun berganti', async () => {
  const app = createApp({ dbPath: ':memory:' });
  const oldFetch = globalThis.fetch;
  const first = { id: 'first', role: 'user' };
  const second = { id: 'second', role: 'user' };
  try {
    for (const user of [first, second]) {
      app.db
        .prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)')
        .run(
          user.id,
          'Akun ' + user.id,
          user.id + '@fixture.test',
          'Alamat fixture lengkap',
          'fixture-not-for-login',
          new Date().toISOString(),
          'user',
        );
      app.db
        .prepare('INSERT OR REPLACE INTO auth_account_state(user_id,verified_at) VALUES(?,1)')
        .run(user.id);
      app.workflow.create(user, {
        requestKey: randomUUID(),
        recipient: 'Penerima ' + user.id,
        address: 'Alamat penerima ' + user.id + ' lengkap',
        shippingId: 'regular',
        paymentId: 'cod',
        note: '',
        items: [{ id: 'snack-pedas', quantity: 1, expectedPrice: 18000 }],
      });
    }
    let user = first;
    let release;
    globalThis.fetch = async (path) => {
      const current = user;
      const payload = path === '/api/inventory' ? app.workflow.stock() : app.workflow.list(current);
      if (path === '/api/orders' && current.id === first.id)
        await new Promise((resolve) => {
          release = resolve;
        });
      return { ok: true, json: async () => payload };
    };
    const delayed = configureWorkflowSession(first);
    assert.ok(release);
    user = second;
    await configureWorkflowSession(second);
    assert.equal(serverWorkflowSnapshot().owner, second.id);
    assert.ok(serverWorkflowSnapshot().orders.every((order) => order.userId === second.id));
    release();
    await delayed;
    assert.equal(serverWorkflowSnapshot().owner, second.id);
    assert.equal(serverWorkflowSnapshot().orders.length, 1);
    assert.ok(serverWorkflowSnapshot().orders.every((order) => order.userId === second.id));
    assert.ok(
      Object.values(serverWorkflowSnapshot().details).every((order) => order.userId === second.id),
    );
  } finally {
    await configureWorkflowSession(null, true);
    globalThis.fetch = oldFetch;
    app.db.close();
  }
});

test('checkout yang belum diketahui hasilnya memakai nomor permintaan sama meski form diedit; pesanan baru dimulai setelah hasil sebelumnya diperiksa', async () => {
  const app = createApp({ dbPath: ':memory:' });
  const oldFetch = globalThis.fetch;
  const oldWindow = globalThis.window;
  const user = { id: 'owner', role: 'user' };
  app.db
    .prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)')
    .run(
      user.id,
      'Owner Fixture',
      'owner@fixture.test',
      'Alamat owner lengkap',
      'fixture-not-for-login',
      new Date().toISOString(),
      'user',
    );
  const values = new Map();
  globalThis.window = {
    sessionStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  };
  let lost = true;
  const keys = [];
  globalThis.fetch = async (path, options = {}) => {
    app.db
      .prepare('INSERT OR REPLACE INTO auth_account_state(user_id,verified_at) VALUES(?,1)')
      .run(user.id);
    try {
      let payload;
      if (path === '/api/inventory') payload = app.workflow.stock();
      else if (path === '/api/orders' && options.method === 'POST') {
        const body = JSON.parse(options.body);
        keys.push(body.requestKey);
        payload = { order: app.workflow.create(user, body) };
        if (lost) {
          lost = false;
          throw new Error('connection lost');
        }
      } else if (path === '/api/orders') payload = app.workflow.list(user);
      else payload = { order: app.workflow.get(user, path.split('/').at(-1)) };
      return { ok: true, json: async () => payload };
    } catch (error) {
      if (!error.status) throw error;
      return {
        ok: false,
        status: error.status,
        json: async () => ({ errors: { form: error.message } }),
      };
    }
  };
  try {
    await configureWorkflowSession(user);
    const input = {
      cart: [{ id: 'snack-pedas', quantity: 1, price: 18000 }],
      recipient: 'Penerima Fixture',
      address: 'Alamat awal penerima lengkap',
      shipping: { id: 'regular' },
      payment: { id: 'cod' },
      note: '',
    };
    await assert.rejects(createServerOrder(input), /Periksa Pesanan saya/);
    const changed = { ...input, address: 'Alamat pengganti yang lengkap' };
    await assert.rejects(createServerOrder(changed), /Periksa Pesanan saya/);
    assert.equal(keys[0], keys[1]);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 1);
    const previous = app.workflow.list(user).orders[0];
    await fetchServerOrder(previous.id);
    const second = await createServerOrder(changed);
    assert.notEqual(second.id, previous.id);
    assert.notEqual(keys[2], keys[0]);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 2);
  } finally {
    await configureWorkflowSession(null, true);
    globalThis.fetch = oldFetch;
    globalThis.window = oldWindow;
    app.db.close();
  }
});
import { serverStock } from './serverWorkflow.js';

test('inventory and order failures are independent; loading and delayed responses never restore a previous session', async () => {
  const oldFetch = globalThis.fetch;
  let failedPath = '/api/admin/orders';
  let release;
  try {
    globalThis.fetch = async (path) => {
      if (path === '/api/orders' && release === 'hold')
        await new Promise((resolve) => {
          release = resolve;
        });
      return {
        ok: path !== failedPath,
        status: path === failedPath ? 503 : 200,
        json: async () =>
          path === failedPath
            ? { errors: { form: 'Gangguan sementara' } }
            : path.includes('inventory')
              ? { version: 1, stock: { 'test:1-pcs': { available: 27, revision: 0 } } }
              : { version: 1, orders: [], nextCursor: null, total: 0 },
      };
    };
    await configureWorkflowSession({ id: 'owner', role: 'admin' });
    assert.equal(serverWorkflowSnapshot().adminOrdersFailed, true);
    assert.equal(serverWorkflowSnapshot().inventoryFailed, false);
    assert.equal(serverStock({ id: 'test', sizeValue: '1', sizeUnit: 'pcs' }).available, 27);
    failedPath = '/api/admin/inventory';
    await refreshServerWorkflow();
    assert.equal(serverWorkflowSnapshot().adminOrdersFailed, false);
    assert.equal(serverWorkflowSnapshot().inventoryFailed, true);
    assert.throws(() => serverStock({ id: 'test', sizeValue: '1', sizeUnit: 'pcs' }), /Gangguan/);
    failedPath = '';
    release = 'hold';
    const delayed = configureWorkflowSession({ id: 'old', role: 'user' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(
      serverWorkflowSnapshot().inventoryLoading,
      false,
      'stock becomes available while orders still load',
    );
    assert.equal(serverWorkflowSnapshot().loading, true);
    const finish = release;
    await configureWorkflowSession(null);
    finish();
    await delayed;
    assert.equal(serverWorkflowSnapshot().owner, 'guest');
    assert.deepEqual(serverWorkflowSnapshot().orders, []);
    let finishSearch;
    globalThis.fetch = async () => {
      await new Promise((resolve) => {
        finishSearch = resolve;
      });
      return {
        ok: true,
        json: async () => ({ version: 1, orders: [], nextCursor: null, total: 0 }),
      };
    };
    const search = searchServerOrders({ q: 'old' });
    await configureWorkflowSession({ id: 'new', role: 'user' }, true);
    finishSearch();
    await assert.rejects(search, /Akun berubah/);
  } finally {
    await configureWorkflowSession(null, true);
    globalThis.fetch = oldFetch;
  }
});
import { purchaseStockLabel, soldStockLabel } from '../data/productStockPresentation.js';
test('hidden stock preserves availability per package and rounded sales; missing SKU data fails closed', async () => {
  const old = globalThis.fetch;
  const pack = {
    id: 'pack',
    groupId: 'test',
    sizeValue: '1',
    sizeUnit: 'pcs',
    packagingType: 'pack',
    unitsPerPackage: 6,
  };
  let payload = {
    version: 1,
    stock: { 'test:1-pcs': { inStock: true, revision: 0 } },
    skuAvailability: { unit: true, pack: false },
    publishedSales: { test: 10 },
  };
  try {
    globalThis.fetch = async () => ({ ok: true, json: async () => payload });
    await configureWorkflowSession(null);
    const stock = serverStock(pack);
    assert.equal(stock.available, null);
    assert.equal(stock.inStock, false);
    assert.equal(purchaseStockLabel(pack, stock), 'Habis');
    assert.equal(soldStockLabel(stock), '10+ terjual');
    const unit = serverStock({ ...pack, id: 'unit', packagingType: 'satuan', unitsPerPackage: 1 });
    assert.equal(unit.inStock, true);
    assert.equal(purchaseStockLabel(pack, unit), 'Tersedia');
    delete payload.skuAvailability;
    await configureWorkflowSession(null);
    assert.equal(serverWorkflowSnapshot().failed, true);
    assert.throws(() => serverStock(pack));
  } finally {
    await configureWorkflowSession(null, true);
    globalThis.fetch = old;
  }
});
