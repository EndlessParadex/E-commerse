import { AuthRateLimiter } from './authSecurity.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { createApp, hashPassword } from './app.js';

const password = 'fixture-correct-password';
const alice = { id: 'alice30', role: 'user' },
  bob = { id: 'bob30', role: 'user' },
  admin = { id: 'admin30', role: 'admin' };
const mailConfig = { publicUrl: 'https://shop.example.test', queueKey: 'a'.repeat(64) };
const tokenFor = (user) => createHash('sha256').update(user.id).digest('base64url');
async function fixture(options = {}) {
  const sent = [];
  const mailer = { enabled: true, send: async (message) => sent.push(message) };
  const app = createApp({ dbPath: ':memory:', mailer, mailConfig, logger: () => {}, ...options });
  const encoded = await hashPassword(password);
  for (const user of [alice, bob, admin]) {
    app.db
      .prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)')
      .run(
        user.id,
        user.id,
        user.id + '@fixture.test',
        'Alamat fixture lengkap',
        encoded,
        '2026-10-13',
        user.role,
      );
    app.db
      .prepare('INSERT INTO sessions VALUES(?,?,?)')
      .run(
        createHash('sha256').update(tokenFor(user)).digest('hex'),
        user.id,
        Date.now() + 86400000,
      );
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
  return { app, sent };
}
async function request(app, method, path, body, user = null, ip = '192.0.2.1', headers = {}) {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  req.method = method;
  req.url = path;
  req.socket = { remoteAddress: ip };
  req.headers = {
    host: 'fixture.test',
    'content-type': 'application/json',
    ...(user ? { cookie: 'bam_session=' + tokenFor(user) } : {}),
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
function order(app, quantity = 1, paymentId = 'cod') {
  const variant = app.catalog
    .snapshot()
    .edits.find((x) => x.groupId === 'snack-pedas')
    .variants.find((x) => x.id === 'snack-pedas');
  return {
    requestKey: randomUUID(),
    recipient: 'Penerima fixture',
    address: 'Alamat fixture lengkap',
    paymentId,
    shippingId: 'regular',
    items: [{ id: variant.id, quantity, expectedPrice: Number(variant.price) }],
  };
}
const key = 'snack-pedas:180-g';

test('default 120 units: COD 99+21 cannot hoard, other buyer can request, and repeated expiry holds nothing', async () => {
  let time = Date.now();
  const { app } = await fixture({ now: () => time });
  try {
    app.workflow.create(alice, order(app, 99));
    app.workflow.create(alice, order(app, 21));
    assert.equal(app.workflow.stock().stock[key].available, 120);
    assert.equal((await request(app, 'POST', '/api/orders', order(app), bob)).status, 201);
    time += 7 * 86400000;
    app.workflow.tick();
    app.workflow.create(alice, order(app, 99));
    assert.equal(app.workflow.stock().stock[key].available, 120);
    assert.equal(
      app.db.prepare("SELECT COUNT(*) AS n FROM inventory_events WHERE action='reserve'").get().n,
      0,
    );
  } finally {
    app.db.close();
  }
});

test('unpaid methods also hold nothing; only admin approval reserves stock and release is exact', async () => {
  let time = Date.now();
  const { app } = await fixture({ now: () => time });
  try {
    const pending = app.workflow.create(alice, order(app, 99, 'manual-transfer'));
    assert.equal(pending.status, 'awaiting_review');
    assert.equal(pending.inventoryReserved, false);
    assert.equal(app.workflow.stock().stock[key].available, 120);
    assert.throws(
      () => app.workflow.update(alice, pending.id, { action: 'approve_payment', revision: 0 }),
      { status: 403 },
    );
    const quote = app.workflow.update(admin, pending.id, {
      action: 'approve_payment',
      revision: 0,
      shippingCost: 10000,
      courier: 'Kurir fixture',
    });
    const approved = app.workflow.update(alice, pending.id, {
      action: 'accept_quote',
      revision: quote.revision,
    });
    assert.equal(approved.status, 'awaiting_payment');
    assert.equal(app.workflow.stock().stock[key].available, 21);
    assert.throws(() =>
      app.workflow.update(admin, pending.id, { action: 'approve_payment', revision: 1 }),
    );
    time = approved.payment.expiresAt;
    app.workflow.tick();
    app.workflow.tick();
    assert.equal(app.workflow.stock().stock[key].available, 120);
    assert.equal(app.workflow.stock().stock[key].reservedUnits, 0);
  } finally {
    app.db.close();
  }
});

test('competing approvals check the real stock; cancelling an unreserved request never adds stock', async () => {
  const { app } = await fixture();
  try {
    const first = app.workflow.create(alice, order(app, 99)),
      second = app.workflow.create(bob, order(app, 99));
    const accepted = app.workflow.update(admin, first.id, {
      action: 'confirm_cod',
      revision: 0,
      shippingCost: 10000,
      courier: 'Kurir fixture',
    });
    assert.equal(accepted.inventoryReserved, true);
    assert.equal(app.workflow.stock().stock[key].available, 21);
    const refused = app.workflow.update(admin, second.id, {
      action: 'confirm_cod',
      revision: 0,
      shippingCost: 10000,
      courier: 'Fixture',
    });
    assert.equal(refused.status, 'cancelled');
    assert.match(refused.cancellationReason, /Stok tidak cukup/);
    assert.equal(app.workflow.stock().stock[key].available, 21);
    app.workflow.update(alice, first.id, { action: 'cancel', revision: 1, reason: 'Batal' });
    assert.equal(app.workflow.stock().stock[key].available, 120);
  } finally {
    app.db.close();
  }
});

test('ten wrong passwords cannot lock a correct login from the same or another IP', async () => {
  const { app } = await fixture();
  try {
    for (let i = 0; i < 10; i++)
      await request(app, 'POST', '/api/auth/login', {
        email: alice.id + '@fixture.test',
        password: 'wrong',
      });
    assert.equal(
      (
        await request(app, 'POST', '/api/auth/login', {
          email: alice.id.toUpperCase() + '@fixture.test',
          password,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request(
          app,
          'POST',
          '/api/auth/login',
          { email: alice.id + '@fixture.test', password },
          null,
          '192.0.2.99',
        )
      ).status,
      200,
    );
  } finally {
    app.db.close();
  }
});

test('600 eligible failed attempts across ten IPs do not exhaust a global login quota', async () => {
  const { app } = await fixture({ passwordCheck: async (p) => p === password });
  try {
    for (let i = 0; i < 600; i++)
      await request(
        app,
        'POST',
        '/api/auth/login',
        { email: `missing${i}@fixture.test`, password: 'wrong' },
        null,
        `192.0.2.${(i % 10) + 1}`,
      );
    assert.equal(
      (
        await request(
          app,
          'POST',
          '/api/auth/login',
          { email: alice.id + '@fixture.test', password },
          null,
          '192.0.2.30',
        )
      ).status,
      200,
    );
  } finally {
    app.db.close();
  }
});

test('public inventory has no internal metrics; admin inventory is protected and counts are materialized', async () => {
  const { app } = await fixture();
  try {
    assert.equal((await request(app, 'GET', '/api/admin/inventory')).status, 401);
    assert.equal((await request(app, 'GET', '/api/admin/inventory', undefined, bob)).status, 403);
    const pending = app.workflow.create(alice, order(app));
    app.workflow.update(admin, pending.id, {
      action: 'confirm_cod',
      revision: 0,
      shippingCost: 10000,
      courier: 'Kurir fixture',
    });
    const publicStock = (await request(app, 'GET', '/api/inventory')).body.stock[key];
    assert.equal(publicStock.soldUnits, undefined);
    assert.equal(publicStock.reservedUnits, undefined);
    assert.equal(
      (await request(app, 'GET', '/api/admin/inventory', undefined, admin)).body.stock[key]
        .reservedUnits,
      1,
    );
    const original = app.db.prepare.bind(app.db);
    app.db.prepare = (sql) => {
      assert.doesNotMatch(sql, /json_each|FROM orders JOIN/);
      return original(sql);
    };
    assert.equal((await request(app, 'GET', '/api/inventory')).status, 200);
    app.db.prepare = original;
  } finally {
    app.db.close();
  }
});

test('unconfigured email stores an unverified account without pretending delivery', async () => {
  const app = createApp({ dbPath: ':memory:', mailer: { enabled: false }, logger: () => {} });
  try {
    assert.equal((await request(app, 'GET', '/api/auth/features')).body.emailReady, false);
    const response = await request(app, 'POST', '/api/auth/register', {
      name: 'Fixture New',
      address: 'Alamat fixture lengkap',
      email: 'new@fixture.test',
      password,
    });
    assert.equal(response.status, 202);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 1);
    assert.equal(response.headers['set-cookie'], undefined);
  } finally {
    app.db.close();
  }
});

test('registration is generic; verification requires ownership token and password; reset is single-use and revokes sessions', async () => {
  const { app, sent } = await fixture();
  try {
    const fields = { name: 'Pendaftar fixture', address: 'Alamat fixture lengkap', password };
    const known = await request(app, 'POST', '/api/auth/register', {
      ...fields,
      email: alice.id + '@fixture.test',
    });
    const fresh = await request(app, 'POST', '/api/auth/register', {
      ...fields,
      email: 'new@fixture.test',
    });
    assert.equal(known.status, 202);
    assert.deepEqual(fresh.body, known.body);
    assert.equal(fresh.headers['set-cookie'], undefined);
    await app.identity.flushMail();
    assert.equal(sent.length, 2);
    const token = sent
      .find((m) => m.to === 'new@fixture.test')
      .text.match(/token=([A-Za-z0-9_-]+)/)[1];
    assert.ok(!JSON.stringify(app.db.prepare('SELECT * FROM auth_tokens').all()).includes(token));
    assert.equal(
      (await request(app, 'POST', '/api/auth/verify-email', { token, password: 'wrong' })).status,
      400,
    );
    assert.equal(
      (await request(app, 'POST', '/api/auth/verify-email', { token, password })).status,
      200,
    );
    assert.equal(
      (await request(app, 'POST', '/api/auth/verify-email', { token, password })).status,
      400,
    );
    const login = await request(app, 'POST', '/api/auth/login', {
      email: 'new@fixture.test',
      password,
    });
    assert.equal(login.body.user.emailVerified, true);
    await request(app, 'POST', '/api/auth/forgot-password', { email: 'new@fixture.test' });
    await app.identity.flushMail();
    const reset = sent.at(-1).text.match(/token=([A-Za-z0-9_-]+)/)[1];
    const newPassword = 'new-fixture-password';
    assert.equal(
      (
        await request(app, 'POST', '/api/auth/reset-password', {
          token: reset,
          password: newPassword,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request(app, 'POST', '/api/auth/reset-password', {
          token: reset,
          password: newPassword,
        })
      ).status,
      400,
    );
    assert.equal(
      (await request(app, 'POST', '/api/auth/login', { email: 'new@fixture.test', password }))
        .status,
      401,
    );
    assert.equal(
      (
        await request(app, 'POST', '/api/auth/login', {
          email: 'new@fixture.test',
          password: newPassword,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request(app, 'GET', '/api/auth/me', undefined, null, '192.0.2.1', {
          cookie: login.headers['set-cookie'].split(';')[0],
        })
      ).status,
      401,
    );
  } finally {
    app.db.close();
  }
});
import { clientIpResolver } from './clientIp.js';
import { mailTransportFromEnv } from './mailTransport.js';
import { mkdtempSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
const messageToken = (message) => message.text.match(/token=([A-Za-z0-9_-]+)/)[1];

test('proxy trust is explicit, walks right-to-left, rejects malformed input and cannot be spoofed directly', () => {
  const req = (peer, forwarded) => ({
    socket: { remoteAddress: peer },
    headers: { 'x-forwarded-for': forwarded },
  });
  assert.equal(clientIpResolver('')(req('192.0.2.1', '198.51.100.9')), '192.0.2.1');
  const trusted = clientIpResolver('127.0.0.1/32,10.0.0.1/32');
  assert.equal(trusted(req('127.0.0.1', '198.51.100.9')), '198.51.100.9');
  assert.equal(trusted(req('::ffff:127.0.0.1', '198.51.100.9, 10.0.0.1')), '198.51.100.9');
  assert.equal(trusted(req('127.0.0.1', '203.0.113.5, 192.0.2.1')), '192.0.2.1');
  assert.equal(trusted(req('127.0.0.1', 'not-an-ip')), '127.0.0.1');
  assert.equal(trusted(req('127.0.0.1', 'a'.repeat(2049))), '127.0.0.1');
  for (const value of ['*', '0.0.0.0/0', '::/0', 'uniquelocal', 'garbage'])
    assert.throws(() => clientIpResolver(value));
});

test('independent customers behind a trusted proxy have independent registration budgets', async () => {
  const { app } = await fixture({
    trustedProxies: '127.0.0.1/32',
    authLimits: { registrationIp: 1 },
  });
  try {
    const fields = { name: 'Fixture customer', address: 'Alamat pengujian lengkap', password };
    for (const [ip, email] of [
      ['198.51.100.1', 'one@fixture.test'],
      ['198.51.100.2', 'two@fixture.test'],
      ['198.51.100.1', 'three@fixture.test'],
    ])
      assert.equal(
        (
          await request(
            app,
            'POST',
            '/api/auth/register',
            { ...fields, email },
            null,
            '127.0.0.1',
            { 'x-forwarded-for': ip },
          )
        ).status,
        202,
      );
    assert.equal(
      app.db.prepare("SELECT COUNT(*) AS n FROM auth_tokens WHERE purpose='verify'").get().n,
      2,
    );
  } finally {
    app.db.close();
  }
});

test('registration retains the original password; repeat registration cannot overwrite it and sends account recovery', async () => {
  const { app, sent } = await fixture();
  try {
    const fields = {
      name: 'Recipient',
      address: 'Alamat penerima lengkap',
      email: 'recipient@fixture.test',
      password: 'registration-original-password',
    };
    await request(app, 'POST', '/api/auth/register', fields);
    await app.identity.flushMail();
    const verify = messageToken(sent.at(-1));
    await request(app, 'POST', '/api/auth/register', {
      ...fields,
      password: 'attacker-overwrite-password',
    });
    await app.identity.flushMail();
    assert.equal(
      (
        await request(app, 'POST', '/api/auth/login', {
          email: fields.email,
          password: 'attacker-overwrite-password',
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await request(app, 'POST', '/api/auth/verify-email', {
          token: verify,
          password: fields.password,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request(app, 'POST', '/api/auth/login', {
          email: fields.email,
          password: fields.password,
        })
      ).status,
      200,
    );
    assert.equal(sent.length, 2);
    assert.match(sent.at(-1).subject, /ulang/);
    const known = await request(app, 'POST', '/api/auth/forgot-password', {
        email: alice.id + '@fixture.test',
      }),
      missing = await request(app, 'POST', '/api/auth/forgot-password', {
        email: 'missing@fixture.test',
      });
    assert.deepEqual(known.body, missing.body);
  } finally {
    app.db.close();
  }
});

test('existing verification requires current password; reset tokens reject wrong purpose, expiry and concurrent reuse', async () => {
  let time = Date.now();
  const { app, sent } = await fixture({ now: () => time });
  try {
    app.db.prepare('UPDATE auth_account_state SET verified_at=NULL WHERE user_id=?').run(alice.id);
    assert.equal(
      (await request(app, 'POST', '/api/auth/verification/request', {}, alice)).status,
      202,
    );
    await app.identity.flushMail();
    const verifyToken = messageToken(sent.at(-1));
    assert.equal(
      (await request(app, 'POST', '/api/auth/reset-password', { token: verifyToken, password }))
        .status,
      400,
    );
    assert.equal(
      (
        await request(app, 'POST', '/api/auth/verify-email', {
          token: verifyToken,
          password: 'incorrect-valid-length',
        })
      ).status,
      400,
    );
    assert.equal(app.identity.verified(alice.id), false);
    assert.equal(
      (await request(app, 'POST', '/api/auth/verify-email', { token: verifyToken, password }))
        .status,
      200,
    );
    await request(app, 'POST', '/api/auth/forgot-password', { email: alice.id + '@fixture.test' });
    await app.identity.flushMail();
    const expired = messageToken(sent.at(-1));
    time += 1800000;
    assert.equal(
      (
        await request(app, 'POST', '/api/auth/reset-password', {
          token: expired,
          password: 'expired-new-password',
        })
      ).status,
      400,
    );
    time += 3600000;
    await request(app, 'POST', '/api/auth/forgot-password', { email: alice.id + '@fixture.test' });
    await app.identity.flushMail();
    const token = messageToken(sent.at(-1));
    const results = await Promise.all(
      ['new-password-one', 'new-password-two'].map((password) =>
        request(app, 'POST', '/api/auth/reset-password', { token, password }),
      ),
    );
    assert.deepEqual(results.map((x) => x.status).sort(), [200, 400]);
    const valid = results[0].status === 200 ? 'new-password-one' : 'new-password-two';
    assert.equal(
      (
        await request(app, 'POST', '/api/auth/login', {
          email: alice.id + '@fixture.test',
          password: valid,
        })
      ).status,
      200,
    );
  } finally {
    app.db.close();
  }
});

test('password settings require admin access and reject forged roles without changing buyer credentials or sessions', async () => {
  const { app } = await fixture();
  try {
    const body = {
      currentPassword: password,
      password: 'replacement-password',
      role: 'admin',
      userId: admin.id,
    };
    const before = app.db.prepare('SELECT password_hash FROM users WHERE id=?').get(alice.id);
    assert.equal((await request(app, 'POST', '/api/auth/change-password', body)).status, 401);
    const blocked = await request(app, 'POST', '/api/auth/change-password', body, alice);
    assert.equal(blocked.status, 403);
    assert.match(blocked.body.errors.form, /hanya tersedia untuk admin/);
    assert.equal((await request(app, 'POST', '/api/auth/change-password', {}, alice)).status, 403);
    await assert.rejects(
      app.identity.changePassword(
        { ...alice, role: 'admin' },
        password,
        body.password,
        '192.0.2.1',
      ),
      (error) => error.status === 403,
    );
    assert.equal(
      app.db.prepare('SELECT password_hash FROM users WHERE id=?').get(alice.id).password_hash,
      before.password_hash,
    );
    assert.equal((await request(app, 'GET', '/api/auth/me', undefined, alice)).status, 200);
    assert.equal((await request(app, 'GET', '/api/auth/me', undefined, admin)).status, 200);
  } finally {
    app.db.close();
  }
});

test('revoking admin access during a password change prevents the write and leaves sessions intact', async () => {
  let entered, release;
  const started = new Promise((resolve) => (entered = resolve)),
    gate = new Promise((resolve) => (release = resolve));
  const { app } = await fixture({
    passwordCheck: async () => {
      entered();
      await gate;
      return true;
    },
  });
  let pending;
  try {
    const before = app.db.prepare('SELECT password_hash FROM users WHERE id=?').get(admin.id);
    pending = request(
      app,
      'POST',
      '/api/auth/change-password',
      { currentPassword: password, password: 'replacement-password' },
      admin,
    );
    await started;
    app.db.prepare("UPDATE users SET role='user' WHERE id=?").run(admin.id);
    release();
    assert.equal((await pending).status, 403);
    assert.equal(
      app.db.prepare('SELECT password_hash FROM users WHERE id=?').get(admin.id).password_hash,
      before.password_hash,
    );
    assert.equal((await request(app, 'GET', '/api/auth/me', undefined, admin)).status, 200);
  } finally {
    release();
    await pending;
    app.db.close();
  }
});

test('admin password change rejects the old secret, then revokes every owner session and recovery token without logging out another account', async () => {
  const { app, sent } = await fixture();
  try {
    await request(app, 'POST', '/api/auth/forgot-password', { email: admin.id + '@fixture.test' });
    await app.identity.flushMail();
    const reset = messageToken(sent.at(-1));
    assert.equal(
      (
        await request(
          app,
          'POST',
          '/api/auth/change-password',
          { currentPassword: 'wrong-secret', password: 'replacement-password' },
          admin,
        )
      ).status,
      401,
    );
    assert.equal((await request(app, 'GET', '/api/auth/me', undefined, admin)).status, 200);
    assert.equal(
      (
        await request(
          app,
          'POST',
          '/api/auth/change-password',
          { currentPassword: password, password: 'replacement-password' },
          admin,
        )
      ).status,
      200,
    );
    assert.equal((await request(app, 'GET', '/api/auth/me', undefined, admin)).status, 401);
    assert.equal((await request(app, 'GET', '/api/auth/me', undefined, bob)).status, 200);
    assert.equal(
      (
        await request(app, 'POST', '/api/auth/reset-password', {
          token: reset,
          password: 'third-password',
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request(app, 'POST', '/api/auth/login', {
          email: admin.id + '@fixture.test',
          password,
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await request(app, 'POST', '/api/auth/login', {
          email: admin.id + '@fixture.test',
          password: 'replacement-password',
        })
      ).status,
      200,
    );
  } finally {
    app.db.close();
  }
});

test('a login started before password reset cannot issue a session after credentials change', async () => {
  let entered, release;
  const started = new Promise((r) => (entered = r)),
    gate = new Promise((r) => (release = r));
  const { app, sent } = await fixture({
    passwordCheck: async () => {
      entered();
      await gate;
      return true;
    },
  });
  try {
    await request(app, 'POST', '/api/auth/forgot-password', { email: alice.id + '@fixture.test' });
    await app.identity.flushMail();
    const pending = request(app, 'POST', '/api/auth/login', {
      email: alice.id + '@fixture.test',
      password,
    });
    await started;
    assert.equal(
      (
        await request(app, 'POST', '/api/auth/reset-password', {
          token: messageToken(sent.at(-1)),
          password: 'replacement-password',
        })
      ).status,
      200,
    );
    release();
    const result = await pending;
    assert.equal(result.status, 401);
    assert.equal(result.headers['set-cookie'], undefined);
  } finally {
    release();
    app.db.close();
  }
});

test('public stock can hide exact counts and publish coarse sales; materialized counts survive restart once', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bam-v30-persistence-')),
    dbPath = join(directory, 'fixture.sqlite');
  let app;
  try {
    ({ app } = await fixture({ dbPath }));
    let pending = app.workflow.create(alice, order(app, 11));
    let current = app.workflow.update(admin, pending.id, {
      action: 'confirm_cod',
      revision: 0,
      shippingCost: 10000,
      courier: 'Kurir fixture',
    });
    current = app.workflow.update(alice, current.id, {
      action: 'accept_quote',
      revision: current.revision,
    });
    current = app.workflow.update(admin, current.id, {
      action: 'ship',
      revision: current.revision,
      courier: 'Fixture',
      trackingNumber: 'TEST-001',
    });
    app.workflow.update(admin, current.id, { action: 'complete', revision: current.revision });
    const settings = app.company.snapshot();
    app.company.save({
      ...settings,
      profile: { ...settings.profile, showExactStock: false, showSoldCount: true },
    });
    let response = (await request(app, 'GET', '/api/inventory')).body;
    assert.deepEqual(response.stock[key], { revision: 1, inStock: true });
    assert.equal(response.publishedSales['snack-pedas'], 10);
    assert.equal(response.skuAvailability['snack-pedas'], true);
    const before = app.workflow.stock().stock[key];
    app.db.close();
    app = createApp({ dbPath, mailer: { enabled: false } });
    assert.deepEqual(app.workflow.stock().stock[key], before);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM workflow_v30_migrations').get().n, 1);
    const profile = app.company.snapshot();
    app.company.save({ ...profile, profile: { ...profile.profile, showSoldCount: false } });
    assert.deepEqual((await request(app, 'GET', '/api/inventory')).body.publishedSales, {});
  } finally {
    if (app?.db.isOpen) app.db.close();
    const target = realpathSync(directory),
      parent = realpathSync(tmpdir());
    assert.ok(target.startsWith(parent + sep) && target === resolve(directory));
    rmSync(target, { recursive: true, force: true });
  }
});

test('mail queue encrypts account links, retries after restart and redacts transport failures', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bam-v30-mail-')),
    dbPath = join(directory, 'fixture.sqlite');
  let app;
  let time = Date.now();
  const logs = [],
    sent = [];
  try {
    ({ app } = await fixture({
      dbPath,
      now: () => time,
      logger: (entry) => logs.push(entry),
      mailer: {
        enabled: true,
        send: async () => {
          throw new Error('SMTP secret, recipient and token must not be logged');
        },
      },
    }));
    await request(app, 'POST', '/api/auth/forgot-password', { email: alice.id + '@fixture.test' });
    const payload = app.db.prepare('SELECT payload FROM auth_mail_outbox').get().payload;
    assert.doesNotMatch(payload, /token=|fixture\.test|SMTP/);
    assert.equal(await app.identity.flushMail(), 0);
    assert.equal(logs.length, 1);
    assert.doesNotMatch(JSON.stringify(logs), /SMTP secret|recipient and token/);
    assert.equal(app.db.prepare('SELECT attempts FROM auth_mail_outbox').get().attempts, 1);
    app.db.close();
    app = createApp({
      dbPath,
      now: () => time,
      mailConfig,
      mailer: { enabled: true, send: async (x) => sent.push(x) },
      logger: () => {},
    });
    assert.equal(await app.identity.flushMail(), 0);
    time += 60000;
    assert.equal(await app.identity.flushMail(), 1);
    assert.equal(sent.length, 1);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM auth_mail_outbox').get().n, 0);
    assert.equal(
      (
        await request(app, 'POST', '/api/auth/reset-password', {
          token: messageToken(sent[0]),
          password: 'new-persisted-password',
        })
      ).status,
      200,
    );
  } finally {
    if (app?.db.isOpen) app.db.close();
    const target = realpathSync(directory),
      parent = realpathSync(tmpdir());
    assert.ok(target.startsWith(parent + sep) && target === resolve(directory));
    rmSync(target, { recursive: true, force: true });
  }
});

test('SMTP configuration fails closed when partial or unsafe; failed login pacing never becomes an email lock', async () => {
  assert.equal(mailTransportFromEnv({}).enabled, false);
  assert.throws(() => mailTransportFromEnv({ BAM_SMTP_HOST: 'smtp.fixture.test' }));
  assert.throws(() =>
    mailTransportFromEnv({
      BAM_SMTP_HOST: 'smtp.fixture.test',
      BAM_SMTP_USER: 'fixture',
      BAM_SMTP_PASSWORD: 'fixture',
      BAM_MAIL_FROM: 'bad\nheader',
    }),
  );
  let time = Date.now();
  const { app } = await fixture({ now: () => time, authLimits: { loginPair: 1 } });
  const limiter = new AuthRateLimiter(app.db, () => time, { loginPair: 1 });
  try {
    assert.equal(limiter.loginDelay('192.0.2.1', alice.id + '@fixture.test'), 0);
    assert.equal(
      (
        await request(app, 'POST', '/api/auth/login', {
          email: alice.id + '@fixture.test',
          password: 'wrong',
        })
      ).status,
      401,
    );
    assert.equal(limiter.loginDelay('192.0.2.1', alice.id + '@fixture.test'), 1000);
    assert.equal(limiter.loginDelay('192.0.2.99', alice.id + '@fixture.test'), 0);
    time += 60000;
    assert.equal(limiter.loginDelay('192.0.2.1', alice.id + '@fixture.test'), 0);
  } finally {
    app.db.close();
  }
});
