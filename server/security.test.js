import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { Worker } from 'node:worker_threads';
import { createApp, hashPassword } from './app.js';
import { verifyPassword } from './authSecurity.js';
import { normalizeReservationPolicy, reservationPolicyFromEnv } from './securityPolicy.js';

import { createTestApp } from './testingHelpers.js';
const alice = { id: 'security-alice', role: 'user' };
const bob = { id: 'security-bob', role: 'user' };
const admin = { id: 'security-admin', role: 'admin' };
const policy = {
  maxOpenOrders: 2,
  maxReservedUnits: 12,
  maxUnitsPerStock: 10,
  codConfirmationWindowMs: 1000,
  reviewWindowMs: 1000,
  quoteHoldWindowMs: 1000,
};
function users(app) {
  for (const user of [alice, bob, admin])
    app.db
      .prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)')
      .run(
        user.id,
        user.id,
        user.id + '@test.id',
        'Alamat lengkap pengujian',
        'not-used-for-login',
        '2026-01-01',
        user.role,
      );
  app.db.exec(
    'INSERT OR REPLACE INTO auth_account_state(user_id,verified_at) SELECT id,1 FROM users',
  );
}

function input(app, extra = {}) {
  const draft = app.catalog.snapshot().edits.find((entry) => entry.groupId === 'snack-pedas');
  const variant = draft.variants.find((entry) => entry.id === 'snack-pedas');
  return {
    requestKey: randomUUID(),
    recipient: 'Penerima pengujian',
    address: 'Alamat penerima pengujian lengkap',
    paymentId: 'cod',
    shippingId: 'regular',
    items: [{ id: variant.id, quantity: 1, expectedPrice: Number(variant.price) }],
    ...extra,
  };
}
const key = 'snack-pedas:180-g';
async function request(app, method, path, body, ip = '192.0.2.1', headers = {}) {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  req.method = method;
  req.url = path;
  req.socket = { remoteAddress: ip };
  req.headers = {
    host: 'security.test',
    origin: 'http://security.test',
    'content-type': 'application/json',
    ...headers,
  };
  let result;
  await app.handler(req, {
    writeHead(status, responseHeaders) {
      result = { status, headers: responseHeaders };
    },
    end(value) {
      result.body = JSON.parse(value);
    },
  });
  return result;
}
function clean(directory) {
  const target = realpathSync(directory);
  assert.equal(dirname(target), realpathSync(tmpdir()));
  assert.ok(basename(target).startsWith('bam-security-'));
  rmSync(target, { recursive: true, force: true });
}

test('reservation abuse: order cap is atomic; retries at the cap succeed and another buyer can order', () => {
  const app = createApp({ dbPath: ':memory:', reservationPolicy: policy });
  users(app);
  try {
    const body = input(app);
    const first = app.workflow.create(alice, body);
    app.workflow.create(alice, input(app));
    const before = app.workflow.stock();
    assert.throws(() => app.workflow.create(alice, input(app)), { code: 'reservation_limit' });
    assert.deepEqual(app.workflow.stock(), before);
    assert.equal(app.workflow.create(alice, body).id, first.id);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 2);
    assert.equal(app.workflow.create(bob, input(app)).status, 'awaiting_confirmation');
    app.workflow.update(alice, first.id, { action: 'cancel', revision: 0, reason: 'Batal' });
    assert.equal(app.workflow.create(alice, input(app)).status, 'awaiting_confirmation');
  } finally {
    app.db.close();
  }
});

test('reservation abuse: packaging aliases share a quantity cap; totals across products are bounded', () => {
  const app = createApp({ dbPath: ':memory:', reservationPolicy: policy });
  users(app);
  try {
    const candidate = app.catalog.snapshot();
    const draft = candidate.edits.find((entry) => entry.groupId === 'snack-pedas');
    draft.variants.push({
      ...draft.variants[0],
      id: 'SECURITY-PACK',
      packagingType: 'pack',
      unitsPerPackage: '10',
      price: '150000',
      oldPrice: '',
    });
    app.catalog.save(candidate);
    const before = app.workflow.stock();
    assert.throws(
      () =>
        app.workflow.create(
          alice,
          input(app, { items: [{ id: 'SECURITY-PACK', quantity: 2, expectedPrice: 150000 }] }),
        ),
      { code: 'reservation_limit' },
    );
    assert.deepEqual(app.workflow.stock(), before);
    app.workflow.create(alice, input(app, { items: [{ ...input(app).items[0], quantity: 8 }] }));
    assert.throws(
      () =>
        app.workflow.create(
          alice,
          input(app, { paymentId: 'cod', items: [{ ...input(app).items[0], quantity: 3 }] }),
        ),
      { code: 'reservation_limit' },
    );
    const other = app.catalog
      .snapshot()
      .edits.filter((entry) => entry.groupId !== 'snack-pedas')
      .flatMap((entry) => entry.variants)
      .find((variant) => variant.packagingType === 'satuan');
    assert.throws(
      () =>
        app.workflow.create(
          alice,
          input(app, {
            items: [{ id: other.id, quantity: 5, expectedPrice: Number(other.price) }],
          }),
        ),
      { code: 'reservation_limit' },
    );
    assert.equal(app.workflow.stock().stock[key].available, 120);
  } finally {
    app.db.close();
  }
});

test('COD confirmation: admin-only, expires once, confirmed/shipped orders survive and late confirmation fails', () => {
  let time = 1700000000000;
  const app = createApp({ dbPath: ':memory:', now: () => time, reservationPolicy: policy });
  users(app);
  try {
    const pending = app.workflow.create(alice, input(app));
    const confirmed = app.workflow.create(bob, input(app));
    assert.equal(pending.codConfirmation.expiresAt, time + 1000);
    assert.throws(
      () => app.workflow.update(bob, confirmed.id, { action: 'confirm_cod', revision: 0 }),
      { status: 403 },
    );
    assert.throws(
      () =>
        app.workflow.update(admin, confirmed.id, {
          action: 'ship',
          revision: 0,
          courier: 'JNE',
          trackingNumber: 'TEST-1',
        }),
      { code: 'invalid_status' },
    );
    const quote = app.workflow.update(admin, confirmed.id, {
      action: 'confirm_cod',
      revision: 0,
      shippingCost: 0,
      courier: 'Fixture',
    });
    const accepted = app.workflow.update(bob, confirmed.id, {
      action: 'accept_quote',
      revision: quote.revision,
    });
    assert.equal(accepted.status, 'processing');
    assert.equal(accepted.codConfirmation.confirmedBy, admin.id);
    assert.equal(accepted.payment.status, 'pay_on_delivery');
    time += 1000;
    assert.throws(() =>
      app.workflow.update(admin, pending.id, { action: 'confirm_cod', revision: 0 }),
    );
    app.workflow.tick();
    app.workflow.tick();
    assert.equal(app.workflow.get(alice, pending.id).status, 'expired');
    assert.equal(app.workflow.stock().stock[key].available, 119);
    assert.equal(
      app.db.prepare("SELECT COUNT(*) AS n FROM inventory_events WHERE action='expire'").get().n,
      0,
    );
    assert.equal(app.workflow.get(bob, confirmed.id).status, 'processing');
    const shipped = app.workflow.update(admin, confirmed.id, {
      action: 'ship',
      revision: 2,
      courier: 'JNE',
      trackingNumber: 'TEST-1',
    });
    time += 86400000;
    app.workflow.tick();
    assert.equal(app.workflow.get(bob, shipped.id).status, 'shipped');
    app.workflow.update(admin, shipped.id, { action: 'complete', revision: 3 });
    assert.equal(app.workflow.stock().stock[key].soldUnits, 1);
  } finally {
    app.db.close();
  }
});

test('legacy COD migration grants one review window, survives restart, and preserves shipped orders', () => {
  const directory = mkdtempSync(join(tmpdir(), 'bam-security-migration-'));
  const dbPath = join(directory, 'test.sqlite');
  let time = 1700000000000;
  let app = createApp({ dbPath, now: () => time, reservationPolicy: policy });
  users(app);
  try {
    const pending = app.workflow.create(alice, input(app));
    const shipped = app.workflow.create(bob, input(app));
    for (const order of [pending, shipped]) {
      delete order.codConfirmation;
      delete order.inventoryReserved;
      order.status = order.id === shipped.id ? 'shipped' : 'processing';
      app.workflow.writeOrder(order);
    }
    app.db.exec(
      "DELETE FROM workflow_security_migrations;DELETE FROM workflow_v30_migrations;UPDATE inventory SET available=118 WHERE stock_key='snack-pedas:180-g'",
    );
    app.db.close();
    time += 5000;
    app = createApp({ dbPath, now: () => time, reservationPolicy: policy });
    const review = app.workflow.get(alice, pending.id);
    assert.equal(review.status, 'awaiting_confirmation');
    assert.equal(review.codConfirmation.expiresAt, time + 1000);
    assert.equal(review.codConfirmation.legacyReview, true);
    const deadline = review.codConfirmation.expiresAt;
    app.db.close();
    time += 500;
    app = createApp({ dbPath, now: () => time, reservationPolicy: policy });
    assert.equal(app.workflow.get(alice, pending.id).codConfirmation.expiresAt, deadline);
    assert.equal(app.workflow.get(bob, shipped.id).status, 'shipped');
    time = deadline;
    app.workflow.tick();
    assert.equal(app.workflow.stock().stock[key].available, 119);
  } finally {
    app.db.close();
    clean(directory);
  }
});

test('public inventory is read-only during expiry and works while another WAL connection owns the writer lock', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bam-security-read-'));
  const dbPath = join(directory, 'test.sqlite');
  let time = 1700000000000;
  const app = createApp({ dbPath, now: () => time, reservationPolicy: policy });
  users(app);
  const writer = new DatabaseSync(dbPath);
  try {
    app.workflow.create(alice, input(app));
    time += 1000;
    const before = app.db.prepare('SELECT total_changes() AS n').get().n;
    writer.exec('BEGIN IMMEDIATE');
    const result = await request(app, 'GET', '/api/inventory');
    assert.equal(result.status, 200);
    assert.equal(result.body.stock[key].available, 120);
    assert.equal(result.body.stock[key].reservedUnits, undefined);
    assert.equal(app.db.prepare('SELECT total_changes() AS n').get().n, before);
    writer.exec('ROLLBACK');
    app.workflow.tick();
    assert.equal(app.workflow.stock().stock[key].available, 120);
    const candidate = app.catalog.snapshot();
    candidate.edits[0].variants.push({
      ...candidate.edits[0].variants[0],
      id: 'SECURITY-NEW-SIZE',
      sizeValue: '987',
    });
    app.catalog.save(candidate);
    assert.equal(
      app.db
        .prepare('SELECT available FROM inventory WHERE stock_key=?')
        .get(candidate.edits[0].groupId + ':987-' + candidate.edits[0].variants[0].sizeUnit)
        .available,
      0,
    );
  } finally {
    writer.close();
    app.db.close();
    clean(directory);
  }
});

test('parallel checkout cannot cross the outstanding-order cap across backend processes', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bam-security-concurrent-'));
  const dbPath = join(directory, 'test.sqlite');
  const app = createApp({ dbPath, reservationPolicy: policy });
  users(app);
  try {
    const task = () =>
      new Promise((resolve, reject) => {
        const worker = new Worker(
          `const {parentPort,workerData}=require('node:worker_threads'); (async()=>{const {createApp}=await import(workerData.module); const app=createApp({dbPath:workerData.dbPath,reservationPolicy:workerData.policy}); try{parentPort.postMessage({id:app.workflow.create(workerData.user,workerData.body).id})}catch(error){parentPort.postMessage({code:error.code})}finally{app.db.close()}})().catch(error=>{throw error});`,
          {
            eval: true,
            workerData: {
              module: new URL('./app.js', import.meta.url).href,
              dbPath,
              policy: { ...policy, codConfirmationWindowMs: 86400000 },
              user: alice,
              body: input(app),
            },
          },
        );
        worker.on('message', resolve);
        worker.on('error', reject);
        worker.on('exit', (code) => {
          if (code) reject(new Error('worker failed'));
        });
      });
    const results = await Promise.all(Array.from({ length: 4 }, task));
    assert.equal(results.filter((result) => result.id).length, 2, JSON.stringify(results));
    assert.equal(results.filter((result) => result.code === 'reservation_limit').length, 2);
    assert.equal(app.workflow.stock().stock[key].available, 120);
  } finally {
    app.db.close();
    clean(directory);
  }
});

test('login executes a password check for missing and existing emails and returns the same failure', async () => {
  const seen = [];
  const app = createApp({
    dbPath: ':memory:',
    passwordCheck: async (password, encoded) => {
      seen.push({ password, encoded });
      return false;
    },
  });
  try {
    app.db
      .prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)')
      .run(
        'login-user',
        'Login User',
        'known@test.id',
        'Alamat lengkap pengujian',
        await hashPassword('real-password'),
        '2026-01-01',
        'user',
      );
    const known = await request(app, 'POST', '/api/auth/login', {
      email: 'known@test.id',
      password: 'wrong-password',
    });
    const missing = await request(app, 'POST', '/api/auth/login', {
      email: 'missing@test.id',
      password: 'wrong-password',
    });
    assert.equal(seen.length, 2);
    assert.equal(known.status, 401);
    assert.deepEqual(missing.body, known.body);
    assert.match(seen[0].encoded, /^[a-f\d]{32}:[a-f\d]{128}$/);
    assert.match(seen[1].encoded, /^[a-f\d]{32}:[a-f\d]{128}$/);
  } finally {
    app.db.close();
  }
});

test('parallel password work is bounded; a flooded account still admits its owner from another connection', async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let active = 0,
    maximum = 0;
  const app = createApp({
    dbPath: ':memory:',
    passwordQueueOptions: { maxActive: 2, perIp: 1, maxQueued: 4, perIpQueued: 2 },
    authLimits: { loginIp: 4, loginPair: 2 },
    passwordCheck: async (password) => {
      active++;
      maximum = Math.max(maximum, active);
      if (password !== 'correct-fixture') await gate;
      active--;
      return password === 'correct-fixture';
    },
  });
  app.db
    .prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)')
    .run(
      'owner',
      'Owner',
      'target@test.id',
      'Alamat fixture lengkap',
      await hashPassword('correct-fixture'),
      '2026-01-01',
      'user',
    );
  try {
    const attempts = Array.from({ length: 20 }, () =>
      request(app, 'POST', '/api/auth/login', { email: 'target@test.id', password: 'wrong' }),
    );
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(
      (
        await request(
          app,
          'POST',
          '/api/auth/login',
          { email: 'target@test.id', password: 'correct-fixture' },
          '192.0.2.2',
        )
      ).status,
      200,
    );
    release();
    const results = await Promise.all(attempts);
    assert.equal(results.filter((x) => x.status === 503).length, 17);
    assert.equal(results.filter((x) => x.status === 429).length, 1);
    assert.ok(maximum <= 2);
    assert.equal(
      (
        await request(app, 'POST', '/api/auth/login', {
          email: 'target@test.id',
          password: 'correct-fixture',
        })
      ).status,
      200,
    );
  } finally {
    release();
    app.db.close();
  }
});

test('failed-login limits persist on the same source; registration throttling does not activate accounts', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bam-security-auth-')),
    dbPath = join(directory, 'test.sqlite');
  let time = 1700000000000;
  const settings = {
    dbPath,
    now: () => time,
    authLimits: { loginPair: 1, registrationIp: 1 },
    passwordCheck: async () => false,
  };
  let app = createTestApp(settings);
  try {
    assert.equal(
      (
        await request(app, 'POST', '/api/auth/login', {
          email: 'target@test.id',
          password: 'wrong',
        })
      ).status,
      401,
    );
    app.db.close();
    app = createTestApp(settings);
    assert.equal(
      (
        await request(app, 'POST', '/api/auth/login', {
          email: 'target@test.id',
          password: 'wrong',
        })
      ).status,
      429,
    );
    assert.equal(
      (
        await request(
          app,
          'POST',
          '/api/auth/login',
          { email: 'target@test.id', password: 'wrong' },
          '192.0.2.9',
        )
      ).status,
      401,
    );
    const fields = {
      name: 'New User',
      address: 'Alamat lengkap pengujian',
      password: 'strong-password',
    };
    for (const email of ['first@test.id', 'second@test.id'])
      assert.equal(
        (await request(app, 'POST', '/api/auth/register', { ...fields, email })).status,
        202,
      );
    assert.equal(
      app.db.prepare("SELECT COUNT(*) AS n FROM auth_tokens WHERE purpose='verify'").get().n,
      1,
    );
    time += 60000;
    assert.equal(
      (await request(app, 'POST', '/api/auth/register', { ...fields, email: 'second@test.id' }))
        .status,
      202,
    );
    assert.equal(
      app.db.prepare("SELECT COUNT(*) AS n FROM auth_tokens WHERE purpose='verify'").get().n,
      2,
    );
    assert.equal(
      app.db
        .prepare('SELECT COUNT(*) AS n FROM auth_account_state WHERE verified_at IS NOT NULL')
        .get().n,
      0,
    );
    assert.ok(
      !JSON.stringify(app.db.prepare('SELECT * FROM auth_rate_limits').all()).includes('@test.id'),
    );
  } finally {
    app.db.close();
    clean(directory);
  }
});

test('unexpected errors are logged with request correlation and no credentials/body/error-message leak', async () => {
  const entries = [];
  const app = createApp({
    dbPath: ':memory:',
    logger: (entry) => entries.push(entry),
    passwordCheck: async () => {
      throw new Error('sensitive-password-and-address');
    },
  });
  try {
    const response = await request(
      app,
      'POST',
      '/api/auth/login?secret=private-query',
      { email: 'private@test.id', password: 'sensitive-password-and-address' },
      '192.0.2.1',
      { cookie: 'private-session-cookie' },
    );
    assert.equal(response.status, 500);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].requestId, response.headers['x-request-id']);
    assert.equal(entries[0].path, '/api/auth/login');
    assert.equal(entries[0].method, 'POST');
    assert.ok(entries[0].error.stack.length);
    assert.doesNotMatch(
      JSON.stringify(entries),
      /sensitive-password|private@test|private-session|private-query/,
    );
    assert.doesNotMatch(JSON.stringify(response.body), /stack|sensitive-password/);
  } finally {
    app.db.close();
  }
});

test('real password verification rejects missing/corrupt hashes and a dummy password cannot create a session', async () => {
  const encoded = await hashPassword('correct-password');
  assert.equal(await verifyPassword('correct-password', encoded), true);
  assert.equal(await verifyPassword('wrong-password', encoded), false);
  assert.equal(await verifyPassword('dummy-credential-not-used-for-login', undefined), false);
  assert.equal(await verifyPassword('correct-password', 'corrupt-hash'), false);
  const app = createApp({ dbPath: ':memory:' });
  try {
    const response = await request(app, 'POST', '/api/auth/login', {
      email: 'missing@test.id',
      password: 'dummy-credential-not-used-for-login',
    });
    assert.equal(response.status, 401);
    assert.equal(response.headers['set-cookie'], undefined);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 0);
  } finally {
    app.db.close();
  }
});

test('failed-login source counters are shared across backend processes', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bam-security-global-'));
  const dbPath = join(directory, 'test.sqlite');
  const app = createApp({ dbPath });
  try {
    const tasks = Array.from(
      { length: 4 },
      (_, index) =>
        new Promise((resolve, reject) => {
          const worker = new Worker(
            `const {parentPort,workerData}=require('node:worker_threads'); const {Readable}=require('node:stream'); (async()=>{const {createApp}=await import(workerData.module); const app=createApp({dbPath:workerData.dbPath,authLimits:{loginPair:1},passwordCheck:async()=>false}); try {const req=Readable.from([JSON.stringify({email:'target@test.id',password:'wrong'})]); req.method='POST'; req.url='/api/auth/login'; req.socket={remoteAddress:'192.0.2.1'}; req.headers={host:'security.test','content-type':'application/json'}; let status; await app.handler(req,{writeHead(value){status=value},end(){}}); parentPort.postMessage(status)} finally{app.db.close()}})().catch(error=>{throw error});`,
            {
              eval: true,
              workerData: { module: new URL('./app.js', import.meta.url).href, dbPath, index },
            },
          );
          worker.on('message', resolve);
          worker.on('error', reject);
          worker.on('exit', (code) => {
            if (code) reject(new Error('worker failed'));
          });
        }),
    );
    const results = await Promise.all(tasks);
    assert.equal(results.filter((status) => status === 401).length, 1, JSON.stringify(results));
    assert.equal(results.filter((status) => status === 429).length, 3);
  } finally {
    app.db.close();
    clean(directory);
  }
});

test('active limiter buckets cannot be evicted by churn; expired buckets recover without trusting forwarded IP', async () => {
  let time = 1700000000000;
  const app = createApp({
    dbPath: ':memory:',
    now: () => time,
    authLimits: { loginIp: 1 },
    passwordCheck: async () => false,
  });
  try {
    assert.equal(
      (await request(app, 'POST', '/api/auth/login', { email: 'first@test.id', password: 'wrong' }))
        .status,
      401,
    );
    assert.equal(
      (
        await request(
          app,
          'POST',
          '/api/auth/login',
          { email: 'second@test.id', password: 'wrong' },
          '192.0.2.1',
          { 'x-forwarded-for': '192.0.2.99' },
        )
      ).status,
      429,
    );
    const insert = app.db.prepare('INSERT INTO auth_rate_limits VALUES(?,1,?)');
    app.db.exec('BEGIN');
    for (let i = 0; i < 9998; i++) insert.run('fixture-' + i, time + 60000);
    app.db.exec('COMMIT');
    const before = app.db.prepare('SELECT COUNT(*) AS n FROM auth_rate_limits').get().n;
    assert.equal(before, 10000);
    assert.equal(
      (
        await request(
          app,
          'POST',
          '/api/auth/login',
          { email: 'rotate@test.id', password: 'wrong' },
          '192.0.2.3',
        )
      ).status,
      429,
    );
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM auth_rate_limits').get().n, before);
    time += 60000;
    assert.equal(
      (
        await request(
          app,
          'POST',
          '/api/auth/login',
          { email: 'rotate@test.id', password: 'wrong' },
          '192.0.2.3',
        )
      ).status,
      401,
    );
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM auth_rate_limits').get().n, 2);
  } finally {
    app.db.close();
  }
});

test('invalid reservation configuration fails closed instead of silently disabling limits', () => {
  for (const value of ['0', 'NaN', '-10', '1.5'])
    assert.throws(() =>
      normalizeReservationPolicy(reservationPolicyFromEnv({ BAM_MAX_OPEN_ORDERS: value })),
    );
  assert.throws(() =>
    normalizeReservationPolicy(reservationPolicyFromEnv({ BAM_COD_CONFIRMATION_HOURS: '721' })),
  );
  assert.equal(
    normalizeReservationPolicy(reservationPolicyFromEnv({ BAM_COD_CONFIRMATION_HOURS: '12' }))
      .codConfirmationWindowMs,
    43200000,
  );
});

test('checkout checks overdue reservations even when the maintenance timer has not run', () => {
  let time = 1700000000000;
  const app = createApp({
    dbPath: ':memory:',
    now: () => time,
    reservationPolicy: { ...policy, maxOpenOrders: 1 },
  });
  users(app);
  try {
    const old = app.workflow.create(alice, input(app));
    time = old.codConfirmation.expiresAt;
    assert.equal(app.workflow.stock().stock[key].available, 120);
    const next = app.workflow.create(alice, input(app));
    assert.equal(next.status, 'awaiting_confirmation');
    assert.equal(app.workflow.get(alice, old.id).status, 'expired');
    assert.equal(app.workflow.stock().stock[key].available, 120);
    assert.equal(
      app.db.prepare("SELECT COUNT(*) AS n FROM inventory_events WHERE action='expire'").get().n,
      0,
    );
  } finally {
    app.db.close();
  }
});
