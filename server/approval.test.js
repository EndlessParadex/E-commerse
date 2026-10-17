import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createApp, hashPassword } from './app.js';

const secret = 'approval-secret-password';
async function request(app, method, url, body, cookie) {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  req.method = method;
  req.url = url;
  req.socket = { remoteAddress: '192.0.2.41' };
  req.headers = {
    host: 'approval.fixture',
    origin: 'http://approval.fixture',
    'content-type': 'application/json',
    ...(cookie ? { cookie } : {}),
  };
  let output;
  await app.handler(req, {
    writeHead(status, headers) { output = { status, headers }; },
    end(value) { output.body = JSON.parse(value); },
  });
  return output;
}
const cookie = response => response.headers['set-cookie'].split(';')[0];
async function seedManager(app, id, role = 'admin') {
  app.db.prepare(
    'INSERT INTO users(id,name,email,address,password_hash,created_at,role) VALUES(?,?,?,?,?,?,?)',
  ).run(id, id, id + '@fixture.test', 'Alamat pengelola lengkap', await hashPassword(secret),
    new Date().toISOString(), role);
  return cookie(await request(app, 'POST', '/api/auth/login', {
    email: id + '@fixture.test', password: secret,
  }));
}
async function register(app, email) {
  return request(app, 'POST', '/api/auth/register', {
    name: 'Pelanggan Baru',
    email,
    address: 'Alamat pelanggan yang lengkap',
    password: secret,
    role: 'admin',
    approvalStatus: 'approved',
  });
}
async function decide(app, id, actor, action, revision = 0, reason = 'Pemeriksaan pelanggan') {
  return request(app, 'POST', '/api/admin/approvals/' + encodeURIComponent(id), {
    action, revision, reason, currentPassword: secret,
  }, actor);
}
test('pendaftaran baru menunggu persetujuan; owner dan admin dapat menyetujui tanpa membuka hak kelola akun', async () => {
  const app = createApp({
    dbPath: ':memory:', mailer: { enabled: false }, mailConfig: {}, logger: () => {},
  });
  try {
    const owner = await seedManager(app, 'owner');
    const admin = await seedManager(app, 'operator');
    app.db.prepare('INSERT INTO store_owners VALUES(?,?)').run('owner', new Date().toISOString());
    const email = 'new-customer@fixture.test';
    const signup = await register(app, email);
    assert.equal(signup.status, 202);
    assert.equal(signup.body.user, undefined);
    const row = app.db.prepare('SELECT id,role FROM users WHERE email=?').get(email);
    assert.equal(row.role, 'user');
    assert.equal(app.db.prepare('SELECT status FROM account_approvals WHERE user_id=?').get(row.id).status, 'pending');
    const login = await request(app, 'POST', '/api/auth/login', { email, password: secret });
    assert.equal(login.status, 403);
    assert.equal(login.body.error, 'approval_required');
    assert.equal(login.headers['set-cookie'], undefined);
    assert.equal((await request(app, 'GET', '/api/admin/approvals')).status, 401);
    assert.equal((await request(app, 'GET', '/api/admin/approvals', undefined, owner)).body.total, 1);
    assert.equal((await request(app, 'GET', '/api/admin/approvals', undefined, admin)).body.total, 1);
    assert.equal((await request(app, 'GET', '/api/admin/accounts', undefined, admin)).status, 403);
    assert.equal((await decide(app, row.id, admin, 'approve')).status, 200);
    assert.equal((await decide(app, row.id, owner, 'approve')).status, 409);
    const allowed = await request(app, 'POST', '/api/auth/login', { email, password: secret });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.body.user.role, 'user');
    assert.equal(allowed.body.user.emailVerified, false);
    assert.equal((await request(app, 'POST', '/api/orders', {}, cookie(allowed))).status, 422);
    const audit = app.db.prepare("SELECT actor_id FROM account_management_audit WHERE action='registration:approve'").get();
    assert.equal(audit.actor_id, 'operator');
  } finally { app.db.close(); }
});
test('penolakan memblokir login dan sesi; revisi mencegah keputusan berulang; owner dapat membalik penolakan', async () => {
  const app = createApp({
    dbPath: ':memory:', mailer: { enabled: false }, mailConfig: {}, logger: () => {},
  });
  try {
    const owner = await seedManager(app, 'owner');
    app.db.prepare('INSERT INTO store_owners VALUES(?,?)').run('owner', new Date().toISOString());
    const admin = await seedManager(app, 'operator');
    const email = 'rejected@fixture.test';
    await register(app, email);
    const id = app.db.prepare('SELECT id FROM users WHERE email=?').get(email).id;
    const passwordFailure = await request(app, 'POST', '/api/admin/approvals/' + id, {
      action: 'reject', reason: 'Permintaan perlu ditolak', revision: 0, currentPassword: 'bad-password',
    }, admin);
    assert.equal(passwordFailure.status, 401);
    assert.equal((await decide(app, id, admin, 'reject')).status, 200);
    assert.equal((await request(app, 'POST', '/api/auth/login', { email, password: secret })).status, 403);
    assert.equal((await decide(app, id, admin, 'reject', 1)).status, 409);
    assert.equal((await decide(app, id, owner, 'approve', 0)).status, 409);
    assert.equal((await decide(app, id, owner, 'approve', 1)).status, 200);
    assert.equal((await request(app, 'POST', '/api/auth/login', { email, password: secret })).status, 200);
  } finally { app.db.close(); }
});
test('akun lama tanpa catatan persetujuan tetap aktif; pembeli tidak dapat menyetujui diri sendiri', async () => {
  const app = createApp({
    dbPath: ':memory:', mailer: { enabled: false }, mailConfig: {}, logger: () => {},
  });
  try {
    const buyer = await seedManager(app, 'legacy-buyer', 'user');
    assert.equal((await request(app, 'GET', '/api/auth/me', undefined, buyer)).status, 200);
    assert.equal((await request(app, 'GET', '/api/admin/approvals', undefined, buyer)).status, 403);
    assert.equal((await request(app, 'POST', '/api/admin/approvals/legacy-buyer', {
      action: 'approve', revision: 0, reason: 'Menaikkan hak sendiri', currentPassword: secret,
    }, buyer)).status, 403);
  } finally { app.db.close(); }
});

test('verifikasi email tidak melewati approval; sesi pending juga tidak dapat menggunakan API', async () => {
  const outbox = [];
  const app = createApp({
    dbPath: ':memory:',
    mailer: { enabled: true, send: async message => outbox.push(message) },
    mailConfig: { publicUrl: 'https://approval.fixture/', queueKey: 'a'.repeat(64) },
    logger: () => {},
  });
  try {
    const admin = await seedManager(app, 'operator');
    const email = 'verified-pending@fixture.test';
    await register(app, email);
    const id = app.db.prepare('SELECT id FROM users WHERE email=?').get(email).id;
    await app.identity.flushMail();
    const token = outbox.find(message => message.to === email)?.text.match(/token=([A-Za-z0-9_-]+)/)?.[1];
    assert.ok(token);
    assert.equal((await request(app, 'POST', '/api/auth/verify-email', { token, password: secret })).status, 200);
    assert.equal(app.identity.verified(id), true);
    const sessionToken = 'x'.repeat(43);
    const { createHash } = await import('node:crypto');
    app.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(
      createHash('sha256').update(sessionToken).digest('hex'), id, Date.now() + 60000,
    );
    assert.equal((await request(app, 'GET', '/api/auth/me', undefined, 'bam_session=' + sessionToken)).status, 401);
    assert.equal((await request(app, 'POST', '/api/auth/login', { email, password: secret })).status, 403);
    assert.equal((await decide(app, id, admin, 'approve')).status, 200);
    const login = await request(app, 'POST', '/api/auth/login', { email, password: secret });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.emailVerified, true);
  } finally { app.db.close(); }
});

test('tautan verifikasi pendaftaran dapat diminta ulang tanpa login; akun asing dan yang telah diverifikasi tidak dibocorkan', async () => {
  const sent = [];
  const app = createApp({
    dbPath: ':memory:',
    mailer: { enabled: true, send: async message => sent.push(message) },
    mailConfig: { publicUrl: 'https://approval.fixture/', queueKey: 'a'.repeat(64) },
    logger: () => {},
  });
  try {
    const email = 'resend-customer@fixture.test';
    await register(app, email);
    const row = app.db.prepare('SELECT id FROM users WHERE email=?').get(email);
    assert.equal((await request(app, 'POST', '/api/auth/verification/resend', { email })).status, 202);
    await app.identity.flushMail(10);
    assert.ok(sent.some(message => message.to === email));
    const token = sent.at(-1).text.match(/token=([A-Za-z0-9_-]+)/)?.[1];
    assert.ok(token);
    assert.equal((await request(app, 'POST', '/api/auth/verify-email', { token, password: secret })).status, 200);
    assert.equal(app.identity.verified(row.id), true);
    const before = app.db.prepare('SELECT COUNT(*) AS n FROM auth_tokens').get().n;
    const verified = await request(app, 'POST', '/api/auth/verification/resend', { email });
    const unknown = await request(app, 'POST', '/api/auth/verification/resend', { email: 'not-found@fixture.test' });
    assert.equal(verified.status, 202);
    assert.equal(unknown.status, 202);
    assert.deepEqual(verified.body, unknown.body);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM auth_tokens').get().n, before);
  } finally { app.db.close(); }
});
