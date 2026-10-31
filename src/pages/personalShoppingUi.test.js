import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement } from 'react';
import { createApp } from '../../server/app.js';
import { seedSharedCart, sharedRequest } from '../../server/sharedCartFixture.js';

test('website: Sales memilih List Toko atau Belanja biasa, mode bertahan, dan pembeli lain tidak ikut terpengaruh', async () => {
  const api = createApp({ dbPath: ':memory:', logger: () => {} });
  seedSharedCart(api);
  const dom = new Window({ url: 'http://fixture.test/#/' });
  const previousFetch = globalThis.fetch;
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
  let actor = 'sales';
  globalThis.fetch = async (path, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : undefined;
    const response = await sharedRequest(api, options.method || 'GET', path, actor, body);
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      json: async () => response.body,
    };
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
    const settle = () => new Promise((resolve) => setTimeout(resolve, 15));
    const wait = async (check) => {
      const until = Date.now() + 4000;
      while (!check() && Date.now() < until) await act(settle);
      assert.ok(check(), container.textContent.slice(-1500));
    };
    const click = (element) =>
      act(async () => {
        assert.ok(element, 'elemen yang diklik harus ada');
        element.click();
        await settle();
      });
    const navigate = (route) =>
      act(async () => {
        dom.location.hash = route;
        dom.dispatchEvent(new dom.HashChangeEvent('hashchange'));
        await settle();
      });
    const mount = async (who, route, ready) => {
      if (root) await act(async () => root.unmount());
      actor = who;
      dom.location.hash = route;
      dom.dispatchEvent(new dom.HashChangeEvent('hashchange'));
      root = createRoot(container);
      await act(async () => {
        root.render(createElement(App));
        await settle();
      });
      await wait(ready);
    };
    const salesHome = () => container.querySelector('.bam-role-home--sales');
    const bar = () => container.querySelector('.shared-cart-bar')?.textContent || '';

    // Sales mendarat di beranda dengan tepat dua kotak.
    await mount('sales', '/', salesHome);
    assert.equal(container.querySelectorAll('.bam-role-home-card').length, 2);
    assert.match(container.querySelector('.bam-role-home-card.is-stores').textContent, /List Toko/);
    assert.match(
      container.querySelector('.bam-role-home-card.is-personal').textContent,
      /Belanja biasa/,
    );
    assert.match(bar(), /Keranjang bersama/, 'mode awal tetap keranjang toko');

    // "Belanja biasa": keranjang pribadi aktif, halaman keranjang dan checkout biasa.
    await click(container.querySelector('.bam-role-home-card.is-personal'));
    await wait(() => /Belanja pribadi/.test(bar()));
    await navigate('/keranjang');
    await wait(() => /Keranjang belanja/.test(container.textContent));
    assert.equal(container.querySelector('#shared-store'), null, 'bukan halaman keranjang toko');
    await navigate('/checkout');
    await settle();
    assert.doesNotMatch(
      container.textContent,
      /Keranjang bersama toko/,
      'checkout pribadi tidak dialihkan ke toko',
    );

    // Mode pribadi bertahan setelah muat ulang untuk akun yang sama.
    await mount('sales', '/', salesHome);
    await wait(() => /Belanja pribadi/.test(bar()));

    // Kembali ke keranjang toko lewat bar.
    const back = [...container.querySelectorAll('.shared-cart-bar a')].find((a) =>
      /keranjang toko/.test(a.textContent),
    );
    await click(back);
    await wait(() => container.querySelector('.shared-cart-heading'));

    // Pembeli toko memakai preferensi sendiri: tetap mode toko.
    await mount('buyer', '/', () => container.querySelector('.bam-buyer-dashboard'));
    assert.match(bar(), /Keranjang bersama/);
    assert.doesNotMatch(bar(), /Belanja pribadi ·/);
    const buyerModes = container.querySelector('.bam-buyer-catalog-mode-actions');
    assert.ok(buyerModes, 'Pembeli Toko melihat tujuan Add-to-cart di katalog');
    assert.equal(buyerModes.querySelector('[aria-pressed="true"]').textContent, 'Keranjang toko');
    const switchMode = (label) =>
      [...buyerModes.querySelectorAll('button')].find((item) => item.textContent === label);
    await click(switchMode('Belanja pribadi'));
    await wait(() => /Belanja pribadi/.test(bar()));
    assert.equal(switchMode('Belanja pribadi').getAttribute('aria-pressed'), 'true');
    await click(switchMode('Keranjang toko'));
    await wait(() => /Keranjang bersama/.test(bar()));
    assert.equal(switchMode('Keranjang toko').getAttribute('aria-pressed'), 'true');
  } finally {
    if (root) await act(async () => root.unmount());
    await vite.close();
    dom.happyDOM.abort();
    globalThis.fetch = previousFetch;
    api.db.close();
    for (const key of [
      'window',
      'document',
      'HTMLElement',
      'ResizeObserver',
      'IS_REACT_ACT_ENVIRONMENT',
    ])
      delete globalThis[key];
  }
});
