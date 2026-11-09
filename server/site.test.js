import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';
import { Readable } from 'node:stream';
const html =
  '<!doctype html><html><head><title>E-Commerce</title><meta name="description" content="old"></head><body><div id="root"></div></body></html>';
async function request(app, path) {
  const req = Readable.from([]);
  req.method = 'GET';
  req.url = path;
  req.headers = { host: 'untrusted.example' };
  let result;
  await app.handler(req, {
    writeHead(status, headers) {
      result = { status, headers };
    },
    end(body) {
      result.body = String(body);
    },
  });
  return result;
}
test('public product URLs serve product HTML and metadata without JS, with canonical links and sitemap', async () => {
  const app = createApp({
    dbPath: ':memory:',
    siteIndexHtml: () => html,
    mailer: { enabled: false },
    mailConfig: { publicUrl: 'https://shop.fixture.test' },
  });
  try {
    const response = await request(app, '/produk/snack-pedas');
    assert.equal(response.status, 200);
    assert.match(response.body, /<h1>Keripik Singkong Balado 180g<\/h1>/);
    assert.match(response.body, /application\/ld\+json/);
    assert.match(response.body, /https:\/\/shop.fixture.test\/produk\/snack-pedas/);
    assert.doesNotMatch(response.body, /untrusted.example/);
    assert.match(response.body, /<meta property="og:title"/);
    assert.equal((response.body.match(/name="description"/g) || []).length, 1);
    assert.equal((await request(app, '/produk/does-not-exist')).status, 404);
    assert.match(
      (await request(app, '/sitemap.xml')).body,
      /shop.fixture.test\/produk\/snack-pedas/,
    );
    assert.match((await request(app, '/robots.txt')).body, /Allow: \/produk\//);
    const metadata = JSON.parse((await request(app, '/api/public/products/snack-pedas')).body);
    assert.equal(typeof metadata.imageData, 'boolean');
    assert.equal(metadata.soldUnits, undefined);
  } finally {
    app.db.close();
  }
});
test('public HTML escapes catalog text and structured data cannot end its script', async () => {
  const app = createApp({
    dbPath: ':memory:',
    siteIndexHtml: () => html,
    mailer: { enabled: false },
  });
  try {
    const catalog = app.catalog.snapshot(),
      product = catalog.edits.find((x) => x.groupId === 'snack-pedas');
    product.baseName = '</script><img src=x onerror=alert(1)>';
    product.description = '</script><script>attack()</script>';
    app.catalog.save(catalog);
    const response = await request(app, '/produk/snack-pedas');
    assert.equal(response.status, 200);
    assert.doesNotMatch(response.body, /<script>attack\(\)<\/script>/);
    assert.match(response.body, /&lt;script&gt;/);
    assert.match(response.body, /\\u003c\/script\\u003e/);
    assert.equal((await request(app, '/assets/../../server/app.js')).status, 404);
  } finally {
    app.db.close();
  }
});
test('home page link preview names the shop photo with absolute URLs and no duplicate tags', async () => {
  const template =
    '<!doctype html><html><head><title>Old</title><meta property="og:type" content="website" /><meta property="og:image" content="/old.png" /></head><body><div id="root"></div></body></html>';
  const pixel =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const app = createApp({
    dbPath: ':memory:',
    siteIndexHtml: () => template,
    mailer: { enabled: false },
    mailConfig: { publicUrl: 'https://shop.fixture.test' },
  });
  const local = createApp({
    dbPath: ':memory:',
    siteIndexHtml: () => template,
    mailer: { enabled: false },
  });
  try {
    const count = (body, pattern) => (body.match(pattern) || []).length;
    let home = (await request(app, '/')).body;
    assert.equal(count(home, /property="og:type"/g), 1);
    assert.match(home, /<meta property="og:url" content="https:\/\/shop.fixture.test\/">/);
    // The template's stale image is removed even when no product has a photo yet.
    assert.equal(count(home, /property="og:image"/g), 0);

    const catalog = app.catalog.snapshot();
    const product = catalog.edits.find((x) => x.groupId === 'snack-pedas');
    product.gallery = [{ src: pixel, label: 'Depan' }];
    app.catalog.save(catalog);
    home = (await request(app, '/')).body;
    const image = home.match(/<meta property="og:image" content="([^"]+)">/)?.[1];
    assert.ok(image?.startsWith('https://shop.fixture.test/api/public/products/'), image);
    assert.match(home, /name="twitter:card" content="summary_large_image"/);
    const served = await request(app, new URL(image).pathname);
    assert.equal(served.status, 200);
    assert.equal(served.headers['content-type'], 'image/png');

    // Without a public address there is no absolute URL to give, so no image or page URL.
    const plain = (await request(local, '/')).body;
    assert.equal(count(plain, /property="og:type"/g), 1);
    assert.doesNotMatch(plain, /og:image|og:url/);
  } finally {
    app.db.close();
    local.db.close();
  }
});
