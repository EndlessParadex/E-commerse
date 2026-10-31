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
    assert.ok(container.querySelector('.home-landing--personal'));
    assert.ok(container.querySelector('.bam-vertical-promos.is-personal'));
    assert.equal(container.querySelector('.bam-promotions'), null);
    assert.ok(container.querySelector('.home-category-card'));
    assert.ok(container.querySelector('.bam-supplier-card'));
    assert.equal(container.querySelector('.bam-vertical-promos-heading > a').getAttribute('href'), '#/cari?q=');
    assert.equal(container.querySelectorAll('.bam-vertical-promo-item').length, 4);
    assert.ok(container.querySelector('[aria-label="Jeda pergantian otomatis"]'));
    await click(container.querySelector('[aria-label="Jeda pergantian otomatis"]'));
    assert.ok(container.querySelector('[aria-label="Aktifkan pergantian otomatis"]'));
    await click(container.querySelector('[aria-label="Aktifkan pergantian otomatis"]'));
    assert.ok(container.querySelector('[aria-label="Jeda pergantian otomatis"]'));

    for (const role of ['sales', 'buyer', 'owner']) {
      shop.shared = {
        enabled: true,
        status: 'ready',
        role,
        stores: { stores: [], total: 0, page: 1, pages: 1 },
        selection: {},
        findStores: async () => null,
      };
      await act(async () => {
        root.render(home({ id: 'qa-shopping-account' }));
      });
      assert.equal(container.querySelector('.home-landing--personal'), null, role + ': unchanged B2B home');
      if (role === 'sales') {
        assert.ok(container.querySelector('.bam-promotions'), 'Sales retains its existing promotions');
      } else {
        assert.equal(container.querySelector('.bam-promotions'), null, role + ': operational store homepage unchanged');
      }
      const row = container.querySelector('.home-discovery-row.bam-compact-discovery');
      assert.ok(row, role + ': shared discovery grid visible');
      assert.equal(row.querySelectorAll('.home-category-card').length, 4);
      assert.equal(row.querySelectorAll('.bam-supplier-card').length, 4);
      assert.equal(
        row.querySelector('.home-categories .view-all-link').getAttribute('href'),
        '#/kategori',
      );
      assert.equal(
        row.querySelector('.bam-suppliers .view-all-link').getAttribute('href'),
        '#/pemasok',
      );
    }
    shop.shared = { enabled: false, status: 'ready', role: 'personal' };
    await act(async () => root.render(home({ id: 'qa-private-buyer' })));
    assert.ok(container.querySelector('.home-landing--personal'));
    assert.equal(container.querySelector('.bam-promotions'), null);
    assert.ok(container.querySelector('.bam-vertical-promos.is-personal'));
    assert.equal(
      container.querySelectorAll('.bam-compact-discovery .home-category-card').length,
      4,
    );
    assert.equal(container.querySelectorAll('.bam-compact-discovery .bam-supplier-card').length, 4);

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
