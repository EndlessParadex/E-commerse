import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement, StrictMode } from 'react';

test('navbar: jarak konten mengikuti perubahan tinggi, menu tetap berfungsi, dan jarak dibersihkan saat navbar dilepas', async () => {
  const dom = new Window({ url: 'http://localhost/#/' });
  globalThis.window = dom; globalThis.document = dom.document; globalThis.HTMLElement = dom.HTMLElement;
  Object.defineProperty(globalThis, 'navigator', { value: dom.navigator, configurable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  dom.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  const observers = [];
  dom.ResizeObserver = class {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(target) { this.target = target; }
    disconnect() { this.target = null; }
  };
  let navigationHeight = 128.4;
  const originalRect = dom.HTMLElement.prototype.getBoundingClientRect;
  dom.HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.classList.contains('store-navigation')) return { height: navigationHeight };
    return originalRect.call(this);
  };
  const page = dom.document.documentElement;
  page.style.setProperty('--store-navigation-height', '19px', 'important');
  const server = await createServer({ configFile: false, resolve: { preserveSymlinks: true }, oxc: { jsx: { runtime: 'automatic' } }, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom', ssr: { external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'] } });
  const [{ default: Navbar }, { ShopContext }, { DeliveryContext }] = await Promise.all(['/src/components/layout/Navbar.jsx', '/src/state/useShop.js', '/src/state/useDelivery.js'].map((path) => server.ssrLoadModule(path)));
  const { createRoot } = await import('react-dom/client');
  const container = dom.document.createElement('div'); dom.document.body.append(container);
  let root = createRoot(container);
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  const render = () => act(async () => {
    root.render(createElement(StrictMode, null,
      createElement(DeliveryContext.Provider, { value: { user: null } },
        createElement(ShopContext.Provider, { value: { quantity: 0, unreadCount: 0, cart: [], notifications: [] } }, createElement(Navbar)))));
    await settle();
  });
  const click = (element) => act(async () => { element.click(); await settle(); });
  const height = () => page.style.getPropertyValue('--store-navigation-height');
  try {
    await render();
    assert.equal(height(), '129px');
    const navigation = container.querySelector('.store-navigation');
    assert.ok(navigation.querySelector('.navbar [aria-label="Cari produk"]'));
    assert.ok(navigation.querySelector('.secondary-navbar[aria-label="Navigasi belanja"]'));
    for (const route of ['/keranjang', '/notifikasi', '/akun']) assert.ok(navigation.querySelector(`a[href="#${route}"]`));
    navigationHeight = 165.5;
    dom.dispatchEvent(new dom.Event('resize'));
    assert.equal(height(), '166px', 'a resized header reserves its new height');
    navigationHeight = 177;
    observers.find((observer) => observer.target === navigation).callback();
    assert.equal(height(), '177px', 'content or font changes update the offset without a window resize');

    const category = navigation.querySelector('.bam-category-trigger');
    await click(category);
    assert.ok(navigation.querySelector('.bam-catalog-panel'));
    await act(async () => { category.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await settle(); });
    assert.equal(navigation.querySelector('.bam-catalog-panel'), null);
    assert.equal(dom.document.activeElement, category);
    const delivery = navigation.querySelector('.delivery-trigger');
    await click(delivery);
    assert.equal(navigation.querySelector('.deliver-popup').getAttribute('aria-modal'), 'true');
    assert.equal(dom.document.body.style.overflow, 'hidden');
    await click(navigation.querySelector('.delivery-close'));
    assert.equal(navigation.querySelector('.deliver-popup'), null);
    assert.equal(dom.document.body.style.overflow, '');
    assert.equal(dom.document.activeElement, delivery);

    await act(async () => root.unmount());
    assert.equal(height(), '19px');
    assert.equal(page.style.getPropertyPriority('--store-navigation-height'), 'important');
    assert.ok(observers.every((observer) => observer.target === null));
    navigationHeight = 210;
    dom.dispatchEvent(new dom.Event('resize'));
    assert.equal(height(), '19px', 'an admin view without this navbar cannot retain its offset');

    dom.ResizeObserver = undefined;
    root = createRoot(container);
    await render();
    assert.equal(height(), '210px');
    navigationHeight = 164;
    dom.dispatchEvent(new dom.Event('resize'));
    assert.equal(height(), '164px', 'window resize remains a fallback without ResizeObserver');
  } finally {
    await act(async () => root.unmount()); await server.close(); dom.happyDOM.abort();
    delete globalThis.window; delete globalThis.document; delete globalThis.HTMLElement; delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
