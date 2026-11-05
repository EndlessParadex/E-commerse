import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createApp } from './app.js';

async function request(app, method, url, body, cookie) {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  req.method = method;
  req.url = url;
  req.socket = { remoteAddress: '192.0.2.51' };
  req.headers = {
    host: 'reviews.fixture',
    origin: 'http://reviews.fixture',
    'content-type': 'application/json',
    ...(cookie ? { cookie } : {}),
  };
  let output;
  await app.handler(req, {
    writeHead(status, headers) {
      output = { status, headers };
    },
    end(value) {
      output.body = JSON.parse(value);
    },
  });
  return output;
}

function seedUser(app, id, role = 'user') {
  app.db
    .prepare(
      'INSERT INTO users(id,name,email,address,password_hash,created_at,role) VALUES(?,?,?,?,?,?,?)',
    )
    .run(
      id,
      'Nama ' + id,
      id + '@fixture.test',
      'Alamat lengkap fixture',
      'fixture-not-for-login',
      new Date().toISOString(),
      role,
    );
  app.db
    .prepare('INSERT OR REPLACE INTO auth_account_state(user_id,verified_at) VALUES(?,1)')
    .run(id);
  const token = randomBytes(32).toString('base64url');
  app.db
    .prepare('INSERT INTO sessions VALUES(?,?,?)')
    .run(createHash('sha256').update(token).digest('hex'), id, Date.now() + 60000);
  return { id, role, cookie: 'bam_session=' + token };
}

test('reviews: only the buyer of a completed order rates its items; Admin can hide reviews', async () => {
  const app = createApp({ dbPath: ':memory:', logger: () => {} });
  try {
    const buyer = seedUser(app, 'buyer');
    const stranger = seedUser(app, 'stranger');
    const admin = seedUser(app, 'admin', 'admin');
    const order = app.workflow.create(buyer, {
      requestKey: randomUUID(),
      recipient: 'Pembeli Uji',
      address: 'Jalan Ulasan Nomor 10, Kota Uji',
      items: [{ id: 'snack-pedas', quantity: 1, expectedPrice: 18000 }],
      shippingId: 'regular',
      paymentId: 'cod',
    });
    const url = '/api/orders/' + order.id + '/reviews';
    const review = { productId: 'snack-pedas', rating: 4, comment: '  Renyah,   pedasnya pas. ' };

    const before = await request(app, 'GET', url, undefined, buyer.cookie);
    assert.equal(before.status, 200);
    assert.equal(before.body.canReview, false, 'an open order cannot be reviewed yet');
    assert.equal((await request(app, 'PUT', url, review, buyer.cookie)).status, 409);

    app.db
      .prepare(
        "UPDATE orders SET status='completed', data=json_set(data,'$.status','completed') WHERE id=?",
      )
      .run(order.id);

    assert.equal((await request(app, 'PUT', url, review)).status, 401);
    assert.equal((await request(app, 'PUT', url, review, stranger.cookie)).status, 403);
    assert.equal(
      (await request(app, 'PUT', url, review, admin.cookie)).status,
      403,
      'Admin manages reviews but does not write them for buyers',
    );
    for (const rating of [0, 6, 3.5, '5'])
      assert.equal(
        (await request(app, 'PUT', url, { ...review, rating }, buyer.cookie)).status,
        422,
      );
    assert.equal(
      (await request(app, 'PUT', url, { ...review, comment: 'x'.repeat(501) }, buyer.cookie))
        .status,
      422,
    );
    assert.equal(
      (await request(app, 'PUT', url, { ...review, productId: 'not-ordered' }, buyer.cookie))
        .status,
      404,
    );

    const saved = await request(app, 'PUT', url, review, buyer.cookie);
    assert.equal(saved.status, 200);
    assert.equal(saved.body.reviews['snack-pedas'].rating, 4);
    assert.equal(saved.body.reviews['snack-pedas'].comment, 'Renyah, pedasnya pas.');

    // Editing keeps one review per order line.
    await request(app, 'PUT', url, { ...review, rating: 5 }, buyer.cookie);
    const groupId = app.db
      .prepare('SELECT product_id FROM catalog_variants WHERE id=?')
      .get('snack-pedas').product_id;
    const summary = (await request(app, 'GET', '/api/reviews/summary')).body.summary;
    assert.deepEqual(summary[groupId], { average: 5, count: 1 });

    const list = await request(app, 'GET', '/api/products/' + groupId + '/reviews');
    assert.equal(list.status, 200);
    assert.equal(list.body.count, 1);
    assert.equal(list.body.reviews[0].authorName, 'Nama buyer');
    assert.equal(list.body.reviews[0].rating, 5);

    const catalog = (await request(app, 'GET', '/api/catalog')).body;
    const draft = catalog.edits.find((entry) => entry.groupId === groupId);
    assert.equal(draft.rating, 5);
    assert.equal(draft.reviewCount, 1);
    assert.ok(
      catalog.edits.filter((entry) => entry.groupId !== groupId).every((entry) => !entry.rating),
      'products without reviews have no rating, not sample numbers',
    );

    assert.equal(
      (await request(app, 'GET', '/api/admin/reviews', undefined, buyer.cookie)).status,
      403,
    );
    const adminList = await request(app, 'GET', '/api/admin/reviews', undefined, admin.cookie);
    assert.equal(adminList.status, 200);
    assert.equal(adminList.body.total, 1);
    const id = adminList.body.reviews[0].id;
    assert.equal(
      (await request(app, 'PUT', '/api/admin/reviews/' + id, { hidden: 'yes' }, admin.cookie))
        .status,
      422,
    );
    const hidden = await request(
      app,
      'PUT',
      '/api/admin/reviews/' + id,
      { hidden: true },
      admin.cookie,
    );
    assert.equal(hidden.status, 200);
    assert.equal(hidden.body.hidden, 1);
    assert.equal(
      (await request(app, 'GET', '/api/reviews/summary')).body.summary[groupId],
      undefined,
    );
    assert.equal(
      (await request(app, 'GET', '/api/products/' + groupId + '/reviews')).body.reviews.length,
      0,
    );
    const own = await request(app, 'GET', url, undefined, buyer.cookie);
    assert.equal(own.body.reviews['snack-pedas'].hidden, true, 'the buyer can see it was hidden');
  } finally {
    app.db.close();
  }
});
