import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement } from 'react';

test('dropdown akun: menu premium tetap terbaca, terpisah per izin dan logout tetap bekerja', async () => {
  const dom = new Window({ url: 'http://localhost/#/' });
  globalThis.window = dom;
  globalThis.document = dom.document;
  globalThis.HTMLElement = dom.HTMLElement;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const server = await createServer({
    configFile: false,
    resolve: { preserveSymlinks: true },
    oxc: { jsx: { runtime: 'automatic' } },
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: 'custom',
    ssr: { external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'] },
  });
  const [{ default: AccountMenu }, { DeliveryContext }] = await Promise.all([
    server.ssrLoadModule('/src/components/account/AccountMenu.jsx'),
    server.ssrLoadModule('/src/state/useDelivery.js'),
  ]);
  const { createRoot } = await import('react-dom/client');
  const container = dom.document.createElement('div');
  dom.document.body.append(container);
  const root = createRoot(container);
  let logouts = 0;
  let navigations = 0;
  const render = async (user, hideProfile = false) => {
    await act(async () => {
      root.render(createElement(DeliveryContext.Provider, {
        value: {
          user, loggingOut: false, logoutError: '',
          logout: async () => { logouts += 1; return true; },
        },
      }, createElement(AccountMenu, {
        hideProfile, onNavigate: () => { navigations += 1; },
      })));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };
  const textOf = (selector) => container.querySelector(selector)?.textContent;
  try {
    await render(null);
    assert.ok(container.querySelector('a[href="#/login"]'));
    assert.equal(container.querySelector('button.account-menu-logout'), null);
    assert.equal(container.querySelector('a[href="#/admin"]'), null);

    await render({ id: 'buyer', role: 'user', canViewCustomers: false });
    assert.equal(container.querySelector('a[href="#/admin"]'), null);
    assert.equal(container.querySelector('a[href="#/pelanggan"]'), null);
    assert.ok(container.querySelector('a[href="#/akun"]'));
    assert.ok(container.querySelector('a[href="#/pesanan"]'));
    assert.ok(container.querySelector('a[href="#/favorit"]'));
    const profile = container.querySelector('a[href="#/akun"]');
    assert.equal(textOf('a[href="#/akun"] .account-menu-copy strong'), 'Profil');
    assert.equal(textOf('a[href="#/akun"] .account-menu-copy small'), 'Nama dan alamat');
    assert.ok(profile.querySelector('.account-menu-icon.is-profile svg'));
    assert.ok(profile.querySelector('svg.account-menu-chevron'));

    await render({ id: 'admin', role: 'admin', canViewCustomers: true });
    assert.ok(container.querySelector('a[href="#/admin"]'));
    assert.ok(container.querySelector('a[href="#/pelanggan"]'));
    assert.ok(container.querySelector('.account-menu-icon.is-customers'));
    const logout = container.querySelector('button.account-menu-logout');
    assert.ok(logout.querySelector('.account-menu-icon.is-logout'));
    assert.equal(logout.querySelector('.account-menu-copy small').textContent, 'Akhiri sesi akun');
    await act(async () => {
      logout.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    assert.equal(logouts, 1);
    assert.equal(navigations, 1);
    assert.equal(dom.location.hash, '#/');

    await render({ id: 'admin', role: 'admin', canViewCustomers: true }, true);
    assert.equal(container.querySelector('a[href="#/akun"]'), null);
    assert.ok(container.querySelector('a[href="#/admin"]'),
      'saat dipakai di sidebar profil menu penting tidak hilang');

    const css = await readFile(
      new URL('../components/account/AccountMenu.css', import.meta.url), 'utf8',
    );
    assert.match(css, /grid-template-columns:\s*42px minmax\(0, 1fr\) 17px/);
    assert.match(css, /account-menu-copy small/);
    assert.match(css, /account-menu-logout/);
  } finally {
    await act(async () => root.unmount());
    await server.close();
    dom.happyDOM.abort();
    for (const key of ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT'])
      delete globalThis[key];
  }
});
