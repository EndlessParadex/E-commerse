import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createApp, hashPassword } from './app.js';

test('nama toko pelanggan tersimpan terpisah, dapat dikosongkan, tidak mengubah penerima atau akun lain', async () => {
  const app = createApp({ dbPath: ':memory:' });
  const password = 'store-profile-test-password';
  try {
    const hash = await hashPassword(password);
    for (const id of ['buyer-one', 'buyer-two']) {
      app.db
        .prepare(
          'INSERT INTO users(id,name,email,address,password_hash,created_at,role) VALUES(?,?,?,?,?,?,?)',
        )
        .run(
          id,
          'Nama ' + id,
          id + '@fixture.test',
          'Jl. Pelanggan 123, Kota Pengujian',
          hash,
          new Date().toISOString(),
          'user',
        );
    }
    const cookie = {};
    const request = async (method, path, body, actor) => {
      const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
      req.method = method;
      req.url = path;
      req.socket = { remoteAddress: '192.0.2.1' };
      req.headers = {
        host: 'fixture.test',
        'content-type': 'application/json',
        ...(actor ? { cookie: cookie[actor] } : {}),
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
    };
    for (const id of ['buyer-one', 'buyer-two']) {
      const response = await request('POST', '/api/auth/login', {
        email: id + '@fixture.test',
        password,
      });
      assert.equal(response.status, 200);
      assert.equal(response.body.user.storeName, '');
      cookie[id] = response.headers['set-cookie'].split(';')[0];
    }
    const changed = await request(
      'PUT',
      '/api/profile',
      {
        name: 'Nama buyer-one',
        address: 'Jl. Pelanggan 123, Kota Pengujian',
        storeName: '  Toko Endless  ',
      },
      'buyer-one',
    );
    assert.equal(changed.status, 200);
    assert.equal(changed.body.user.storeName, 'Toko Endless');
    assert.equal(changed.body.user.name, 'Nama buyer-one');
    assert.equal(changed.body.user.address, 'Jl. Pelanggan 123, Kota Pengujian');
    assert.equal(
      (await request('GET', '/api/auth/me', undefined, 'buyer-one')).body.user.storeName,
      'Toko Endless',
    );
    assert.equal(
      (await request('GET', '/api/auth/me', undefined, 'buyer-two')).body.user.storeName,
      '',
    );
    for (const invalid of [4, 'x', 'T'.repeat(101)]) {
      const response = await request(
        'PUT',
        '/api/profile',
        {
          name: 'Ganti Nama',
          address: 'Alamat yang cukup panjang untuk profil',
          storeName: invalid,
        },
        'buyer-one',
      );
      assert.equal(response.status, 422);
      assert.equal(
        app.db.prepare('SELECT name FROM users WHERE id=?').get('buyer-one').name,
        'Nama buyer-one',
      );
    }
    const oldStyle = await request(
      'PUT',
      '/api/profile',
      { name: 'Nama Penerima Baru', address: 'Jalan Baru lengkap nomor 45' },
      'buyer-one',
    );
    assert.equal(oldStyle.status, 200);
    assert.equal(oldStyle.body.user.storeName, 'Toko Endless');
    const cleared = await request(
      'PUT',
      '/api/profile',
      { name: 'Nama Penerima Baru', address: 'Jalan Baru lengkap nomor 45', storeName: '' },
      'buyer-one',
    );
    assert.equal(cleared.status, 200);
    assert.equal(cleared.body.user.storeName, '');
    assert.equal(
      app.db.prepare('SELECT store_name FROM user_store_names WHERE user_id=?').get('buyer-one'),
      undefined,
    );
  } finally {
    app.db.close();
  }
});
