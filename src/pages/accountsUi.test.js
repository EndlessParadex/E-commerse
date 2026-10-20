import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement } from 'react';
import { createApp, hashPassword } from '../../server/app.js';

test('account management website: owner filters, confirmed deactivate/reactivate/delete, protected owners and restricted admin access', async () => {
  const sent = [];
  const api = createApp({
    dbPath: ':memory:',
    mailer: { enabled: false },
    mailConfig: {},
    mailTransportFactory: (env) => ({
      enabled: Boolean(env.BAM_SMTP_HOST),
      send: async (value) => {
        sent.push(value);
      },
    }),
  });
  const password = 'owner-website-password',
    hash = await hashPassword(password);
  for (const id of ['owner', 'operator', 'buyer', 'customer'])
    api.db
      .prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)')
      .run(
        id,
        'Akun ' + id,
        id + '@fixture.test',
        'Alamat lengkap fixture',
        hash,
        new Date().toISOString(),
        ['buyer', 'customer'].includes(id) ? 'user' : 'admin',
      );
  api.db.prepare('INSERT INTO store_owners VALUES(?,?)').run('owner', new Date().toISOString());
  api.db.prepare('INSERT INTO auth_account_state(user_id,verified_at) VALUES(?,?)').run('buyer', 1);
  api.phoneVerification.save('buyer', '081234567890');
  api.db.prepare('UPDATE user_contact_phones SET verified_at=1 WHERE user_id=?').run('buyer');
  api.phoneVerification.save('customer', '081298765432');
  const dom = new Window({ url: 'http://fixture.test/#/login' }),
    oldFetch = globalThis.fetch;
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
  dom.scrollTo = () => {};
  dom.confirm = () => true;
  dom.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  dom.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  let cookie = '';
  const requests = [];
  globalThis.fetch = async (path, options = {}) => {
    requests.push(path);
    const req = Readable.from(options.body ? [options.body] : []);
    req.method = options.method || 'GET';
    req.url = path;
    req.socket = { remoteAddress: '192.0.2.1' };
    req.headers = {
      host: 'fixture.test',
      origin: 'http://fixture.test',
      'content-type': 'application/json',
      cookie,
    };
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
    root = createRoot(container);
    const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
    const wait = async (check) => {
      const until = Date.now() + 4000;
      while (!check() && Date.now() < until) await act(settle);
      assert.ok(check(), container.textContent.slice(-1800));
    };
    const fill = async (selector, value) =>
      act(async () => {
        const e = container.querySelector(selector);
        assert.ok(e, selector);
        Object.getOwnPropertyDescriptor(dom.HTMLInputElement.prototype, 'value').set.call(e, value);
        e.dispatchEvent(new dom.Event('input', { bubbles: true }));
        await settle();
      });
    const submit = async (selector) =>
      act(async () => {
        container
          .querySelector(selector)
          .dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true }));
        await settle();
      });
    const route = async (value) =>
      act(async () => {
        dom.location.hash = value;
        dom.dispatchEvent(new dom.HashChangeEvent('hashchange'));
        await settle();
      });
    await act(async () => {
      root.render(createElement(App));
      await settle();
    });
    await wait(() => container.querySelector('#auth-email'));
    await fill('#auth-email', 'owner@fixture.test');
    await fill('#auth-password', password);
    await submit('.auth-card form');
    await wait(() => container.querySelector('nav a[href="#/admin/akun"]'));
    await route('/admin/akun');
    const row = (id) => container.querySelector('[data-account-id="' + id + '"]');
    const rowButton = (id, label) =>
      [...row(id).querySelectorAll('button')].find((button) => button.textContent === label);
    const click = async (button) =>
      act(async () => {
        assert.ok(button);
        button.click();
        await settle();
      });
    const confirmButton = () =>
      container.querySelector('dialog .bam-dialog-actions button:last-child');
    const actionReason = async (value) =>
      act(async () => {
        const e = container.querySelector('#account-action-reason');
        Object.getOwnPropertyDescriptor(dom.HTMLTextAreaElement.prototype, 'value').set.call(
          e,
          value,
        );
        e.dispatchEvent(new dom.Event('input', { bubbles: true }));
        await settle();
      });
    await wait(() => row('buyer'));
    assert.match(row('buyer').textContent, /Email terkonfirmasi/);
    assert.match(row('buyer').textContent, /Nomor HP terkonfirmasi/);
    assert.match(row('customer').textContent, /Nomor HP belum dikonfirmasi/);
    assert.match(row('owner').textContent, /Nomor HP belum ditambahkan/);
    assert.equal(
      row('buyer').querySelector('a[href^="https://wa.me/"]').getAttribute('href'),
      'https://wa.me/6281234567890',
    );
    assert.equal(rowButton('owner', 'Hapus'), undefined);
    assert.match(row('owner').textContent, /Akun yang sedang digunakan/);
    assert.equal(rowButton('owner', 'Atur akses'), undefined);
    await click(rowButton('buyer', 'Atur akses'));
    await act(async () => {
      const select = container.querySelector('#account-customer-role');
      select.value = 'chair';
      select.dispatchEvent(new dom.Event('change', { bubbles: true }));
      await settle();
    });
    await fill('#account-owner-password', password);
    await click(confirmButton());
    await wait(
      () => !container.querySelector('dialog') && row('buyer')?.textContent.includes('Ketua'),
    );
    assert.equal(api.accounts.get('buyer', { id: 'owner' }).customerRole, 'chair');
    assert.equal(api.db.prepare('SELECT role FROM users WHERE id=?').get('buyer').role, 'user');
    await act(async () => {
      const select = container.querySelector('#accounts-role');
      select.value = 'chair';
      select.dispatchEvent(new dom.Event('change', { bubbles: true }));
      await settle();
    });
    await wait(() => container.querySelectorAll('.accounts-table tbody tr').length === 1);
    assert.ok(row('buyer'));
    assert.match(row('buyer').textContent, /Hanya melihat daftar pembeli/);
    await globalThis.fetch('/api/auth/logout', { method: 'POST' });
    await act(async () => root.unmount());
    dom.location.hash = '/login';
    root = createRoot(container);
    await act(async () => {
      root.render(createElement(App));
      await settle();
    });
    await wait(() => container.querySelector('#auth-email'));
    await fill('#auth-email', 'buyer@fixture.test');
    await fill('#auth-password', password);
    await submit('.auth-card form');
    await wait(() => container.querySelector('[data-customer-id="customer"]'));
    assert.equal(dom.location.hash, '#/pelanggan');
    assert.match(container.textContent, /Ketua · Akses lihat/);
    assert.equal(container.querySelector('[data-customer-id="owner"]'), null);
    assert.equal(container.querySelector('[data-customer-id="operator"]'), null);
    assert.equal(container.querySelector('[data-customer-id="buyer"]'), null);
    assert.match(
      container.querySelector('[data-customer-id="customer"]').textContent,
      /Belum dikonfirmasi/,
    );
    assert.equal(container.querySelector('.customer-directory-table button'), null);
    assert.doesNotMatch(
      container.querySelector('.customer-directory').textContent,
      /Alamat lengkap fixture/,
    );
    await fill('#customer-query', 'tidak-ada@fixture.test');
    await submit('.customer-directory-filters');
    await wait(() => container.querySelector('.customer-directory-empty'));
    await fill('#customer-query', 'customer@fixture.test');
    await submit('.customer-directory-filters');
    await wait(() => container.querySelector('[data-customer-id="customer"]'));
    await route('/akun');
    await wait(() => container.querySelector('.account-menu a[href="#/pelanggan"]'));
    assert.equal(container.querySelector('.account-menu a[href="#/admin"]'), null);
    await route('/pelanggan');
    await wait(() => container.querySelector('[data-customer-id="customer"]'));
    api.accounts.change({ id: 'owner' }, 'buyer', {
      action: 'customer-access',
      revision: 1,
      customerRole: '',
      reason: 'Cabut izin tim pengujian',
    });
    await click(container.querySelector('.customer-directory-toolbar button'));
    await wait(() => container.querySelector('.customer-directory-error'));
    assert.equal(
      container.querySelector('.customer-directory-table'),
      null,
      'data lama dibersihkan ketika izin dicabut',
    );
    await globalThis.fetch('/api/auth/logout', { method: 'POST' });
    await globalThis.fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'owner@fixture.test', password }),
    });
    await act(async () => root.unmount());
    dom.location.hash = '/admin/akun';
    root = createRoot(container);
    await act(async () => {
      root.render(createElement(App));
      await settle();
    });
    await wait(() => row('buyer'));
    await click(rowButton('buyer', 'Nonaktifkan'));
    await click(confirmButton());
    await wait(() => container.querySelector('dialog [role=alert]'));
    assert.match(container.querySelector('dialog [role=alert]').textContent, /alasan/);
    await actionReason('Nonaktifkan akun pengujian');
    await fill('#account-owner-password', password);
    await click(confirmButton());
    await wait(() => !container.querySelector('dialog') && rowButton('buyer', 'Aktifkan kembali'));
    assert.equal(api.accounts.get('buyer', { id: 'owner' }).active, false);
    await click(rowButton('buyer', 'Aktifkan kembali'));
    await actionReason('Aktifkan kembali akun pengujian');
    await fill('#account-owner-password', password);
    await click(confirmButton());
    await wait(() => !container.querySelector('dialog') && rowButton('buyer', 'Nonaktifkan'));
    await fill('#accounts-search', 'buyer@fixture.test');
    await wait(
      () =>
        container.querySelectorAll('tbody tr').length === 1 &&
        !container.querySelector('.accounts-list-toolbar button').disabled,
    );
    await click(rowButton('buyer', 'Hapus'));
    await actionReason('Hapus akun pengujian tanpa pesanan');
    await fill('#account-owner-password', password);
    await fill('#account-confirm-email', 'wrong@fixture.test');
    await click(confirmButton());
    await wait(() => container.querySelector('dialog [role=alert]'));
    assert.match(container.querySelector('dialog [role=alert]').textContent, /email akun/);
    assert.ok(api.db.prepare('SELECT id FROM users WHERE id=?').get('buyer'));
    await fill('#account-confirm-email', 'buyer@fixture.test');
    await click(confirmButton());
    await wait(() => !container.querySelector('dialog') && !row('buyer'));
    assert.equal(api.db.prepare('SELECT id FROM users WHERE id=?').get('buyer'), undefined);
    assert.ok(api.db.prepare('SELECT id FROM users WHERE id=?').get('owner'));
    await globalThis.fetch('/api/auth/logout', { method: 'POST' });
    await globalThis.fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'operator@fixture.test', password }),
    });
    await act(async () => root.unmount());
    root = createRoot(container);
    const reads = requests.filter((path) => path.startsWith('/api/admin/accounts')).length;
    await act(async () => {
      root.render(createElement(App));
      await settle();
    });
    await wait(() => container.textContent.includes('Kelola akun khusus pemilik toko'));
    assert.equal(container.querySelector('nav a[href="#/admin/akun"]'), null);
    assert.equal(container.querySelector('#accounts-search'), null);
    assert.equal(requests.filter((path) => path.startsWith('/api/admin/accounts')).length, reads);
  } finally {
    if (root) await act(async () => root.unmount());
    await vite.close();
    api.db.close();
    globalThis.fetch = oldFetch;
    dom.happyDOM.abort();
  }
});
