import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement } from 'react';

test('product card waits for persistence, blocks double clicks and distinguishes cart/store errors from stock', async () => {
  const dom = new Window({ url: 'http://fixture.test/#/' });
  Object.assign(globalThis, {
    window: dom,
    document: dom.document,
    HTMLElement: dom.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  Object.defineProperty(globalThis, 'navigator', { value: dom.navigator, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', {
    value: dom.localStorage,
    configurable: true,
  });
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
  let resolveSave;
  try {
    const [{ default: ProductCard }, { ShopContext }, catalog] = await Promise.all(
      [
        '/src/components/shop/ProductCard.jsx',
        '/src/state/useShop.js',
        '/src/data/products.js',
      ].map((path) => vite.ssrLoadModule(path)),
    );
    const product = {
      ...catalog.products[0],
      id: 'saving-fixture',
      groupId: 'saving-fixture',
      price: 1000,
    };
    catalog.products.splice(0, catalog.products.length, product);
    const { createRoot } = await import('react-dom/client');
    const container = dom.document.createElement('div');
    dom.document.body.append(container);
    root = createRoot(container);
    let writes = 0;
    const shared = {
      enabled: true,
      selection: { storeId: 'store' },
      status: 'ready',
      canEdit: true,
      busy: false,
    };
    let stock = { available: 20, inStock: true, failed: false };
    const onAdd = () => {
      writes++;
      return new Promise((resolve) => {
        resolveSave = resolve;
      });
    };
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
    const render = () =>
      act(async () => {
        root.render(
          createElement(
            ShopContext.Provider,
            { value: { shared, stockFor: () => stock } },
            createElement(ProductCard, { product, onAdd }),
          ),
        );
        await settle();
      });
    const button = () => container.querySelector('.add-product-button');
    await render();
    await act(async () => {
      button().click();
      button().click();
      await settle();
    });
    assert.equal(writes, 1);
    assert.equal(button().disabled, true);
    assert.equal(button().textContent, 'Menyimpan…');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1800));
    });
    assert.equal(
      button().textContent,
      'Menyimpan…',
      'success timer must start after server confirmation',
    );
    await act(async () => {
      resolveSave(true);
      await settle();
    });
    assert.equal(button().textContent, '✓ Ditambahkan');
    await act(async () => {
      button().click();
      await settle();
      resolveSave(false);
      await settle();
    });
    assert.match(container.querySelector('[role=alert]').textContent, /Belum tersimpan/);
    shared.canEdit = false;
    await render();
    assert.equal(button().textContent, 'Periksa keranjang');
    assert.doesNotMatch(button().textContent, /Stok belum tersedia/);
    shared.selection.storeId = '';
    await render();
    assert.equal(button().textContent, 'Pilih toko dahulu');
    assert.equal(button().disabled, false);
    shared.selection.storeId = 'store';
    shared.canEdit = true;
    stock = { available: 0, inStock: false, failed: false };
    await render();
    assert.equal(button().textContent, 'Stok belum tersedia');
    assert.equal(button().disabled, true);
    stock = { available: 0, inStock: false, failed: true };
    await render();
    assert.equal(button().textContent, 'Stok belum dapat dimuat');
  } finally {
    resolveSave?.(false);
    if (root) await act(async () => root.unmount());
    await vite.close();
    dom.happyDOM.abort();
  }
});
