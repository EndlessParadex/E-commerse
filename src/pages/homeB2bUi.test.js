import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement } from 'react';
import { readFile } from 'node:fs/promises';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const serverConfig = {
  configFile: false,
  resolve: { preserveSymlinks: true },
  oxc: { jsx: { runtime: 'automatic' } },
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  appType: 'custom',
  ssr: { external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'] },
};

test('role home: Sales sees only assigned stores, buyer sees its store and server schedule', async () => {
  const dom = new Window({ url: 'http://localhost/#/' });
  globalThis.window = dom;
  globalThis.document = dom.document;
  globalThis.HTMLElement = dom.HTMLElement;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const server = await createServer(serverConfig);
  const { default: B2BHomeExperience } = await server.ssrLoadModule(
    '/src/components/shop/B2BHomeExperience.jsx',
  );
  const { createRoot } = await import('react-dom/client');
  const container = dom.document.createElement('div');
  dom.document.body.append(container);
  const root = createRoot(container);
  const store = {
    id: 'store-1',
    storeCode: 'TKB-000001',
    storeName: 'Toko Makmur',
    deliverySchedule: { anchorDate: '2026-10-19', weekday: 1, intervalWeeks: 1 },
  };
  const shared = (role, list, selection = {}) => ({
    role,
    status: 'ready',
    stores: { stores: list, total: list.length, page: 1, pages: 1 },
    selection,
    choose: async (target) => {
      chosen.push(target);
      return true;
    },
    findStores: async () => null,
  });
  const modes = [];
  const chosen = [];
  const render = async (state) => {
    await act(async () => {
      root.render(
        createElement(B2BHomeExperience, {
          shared: state,
          onCartMode: (mode) => modes.push(mode),
        }),
      );
      await flush();
    });
  };
  try {
    await render(shared('sales', [store]));
    assert.match(container.querySelector('h1').textContent, /toko pelanggan Anda/);
    assert.ok(container.querySelector('.bam-role-home--sales'));
    assert.match(container.querySelector('.bam-role-home-actions').textContent, /List Toko/);
    assert.equal(container.querySelectorAll('.bam-role-home-card').length, 2);
    assert.equal(
      container.querySelector('.bam-role-home-card.is-stores').getAttribute('href'),
      '#/',
    );
    assert.match(
      container.querySelector('.bam-role-home-card.is-personal').textContent,
      /Belanja biasa/,
    );
    assert.equal(
      container.querySelector('.bam-role-home-card.is-personal').getAttribute('href'),
      '#/cari?q=',
    );
    assert.doesNotMatch(container.textContent, /Toko Saya/);
    assert.doesNotMatch(container.textContent, /masih dalam pengembangan/);
    await act(async () => {
      container
        .querySelector('.bam-role-home-card.is-personal')
        .dispatchEvent(new dom.MouseEvent('click', { bubbles: true, cancelable: true }));
      container
        .querySelector('.bam-role-home-card.is-stores')
        .dispatchEvent(new dom.MouseEvent('click', { bubbles: true, cancelable: true }));
      await flush();
    });
    assert.deepEqual(modes, ['personal'], 'memilih List Toko belum memindahkan keranjang');
    assert.ok(container.querySelector('.bam-store-selector.is-page'));
    assert.ok(container.querySelector('.bam-store-card'));
    await act(async () => {
      container.querySelector('.bam-store-card').click();
      await flush();
    });
    assert.equal(chosen[0].storeId, store.id);
    assert.equal(modes.at(-1), 'store');
    assert.equal(dom.location.hash, '#/keranjang');
    await act(async () => {
      container.querySelector('.bam-store-selector-close').click();
      await flush();
    });

    await render({
      ...shared('buyer', [store], { storeId: store.id, date: '2026-10-26' }),
      cart: {
        store,
        date: '2026-10-26',
        status: 'open',
        items: [
          { id: 'product-a', quantity: 2 },
          { id: 'product-b', quantity: 3 },
        ],
      },
    });
    const buyerStorefront = container.querySelector('.bam-buyer-storefront');
    assert.ok(buyerStorefront, 'Pembeli Toko memakai split storefront');
    assert.ok(buyerStorefront.querySelector('.bam-buyer-storefront-sidebar'));
    assert.ok(buyerStorefront.querySelector('.bam-buyer-storefront-main'));
    assert.equal(container.querySelector('h1').textContent, 'Toko Makmur');
    assert.match(container.querySelector('.bam-buyer-store-profile').textContent, /TKB-000001/);
    assert.match(container.querySelector('.bam-buyer-cart-card').textContent, /5 kemasan/);
    assert.match(container.querySelector('.bam-buyer-cart-card').textContent, /2 SKU/);
    assert.match(container.querySelector('.bam-buyer-cart-card').textContent, /Draft terbuka/);
    assert.match(container.querySelector('.bam-buyer-side-facts').textContent, /26 Oktober 2026/);
    assert.ok(container.querySelector('.bam-buyer-side-menu'));
    assert.equal(container.querySelectorAll('.bam-buyer-product-card').length, 6);
    assert.equal(container.querySelectorAll('.bam-buyer-supplier-card').length, 4);
    assert.ok(container.querySelector('.bam-buyer-promo-hero'));
    assert.equal(container.querySelectorAll('.bam-buyer-store-summary').length, 0);
    assert.equal(container.querySelectorAll('.bam-buyer-primary-card').length, 0);
    assert.equal(
      container.querySelector('.bam-buyer-side-menu a[href="#/akun/kalender"]').textContent.includes(
        'Jadwal pengiriman',
      ),
      true,
    );
    assert.doesNotMatch(container.textContent, /List Toko|Belanja mudah untuk tokomu/);
    await act(async () => {
      container.querySelector('.bam-buyer-cart-open').click();
      await flush();
    });
    assert.equal(modes.at(-1), 'store');

    await render({
      ...shared('sales', [store], { storeId: store.id, date: '2026-10-26' }),
      canEdit: true,
      cart: { status: 'open', store, date: '2026-10-26' },
    });
    const quickOrder = container.querySelector('.bam-role-home-quick');
    assert.equal(quickOrder.getAttribute('href'), '#/order-cepat');
    assert.match(quickOrder.textContent, /Toko Makmur/);
    await act(async () => {
      quickOrder.click();
      await flush();
    });
    assert.equal(modes.at(-1), 'store');

    await render(shared('buyer', []));
    assert.match(container.textContent, /Toko belum terhubung/);
    assert.match(container.textContent, /Belum tersedia/);
    assert.match(container.textContent, /Belum ditetapkan/);
    assert.equal(
      container.querySelector('.bam-buyer-cart-open').getAttribute('href'),
      '#/akun',
    );

    const { default: VerticalPromoPanel } = await server.ssrLoadModule(
      '/src/components/shop/VerticalPromoPanel.jsx',
    );
    await act(async () => {
      root.render(createElement(VerticalPromoPanel, { storefront: true }));
      await flush();
    });
    assert.equal(container.querySelectorAll('.bam-vertical-promos.is-storefront').length, 1);
    assert.equal(container.querySelectorAll('.bam-vertical-promo-item').length, 3);
    assert.equal(
      container.querySelectorAll('.bam-vertical-promo-photo[href^="#/produk/"]').length,
      3,
    );
    assert.ok(
      container.querySelector('.bam-vertical-promo-prices strong').textContent.includes('Rp'),
    );

    const salesCss = await readFile(
      new URL('../components/shop/B2BHomeExperience.css', import.meta.url),
      'utf8',
    );
    const buyerCss = await readFile(
      new URL('../components/shop/StoreBuyerDashboard.css', import.meta.url),
      'utf8',
    );
    const home = await readFile(new URL('./Home.jsx', import.meta.url), 'utf8');
    assert.match(salesCss, /@media \(max-width: 700px\)/);
    assert.match(salesCss, /prefers-reduced-motion/);
    assert.match(buyerCss, /@media \(max-width: 550px\)/);
    assert.match(home, /buyerDashboard \? \(/);
    assert.match(home, /<B2BHomeExperience shared=\{shared\} onCartMode=\{setCartMode\} \/>/);
  } finally {
    await act(async () => root.unmount());
    await server.close();
    dom.happyDOM.abort();
    for (const key of ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT'])
      delete globalThis[key];
  }
});
