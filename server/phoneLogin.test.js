import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { hashPassword, createApp } from './app.js';

const password = 'password-for-phone-2026';
async function request(app, path, body, method = 'POST', cookie = '') {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  Object.assign(req, {
    method,
    url: path,
    headers: {
      host: 'fixture.test',
      origin: 'http://fixture.test',
      'content-type': 'application/json',
      cookie,
    },
    socket: { remoteAddress: '192.0.2.46' },
  });
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
const signup = (email, phone) => ({
  name: 'Pengguna ' + email,
  email,
  phone,
  password,
  address: 'Jalan Contoh No. 5, Palembang, Sumatera Selatan',
});
const approved = (app, email) => {
  const row = app.db.prepare('SELECT id FROM users WHERE email=?').get(email);
  assert.ok(row, 'new registration must create a user');
  app.db.prepare("UPDATE account_approvals SET status='approved' WHERE user_id=?").run(row.id);
  return row.id;
};

test('phone login shares password, approval rules and cookies with normal email login', async () => {
  const app = createApp({ dbPath: ':memory:', mailer: { enabled: false }, logger: () => {} });
  try {
    const noPhone = await request(app, '/api/auth/register', {
      name: 'No Phone',
      email: 'missing@fixture.test',
      address: 'Jalan Contoh No. 5, Palembang',
      password,
    });
    assert.equal(noPhone.status, 422);
    assert.ok(noPhone.body.errors.phone);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 0);

    const registration = await request(
      app,
      '/api/auth/register',
      signup('buyer@fixture.test', '0812-3456-7890'),
    );
    assert.equal(registration.status, 202);
    assert.equal(registration.headers['set-cookie'], undefined);
    const id = app.db.prepare('SELECT id FROM users WHERE email=?').get('buyer@fixture.test').id;
    assert.equal(app.phoneVerification.contact(id).phone, '+6281234567890');
    assert.equal(app.phoneVerification.contact(id).phoneVerified, false);
    assert.equal(
      (await request(app, '/api/auth/login', { identifier: '+6281234567890', password })).status,
      403,
    );
    approved(app, 'buyer@fixture.test');
    for (const identifier of [
      '081234567890',
      '6281234567890',
      '+6281234567890',
      '0812-3456-7890',
      'buyer@fixture.test',
      'BUYER@FIXTURE.TEST',
    ]) {
      const res = await request(app, '/api/auth/login', { identifier, password });
      assert.equal(res.status, 200, 'login alias: ' + identifier);
      assert.equal(res.body.user.id, id);
      assert.match(res.headers['set-cookie'], /HttpOnly/);
    }
    assert.equal(
      (
        await request(app, '/api/auth/login', {
          identifier: '081234567890',
          password: 'wrong-pass',
        })
      ).status,
      401,
    );
    assert.equal(
      (await request(app, '/api/auth/login', { identifier: '081200000000', password })).status,
      401,
    );
    assert.equal(
      (await request(app, '/api/auth/login', { identifier: '0812', password })).status,
      422,
    );

    const duplicate = await request(
      app,
      '/api/auth/register',
      signup('other@fixture.test', '+6281234567890'),
    );
    assert.equal(
      duplicate.status,
      202,
      'registration response does not reveal whether a phone belongs to another account',
    );
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 1);
  } finally {
    app.db.close();
  }
});

test('legacy email-only accounts can add a unique phone, then remove it without losing email login', async () => {
  const app = createApp({ dbPath: ':memory:', mailer: { enabled: false }, logger: () => {} });
  try {
    const encoded = await hashPassword(password);
    for (const id of ['legacy', 'other']) {
      app.db
        .prepare(
          'INSERT INTO users(id,name,email,address,password_hash,created_at,role) VALUES(?,?,?,?,?,?,?)',
        )
        .run(
          id,
          id,
          id + '@fixture.test',
          'Jalan Contoh No. 1 Palembang',
          encoded,
          new Date().toISOString(),
          'user',
        );
    }
    const emailLogin = await request(app, '/api/auth/login', {
      email: 'legacy@fixture.test',
      password,
    });
    assert.equal(emailLogin.status, 200);
    assert.equal(
      (await request(app, '/api/auth/login', { email: '081234567891', password })).status,
      401,
    );
    const cookie = emailLogin.headers['set-cookie'].split(';')[0];
    const addPhone = await request(
      app,
      '/api/profile/phone',
      {
        phone: '081234567891',
      },
      'PUT',
      cookie,
    );
    assert.equal(addPhone.status, 200);
    assert.equal(addPhone.body.user.phone, '+6281234567891');
    assert.equal(addPhone.body.user.phoneVerified, false);
    assert.equal(
      (
        await request(app, '/api/auth/login', {
          email: '+6281234567891',
          password,
        })
      ).status,
      200,
      'older clients passing a phone in the email field still work',
    );
    const other = await request(app, '/api/auth/login', { email: 'other@fixture.test', password });
    const otherCookie = other.headers['set-cookie'].split(';')[0];
    const conflict = await request(
      app,
      '/api/profile/phone',
      {
        phone: '6281234567891',
      },
      'PUT',
      otherCookie,
    );
    assert.equal(conflict.status, 409);
    assert.equal(app.phoneVerification.contact('other').phone, '');
    const remove = await request(app, '/api/profile/phone', { phone: '' }, 'PUT', cookie);
    assert.equal(remove.status, 200);
    assert.equal(
      (await request(app, '/api/auth/login', { identifier: '081234567891', password })).status,
      401,
    );
    assert.equal(
      (await request(app, '/api/auth/login', { identifier: 'legacy@fixture.test', password }))
        .status,
      200,
    );
  } finally {
    app.db.close();
  }
});

test('historical duplicate phone aliases are ambiguous and cannot resolve an arbitrary account', async () => {
  const app = createApp({ dbPath: ':memory:', mailer: { enabled: false }, logger: () => {} });
  try {
    const hash = await hashPassword(password);
    for (const id of ['old-a', 'old-b']) {
      app.db
        .prepare(
          'INSERT INTO users(id,name,email,address,password_hash,created_at,role) VALUES(?,?,?,?,?,?,?)',
        )
        .run(
          id,
          id,
          id + '@fixture.test',
          'Alamat pelanggan terdaftar lengkap',
          hash,
          new Date().toISOString(),
          'user',
        );
    }
    // Legacy rows existed without uniqueness rules: their aliases would collide.
    app.db
      .prepare('INSERT INTO user_contact_phones(user_id,phone,revision) VALUES(?,?,?)')
      .run('old-a', '0812-3456-7890', 'aaa');
    app.db
      .prepare('INSERT INTO user_contact_phones(user_id,phone,revision) VALUES(?,?,?)')
      .run('old-b', '+6281234567890', 'bbb');
    // Rebuild, as happens when the application starts with an existing database.
    const { PhoneLoginDirectory } = await import('./phoneLoginDirectory.js');
    const directory = new PhoneLoginDirectory(app.db);
    assert.equal(directory.find('+6281234567890'), null);
    assert.equal(
      (await request(app, '/api/auth/login', { identifier: '081234567890', password })).status,
      401,
    );
    assert.equal(
      (await request(app, '/api/auth/register', signup('new@fixture.test', '081234567890'))).status,
      202,
    );
    assert.equal(
      app.db.prepare('SELECT COUNT(*) AS n FROM users').get().n,
      2,
      'a collision cannot silently create a third account',
    );
    assert.equal(
      (await request(app, '/api/auth/login', { identifier: 'old-a@fixture.test', password }))
        .status,
      200,
    );
  } finally {
    app.db.close();
  }
});
