import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { createApp, hashPassword } from './app.js';

const password = 'kata-sandi-hp-2026';
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
    socket: { remoteAddress: '192.0.2.77' },
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
const cookieOf = (res) => res.headers['set-cookie'].split(';')[0];
function fixture() {
  const codes = [];
  const app = createApp({
    dbPath: ':memory:',
    installMode: 'company',
    mailer: { enabled: false },
    logger: () => {},
    whatsappSender: { enabled: true, send: async (message) => codes.push(message) },
  });
  return { app, codes };
}
const signup = (phone, email) => ({
  name: 'Pembeli ' + phone,
  phone,
  ...(email === undefined ? {} : { email }),
  password,
  street: 'Jalan Contoh No. 5, Tanjung Pandan, Belitung',
  villageCode: '19.02.01.1001',
});
const userByPhone = (app, phone) =>
  app.db
    .prepare('SELECT u.* FROM users u JOIN user_contact_phones p ON p.user_id=u.id WHERE p.phone=?')
    .get(phone);
const approve = (app, id) =>
  app.db.prepare("UPDATE account_approvals SET status='approved' WHERE user_id=?").run(id);
const confirmPhone = (app, id) =>
  app.db
    .prepare('UPDATE user_contact_phones SET verified_at=? WHERE user_id=?')
    .run(Date.now(), id);
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('an old database keeps every account, session and phone when email becomes optional', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bam-email-'));
  const dbPath = join(dir, 'bam.sqlite');
  try {
    const old = new DatabaseSync(dbPath);
    old.exec(`PRAGMA foreign_keys=ON;
      CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, address TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user');
      CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
      CREATE TABLE user_contact_phones (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, phone TEXT NOT NULL);
      INSERT INTO users VALUES('u1','Lama','Lama@Contoh.id','Jalan Lama No. 1, Belitung','x','2026-01-01','user');
      INSERT INTO sessions VALUES('t1','u1',9999999999999);
      INSERT INTO user_contact_phones VALUES('u1','+6281234567801');`);
    old.close();

    const app = createApp({
      dbPath,
      installMode: 'company',
      mailer: { enabled: false },
      logger: () => {},
    });
    try {
      const email = app.db
        .prepare('PRAGMA table_info(users)')
        .all()
        .find((c) => c.name === 'email');
      assert.equal(email.notnull, 0);
      assert.deepEqual(
        { ...app.db.prepare('SELECT id,name,email,role FROM users').get() },
        { id: 'u1', name: 'Lama', email: 'Lama@Contoh.id', role: 'user' },
      );
      assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 1);
      assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM user_contact_phones').get().n, 1);
      // Uniqueness ignores case as before; deleting the account still cascades.
      assert.throws(() =>
        app.db
          .prepare("INSERT INTO users VALUES('u2','B','lama@contoh.id','Alamat','x','t','user')")
          .run(),
      );
      assert.equal(app.db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
      app.db.prepare("DELETE FROM users WHERE id='u1'").run();
      assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 0);
    } finally {
      app.db.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('registration needs a phone number; email may be left empty but must be valid when given', async () => {
  const { app } = fixture();
  try {
    const first = await request(app, '/api/auth/register', signup('081234567811'));
    assert.equal(first.status, 202);
    assert.equal(first.body.withEmail, false);
    assert.match(first.body.message, /WhatsApp/);
    assert.equal(
      (await request(app, '/api/auth/register', signup('081234567812', ''))).status,
      202,
    );
    const both = app.db.prepare('SELECT email FROM users ORDER BY created_at').all();
    assert.deepEqual(
      both.map((row) => row.email),
      [null, null],
    );

    const badEmail = await request(
      app,
      '/api/auth/register',
      signup('081234567813', 'bukan-email'),
    );
    assert.equal(badEmail.status, 422);
    assert.ok(badEmail.body.errors.email);
    const noPhone = await request(app, '/api/auth/register', { ...signup('', 'a@contoh.id') });
    assert.equal(noPhone.status, 422);
    assert.ok(noPhone.body.errors.phone);

    // Phone login works for an approved account without email.
    const user = userByPhone(app, '+6281234567811');
    approve(app, user.id);
    const login = await request(app, '/api/auth/login', {
      identifier: '0812-3456-7811',
      password,
    });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.email, '');
    assert.equal(login.body.user.orderReady, false);
  } finally {
    app.db.close();
  }
});

test('a confirmed WhatsApp number is enough to order; an unconfirmed one is not', async () => {
  const { app } = fixture();
  try {
    await request(app, '/api/auth/register', signup('081234567821'));
    const user = userByPhone(app, '+6281234567821');
    approve(app, user.id);
    assert.equal(app.identity.contactVerified(user.id), false);
    confirmPhone(app, user.id);
    assert.equal(app.identity.contactVerified(user.id), true);
    const login = await request(app, '/api/auth/login', { identifier: '081234567821', password });
    assert.equal(login.body.user.orderReady, true);
    assert.equal(login.body.user.emailVerified, false);
    // Email verification is unavailable for an account without email.
    const verify = await request(
      app,
      '/api/auth/verification/request',
      {},
      'POST',
      cookieOf(login),
    );
    assert.equal(verify.status, 409);
  } finally {
    app.db.close();
  }
});

test('forgot password by WhatsApp: only confirmed numbers get a code, and the answer never tells', async () => {
  const { app, codes } = fixture();
  try {
    await request(app, '/api/auth/register', signup('081234567831'));
    const user = userByPhone(app, '+6281234567831');
    approve(app, user.id);
    const session = cookieOf(
      await request(app, '/api/auth/login', { identifier: '081234567831', password }),
    );

    const unconfirmed = await request(app, '/api/auth/forgot-phone', { phone: '081234567831' });
    const unknown = await request(app, '/api/auth/forgot-phone', { phone: '081299999999' });
    await settle();
    assert.equal(unconfirmed.status, 202);
    assert.deepEqual(unconfirmed.body, unknown.body);
    assert.equal(codes.length, 0);

    confirmPhone(app, user.id);
    const sent = await request(app, '/api/auth/forgot-phone', { phone: '+62 812-3456-7831' });
    await settle();
    assert.deepEqual(sent.body, unknown.body);
    assert.equal(codes.length, 1);
    assert.equal(codes[0].phone, '+6281234567831');
    const code = codes[0].code;
    const wrong = code === '000000' ? '111111' : '000000';

    const reset = (body) => request(app, '/api/auth/reset-phone', body);
    assert.equal(
      (await reset({ phone: '081234567831', code: wrong, password: 'sandi-baru-2026' })).status,
      400,
    );
    assert.equal(
      (await reset({ phone: '081299999999', code, password: 'sandi-baru-2026' })).status,
      400,
    );
    assert.equal((await reset({ phone: '081234567831', code, password: 'pendek' })).status, 422);
    const done = await reset({ phone: '081234567831', code, password: 'sandi-baru-2026' });
    assert.equal(done.status, 200);
    // Old sessions end; the old password stops working; the code cannot be reused.
    assert.equal((await request(app, '/api/auth/me', undefined, 'GET', session)).status, 401);
    assert.equal(
      (await request(app, '/api/auth/login', { identifier: '081234567831', password })).status,
      401,
    );
    assert.equal(
      (
        await request(app, '/api/auth/login', {
          identifier: '081234567831',
          password: 'sandi-baru-2026',
        })
      ).status,
      200,
    );
    assert.equal(
      (await reset({ phone: '081234567831', code, password: 'sandi-lain-2026' })).status,
      400,
    );
  } finally {
    app.db.close();
  }
});

test('five wrong codes end a WhatsApp reset code', async () => {
  const { app, codes } = fixture();
  try {
    await request(app, '/api/auth/register', signup('081234567841'));
    const user = userByPhone(app, '+6281234567841');
    approve(app, user.id);
    confirmPhone(app, user.id);
    await request(app, '/api/auth/forgot-phone', { phone: '081234567841' });
    await settle();
    const { code } = codes[0];
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++)
      await request(app, '/api/auth/reset-phone', {
        phone: '081234567841',
        code: wrong,
        password: 'sandi-baru-2026',
      });
    const late = await request(app, '/api/auth/reset-phone', {
      phone: '081234567841',
      code,
      password: 'sandi-baru-2026',
    });
    assert.equal(late.status, 400);
  } finally {
    app.db.close();
  }
});

test('the store owner can give an account a temporary password, never another owner', async () => {
  const { app } = fixture();
  try {
    const ownerHash = await hashPassword(password);
    app.db
      .prepare(
        "INSERT INTO users VALUES('owner','Pemilik','pemilik@contoh.id','Alamat pemilik toko',?,?,'admin')",
      )
      .run(ownerHash, new Date().toISOString());
    app.db.prepare("INSERT INTO store_owners VALUES('owner',?)").run(new Date().toISOString());
    const owner = cookieOf(
      await request(app, '/api/auth/login', { identifier: 'pemilik@contoh.id', password }),
    );
    await request(app, '/api/auth/register', signup('081234567851'));
    const buyer = userByPhone(app, '+6281234567851');
    approve(app, buyer.id);
    const buyerSession = cookieOf(
      await request(app, '/api/auth/login', { identifier: '081234567851', password }),
    );
    const listed = (
      await request(app, '/api/admin/accounts?q=081234567851', undefined, 'GET', owner)
    ).body.users.find((entry) => entry.id === buyer.id);
    assert.equal(listed.canResetPassword, true);
    assert.equal(listed.email, '');

    const body = (extra = {}) => ({
      action: 'reset-password',
      reason: 'Pembeli lupa kata sandi',
      revision: listed.revision,
      currentPassword: password,
      ...extra,
    });
    assert.equal(
      (
        await request(
          app,
          '/api/admin/accounts/' + buyer.id,
          body({ currentPassword: 'salah-salah' }),
          'POST',
          owner,
        )
      ).status,
      401,
    );
    const reset = await request(app, '/api/admin/accounts/' + buyer.id, body(), 'POST', owner);
    assert.equal(reset.status, 200);
    assert.match(reset.body.temporaryPassword, /^[A-Za-z2-9]{12}$/);
    assert.equal((await request(app, '/api/auth/me', undefined, 'GET', buyerSession)).status, 401);
    const login = await request(app, '/api/auth/login', {
      identifier: '081234567851',
      password: reset.body.temporaryPassword,
    });
    assert.equal(login.status, 200);
    // The buyer replaces the temporary password themselves.
    const changed = await request(
      app,
      '/api/auth/change-password',
      { currentPassword: reset.body.temporaryPassword, password: 'sandi-pribadi-2026' },
      'POST',
      cookieOf(login),
    );
    assert.equal(changed.status, 200);
    assert.ok(
      app.db
        .prepare(
          "SELECT 1 FROM account_management_audit WHERE target_id=? AND action='reset-password'",
        )
        .get(buyer.id),
    );

    const self = await request(
      app,
      '/api/admin/accounts/owner',
      body({ revision: 0 }),
      'POST',
      owner,
    );
    assert.equal(self.status, 403);
  } finally {
    app.db.close();
  }
});
