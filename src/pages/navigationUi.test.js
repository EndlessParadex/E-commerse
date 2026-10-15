import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement } from 'react';

test('pemulihan tampilan: banner lengkap, kotak promo, pemasok, menu admin dan guard isian', async () => {
  const dom = new Window({ url: 'http://navigation.test/#/' });
  globalThis.window = dom;
  globalThis.document = dom.document;
  globalThis.HTMLElement = dom.HTMLElement;
  globalThis.ResizeObserver = dom.ResizeObserver;
  Object.defineProperty(globalThis, 'navigator', { value: dom.navigator, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', {
    value: dom.localStorage,
    configurable: true,
  });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  dom.scrollTo = () => {};
  let reduced = false;
  let scrolled;
  let accepted = false;
  let confirmations = 0;
  dom.matchMedia = () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} });
  dom.confirm = () => {
    confirmations += 1;
    return accepted;
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
    const [{ default: Home }, { default: AdminPage }, { ShopContext }, { DeliveryContext }] =
      await Promise.all(
        [
          '/src/pages/Home.jsx',
          '/src/pages/AdminPage.jsx',
          '/src/state/useShop.js',
          '/src/state/useDelivery.js',
        ].map((path) => vite.ssrLoadModule(path)),
      );
    const { createRoot } = await import('react-dom/client');
    const container = dom.document.createElement('div');
    dom.document.body.append(container);
    root = createRoot(container);
    const click = async (element) => {
      assert.ok(element);
      await act(async () => {
        element.click();
      });
    };
    const shop = {
      favoriteIds: [],
      addItem() {},
      toggleFavorite() {},
      stockFor: () => ({ available: 120, maximum: 99, failed: false }),
    };
    const home = (user) =>
      createElement(
        DeliveryContext.Provider,
        { value: { user } },
        createElement(ShopContext.Provider, { value: shop }, createElement(Home)),
      );
    await act(async () => root.render(home(null)));
    assert.ok(
      container.querySelector('.bam-promo-product.is-secondary'),
      'produk kedua pada banner kembali tersedia',
    );
    assert.ok(
      container.querySelector('.bam-promotions-intro'),
      'kotak informasi promo kembali tersedia',
    );
    assert.ok(container.querySelector('.home-category-card'));
    assert.ok(container.querySelector('.bam-supplier-card'));
    const catalog = container.querySelector('#catalog');
    catalog.scrollIntoView = (options) => {
      scrolled = options;
    };
    const catalogLink = container.querySelector('.bam-promotions-intro a[href="#catalog"]');
    await click(catalogLink);
    assert.equal(scrolled.behavior, 'smooth');
    assert.equal(dom.location.hash, '#/');
    reduced = true;
    await click(catalogLink);
    assert.equal(scrolled.behavior, 'instant');
    assert.equal(dom.location.hash, '#/');
    reduced = false;
    assert.ok(container.querySelector('[aria-label="Jeda pergantian otomatis"]'));
    await click(container.querySelector('[aria-label="Jeda pergantian otomatis"]'));
    assert.ok(container.querySelector('[aria-label="Aktifkan pergantian otomatis"]'));
    await click(container.querySelector('[aria-label="Aktifkan pergantian otomatis"]'));
    assert.ok(container.querySelector('[aria-label="Jeda pergantian otomatis"]'));

    await act(async () => root.render(createElement(AdminPage, { view: 'overview' })));
    const toggle = container.querySelector('.admin-menu-toggle');
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    for (const route of [
      '#/admin',
      '#/admin/produk',
      '#/admin/pesanan',
      '#/admin/stok',
      '#/admin/pemasok',
      '#/admin/merek',
      '#/admin/kategori',
      '#/admin/perusahaan',
    ])
      assert.ok(container.querySelector('.admin-navigation a[href="' + route + '"]'));
    assert.equal(container.querySelectorAll('.admin-navigation a[aria-current="page"]').length, 1);
    assert.ok(
      container.querySelector('.admin-supplier'),
      'rincian pemasok kembali langsung ditampilkan',
    );
    await click(
      [...container.querySelectorAll('button')].find(
        (button) => button.textContent === '+ Tambah produk',
      ),
    );
    const name = container.querySelector('#product-baseName');
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.HTMLInputElement.prototype, 'value').set.call(
        name,
        'Produk belum disimpan',
      );
      name.dispatchEvent(new dom.Event('input', { bubbles: true }));
    });
    await click(toggle);
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    await click(container.querySelector('.admin-navigation a[href="#/admin/pemasok"]'));
    assert.equal(confirmations, 1);
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(container.querySelector('#product-baseName').value, 'Produk belum disimpan');
    await click(toggle);
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(container.querySelector('#product-baseName').value, 'Produk belum disimpan');
    await click(toggle);
    accepted = true;
    await click(container.querySelector('.admin-navigation a[href="#/admin/pemasok"]'));
    assert.equal(container.querySelector('#product-baseName'), null);
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  } finally {
    if (root) await act(async () => root.unmount());
    await vite.close();
    dom.happyDOM.abort();
  }
});
