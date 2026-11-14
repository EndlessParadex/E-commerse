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
test('web app manifest follows the company profile, and every icon it names is shipped and served', async () => {
  const { createSite, appManifest } = await import('./site.js');
  const { existsSync, readFileSync } = await import('node:fs');
  const profile = {
    shortName: 'Toko Uji',
    legalName: 'CV. Toko Uji Sejahtera',
    description: 'Katalog uji.',
  };
  const site = createSite(null, { snapshot: () => ({ profile }) }, { dist: 'public' });
  const get = (path) => {
    let result;
    const handled = site.respond(
      { method: 'GET', headers: {} },
      {
        writeHead: (status, headers) => (result = { status, headers }),
        end: (body) => (result.body = body),
      },
      path,
    );
    return handled ? result : null;
  };
  const response = get('/manifest.webmanifest');
  assert.equal(response.status, 200);
  assert.match(response.headers['content-type'], /^application\/manifest\+json/);
  // The name can change in Admin → Perusahaan, so the browser must not keep an old copy.
  assert.equal(response.headers['cache-control'], 'no-cache');
  const manifest = JSON.parse(String(response.body));
  assert.deepEqual(manifest, appManifest(profile));
  assert.equal(manifest.name, 'CV. Toko Uji Sejahtera');
  assert.equal(manifest.short_name, 'Toko Uji');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');
  // Chrome offers "Install app" only with 192 and 512 px icons; Android crops the maskable one.
  assert.deepEqual(manifest.icons.map((icon) => icon.sizes).sort(), [
    '192x192',
    '512x512',
    '512x512',
  ]);
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'));
  for (const icon of [...manifest.icons.map((item) => item.src), '/apple-touch-icon.png']) {
    assert.ok(existsSync('public' + icon), icon + ' harus ada di public/');
    const served = get(icon);
    assert.equal(served.status, 200);
    assert.equal(served.headers['content-type'], 'image/png');
    // PNG signature, so a renamed SVG or an empty file cannot pass.
    assert.equal(Buffer.from(served.body).subarray(1, 4).toString(), 'PNG');
  }
  assert.equal(appManifest({ shortName: 'Toko Anda', legalName: '' }).name, 'Toko Anda');
  assert.equal(get('/icon-999.png'), null);
  const page = readFileSync('index.html', 'utf8');
  assert.match(page, /<link rel="manifest" href="\/manifest\.webmanifest" \/>/);
  assert.match(page, /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png" \/>/);
});
