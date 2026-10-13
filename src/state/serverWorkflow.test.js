import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../server/app.js';
import { configureWorkflowSession, serverWorkflowSnapshot, createServerOrder, fetchServerOrder } from './serverWorkflow.js';

test('respons pesanan yang terlambat dari akun sebelumnya tidak tampil setelah akun berganti', async () => {
  const app = createApp({ dbPath: ':memory:' }); const oldFetch = globalThis.fetch;
  const first = { id: 'first', role: 'user' }; const second = { id: 'second', role: 'user' };
  try {
    for (const user of [first, second]) {
      app.db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)').run(user.id, 'Akun ' + user.id, user.id + '@fixture.test', 'Alamat fixture lengkap', 'fixture-not-for-login', new Date().toISOString(), 'user');
      app.workflow.create(user, { requestKey: randomUUID(), recipient: 'Penerima ' + user.id, address: 'Alamat penerima ' + user.id + ' lengkap', shippingId: 'regular', paymentId: 'cod', note: '', items: [{ id: 'snack-pedas', quantity: 1, expectedPrice: 18000 }] });
    }
    let user = first; let release;
    globalThis.fetch = async (path) => {
      const current = user;
      const payload = path === '/api/inventory' ? app.workflow.stock() : app.workflow.list(current);
      if (path === '/api/orders' && current.id === first.id) await new Promise((resolve) => { release = resolve; });
      return { ok: true, json: async () => payload };
    };
    const delayed = configureWorkflowSession(first);
    assert.ok(release); user = second; await configureWorkflowSession(second);
    assert.equal(serverWorkflowSnapshot().owner, second.id); assert.ok(serverWorkflowSnapshot().orders.every((order) => order.userId === second.id));
    release(); await delayed;
    assert.equal(serverWorkflowSnapshot().owner, second.id); assert.equal(serverWorkflowSnapshot().orders.length, 1); assert.ok(serverWorkflowSnapshot().orders.every((order) => order.userId === second.id));
    assert.ok(Object.values(serverWorkflowSnapshot().details).every((order) => order.userId === second.id));
  } finally { await configureWorkflowSession(null, true); globalThis.fetch = oldFetch; app.db.close(); }
});

test('checkout yang belum diketahui hasilnya memakai nomor permintaan sama meski form diedit; pesanan baru dimulai setelah hasil sebelumnya diperiksa', async () => {
  const app = createApp({ dbPath: ':memory:' }); const oldFetch = globalThis.fetch; const oldWindow = globalThis.window; const user = { id: 'owner', role: 'user' };
  app.db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)').run(user.id, 'Owner Fixture', 'owner@fixture.test', 'Alamat owner lengkap', 'fixture-not-for-login', new Date().toISOString(), 'user');
  const values = new Map(); globalThis.window = { sessionStorage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) } };
  let lost = true; const keys = [];
  globalThis.fetch = async (path, options = {}) => {
    try {
      let payload;
      if (path === '/api/inventory') payload = app.workflow.stock();
      else if (path === '/api/orders' && options.method === 'POST') {
        const body = JSON.parse(options.body); keys.push(body.requestKey); payload = { order: app.workflow.create(user, body) };
        if (lost) { lost = false; throw new Error('connection lost'); }
      } else if (path === '/api/orders') payload = app.workflow.list(user);
      else payload = { order: app.workflow.get(user, path.split('/').at(-1)) };
      return { ok: true, json: async () => payload };
    } catch (error) {
      if (!error.status) throw error;
      return { ok: false, status: error.status, json: async () => ({ errors: { form: error.message } }) };
    }
  };
  try {
    await configureWorkflowSession(user);
    const input = { cart: [{ id: 'snack-pedas', quantity: 1, price: 18000 }], recipient: 'Penerima Fixture', address: 'Alamat awal penerima lengkap', shipping: { id: 'regular' }, payment: { id: 'va-bca' }, note: '' };
    await assert.rejects(createServerOrder(input), /Periksa Pesanan saya/);
    const changed = { ...input, address: 'Alamat pengganti yang lengkap' };
    await assert.rejects(createServerOrder(changed), /Periksa Pesanan saya/); assert.equal(keys[0], keys[1]); assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 1);
    const previous = app.workflow.list(user).orders[0]; await fetchServerOrder(previous.id);
    const second = await createServerOrder(changed); assert.notEqual(second.id, previous.id); assert.notEqual(keys[2], keys[0]); assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 2);
  } finally { await configureWorkflowSession(null, true); globalThis.fetch = oldFetch; globalThis.window = oldWindow; app.db.close(); }
});
