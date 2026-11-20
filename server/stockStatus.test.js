import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { createApp, hashPassword } from './app.js';
import { STATUS_STOCK_UNITS } from './workflow.js';

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
const order = (quantity) => ({
  requestKey: randomUUID(),
  recipient: 'Pembeli fixture',
  address: 'Alamat fixture lengkap',
  shippingId: 'regular',
  paymentId: 'cod',
  items: [{ id: 'snack-pedas', quantity, expectedPrice: 18000 }],
});
const units = (app) =>
  app.db.prepare('SELECT available,revision FROM inventory WHERE stock_key=?').get(KEY);
async function setMode(app, stockMode) {
  const current = app.company.snapshot();
  return request(
    app,
    'PUT',
    '/api/admin/company',
    { version: 1, revision: current.revision, profile: { ...current.profile, stockMode } },
    admin,
  );
}

test('mode status: stok tidak dihitung, hanya Tersedia/Kosong; pesanan tetap berjalan', async () => {
  const { app, stock } = await fixture();
  try {
    stock(0);
    assert.equal((await setMode(app, 'status')).status, 200);
    assert.equal(app.company.snapshot().profile.stockMode, 'status');
    // Everything becomes available, including sizes that had 0.
    assert.equal(units(app).available, STATUS_STOCK_UNITS);

    // Buyers and the admin see only available/empty, never a count.
    const pub = (await request(app, 'GET', '/api/inventory', null, alice)).body;
    assert.equal(pub.stockMode, 'status');
    assert.deepEqual(Object.keys(pub.stock[KEY]).sort(), ['inStock', 'revision']);
    const adm = (await request(app, 'GET', '/api/admin/inventory', null, admin)).body;
    assert.equal(adm.stock[KEY].inStock, true);
    assert.equal(adm.stock[KEY].available, undefined);
    assert.equal(adm.skuAvailability['snack-pedas'], true);
    assert.equal(adm.canImportPreview, false);

    const placed = app.workflow.create(alice, order(500));
    assert.equal(placed.items[0].quantity, 500);

    // Mark empty: numbers are refused, the status is accepted, ordering stops.
    const numeric = await request(
      app,
      'PUT',
      '/api/admin/inventory',
      { key: KEY, available: 5, revision: units(app).revision },
      admin,
    );
    assert.equal(numeric.status, 409);
    const empty = await request(
      app,
      'PUT',
      '/api/admin/inventory',
      { key: KEY, inStock: false, revision: units(app).revision },
      admin,
    );
    assert.equal(empty.status, 200, JSON.stringify(empty.body));
    assert.equal(units(app).available, 0);
    assert.throws(() => app.workflow.create(alice, order(1)));
    // Cancelling an older order does not quietly make the empty size available again.
    const current = app.workflow.owned(alice, placed.id);
    app.workflow.update(alice, placed.id, { action: 'cancel', revision: current.revision });
    assert.equal(units(app).available, 0);
    assert.equal(
      (await request(app, 'GET', '/api/inventory', null, alice)).body.stock[KEY].inStock,
      false,
    );

    // Back to available.
    await request(
      app,
      'PUT',
      '/api/admin/inventory',
      { key: KEY, inStock: true, revision: units(app).revision },
      admin,
    );
    assert.equal(units(app).available, STATUS_STOCK_UNITS);

    // Counting again: the placeholder numbers become 0 so real counts are entered first.
    assert.equal((await setMode(app, 'count')).status, 200);
    assert.equal(units(app).available, 0);
    const counted = (await request(app, 'GET', '/api/admin/inventory', null, admin)).body;
    assert.equal(counted.stockMode, 'count');
    assert.equal(counted.stock[KEY].available, 0);
  } finally {
    app.db.close();
  }
});
