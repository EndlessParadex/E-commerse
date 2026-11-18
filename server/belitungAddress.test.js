import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { createApp } from './app.js';
import {
  DISTRICTS,
  REGENCIES,
  VILLAGES,
  composeAddress,
  findVillage,
  validateArea,
  villagesIn,
} from '../src/data/belitungRegions.js';

const password = 'kata-sandi-alamat-2026';
async function request(app, method, path, body, cookie = '') {
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
    socket: { remoteAddress: '192.0.2.88' },
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
const signup = (phone, extra = {}) => ({
  name: 'Pembeli ' + phone,
  phone,
  password,
  street: 'Jl. Sudirman No. 12, RT 03',
  villageCode: '19.02.01.1006',
  ...extra,
});
async function approvedBuyer(app, phone, extra) {
  const res = await request(app, 'POST', '/api/auth/register', signup(phone, extra));
  assert.equal(res.status, 202, JSON.stringify(res.body));
  const id = app.db
    .prepare('SELECT user_id FROM user_contact_phones WHERE phone=?')
    .get('+62' + phone.slice(1)).user_id;
  app.db.prepare("UPDATE account_approvals SET status='approved' WHERE user_id=?").run(id);
  const login = await request(app, 'POST', '/api/auth/login', { identifier: phone, password });
  assert.equal(login.status, 200);
  return { id, cookie: login.headers['set-cookie'].split(';')[0], user: login.body.user };
}
const fixture = () =>
  createApp({
    dbPath: ':memory:',
    installMode: 'company',
    mailer: { enabled: false },
    logger: () => {},
  });

test('wilayah Pulau Belitung follows the Kemendagri list: 2 kabupaten, 12 kecamatan, 88 desa/kelurahan', () => {
  assert.deepEqual(Object.keys(REGENCIES), ['19.02', '19.06']);
  assert.equal(DISTRICTS.length, 12);
  assert.equal(VILLAGES.length, 88);
  assert.equal(villagesIn('19.02.01').length, 16, 'Tanjungpandan');
  // Every desa belongs to a listed kecamatan, and codes are unique.
  assert.equal(new Set(VILLAGES.map((v) => v.code)).size, 88);
  for (const village of VILLAGES) assert.ok(findVillage(village.code).district, village.code);
  // The same name exists in two kecamatan; the code tells them apart.
  const dukong = VILLAGES.filter((v) => v.name === 'Dukong').map((v) => findVillage(v.code));
  assert.deepEqual(
    dukong.map((v) => v.district),
    ['Tanjungpandan', 'Simpang Pesak'],
  );
  assert.equal(findVillage('19.02.01.1001').kind, 'Kelurahan');
  assert.equal(findVillage('19.06.07.2004').kind, 'Desa');
  assert.equal(
    composeAddress('  Jl. Sudirman   No. 12 ', '19.02.01.1006'),
    'Jl. Sudirman No. 12, Kel. Pangkallalang, Kec. Tanjungpandan, Kab. Belitung, Kepulauan Bangka Belitung',
  );
  assert.equal(composeAddress('Jl. A', '31.71.01.1001'), '');
  assert.deepEqual(Object.keys(validateArea({ jalan: 'Jl', desa: '19.99.99.9999' })), [
    'jalan',
    'desa',
  ]);
});

test('registration needs a street and a desa/kelurahan on Pulau Belitung', async () => {
  const app = fixture();
  try {
    const legacy = await request(app, 'POST', '/api/auth/register', {
      ...signup('081234567901', { street: undefined, villageCode: undefined }),
      address: 'Jalan Merdeka No. 1, Jakarta Pusat',
    });
    assert.equal(legacy.status, 422);
    assert.ok(legacy.body.errors.villageCode);
    const outside = await request(
      app,
      'POST',
      '/api/auth/register',
      signup('081234567902', { villageCode: '31.71.01.1001' }),
    );
    assert.equal(outside.status, 422);
    assert.ok(outside.body.errors.villageCode);
    const short = await request(
      app,
      'POST',
      '/api/auth/register',
      signup('081234567903', { street: 'Jl' }),
    );
    assert.equal(short.status, 422);
    assert.ok(short.body.errors.street);
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 0);

    const { user } = await approvedBuyer(app, '081234567904');
    assert.equal(user.street, 'Jl. Sudirman No. 12, RT 03');
    assert.equal(user.villageCode, '19.02.01.1006');
    assert.equal(
      user.address,
      'Jl. Sudirman No. 12, RT 03, Kel. Pangkallalang, Kec. Tanjungpandan, Kab. Belitung, Kepulauan Bangka Belitung',
    );
  } finally {
    app.db.close();
  }
});

test('profile edits must choose a desa; an old free-text address stays until then', async () => {
  const app = fixture();
  try {
    const { id, cookie } = await approvedBuyer(app, '081234567911');
    // An account from before the picker: free text, no desa row.
    app.db.prepare("UPDATE users SET address='Jalan Lama No. 9, Manggar' WHERE id=?").run(id);
    app.db.prepare('DELETE FROM user_addresses WHERE user_id=?').run(id);
    const me = await request(app, 'GET', '/api/auth/me', undefined, cookie);
    assert.equal(me.body.user.address, 'Jalan Lama No. 9, Manggar');
    assert.equal(me.body.user.villageCode, '');

    const freeText = await request(
      app,
      'PUT',
      '/api/profile',
      { name: 'Penerima', address: 'Jalan Lain No. 2, Jakarta' },
      cookie,
    );
    assert.equal(freeText.status, 422);
    const saved = await request(
      app,
      'PUT',
      '/api/profile',
      { name: 'Penerima', street: 'Jalan Lama No. 9', villageCode: '19.06.01.2007' },
      cookie,
    );
    assert.equal(saved.status, 200);
    assert.equal(
      saved.body.user.address,
      'Jalan Lama No. 9, Desa Baru, Kec. Manggar, Kab. Belitung Timur, Kepulauan Bangka Belitung',
    );
    assert.equal(saved.body.user.villageCode, '19.06.01.2007');
  } finally {
    app.db.close();
  }
});

test('orders use the chosen desa; only accounts that never chose one may send free text', async () => {
  const app = fixture();
  try {
    const order = (extra) => ({
      requestKey: randomUUID(),
      recipient: 'Penerima Uji',
      shippingId: 'regular',
      paymentId: 'cod',
      items: [{ id: 'none', quantity: 1, expectedPrice: 1000 }],
      ...extra,
    });
    const legacy = { id: 'legacy-buyer' };
    const picked = { id: 'picked-buyer' };
    const resolve = (user, body) => app.workflow.resolveAddress(user, body);
    // Without a saved desa, the old free text still works.
    assert.deepEqual(resolve(legacy, order({ address: 'Jalan Lama No. 9, Manggar' })), {
      address: 'Jalan Lama No. 9, Manggar',
    });
    assert.throws(() => resolve(legacy, order({ address: 'pendek' })), {
      code: 'validation_error',
    });
    // A chosen desa is composed on the server; the typed line is not trusted.
    assert.deepEqual(
      resolve(
        legacy,
        order({ address: 'Jakarta', street: 'Jl. Melati 3', villageCode: '19.02.04.2001' }),
      ),
      {
        address: 'Jl. Melati 3, Desa Sijuk, Kec. Sijuk, Kab. Belitung, Kepulauan Bangka Belitung',
        villageCode: '19.02.04.2001',
      },
    );
    assert.throws(
      () => resolve(legacy, order({ street: 'Jl. Melati 3', villageCode: '31.71.01.1001' })),
      { code: 'validation_error' },
    );
    // Once the account has a desa, free text is refused.
    const { id } = await approvedBuyer(app, '081234567921');
    picked.id = id;
    assert.throws(() => resolve(picked, order({ address: 'Jalan Lama No. 9, Manggar' })), {
      message: /kelurahan atau desa/,
    });
  } finally {
    app.db.close();
  }
});
