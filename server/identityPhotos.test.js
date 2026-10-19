import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, existsSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp, hashPassword } from './app.js';

const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9i0AAAAASUVORK5CYII=';
const invalidPhotos = [
  null,
  4,
  'https://example.com/photo.png',
  'data:image/svg+xml;base64,PHN2Zy8+',
  'data:image/png;base64,SGVsbG8gd29ybGQsIHNwb29mZWQ=',
  'data:image/png;base64,' + 'A'.repeat(1400000),
];
const removeDatabase = (file, directory) => {
  for (const suffix of ['', '-wal', '-shm'])
    if (existsSync(file + suffix)) unlinkSync(file + suffix);
  rmdirSync(directory);
};

test('brand photos migrate, survive restart and older clients, reject invalid data and can be removed', () => {
  const directory = mkdtempSync(join(tmpdir(), 'bam-brand-photos-'));
  const file = join(directory, 'catalog.sqlite');
  const legacy = new DatabaseSync(file);
  legacy.exec(
    'CREATE TABLE catalog_brands(id TEXT PRIMARY KEY,name TEXT NOT NULL,position INTEGER NOT NULL)',
  );
  legacy.close();
  let app;
  try {
    app = createApp({ dbPath: file });
    const initial = app.catalog.snapshot();
    assert.equal(initial.capabilities.brandPhotos, true);
    initial.masters.brands[0].logo = png;
    let saved = app.catalog.save(initial);
    app.db.close();
    app = createApp({ dbPath: file });
    assert.deepEqual(app.catalog.snapshot(), saved);
    const older = structuredClone(saved);
    delete older.masters.brands[0].logo;
    older.masters.brands[0].name += ' Baru';
    saved = app.catalog.save(older);
    assert.equal(saved.masters.brands[0].logo, png);
    for (const invalid of invalidPhotos) {
      const draft = structuredClone(saved);
      draft.masters.brands[0].logo = invalid;
      // Missing/null values from old clients preserve the saved logo.
      if (invalid === null) continue;
      assert.throws(() => app.catalog.save(draft), { status: 422 });
      assert.deepEqual(app.catalog.snapshot(), saved);
    }
    const cleared = structuredClone(saved);
    cleared.masters.brands[0].logo = '';
    assert.equal(app.catalog.save(cleared).masters.brands[0].logo, '');
  } finally {
    app?.db.close();
    removeDatabase(file, directory);
  }
});

test('profile photo API authenticates, isolates accounts, persists after restart, preserves profile fields and removes photos', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bam-account-photos-'));
  const file = join(directory, 'accounts.sqlite');
  let app = createApp({ dbPath: file });
  const cookies = {};
  const request = async (method, path, body, actor) => {
    const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
    Object.assign(req, {
      method,
      url: path,
      headers: {
        host: 'fixture.test',
        'content-type': 'application/json',
        ...(actor ? { cookie: cookies[actor] } : {}),
      },
    });
    req.socket = { remoteAddress: '192.0.2.1' };
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
    const password = 'photo-profile-password',
      hash = await hashPassword(password);
    for (const id of ['one', 'two']) {
      app.db
        .prepare(
          'INSERT INTO users(id,name,email,address,password_hash,created_at,role) VALUES(?,?,?,?,?,?,?)',
        )
        .run(
          id,
          'Pembeli ' + id,
          id + '@fixture.test',
          'Alamat asli pelanggan lengkap',
          hash,
          new Date().toISOString(),
          'user',
        );
      const login = await request('POST', '/api/auth/login', {
        email: id + '@fixture.test',
        password,
      });
      assert.equal(login.status, 200);
      cookies[id] = login.headers['set-cookie'].split(';')[0];
    }
    assert.equal((await request('PUT', '/api/profile/photo', { avatar: png })).status, 401);
    const saved = await request(
      'PUT',
      '/api/profile/photo',
      { avatar: png, userId: 'two', role: 'admin', name: 'Tidak Boleh' },
      'one',
    );
    assert.equal(saved.status, 200);
    assert.equal(saved.body.user.avatar, png);
    assert.equal(saved.body.user.name, 'Pembeli one');
    assert.equal(saved.body.user.role, 'user');
    assert.equal((await request('GET', '/api/auth/me', undefined, 'two')).body.user.avatar, '');
    app.db.close();
    app = createApp({ dbPath: file });
    assert.equal((await request('GET', '/api/auth/me', undefined, 'one')).body.user.avatar, png);
    const login = await request('POST', '/api/auth/login', { email: 'one@fixture.test', password });
    assert.equal(login.body.user.avatar, png);
    for (const avatar of invalidPhotos) {
      assert.equal((await request('PUT', '/api/profile/photo', { avatar }, 'one')).status, 422);
      assert.equal((await request('GET', '/api/auth/me', undefined, 'one')).body.user.avatar, png);
    }
    const profile = await request(
      'PUT',
      '/api/profile',
      { name: 'Nama Baru', address: 'Alamat baru yang lengkap' },
      'one',
    );
    assert.equal(profile.body.user.avatar, png);
    const cleared = await request('PUT', '/api/profile/photo', { avatar: '' }, 'one');
    assert.equal(cleared.body.user.avatar, '');
    assert.equal(cleared.body.user.name, 'Nama Baru');
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM user_profile_photos').get().n, 0);
  } finally {
    app.db.close();
    removeDatabase(file, directory);
  }
});
