import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createSite } from './site.js';
import { createApp } from './app.js';

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
    const compressed = request('br, gzip');
    assert.equal(compressed.headers['content-encoding'], 'gzip');
    assert.equal(compressed.headers.vary, 'Accept-Encoding');
    assert.equal(gunzipSync(compressed.body).toString(), source);
    assert.ok(compressed.body.length < source.length / 2);
    for (const encoding of ['', 'gzip;q=0, *;q=1', 'br']) {
      const plain = request(encoding);
      assert.equal(plain.headers['content-encoding'], undefined);
      assert.equal(plain.body.toString(), source);
    }
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
