import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement } from 'react';

test('readiness explains skipped mail, respects owner settings links and distinguishes queued retry from delivery', async () => {
  const dom = new Window({ url: 'http://fixture.test/' });
  const old = new Map(
    ['window', 'document', 'HTMLElement', 'navigator', 'fetch', 'IS_REACT_ACT_ENVIRONMENT'].map(
      (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)],
    ),
  );
  globalThis.window = dom;
  globalThis.document = dom.document;
  globalThis.HTMLElement = dom.HTMLElement;
  Object.defineProperty(globalThis, 'navigator', { value: dom.navigator, configurable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let data = {
    emailReady: true,
    canManageEmail: false,
    transferReady: false,
    pendingOrders: 0,
    delivery: [
      { status: 'skipped', count: 3 },
      { status: 'sent', count: 2 },
      { status: 'queued', count: 1 },
    ],
    skippedReasons: [
      { reason: '', count: 1 },
      { reason: 'email_unverified', count: 2 },
    ],
    accountDelivery: { queued: 0, retrying: 0 },
    failedMessages: [
      { id: 'notice:one', order_id: 'ORDER-1', status: 'queued', attempts: 2, canRetry: true },
    ],
  };
  let retried = false,
    failRead = false;
  const posts = [];
  globalThis.fetch = async (path, options) => {
    if (options.method === 'POST') {
      posts.push(path);
      data = { ...data, failedMessages: [] };
      return { ok: true, json: async () => ({ retried }) };
    }
    if (failRead) throw new Error('offline');
    return { ok: true, json: async () => structuredClone(data) };
  };
  const vite = await createServer({
    configFile: false,
    resolve: { preserveSymlinks: true },
    oxc: { jsx: { runtime: 'automatic' } },
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: 'custom',
    ssr: { external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'] },
  });
  let root;
  try {
    const { default: CommerceReadiness } = await vite.ssrLoadModule(
      '/src/pages/CommerceReadiness.jsx',
    );
    const { createRoot } = await import('react-dom/client');
    const container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const settle = () => new Promise((resolve) => setTimeout(resolve, 15));
    const wait = async (check) => {
      const until = Date.now() + 4000;
      while (!check() && Date.now() < until) await act(settle);
      assert.ok(check(), container.textContent);
    };
    const button = (text) =>
      [...container.querySelectorAll('button')].find((item) => item.textContent === text);
    const click = async (item) =>
      act(async () => {
        assert.ok(item);
        item.click();
        await settle();
      });
    await act(async () => {
      root.render(createElement(CommerceReadiness));
      await settle();
    });
    await wait(() => container.querySelector('.commerce-delivery-counts'));
    assert.equal(container.querySelector('a[href="#/admin/email"]'), null);
    assert.match(container.textContent, /Minta Pemilik/);
    assert.match(container.textContent, /bukan jumlah pesanan/);
    assert.match(container.textContent, /diterima layanan email/);
    const reasons = [...container.querySelectorAll('details')].find((item) =>
      item.querySelector('summary').textContent.includes('dilewati'),
    );
    assert.equal(reasons.open, false);
    assert.match(reasons.textContent, /1 · Alasan belum tercatat/);
    assert.match(reasons.textContent, /2 · Email pembeli belum dikonfirmasi/);
    assert.equal(
      reasons.querySelector('button'),
      null,
      'skipped messages do not have a retry action',
    );
    await click(reasons.querySelector('summary'));
    assert.equal(reasons.open, true);
    await click(button('Coba kirim ulang'));
    await wait(() => container.querySelector('[role="status"]'));
    assert.match(
      container.querySelector('[role="status"]').textContent,
      /pengiriman ulang tidak dijalankan/,
    );
    assert.deepEqual(posts, ['/api/admin/notifications/notice%3Aone/retry']);
    data = {
      ...data,
      canManageEmail: true,
      failedMessages: [{ id: 'retry', order_id: 'ORDER-2', status: 'failed', canRetry: true }],
    };
    await click(button('Muat ulang status'));
    await wait(() => button('Coba kirim ulang'));
    assert.ok(container.querySelector('a[href="#/admin/email"]'));
    retried = true;
    await click(button('Coba kirim ulang'));
    assert.match(container.querySelector('[role="status"]').textContent, /masuk antrean/);
    assert.doesNotMatch(container.querySelector('[role="status"]').textContent, /berhasil dikirim/);
    failRead = true;
    await click(button('Muat ulang status'));
    await wait(() => container.querySelector('[role="alert"]'));
    failRead = false;
    data = { ...data, delivery: [], skippedReasons: [], failedMessages: [], emailReady: false };
    await click(button('Muat ulang status'));
    await wait(() => container.querySelector('.commerce-delivery-empty'));
    assert.match(container.textContent, /Perlu disiapkan/);
    assert.equal(container.querySelector('[role="alert"]'), null);
    assert.equal(container.querySelector('.commerce-delivery-counts'), null);
  } finally {
    if (root) await act(async () => root.unmount());
    await vite.close();
    dom.happyDOM.abort();
    for (const [key, value] of old) {
      if (value) Object.defineProperty(globalThis, key, value);
      else delete globalThis[key];
    }
  }
});
