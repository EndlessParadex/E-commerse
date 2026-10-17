import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement } from 'react';
import { createApp, hashPassword } from '../../server/app.js';

test('B2B website: owner saves stores, links buyers and assigns Sales; failures retain input; admin has read access only', async () => {
  const api = createApp({ dbPath: ':memory:', logger: () => {} });
  const password = 'b2b-website-password';
  const hash = await hashPassword(password);
  for (const [id, role] of [
    ['owner', 'admin'],
    ['operator', 'admin'],
    ['buyer', 'user'],
    ['sales', 'user'],
    ['other', 'user'],
  ]) {
    api.db
      .prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)')
      .run(
        id,
        'Akun ' + id,
        id + '@fixture.test',
        'Alamat pengujian yang lengkap',
        hash,
        '2026-10-17',
        role,
      );
  }
  api.db
    .prepare('INSERT INTO store_owners(user_id,granted_at) VALUES(?,?)')
    .run('owner', '2026-10-17');
  const dom = new Window({ url: 'http://fixture.test/#/admin/toko-sales' });
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
  let cookie = '',
    failCreate = false,
    holdCreate = false,
    releaseCreate,
    failDetails = false;
  const requests = [];
  globalThis.fetch = async (path, options = {}) => {
    requests.push({ path, method: options.method || 'GET' });
    if (path === '/api/b2b/stores/create' && failCreate) {
      failCreate = false;
      return {
        ok: false,
        status: 503,
        json: async () => ({ errors: { form: 'Koneksi pengujian terputus.' } }),
      };
    }
    if (path === '/api/b2b/stores/create' && holdCreate) {
      holdCreate = false;
      await new Promise((resolve) => {
        releaseCreate = resolve;
      });
    }
    if (/^\/api\/b2b\/stores\/[^/]+$/.test(path) && !options.body && failDetails) {
      return {
        ok: false,
        status: 503,
        json: async () => ({ errors: { form: 'Detail belum dapat dimuat.' } }),
      };
    }
    const req = Readable.from(options.body ? [options.body] : []);
    Object.assign(req, {
      method: options.method || 'GET',
      url: path,
      socket: { remoteAddress: '192.0.2.1' },
      headers: {
        host: 'fixture.test',
        origin: 'http://fixture.test',
        'content-type': 'application/json',
        cookie,
      },
    });
    let status, headers, payload;
    await api.handler(req, {
      writeHead(code, value) {
        status = code;
        headers = value;
      },
      end(value) {
        payload = Buffer.isBuffer(value) ? value : JSON.parse(value);
      },
    });
    if (headers['set-cookie']) cookie = headers['set-cookie'].split(';')[0];
    return { ok: status >= 200 && status < 300, status, json: async () => payload };
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
      const deadline = Date.now() + 5000;
      while (!check() && Date.now() < deadline) await act(settle);
      assert.ok(check(), container.textContent.slice(-2500));
    };
    const fill = async (selector, value) =>
      act(async () => {
        const field = container.querySelector(selector);
        assert.ok(field, selector);
        const prototype =
          field.tagName === 'TEXTAREA'
            ? dom.HTMLTextAreaElement.prototype
            : field.tagName === 'SELECT'
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
    const click = async (element) =>
      act(async () => {
        assert.ok(element);
        element.click();
        await settle();
      });
    const signIn = async (id) => {
      await globalThis.fetch('/api/auth/logout', { method: 'POST' });
      const response = await globalThis.fetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: id + '@fixture.test', password }),
      });
      assert.equal(response.status, 200);
      if (root) await act(async () => root.unmount());
      root = createRoot(container);
      await act(async () => {
        root.render(createElement(App));
        await settle();
      });
    };
    const account = (id) => container.querySelector('[data-b2b-account="' + id + '"]');
    await signIn('owner');
    await wait(() => account('buyer'));
    assert.ok(container.querySelector('nav a[href="#/admin/toko-sales"][aria-current=page]'));
    await click(container.querySelector('.b2b-create summary'));
    await fill('#b2b-store-name', 'Toko Pertama');
    await fill('#b2b-store-phone', '081234567890');
    await fill('#b2b-store-address', 'Jalan Nusantara Nomor 15');
    failCreate = true;
    await submit('#b2b-create-form');
    await wait(() => container.textContent.includes('Koneksi pengujian terputus.'));
    assert.equal(container.querySelector('#b2b-store-name').value, 'Toko Pertama');
    assert.equal(api.db.prepare('SELECT COUNT(*) AS n FROM b2b_stores').get().n, 0);
    holdCreate = true;
    const beforeCreate = requests.filter((item) => item.path === '/api/b2b/stores/create').length;
    await submit('#b2b-create-form');
    await submit('#b2b-create-form');
    assert.equal(
      requests.filter((item) => item.path === '/api/b2b/stores/create').length,
      beforeCreate + 1,
    );
    assert.equal(container.querySelector('#b2b-create-form fieldset').disabled, true);
    await act(async () => {
      releaseCreate();
      await settle();
    });
    await wait(() => container.querySelector('.b2b-code'));
    assert.equal(container.querySelector('#b2b-store-name').value, '');
    const first = api.db
      .prepare('SELECT id FROM b2b_stores WHERE store_name=?')
      .get('Toko Pertama');
    await fill('#b2b-store-name', 'Toko Kedua');
    await fill('#b2b-store-phone', '081298765432');
    await fill('#b2b-store-address', 'Jalan Kedua Nomor 25');
    await submit('#b2b-create-form');
    await wait(
      () =>
        container.querySelector('[aria-label="Detail dan penugasan toko"] h2')?.textContent ===
        'Toko Kedua',
    );
    await wait(() => account('buyer'));
    const second = api.db.prepare('SELECT id FROM b2b_stores WHERE store_name=?').get('Toko Kedua');
    await click(account('buyer').querySelector('button'));
    await wait(() => account('buyer')?.querySelector('button')?.textContent === 'Sudah terhubung');
    assert.equal(
      api.db.prepare('SELECT store_id FROM b2b_store_members WHERE user_id=?').get('buyer')
        .store_id,
      second.id,
    );
    assert.equal(
      api.db.prepare('SELECT COUNT(*) AS n FROM b2b_store_members WHERE store_id=?').get(first.id)
        .n,
      0,
    );
    await click(account('sales').querySelector('button:last-child'));
    await wait(() => container.querySelector('dialog'));
    await click(container.querySelector('dialog .bam-dialog-actions button:last-child'));
    await wait(
      () =>
        !container.querySelector('dialog') &&
        container.querySelector('#b2b-sales-choice option[value=sales]'),
    );
    await fill('#b2b-sales-choice', 'sales');
    await submit('#b2b-assign-form');
    await wait(() =>
      container.querySelector('.b2b-sales-list')?.textContent.includes('1 toko ditugaskan'),
    );
    assert.equal(
      api.db
        .prepare('SELECT store_id FROM b2b_sales_assignments WHERE sales_user_id=?')
        .get('sales').store_id,
      second.id,
    );
    failDetails = true;
    await click(account('other').querySelector('button'));
    await wait(() => container.textContent.includes('Detail belum dapat dimuat.'));
    assert.ok(
      container.querySelector('.b2b-notice').textContent.includes('Pembeli berhasil dihubungkan'),
    );
    assert.ok(
      api.db
        .prepare('SELECT user_id FROM b2b_store_members WHERE store_id=? AND user_id=?')
        .get(second.id, 'other'),
    );
    failDetails = false;
    await click(container.querySelector('.b2b-error button'));
    await wait(() =>
      container.querySelector('.b2b-assignment-grid')?.textContent.includes('Akun other'),
    );
    const accountReads = requests.filter((item) =>
      item.path.startsWith('/api/b2b/accounts'),
    ).length;
    await signIn('operator');
    await wait(
      () => container.querySelector('.b2b-readonly') && container.querySelector('.b2b-code'),
    );
    assert.equal(container.querySelector('#b2b-create-form'), null);
    assert.equal(container.querySelector('#b2b-account-search'), null);
    assert.equal(container.querySelector('#b2b-assign-form'), null);
    assert.equal(
      requests.filter((item) => item.path.startsWith('/api/b2b/accounts')).length,
      accountReads,
    );
    await signIn('buyer');
    await wait(() => container.textContent.includes('Akses admin diperlukan'));
    assert.equal(container.querySelector('.b2b-page'), null);
  } finally {
    releaseCreate?.();
    if (root) await act(async () => root.unmount());
    await vite.close();
    api.db.close();
    globalThis.fetch = oldFetch;
    dom.happyDOM.abort();
  }
});
