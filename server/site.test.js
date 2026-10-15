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
