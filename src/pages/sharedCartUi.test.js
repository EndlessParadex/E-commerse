import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement } from 'react';
import { createApp } from '../../server/app.js';
import { seedSharedCart, sharedRequest } from '../../server/sharedCartFixture.js';

test('shared cart website handles buyer/Sales edits and Admin editing, conflicts, retries, and store isolation', async () => {
  const api = createApp({ dbPath: ':memory:', logger: () => {} });
  const { first, second, actors } = seedSharedCart(api);
  const dom = new Window({ url: 'http://fixture.test/#/keranjang' });
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
  let actor = 'buyer',
    loseResponse = false,
    offline = false;
  const mutations = [];
  globalThis.fetch = async (path, options = {}) => {
    const who = actor;
    if (offline && /\/cart(?:\?|$)/.test(path)) throw new TypeError('Fixture offline');
    const body = options.body ? JSON.parse(options.body) : undefined;
    const response = await sharedRequest(api, options.method || 'GET', path, who, body);
    if (options.method === 'POST' && /\/cart$/.test(path)) {
      mutations.push(body);
      if (loseResponse) {
        loseResponse = false;
        throw new TypeError('Fixture dropped committed response');
      }
    }
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
      assert.ok(check(), container.textContent.slice(-2000));
    };
    const button = (text) =>
      [...container.querySelectorAll('button')].find((node) => node.textContent.trim() === text);
    const click = async (element) =>
      act(async () => {
        assert.ok(element);
        element.click();
        await settle();
      });
    const fill = async (selector, value) =>
      act(async () => {
        const field = container.querySelector(selector);
        assert.ok(field, selector);
        const prototype =
          field.tagName === 'SELECT'
            ? dom.HTMLSelectElement.prototype
            : dom.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, 'value').set.call(field, value);
        field.dispatchEvent(
          new dom.Event(field.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }),
        );
        await settle();
      });
    const submit = async (selector) =>
      act(async () => {
        container
          .querySelector(selector)
          .dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true }));
        await settle();
      });
    const navigate = async (route) =>
      act(async () => {
        dom.location.hash = route;
        dom.dispatchEvent(new dom.HashChangeEvent('hashchange'));
        await settle();
      });
    const mount = async (who, route = '/keranjang') => {
      if (root) await act(async () => root.unmount());
      actor = who;
      dom.location.hash = route;
      dom.dispatchEvent(new dom.HashChangeEvent('hashchange'));
      root = createRoot(container);
      await act(async () => {
        root.render(createElement(App));
        await settle();
      });
      await wait(() =>
        route === '/admin/keranjang'
          ? container.querySelector('[role="tab"][aria-selected="true"]')
          : container.querySelector('#shared-store'),
      );
    };
    const openDate = async () => {
      await fill('#shared-date', '2026-10-21');
      await submit('.shared-open-form');
      await wait(() => container.querySelector('.shared-cart-heading'));
    };

    await mount('buyer');
    assert.ok(
      container.querySelector('.shared-selection-panel'),
      'the store picker is available before and after choosing a cart',
    );
    assert.ok(
      container.querySelector('.shared-store-search-details'),
      'optional store search remains available',
    );
    await openDate();
    await wait(() => container.querySelector('.shared-selection-panel')?.open === false);
    assert.ok(
      container.querySelector('.shared-delivery-calendar'),
      'calendar replaces the full-width store selection after opening a cart',
    );
    assert.ok(
      container.querySelector('.shared-cart-summary .shared-selection-panel'),
      'store selection is inside the cart summary',
    );
    assert.ok(
      container.querySelector('.shared-cart-summary .shared-cart-payment-compact'),
      'store payment method is inside the cart summary',
    );
    assert.ok(
      container.querySelector('.shared-delivery-calendar-grid'),
      'monthly calendar supports accessible period navigation',
    );
    const monthDates = container.querySelectorAll(
      '.shared-delivery-calendar-grid .shared-calendar-date:not(.is-outside)',
    );
    assert.equal(monthDates.length, 31, 'all October dates must be visible, not marked outside');
    const chosenDate = container.querySelector('.shared-calendar-date.is-selected');
    assert.equal(
      chosenDate?.textContent.trim(),
      '21',
      'the active delivery period remains visible in the calendar',
    );
    assert.ok(
      container.querySelector('.shared-summary-help'),
      'full price and stock explanation remains available',
    );
    assert.equal(container.querySelector('#shared-store').value, first.id);
    assert.equal(container.querySelectorAll('#shared-store option').length, 2);
    await fill('#shared-cart-payment', 'transfer-bca');
    await wait(
      () => api.sharedCarts.read(actors.buyer, first.id, '2026-10-21').paymentId === 'transfer-bca',
    );
    assert.equal(
      api.sharedCarts.read(actors.buyer, first.id, '2026-10-21').events[0].actorRole,
      'buyer',
    );
    await navigate('/produk/snack-pedas-23g');
    await wait(() => container.querySelector('.detail-add:not(:disabled)'));
    await click(container.querySelector('.detail-add'));
    await wait(() => container.textContent.includes('Berhasil ditambahkan'));
    await navigate('/keranjang');
    await wait(() => container.querySelector('.shared-item'));
    assert.equal(container.querySelector('.shared-quantity input').value, '1');
    assert.equal(container.querySelector('a[href="#/checkout"]'), null);
    const activityPanel = container.querySelector('.shared-history-panel');
    assert.ok(activityPanel, 'audit trail is available without occupying the full page');
    assert.equal(activityPanel.open, false, 'buyer history starts collapsed');
    assert.match(activityPanel.textContent, /Akun buyer/);
    assert.ok(container.querySelector('.shared-cart-activity-grid'));
    assert.ok(container.querySelector('.shared-cycle-panel'));
    await click(activityPanel.querySelector('summary'));
    assert.equal(activityPanel.open, true, 'buyer can expand the history');
    assert.ok(activityPanel.querySelectorAll('.shared-activity-item').length > 0);
    assert.match(activityPanel.textContent, /Versi/);
    assert.doesNotMatch(container.querySelector('.shared-cart-heading').textContent, /Versi \\d+/);
    assert.match(container.querySelector('.shared-cart-heading').textContent, /Draft terbuka/);
    assert.ok(container.querySelector('.shared-quantity-controls'));
    assert.ok(container.querySelector('.shared-packaging-pill'));
    assert.ok(button('Ajukan keranjang ke Admin →'));
    await fill('.shared-quantity input', '4');
    await submit('.shared-quantity');
    await wait(
      () => api.sharedCarts.read(actors.buyer, first.id, '2026-10-21').items[0].quantity === 4,
    );

    await mount('sales');
    await openDate();
    assert.equal(container.querySelector('#shared-cart-payment').value, 'transfer-bca');
    await fill('#shared-cart-payment', 'transfer-mandiri');
    await wait(
      () =>
        api.sharedCarts.read(actors.sales, first.id, '2026-10-21').paymentId === 'transfer-mandiri',
    );
    assert.equal(
      api.sharedCarts.read(actors.sales, first.id, '2026-10-21').events[0].actorRole,
      'sales',
    );
    assert.equal(container.querySelector('.shared-quantity input').value, '4');
    await fill('.shared-quantity input', '6');
    await submit('.shared-quantity');
    await mount('buyer');
    await openDate();
    assert.equal(
      container.querySelector('.shared-quantity input').value,
      '6',
      'another account/device sees persisted edits',
    );
    const current = api.sharedCarts.read(actors.sales, first.id, '2026-10-21');
    await fill('.shared-quantity input', '9');
    api.sharedCarts.mutate(actors.sales, first.id, {
      date: current.date,
      revision: current.revision,
      requestId: randomUUID(),
      action: 'set',
      productId: current.items[0].id,
      quantity: 7,
    });
    await act(async () => {
      dom.dispatchEvent(new dom.Event('focus'));
      await settle();
    });
    await wait(() =>
      container
        .querySelector('.shared-cart-heading')
        .getAttribute('data-revision') === String(current.revision + 1),
    );
    assert.equal(
      container.querySelector('.shared-quantity input').value,
      '9',
      'background refresh retains unsaved input and its original revision',
    );
    await submit('.shared-quantity');
    await wait(() => container.querySelector('.shared-quantity input')?.value === '7');
    assert.match(container.textContent, /Keranjang sudah berubah/);
    assert.equal(api.sharedCarts.read(actors.buyer, first.id, current.date).items[0].quantity, 7);
    await click(button('Muat terbaru'));

    loseResponse = true;
    await fill('.shared-quantity input', '8');
    await submit('.shared-quantity');
    await wait(() => button('Pastikan penyimpanan'));
    assert.equal(container.querySelector('#shared-store').disabled, true);
    const requestId = mutations.at(-1).requestId;
    await click(button('Pastikan penyimpanan'));
    await wait(() => container.querySelector('.shared-quantity input')?.value === '8');
    assert.equal(mutations.at(-1).requestId, requestId);
    assert.equal(
      api.db.prepare('SELECT COUNT(*) AS n FROM cart_events WHERE request_id=?').get(requestId).n,
      1,
    );
    await click(button('Kosongkan keranjang'));
    const beforeClear = api.sharedCarts.read(actors.sales, first.id, current.date);
    api.sharedCarts.mutate(actors.sales, first.id, {
      date: current.date,
      revision: beforeClear.revision,
      requestId: randomUUID(),
      action: 'set',
      productId: current.items[0].id,
      quantity: 9,
    });
    await act(async () => {
      dom.dispatchEvent(new dom.Event('focus'));
      await settle();
    });
    await wait(() => container.querySelector('.shared-quantity input').value === '9');
    await click(button('Ya, kosongkan'));
    await wait(() => container.textContent.includes('Keranjang sudah berubah'));
    assert.equal(
      api.sharedCarts.read(actors.buyer, first.id, current.date).items[0].quantity,
      9,
      'confirmation cannot erase edits made after it opened',
    );
    await click(button('Muat terbaru'));

    offline = true;
    await click(button('Muat terbaru'));
    await wait(() => container.querySelector('[role="alert"]'));
    assert.equal(container.querySelector('.shared-quantity input').disabled, true);
    offline = false;
    await click(button('Muat terbaru'));
    await wait(() => !container.querySelector('.shared-quantity input').disabled);
    await navigate('/checkout');
    assert.match(container.textContent, /Admin memeriksa dan memfinalisasi pesanan toko/);
    assert.equal(container.querySelector('#checkout-form'), null);

    await mount('other');
    assert.equal(container.querySelector('#shared-store').value, second.id);
    assert.equal(container.textContent.includes('Toko Bersama'), false);
    assert.equal(container.querySelector('.shared-item'), null);
    await mount('operator', '/admin/keranjang');
    await wait(() => button('Isi Keranjang'));
    assert.equal(container.querySelector('#shared-store'), null);
    await click(button('Isi Keranjang'));
    await wait(() => container.querySelector('.shared-admin-workspace'));
    assert.equal(container.querySelectorAll('.shared-admin-steps li').length, 4);
    assert.ok(container.querySelector('.shared-admin-help'));
    assert.ok(container.querySelector('.shared-admin-sidebar'));
    await fill('#shared-store', first.id);
    await openDate();
    await wait(() => container.querySelector('.shared-item'));
    assert.ok(container.querySelector('.shared-admin-products'));
    assert.ok(container.querySelector('.shared-admin-payment-card'));
    assert.ok(container.querySelector('.shared-cart-summary'));
    assert.ok(container.querySelector('.shared-quantity'));
    assert.ok(button('Kosongkan keranjang'));
    assert.ok(container.querySelector('.shared-admin-add'));
    assert.ok(container.querySelector('#shared-admin-category'));
    assert.equal(container.querySelector('#shared-cart-payment'), null);
    assert.match(
      container.querySelector('.shared-admin-payment-card').textContent,
      /Admin hanya memeriksa pilihan pembayaran/,
    );
    assert.match(container.textContent, /Transfer bank Mandiri/);
    await fill('#shared-admin-search', 'snack-pedas-62g');
    await fill('#shared-admin-sku', 'snack-pedas-62g');
    await fill('#shared-admin-quantity', '3');
    await submit('.shared-admin-add');
    await wait(() =>
      api.sharedCarts
        .read(actors.operator, first.id, '2026-10-21')
        .items.some((item) => item.id === 'snack-pedas-62g' && item.quantity === 3),
    );
    await wait(() => container.querySelectorAll('.shared-item').length === 2);
    assert.equal(container.querySelectorAll('.shared-admin-summary-stats > div').length, 4);
    await wait(() =>
      [...container.querySelectorAll('.shared-quantity input')].at(-1)?.value === '3',
    );
    const lastStepper = [...container.querySelectorAll('.shared-admin-quantity-stepper')].at(-1);
    assert.ok(lastStepper, 'Admin has quick +/- quantity controls');
    const increment = [...lastStepper.querySelectorAll('button')].find((control) =>
      control.getAttribute('aria-label')?.startsWith('Tambah '),
    );
    assert.ok(increment && !increment.disabled, 'new SKU must have an enabled increment control');
    const beforeStep = api.sharedCarts.read(actors.operator, first.id, '2026-10-21');
    assert.equal([...container.querySelectorAll('.shared-item')].at(-1).querySelector('input')?.value, '3',
      'visible stepper should show the current quantity before increment');
    assert.equal(beforeStep.items.find((row) => row.id === 'snack-pedas-62g').quantity, 3);
    await click(increment);
    const afterStep = api.sharedCarts.read(actors.operator, first.id, '2026-10-21');
    assert.equal(afterStep.items.find((row) => row.id === 'snack-pedas-62g').quantity, 4,
      JSON.stringify({ input: [...container.querySelectorAll('.shared-item')].at(-1).querySelector('input')?.value,
        before: beforeStep.items, after: afterStep.items, event: afterStep.events[0] }));
    await wait(() =>
      api.sharedCarts
        .read(actors.operator, first.id, '2026-10-21')
        .items.some((item) => item.id === 'snack-pedas-62g' && item.quantity === 4),
    );
    const adminCart = api.sharedCarts.read(actors.operator, first.id, '2026-10-21');
    assert.equal(adminCart.events[0].actorRole, 'admin');
    assert.equal(adminCart.events[0].actorName, 'Akun operator');
    assert.match(container.textContent, /Pemrosesan Admin/);
    assert.ok(button('Kunci untuk diperiksa'));
    assert.ok(container.querySelector('nav a[href="#/admin/keranjang"][aria-current="page"]'));
    assert.equal(api.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 0);
    for (let i = 0; i < dom.localStorage.length; i++) {
      const key = dom.localStorage.key(i);
      assert.ok(
        !dom.localStorage.getItem(key).includes('snack-pedas-23g'),
        'shared contents are never cached as a local cart',
      );
    }
  } finally {
    if (root) await act(async () => root.unmount());
    await vite.close();
    api.db.close();
    globalThis.fetch = previousFetch;
    dom.happyDOM.abort();
  }
});
