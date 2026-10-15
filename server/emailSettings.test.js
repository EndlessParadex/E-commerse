import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createApp, hashPassword } from './app.js';

const password = 'owner-account-password';
const settings = {
  host: 'smtp.fixture.test',
  port: 587,
  user: 'smtp-user-fixture',
  password: 'smtp-secret-fixture',
  from: 'Fixture Shop <sender@fixture.test>',
  publicUrl: 'https://shop.fixture.test/',
};
const tokens = { owner: 'o'.repeat(43), admin: 'a'.repeat(43), buyer: 'b'.repeat(43) };
const cookie = (who) => 'bam_session=' + tokens[who];
async function request(app, method, path, body, who = null) {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  req.method = method;
  req.url = path;
  req.socket = { remoteAddress: '192.0.2.1' };
  req.headers = {
    host: 'fixture.test',
    origin: 'http://fixture.test',
    'content-type': 'application/json',
    ...(who ? { cookie: cookie(who) } : {}),
  };
  let result;
  await app.handler(req, {
    writeHead(status, headers) {
      result = { status, headers };
    },
    end(value) {
      result.body = JSON.parse(value);
    },
  });
  return result;
}
function mailFixture() {
  const sent = [],
    configured = [],
    logs = [];
  let fail = false;
  const transportFactory = (env) => {
    configured.push({ ...env });
    return {
      enabled: Boolean(env.BAM_SMTP_HOST),
      send: async (message) => {
        if (fail) throw new Error('SMTP smtp-secret-fixture recipient token=private-value');
        sent.push({ ...message, host: env.BAM_SMTP_HOST });
      },
    };
  };
  return {
    sent,
    configured,
    logs,
    transportFactory,
    setFailure: (value) => {
      fail = value;
    },
  };
}
function appFor(mail, options = {}) {
  return createApp({
    dbPath: ':memory:',
    mailer: { enabled: false },
    mailConfig: {},
    mailTransportFactory: mail.transportFactory,
    logger: (entry) => mail.logs.push(entry),
    ...options,
  });
}
async function seed(app) {
  const hash = await hashPassword(password);
  for (const [id, role] of [
    ['owner', 'admin'],
    ['admin', 'admin'],
    ['buyer', 'user'],
  ]) {
    app.db
      .prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)')
      .run(
        id,
        'Akun ' + id,
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
  app.db.prepare('INSERT INTO store_owners VALUES(?,?)').run('owner', new Date().toISOString());
}
const save = (app, revision = 0, changes = {}) =>
  request(
    app,
    'POST',
    '/api/admin/email-settings',
    { revision, currentPassword: password, settings: { ...settings, ...changes } },
    'owner',
  );

test('only an explicitly granted owner can read or write mail settings; forged owner flags cannot escalate access', async () => {
  const mail = mailFixture(),
    app = appFor(mail);
  await seed(app);
  try {
    for (const who of [null, 'admin', 'buyer'])
      for (const [method, path] of [
        ['GET', '/api/admin/email-settings'],
        ['POST', '/api/admin/email-settings'],
        ['POST', '/api/admin/email-settings/test'],
      ]) {
        const result = await request(
          app,
          method,
          path,
          { revision: 0, currentPassword: password, isOwner: true, role: 'owner', settings },
          who,
        );
        assert.equal(result.status, who ? 403 : 401);
        assert.doesNotMatch(JSON.stringify(result.body), /smtp-secret|smtp-user/);
      }
    assert.equal(
      (await request(app, 'GET', '/api/auth/me', undefined, 'owner')).body.user.isOwner,
      true,
    );
    assert.equal(
      (await request(app, 'GET', '/api/auth/me', undefined, 'admin')).body.user.isOwner,
      false,
    );
    const profile = await request(
      app,
      'PUT',
      '/api/profile',
      { name: 'Admin biasa', address: 'Alamat lengkap fixture', isOwner: true, role: 'owner' },
      'admin',
    );
    assert.equal(profile.status, 200);
    assert.equal(profile.body.user.isOwner, false);
    assert.equal(
      (await request(app, 'GET', '/api/admin/email-settings', undefined, 'admin')).status,
      403,
    );
    assert.equal(
      (
        await request(app, 'POST', '/api/auth/register', {
          name: 'Pengunjung baru',
          address: 'Alamat lengkap pengunjung',
          email: 'new@fixture.test',
          password,
          isOwner: true,
          role: 'admin',
        })
      ).status,
      202,
    );
    const newcomer = app.db
      .prepare('SELECT id,role FROM users WHERE email=?')
      .get('new@fixture.test');
    assert.equal(newcomer.role, 'user');
    assert.equal(
      app.db.prepare('SELECT user_id FROM store_owners WHERE user_id=?').get(newcomer.id),
      undefined,
    );
    assert.equal(
      (await request(app, 'GET', '/api/admin/inventory', undefined, 'admin')).status,
      200,
    );
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM store_email_settings').get().n, 0);
  } finally {
    app.db.close();
  }
});

test('owner saves encrypted credentials with password confirmation, keeps blank SMTP secrets, and applies mail immediately', async () => {
  const mail = mailFixture(),
    app = appFor(mail);
  await seed(app);
  try {
    assert.equal(
      (
        await request(
          app,
          'POST',
          '/api/admin/email-settings',
          { revision: 0, currentPassword: 'wrong-password', settings },
          'owner',
        )
      ).status,
      401,
    );
    assert.equal((await save(app, 0, { publicUrl: 'http://remote.fixture.test/' })).status, 422);
    assert.equal((await save(app, 0, { port: 0 })).status, 422);
    assert.equal((await save(app, 0, { from: 'bad\nheader@fixture.test' })).status, 422);
    const saved = await save(app);
    assert.equal(saved.status, 200);
    assert.equal(saved.body.revision, 1);
    assert.equal(saved.body.passwordSet, true);
    assert.equal(saved.body.settings.password, undefined);
    const stored = app.db.prepare('SELECT payload FROM store_email_settings').get().payload;
    assert.doesNotMatch(stored, /smtp-secret|smtp-user|fixture\.test/);
    const snapshot = await request(app, 'GET', '/api/admin/email-settings', undefined, 'owner');
    assert.doesNotMatch(JSON.stringify(snapshot.body), /smtp-secret|queueKey|mail-key/);
    assert.equal(app.identity.ready, true);
    assert.equal((await request(app, 'GET', '/api/auth/features')).body.emailReady, true);
    const key = app.identity.key.toString('hex');
    assert.equal(
      (await request(app, 'POST', '/api/auth/verification/request', {}, 'owner')).status,
      202,
    );
    assert.equal((await save(app, 1, { password: '', host: 'smtp-two.fixture.test' })).status, 200);
    assert.equal(app.identity.key.toString('hex'), key);
    assert.equal(mail.configured.at(-1).BAM_SMTP_PASSWORD, settings.password);
    await app.identity.flushMail();
    assert.equal(mail.sent.at(-1).host, 'smtp-two.fixture.test');
    assert.equal(mail.sent.at(-1).to, 'owner@fixture.test');
    assert.match(mail.sent.at(-1).text, /verifikasi-email/);
    assert.equal((await save(app, 1)).status, 409);
    assert.equal(app.emailSettings.snapshot().revision, 2);
    const publicData = await request(app, 'GET', '/api/company');
    assert.doesNotMatch(JSON.stringify(publicData.body), /smtp-secret|smtp-user|queueKey|mail-key/);
  } finally {
    app.db.close();
  }
});

test('switching from existing server email settings preserves the queue key and pending verification links', async () => {
  const mail = mailFixture(),
    legacyKey = 'ab'.repeat(32);
  const app = appFor(mail, {
    mailer: { enabled: true, send: async (message) => mail.sent.push(message) },
    mailConfig: { publicUrl: 'https://legacy.fixture.test/', queueKey: legacyKey },
  });
  await seed(app);
  try {
    assert.equal(
      (await request(app, 'POST', '/api/auth/verification/request', {}, 'owner')).status,
      202,
    );
    const queued = app.db.prepare('SELECT payload FROM auth_mail_outbox').get().payload;
    assert.equal((await save(app)).status, 200);
    assert.equal(app.identity.key.toString('hex'), legacyKey);
    assert.equal(app.db.prepare('SELECT payload FROM auth_mail_outbox').get().payload, queued);
    await app.identity.flushMail();
    const message = mail.sent.at(-1);
    assert.match(message.text, /legacy\.fixture\.test/);
    const token = message.text.match(/token=([A-Za-z0-9_-]+)/)[1];
    assert.equal(
      (await request(app, 'POST', '/api/auth/verify-email', { token, password })).status,
      200,
    );
  } finally {
    app.db.close();
  }
});

test('test mail targets the signed-in owner only, enforces a cooldown and reports failures without leaking transport secrets', async () => {
  let time = Date.now();
  const mail = mailFixture(),
    app = appFor(mail, { now: () => time });
  await seed(app);
  try {
    assert.equal((await save(app)).status, 200);
    const body = { revision: 1, currentPassword: password, to: 'victim@fixture.test' };
    const result = await request(app, 'POST', '/api/admin/email-settings/test', body, 'owner');
    assert.equal(result.status, 200);
    assert.equal(result.body.lastTest.status, 'sent');
    assert.equal(mail.sent.at(-1).to, 'owner@fixture.test');
    assert.equal(
      (await request(app, 'POST', '/api/admin/email-settings/test', body, 'owner')).status,
      429,
    );
    time += 60001;
    mail.setFailure(true);
    const failure = await request(app, 'POST', '/api/admin/email-settings/test', body, 'owner');
    assert.equal(failure.status, 503);
    assert.equal(app.emailSettings.snapshot().lastTest.status, 'failed');
    assert.doesNotMatch(
      JSON.stringify([failure.body, mail.logs]),
      /smtp-secret-fixture|private-value|recipient token/,
    );
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM store_email_audit').get().n, 3);
  } finally {
    app.db.close();
  }
});

test('mail settings and queue keys persist across restart, and another worker refreshes the saved revision', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bam-owner-mail-')),
    filename = join(directory, 'shop.sqlite'),
    mail = mailFixture();
  let first = appFor(mail, { dbPath: filename }),
    second;
  try {
    await seed(first);
    assert.equal((await save(first)).status, 200);
    const key = readFileSync(filename + '.mail-key');
    assert.equal(key.length, 32);
    await request(first, 'POST', '/api/auth/verification/request', {}, 'owner');
    second = appFor(mail, { dbPath: filename });
    assert.equal(second.identity.ready, true);
    assert.equal(second.identity.key.toString('hex'), key.toString('hex'));
    assert.equal(
      (await save(first, 1, { host: 'smtp-updated.fixture.test', password: '' })).status,
      200,
    );
    assert.equal(
      (await request(second, 'GET', '/api/admin/email-settings', undefined, 'owner')).body.settings
        .host,
      'smtp-updated.fixture.test',
    );
    await second.identity.flushMail();
    assert.equal(mail.sent.at(-1).host, 'smtp-updated.fixture.test');
    first.db.close();
    first = null;
    second.db.close();
    second = appFor(mail, { dbPath: filename });
    assert.equal(second.emailSettings.snapshot().revision, 2);
    assert.equal(second.identity.key.toString('hex'), key.toString('hex'));
    assert.deepEqual(readFileSync(filename + '.mail-key'), key);
  } finally {
    first?.db.close();
    second?.db.close();
    assert.equal(dirname(directory), tmpdir());
    rmSync(directory, { recursive: true, force: true });
  }
});

test('revoking ownership during password confirmation prevents saving SMTP settings', async () => {
  let entered, release;
  const started = new Promise((resolve) => {
      entered = resolve;
    }),
    gate = new Promise((resolve) => {
      release = resolve;
    });
  const mail = mailFixture(),
    app = appFor(mail, {
      passwordCheck: async () => {
        entered();
        await gate;
        return true;
      },
    });
  await seed(app);
  let pending;
  try {
    pending = save(app);
    await started;
    app.db.prepare('DELETE FROM store_owners WHERE user_id=?').run('owner');
    release();
    assert.equal((await pending).status, 403);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM store_email_settings').get().n, 0);
  } finally {
    release();
    await pending;
    app.db.close();
  }
});

test('owner bootstrap is explicit and uses the same database without granting ordinary new admins ownership', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bam-owner-cli-')),
    filename = join(directory, 'shop.sqlite'),
    mail = mailFixture();
  let app;
  try {
    const run = (args) =>
      execFileSync(process.execPath, ['server/create-admin.js', ...args], {
        encoding: 'utf8',
        env: { ...process.env, BAM_DB_PATH: filename, BAM_ADMIN_PASSWORD: password },
      });
    assert.match(
      run(['admin@fixture.test', 'Admin biasa', 'Alamat lengkap fixture']),
      /Admin siap/,
    );
    app = appFor(mail, { dbPath: filename });
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM store_owners').get().n, 0);
    app.db.close();
    app = null;
    assert.match(
      run(['--owner', 'admin@fixture.test', 'Pemilik Toko', 'Alamat lengkap fixture']),
      /Pemilik toko siap/,
    );
    app = appFor(mail, { dbPath: filename });
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 1);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM store_owners').get().n, 1);
  } finally {
    app?.db.close();
    assert.equal(dirname(directory), tmpdir());
    rmSync(directory, { recursive: true, force: true });
  }
});
