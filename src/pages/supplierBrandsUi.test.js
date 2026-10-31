import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement } from 'react';
import { createApp } from '../../server/app.js';

test('PT opens only its brand cards; brand products and photos remain scoped; Back and empty brands work', async () => {
  const api = createApp({ dbPath: ':memory:' });
  api.catalog.workflowEnabled = false;
  const seed = structuredClone(api.catalog.snapshot());
  api.db.close();
  seed.masters.suppliers.push(
    { id: 'qa-first', name: 'PT Uji Utama', initials: 'UU', color: 'sky', logo: '' },
    { id: 'qa-second', name: 'PT Uji Kedua', initials: 'UK', color: 'mint', logo: '' },
    { id: 'qa-no-brands', name: 'PT Tanpa Merek', initials: 'TM', color: 'rose', logo: '' },
  );
  seed.masters.brands.push(
    { id: 'qa-brio', name: 'Brio Potato', supplierIds: ['qa-first', 'qa-second'] },
    { id: 'qa-fries', name: 'French Fries', supplierIds: ['qa-first'] },
    { id: 'qa-new', name: 'Merek Baru', supplierIds: ['qa-first'] },
    { id: 'qa-other', name: 'Merek PT Lain', supplierIds: ['qa-second'] },
  );
  const png =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6NnQAAAAASUVORK5CYII=';
  seed.masters.brands.find((brand) => brand.id === 'qa-fries').logo = png;
  const product = (id, supplierId, brandId, brand, name, alt) => ({
    ...structuredClone(seed.edits[0]),
    groupId: id,
    supplierId,
    brandId,
    brand,
    baseName: name,
    image: png,
    imageAlt: alt,
    gallery: [{ src: png, alt }],
    variants: [
      {
        id,
        sizeValue: '49',
        sizeUnit: 'g',
        packagingType: 'satuan',
        unitsPerPackage: '1',
        packsPerBox: '',
        price: '4600',
        oldPrice: '',
      },
    ],
  });
  seed.edits.push(
    product(
      'qa-brio-first',
      'qa-first',
      'qa-brio',
      'Brio Potato',
      'Brio Family PT Utama',
      'Foto Brio PT Utama',
    ),
    product(
      'qa-brio-second',
      'qa-second',
      'qa-brio',
      'Brio Potato',
      'Brio Khusus PT Kedua',
      'Foto Brio PT Kedua',
    ),
    product(
      'qa-fries-first',
      'qa-first',
      'qa-fries',
      'French Fries',
      'French Fries PT Utama',
      'Foto French Fries PT Utama',
    ),
    product(
      'qa-other-second',
      'qa-second',
      'qa-other',
      'Merek PT Lain',
      'Produk PT Lain',
      'Foto Produk PT Lain',
    ),
  );
  seed.edits
    .find((item) => item.groupId === 'qa-brio-first')
    .variants.push({
      id: 'qa-brio-first-93g',
      sizeValue: '93',
      sizeUnit: 'g',
      packagingType: 'satuan',
      unitsPerPackage: '1',
      packsPerBox: '',
      price: '7200',
      oldPrice: '',
    });
  const dom = new Window({ url: 'http://fixture.test/#/' });
  const oldFetch = globalThis.fetch;
  Object.assign(globalThis, {
    window: dom,
    document: dom.document,
    HTMLElement: dom.HTMLElement,
    ResizeObserver: dom.ResizeObserver,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  Object.defineProperty(globalThis, 'navigator', { value: dom.navigator, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', {
    value: dom.localStorage,
    configurable: true,
  });
  dom.scrollTo = () => {};
  globalThis.fetch = async (path) => {
    if (path === '/api/catalog') return new Response(JSON.stringify(seed));
    if (path === '/api/auth/me') return new Response('{}', { status: 401 });
    throw new Error('Unexpected request: ' + path);
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
    const { default: App } = await vite.ssrLoadModule('/src/App.jsx');
    const { createRoot } = await import('react-dom/client');
    const container = dom.document.createElement('div');
    dom.document.body.append(container);
    root = createRoot(container);
    const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
    const wait = async (check) => {
      const deadline = Date.now() + 5000;
      while (!check() && Date.now() < deadline) await act(settle);
      assert.ok(check(), container.textContent.slice(-2000));
    };
    const click = async (element) =>
      act(async () => {
        assert.ok(element);
        element.click();
        await settle();
      });
    const route = async (path) =>
      act(async () => {
        dom.location.hash = path;
        dom.dispatchEvent(new dom.HashChangeEvent('hashchange'));
        await settle();
      });
    await act(async () => {
      root.render(createElement(App));
      await settle();
    });
    await wait(() => container.querySelector('.bam-suppliers .view-all-link[href="#/pemasok"]'));
    await click(container.querySelector('.bam-suppliers .view-all-link[href="#/pemasok"]'));
    await wait(() => container.querySelector('.bam-supplier-card[href="#/pemasok/qa-first"]'));
    assert.match(
      container.querySelector('.bam-supplier-card[href="#/pemasok/qa-first"]').textContent,
      /3 merek/,
    );
    await click(container.querySelector('.bam-supplier-card[href="#/pemasok/qa-first"]'));
    await wait(() => container.querySelector('.supplier-brand-card'));
    assert.equal(container.querySelectorAll('.supplier-brand-card').length, 3);
    assert.equal(container.querySelectorAll('.product-card').length, 0);
    assert.equal(container.querySelector('.category-filter'), null);
    assert.equal(container.querySelector('[data-brand-id="qa-other"]'), null);
    const brio = container.querySelector('[data-brand-id="qa-brio"]');
    assert.equal(brio.getAttribute('href'), '#/pemasok/qa-first?merek=qa-brio');
    assert.match(brio.textContent, /1 produk/);
    assert.equal(brio.querySelector('img').getAttribute('alt'), 'Foto Brio PT Utama');
    assert.equal(
      container.querySelector('[data-brand-id="qa-fries"] img').getAttribute('src'),
      png,
    );
    assert.equal(
      container.querySelector('[data-brand-id="qa-fries"] img').getAttribute('alt'),
      'Foto merek French Fries',
    );
    assert.match(
      container.querySelector('[data-brand-id="qa-new"]').textContent,
      /Produk belum tersedia/,
    );
    assert.equal(container.querySelector('[data-brand-id="qa-new"] img'), null);
    await click(brio);
    await wait(() => container.querySelector('.product-card'));
    assert.equal(container.querySelector('#catalog-title').textContent, 'Brio Potato');
    assert.equal(container.querySelectorAll('.product-card').length, 1);
    assert.ok(
      !container.querySelector('.product-grid').textContent.includes('Brio Khusus PT Kedua'),
    );
    assert.ok(container.querySelector('.shop-breadcrumb a[href="#/pemasok/qa-first"]'));
    await click(container.querySelector('.product-image'));
    await wait(() => container.querySelector('.product-back-link'));
    assert.equal(
      container.querySelector('.product-back-link').getAttribute('href'),
      '#/pemasok/qa-first?merek=qa-brio',
    );
    await click(container.querySelector('.product-back-link'));
    await wait(() => container.querySelector('.supplier-back-to-brands'));
    await click(container.querySelector('.supplier-back-to-brands'));
    await wait(() => container.querySelector('[data-brand-id="qa-new"]'));
    await click(container.querySelector('[data-brand-id="qa-new"]'));
    await wait(() => container.querySelector('.catalog-empty'));
    assert.equal(container.querySelector('#catalog-title').textContent, 'Merek Baru');
    assert.equal(container.querySelectorAll('.product-card').length, 0);
    await route('/pemasok/qa-second');
    await wait(() => container.querySelector('[data-brand-id="qa-other"]'));
    assert.equal(container.querySelectorAll('.supplier-brand-card').length, 2);
    assert.equal(container.querySelector('[data-brand-id="qa-fries"]'), null);
    assert.equal(
      container.querySelector('[data-brand-id="qa-brio"] img').getAttribute('alt'),
      'Foto Brio PT Kedua',
    );
    await route('/pemasok/qa-first?merek=qa-fries');
    await wait(() => container.querySelector('.product-card'));
    assert.equal(container.querySelector('#catalog-title').textContent, 'French Fries');
    assert.match(container.querySelector('.product-grid').textContent, /French Fries PT Utama/);
    await route('/pemasok/qa-first?q=French&kategori=snack');
    await wait(() => container.querySelector('[data-brand-id="qa-fries"]'));
    assert.equal(
      container.querySelector('[data-brand-id="qa-fries"]').getAttribute('href'),
      '#/pemasok/qa-first?q=French&merek=qa-fries&kategori=snack',
    );
    await route('/pemasok/qa-no-brands');
    await wait(() => container.textContent.includes('Belum ada merek untuk PT ini'));
    assert.equal(container.querySelectorAll('.supplier-brand-card').length, 0);
    assert.equal(container.querySelectorAll('.product-card').length, 0);
  } finally {
    if (root) await act(async () => root.unmount());
    await vite.close();
    globalThis.fetch = oldFetch;
    dom.happyDOM.abort();
  }
});
