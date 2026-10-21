import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement, useLayoutEffect } from 'react';
import { createApp } from '../../server/app.js';
import { seedSharedCart, sharedRequest } from '../../server/sharedCartFixture.js';

test('a delayed Admin cart response cannot replace a new account cart or clear its ongoing save', async () => {
  const api = createApp({ dbPath: ':memory:', logger: () => {} });
  const { first, second, actors } = seedSharedCart(api);
  const date = '2026-10-21';
  api.sharedCarts.mutate(actors.buyer, first.id, {
    date,
    revision: 0,
    requestId: randomUUID(),
    action: 'add',
    productId: 'snack-pedas-23g',
    quantity: 1,
  });
  const dom = new Window({ url: 'http://fixture.test/#/admin/keranjang' });
  const oldFetch = globalThis.fetch;
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
  let who = 'owner',
    releaseAdmin,
    releaseBuyer,
    current;
  globalThis.fetch = async (path, options = {}) => {
    const actor = who;
    const result = await sharedRequest(
      api,
      options.method || 'GET',
      path,
      actor,
      options.body ? JSON.parse(options.body) : undefined,
    );
    if (options.method === 'POST' && actor === 'owner')
      await new Promise((resolve) => {
        releaseAdmin = resolve;
      });
    if (options.method === 'POST' && actor === 'other')
      await new Promise((resolve) => {
        releaseBuyer = resolve;
      });
    return {
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      json: async () => result.body,
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
    const [{ default: useSharedCart }, catalog] = await Promise.all(
      ['/src/state/useSharedCart.js', '/src/data/adminStore.js'].map((path) =>
        vite.ssrLoadModule(path),
      ),
    );
    await catalog.initializeCatalog();
    function Probe({ user }) {
      const shared = useSharedCart(user, false);
      useLayoutEffect(() => {
        current = shared;
      }, [shared]);
      return createElement('p', null, shared.cart?.store.id || shared.status);
    }
    const { createRoot } = await import('react-dom/client');
    const container = dom.document.createElement('div');
    dom.document.body.append(container);
    root = createRoot(container);
    const settle = () => new Promise((resolve) => setTimeout(resolve, 15));
    const wait = async (check) => {
      const until = Date.now() + 3000;
      while (!check() && Date.now() < until) await act(settle);
      assert.ok(check(), container.textContent);
    };
    await act(async () => {
      root.render(createElement(Probe, { user: actors.owner }));
      await settle();
    });
    await wait(() => current?.status === 'ready');
    await act(async () => {
      await current.choose({ storeId: first.id, date });
      await settle();
    });
    let firstSave;
    await act(async () => {
      firstSave = current.adminAction('lock');
      await settle();
    });
    await wait(() => releaseAdmin);
    who = 'other';
    await act(async () => {
      root.render(createElement(Probe, { user: actors.other }));
      await settle();
    });
    await wait(() => current.cart?.store.id === second.id);
    let secondSave;
    await act(async () => {
      secondSave = current.mutate('add', 'snack-pedas-23g', 1);
      await settle();
    });
    await wait(() => releaseBuyer);
    await act(async () => {
      releaseAdmin();
      await firstSave;
      await settle();
    });
    assert.equal(current.cart.store.id, second.id);
    assert.equal(
      current.busy,
      true,
      'old finally must not clear the new account pending operation',
    );
    await act(async () => {
      releaseBuyer();
      await secondSave;
      await settle();
    });
    assert.equal(current.cart.store.id, second.id);
    assert.equal(current.cart.items[0].quantity, 1);
    assert.equal(current.busy, false);
    assert.equal(api.sharedCarts.read(actors.owner, first.id, date).status, 'locked');
  } finally {
    releaseAdmin?.();
    releaseBuyer?.();
    if (root) await act(async () => root.unmount());
    await vite.close();
    api.db.close();
    globalThis.fetch = oldFetch;
    dom.happyDOM.abort();
  }
});
