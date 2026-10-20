import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mkdtempSync, existsSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp, hashPassword } from './app.js';

test('account contact phones are private, persist, validate, and never grant authentication or verification', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bam-contact-phones-'));
  const file = join(directory, 'accounts.sqlite');
  let app = createApp({ dbPath: file });
  const cookies = {};
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
  };
  try {
    const password = 'contact-phone-password',
      hash = await hashPassword(password);
    for (const id of ['first', 'second']) {
      app.db
        .prepare(
          'INSERT INTO users(id,name,email,address,password_hash,created_at,role) VALUES(?,?,?,?,?,?,?)',
        )
        .run(
          id,
          'Pembeli ' + id,
          id + '@fixture.test',
          'Alamat pelanggan yang lengkap',
          hash,
          new Date().toISOString(),
          'user',
        );
      const response = await request('POST', '/api/auth/login', {
        email: id + '@fixture.test',
        password,
      });
      assert.equal(response.status, 200);
      assert.equal(response.body.user.phone, '');
      cookies[id] = response.headers['set-cookie'].split(';')[0];
    }
    assert.equal(
      (await request('PUT', '/api/profile/phone', { phone: '081234567890' })).status,
      401,
    );
    assert.equal(
      (
        await request(
          'PUT',
          '/api/profile/phone',
          { phone: '081234567890' },
          'first',
          'https://other.test',
        )
      ).status,
      403,
    );
    const saved = await request(
      'PUT',
      '/api/profile/phone',
      {
        phone: ' 0812-3456-7890 ',
        userId: 'second',
        role: 'admin',
        emailVerified: true,
        phoneVerified: true,
      },
      'first',
    );
    assert.equal(saved.status, 200);
    assert.equal(saved.body.user.phone, '+6281234567890');
    assert.equal(saved.body.user.role, 'user');
    assert.equal(saved.body.user.emailVerified, false);
    assert.equal(saved.body.user.isOwner, false);
    assert.equal((await request('GET', '/api/auth/me', undefined, 'second')).body.user.phone, '');
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM auth_tokens').get().n, 0);
    for (const phone of [
      null,
      81234567890,
      {},
      '+12025550123',
      '0812abc34567890',
      '0812',
      '+6281234567890<script>',
      ' '.repeat(41),
    ]) {
      assert.equal((await request('PUT', '/api/profile/phone', { phone }, 'first')).status, 422);
      assert.equal(
        (await request('GET', '/api/auth/me', undefined, 'first')).body.user.phone,
        '+6281234567890',
      );
    }
    assert.equal((await request('PUT', '/api/profile/phone', {}, 'first')).status, 422);
    const profile = await request(
      'PUT',
      '/api/profile',
      {
        name: 'Nama Terbaru',
        address: 'Alamat baru yang lengkap',
        phone: '081298765432',
      },
      'first',
    );
    assert.equal(profile.status, 200);
    assert.equal(profile.body.user.phone, '+6281234567890');
    // An unverified contact is not an identity: neither login nor shared-store access is created.
    assert.notEqual(
      (await request('POST', '/api/auth/login', { email: '+6281234567890', password })).status,
      200,
    );
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM b2b_store_members').get().n, 0);
    app.db.close();
    app = createApp({ dbPath: file });
    const restored = await request('GET', '/api/auth/me', undefined, 'first');
    assert.equal(restored.body.user.phone, '+6281234567890');
    assert.equal(restored.body.user.name, 'Nama Terbaru');
    const login = await request('POST', '/api/auth/login', {
      email: 'first@fixture.test',
      password,
    });
    assert.equal(login.body.user.phone, '+6281234567890');
    assert.equal(
      (await request('PUT', '/api/profile/phone', { phone: '081234567890' }, 'second')).status,
      200,
    );
    assert.equal(
      (await request('PUT', '/api/profile/phone', { phone: '   ' }, 'first')).body.user.phone,
      '',
    );
    assert.equal(
      (await request('GET', '/api/auth/me', undefined, 'second')).body.user.phone,
      '+6281234567890',
    );
    app.db.prepare('DELETE FROM users WHERE id=?').run('second');
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM user_contact_phones').get().n, 0);
  } finally {
    app.db.close();
    for (const suffix of ['', '-wal', '-shm'])
      if (existsSync(file + suffix)) unlinkSync(file + suffix);
    rmdirSync(directory);
  }
});
