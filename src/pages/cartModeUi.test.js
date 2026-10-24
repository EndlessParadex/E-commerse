import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement } from 'react';

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

test('bar keranjang: mode toko menawarkan belanja pribadi, mode pribadi menawarkan kembali ke toko', async () => {
  const dom = new Window({ url: 'http://localhost/#/' });
  globalThis.window = dom;
  globalThis.document = dom.document;
  globalThis.HTMLElement = dom.HTMLElement;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const server = await createServer(serverConfig);
  const { SharedCartBar } = await server.ssrLoadModule('/src/components/shop/SharedCartPage.jsx');
  const { ShopContext } = await server.ssrLoadModule('/src/state/useShop.js');
  const { createRoot } = await import('react-dom/client');
  const container = dom.document.createElement('div');
  dom.document.body.append(container);
  const root = createRoot(container);
  const modes = [];
  const render = async (shared) => {
    await act(async () => {
      root.render(
        createElement(
          ShopContext.Provider,
          { value: { shared, setCartMode: (mode) => modes.push(mode) } },
          createElement(SharedCartBar),
        ),
      );
      await flush();
    });
  };
  const click = (element) =>
    act(async () => {
      element.dispatchEvent(new dom.MouseEvent('click', { bubbles: true, cancelable: true }));
      await flush();
    });
  try {
    await render({
      enabled: true,
      personal: false,
      canChooseCart: true,
      status: 'ready',
      cart: null,
    });
    assert.match(container.textContent, /Keranjang bersama/);
    const personalLink = [...container.querySelectorAll('a')].find((a) =>
      /Belanja pribadi/.test(a.textContent),
    );
    assert.ok(personalLink, 'Sales/pembeli toko dapat beralih ke belanja pribadi');
    await click(personalLink);

    await render({ enabled: false, personal: true, canChooseCart: true, status: 'ready' });
    assert.match(container.textContent, /Belanja pribadi/);
    assert.match(container.textContent, /terpisah dari keranjang toko/);
    const back = [...container.querySelectorAll('a')].find((a) =>
      /keranjang toko/.test(a.textContent),
    );
    assert.equal(back.getAttribute('href'), '#/keranjang');
    await click(back);
    assert.deepEqual(modes, ['personal', 'store']);

    await render({ enabled: false, personal: false, canChooseCart: false, status: 'legacy' });
    assert.equal(container.querySelector('.shared-cart-bar'), null, 'akun biasa tidak melihat bar');

    await render({
      enabled: true,
      personal: false,
      canChooseCart: false,
      status: 'ready',
      cart: null,
    });
    assert.ok(
      container.querySelector('.shared-cart-bar'),
      'Admin di ruang admin tetap melihat bar toko',
    );
    assert.doesNotMatch(
      container.textContent,
      /Belanja pribadi/,
      'Admin tidak memakai mode pribadi',
    );
  } finally {
    await act(async () => root.unmount());
    await server.close();
    dom.happyDOM.abort();
    for (const key of ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT'])
      delete globalThis[key];
  }
});
