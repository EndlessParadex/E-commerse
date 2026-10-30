import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement } from 'react';
test('render failure displays a recovery screen; public product path opens the matching route without a fragment', async () => {
  const dom = new Window({ url: 'http://fixture.test/produk/snack-pedas' });
  globalThis.window = dom;
  globalThis.document = dom.document;
  globalThis.HTMLElement = dom.HTMLElement;
  Object.defineProperty(globalThis, 'navigator', { value: dom.navigator, configurable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  dom.scrollTo = () => {};
  const server = await createServer({
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
    const [{ default: Boundary }, navigation] = await Promise.all(
      ['/src/components/AppErrorBoundary.jsx', '/src/state/shopNavigation.js'].map((path) =>
        server.ssrLoadModule(path),
      ),
    );
    assert.equal(navigation.shopRouteSnapshot().route, '/produk/snack-pedas');
    navigation.goToHome();
    assert.equal(navigation.shopRouteSnapshot().route, '/');
    const { createRoot } = await import('react-dom/client');
    const container = dom.document.createElement('div');
    dom.document.body.append(container);
    root = createRoot(container, { onCaughtError: () => {} });
    function Failure() {
      throw new Error('controlled render failure');
    }
    await act(async () =>
      root.render(createElement(Boundary, { key: 'failure' }, createElement(Failure))),
    );
    assert.match(
      container.querySelector('[role=alert]').textContent,
      /Halaman belum dapat ditampilkan/,
    );
    assert.equal(container.querySelector('button').textContent, 'Muat ulang halaman');
    await act(async () =>
      root.render(
        createElement(Boundary, { key: 'fresh' }, createElement('p', null, 'Halaman pulih')),
      ),
    );
    assert.equal(container.textContent, 'Halaman pulih');
    const { default: Invoice } = await server.ssrLoadModule(
      '/src/components/shop/OrderInvoice.jsx',
    );
    let printed = 0;
    dom.print = () => printed++;
    const order = {
      id: 'BAM-INVOICE-TEST',
      createdAt: Date.now(),
      recipient: 'Penerima faktur',
      address: 'Alamat faktur lengkap',
      seller: { legalName: 'Perusahaan Fixture', address: 'Alamat perusahaan' },
      items: [{ id: 'SKU-FIXTURE', name: 'Barang fixture', quantity: 2, price: 10000 }],
      subtotal: 20000,
      total: 55000,
      shipping: { quoted: true, cost: 35000 },
      payment: { groupId: 'transfer', status: 'paid', reference: 'BANK-FIXTURE' },
    };
    await act(async () => root.render(createElement(Invoice, { order })));
    assert.match(dom.document.querySelector('.invoice-print-root').textContent, /BAM-INVOICE-TEST/);
    assert.match(dom.document.querySelector('.invoice-print-root').textContent, /Sudah dibayar/);
    const paperSelect = container.querySelector('#invoice-paper-format');
    assert.ok(paperSelect, 'format faktur dapat dipilih');
    assert.equal(paperSelect.options.length, 2);
    assert.equal(paperSelect.value, 'a4');
    assert.match(dom.document.querySelector('.invoice-print-root style').textContent, /210mm 297mm/);
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.HTMLSelectElement.prototype, 'value').set.call(
        paperSelect,
        'dotMatrix',
      );
      paperSelect.dispatchEvent(new dom.Event('change', { bubbles: true }));
    });
    const dotMatrixPrint = dom.document.querySelector('.invoice-print-root--dotMatrix');
    assert.ok(dotMatrixPrint, 'invoice Dot Matrix terpisah dari pilihan A4');
    assert.ok(dotMatrixPrint.querySelector('.order-invoice.is-dot-matrix'));
    assert.match(dotMatrixPrint.querySelector('style').textContent, /241.3mm 279.4mm/);
    assert.match(dotMatrixPrint.textContent, /BAM-INVOICE-TEST/);
    assert.match(dotMatrixPrint.textContent, /Sudah dibayar/);
    await act(async () => container.querySelector('button').click());
    assert.equal(printed, 1);
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.HTMLSelectElement.prototype, 'value').set.call(
        paperSelect,
        'a4',
      );
      paperSelect.dispatchEvent(new dom.Event('change', { bubbles: true }));
    });
    assert.ok(dom.document.querySelector('.invoice-print-root--a4'));
    assert.match(dom.document.querySelector('.invoice-print-root style').textContent, /210mm 297mm/);
    await act(async () => root.render(createElement('p', null, 'Selesai')));
    assert.equal(dom.document.querySelector('.invoice-print-root'), null);
  } finally {
    if (root) await act(async () => root.unmount());
    await server.close();
    dom.happyDOM.abort();
  }
});
