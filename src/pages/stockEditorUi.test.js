import { waitForAdmin } from './testUiReady.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement } from 'react';
import { createApp } from '../../server/app.js';

test('stok ringkas: edit di tempat, konflik perangkat, isian offline, guard filter dan penyimpanan tunggal', async () => {
  const api = createApp({ dbPath: ':memory:' });
  const candidate = api.catalog.snapshot();
  const group = candidate.edits.find((row) => row.groupId === 'snack-pedas');
  const unit = group.variants.find((row) => row.id === 'snack-pedas');
  group.variants.push({
    ...unit,
    id: 'EDIT-PACK',
    packagingType: 'pack',
    unitsPerPackage: '10',
    price: '150000',
    oldPrice: '',
  });
  group.variants.push({
    ...unit,
    id: 'EDIT-DUS',
    packagingType: 'dus',
    unitsPerPackage: '40',
    price: '500000',
    oldPrice: '',
  });
  api.catalog.save(candidate);
  const key = `${group.groupId}:${unit.sizeValue}-${unit.sizeUnit}`;
  const owner = { id: 'editor-owner', role: 'admin' };
  const token = 's'.repeat(43);
  api.db
    .prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)')
    .run(
      owner.id,
      'Admin stok',
      'stock@fixture.test',
      'Alamat lengkap admin stok',
      'fixture',
      new Date().toISOString(),
      'admin',
    );
  api.db
    .prepare('INSERT INTO sessions VALUES(?,?,?)')
    .run(createHash('sha256').update(token).digest('hex'), owner.id, Date.now() + 60000);
  api.workflow.setStock(owner, { key, available: 119, revision: 0 });
  const dom = new Window({ url: 'http://editor.test/#/admin/stok' });
  const previousFetch = globalThis.fetch;
  globalThis.window = dom;
  globalThis.document = dom.document;
  globalThis.HTMLElement = dom.HTMLElement;
  globalThis.ResizeObserver = dom.ResizeObserver;
  Object.defineProperty(globalThis, 'navigator', { value: dom.navigator, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', {
    value: dom.localStorage,
    configurable: true,
  });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let accepted = false;
  let scrollCalls = 0;
  let offline = false;
  let holdSave = false;
  let releaseSave;
  let writes = 0;
  dom.confirm = () => accepted;
  dom.scrollTo = () => {
    scrollCalls += 1;
  };
  async function request(method, path, body) {
    const req = Readable.from(body ? [body] : []);
    req.method = method;
    req.url = path;
    req.headers = {
      host: 'editor.test',
      origin: 'http://editor.test',
      'content-type': 'application/json',
      cookie: 'bam_session=' + token,
    };
    let status;
    let value;
    await api.handler(req, {
      writeHead(code) {
        status = code;
      },
      end(data) {
        value = JSON.parse(data);
      },
    });
    return { status, ok: status >= 200 && status < 300, json: async () => value };
  }
  globalThis.fetch = async (path, options = {}) => {
    if (options.method === 'PUT' && path === '/api/admin/inventory') {
      writes += 1;
      if (offline) throw new Error('server offline');
      if (holdSave)
        return new Promise((resolve) => {
          releaseSave = async () => resolve(await request('PUT', path, options.body));
        });
    }
    if (offline && ['/api/inventory', '/api/admin/inventory'].includes(path))
      throw new Error('server offline');
    return request(options.method || 'GET', path, options.body);
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
    const [{ default: App }] = await Promise.all(
      ['/src/App.jsx'].map((path) => vite.ssrLoadModule(path)),
    );
    const { createRoot } = await import('react-dom/client');
    const container = dom.document.createElement('div');
    dom.document.body.append(container);
    root = createRoot(container);
    const settle = () => new Promise((resolve) => setTimeout(resolve, 30));
    await act(async () => {
      root.render(createElement(App));
      await settle();
    });
    await act(settle);
    await waitForAdmin(container, act);
    const button = (label) =>
      [...container.querySelectorAll('button')].find((entry) => entry.textContent.trim() === label);
    const click = async (element) => {
      assert.ok(element);
      await act(async () => {
        element.click();
        await settle();
      });
    };
    const fill = async (selector, value) =>
      act(async () => {
        const input = container.querySelector(selector);
        assert.ok(input);
        Object.getOwnPropertyDescriptor(dom.HTMLInputElement.prototype, 'value').set.call(
          input,
          value,
        );
        input.dispatchEvent(new dom.Event('input', { bubbles: true }));
        await settle();
      });
    const card = () =>
      [...container.querySelectorAll('.workflow-stock-card')].find((row) =>
        row.textContent.includes('EDIT-DUS'),
      );
    const fillUnits = async (value) => {
      await fill('#stock-dus', '0');
      await fill('#stock-pack', '0');
      await fill('#stock-satuan', value);
    };
    const preview = () => container.querySelector('#stock-total-preview')?.textContent.trim();
    assert.ok(container.querySelector('.workflow-stock-list.is-compact'));
    assert.deepEqual(
      [...card().querySelectorAll('.workflow-stock-stat dd strong')].map((row) => row.textContent),
      ['2', '3', '9'],
    );
    await click(container.querySelector('input[name="stock-layout"][value="full"]'));
    assert.equal(card().querySelector('details').open, true);
    await click(container.querySelector('input[name="stock-layout"][value="compact"]'));
    assert.equal(card().querySelector('details').open, false);
    const beforeEditScroll = scrollCalls;
    await click(card().querySelector('button'));
    assert.equal(container.querySelector('dialog'), null);
    assert.ok(card().querySelector('#stock-satuan'));
    assert.ok(card().querySelector('#stock-dus'));
    assert.equal(card().querySelector('#stock-karton').disabled, true);
    assert.match(card().textContent, /Jenis karton belum tersedia di katalog/);
    assert.equal(preview(), '119 satuan', 'Default kemasan sesuai stok awal');
    assert.equal(scrollCalls, beforeEditScroll);
    await fillUnits('150');
    assert.equal(preview(), '150 satuan');
    await fill('#admin-stock-search', 'Laptop');
    assert.equal(container.querySelector('#admin-stock-search').value, '');
    assert.equal(container.querySelector('#stock-satuan').value, '150');
    await click(container.querySelector('.admin-navigation a[href="#/admin/produk"]'));
    assert.equal(dom.location.hash, '#/admin/stok');
    assert.equal(container.querySelector('#stock-satuan').value, '150');
    const current = api.workflow.stock().stock[key];
    api.workflow.setStock(owner, { key, available: 120, revision: current.revision });
    await click(button('Simpan stok'));
    assert.equal(api.workflow.stock().stock[key].available, 120);
    assert.equal(container.querySelector('#stock-satuan').value, '150');
    assert.ok(container.querySelector('#stock-edit-error'));
    await click(button('Muat stok terbaru ke form'));
    assert.equal(preview(), '120 satuan');
    await fillUnits('119');
    await click(button('Simpan stok'));
    assert.equal(api.workflow.stock().stock[key].available, 119);
    assert.equal(container.querySelector('#stock-satuan'), null);
    await click(card().querySelector('button'));
    await fillUnits('1.5');
    await click(button('Simpan stok'));
    assert.match(container.querySelector('#stock-edit-error').textContent, /bilangan bulat/);
    assert.equal(api.workflow.stock().stock[key].available, 119);
    await fillUnits('150');
    offline = true;
    await click(button('Simpan stok'));
    assert.equal(container.querySelector('#stock-satuan').value, '150');
    assert.ok(container.querySelector('.workflow-stock-recovery'));
    assert.equal(button('Simpan stok').disabled, true);
    offline = false;
    await click(button('Muat stok terbaru'));
    assert.equal(container.querySelector('#stock-satuan').value, '150');
    await click(button('Batal'));
    assert.equal(api.workflow.stock().stock[key].available, 119);
    await click(card().querySelector('button'));
    await fillUnits('130');
    holdSave = true;
    await click(button('Simpan stok'));
    const writesDuringSave = writes;
    await act(async () => {
      container
        .querySelector('.workflow-stock-editor')
        .dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true }));
      await settle();
    });
    assert.equal(writes, writesDuringSave);
    assert.equal(container.querySelector('#stock-satuan').disabled, true);
    assert.equal(container.querySelector('#admin-stock-search').disabled, true);
    await act(async () => {
      await releaseSave();
      await settle();
    });
    holdSave = false;
    assert.equal(api.workflow.stock().stock[key].available, 130);
    assert.equal(container.querySelector('#stock-satuan'), null);
    await click(card().querySelector('button'));
    await fillUnits('140');
    accepted = true;
    await fill('#admin-stock-search', 'EDIT-DUS');
    assert.equal(container.querySelector('#stock-satuan'), null);
    assert.equal(container.querySelectorAll('.workflow-stock-card').length, 1);
    assert.equal(api.workflow.stock().stock[key].available, 130);

    // New warehouse receipts add only actual additional packages to the latest stock.
    await click(card().querySelector('button'));
    await click(container.querySelector('input[name="stock-mode"][value="add"]'));
    assert.equal(preview(), '130 satuan');
    await fill('#stock-dus', '1');
    await fill('#stock-pack', '2');
    await fill('#stock-satuan', '4');
    assert.equal(preview(), '194 satuan', '40 + 20 + 4 added to 130');
    await click(button('Simpan stok'));
    assert.equal(api.workflow.stock().stock[key].available, 194);
    assert.equal(container.querySelector('#stock-satuan'), null);
  } finally {
    if (root) await act(async () => root.unmount());
    await vite.close();
    api.db.close();
    globalThis.fetch = previousFetch;
    dom.happyDOM.abort();
  }
});
