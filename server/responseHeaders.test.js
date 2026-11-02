import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync, brotliDecompressSync } from 'node:zlib';
import { createSite } from './site.js';
import { createApp } from './app.js';

test('public product HTML compresses without stale catalog caching and HEAD has no body', async () => {
  const app = createApp({
    dbPath: ':memory:',
    siteIndexHtml: () => '<html><head></head><body><div id="root"></div></body></html>',
  });
  try {
    const request = async (url, method, encoding) => {
      let response;
      await app.handler(
        { url, method, headers: { host: 'localhost', 'accept-encoding': encoding } },
        {
          writeHead(status, headers) {
            response = { status, headers };
          },
          end(body) {
            response.body = body;
          },
        },
      );
      return response;
    };
    for (const url of ['/', '/produk/snack-pedas', '/produk/missing']) {
      const plain = await request(url, 'GET', 'identity');
      for (const encoding of ['br', 'gzip']) {
        const result = await request(url, 'GET', encoding);
        const decode = encoding === 'br' ? brotliDecompressSync : gunzipSync;
        assert.equal(result.headers['content-encoding'], encoding);
        assert.equal(decode(result.body).toString(), plain.body.toString());
        assert.equal(result.headers['cache-control'], 'no-cache');
        const head = await request(url, 'HEAD', encoding);
        assert.equal(head.body, undefined);
        assert.equal(head.headers['content-length'], result.body.length);
      }
    }
  } finally {
    app.db.close();
  }
});

test('public assets negotiate gzip, respect q=0, and retain HEAD metadata', () => {
  const dist = mkdtempSync(join(tmpdir(), 'bam-assets-'));
  try {
    mkdirSync(join(dist, 'assets'));
    const source = 'body { color: blue; }'.repeat(200);
    writeFileSync(join(dist, 'assets', 'app.css'), source);
    const site = createSite(null, null, { dist });
    const request = (encoding, method = 'GET') => {
      let response;
      site.respond(
        { method, headers: { 'accept-encoding': encoding } },
        {
          writeHead(status, headers) {
            response = { status, headers };
          },
          end(body) {
            response.body = body;
          },
        },
        '/assets/app.css',
      );
      return response;
    };
    const compressed = request('gzip');
    assert.equal(compressed.headers['content-encoding'], 'gzip');
    assert.equal(compressed.headers.vary, 'Accept-Encoding');
    assert.equal(gunzipSync(compressed.body).toString(), source);
    assert.ok(compressed.body.length < source.length / 2);
    for (const encoding of ['', 'gzip;q=0, br;q=0', 'identity']) {
      const plain = request(encoding);
      assert.equal(plain.headers['content-encoding'], undefined);
      assert.equal(plain.body.toString(), source);
    }
    const brotli = request('br, gzip');
    assert.equal(brotli.headers['content-encoding'], 'br');
    assert.equal(brotliDecompressSync(brotli.body).toString(), source);
    assert.equal(request('br;q=0, gzip').headers['content-encoding'], 'gzip');
    assert.equal(request('br;q=0.2, gzip;q=0.9').headers['content-encoding'], 'gzip');
    assert.equal(request('identity;q=1, br;q=0.2').headers['content-encoding'], undefined);
    const head = request('gzip', 'HEAD');
    assert.equal(head.body, undefined);
    assert.equal(head.headers['content-length'], compressed.body.length);
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});

test('HTML and API errors receive frame protection; HSTS uses configured HTTPS, not spoofed headers', async () => {
  for (const publicUrl of ['http://localhost:3000', 'https://shop.fixture.test']) {
    const app = createApp({
      dbPath: ':memory:',
      siteIndexHtml: () => '<html><head></head></html>',
      mailConfig: { publicUrl },
    });
    try {
      for (const url of ['/', '/api/missing-route']) {
        let headers;
        await app.handler(
          { method: 'GET', url, headers: { host: 'localhost', 'x-forwarded-proto': 'https' } },
          {
            writeHead(_status, value) {
              headers = value;
            },
            end() {},
          },
        );
        assert.match(headers['content-security-policy'], /frame-ancestors 'none'/);
        assert.equal(headers['x-frame-options'], 'DENY');
        assert.equal(
          headers['strict-transport-security'],
          publicUrl.startsWith('https:') ? 'max-age=31536000' : undefined,
        );
        assert.equal(headers['content-encoding'], undefined);
      }
    } finally {
      app.db.close();
    }
  }
});
