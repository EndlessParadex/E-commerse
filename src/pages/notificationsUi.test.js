import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement } from 'react';
import { createApp } from '../../server/app.js';

test('notifikasi: daftar panjang, filter, pencarian, tautan lama, dan hapus massal menjaga pembaruan baru', async () => {
  const api = createApp({ dbPath: ':memory:' }); const seed = JSON.parse(JSON.stringify(api.catalog.snapshot())); api.db.close();
  const server = await createServer({ configFile: false, resolve: { preserveSymlinks: true }, oxc: { jsx: { runtime: 'automatic' } }, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom', ssr: { external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'] } });
  const [{ default: App }, workflow, catalog] = await Promise.all(['/src/App.jsx', '/src/state/frontendWorkflow.js', '/src/data/products.js'].map((path) => server.ssrLoadModule(path)));
  const dom = new Window({ url: 'http://localhost/#/notifikasi' }); const previousFetch = globalThis.fetch;
  globalThis.window = dom; globalThis.document = dom.document; globalThis.HTMLElement = dom.HTMLElement; globalThis.ResizeObserver = dom.ResizeObserver;
  Object.defineProperty(globalThis, 'navigator', { value: dom.navigator, configurable: true }); Object.defineProperty(globalThis, 'localStorage', { value: dom.localStorage, configurable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true; dom.scrollTo = () => {};
  dom.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); }; dom.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  globalThis.fetch = async (url) => url === '/api/catalog' ? new Response(JSON.stringify(seed)) : url === '/api/auth/me' ? new Response('{}', { status: 401 }) : new Response('{}', { status: 404 });
  const now = Date.now();
  dom.localStorage.setItem('bam.shop.v1', JSON.stringify({ cart: [], favoriteIds: ['snack-pedas'], notifications: Array.from({ length: 12 }, (_, i) => ({ id: 'order-BAM-OLD-' + i, orderId: 'BAM-OLD-' + i, kind: i % 2 ? 'orderCancelled' : 'orderCreated', title: 'Pesanan lama', message: 'Pesanan lama', read: i >= 2, createdAt: now - i * 1000 })) }));
  const { createRoot } = await import('react-dom/client'); const container = dom.document.createElement('div'); dom.document.body.append(container); const root = createRoot(container);
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  const click = (element) => act(async () => { assert.ok(element, 'control exists'); element.click(); await settle(); });
  const button = (text) => [...container.querySelectorAll('button')].find((element) => element.textContent === text);
  const filter = (label) => [...container.querySelectorAll('.notification-filters button')].find((element) => element.querySelector('span').textContent === label);
  const fillSearch = (value) => act(async () => { const input = container.querySelector('.notification-search input'); Object.getOwnPropertyDescriptor(dom.HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new dom.Event('input', { bubbles: true })); await settle(); });
  const notes = () => JSON.parse(dom.localStorage.getItem('bam.shop.v1')).notifications;
  try {
    await act(async () => { root.render(createElement(App)); await settle(); });
    assert.equal(container.querySelectorAll('.notifications-panel .notification-item').length, 10);
    await click(button('Tampilkan lebih banyak'));
    assert.equal(container.querySelectorAll('.notifications-panel .notification-item').length, 12);
    assert.equal(container.querySelectorAll('.notifications-panel .notification-item a').length, 0, 'old notifications cannot link to absent session orders');
    assert.match(container.querySelector('.notification-history-unavailable').textContent, /tab tempat pesanan dibuat/);
    await click(filter('Belum dibaca')); assert.equal(container.querySelectorAll('.notifications-panel .notification-item').length, 2);
    await click(filter('Pembayaran')); assert.match(container.querySelector('.notification-empty').textContent, /Tidak ada notifikasi yang cocok/);
    await click(filter('Semua')); await fillSearch('BAM-OLD-11');
    assert.equal(container.querySelectorAll('.notifications-panel .notification-item').length, 1);
    await fillSearch('');
    await click(button('Hapus yang sudah dibaca'));
    const product = catalog.products.find((item) => item.id === 'snack-pedas');
    let newOrder;
    await act(async () => { newOrder = workflow.placePreviewOrder({ cart: [{ id: product.id, name: product.name, price: product.price, quantity: 1 }], recipient: 'Pembeli Uji', address: 'Alamat pengujian', payment: { id: 'va-bca' }, shipping: { label: 'Reguler', cost: 10000 } }, dom.sessionStorage); await settle(); });
    assert.equal(notes().length, 13);
    await click(button('Ya, hapus notifikasi'));
    assert.equal(notes().length, 3); assert.ok(notes().every((item) => !item.read));
    assert.ok(notes().some((item) => item.orderId === newOrder.id));
    assert.equal(dom.document.activeElement, filter('Semua'), 'closing the confirmation restores a usable keyboard focus target');
    const link = container.querySelector('.notifications-panel .notification-item a');
    assert.equal(link.getAttribute('href'), '#/pesanan/' + newOrder.id);
    assert.deepEqual(JSON.parse(dom.localStorage.getItem('bam.shop.v1')).favoriteIds, ['snack-pedas']);
    const bell = container.querySelector('a[aria-label="Notifikasi, 3 belum dibaca"]');
    await act(async () => { bell.dispatchEvent(new dom.FocusEvent('focusin', { bubbles: true })); await settle(); });
    assert.ok(container.querySelector('.shop-preview .notification-compact a[href="#/pesanan/' + newOrder.id + '"]'), 'the bell preview uses the same available order link');
  } finally {
    await act(async () => root.unmount()); await server.close(); dom.happyDOM.abort(); globalThis.fetch = previousFetch;
    delete globalThis.window; delete globalThis.document; delete globalThis.localStorage; delete globalThis.HTMLElement; delete globalThis.ResizeObserver; delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
