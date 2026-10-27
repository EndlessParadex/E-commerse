import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement } from 'react';
import { createApp } from '../../server/app.js';
import { seedSharedCart, sharedRequest } from '../../server/sharedCartFixture.js';

test('calendar shows only assigned dates; print isolates one snapshot and applies A4/dot matrix paper', async () => {
  const api = createApp({
    dbPath: ':memory:',
    now: () => Date.parse('2026-10-27T01:00:00Z'),
    logger: () => {},
  });
  const { actors } = seedSharedCart(api);
  const region = api.deliverySchedules.saveRegion(actors.owner, {
    name: 'Wilayah uji',
    weekday: 1,
    intervalWeeks: 2,
    anchorDate: '2026-10-19',
    active: true,
    revision: 0,
  }).regions[0];
  api.deliverySchedules.assign(actors.owner, { userId: 'other', regionId: region.id, revision: 0 });
  const vite = await createServer({
    configFile: false,
    resolve: { preserveSymlinks: true },
    oxc: { jsx: { runtime: 'automatic' } },
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: 'custom',
    ssr: { external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'] },
  });
  const dom = new Window({ url: 'http://fixture.test/' });
  const previous = Object.fromEntries(
    ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT', 'fetch'].map((key) => [
      key,
      globalThis[key],
    ]),
  );
  Object.assign(globalThis, {
    window: dom,
    document: dom.document,
    HTMLElement: dom.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  let failed = false,
    actor = 'other',
    prints = 0;
  globalThis.fetch = async (path) => {
    const response = failed
      ? { status: 503, body: { message: 'Jadwal sementara gagal dimuat' } }
      : await sharedRequest(api, 'GET', path, actor);
    return {
      ok: response.status === 200,
      status: response.status,
      json: async () => response.body,
    };
  };
  dom.print = () => {
    prints++;
  };
  const { createRoot } = await import('react-dom/client');
  const container = dom.document.createElement('div');
  dom.document.body.append(container);
  const root = createRoot(container);
  const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
  const wait = async (check) => {
    const deadline = Date.now() + 3000;
    while (!check() && Date.now() < deadline) await act(settle);
    assert.ok(check(), container.textContent);
  };
  const render = async (component, props) =>
    act(async () => {
      root.render(createElement(component, props));
      await settle();
    });
  try {
    const { default: Calendar } = await vite.ssrLoadModule(
      '/src/components/account/AccountDeliveryCalendar.jsx',
    );
    await render(Calendar);
    await wait(() => container.querySelector('.delivery-schedule-card'));
    assert.equal(container.querySelectorAll('.delivery-schedule-card').length, 1);
    assert.match(container.textContent, /Wilayah uji/);
    assert.doesNotMatch(container.textContent, /Toko Bersama|Toko Lain/);
    await act(async () => {
      container.querySelector('button[aria-label^="Bulan berikutnya"]').click();
    });
    assert.deepEqual(
      [...container.querySelectorAll('.is-scheduled')].map((node) => node.textContent),
      ['2', '16', '30'],
    );
    failed = true;
    await render(Calendar, { key: 'failure' });
    await wait(() => container.querySelector('[role="alert"]'));
    failed = false;
    actor = 'buyer';
    await act(async () => {
      container.querySelector('button').click();
      await settle();
    });
    await wait(() => container.textContent.includes('Jadwal belum ditetapkan'));
    const { default: PackingList } = await vite.ssrLoadModule(
      '/src/components/shop/B2BPackingList.jsx',
    );
    const order = (name) => ({
      b2b: { storeName: name, sales: [{ name: 'Sales snapshot' }] },
      total: 987654321,
      address: 'ALAMAT_RAHASIA',
      items: [
        {
          id: 'box',
          name: 'Barang snapshot 100g',
          quantity: 2,
          price: 987654321,
          details: {
            name: 'Barang snapshot',
            brand: 'Merek',
            sizeLabel: '100g',
            packaging: { packagingType: 'box', unitsPerPackage: 24, sizeLabel: '100g' },
          },
        },
      ],
    });
    await act(async () => {
      root.render(
        createElement(
          'section',
          null,
          createElement(PackingList, { order: order('TOKO PERTAMA') }),
          createElement(PackingList, { order: order('TOKO KEDUA') }),
        ),
      );
    });
    const button = container.querySelector('button');
    await act(async () => {
      button.click();
      await settle();
    });
    await wait(() => prints === 1);
    assert.equal(dom.document.querySelectorAll('.b2b-print-root').length, 1);
    let printed = dom.document.querySelector('.b2b-print-root');
    assert.match(printed.textContent, /TOKO PERTAMA|Barang snapshot/);
    assert.doesNotMatch(printed.textContent, /TOKO KEDUA|987654321|ALAMAT_RAHASIA|Rp|Bayar|Harga/);
    assert.match(printed.querySelector('style').textContent, /210mm 297mm/);
    await act(async () => dom.dispatchEvent(new dom.Event('afterprint')));
    assert.equal(dom.document.querySelector('.b2b-print-root'), null);
    const select = container.querySelector('select');
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.HTMLSelectElement.prototype, 'value').set.call(
        select,
        'continuousHalf',
      );
      select.dispatchEvent(new dom.Event('change', { bubbles: true }));
    });
    await act(async () => {
      button.click();
      await settle();
    });
    await wait(() => prints === 2);
    printed = dom.document.querySelector('.b2b-print-root');
    assert.match(printed.querySelector('style').textContent, /241.3mm 139.7mm/);
    assert.ok(printed.querySelector('.is-dot-matrix'));
    await act(async () => dom.dispatchEvent(new dom.Event('afterprint')));
  } finally {
    await act(async () => root.unmount());
    Object.assign(globalThis, previous);
    await vite.close();
    api.db.close();
    await dom.happyDOM.close();
  }
});
