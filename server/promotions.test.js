import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { createApp, hashPassword } from './app.js';
import { freeQuantity, unitsToNextFree } from '../src/data/promotions.js';

const pass = 'fixture-password';
const admin = { id: 'operator', role: 'admin' },
  alice = { id: 'alice', role: 'user' };
const KEY = 'snack-pedas:180-g';

async function fixture() {
  let time = Date.parse('2026-12-02T03:00:00Z');
  const app = createApp({
    dbPath: ':memory:',
    legacyCommerceFixture: true,
    now: () => time,
    mailer: { enabled: false },
    logger: () => {},
  });
  const encoded = await hashPassword(pass);
  for (const u of [admin, alice]) {
    app.db
      .prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)')
      .run(
        u.id,
        u.id,
        u.id + '@fixture.test',
        'Alamat fixture lengkap',
        encoded,
        '2026-01-01',
        u.role,
      );
    app.db.prepare('INSERT INTO auth_account_state VALUES(?,?,0)').run(u.id, time);
    const token = createHash('sha256').update(u.id).digest('base64url');
    app.db
      .prepare('INSERT INTO sessions VALUES(?,?,?)')
      .run(createHash('sha256').update(token).digest('hex'), u.id, time + 30 * 86400000);
  }
  app.workflow.ensureInventory();
  const stock = (units) =>
    app.db.prepare('UPDATE inventory SET available=? WHERE stock_key=?').run(units, KEY);
  stock(100);
  return { app, stock, advance: (ms) => (time += ms) };
}
async function request(app, method, path, body, user) {
  const req = Readable.from(body ? [JSON.stringify(body)] : []);
  Object.assign(req, {
    method,
    url: path,
    socket: { remoteAddress: '192.0.2.9' },
    headers: {
      host: 'fixture.test',
      origin: 'http://fixture.test',
      'content-type': 'application/json',
      ...(user
        ? { cookie: 'bam_session=' + createHash('sha256').update(user.id).digest('base64url') }
        : {}),
    },
  });
  let result;
  await app.handler(req, {
    writeHead(status, headers) {
      result = { status, headers };
    },
    end(value) {
      result.body = value ? JSON.parse(String(value)) : null;
    },
  });
  return result;
}
const promo = (extra = {}) => ({
  id: 'promo-balado',
  variantId: 'snack-pedas',
  buy: 2,
  free: 1,
  maxFree: 0,
  startsOn: '',
  endsOn: '',
  active: true,
  note: '',
  ...extra,
});
const order = (quantity, extra = {}) => ({
  requestKey: randomUUID(),
  recipient: 'Pembeli fixture',
  address: 'Alamat fixture lengkap',
  shippingId: 'regular',
  paymentId: 'cod',
  items: [{ id: 'snack-pedas', quantity, expectedPrice: 18000, ...extra }],
});
const savePromos = async (app, promotions, revision = app.promotions.stored().revision) =>
  request(app, 'PUT', '/api/admin/promotions', { revision, promotions }, admin);

test('hitungan promo: kelipatan, batas per pesanan, dan sisa untuk gratis berikutnya', () => {
  const p = promo();
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5, 6].map((n) => freeQuantity(p, n)),
    [0, 0, 1, 1, 2, 2, 3],
  );
  assert.equal(freeQuantity(promo({ maxFree: 2 }), 10), 2);
  assert.equal(freeQuantity(promo({ buy: 3, free: 2 }), 7), 4);
  assert.equal(unitsToNextFree(p, 1), 1);
  assert.equal(unitsToNextFree(p, 2), 2);
  assert.equal(unitsToNextFree(promo({ maxFree: 1 }), 2), 0, 'limit reached');
  assert.equal(freeQuantity(null, 9), 0);
});

test('promo: hanya Admin/Pemilik; isian dan bentrok jadwal per SKU diperiksa server', async () => {
  const { app } = await fixture();
  try {
    assert.deepEqual((await request(app, 'GET', '/api/promotions')).body.promotions, []);
    assert.equal((await request(app, 'GET', '/api/admin/promotions', null, alice)).status, 403);
    const invalid = [
      [promo({ variantId: 'tidak-ada' }), /SKU/],
      [promo({ buy: 0 }), /beli/],
      [promo({ free: 1.5 }), /gratis/],
      [promo({ maxFree: -1 }), /batas/],
      [promo({ startsOn: '2026-12-10', endsOn: '2026-12-01' }), /selesai/],
    ];
    for (const [entry, message] of invalid) {
      const res = await savePromos(app, [entry]);
      assert.equal(res.status, 422, JSON.stringify(entry));
      assert.match(JSON.stringify(res.body), message);
    }
    const clash = await savePromos(app, [
      promo({ endsOn: '2026-12-31' }),
      promo({ id: 'promo-2', startsOn: '2026-12-31', buy: 3 }),
    ]);
    assert.equal(clash.status, 422);
    assert.match(JSON.stringify(clash.body), /tanggal yang sama/);
    // Back to back, or one of them hidden, is fine.
    const ok = await savePromos(app, [
      promo({ endsOn: '2026-12-31' }),
      promo({ id: 'promo-2', startsOn: '2027-01-01', buy: 3 }),
      promo({ id: 'promo-3', active: false }),
    ]);
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal((await savePromos(app, [], 0)).status, 409, 'stale revision');
    const shown = (await request(app, 'GET', '/api/promotions')).body;
    assert.equal(shown.today, '2026-12-02');
    assert.deepEqual(
      shown.promotions.map((p) => p.id),
      ['promo-balado'],
    );
  } finally {
    app.db.close();
  }
});

test('pesanan pribadi: bayar 2 terima 3; stok gratis ikut dipesan; total tidak berubah', async () => {
  const { app, stock } = await fixture();
  try {
    assert.equal((await savePromos(app, [promo({ maxFree: 2 })])).status, 200);
    const created = app.workflow.create(alice, order(2, { expectedFree: 1 }));
    const line = created.items[0];
    assert.equal(line.quantity, 2);
    assert.equal(line.freeQuantity, 1);
    assert.equal(line.promotion.label, 'Beli 2 gratis 1');
    assert.equal(created.subtotal, 36000, 'free units cost nothing');
    assert.deepEqual(app.workflow.owned(alice, created.id).inventory, [{ key: KEY, units: 3 }]);

    // The per-order limit: 7 paid would earn 3, the promotion gives at most 2.
    assert.equal(app.workflow.create(alice, order(7)).items[0].freeQuantity, 2);
    // One paid: nothing free, and no promotion recorded on the line.
    const single = app.workflow.create(alice, order(1)).items[0];
    assert.equal(single.freeQuantity, undefined);
    assert.equal(single.promotion, undefined);

    // "Selama stok tersedia": only what is left after the paid units is given.
    stock(5);
    assert.equal(app.workflow.create(alice, order(4)).items[0].freeQuantity, 1);
    // The cart expected more than can be given: stop before ordering.
    stock(4);
    assert.throws(() => app.workflow.create(alice, order(4, { expectedFree: 2 })), {
      code: 'promotion_changed',
    });
    // A promotion the cart did not know about is also announced, not silently added.
    stock(100);
    assert.throws(() => app.workflow.create(alice, order(2, { expectedFree: 0 })), {
      code: 'promotion_changed',
    });
    // The admin page reports the free units given.
    const report = (await request(app, 'GET', '/api/admin/promotions', null, admin)).body;
    assert.deepEqual(report.given['promo-balado'], { units: 1 + 2 + 1, orders: 3 });
  } finally {
    app.db.close();
  }
});

test('promo berakhir atau disembunyikan: pesanan baru tanpa barang gratis', async () => {
  const { app, advance } = await fixture();
  try {
    await savePromos(app, [promo({ endsOn: '2026-12-02' })]);
    assert.equal(app.workflow.create(alice, order(2)).items[0].freeQuantity, 1);
    advance(86400000);
    assert.equal(app.workflow.create(alice, order(2)).items[0].freeQuantity, undefined);
    assert.throws(() => app.workflow.create(alice, order(2, { expectedFree: 1 })), {
      code: 'promotion_changed',
    });
  } finally {
    app.db.close();
  }
});
