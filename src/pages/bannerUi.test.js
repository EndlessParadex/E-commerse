import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement } from 'react';

test('banner: harga panjang, foto, SKU termurah, navigasi, jeda keyboard, gerakan terbatas, dan katalog kosong', async () => {
  const server = await createServer({ configFile: false, resolve: { preserveSymlinks: true }, oxc: { jsx: { runtime: 'automatic' } }, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom', ssr: { external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'] } });
  const { default: Banner } = await server.ssrLoadModule('/src/components/shop/PromoCarousel.jsx');
  const dom = new Window({ url: 'http://localhost/#/' });
  globalThis.window = dom; globalThis.document = dom.document; globalThis.HTMLElement = dom.HTMLElement;
  Object.defineProperty(globalThis, 'navigator', { value: dom.navigator, configurable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const timers = new Map(); let timerId = 0;
  dom.setInterval = (callback) => { timers.set(++timerId, callback); return timerId; }; dom.clearInterval = (id) => timers.delete(id);
  const mediaListeners = new Set(); const media = { matches: false, addEventListener: (_, callback) => mediaListeners.add(callback), removeEventListener: (_, callback) => mediaListeners.delete(callback) };
  dom.matchMedia = () => media;
  Object.defineProperty(dom.document, 'hidden', { value: false, writable: true, configurable: true });
  const image = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"%3E%3Ccircle cx="5" cy="5" r="4"/%3E%3C/svg%3E';
  const catalog = [
    { id: 'EXPENSIVE', groupId: 'expensive', baseName: 'Produk dengan harga panjang', name: 'Produk dengan harga panjang 1pcs', categoryId: 'rumah', sizeLabel: '1pcs', price: 1_000_000_000, oldPrice: 0, image, brand: 'Merek Uji' },
    { id: 'UNIT', groupId: 'snack', baseName: 'Camilan', name: 'Camilan 180g', categoryId: 'snack', sizeLabel: '180g', price: 18000, oldPrice: 24000 },
    { id: 'SMALL', groupId: 'snack', baseName: 'Camilan', name: 'Camilan 23g', categoryId: 'snack', sizeLabel: '23g', price: 3500, oldPrice: 4500 },
  ];
  const categoryList = [{ id: 'rumah', name: 'Perlengkapan Rumah', children: [] }, { id: 'snack', name: 'Snack & Makanan', children: [] }];
  const { createRoot } = await import('react-dom/client'); const container = dom.document.createElement('div'); dom.document.body.append(container); const root = createRoot(container);
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  const click = (label) => act(async () => { const element = container.querySelector(`button[aria-label="${label}"]`); assert.ok(element, label); element.click(); await settle(); });
  try {
    await act(async () => { root.render(createElement(Banner, { catalog, categoryList })); await settle(); });
    assert.equal(container.querySelector('.bam-promo-product').getAttribute('href'), '#/produk/EXPENSIVE');
    assert.equal(container.querySelector('.bam-promo-price strong').textContent, '1.000.000.000');
    assert.ok(container.querySelector('.bam-promo-price.is-long'));
    assert.ok(container.querySelector('.bam-product-media--hero img'));
    assert.equal(container.querySelector('.bam-promo-discount'), null, 'undiscounted products never get a promo claim');
    assert.equal(container.querySelector('.bam-promo-all').getAttribute('href'), '#/cari?q=');
    assert.equal(container.querySelector('.bam-promo-cta').getAttribute('href'), '#/kategori/rumah');
    assert.equal(timers.size, 1);
    await act(async () => { container.querySelector('.bam-promo-cta').focus(); await settle(); });
    assert.equal(timers.size, 0, 'keyboard focus stops autoplay');
    await act(async () => { container.querySelector('.bam-promo-cta').blur(); await settle(); });
    assert.equal(timers.size, 0, 'leaving the banner cannot resume it without user intent');
    await click('Aktifkan pergantian otomatis'); assert.equal(timers.size, 1);
    await act(async () => { [...timers.values()][0](); await settle(); });
    assert.equal(container.querySelector('.bam-promo-cta').getAttribute('href'), '#/kategori/snack');
    assert.equal(container.querySelector('.bam-promo-product').getAttribute('href'), '#/produk/SMALL');
    assert.equal(container.querySelector('.bam-promo-price strong').textContent, '3.500');
    assert.equal(container.querySelector('.bam-promo-discount').textContent, 'Hemat 22%');
    assert.equal(container.querySelector('.bam-promo-artwork-note').textContent, 'Gambar contoh kategori');
    assert.equal(container.querySelector('.bam-promo-product-visual .bam-promo-artwork-note'), null, 'the disclosure never overlays the image');
    assert.equal(container.querySelector('.bam-product-media--hero img').getAttribute('alt'), 'Ilustrasi kategori Snack & Makanan');
    await click('Pilihan berikutnya');
    assert.equal(container.querySelector('.bam-promo-cta').getAttribute('href'), '#/kategori/rumah');
    assert.equal(timers.size, 0);
    await click('Pilihan sebelumnya');
    assert.equal(container.querySelector('.bam-promo-cta').getAttribute('href'), '#/kategori/snack');
    await click('Tampilkan pilihan Perlengkapan Rumah');
    assert.equal(container.querySelector('.bam-promo-dots [aria-current="true"]').getAttribute('aria-label'), 'Tampilkan pilihan Perlengkapan Rumah');
    await click('Aktifkan pergantian otomatis');
    await act(async () => { media.matches = true; for (const callback of mediaListeners) callback(); await settle(); });
    assert.equal(timers.size, 0); assert.equal(container.querySelector('.bam-promo-pause'), null);
    await click('Pilihan berikutnya');
    await act(async () => { root.render(createElement(Banner, { catalog: [
      { id: 'NO-PHOTO', name: 'Tanpa foto', categoryId: 'rumah', price: 12000 },
      { id: 'GALLERY', name: 'Foto dari galeri', categoryId: 'rumah', price: 25000, gallery: [{ src: image, alt: 'Foto asli galeri', label: 'Depan' }] },
    ], categoryList })); await settle(); });
    assert.equal(container.querySelector('.bam-promo-product').getAttribute('href'), '#/produk/GALLERY', 'uploaded gallery photos get the spotlight');
    assert.equal(container.querySelector('.bam-product-media--hero img').getAttribute('alt'), 'Foto asli galeri');
    assert.equal(container.querySelector('.bam-promo-artwork-note'), null, 'uploaded photos are never labelled category illustrations');
    assert.equal(container.querySelectorAll('.bam-promo-product').length, 2, 'the other real featured SKU remains available');
    await act(async () => { root.render(createElement(Banner, { catalog: [{ id: 'CUSTOM', name: 'Kategori baru', categoryId: 'custom', price: 5000 }], categoryList: [{ id: 'custom', name: 'Kategori Baru' }] })); await settle(); });
    assert.equal(container.querySelector('.bam-promo-artwork-note'), null, 'a custom category never gets unrelated food artwork');
    assert.ok(container.querySelector('.bam-product-media--hero .bam-product-fallback'));
    await act(async () => { root.render(createElement(Banner, { catalog: [], categoryList })); await settle(); });
    assert.match(container.querySelector('h1').textContent, /Katalog sedang/);
    assert.equal(container.querySelectorAll('.bam-promo-product').length, 0);
    assert.equal(container.querySelector('.bam-promo-footer'), null);
    assert.equal(container.querySelector('.bam-promo-cta').getAttribute('href'), '#/cari?q=');
  } finally {
    await act(async () => root.unmount()); await server.close(); dom.happyDOM.abort();
    delete globalThis.window; delete globalThis.document; delete globalThis.HTMLElement; delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
