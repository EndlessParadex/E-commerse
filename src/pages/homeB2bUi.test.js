import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement } from 'react';
import { readFile } from 'node:fs/promises';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const serverConfig = {
  configFile: false,
  resolve: { preserveSymlinks: true },
  oxc: { jsx: { runtime: 'automatic' } },
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  appType: 'custom',
  ssr: { external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'] },
};

test('role home: Sales sees only assigned stores, buyer sees its store and server schedule', async () => {
  const dom = new Window({ url: 'http://localhost/#/' });
  globalThis.window = dom;
  globalThis.document = dom.document;
  globalThis.HTMLElement = dom.HTMLElement;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const server = await createServer(serverConfig);
  const { default: B2BHomeExperience } = await server.ssrLoadModule(
    '/src/components/shop/B2BHomeExperience.jsx',
  );
  const { createRoot } = await import('react-dom/client');
  const container = dom.document.createElement('div');
  dom.document.body.append(container);
  const root = createRoot(container);
  const store = {
    id: 'store-1', storeCode: 'TKB-000001', storeName: 'Toko Makmur',
    deliverySchedule: { anchorDate: '2026-10-19', weekday: 1, intervalWeeks: 1 },
  };
  const shared = (role, list, selection = {}) => ({
    role, status: 'ready',
    stores: { stores: list, total: list.length, page: 1, pages: 1 },
    selection,
  });
<<<<<<< HEAD
  const render = async (state, setCartMode) => {
    await act(async () => {
      root.render(createElement(B2BHomeExperience, { shared: state, setCartMode }));
=======
  const modes = [];
  const render = async (state) => {
    await act(async () => {
      root.render(createElement(B2BHomeExperience, {
        shared: state, onCartMode: (mode) => modes.push(mode),
      }));
>>>>>>> 092213987820bba32b709ff4c75c126924fe7b35
      await flush();
    });
  };
  try {
    await render(shared('sales', [store]));
    assert.match(container.querySelector('h1').textContent, /toko pelanggan Anda/);
    assert.ok(container.querySelector('.bam-role-home--sales'));
    assert.match(container.querySelector('.bam-role-home-actions').textContent, /List Toko/);
    assert.equal(container.querySelectorAll('.bam-role-home-card').length, 2);
    assert.equal(container.querySelector('.bam-role-home-card.is-stores').getAttribute('href'),
      '#/keranjang');
    assert.match(container.querySelector('.bam-role-home-card.is-personal').textContent,
      /Belanja biasa/);
    assert.equal(container.querySelector('.bam-role-home-card.is-personal').getAttribute('href'),
      '#/cari?q=');
    assert.doesNotMatch(container.textContent, /Toko Saya/);
<<<<<<< HEAD
    assert.doesNotMatch(container.textContent, /masih dalam pengembangan/);

    const modes = [];
    await render(shared('sales', [store]), (mode) => modes.push(mode));
    await act(async () => {
      container.querySelector('.bam-role-home-card.is-personal').dispatchEvent(
        new dom.MouseEvent('click', { bubbles: true, cancelable: true }),
      );
      container.querySelector('.bam-role-home-card.is-stores').dispatchEvent(
        new dom.MouseEvent('click', { bubbles: true, cancelable: true }),
      );
      await flush();
    });
    assert.deepEqual(modes, ['personal', 'store'], 'tiap kotak memilih keranjang yang tepat');
=======
    assert.match(container.textContent, /Belanja biasa/);
    assert.equal(container.querySelector('.bam-role-home-card.is-personal').getAttribute('href'), '#/cari?q=');
    await act(async () => {
      container.querySelector('.bam-role-home-card.is-personal').click();
      await flush();
    });
    assert.equal(modes.at(-1), 'personal');
>>>>>>> 092213987820bba32b709ff4c75c126924fe7b35

    await render(shared('buyer', [store], { storeId: store.id, date: '2026-10-26' }));
    assert.ok(container.querySelector('.bam-role-home--buyer'));
    assert.match(container.querySelector('h1').textContent, /Belanja mudah untuk tokomu/);
    assert.match(container.querySelector('.bam-role-home-card.is-store').textContent, /Toko Makmur/);
    assert.match(container.querySelector('.bam-role-home-card.is-store').textContent,
      /Setiap Senin · 1 minggu/);
    assert.match(container.querySelector('.bam-role-home-card.is-store').textContent,
      /26 Oktober 2026/);
<<<<<<< HEAD
=======
    assert.equal(container.querySelectorAll('.bam-role-home-card').length, 2);
>>>>>>> 092213987820bba32b709ff4c75c126924fe7b35
    assert.doesNotMatch(container.textContent, /List Toko/);

    await render(shared('buyer', []));
    assert.match(container.textContent, /Akun belum terhubung ke toko/);
    assert.match(container.textContent, /Belanja pribadi/);
    assert.ok(!container.querySelector('.bam-role-home-next-date'));

    const css = await readFile(
      new URL('../components/shop/B2BHomeExperience.css', import.meta.url), 'utf8',
    );
    assert.match(css, /@media \(max-width: 700px\)/);
    assert.match(css, /prefers-reduced-motion/);
  } finally {
    await act(async () => root.unmount());
    await server.close();
    dom.happyDOM.abort();
    for (const key of ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT'])
      delete globalThis[key];
  }
});
