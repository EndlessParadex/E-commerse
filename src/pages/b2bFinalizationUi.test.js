import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement } from 'react';
import { createApp } from '../../server/app.js';
import { seedSharedCart, sharedRequest } from '../../server/sharedCartFixture.js';

test('Admin locks and reviews B2B cart, rejects a stale review, safely retries a lost finalization response and buyers/Sales see the scoped order', async () => {
  const api = createApp({ dbPath: ':memory:', logger: () => {} });
  const { first, actors } = seedSharedCart(api);
  const date = '2026-10-21';
  api.sharedCarts.mutate(actors.buyer, first.id, {
    date,
    revision: 0,
    requestId: randomUUID(),
    action: 'add',
    productId: 'snack-pedas-23g',
    quantity: 2,
  });
  const dom = new Window({ url: 'http://fixture.test/#/admin/keranjang' });
  const oldFetch = globalThis.fetch;
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
  dom.confirm = () => true;
  dom.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  dom.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  let actor = 'owner',
    loseFinalResponse = false;
  const sent = [];
  globalThis.fetch = async (path, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : undefined;
    const result = await sharedRequest(api, options.method || 'GET', path, actor, body);
    if (options.method === 'POST' && path.startsWith('/api/admin/b2b/')) {
      sent.push({ path, body });
      if (loseFinalResponse && body.action === 'finalize' && result.status === 200) {
        loseFinalResponse = false;
        throw new TypeError('Fixture lost response after commit');
      }
    }
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
    const { default: App } = await vite.ssrLoadModule('/src/App.jsx');
    const { createRoot } = await import('react-dom/client');
    const container = dom.document.createElement('div');
    dom.document.body.append(container);
    const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
    const wait = async (check) => {
      const until = Date.now() + 5000;
      while (!check() && Date.now() < until) await act(settle);
      assert.ok(check(), container.textContent.slice(-2500));
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
        Object.getOwnPropertyDescriptor(
          field.tagName === 'TEXTAREA'
            ? dom.HTMLTextAreaElement.prototype
            : dom.HTMLInputElement.prototype,
          'value',
        ).set.call(field, value);
        field.dispatchEvent(new dom.Event('input', { bubbles: true }));
        await settle();
      });
    const mount = async (who, route) => {
      if (root) await act(async () => root.unmount());
      actor = who;
      dom.location.hash = route;
      dom.dispatchEvent(new dom.HashChangeEvent('hashchange'));
      root = createRoot(container);
      await act(async () => {
        root.render(createElement(App));
        await settle();
      });
    };
    const navigate = async (route) =>
      act(async () => {
        dom.location.hash = route;
        dom.dispatchEvent(new dom.HashChangeEvent('hashchange'));
        await settle();
      });
    const confirm = () => container.querySelector('dialog .bam-dialog-actions button:last-child');
    const back = () => container.querySelector('dialog .bam-dialog-actions button:first-child');
    await mount('owner', '/admin/keranjang');
    await wait(() => button('Periksa keranjang'));
    assert.equal(container.querySelector('#shared-store'), null);
    await click(button('Rekening Transfer'));
    await wait(() => container.querySelector('#b2b-bank-selector'));
    assert.equal(container.querySelector('.admin-cart-queue-list'), null);
    await click(button('Antrean'));
    await wait(() => button('Periksa keranjang'));
    await click(button('Periksa keranjang'));
    await wait(() => button('Kunci untuk diperiksa'));
    assert.ok(container.querySelector('.shared-admin-workspace'));
    assert.equal(container.querySelector('.shared-admin-steps .is-current').textContent.trim(), '2Kelola barang');
    assert.equal(container.querySelector('[role="tab"][aria-selected="true"]').textContent, 'Isi Keranjang');
    await click(button('Riwayat'));
    await wait(() => container.querySelector('.shared-history'));
    assert.equal(button('Kunci untuk diperiksa'), undefined);
    await click(button('Isi Keranjang'));
    await wait(() => button('Kunci untuk diperiksa'));
    await click(button('Kunci untuk diperiksa'));
    await click(confirm());
    await wait(() => !container.querySelector('dialog') && button('Periksa dan finalisasi'));
    assert.equal(api.sharedCarts.read(actors.buyer, first.id, date).status, 'locked');
    assert.equal(api.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 0);
    await click(button('Buka kembali untuk diperbaiki'));
    await fill('#cart-unlock-reason', 'xx');
    await click(confirm());
    await wait(() =>
      container.querySelector('dialog [role=alert]')?.textContent.includes('minimal 5'),
    );
    assert.equal(container.querySelector('#cart-unlock-reason').value, 'xx');
    await fill('#cart-unlock-reason', 'Jumlah barang diperiksa ulang');
    await click(confirm());
    await wait(() => !container.querySelector('dialog') && button('Kunci untuk diperiksa'));
    assert.equal(api.sharedCarts.read(actors.buyer, first.id, date).canEdit, true);
    await click(button('Kunci untuk diperiksa'));
    await click(confirm());
    await wait(() => !container.querySelector('dialog') && button('Periksa dan finalisasi'));
    await click(button('Periksa dan finalisasi'));
    await wait(() => container.querySelector('.admin-cart-accept input'));
    assert.equal(confirm().disabled, true);
    const before = api.catalog.snapshot();
    const group = before.edits.find((item) => item.groupId === 'snack-pedas');
    const variant = group.variants.find((item) => item.id === 'snack-pedas-23g');
    const price = Number(variant.price) + 500;
    variant.price = String(price);
    api.catalog.save(before);
    await click(container.querySelector('.admin-cart-accept input'));
    await click(confirm());
    await wait(() =>
      container
        .querySelector('dialog [role=alert]')
        ?.textContent.includes('berubah sejak pemeriksaan'),
    );
    assert.equal(api.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 0);
    await click(button('Muat pemeriksaan terbaru'));
    await wait(() =>
      container.querySelector('.admin-cart-review')?.textContent.includes('informasi berubah'),
    );
    assert.equal(container.querySelector('.admin-cart-accept input').checked, false);
    await click(container.querySelector('.admin-cart-accept input'));
    loseFinalResponse = true;
    await click(confirm());
    await wait(() =>
      container.querySelector('dialog')?.textContent.includes('Status penyimpanan belum pasti'),
    );
    assert.equal(
      api.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n,
      1,
      'lost response must not roll back a committed order',
    );
    const original = sent.filter((entry) => entry.body.action === 'finalize').at(-1);
    await click(back());
    await click(button('Pastikan penyimpanan'));
    await wait(() => container.querySelector('.shared-final-order'));
    assert.deepEqual(sent.at(-1), original, 'retry must use exactly the same operation');
    assert.equal(api.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 1);
    assert.equal(button('Periksa dan finalisasi'), undefined);
    const order = JSON.parse(api.db.prepare('SELECT data FROM orders').get().data);
    assert.equal(order.total, price * 2);
    await navigate('/pesanan/' + order.id);
    await wait(() => container.querySelector('[aria-label="Pesanan toko B2B"]'));
    assert.equal(
      container.querySelector('.order-invoice'),
      null,
      'B2B must not expose the legacy priced invoice before the separate B2B document stage',
    );
    for (const who of ['buyer', 'sales']) {
      await mount(who, '/pesanan');
      await wait(() => container.querySelector('.orders-number')?.textContent === order.id);
      assert.equal(button('Batalkan pesanan'), undefined);
      await navigate('/pesanan/' + order.id);
      await wait(() => container.querySelector('[aria-label="Pesanan toko B2B"]'));
      assert.equal(button('Batalkan pesanan'), undefined);
      assert.match(
        container.querySelector('.payment-details').textContent,
        /difinalisasi Admin BAM/,
      );
    }
    api.b2bStores.removeLink(actors.owner, first.id, 'sales', {
      userId: 'sales',
      revision: api.b2bStores.store(first.id).revision,
    });
    await act(async () => {
      dom.dispatchEvent(new dom.Event('focus'));
      await settle();
    });
    await wait(() => !container.querySelector('[aria-label="Pesanan toko B2B"]'));
    assert.doesNotMatch(container.textContent, /Jalan Pengujian Bersama/);
    await mount('other', '/pesanan/' + order.id);
    await wait(() => container.textContent.includes('tidak ditemukan'));
    assert.equal(container.querySelector('[aria-label="Pesanan toko B2B"]'), null);
  } finally {
    if (root) await act(async () => root.unmount());
    await vite.close();
    api.db.close();
    globalThis.fetch = oldFetch;
    dom.happyDOM.abort();
  }
});
