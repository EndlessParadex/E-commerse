import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createApp } from './app.js';

async function request(app, path, method = 'GET') {
  const req = Readable.from([]);
  req.method = method;
  req.url = path;
  req.headers = { host: '127.0.0.1' };
  let result;
  await app.handler(req, {
    writeHead(status, headers) {
      result = { status, headers };
    },
    end(body) {
      result.body = body === undefined ? '' : String(body);
    },
  });
  return result;
}

test('health check answers without a session and reports a broken database', async () => {
  const app = createApp({ dbPath: ':memory:', mailer: { enabled: false } });
  const ok = await request(app, '/api/health');
  assert.equal(ok.status, 200);
  assert.deepEqual(JSON.parse(ok.body), { status: 'ok' });
  assert.equal(ok.headers['cache-control'], 'no-store');
  assert.equal((await request(app, '/api/health', 'HEAD')).status, 200);
  assert.equal((await request(app, '/api/health', 'POST')).status !== 200, true);

  app.db.close();
  const down = await request(app, '/api/health');
  assert.equal(down.status, 503);
  assert.deepEqual(JSON.parse(down.body), { status: 'unavailable' });
});
