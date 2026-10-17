import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app.js';

function seed(app) {
  for (const [id, role] of [
    ['owner', 'admin'],
    ['operator', 'admin'],
    ['buyer', 'user'],
    ['sales', 'user'],
    ['other', 'user'],
    ['disabled', 'user'],
    ['pending', 'user'],
  ]) {
    app.db
      .prepare(
        'INSERT INTO users(id,name,email,address,password_hash,created_at,role) VALUES(?,?,?,?,?,?,?)',
      )
      .run(
        id,
        'Akun ' + id,
        id + '@fixture.test',
        'Alamat lengkap pengujian',
        'unused',
        '2026-10-17',
        role,
      );
    const token = id.padEnd(43, 'x');
    app.db
      .prepare('INSERT INTO sessions VALUES(?,?,?)')
      .run(createHash('sha256').update(token).digest('hex'), id, Date.now() + 60000);
  }
  app.db
    .prepare('INSERT INTO store_owners(user_id,granted_at) VALUES(?,?)')
    .run('owner', '2026-10-17');
  app.db.prepare('INSERT INTO account_access(user_id,disabled_at) VALUES(?,?)').run('disabled', 1);
  app.db
    .prepare('INSERT INTO account_approvals(user_id,status) VALUES(?,?)')
    .run('pending', 'pending');
}
async function request(app, method, url, actor, body, origin = 'http://fixture.test') {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  Object.assign(req, {
    method,
    url,
    socket: { remoteAddress: '192.0.2.1' },
    headers: {
      host: 'fixture.test',
      origin,
      'content-type': 'application/json',
      ...(actor ? { cookie: 'bam_session=' + actor.padEnd(43, 'x') } : {}),
    },
  });
  let result;
  await app.handler(req, {
    writeHead(status) {
      result = { status };
    },
    end(value) {
      result.body = JSON.parse(value);
    },
  });
  return result;
}
const newStore = (storeName = 'Toko Nusantara') => ({
  storeName,
  phone: '081234567890',
  address: 'Jalan Nusantara Nomor 15',
});

test('B2B management API: owner creates, links and appoints; admin reads; buyer cannot read account details or mutate', async () => {
  const app = createApp({ dbPath: ':memory:', logger: () => {} });
  try {
    seed(app);
    for (const path of [
      '/api/b2b/stores?page=1',
      '/api/b2b/accounts',
      '/api/b2b/sales',
      '/api/b2b/stores/missing',
    ])
      assert.equal((await request(app, 'GET', path)).status, 401);
    const created = await request(app, 'POST', '/api/b2b/stores/create', 'owner', newStore());
    assert.equal(created.status, 201);
    const store = created.body.store;
    const path = '/api/b2b/stores/' + store.id;
    assert.equal(store.phone, '+6281234567890');
    assert.equal((await request(app, 'GET', path, 'buyer')).status, 403);
    assert.equal((await request(app, 'GET', '/api/b2b/accounts', 'operator')).status, 403);
    assert.equal((await request(app, 'GET', '/api/b2b/accounts', 'buyer')).status, 403);
    assert.equal(
      (await request(app, 'POST', '/api/b2b/stores/create', 'operator', newStore())).status,
      403,
    );
    assert.equal(
      (await request(app, 'POST', path + '/members', 'buyer', { userId: 'buyer' })).status,
      403,
    );
    assert.equal(
      (await request(app, 'POST', path + '/members', 'owner', { userId: 'buyer' })).status,
      200,
    );
    assert.equal(
      (await request(app, 'POST', '/api/b2b/sales/appoint', 'owner', { userId: 'sales' })).status,
      200,
    );
    assert.equal(
      (await request(app, 'POST', path + '/sales', 'operator', { userId: 'sales' })).status,
      403,
    );
    assert.equal(
      (await request(app, 'POST', path + '/sales', 'owner', { userId: 'sales' })).status,
      200,
    );
    const detail = await request(app, 'GET', path, 'operator');
    assert.equal(detail.status, 200);
    assert.deepEqual(
      detail.body.members.map((row) => row.id),
      ['buyer'],
    );
    assert.deepEqual(
      detail.body.sales.map((row) => row.id),
      ['sales'],
    );
    assert.equal(detail.body.members[0].password_hash, undefined);
    assert.equal((await request(app, 'GET', '/api/b2b/stores/missing', 'operator')).status, 404);
    assert.equal(
      (
        await request(
          app,
          'POST',
          path + '/members',
          'owner',
          { userId: 'buyer' },
          'https://foreign.test',
        )
      ).status,
      403,
    );
    assert.equal((await request(app, 'GET', path, 'disabled')).status, 401);
    assert.equal((await request(app, 'GET', path, 'pending')).status, 401);
    const candidates = await request(app, 'GET', '/api/b2b/accounts?page=1', 'owner');
    assert.equal(candidates.status, 200);
    assert.deepEqual(
      candidates.body.users.map((row) => row.id),
      ['buyer', 'other'],
    );
    assert.equal(candidates.body.users[0].memberStores, 1);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM b2b_store_audit').get().n, 4);
  } finally {
    app.db.close();
  }
});

test('B2B management search spans all pages, treats wildcard text literally and keeps buyer/sales scope', async () => {
  const app = createApp({ dbPath: ':memory:', logger: () => {} });
  try {
    seed(app);
    const owner = { id: 'owner', role: 'admin' };
    for (let i = 0; i < 30; i++)
      app.b2bStores.create(owner, newStore('Toko ' + String(i).padStart(2, '0')));
    const target = app.b2bStores.create(owner, newStore('Zebra %_ Nusantara'));
    app.b2bStores.addMember(owner, target.id, 'buyer');
    app.b2bStores.appointSales(owner, 'sales');
    app.b2bStores.assignSales(owner, target.id, 'sales');
    for (const actor of ['owner', 'operator']) {
      const first = (await request(app, 'GET', '/api/b2b/stores?page=1', actor)).body;
      const second = (await request(app, 'GET', '/api/b2b/stores?page=2', actor)).body;
      assert.equal(first.total, 31);
      assert.equal(first.stores.length, 25);
      assert.equal(second.stores.length, 6);
      assert.equal(new Set([...first.stores, ...second.stores].map((store) => store.id)).size, 31);
      const filtered = (await request(app, 'GET', '/api/b2b/stores?page=1&q=%25_', actor)).body;
      assert.deepEqual(
        filtered.stores.map((store) => store.id),
        [target.id],
      );
    }
    for (const actor of ['buyer', 'sales']) {
      const result = (await request(app, 'GET', '/api/b2b/stores?page=1', actor)).body;
      assert.equal(result.total, 1);
      assert.deepEqual(
        result.stores.map((store) => store.id),
        [target.id],
      );
    }
    assert.equal((await request(app, 'GET', '/api/b2b/stores?page=1', 'other')).body.total, 0);
    assert.equal((await request(app, 'GET', '/api/b2b/stores', 'buyer')).body.stores.length, 1);
    for (let i = 0; i < 30; i++)
      app.db
        .prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)')
        .run(
          'candidate-' + i,
          'Candidate ' + i,
          `candidate-${i}@fixture.test`,
          'Alamat pengujian',
          'unused',
          '2026-10-17',
          'user',
        );
    const accounts = (await request(app, 'GET', '/api/b2b/accounts?page=2&q=Candidate', 'owner'))
      .body;
    assert.equal(accounts.total, 30);
    assert.equal(accounts.users.length, 5);
    assert.equal((await request(app, 'GET', '/api/b2b/stores?page=99', 'owner')).body.page, 2);
    assert.equal(
      (await request(app, 'GET', '/api/b2b/accounts?page=99&q=Candidate', 'owner')).body.page,
      2,
    );
    assert.equal(
      (await request(app, 'GET', '/api/b2b/accounts?page=1&q=%25', 'owner')).body.total,
      0,
    );
    for (const query of [
      'page=0',
      'page=-1',
      'page=1.5',
      'page=100001',
      'page=1&q=' + 'a'.repeat(201),
    ]) {
      assert.equal((await request(app, 'GET', '/api/b2b/stores?' + query, 'owner')).status, 422);
      assert.equal((await request(app, 'GET', '/api/b2b/accounts?' + query, 'owner')).status, 422);
    }
  } finally {
    app.db.close();
  }
});

test('B2B management keeps stores, members and sales after the database is reopened', () => {
  const folder = mkdtempSync(join(tmpdir(), 'bam-b2b-management-'));
  let app;
  try {
    const options = { dbPath: join(folder, 'test.sqlite'), logger: () => {} };
    app = createApp(options);
    seed(app);
    const owner = { id: 'owner', role: 'admin' };
    const store = app.b2bStores.create(owner, newStore());
    app.b2bStores.addMember(owner, store.id, 'buyer');
    app.b2bStores.appointSales(owner, 'sales');
    app.b2bStores.assignSales(owner, store.id, 'sales');
    app.db.close();
    app = createApp(options);
    const details = app.b2bStores.details(owner, store.id);
    assert.equal(details.store.storeCode, store.storeCode);
    assert.deepEqual(
      details.members.map((row) => row.id),
      ['buyer'],
    );
    assert.deepEqual(
      details.sales.map((row) => row.id),
      ['sales'],
    );
  } finally {
    app?.db.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
