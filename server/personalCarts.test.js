import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { hashPassword } from './app.js';
import { createTestApp as createApp } from './testingHelpers.js';

const password = 'test-password-2026';
async function request(app, method, url, body, cookie = '') {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  req.method = method;
  req.url = url;
  req.headers = {
    host: 'bam.test',
    origin: 'http://bam.test',
    'content-type': 'application/json',
    cookie,
  };
  let result;
  const res = {
    writeHead(status, headers) {
      result = { status, headers };
    },
    end(value) {
      result.body = value ? JSON.parse(value) : null;
    },
  };
  await app.handler(req, res);
  return result;
}
async function login(app, id, email) {
  app.db
    .prepare(
      'INSERT INTO users(id,name,email,address,password_hash,created_at,role) VALUES(?,?,?,?,?,?,?)',
    )
    .run(
      id,
      'Pembeli ' + id,
      email,
      'Alamat lengkap pembeli',
      await hashPassword(password),
      new Date().toISOString(),
      'user',
    );
  const response = await request(app, 'POST', '/api/auth/login', { email, password });
  assert.equal(response.status, 200);
  return response.headers['set-cookie'].split(';')[0];
}
const item = (id, quantity = 1) => ({ id, name: 'Produk ' + id, price: 12000, quantity });

test('keranjang pribadi tersimpan per akun dan terbaca dari perangkat lain', async () => {
  const app = createApp({ dbPath: ':memory:' });
  try {
    assert.equal((await request(app, 'GET', '/api/cart')).status, 401);
    const phone = await login(app, 'buyer-a', 'a@test.id');
    const empty = await request(app, 'GET', '/api/cart', undefined, phone);
    assert.equal(empty.status, 200);
    assert.deepEqual(
      { revision: empty.body.revision, cart: empty.body.cart, favoriteIds: empty.body.favoriteIds },
      { revision: 0, cart: [], favoriteIds: [] },
    );
    const saved = await request(
      app,
      'PUT',
      '/api/cart',
      { revision: 0, cart: [item('SKU-1', 2)], favoriteIds: ['SKU-9'] },
      phone,
    );
    assert.equal(saved.status, 200);
    assert.equal(saved.body.revision, 1);
    // A second session (another device) of the same account sees the same cart.
    const laptop = (
      await request(app, 'POST', '/api/auth/login', { email: 'a@test.id', password })
    ).headers['set-cookie'].split(';')[0];
    const other = await request(app, 'GET', '/api/cart', undefined, laptop);
    assert.deepEqual(other.body.cart, [item('SKU-1', 2)]);
    assert.deepEqual(other.body.favoriteIds, ['SKU-9']);
    // Another account never sees it.
    const stranger = await login(app, 'buyer-b', 'b@test.id');
    assert.deepEqual((await request(app, 'GET', '/api/cart', undefined, stranger)).body.cart, []);
  } finally {
    app.db.close();
  }
});

test('keranjang pribadi: revisi lama ditolak dengan isi terbaru, data tidak valid dibersihkan', async () => {
  const app = createApp({ dbPath: ':memory:' });
  try {
    const cookie = await login(app, 'buyer-a', 'a@test.id');
    await request(
      app,
      'PUT',
      '/api/cart',
      { revision: 0, cart: [item('SKU-1')], favoriteIds: [] },
      cookie,
    );
    const stale = await request(
      app,
      'PUT',
      '/api/cart',
      { revision: 0, cart: [item('SKU-2')], favoriteIds: [] },
      cookie,
    );
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error, 'cart_conflict');
    assert.deepEqual(stale.body.current.cart, [item('SKU-1')]);
    assert.equal(stale.body.current.revision, 1);
    const cleaned = await request(
      app,
      'PUT',
      '/api/cart',
      {
        revision: 1,
        cart: [item('SKU-1', 3), { id: 'bad', name: '', price: -1, quantity: 0 }, item('SKU-1', 5)],
        favoriteIds: ['SKU-1', 'SKU-1', 42],
      },
      cookie,
    );
    assert.equal(cleaned.status, 200);
    assert.deepEqual(cleaned.body.cart, [item('SKU-1', 3)]);
    assert.deepEqual(cleaned.body.favoriteIds, ['SKU-1']);
    // Non-object bodies are refused by the shared JSON guard before reaching the cart.
    assert.equal((await request(app, 'PUT', '/api/cart', null, cookie)).status, 400);
    for (const invalid of [
      { revision: -1, cart: [], favoriteIds: [] },
      { revision: 2, cart: 'x', favoriteIds: [] },
    ])
      assert.equal((await request(app, 'PUT', '/api/cart', invalid, cookie)).status, 422);
    assert.equal((await request(app, 'GET', '/api/cart', undefined, cookie)).body.revision, 2);
  } finally {
    app.db.close();
  }
});
