import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement } from 'react';

test('Sales fast order retains the right store, SKU and package-specific controls', async () => {
  const dom = new Window({ url: 'http://fixture.test/#/order-cepat' });
  Object.assign(globalThis, {
    window: dom,
    document: dom.document,
    HTMLElement: dom.HTMLElement,
    ResizeObserver: dom.ResizeObserver,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: dom.navigator,
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
  try {
    const [{ default: FastOrderPage }, { ShopContext }] = await Promise.all(
      ['/src/pages/FastOrderPage.jsx', '/src/state/useShop.js'].map(path =>
        vite.ssrLoadModule(path),
      ),
    );
    const { createRoot } = await import('react-dom/client');
    const host = dom.document.createElement('div');
    dom.document.body.append(host);
    root = createRoot(host);
    const mutations = [];
    const cart = {
      status: 'open',
      store: { id: 's1', storeName: 'Toko Nusantara', phone: '+6281234567890' },
      date: '2026-10-29',
      items: [{
        id: 'snack-pedas-23g',
        name: 'Keripik Singkong Balado 23g',
        price: 3500,
        quantity: 2,
        packaging: { packagingType: 'satuan', unitsPerPackage: 1 },
      }],
    };
    const shared = {
      status: 'ready', role: 'sales', canEdit: true, cart,
      mutate: async (action, id, quantity) => {
        mutations.push({ action, id, quantity });
        return true;
      },
    };
    const render = async (value) =>
      act(async () => root.render(
        createElement(ShopContext.Provider, { value: { shared: value, setCartMode: () => {} } },
          createElement(FastOrderPage)),
      ));
    await render(shared);
    assert.match(host.textContent, /Toko Nusantara/);
    assert.ok(host.querySelector('a[href^="https://wa.me/"]'));
    assert.match(host.querySelector('.bam-fast-cart-link').textContent, /Rp/);
    const add = host.querySelector('button[aria-label="Tambah Keripik Singkong Balado 23g"]');
    assert.ok(add && !add.disabled);
    await act(async () => add.click());
    assert.deepEqual(mutations[0], { action: 'set', id: 'snack-pedas-23g', quantity: 3 });
    const addOther = host.querySelector('button[aria-label="Tambah Bumbu Rendang Premium 23g"]');
    assert.ok(addOther && !addOther.disabled);
    await act(async () => addOther.click());
    assert.deepEqual(mutations[1], { action: 'add', id: 'bumbu-rendang', quantity: 1 });
    await render({ ...shared, canEdit: false });
    assert.equal(host.querySelector('button[aria-label="Tambah Keripik Singkong Balado 23g"]').disabled, true);
  } finally {
    if (root) await act(async () => root.unmount());
    await vite.close();
    dom.close();
  }
});
