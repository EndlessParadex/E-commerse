import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp, hashPassword } from './app.js';
import { randomUUID, createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { DatabaseSync } from 'node:sqlite';
import { OrderMessages } from './orderMessages.js';
const pass = 'fixture-password';
const admin = { id: 'operator', role: 'admin' },
  alice = { id: 'alice', role: 'user' },
  bob = { id: 'bob', role: 'user' };
async function fixture(options = {}) {
  let time = Date.now();
  const sent = [],
    app = createApp({
      dbPath: ':memory:',
      now: () => time,
      mailer: { enabled: true, send: async (x) => sent.push(x) },
      mailConfig: { publicUrl: 'https://fixture.test', queueKey: 'f'.repeat(64) },
      logger: () => {},
      ...options,
    });
  const encoded = await hashPassword(pass);
  for (const u of [admin, alice, bob]) {
    app.db
      .prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)')
      .run(
        u.id,
        u.id,
        u.id + '@fixture.test',
        'Alamat fixture lengkap',
        encoded,
        new Date(time).toISOString(),
        u.role,
      );
    app.db.prepare('INSERT INTO auth_account_state VALUES(?,?,0)').run(u.id, time);
    const token = createHash('sha256').update(u.id).digest('base64url');
    app.db
      .prepare('INSERT INTO sessions VALUES(?,?,?)')
      .run(createHash('sha256').update(token).digest('hex'), u.id, time + 30 * 86400000);
  }
  const settings = app.company.snapshot();
  app.company.save({
    ...settings,
    profile: {
      ...settings.profile,
      bankName: 'Bank Fixture',
      bankAccount: '12345678',
      bankHolder: 'Perusahaan Fixture',
    },
  });
  return { app, sent, advance: (n) => (time += n) };
}
function input(n = 1, paymentId = 'cod') {
  return {
    requestKey: randomUUID(),
    recipient: 'Pembeli fixture',
    address: 'Alamat fixture lengkap',
    shippingId: 'regular',
    paymentId,
    items: [{ id: 'snack-pedas', quantity: n, expectedPrice: 18000 }],
  };
}
async function request(app, method, path, body, user) {
  const req = Readable.from(body ? [JSON.stringify(body)] : []);
  req.method = method;
  req.url = path;
  req.socket = { remoteAddress: '192.0.2.1' };
  req.headers = {
    host: 'fixture.test',
    'content-type': 'application/json',
    ...(user
      ? { cookie: 'bam_session=' + createHash('sha256').update(user.id).digest('base64url') }
      : {}),
  };
  let result;
  await app.handler(req, {
    writeHead(status, headers) {
      result = { status, headers };
    },
    end(v) {
      result.body = Buffer.isBuffer(v) ? v : JSON.parse(v);
    },
  });
  return result;
}
const approve = (app, order) =>
  app.workflow.update(admin, order.id, {
    action: order.payment.groupId === 'cod' ? 'confirm_cod' : 'approve_payment',
    revision: order.revision,
    shippingCost: 35000,
    courier: 'Kurir toko',
  });
const accept = (app, order, user = alice) =>
  app.workflow.update(user, order.id, { action: 'accept_quote', revision: order.revision });
const image =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9i0AAAAASUVORK5CYII=';

test('v31: verified-only requests; only configured payment methods; shipping pending, final acceptance starts payment timer', async () => {
  const { app, advance } = await fixture();
  try {
    app.db.prepare('DELETE FROM auth_account_state WHERE user_id=?').run(bob.id);
    assert.equal((await request(app, 'POST', '/api/orders', input(), bob)).status, 403);
    assert.throws(() => app.workflow.create(alice, input(1, 'va-bca')), {
      code: 'payment_unavailable',
    });
    let order = app.workflow.create(alice, input(1, 'manual-transfer'));
    assert.equal(order.shipping.quoted, false);
    assert.equal(order.shipping.cost, 0);
    assert.equal(order.total, order.subtotal);
    advance(25 * 3600000);
    app.workflow.tick();
    order = app.workflow.get(alice, order.id);
    assert.equal(order.status, 'awaiting_review');
    assert.throws(
      () => app.workflow.update(admin, order.id, { action: 'approve_payment', revision: 0 }),
      { status: 422 },
    );
    order = approve(app, order);
    assert.equal(order.status, 'awaiting_acceptance');
    assert.equal(order.payment.expiresAt, undefined);
    assert.equal(order.total, 53000);
    assert.equal(order.payment.destination.account, '12345678');
    advance(31 * 60000);
    app.workflow.tick();
    assert.equal(app.workflow.get(alice, order.id).status, 'awaiting_acceptance');
    const accepted = accept(app, order);
    assert.equal(accepted.status, 'awaiting_payment');
    assert.equal(accepted.payment.expiresAt - app.workflow.now(), 30 * 60000);
    assert.equal(app.workflow.stock().stock['snack-pedas:180-g'].available, 119);
  } finally {
    app.db.close();
  }
});

test('v31: competing requests get a clear stock cancellation; reserving and hard expiry remain atomic', async () => {
  const { app, advance } = await fixture();
  try {
    let a = app.workflow.create(alice, input(80)),
      b = app.workflow.create(bob, input(80));
    a = approve(app, a);
    b = approve(app, b);
    assert.equal(a.status, 'awaiting_acceptance');
    assert.equal(b.status, 'cancelled');
    assert.match(b.cancellationReason, /Stok tidak cukup/);
    assert.equal(app.workflow.stock().stock['snack-pedas:180-g'].available, 40);
    assert.ok(
      app.db
        .prepare("SELECT id FROM order_mail WHERE order_id=? AND kind='orderCancelled'")
        .get(b.id),
    );
    advance(86400000);
    app.workflow.tick();
    assert.equal(app.workflow.get(alice, a.id).status, 'expired');
    assert.equal(app.workflow.stock().stock['snack-pedas:180-g'].available, 120);
    app.workflow.tick();
    assert.equal(app.workflow.stock().stock['snack-pedas:180-g'].available, 120);
  } finally {
    app.db.close();
  }
});

test('v31: proof is owner-only, private, not payment confirmation; pending evidence survives deadline until staff review', async () => {
  const { app, advance } = await fixture();
  try {
    let order = accept(app, approve(app, app.workflow.create(alice, input(1, 'manual-transfer'))));
    let response = await request(
      app,
      'POST',
      '/api/orders/' + order.id + '/proof',
      { revision: order.revision, image },
      bob,
    );
    assert.equal(response.status, 404);
    response = await request(
      app,
      'POST',
      '/api/orders/' + order.id + '/proof',
      { revision: order.revision, image },
      alice,
    );
    assert.equal(response.status, 200);
    order = response.body.order;
    assert.equal(order.payment.status, 'proof_submitted');
    assert.equal((await request(app, 'GET', order.payment.proof.url)).status, 401);
    assert.equal((await request(app, 'GET', order.payment.proof.url, undefined, bob)).status, 404);
    assert.equal(
      (await request(app, 'GET', order.payment.proof.url, undefined, admin)).headers[
        'cache-control'
      ],
      'private, no-store',
    );
    advance(31 * 60000);
    app.workflow.tick();
    assert.equal(app.workflow.get(alice, order.id).status, 'awaiting_payment');
    assert.throws(
      () => app.workflow.update(alice, order.id, { action: 'cancel', revision: order.revision }),
      { status: 409 },
    );
    order = app.workflow.update(admin, order.id, {
      action: 'reject_proof',
      revision: order.revision,
      reason: 'Nominal belum cocok',
    });
    assert.equal(order.payment.proof.status, 'rejected');
    assert.match(order.payment.proof.reason, /Nominal/);
    order = app.workflow.update(alice, order.id, {
      action: 'submit_proof',
      revision: order.revision,
      image,
    });
    order = app.workflow.update(admin, order.id, {
      action: 'paid',
      revision: order.revision,
      reference: 'BANK-FIXTURE-01',
    });
    assert.equal(order.payment.status, 'paid');
    assert.equal(order.payment.proof.status, 'accepted');
    assert.equal(order.status, 'processing');
  } finally {
    app.db.close();
  }
});

test('v31: notifications cover admin, approval, reminder, shipping and cancellation; retries do not duplicate successful sends', async () => {
  const { app, sent, advance } = await fixture();
  try {
    let order = app.workflow.create(alice, input(1, 'manual-transfer'));
    await app.messages.flush();
    assert.ok(sent.some((x) => x.to === 'operator@fixture.test' && x.subject.includes('baru')));
    order = approve(app, order);
    await app.messages.flush();
    assert.ok(sent.some((x) => x.to === 'alice@fixture.test' && x.subject.includes('Total akhir')));
    order = accept(app, order);
    await app.messages.flush();
    advance(26 * 60000);
    app.workflow.tick();
    app.workflow.tick();
    await app.messages.flush();
    assert.equal(sent.filter((x) => x.subject.includes('segera berakhir')).length, 1);
    order = app.workflow.get(alice, order.id);
    order = app.workflow.update(admin, order.id, {
      action: 'paid',
      revision: order.revision,
      reference: 'BANK-01',
    });
    order = app.workflow.update(admin, order.id, {
      action: 'ship',
      revision: order.revision,
      courier: 'JNE',
      trackingNumber: 'RESI-01',
    });
    await app.messages.flush();
    assert.ok(sent.some((x) => x.subject.includes('dikirim') && x.text.includes('RESI-01')));
    const count = sent.length;
    await app.messages.flush();
    assert.equal(sent.length, count);
    let cancelled = app.workflow.create(bob, input());
    app.workflow.update(admin, cancelled.id, {
      action: 'cancel',
      revision: 0,
      reason: 'Pembeli meminta pembatalan',
    });
    await app.messages.flush();
    assert.ok(sent.some((x) => x.to === 'bob@fixture.test' && x.text.includes('Pembeli meminta')));
    assert.equal((await request(app, 'GET', '/api/admin/readiness', undefined, alice)).status, 403);
  } finally {
    app.db.close();
  }
});

test('v31: no SMTP accepts an unverified registration using its original password; ordering remains blocked', async () => {
  const { app } = await fixture({ mailer: { enabled: false } });
  try {
    const fields = {
      name: 'Pendaftar Baru',
      email: 'new@fixture.test',
      address: 'Alamat pendaftar lengkap',
      password: pass,
    };
    assert.equal((await request(app, 'POST', '/api/auth/register', fields)).status, 202);
    const login = await request(app, 'POST', '/api/auth/login', {
      email: fields.email,
      password: pass,
    });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.emailVerified, false);
    const cookie = login.headers['set-cookie'].split(';')[0];
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM auth_mail_outbox').get().n, 0);
    const readiness = await request(app, 'GET', '/api/admin/readiness', undefined, admin);
    assert.equal(readiness.body.emailReady, false);
    const user = { id: login.body.user.id, role: 'user' };
    assert.throws(() => app.workflow.create(user, input()), {
      code: 'email_verification_required',
    });
    assert.ok(cookie);
  } finally {
    app.db.close();
  }
});
import { mkdtempSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
function cleanFixture(directory) {
  const target = realpathSync(directory);
  assert.equal(dirname(target), realpathSync(tmpdir()));
  assert.ok(basename(target).startsWith('bam-v31-'));
  rmSync(target, { recursive: true, force: true });
}
const configuration = { publicUrl: 'https://fixture.test', queueKey: 'f'.repeat(64) };

test('v31: recovery email budget is shared across requests and capped at six per rolling day', async () => {
  const { app, sent, advance } = await fixture();
  try {
    for (let i = 0; i < 7; i++) {
      assert.equal(
        (await request(app, 'POST', '/api/auth/forgot-password', { email: 'alice@fixture.test' }))
          .status,
        202,
      );
      await app.identity.flushMail(100);
      advance(3600000);
    }
    assert.equal(sent.length, 6);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM auth_email_daily').get().n, 6);
    advance(24 * 3600000);
    await request(app, 'POST', '/api/auth/forgot-password', { email: 'alice@fixture.test' });
    await app.identity.flushMail();
    assert.equal(sent.length, 7);
  } finally {
    app.db.close();
  }
});

test('v31: source/account order limits do not break retries and a later bank change cannot rewrite payment instructions', async () => {
  const { app } = await fixture();
  try {
    let first;
    for (let i = 0; i < 20; i++) {
      const body = input(),
        order = app.workflow.create(alice, body);
      if (!first) first = { body, order };
      app.workflow.update(alice, order.id, {
        action: 'cancel',
        revision: 0,
        reason: 'Batal fixture',
      });
    }
    assert.throws(() => app.workflow.create(alice, input()), { status: 429 });
    assert.equal(app.workflow.create(alice, first.body).id, first.order.id);
    const order = approve(app, app.workflow.create(bob, input(1, 'manual-transfer')));
    const profile = app.company.snapshot();
    app.company.save({ ...profile, profile: { ...profile.profile, bankAccount: '99999999' } });
    assert.equal(app.workflow.get(bob, order.id).payment.destination.account, '12345678');
  } finally {
    app.db.close();
  }
});

test('v31: failed order email is visible, survives restart, retries safely and workers lease distinct deliveries', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bam-v31-mail-')),
    dbPath = join(directory, 'fixture.sqlite');
  let app, other;
  let now,
    sent = [];
  try {
    ({ app } = await fixture({ dbPath }));
    now = app.workflow.now;
    app.identity.mailer.send = async () => {
      throw new Error('SMTP private credential not logged');
    };
    await request(app, 'POST', '/api/auth/forgot-password', { email: 'alice@fixture.test' });
    await app.identity.flushMail(1);
    const order = app.workflow.create(alice, input());
    await app.messages.flush(1);
    let status = await request(app, 'GET', '/api/admin/readiness', undefined, admin);
    assert.equal(status.body.failedMessages.length, 1);
    assert.equal(status.body.accountDelivery.retrying, 1);
    app.db.close();
    app = createApp({
      dbPath,
      now,
      mailConfig: configuration,
      mailer: { enabled: true, send: async (m) => sent.push(m) },
      logger: () => {},
    });
    const id = app.db.prepare('SELECT id FROM order_mail WHERE attempts>0').get().id;
    assert.equal(
      (
        await request(
          app,
          'POST',
          '/api/admin/notifications/' + encodeURIComponent(id) + '/retry',
          {},
          alice,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await request(
          app,
          'POST',
          '/api/admin/notifications/' + encodeURIComponent(id) + '/retry',
          {},
          admin,
        )
      ).body.retried,
      true,
    );
    let release, entered;
    const gate = new Promise((r) => (release = r)),
      started = new Promise((r) => (entered = r));
    app.identity.mailer.send = async (message) => {
      entered();
      await gate;
      sent.push(message);
    };
    other = createApp({
      dbPath,
      now,
      mailConfig: configuration,
      mailer: { enabled: true, send: async (m) => sent.push(m) },
      logger: () => {},
    });
    const first = app.messages.flush(1);
    await started;
    assert.equal(await other.messages.flush(1), 1);
    release();
    assert.equal(await first, 1);
    assert.equal(sent.filter((m) => m.to === 'alice@fixture.test').length, 1);
    assert.equal(sent.filter((m) => m.to === 'operator@fixture.test').length, 1);
    assert.equal(await other.messages.flush(8), 0);
    assert.equal(app.workflow.get(alice, order.id).status, 'awaiting_confirmation');
  } finally {
    if (other?.db.isOpen) other.db.close();
    if (app?.db.isOpen) app.db.close();
    cleanFixture(directory);
  }
});

test('v31: quote expiry during downtime releases once and queues the customer notification at startup', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bam-v31-expiry-')),
    dbPath = join(directory, 'fixture.sqlite');
  let app;
  try {
    const fixtureValue = await fixture({ dbPath });
    app = fixtureValue.app;
    const order = approve(app, app.workflow.create(alice, input()));
    fixtureValue.advance(86400000);
    const now = app.workflow.now;
    app.db.close();
    app = createApp({
      dbPath,
      now,
      mailConfig: configuration,
      mailer: { enabled: true, send: async () => {} },
      logger: () => {},
    });
    assert.equal(app.workflow.get(alice, order.id).status, 'expired');
    assert.equal(app.workflow.stock().stock['snack-pedas:180-g'].available, 120);
    assert.equal(
      app.db
        .prepare("SELECT COUNT(*) AS n FROM order_mail WHERE order_id=? AND kind='quoteExpired'")
        .get(order.id).n,
      1,
    );
    app.workflow.tick();
    assert.equal(
      app.db
        .prepare("SELECT COUNT(*) AS n FROM inventory_events WHERE order_id=? AND action='expire'")
        .get(order.id).n,
      1,
    );
  } finally {
    if (app?.db.isOpen) app.db.close();
    cleanFixture(directory);
  }
});

test('v31: old unpaid VA requests migrate once to a new quote; shipped history is not amended', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bam-v31-migration-')),
    dbPath = join(directory, 'fixture.sqlite');
  let app;
  try {
    ({ app } = await fixture({ dbPath }));
    let pending = accept(
      app,
      approve(app, app.workflow.create(alice, input(1, 'manual-transfer'))),
    );
    delete pending.commerceVersion;
    delete pending.quote;
    pending.payment.id = 'va-bca';
    pending.payment.groupId = 'va';
    pending.payment.label = 'BCA Virtual Account';
    app.workflow.writeOrder(pending);
    let shipped = accept(app, approve(app, app.workflow.create(bob, input())), bob);
    shipped = app.workflow.update(admin, shipped.id, {
      action: 'ship',
      revision: shipped.revision,
      courier: 'Fixture',
      trackingNumber: 'RESI-MIGRATE',
    });
    delete shipped.commerceVersion;
    app.workflow.writeOrder(shipped);
    app.db.exec('DELETE FROM commerce_v31_migrations');
    app.db.close();
    app = createApp({ dbPath, mailer: { enabled: false } });
    const changed = app.workflow.get(alice, pending.id);
    assert.equal(changed.commerceVersion, 31);
    assert.equal(changed.status, 'awaiting_review');
    assert.equal(changed.payment.id, 'manual-transfer');
    assert.equal(changed.inventoryReserved, false);
    assert.equal(changed.shipping.quoted, false);
    assert.equal(changed.migratedQuote.payment, 'BCA Virtual Account');
    assert.equal(app.workflow.stock().stock['snack-pedas:180-g'].available, 119);
    assert.equal(app.workflow.get(bob, shipped.id).shipping.trackingNumber, 'RESI-MIGRATE');
    const version = changed.revision;
    app.db.close();
    app = createApp({ dbPath, mailer: { enabled: false } });
    assert.equal(app.workflow.get(alice, pending.id).revision, version);
  } finally {
    if (app?.db.isOpen) app.db.close();
    cleanFixture(directory);
  }
});

test('v40: old mail tables migrate idempotently without inventing a reason for historical skips', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(
      'CREATE TABLE order_mail(id TEXT PRIMARY KEY,order_id TEXT NOT NULL,kind TEXT NOT NULL,recipient_id TEXT NOT NULL,admin INTEGER NOT NULL,created_at INTEGER NOT NULL,status TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,next_attempt INTEGER NOT NULL,leased_until INTEGER NOT NULL DEFAULT 0,sent_at INTEGER)',
    );
    db.prepare(
      'INSERT INTO order_mail(id,order_id,kind,recipient_id,admin,created_at,status,next_attempt) VALUES(?,?,?,?,?,?,?,?)',
    ).run('legacy', 'order', 'orderCreated', 'buyer', 0, 1, 'skipped', 1);
    const first = new OrderMessages(
      db,
      {},
      {},
      () => 100,
      () => {},
    );
    const second = new OrderMessages(
      db,
      {},
      {},
      () => 100,
      () => {},
    );
    assert.deepEqual(
      first.skippedSummary().map((row) => ({ ...row })),
      [{ reason: '', count: 1 }],
    );
    assert.equal(second.skippedSummary()[0].count, 1);
    assert.equal(
      db
        .prepare('PRAGMA table_info(order_mail)')
        .all()
        .filter((column) => column.name === 'skip_reason').length,
      1,
    );
    assert.equal(db.prepare('SELECT recipient_id FROM order_mail').get().recipient_id, 'buyer');
  } finally {
    db.close();
  }
});

test('v40: skipped mail records its actual cause and cannot be retried, without sending obsolete notices', async () => {
  const { app, sent } = await fixture();
  try {
    const order = app.workflow.create(alice, input());
    app.db.prepare('DELETE FROM order_mail').run();
    const now = app.workflow.now();
    const cases = [
      { id: 'missing-order', orderId: 'missing', reason: 'order_missing' },
      { id: 'missing-user', recipient: 'missing', reason: 'recipient_missing' },
      {
        id: 'inactive-admin',
        recipient: admin.id,
        admin: 1,
        reason: 'recipient_inactive',
        setup: () =>
          app.db
            .prepare('INSERT INTO account_access(user_id,disabled_at) VALUES(?,?)')
            .run(admin.id, now),
        cleanup: () => app.db.prepare('DELETE FROM account_access WHERE user_id=?').run(admin.id),
      },
      {
        id: 'unverified',
        reason: 'email_unverified',
        setup: () =>
          app.db
            .prepare('UPDATE auth_account_state SET verified_at=NULL WHERE user_id=?')
            .run(alice.id),
        cleanup: () =>
          app.db
            .prepare('UPDATE auth_account_state SET verified_at=? WHERE user_id=?')
            .run(now, alice.id),
      },
      { id: 'role-changed', recipient: bob.id, admin: 1, reason: 'recipient_role_changed' },
      { id: 'changed-order', kind: 'orderApproved', reason: 'order_changed' },
      { id: 'changed-proof', kind: 'proofSubmitted', reason: 'order_changed' },
      { id: 'too-old', createdAt: now - 8 * 86400000, reason: 'too_old' },
    ];
    for (const item of cases) {
      item.setup?.();
      app.db
        .prepare(
          'INSERT INTO order_mail(id,order_id,kind,recipient_id,admin,created_at,status,next_attempt,attempts) VALUES(?,?,?,?,?,?,?,?,?)',
        )
        .run(
          item.id,
          item.orderId || order.id,
          item.kind || 'orderCreated',
          item.recipient || alice.id,
          item.admin || 0,
          item.createdAt || now,
          'queued',
          now,
          2,
        );
      await app.messages.flush(1);
      const stored = app.db
        .prepare('SELECT status,skip_reason,leased_until FROM order_mail WHERE id=?')
        .get(item.id);
      assert.equal(stored.status, 'skipped', item.id);
      assert.equal(stored.skip_reason, item.reason, item.id);
      assert.equal(stored.leased_until, 0);
      assert.equal(app.messages.retry(item.id), false);
      item.cleanup?.();
    }
    assert.equal(sent.length, 0);
    const readiness = await request(app, 'GET', '/api/admin/readiness', undefined, admin);
    assert.equal(readiness.status, 200);
    assert.equal(readiness.body.failedMessages.length, 0, 'skipped mail never offers a retry');
    assert.equal(
      readiness.body.skippedReasons.reduce((sum, row) => sum + row.count, 0),
      cases.length,
    );
    assert.ok(
      readiness.body.skippedReasons.every(
        (row) => Object.keys(row).sort().join(',') === 'count,reason',
      ),
    );
    assert.doesNotMatch(JSON.stringify(readiness.body), /@fixture|password|recipient_id/);
    assert.equal((await request(app, 'GET', '/api/admin/readiness', undefined, alice)).status, 403);
    assert.equal((await request(app, 'GET', '/api/admin/readiness')).status, 401);
    assert.equal(app.workflow.get(alice, order.id).status, 'awaiting_confirmation');
  } finally {
    app.db.close();
  }
});

test('v40: readiness offers retries only for failed attempts with an available lease', async () => {
  const { app } = await fixture();
  try {
    const order = app.workflow.create(alice, input());
    app.db.prepare('DELETE FROM order_mail').run();
    const now = app.workflow.now();
    for (const [id, status, attempts, lease] of [
      ['failed', 'failed', 10, 0],
      ['queued', 'queued', 1, 0],
      ['leased', 'queued', 1, now + 60000],
      ['sending', 'sending', 1, now + 60000],
      ['new', 'queued', 0, 0],
      ['skipped', 'skipped', 2, 0],
    ])
      app.db
        .prepare(
          'INSERT INTO order_mail(id,order_id,kind,recipient_id,admin,created_at,status,next_attempt,attempts,leased_until) VALUES(?,?,?,?,?,?,?,?,?,?)',
        )
        .run(id, order.id, 'orderCreated', alice.id, 0, now, status, now, attempts, lease);
    const result = (await request(app, 'GET', '/api/admin/readiness', undefined, admin)).body;
    assert.deepEqual(result.failedMessages.map((row) => row.id).sort(), [
      'failed',
      'leased',
      'queued',
    ]);
    assert.equal(result.failedMessages.find((row) => row.id === 'leased').canRetry, false);
    assert.equal(result.failedMessages.find((row) => row.id === 'failed').canRetry, true);
    assert.equal(app.messages.retry('leased'), false);
    assert.equal(app.messages.retry('skipped'), false);
    assert.equal(app.messages.retry('failed'), true);
    assert.equal(app.messages.retry('failed'), false, 'double retry cannot claim a new attempt');
    app.db.prepare("UPDATE order_mail SET created_at=? WHERE id='sending'").run(now - 8 * 86400000);
    await app.messages.flush(1);
    assert.equal(
      app.db.prepare("SELECT status FROM order_mail WHERE id='sending'").get().status,
      'sending',
      'age cleanup respects the active worker lease',
    );
  } finally {
    app.db.close();
  }
});
