import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { mkdtempSync, existsSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app.js';

const phone = '+6281234567890';
async function fixture({ dbPath = ':memory:', enabled = true, send } = {}) {
  let time = Date.now();
  const sent = [],
    cookies = {};
  const options = {
    dbPath,
    now: () => time,
    mailer: { enabled: false },
    mailConfig: {},
    logger: () => {},
    whatsappSender: {
      enabled,
      send:
        send ||
        (async (value) => {
          sent.push(value);
        }),
    },
  };
  let app = createApp(options);
  const request = async (method, path, body, actor, origin) => {
    const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
    Object.assign(req, {
      method,
      url: path,
      headers: {
        host: 'fixture.test',
        'content-type': 'application/json',
        ...(actor ? { cookie: cookies[actor] } : {}),
        ...(origin ? { origin } : {}),
      },
      socket: { remoteAddress: '192.0.2.1' },
    });
    let reply;
    await app.handler(req, {
      writeHead(status, headers) {
        reply = { status, headers };
      },
      end(value) {
        reply.body = JSON.parse(value);
      },
    });
    return reply;
  };
  for (const id of ['first', 'second', 'owner']) {
    app.db
      .prepare(
        'INSERT INTO users(id,name,email,address,password_hash,created_at,role) VALUES(?,?,?,?,?,?,?)',
      )
      .run(
        id,
        'Akun ' + id,
        id + '@fixture.test',
        'Alamat pelanggan yang lengkap',
        'fixture-password-hash',
        new Date().toISOString(),
        id === 'owner' ? 'admin' : 'user',
      );
    const token = createHash('sha256').update(id).digest('base64url');
    cookies[id] = 'bam_session=' + token;
    app.db
      .prepare('INSERT INTO sessions VALUES(?,?,?)')
      .run(createHash('sha256').update(token).digest('hex'), id, Date.now() + 86400000);
  }
  app.db.prepare('INSERT INTO store_owners(user_id,granted_at) VALUES(?,?)').run('owner', time);
  await request('PUT', '/api/profile/phone', { phone }, 'first');
  return {
    get app() {
      return app;
    },
    request,
    sent,
    get time() {
      return time;
    },
    advance(ms) {
      time += ms;
    },
    restart() {
      app.db.close();
      app = createApp(options);
    },
    close() {
      app.db.close();
    },
  };
}
const state = (f) => f.request('GET', '/api/profile/phone/verification', undefined, 'first');
const issue = (f) =>
  f.request('POST', '/api/profile/phone/verification/request', { phone }, 'first');
const confirm = (f, challenge, code, actor = 'first') =>
  f.request(
    'POST',
    '/api/profile/phone/verification/confirm',
    { phone, challengeId: challenge.id, code },
    actor,
  );

test('phone confirmation requires a private received OTP; owner sees independent email and phone evidence', async () => {
  const f = await fixture();
  try {
    for (const [method, path, body] of [
      ['GET', '/api/profile/phone/verification'],
      ['POST', '/api/profile/phone/verification/request', { phone }],
      ['POST', '/api/profile/phone/verification/confirm', { code: '123456' }],
    ])
      assert.equal((await f.request(method, path, body)).status, 401);
    assert.equal(
      (
        await f.request(
          'POST',
          '/api/profile/phone/verification/request',
          { phone },
          'first',
          'https://other.test',
        )
      ).status,
      403,
    );
    const sent = await issue(f);
    assert.equal(sent.status, 200);
    assert.equal(sent.body.phoneVerified, false);
    assert.equal(sent.body.code, undefined);
    assert.equal(f.sent.length, 1);
    const challenge = sent.body.challenge,
      code = f.sent[0].code;
    assert.match(code, /^\d{6}$/);
    const stored = f.app.db.prepare('SELECT code_hash FROM phone_otp_challenges').get();
    assert.notEqual(stored.code_hash, code);
    assert.equal(sent.body.challenge.code_hash, undefined);
    assert.equal(
      (await confirm(f, challenge, code, 'second')).status,
      400,
      'another account cannot consume the challenge',
    );
    const accepted = await confirm(f, challenge, code);
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.phoneVerified, true);
    assert.equal(accepted.body.phoneVerifiedAt, f.time);
    assert.equal(accepted.body.challenge, null);
    assert.equal((await confirm(f, challenge, code)).status, 400, 'one-time only');
    const self = (await f.request('GET', '/api/auth/me', undefined, 'first')).body.user;
    assert.equal(self.phoneVerified, true);
    assert.equal(self.emailVerified, false);
    assert.equal(self.emailVerifiedAt, null);
    const listing = await f.request(
      'GET',
      '/api/admin/accounts?q=6281234567890',
      undefined,
      'owner',
    );
    assert.equal(listing.status, 200);
    assert.equal(listing.body.users.length, 1);
    assert.equal(listing.body.users[0].phoneVerified, true);
    assert.equal(listing.body.users[0].phoneVerifiedAt, f.time);
    assert.equal(listing.body.users[0].emailVerified, false);
    assert.equal(
      (await f.request('GET', '/api/admin/accounts?q=6281234567890', undefined, 'second')).status,
      403,
    );
    const same = await f.request('PUT', '/api/profile/phone', { phone: '0812-3456-7890' }, 'first');
    assert.equal(
      same.body.user.phoneVerified,
      true,
      'formatting an unchanged number preserves its evidence',
    );
    assert.equal(same.body.user.phoneRevision, self.phoneRevision);
    const changed = await f.request(
      'PUT',
      '/api/profile/phone',
      { phone: '081298765432', phoneVerified: true },
      'first',
    );
    assert.equal(changed.body.user.phoneVerified, false);
    assert.equal(changed.body.user.phoneVerifiedAt, null);
    assert.notEqual(changed.body.user.phoneRevision, self.phoneRevision);
  } finally {
    f.close();
  }
});

test('OTP expiry, five-attempt limit, resend cooldown, replacement and number changes cannot be bypassed', async () => {
  const f = await fixture();
  try {
    const issued = await issue(f),
      challenge = issued.body.challenge,
      code = f.sent.at(-1).code;
    assert.equal((await issue(f)).status, 429);
    assert.equal(f.sent.length, 1);
    const wrong = code === '000000' ? '000001' : '000000';
    for (let i = 0; i < 5; i++) assert.equal((await confirm(f, challenge, wrong)).status, 400);
    assert.equal((await state(f)).body.challenge.attemptsRemaining, 0);
    assert.equal((await confirm(f, challenge, code)).status, 400);
    f.advance(60001);
    const next = await issue(f);
    assert.equal(next.status, 200);
    assert.notEqual(next.body.challenge.id, challenge.id);
    assert.equal((await confirm(f, challenge, code)).status, 400);
    const newCode = f.sent.at(-1).code;
    f.advance(300001);
    assert.equal((await confirm(f, next.body.challenge, newCode)).status, 400);
    assert.equal((await state(f)).body.challenge, null);
    const third = await issue(f);
    assert.equal(third.status, 200);
    const thirdCode = f.sent.at(-1).code;
    await f.request('PUT', '/api/profile/phone', { phone: '' }, 'first');
    await f.request('PUT', '/api/profile/phone', { phone }, 'first');
    assert.equal(
      (await confirm(f, third.body.challenge, thirdCode)).status,
      400,
      'remove and re-add cannot resurrect an old code',
    );
    assert.equal((await state(f)).body.phoneVerified, false);
  } finally {
    f.close();
  }
});

test('pending OTP, quotas and confirmed timestamps survive a database restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bam-phone-confirm-')),
    file = join(directory, 'accounts.sqlite');
  const f = await fixture({ dbPath: file });
  try {
    const issued = await issue(f),
      code = f.sent.at(-1).code;
    f.restart();
    assert.equal((await issue(f)).status, 429);
    assert.equal((await confirm(f, issued.body.challenge, code)).status, 200);
    f.restart();
    assert.equal((await state(f)).body.phoneVerifiedAt, f.time);
    await f.request('PUT', '/api/profile/phone', { phone: '081298765432' }, 'first');
    for (let i = 0; i < 9; i++) {
      f.advance(60001);
      assert.equal(
        (
          await f.request(
            'POST',
            '/api/profile/phone/verification/request',
            { phone: '+6281298765432' },
            'first',
          )
        ).status,
        200,
      );
    }
    f.advance(60001);
    f.restart();
    assert.equal(
      (
        await f.request(
          'POST',
          '/api/profile/phone/verification/request',
          { phone: '+6281298765432' },
          'first',
        )
      ).status,
      429,
    );
    assert.equal(f.sent.length, 10);
  } finally {
    f.close();
    for (const suffix of ['', '-wal', '-shm'])
      if (existsSync(file + suffix)) unlinkSync(file + suffix);
    rmdirSync(directory);
  }
});

test('disabled service and uncertain delivery cannot falsely mark a phone confirmed or leak provider secrets', async () => {
  const off = await fixture({ enabled: false });
  try {
    assert.equal((await state(off)).body.ready, false);
    assert.equal((await issue(off)).status, 503);
    assert.equal(off.sent.length, 0);
    assert.equal((await state(off)).body.phoneVerified, false);
  } finally {
    off.close();
  }
  let delivery;
  const f = await fixture({
    send: async (value) => {
      delivery = value;
      throw new Error('private provider token and OTP ' + value.code);
    },
  });
  try {
    const response = await issue(f);
    assert.equal(response.status, 503);
    assert.doesNotMatch(JSON.stringify(response.body), /private provider/);
    assert.equal((await state(f)).body.phoneVerified, false);
    const pending = (await state(f)).body.challenge;
    assert.ok(pending);
    assert.equal(
      (await confirm(f, pending, delivery.code)).status,
      200,
      'an actually received code can resolve an uncertain send',
    );
  } finally {
    f.close();
  }
});

test('in-flight sends cannot confirm a changed phone and account revocation removes pending codes', async () => {
  let delivered, release, started;
  const sending = new Promise((resolve) => {
    started = resolve;
  });
  const f = await fixture({
    send: (value) => {
      delivered = value;
      started();
      return new Promise((resolve) => {
        release = resolve;
      });
    },
  });
  try {
    const pending = issue(f);
    await sending;
    const old = (await state(f)).body.challenge;
    await f.request('PUT', '/api/profile/phone', { phone: '081298765432' }, 'first');
    release();
    assert.equal((await pending).status, 409);
    assert.equal((await confirm(f, old, delivered.code)).status, 400);
    await f.request('PUT', '/api/profile/phone', { phone }, 'first');
    f.advance(60001);
    f.app.phoneVerification.sender = {
      enabled: true,
      send: async (value) => {
        delivered = value;
      },
    };
    const issued = await issue(f);
    assert.equal(issued.status, 200);
    f.app.accounts.revoke('first', 'first@fixture.test');
    assert.equal(f.app.db.prepare('SELECT COUNT(*) AS n FROM phone_otp_challenges').get().n, 0);
    assert.equal((await confirm(f, issued.body.challenge, delivered.code)).status, 401);
    assert.equal(f.app.phoneVerification.contact('first').phoneVerified, false);
  } finally {
    f.close();
  }
});

test('confirmation rechecks the phone and credential version after asynchronous code verification', async () => {
  const f = await fixture();
  try {
    const first = await issue(f),
      code = f.sent.at(-1).code;
    f.app.db
      .prepare('INSERT INTO auth_account_state(user_id,credential_revision) VALUES(?,1)')
      .run('first');
    assert.equal((await confirm(f, first.body.challenge, code)).status, 400);
    f.advance(60001);
    const second = await issue(f),
      secondCode = f.sent.at(-1).code;
    let started, release;
    const checking = new Promise((resolve) => {
        started = resolve;
      }),
      gate = new Promise((resolve) => {
        release = resolve;
      });
    f.app.phoneVerification.queue = {
      run: async (_ip, work) => {
        started();
        await gate;
        return work();
      },
    };
    const pending = confirm(f, second.body.challenge, secondCode);
    await checking;
    await f.request('PUT', '/api/profile/phone', { phone: '081298765432' }, 'first');
    release();
    assert.equal((await pending).status, 400);
    assert.equal(f.app.phoneVerification.contact('first').phoneVerified, false);
  } finally {
    f.close();
  }
});
