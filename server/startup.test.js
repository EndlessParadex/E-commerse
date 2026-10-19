import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createTcpServer } from 'node:net';
import { spawn } from 'node:child_process';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'node:url';

test('busy ports stop the API and frontend with a clear error instead of serving a mixed installation', async () => {
  const occupied = createTcpServer();
  await new Promise((resolve, reject) => {
    occupied.once('error', reject);
    occupied.listen(0, '127.0.0.1', resolve);
  });
  const port = occupied.address().port;
  let vite;
  try {
    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['server/index.js'], {
        cwd: fileURLToPath(new URL('../', import.meta.url)),
        windowsHide: true,
        env: {
          ...process.env,
          PORT: String(port),
          HOST: '127.0.0.1',
          BAM_DB_PATH: ':memory:',
          BAM_INSTALL_MODE: 'demo',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let output = '';
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error('API failed to stop after a port conflict'));
      }, 10000);
      child.stdout.on('data', (data) => {
        output += data;
      });
      child.stderr.on('data', (data) => {
        output += data;
      });
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        resolve({ code, output });
      });
    });
    assert.equal(result.code, 1);
    assert.match(result.output, new RegExp('Port ' + port + ' masih dipakai server lain'));
    assert.doesNotMatch(result.output, /BAM API listening/);
    vite = await createViteServer({
      server: { host: '127.0.0.1', port, watch: null, hmr: false, ws: false },
    });
    await assert.rejects(vite.listen(), /already in use/);
  } finally {
    await vite?.close();
    await new Promise((resolve) => occupied.close(resolve));
  }
});
