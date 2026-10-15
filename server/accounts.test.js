import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createApp, hashPassword } from './app.js';
import { verifyPassword } from './authSecurity.js';

const password = 'account-owner-password',
  users = [
    ['owner', 'admin'],
    ['other-owner', 'admin'],
    ['operator', 'admin'],
    ['buyer', 'user'],
  ];
const tokens = Object.fromEntries(
  users.map(([id]) => [id, createHash('sha256').update(id).digest('base64url')]),
);
function makeApp(options = {}) {
  const mail = [];
  const app = createApp({
    dbPath: ':memory:',
    mailer: { enabled: true, send: async (message) => mail.push(message) },
    mailConfig: { publicUrl: 'https://fixture.test/', queueKey: 'c'.repeat(64) },
    logger: () => {},
    ...options,
  });
  return { app, mail };
}
async function seed(app) {
  const hash = await hashPassword(password);
  for (const [id, role] of users) {
    app.db
      .prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)')
      .run(
        id,
        id + ' fixture',
        id + '@fixture.test',
        'Alamat lengkap fixture',
        hash,
        new Date().toISOString(),
        role,
      );
    app.db
      .prepare('INSERT INTO sessions VALUES(?,?,?)')
      .run(createHash('sha256').update(tokens[id]).digest('hex'), id, Date.now() + 86400000);
  }
  for (const id of ['owner', 'other-owner'])
    app.db.prepare('INSERT INTO store_owners VALUES(?,?)').run(id, new Date().toISOString());
  app.db.exec('INSERT INTO auth_account_state(user_id,verified_at) SELECT id,1 FROM users');
}
async function request(app, method, path, body, actor = null) {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  req.method = method;
  req.url = path;
  req.socket = { remoteAddress: '192.0.2.1' };
  req.headers = {
    host: 'fixture.test',
    origin: 'http://fixture.test',
    'content-type': 'application/json',
    ...(actor ? { cookie: 'bam_session=' + tokens[actor] } : {}),
  };
  let response;
  await app.handler(req, {
    writeHead(status, headers) {
      response = { status, headers };
    },
    end(value) {
      response.body = JSON.parse(value);
    },
  });
  return response;
}
const change = (app, id, action, revision = 0, extra = {}) =>
  request(
    app,
    'POST',
    '/api/admin/accounts/' + id,
    {
      action,
      revision,
      reason: 'Alasan pengujian akun',
      currentPassword: password,
      confirmEmail: id + '@fixture.test',
      ...extra,
    },
    'owner',
  );

test('Ketua, Wakil and trusted staff only read a paginated buyer directory; owner grants do not elevate admin privileges', async () => {
  const { app } = makeApp();
  await seed(app);
  try {
    for (const actor of [null, 'buyer', 'operator'])
      assert.equal(
        (await request(app, 'GET', '/api/team/customers', undefined, actor)).status,
        actor ? 403 : 401,
      );
    assert.equal(
      (
        await change(app, 'buyer', 'customer-access', 0, {
          customerRole: 'chair',
          currentPassword: 'wrong-password',
        })
      ).status,
      401,
    );
    for (let i = 0; i < 31; i++)
      app.db
        .prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)')
        .run(
          'customer-' + i,
          'Customer ' + i,
          'customer' + i + '@fixture.test',
          'Private address marker',
          'private hash marker',
          new Date(i * 1000).toISOString(),
          'user',
        );
    app.db
      .prepare('INSERT INTO auth_account_state(user_id,verified_at) VALUES(?,?)')
      .run('customer-0', 1);
    let revision = 0;
    for (const customerRole of ['chair', 'deputy', 'trusted']) {
      const granted = await change(app, 'buyer', 'customer-access', revision++, { customerRole });
      assert.equal(granted.status, 200, JSON.stringify(granted.body));
      const me = (await request(app, 'GET', '/api/auth/me', undefined, 'buyer')).body.user;
      assert.equal(me.role, 'user');
      assert.equal(me.isOwner, false);
      assert.equal(me.customerRole, customerRole);
      assert.equal(me.canViewCustomers, true);
      const filtered = await request(
        app,
        'GET',
        '/api/admin/accounts?role=' + customerRole,
        undefined,
        'owner',
      );
      assert.equal(filtered.status, 200);
      assert.deepEqual(
        filtered.body.users.map((user) => user.id),
        ['buyer'],
      );
      assert.ok(
        (
          await request(app, 'GET', '/api/admin/accounts?role=user', undefined, 'owner')
        ).body.users.every((user) => !user.customerRole),
      );
      for (const path of [
        '/api/admin/accounts',
        '/api/admin/users',
        '/api/admin/email-settings',
        '/api/admin/orders',
        '/api/admin/inventory',
      ])
        assert.equal((await request(app, 'GET', path, undefined, 'buyer')).status, 403, path);
      for (const action of ['disable', 'reactivate', 'delete', 'customer-access'])
        assert.equal(
          (
            await request(
              app,
              'POST',
              '/api/admin/accounts/customer-0',
              {
                action,
                revision: 0,
                reason: 'Percobaan hak akses',
                currentPassword: password,
                customerRole: 'chair',
                isOwner: true,
              },
              'buyer',
            )
          ).status,
          403,
        );
      assert.equal(
        (await request(app, 'POST', '/api/team/customers', { action: 'delete' }, 'buyer')).status,
        405,
      );
      const first = await request(app, 'GET', '/api/team/customers', undefined, 'buyer');
      assert.equal(first.status, 200);
      assert.equal(first.body.total, 31);
      assert.equal(first.body.users.length, 25);
      assert.equal(first.headers['cache-control'], 'no-store');
      for (const item of first.body.users) {
        assert.deepEqual(
          Object.keys(item).sort(),
          ['active', 'createdAt', 'email', 'emailVerified', 'id', 'name'].sort(),
        );
        assert.ok(item.id.startsWith('customer-'));
      }
      assert.doesNotMatch(
        JSON.stringify(first.body),
        /Private address|private hash|password|orderCount|reason|token/,
      );
      const second = (await request(app, 'GET', '/api/team/customers?page=2', undefined, 'buyer'))
        .body;
      assert.equal(second.users.length, 6);
      assert.equal(new Set([...first.body.users, ...second.users].map((x) => x.id)).size, 31);
      assert.equal(
        (await request(app, 'GET', '/api/team/customers?verification=verified', undefined, 'buyer'))
          .body.total,
        1,
      );
      assert.equal(
        (await request(app, 'GET', '/api/team/customers?q=%25', undefined, 'buyer')).body.total,
        0,
      );
      assert.equal(
        (await request(app, 'GET', '/api/team/customers?page=-1', undefined, 'buyer')).status,
        422,
      );
    }
    assert.equal(
      (await change(app, 'buyer', 'customer-access', 0, { customerRole: '' })).status,
      409,
    );
    assert.equal(
      (await change(app, 'buyer', 'customer-access', revision, { customerRole: '' })).status,
      200,
    );
    assert.equal(
      (await request(app, 'GET', '/api/team/customers', undefined, 'buyer')).status,
      403,
    );
    assert.equal(
      (await request(app, 'GET', '/api/auth/me', undefined, 'buyer')).body.user.canViewCustomers,
      false,
    );
    assert.equal(
      app.db
        .prepare(
          "SELECT COUNT(*) AS n FROM account_management_audit WHERE action LIKE 'customer-access:%'",
        )
        .get().n,
      4,
    );
  } finally {
    app.db.close();
  }
});

test('customer access requires an active verified account, survives restart and is checked across connections', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bam-customer-access-')),
    dbPath = join(directory, 'shop.sqlite');
  let first = makeApp({ dbPath }).app,
    second;
  try {
    await seed(first);
    for (const id of ['owner', 'other-owner'])
      assert.equal(
        (await change(first, id, 'customer-access', 0, { customerRole: 'chair' })).status,
        403,
      );
    first.db.prepare('UPDATE auth_account_state SET verified_at=NULL WHERE user_id=?').run('buyer');
    assert.equal(
      (await change(first, 'buyer', 'customer-access', 0, { customerRole: 'chair' })).status,
      422,
    );
    first.db.prepare('UPDATE auth_account_state SET verified_at=1 WHERE user_id=?').run('buyer');
    assert.equal(
      (await change(first, 'buyer', 'customer-access', 0, { customerRole: 'owner' })).status,
      422,
    );
    assert.equal(
      (await change(first, 'buyer', 'customer-access', 0, { customerRole: 'chair' })).status,
      200,
    );
    second = makeApp({ dbPath }).app;
    assert.equal(
      (await request(second, 'GET', '/api/team/customers', undefined, 'buyer')).status,
      200,
    );
    first.db.close();
    first = makeApp({ dbPath }).app;
    assert.equal(
      (await request(first, 'GET', '/api/auth/me', undefined, 'buyer')).body.user.customerRole,
      'chair',
    );
    assert.equal(
      (await change(first, 'buyer', 'customer-access', 1, { customerRole: '' })).status,
      200,
    );
    assert.equal(
      (await request(second, 'GET', '/api/team/customers', undefined, 'buyer')).status,
      403,
    );
    assert.equal(
      (await change(first, 'buyer', 'customer-access', 2, { customerRole: 'deputy' })).status,
      200,
    );
    assert.equal((await change(first, 'buyer', 'disable', 3)).status, 200);
    assert.equal(
      (await request(second, 'GET', '/api/team/customers', undefined, 'buyer')).status,
      401,
    );
    assert.equal(
      (await change(first, 'buyer', 'customer-access', 4, { customerRole: 'trusted' })).status,
      422,
    );
    assert.equal((await change(first, 'buyer', 'delete', 4)).status, 200);
    assert.equal(first.db.prepare('SELECT COUNT(*) AS n FROM store_customer_viewers').get().n, 0);
  } finally {
    first?.db.close();
    second?.db.close();
    assert.equal(dirname(directory), tmpdir());
    rmSync(directory, { recursive: true, force: true });
  }
});

test('self registration appears in the buyer directory without role selection or automatic staff permission', async () => {
  const { app } = makeApp({ mailer: { enabled: false }, mailConfig: {} });
  await seed(app);
  try {
    const response = await request(app, 'POST', '/api/auth/register', {
      name: 'Pembeli Baru',
      email: 'new@fixture.test',
      address: 'Alamat pembeli baru lengkap',
      password: 'new-customer-password',
      role: 'admin',
      isOwner: true,
      customerRole: 'chair',
      canViewCustomers: true,
    });
    assert.equal(response.status, 202);
    const buyer = app.db.prepare('SELECT id,role FROM users WHERE email=?').get('new@fixture.test');
    assert.equal(buyer.role, 'user');
    assert.equal(
      app.db
        .prepare('SELECT COUNT(*) AS n FROM store_customer_viewers WHERE user_id=?')
        .get(buyer.id).n,
      0,
    );
    const listed = await request(
      app,
      'GET',
      '/api/team/customers?q=new%40fixture.test',
      undefined,
      'owner',
    );
    assert.equal(listed.body.total, 1);
    assert.equal(listed.body.users[0].emailVerified, false);
    assert.equal(listed.body.users[0].active, true);
    assert.equal(
      (await request(app, 'GET', '/api/company')).body.commerce.verificationRequired,
      true,
    );
  } finally {
    app.db.close();
  }
});

test('account management requires ownership, protects every owner, hides credentials and paginates literal search results', async () => {
  const { app } = makeApp();
  await seed(app);
  try {
    for (const actor of [null, 'operator', 'buyer']) {
      assert.equal(
        (await request(app, 'GET', '/api/admin/accounts', undefined, actor)).status,
        actor ? 403 : 401,
      );
      assert.equal(
        (
          await request(
            app,
            'POST',
            '/api/admin/accounts/buyer',
            {
              action: 'delete',
              revision: 0,
              reason: 'uji hapus akun',
              currentPassword: password,
              isOwner: true,
            },
            actor,
          )
        ).status,
        actor ? 403 : 401,
      );
    }
    assert.equal(
      (await request(app, 'GET', '/api/admin/users', undefined, 'operator')).status,
      403,
    );
    assert.equal(
      (
        await request(
          app,
          'PUT',
          '/api/admin/users/buyer',
          { name: 'Nama lain', address: 'Alamat lengkap lain' },
          'operator',
        )
      ).status,
      403,
    );
    const hash = app.db
      .prepare('SELECT password_hash FROM users WHERE id=?')
      .get('buyer').password_hash;
    for (let i = 0; i < 31; i++)
      app.db
        .prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)')
        .run(
          'new-' + i,
          'Pembeli ' + i,
          'new-' + i + '@fixture.test',
          'Alamat lengkap fixture',
          hash,
          '2026-10-14',
          'user',
        );
    const list = await request(app, 'GET', '/api/admin/accounts', undefined, 'owner');
    assert.equal(list.status, 200);
    assert.equal(list.body.users.length, 25);
    assert.equal(list.body.total, 35);
    assert.equal(
      (await request(app, 'GET', '/api/admin/accounts?page=2', undefined, 'owner')).body.users
        .length,
      10,
    );
    const ownerList = (
      await request(app, 'GET', '/api/admin/accounts?role=owner', undefined, 'owner')
    ).body;
    assert.equal(ownerList.total, 2);
    assert.ok(ownerList.users.every((user) => !user.canDelete && !user.canDisable));
    assert.equal(
      (await request(app, 'GET', '/api/admin/accounts?role=admin', undefined, 'owner')).body.total,
      1,
    );
    assert.equal(
      (await request(app, 'GET', '/api/admin/accounts?q=%25', undefined, 'owner')).body.total,
      0,
    );
    assert.equal(
      (await request(app, 'GET', '/api/admin/accounts?q=new-30', undefined, 'owner')).body.total,
      1,
    );
    assert.equal(
      (await request(app, 'GET', '/api/admin/accounts?page=-1', undefined, 'owner')).status,
      422,
    );
    assert.ok(list.body.users.every((user) => !('password_hash' in user) && !('password' in user)));
    for (const id of ['owner', 'other-owner'])
      for (const action of ['disable', 'delete', 'reactivate'])
        assert.equal((await change(app, id, action)).status, 403);
    assert.equal(
      (await change(app, 'buyer', 'disable', 0, { currentPassword: 'wrong-password' })).status,
      401,
    );
    assert.equal(app.accounts.get('buyer', { id: 'owner' }).active, true);
  } finally {
    app.db.close();
  }
});

test('deactivation revokes sessions and recovery links, cannot be bypassed through registration/reset, and reactivation leaves old links invalid', async () => {
  const { app, mail } = makeApp();
  await seed(app);
  try {
    await request(app, 'POST', '/api/auth/forgot-password', { email: 'buyer@fixture.test' });
    await app.identity.flushMail();
    const token = mail.at(-1).text.match(/token=([A-Za-z0-9_-]+)/)[1];
    const result = await change(app, 'buyer', 'disable');
    assert.equal(result.status, 200);
    assert.equal(result.body.user.active, false);
    assert.equal(result.body.user.revision, 1);
    assert.equal((await request(app, 'GET', '/api/auth/me', undefined, 'buyer')).status, 401);
    assert.equal(
      (
        await request(
          app,
          'PUT',
          '/api/profile',
          { name: 'Nama baru', address: 'Alamat lengkap baru' },
          'buyer',
        )
      ).status,
      401,
    );
    assert.equal(
      (await request(app, 'POST', '/api/auth/login', { email: 'buyer@fixture.test', password }))
        .status,
      403,
    );
    assert.equal(
      (
        await request(app, 'POST', '/api/auth/reset-password', {
          token,
          password: 'new-buyer-password',
        })
      ).status,
      400,
    );
    assert.equal(
      (await request(app, 'POST', '/api/auth/forgot-password', { email: 'buyer@fixture.test' }))
        .status,
      202,
    );
    assert.equal(
      (
        await request(app, 'POST', '/api/auth/register', {
          email: 'buyer@fixture.test',
          name: 'Nama penimpa',
          address: 'Alamat lengkap penimpa',
          password: 'new-registration-password',
        })
      ).status,
      202,
    );
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM auth_mail_outbox').get().n, 0);
    assert.equal((await change(app, 'buyer', 'reactivate', 0)).status, 409);
    assert.equal((await change(app, 'buyer', 'reactivate', 1)).status, 200);
    assert.equal((await request(app, 'GET', '/api/auth/me', undefined, 'buyer')).status, 401);
    assert.equal(
      (await request(app, 'POST', '/api/auth/login', { email: 'buyer@fixture.test', password }))
        .status,
      200,
    );
    assert.equal(
      (
        await request(app, 'POST', '/api/auth/reset-password', {
          token,
          password: 'new-buyer-password',
        })
      ).status,
      400,
    );
    assert.equal(
      app.db.prepare('SELECT name FROM users WHERE id=?').get('buyer').name,
      'buyer fixture',
    );
    assert.equal((await request(app, 'GET', '/api/auth/me', undefined, 'operator')).status, 200);
  } finally {
    app.db.close();
  }
});

test('delete needs exact email confirmation, removes unused accounts and auth records atomically, and preserves unrelated users', async () => {
  const { app } = makeApp();
  await seed(app);
  try {
    for (const [id, status, reason] of [
      ['pending-delete', 'queued', ''],
      ['historical', 'skipped', 'order_changed'],
    ])
      app.db
        .prepare(
          'INSERT INTO order_mail(id,order_id,kind,recipient_id,admin,created_at,status,next_attempt,skip_reason) VALUES(?,?,?,?,?,?,?,?,?)',
        )
        .run(id, 'historical-order', 'orderCreated', 'buyer', 0, 1, status, 1, reason);
    app.db.prepare('UPDATE auth_account_state SET verified_at=NULL WHERE user_id=?').run('buyer');
    await request(app, 'POST', '/api/auth/verification/request', {}, 'buyer');
    assert.equal(
      (await change(app, 'buyer', 'delete', 0, { confirmEmail: 'wrong@fixture.test' })).status,
      422,
    );
    assert.equal((await request(app, 'GET', '/api/auth/me', undefined, 'buyer')).status, 200);
    assert.equal((await change(app, 'buyer', 'delete')).status, 200);
    assert.equal(
      app.db.prepare('SELECT skip_reason FROM order_mail WHERE id=?').get('pending-delete')
        .skip_reason,
      'recipient_deleted',
    );
    assert.equal(
      app.db.prepare('SELECT skip_reason FROM order_mail WHERE id=?').get('historical').skip_reason,
      'order_changed',
    );
    for (const table of [
      'users',
      'sessions',
      'auth_tokens',
      'auth_account_state',
      'account_access',
    ]) {
      const column = table === 'users' ? 'id' : 'user_id';
      assert.equal(
        app.db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column}=?`).get('buyer').n,
        0,
      );
    }
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM auth_mail_outbox').get().n, 0);
    assert.equal((await change(app, 'buyer', 'delete')).status, 404);
    assert.equal((await request(app, 'GET', '/api/auth/me', undefined, 'operator')).status, 200);
    assert.equal(
      app.db.prepare('SELECT action FROM account_management_audit WHERE target_id=?').get('buyer')
        .action,
      'delete',
    );
    assert.deepEqual(app.db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    app.db.close();
  }
});

test('accounts with orders cannot be deleted; disabling access preserves reserved stock and order history', async () => {
  const { app } = makeApp();
  await seed(app);
  try {
    const draft = app.catalog.snapshot().edits.find((row) => row.groupId === 'snack-pedas'),
      variant = draft.variants.find((row) => row.id === 'snack-pedas');
    const buyer = { id: 'buyer', role: 'user' },
      owner = { id: 'owner', role: 'admin' };
    let order = app.workflow.create(buyer, {
      requestKey: randomUUID(),
      recipient: 'Buyer fixture',
      address: 'Alamat lengkap fixture',
      paymentId: 'cod',
      shippingId: 'regular',
      items: [{ id: variant.id, quantity: 2, expectedPrice: Number(variant.price) }],
    });
    order = app.workflow.update(owner, order.id, {
      action: 'confirm_cod',
      revision: order.revision,
      shippingCost: 10000,
      courier: 'Kurir fixture',
    });
    order = app.workflow.update(buyer, order.id, {
      action: 'accept_quote',
      revision: order.revision,
    });
    const before = JSON.stringify(app.workflow.stock());
    assert.equal((await change(app, 'buyer', 'delete')).status, 409);
    assert.equal(app.accounts.get('buyer', owner).canDelete, false);
    assert.equal((await change(app, 'buyer', 'disable')).status, 200);
    assert.equal(JSON.stringify(app.workflow.stock()), before);
    assert.equal(app.workflow.get(owner, order.id).status, 'processing');
    assert.throws(
      () => app.workflow.update(buyer, order.id, { action: 'cancel', revision: order.revision }),
      (error) => error.code === 'account_disabled',
    );
    order = app.workflow.update(owner, order.id, {
      action: 'ship',
      revision: order.revision,
      courier: 'Kurir fixture',
      trackingNumber: 'TEST-35',
    });
    assert.equal(order.status, 'shipped');
    assert.equal(
      app.db.prepare('SELECT COUNT(*) AS n FROM orders WHERE user_id=?').get('buyer').n,
      1,
    );
  } finally {
    app.db.close();
  }
});

test('a login already checking the password cannot create a new session after account deactivation', async () => {
  let entered, release;
  const started = new Promise((resolve) => {
      entered = resolve;
    }),
    gate = new Promise((resolve) => {
      release = resolve;
    });
  const { app } = makeApp({
    passwordCheck: async (value, encoded) => {
      entered();
      await gate;
      return verifyPassword(value, encoded);
    },
  });
  await seed(app);
  let pending;
  try {
    pending = request(app, 'POST', '/api/auth/login', { email: 'buyer@fixture.test', password });
    await started;
    app.accounts.change({ id: 'owner' }, 'buyer', {
      action: 'disable',
      revision: 0,
      reason: 'Batasi akses saat masuk',
    });
    release();
    const result = await pending;
    assert.equal(result.status, 403);
    assert.equal(result.headers['set-cookie'], undefined);
    assert.equal(
      app.db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id=?').get('buyer').n,
      0,
    );
  } finally {
    release();
    await pending;
    app.db.close();
  }
});

test('deactivation persists across server restart and another connection sees fresh revisions', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bam-accounts-v35-')),
    dbPath = join(directory, 'shop.sqlite');
  let first = makeApp({ dbPath }).app,
    second;
  try {
    await seed(first);
    second = makeApp({ dbPath }).app;
    assert.equal((await change(first, 'buyer', 'disable')).status, 200);
    assert.equal((await request(second, 'GET', '/api/auth/me', undefined, 'buyer')).status, 401);
    assert.equal((await change(second, 'buyer', 'reactivate', 0)).status, 409);
    first.db.close();
    first = null;
    first = makeApp({ dbPath }).app;
    assert.equal(first.accounts.get('buyer', { id: 'owner' }).active, false);
    assert.equal((await change(first, 'buyer', 'reactivate', 1)).status, 200);
    assert.equal(
      (await request(second, 'POST', '/api/auth/login', { email: 'buyer@fixture.test', password }))
        .status,
      200,
    );
  } finally {
    first?.db.close();
    second?.db.close();
    assert.equal(dirname(directory), tmpdir());
    rmSync(directory, { recursive: true, force: true });
  }
});
