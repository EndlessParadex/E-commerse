import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement, Fragment } from 'react';
import { createApp } from '../../server/app.js';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const makeServer = () =>
  createServer({
    configFile: false,
    resolve: { preserveSymlinks: true },
    oxc: { jsx: { runtime: 'automatic' } },
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: 'custom',
    ssr: { external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'] },
  });
function useDOM() {
  const dom = new Window({ url: 'http://localhost/#/' });
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
  return dom;
}
function releaseDOM(dom) {
  dom.happyDOM.abort();
  for (const key of [
    'window',
    'document',
    'HTMLElement',
    'ResizeObserver',
    'localStorage',
    'IS_REACT_ACT_ENVIRONMENT',
  ])
    delete globalThis[key];
}
const luminance = (hex) =>
  hex
    .slice(1, 7)
    .match(/../g)
    .map((part) => parseInt(part, 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
const contrast = (a, b) => {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

test('beranda: kategori admin menghitung produk, foto tetap dalam kategori/SKU, harga panjang terbaca, dan aksi kartu tetap berfungsi', async () => {
  const dom = useDOM();
  const server = await makeServer();
  const [{ default: Shortcuts }, { default: Card }, { ShopContext }, { products }, { categories }] =
    await Promise.all(
      [
        '/src/components/shop/CategoryShortcuts.jsx',
        '/src/components/shop/ProductCard.jsx',
        '/src/state/useShop.js',
        '/src/data/products.js',
        '/src/data/catalog.js',
      ].map((path) => server.ssrLoadModule(path)),
    );
  const originalProducts = [...products],
    originalCategories = [...categories];
  const image =
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"%3E%3Ccircle cx="5" cy="5" r="4"/%3E%3C/svg%3E';
  const variant = {
    id: 'qa-small',
    groupId: 'qa-snack',
    baseName: 'Camilan',
    name: 'Camilan 23g',
    categoryId: 'snack',
    sizeValue: 23,
    sizeUnit: 'g',
    sizeLabel: '23g',
    price: 1000,
    oldPrice: 0,
    rating: 0,
    sold: '0',
    icon: '🍫',
    color: 'coral',
    brand: 'Merek Camilan',
  };
  const longName =
    'Produk dengan nama yang panjang untuk tetap terbaca melalui judul dan detail 1pcs';
  let photoProduct = {
    ...variant,
    id: 'qa-photo',
    groupId: 'qa-photo',
    baseName: longName,
    name: longName,
    categoryId: 'qa-custom',
    sizeValue: 1,
    sizeUnit: 'pcs',
    sizeLabel: '1pcs',
    price: 1_000_000_000,
    oldPrice: 1_500_000_000,
    brand: 'Merek Produk Uji',
    image: '',
    gallery: [{ src: image, alt: 'Foto SKU asli', label: 'Depan' }],
  };
  products.splice(
    0,
    products.length,
    variant,
    {
      ...variant,
      id: 'qa-large',
      sizeValue: 62,
      sizeLabel: '62g',
      price: 2000,
      gallery: [{ src: image, alt: 'Foto camilan ukuran 62g', label: 'Depan' }],
    },
    photoProduct,
  );
  categories.splice(
    0,
    categories.length,
    { id: 'snack', name: 'Snack & Makanan', icon: '🍫',
      children: [{ id: 'keripik', name: 'Keripik' }] },
    { id: 'qa-custom', name: 'Kategori Baru dari Admin', icon: '📦', children: [] },
    { id: 'qa-empty', name: 'Kategori Kosong', icon: '🧼', children: [] },
  );
  const styles = dom.document.createElement('style');
  styles.textContent = (
    await Promise.all(
      [
        '../styles/themes.css',
        '../components/shop/CategoryShortcuts.css',
        '../components/shop/ProductCard.css',
        '../styles/global.css',
      ].map((path) => readFile(new URL(path, import.meta.url), 'utf8')),
    )
  ).join('\n');
  dom.document.head.append(styles);
  const { createRoot } = await import('react-dom/client');
  const container = dom.document.createElement('div');
  dom.document.body.append(container);
  const root = createRoot(container);
  const added = [],
    favorites = [];
  let isFavorite = false;
  const render = () =>
    act(async () => {
      root.render(
        createElement(
          ShopContext.Provider,
          { value: { stockFor: () => ({ available: 100, failed: false }) } },
          createElement(
            Fragment,
            null,
            createElement(Shortcuts),
            createElement(Card, {
              product: photoProduct,
              onAdd: (product) => {
                added.push(product.id);
              },
              onToggleFavorite: (id) => favorites.push(id),
              isFavorite,
            }),
          ),
        ),
      );
      await settle();
    });
  try {
    await render();
    const shortcuts = [...container.querySelectorAll('.home-category-card')];
    assert.equal(shortcuts.length, 3);
    assert.equal(shortcuts[0].getAttribute('href'), '#/kategori/snack');
    assert.match(shortcuts[0].textContent, /Keripik/, 'kategori menampilkan pratinjau subkategori');
    assert.match(shortcuts[0].textContent, /1 produk/, 'two sizes remain one product');
    assert.equal(shortcuts[0].querySelector('img').getAttribute('alt'), 'Foto camilan ukuran 62g');
    assert.equal(shortcuts[1].getAttribute('href'), '#/kategori/qa-custom');
    assert.match(shortcuts[2].textContent, /Produk belum tersedia/);
    assert.ok(
      !shortcuts[2].querySelector('img'),
      'empty categories cannot borrow another category photo',
    );
    assert.equal(container.querySelector('.product-card img').getAttribute('alt'), 'Foto SKU asli');
    assert.equal(container.querySelector('.product-card h3 a').textContent, longName);
    assert.equal(container.querySelector('.product-card h3 a').title, longName);
    assert.equal(
      container.querySelector('.product-card h3 a').getAttribute('href'),
      '#/produk/qa-photo',
    );
    assert.equal(
      container.querySelector('.product-price-amount').textContent.replace(/\s/g, ' '),
      'Rp 1.000.000.000',
    );
    assert.ok(container.querySelector('.product-price.is-long-price'));
    for (const mode of ['light', 'dark']) {
      dom.document.documentElement.dataset.theme = mode;
      for (const shortcut of shortcuts) {
        const background = dom.getComputedStyle(shortcut).backgroundColor;
        for (const selector of ['.home-category-copy strong', '.home-category-copy > span'])
          assert.ok(
            contrast(dom.getComputedStyle(shortcut.querySelector(selector)).color, background) >=
              4.5,
            `${mode}: category text remains readable`,
          );
      }
      const button = container.querySelector('.add-product-button');
      assert.ok(
        contrast(
          dom.getComputedStyle(button).color,
          dom.getComputedStyle(button).backgroundColor,
        ) >= 4.5,
        `${mode}: cart button remains readable`,
      );
    }
    await act(async () => {
      container.querySelector('.add-product-button').click();
      container.querySelector('.favorite-button').click();
      await settle();
    });
    assert.deepEqual(added, ['qa-photo']);
    assert.deepEqual(favorites, ['qa-photo']);
    isFavorite = true;
    await render();
    assert.equal(container.querySelector('.favorite-button').getAttribute('aria-pressed'), 'true');
    await act(async () => {
      container.querySelector('.product-card img').dispatchEvent(new dom.Event('error'));
      await settle();
    });
    assert.ok(!container.querySelector('.product-card img'));
    assert.ok(container.querySelector('.product-card .bam-product-fallback'));
    photoProduct = {
      ...photoProduct,
      gallery: [{ src: image + '#new-photo', alt: 'Foto SKU diganti', label: 'Depan' }],
    };
    await render();
    assert.equal(
      container.querySelector('.product-card img').getAttribute('alt'),
      'Foto SKU diganti',
    );
    products.splice(0, 2);
    await render();
    assert.match(
      container.querySelector('.home-category-card').textContent,
      /Produk belum tersedia/,
    );
    assert.ok(!container.querySelector('.home-category-card').querySelector('img'));
    categories.splice(0);
    await render();
    assert.ok(!container.querySelector('.home-categories'));
  } finally {
    await act(async () => root.unmount());
    products.splice(0, products.length, ...originalProducts);
    categories.splice(0, categories.length, ...originalCategories);
    await server.close();
    releaseDOM(dom);
  }
});

test('katalog: kerangka kartu hanya saat memuat, kegagalan memberi tombol coba lagi, dan sukses menampilkan beranda', async () => {
  const api = createApp({ dbPath: ':memory:' });
  api.catalog.workflowEnabled = false; // Exercise compatibility with the earlier catalog-only API.
  const seed = api.catalog.snapshot();
  api.db.close();
  const dom = useDOM();
  const previousFetch = globalThis.fetch;
  const server = await makeServer();
  const pending = [];
  let requests = 0;
  globalThis.fetch = async (url) => {
    if (url === '/api/catalog') {
      requests++;
      return new Promise((resolve) => pending.push(resolve));
    }
    if (url === '/api/auth/me') return new Response('{}', { status: 401 });
    throw new Error('Unexpected request: ' + url);
  };
  const { default: App } = await server.ssrLoadModule('/src/App.jsx');
  const { createRoot } = await import('react-dom/client');
  const container = dom.document.createElement('div');
  dom.document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(createElement(App));
      await settle();
    });
    assert.match(container.querySelector('h1').textContent, /Memuat katalog/);
    assert.equal(container.querySelector('main').getAttribute('aria-busy'), 'true');
    assert.equal(container.querySelector('.catalog-skeleton').getAttribute('aria-hidden'), 'true');
    assert.ok(!container.querySelector('.add-product-button'));
    await act(async () => {
      pending.shift()(new Response('{}', { status: 503 }));
      await settle();
    });
    assert.match(container.querySelector('h1').textContent, /Katalog belum dapat dimuat/);
    assert.ok(!container.querySelector('.catalog-skeleton'));
    assert.equal(container.querySelector('main').getAttribute('aria-busy'), 'false');
    await act(async () => {
      container.querySelector('.catalog-status-error button').click();
      await settle();
    });
    assert.equal(requests, 2);
    assert.ok(container.querySelector('.catalog-skeleton'));
    await act(async () => {
      pending.shift()(new Response(JSON.stringify(seed)));
      await settle();
    });
    assert.ok(!container.querySelector('.catalog-status'));
    assert.ok(container.querySelector('.home-categories'));
    assert.ok(container.querySelector('.bam-promotions'));
    assert.ok(container.querySelector('.store-featured-products'));
    const sections = [...container.querySelector('.home-container').children];
    const featureRail = container.querySelector('.home-feature-rail');
    const discoveryRow = container.querySelector('.home-discovery-row');
    const categoriesSection = discoveryRow?.querySelector('.home-categories');
    const supplierSection = discoveryRow?.querySelector('.bam-suppliers');
    const promotionSection = container.querySelector('.bam-promotions');
    const featuredSection = container.querySelector('.store-featured-products');
    assert.ok(featureRail, 'Banner utama dan promo vertikal tampil di beranda');
    assert.ok(featureRail.querySelector('.bam-promo'), 'Banner katalog utama tetap ada');
    assert.ok(featureRail.querySelector('.bam-vertical-promos'), 'Panel promo vertikal tersedia');
    assert.ok(categoriesSection, 'Kategori berada dalam baris penemuan produk');
    assert.ok(supplierSection, 'Mitra pemasok berada dalam baris yang sama');
    assert.deepEqual([...discoveryRow.children], [categoriesSection, supplierSection],
      'Kategori di kiri dan mitra pemasok di kanan');
    assert.deepEqual(
      [sections.indexOf(featureRail), sections.indexOf(discoveryRow),
        sections.indexOf(promotionSection), sections.indexOf(featuredSection)],
      [0, 1, 2, 3],
      'Beranda menampilkan banner, kategori/pemasok, promo katalog, lalu produk',
    );
    const discoveryStyles = await readFile(new URL('./StorefrontDesign2.css', import.meta.url), 'utf8');
    assert.ok(discoveryStyles.includes('.home-landing .home-discovery-row {'),
      'Layout kategori dan mitra pemasok mempunyai CSS grid');
    assert.ok(discoveryStyles.includes('grid-template-columns: minmax(0, 1.12fr) minmax(0, .88fr)'),
      'Desktop membagi kategori dan pemasok menjadi dua kolom');
    assert.ok(discoveryStyles.includes('@media (max-width: 960px)'),
      'Tablet dan HP mempunyai aturan tata letak responsif');
  } finally {
    await act(async () => root.unmount());
    await server.close();
    releaseDOM(dom);
    globalThis.fetch = previousFetch;
  }
});
