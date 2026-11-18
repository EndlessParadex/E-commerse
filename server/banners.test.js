import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createApp, hashPassword } from './app.js';
import { bannerVisible, jakartaDate } from './banners.js';

const password = 'kata-sandi-banner-2026';
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9i0AAAAASUVORK5CYII=';

async function request(app, method, url, body, cookie = '') {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  Object.assign(req, {
    method,
    url,
    headers: {
      host: 'bam.test',
      origin: 'http://bam.test',
      'content-type': 'application/json',
      cookie,
    },
    socket: { remoteAddress: '192.0.2.40' },
  });
  let result;
  await app.handler(req, {
    writeHead(status, headers) {
      result = { status, headers };
    },
    end(value) {
      result.raw = value === undefined ? Buffer.alloc(0) : Buffer.from(value);
      try {
        result.body = JSON.parse(result.raw.toString());
      } catch {
        result.body = null;
      }
    },
  });
  return result;
}
async function signIn(app, id, role) {
  app.db
    .prepare(
      'INSERT INTO users(id,name,email,address,password_hash,created_at,role) VALUES(?,?,?,?,?,?,?)',
    )
    .run(
      id,
      'Akun ' + id,
      id + '@test.id',
      'Alamat lengkap akun uji',
      await hashPassword(password),
      new Date().toISOString(),
      role,
    );
  app.db.prepare("INSERT INTO account_approvals(user_id,status) VALUES(?,'approved')").run(id);
  const login = await request(app, 'POST', '/api/auth/login', {
    email: id + '@test.id',
    password,
  });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  return login.headers['set-cookie'].split(';')[0];
}
const banner = (extra = {}) => ({
  id: 'promo-1',
  active: true,
  startsOn: '',
  endsOn: '',
  label: 'Promo minggu ini',
  title: 'Stok camilan\ntoko makin lengkap',
  description: 'Pilih camilan favorit pelanggan.',
  cta: 'Lihat snack',
  target: { type: 'category', id: 'snack' },
  theme: 'snack',
  media: 'products',
  productIds: [],
  ...extra,
});

test('banner: belum diatur memakai banner otomatis; hanya Admin/Pemilik yang dapat mengubah', async () => {
  const app = createApp({ dbPath: ':memory:', mailer: { enabled: false }, logger: () => {} });
  try {
    const open = await request(app, 'GET', '/api/home/banners');
    assert.equal(open.status, 200);
    assert.deepEqual(open.body, { configured: false, banners: [] });
    assert.equal((await request(app, 'GET', '/api/admin/banners')).status, 401);
    const buyer = await signIn(app, 'pembeli', 'user');
    assert.equal((await request(app, 'GET', '/api/admin/banners', undefined, buyer)).status, 403);
    assert.equal(
      (await request(app, 'PUT', '/api/admin/banners', { revision: 0, banners: [] }, buyer)).status,
      403,
    );

    const admin = await signIn(app, 'admin', 'admin');
    const saved = await request(
      app,
      'PUT',
      '/api/admin/banners',
      { revision: 0, banners: [banner()] },
      admin,
    );
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.revision, 1);
    assert.equal(saved.body.configured, true);
    assert.equal(saved.body.banners[0].title, 'Stok camilan\ntoko makin lengkap');
    const shown = await request(app, 'GET', '/api/home/banners');
    assert.equal(shown.body.configured, true);
    assert.deepEqual(
      shown.body.banners.map((entry) => entry.id),
      ['promo-1'],
    );

    // A second editor working from an old copy is stopped, not silently overwritten.
    const stale = await request(
      app,
      'PUT',
      '/api/admin/banners',
      { revision: 0, banners: [] },
      admin,
    );
    assert.equal(stale.status, 409);
    // Deleting every banner is a saved choice; the store then falls back to automatic ones.
    const cleared = await request(
      app,
      'PUT',
      '/api/admin/banners',
      { revision: 1, banners: [] },
      admin,
    );
    assert.equal(cleared.status, 200);
    assert.deepEqual((await request(app, 'GET', '/api/home/banners')).body, {
      configured: true,
      banners: [],
    });
  } finally {
    app.db.close();
  }
});

test('banner: isian diperiksa server (judul, jadwal, tujuan, gambar, jumlah)', async () => {
  const app = createApp({ dbPath: ':memory:', mailer: { enabled: false }, logger: () => {} });
  try {
    const admin = await signIn(app, 'admin', 'admin');
    const put = (banners) =>
      request(app, 'PUT', '/api/admin/banners', { revision: 0, banners }, admin);
    const invalid = [
      [banner({ title: '' }), /judul wajib/],
      [banner({ title: 'satu\ndua\ntiga' }), /2 baris/],
      [banner({ startsOn: '2026-02-30' }), /tanggal/],
      [banner({ startsOn: '2026-12-10', endsOn: '2026-12-01' }), /selesai/],
      [banner({ target: { type: 'category', id: '' } }), /tujuan/],
      [banner({ target: { type: 'web', id: 'https://contoh.id' } }), /tujuan/],
      [banner({ theme: 'neon' }), /tema/],
      [banner({ media: 'image' }), /unggah gambar/],
      [banner({ media: 'image', image: 'data:image/svg+xml;base64,PHN2Zz4=' }), /JPG, PNG/],
      [banner({ productIds: ['a', 'b', 'c'] }), /2 produk/],
      [banner({ cta: '' }), /tombol/],
    ];
    for (const [entry, message] of invalid) {
      const res = await put([entry]);
      assert.equal(res.status, 422, JSON.stringify(entry));
      assert.match(JSON.stringify(res.body), message);
    }
    assert.equal((await put([banner(), banner()])).status, 422, 'duplicate ids');
    assert.equal(
      (await put(Array.from({ length: 13 }, (_, i) => banner({ id: 'b' + i })))).status,
      422,
    );
    assert.equal(app.banners.stored().revision, 0, 'nothing was saved');
  } finally {
    app.db.close();
  }
});

test('banner: gambar disajikan lewat URL ber-cache dan tetap tersimpan saat banner lain diubah', async () => {
  const app = createApp({ dbPath: ':memory:', mailer: { enabled: false }, logger: () => {} });
  try {
    const admin = await signIn(app, 'admin', 'admin');
    const saved = await request(
      app,
      'PUT',
      '/api/admin/banners',
      {
        revision: 0,
        banners: [
          banner({ media: 'image', image: png, imageAlt: 'Poster promo snack', productIds: ['x'] }),
        ],
      },
      admin,
    );
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const path = saved.body.banners[0].image;
    assert.match(path, /^\/api\/home\/banners\/photos\/[a-f0-9]{64}\.png$/);
    const photo = await request(app, 'GET', path);
    assert.equal(photo.status, 200);
    assert.equal(photo.headers['content-type'], 'image/png');
    assert.match(photo.headers['cache-control'], /immutable/);
    assert.equal(
      (await request(app, 'GET', path.replace(/[a-f0-9]{64}/, 'a'.repeat(64)))).status,
      404,
    );

    // Saving again with the URL (the admin page sends back what it received) keeps the photo.
    const again = await request(
      app,
      'PUT',
      '/api/admin/banners',
      { revision: 1, banners: [{ ...saved.body.banners[0], title: 'Judul baru' }] },
      admin,
    );
    assert.equal(again.status, 200, JSON.stringify(again.body));
    assert.equal(again.body.banners[0].image, path);
    assert.equal(app.banners.stored().banners[0].image, png);
    // An unknown URL is not accepted as a photo.
    const forged = await request(
      app,
      'PUT',
      '/api/admin/banners',
      { revision: 2, banners: [{ ...saved.body.banners[0], image: '/api/catalog/photos/x.png' }] },
      admin,
    );
    assert.equal(forged.status, 422);
  } finally {
    app.db.close();
  }
});

test('banner: disembunyikan dan di luar jadwal tidak dikirim ke toko (tanggal WIB)', async () => {
  // 2026-12-01 18:00 UTC is already 2 December in Jakarta.
  let now = Date.parse('2026-12-01T18:00:00Z');
  assert.equal(jakartaDate(now), '2026-12-02');
  const app = createApp({
    dbPath: ':memory:',
    mailer: { enabled: false },
    logger: () => {},
    now: () => now,
  });
  try {
    const admin = await signIn(app, 'admin', 'admin');
    const saved = await request(
      app,
      'PUT',
      '/api/admin/banners',
      {
        revision: 0,
        banners: [
          banner({ id: 'tampil' }),
          banner({ id: 'sembunyi', active: false }),
          banner({ id: 'nanti', startsOn: '2026-12-03' }),
          banner({ id: 'hari-ini', startsOn: '2026-12-02', endsOn: '2026-12-02' }),
          banner({ id: 'lewat', endsOn: '2026-12-01' }),
        ],
      },
      admin,
    );
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    // Admin sees every banner with today's date to label them.
    assert.equal(saved.body.banners.length, 5);
    assert.equal(saved.body.today, '2026-12-02');
    const visible = async () =>
      (await request(app, 'GET', '/api/home/banners')).body.banners.map((entry) => entry.id);
    assert.deepEqual(await visible(), ['tampil', 'hari-ini']);
    now = Date.parse('2026-12-03T01:00:00Z');
    assert.deepEqual(await visible(), ['tampil', 'nanti']);
  } finally {
    app.db.close();
  }
  assert.equal(bannerVisible({ active: true, startsOn: '', endsOn: '' }, '2026-01-01'), true);
});
