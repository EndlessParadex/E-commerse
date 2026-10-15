import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement } from 'react';

test('informasi produk: deskripsi panjang dapat dibuka, tab memakai keyboard dan pilihan terbaru tidak kehilangan pemasok', async () => {
  const dom = new Window({ url: 'http://information.test/#/produk/sample' });
  globalThis.window = dom;
  globalThis.document = dom.document;
  globalThis.HTMLElement = dom.HTMLElement;
  Object.defineProperty(globalThis, 'navigator', { value: dom.navigator, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', {
    value: dom.localStorage,
    configurable: true,
  });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
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
    const { default: ProductInformation } = await vite.ssrLoadModule(
      '/src/components/shop/ProductInformation.jsx',
    );
    const { createRoot } = await import('react-dom/client');
    const container = dom.document.createElement('div');
    dom.document.body.append(container);
    root = createRoot(container);
    const description = 'Keterangan produk dari pemasok.\n'.repeat(12);
    const product = {
      id: 'sample',
      baseName: 'Produk contoh',
      category: 'Makanan',
      brand: 'Merek Contoh',
      brandId: 'example-brand',
      sizeLabel: '180g',
      packagingType: 'satuan',
      unitsPerPackage: 1,
    };
    const supplier = { id: 'example-supplier', name: 'PT Contoh', initials: 'PC' };
    const props = {
      product,
      variants: [product],
      packages: [product],
      supplier,
      description,
      companyProfile: { shortName: 'Toko Uji' },
    };
    await act(async () => root.render(createElement(ProductInformation, props)));
    const expand = container.querySelector('[aria-controls="product-description-text"]');
    assert.equal(expand.getAttribute('aria-expanded'), 'false');
    await act(async () => expand.click());
    assert.equal(expand.getAttribute('aria-expanded'), 'true');
    assert.equal(container.querySelector('#product-description-text').textContent, description);
    await act(async () => expand.click());
    assert.equal(expand.getAttribute('aria-expanded'), 'false');
    const detail = container.querySelector('#product-tab-detail');
    const specs = container.querySelector('#product-tab-specifications');
    await act(async () => {
      detail.focus();
      detail.dispatchEvent(
        new dom.KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }),
      );
    });
    assert.equal(dom.document.activeElement, specs);
    assert.equal(specs.getAttribute('aria-selected'), 'true');
    assert.equal(container.querySelector('#product-panel-detail').hidden, true);
    const next = {
      ...product,
      id: 'sample-pack',
      sizeLabel: '62g',
      packagingType: 'pack',
      unitsPerPackage: 10,
    };
    await act(async () =>
      root.render(
        createElement(ProductInformation, {
          ...props,
          product: next,
          variants: [next],
          packages: [next],
        }),
      ),
    );
    assert.equal(specs.getAttribute('aria-selected'), 'true');
    assert.equal(container.querySelector('.detail-meta-size').textContent, '62g');
    assert.equal(container.querySelector('.detail-meta-packaging').textContent, '1 pack');
    assert.match(container.querySelector('.detail-supplier-summary').textContent, /PT Contoh/);
    assert.match(
      container.querySelector('.detail-information-delivery').textContent,
      /saat checkout/,
    );
    await act(async () =>
      specs.dispatchEvent(
        new dom.KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }),
      ),
    );
    assert.equal(dom.document.activeElement, detail);
    assert.equal(container.querySelector('#product-panel-detail').hidden, false);
  } finally {
    if (root) await act(async () => root.unmount());
    await vite.close();
    dom.happyDOM.abort();
  }
});
