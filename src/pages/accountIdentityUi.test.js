import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement } from 'react';
import { createTestApp } from '../../server/testingHelpers.js';

test('account website: buyer security summary, admin password settings, registration, verification, reset and SMTP-off message', async () => {
  let emailReady = true;
  const api = createTestApp({ dbPath: ':memory:' });
  const dom = new Window({ url: 'http://fixture.test/#/daftar' }),
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
  let cookie = '';
  const requests = [];
  globalThis.fetch = async (path, options = {}) => {
    requests.push({ path, body: options.body && JSON.parse(options.body) });
    if (path === '/api/auth/features') return { ok: true, json: async () => ({ emailReady }) };
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
    const settle = () => new Promise((r) => setTimeout(r, 20));
    const wait = async (check) => {
      const deadline = Date.now() + 3000;
      while (!check() && Date.now() < deadline) await act(settle);
      assert.ok(
        check(),
        'page finishes loading: ' + dom.location.hash + ' ' + container.textContent.slice(-1500),
      );
    };
    const fill = async (selector, value) =>
      act(async () => {
        const e = container.querySelector(selector);
        assert.ok(e, selector);
        const proto =
          e.tagName === 'TEXTAREA'
            ? dom.HTMLTextAreaElement.prototype
            : dom.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, value);
        e.dispatchEvent(new dom.Event('input', { bubbles: true }));
        await settle();
      });
    const submit = async (selector) =>
      act(async () => {
        const form = container.querySelector(selector);
        assert.ok(form, selector);
        form.dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true }));
        await settle();
      });
    const route = async (value, check) => {
      await act(async () => {
        dom.location.hash = value;
        dom.dispatchEvent(new dom.HashChangeEvent('hashchange'));
        await settle();
      });
      await wait(check);
    };
    const mailToken = () => api.testMailbox.at(-1).text.match(/token=([A-Za-z0-9_-]+)/)[1];
    await act(async () => {
      root.render(createElement(App));
      await settle();
    });
    await wait(() => container.querySelector('#auth-name'));
    await fill('#auth-name', 'Pembeli Website');
    await fill('#auth-email', 'website@fixture.test');
    await fill('#auth-address', 'Alamat pengujian website lengkap');
    await fill('#auth-password', 'registration-password');
    await fill('#auth-confirmPassword', 'registration-password');
    await submit('.auth-card form');
    await wait(() => container.querySelector('.auth-submit-notice'));
    assert.ok(container.querySelector('.auth-registration-result a[href="#/login"]'));
    assert.equal(
      container.querySelector('.auth-card form'),
      null,
      'pendaftaran selesai menampilkan langkah berikutnya',
    );
    assert.equal(api.db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 1);
    assert.equal(api.identity.verified(api.db.prepare('SELECT id FROM users').get().id), false);
    assert.equal(cookie, '');
    assert.match(container.textContent, /Akun baru menunggu persetujuan Admin atau Pemilik/);
    const pendingCustomer = api.db.prepare('SELECT id FROM users WHERE email=?').get('website@fixture.test');
    assert.equal(
      api.db.prepare('SELECT status FROM account_approvals WHERE user_id=?').get(pendingCustomer.id).status,
      'pending',
    );
    await api.identity.flushMail();
    const activation = mailToken();
    await route('/verifikasi-email?token=' + activation, () =>
      container.querySelector('#recovery-password'),
    );
    assert.equal(dom.location.hash, '#/verifikasi-email');
    assert.doesNotMatch(container.textContent, new RegExp(activation));
    await fill('#recovery-password', 'registration-password');
    await submit('.auth-card form');
    await wait(() => container.textContent.includes('Email dikonfirmasi'));
    assert.equal(api.db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 1);
    await route('/login', () => container.querySelector('#auth-email'));
    await fill('#auth-email', 'website@fixture.test');
    await fill('#auth-password', 'registration-password');
    await submit('.auth-card form');
    await wait(() => container.textContent.includes('Akun menunggu persetujuan'));
    assert.equal(dom.location.hash, '#/login', 'Email terverifikasi belum cukup untuk login');
    api.db.prepare("UPDATE account_approvals SET status='approved',revision=revision+1 WHERE user_id=?")
      .run(pendingCustomer.id);
    await submit('.auth-card form');
    await wait(() => dom.location.hash === '#/');
    await route('/akun', () => container.querySelector('#account-tab-security'));
    await act(async () => {
      container.querySelector('#account-tab-security').click();
      await settle();
    });
    assert.match(
      container.querySelector('#account-panel-security').textContent,
      /Email sudah dikonfirmasi/,
    );
    const buyerSecurity = container.querySelector('#account-panel-security');
    assert.ok(buyerSecurity.querySelector('[aria-label="Informasi kata sandi"]'));
    assert.match(buyerSecurity.textContent, /Kata sandi tidak ditampilkan/);
    assert.equal(buyerSecurity.querySelector('form'), null);
    assert.equal(buyerSecurity.querySelector('input[type=password]'), null);
    assert.equal(buyerSecurity.querySelector('a[href="#/forgot-password"]'), null);
    assert.equal(requests.filter((x) => x.path === '/api/auth/change-password').length, 0);

    // Reload the account after granting the fixture admin access; a buyer never gets the form.
    api.db.prepare("UPDATE users SET role='admin' WHERE email=?").run('website@fixture.test');
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => {
      root.render(createElement(App));
      await settle();
    });
    await wait(() => container.querySelector('#account-tab-security'));
    await act(async () => {
      container.querySelector('#account-tab-security').click();
      await settle();
    });
    await wait(() => container.querySelector('#security-currentPassword'));
    assert.ok(container.querySelector('#account-panel-security form'));
    await fill('#security-currentPassword', 'registration-password');
    await fill('#security-password', 'changed-password');
    await fill('#security-confirm', 'different-password');
    await submit('#account-panel-security form');
    assert.match(
      container.querySelector('#account-panel-security [role=alert]').textContent,
      /konfirmasi yang sama/,
    );
    assert.equal(requests.filter((x) => x.path === '/api/auth/change-password').length, 0);
    await fill('#security-confirm', 'changed-password');
    await submit('#account-panel-security form');
    await wait(() => container.querySelector('#auth-email'));
    assert.equal(dom.location.hash, '#/login');
    assert.equal(api.db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 0);
    await route('/forgot-password', () => container.querySelector('#recovery-email'));
    await wait(() => !container.querySelector('fieldset').disabled);
    await fill('#recovery-email', 'website@fixture.test');
    await submit('.auth-card form');
    await wait(() => container.querySelector('.auth-submit-notice'));
    await api.identity.flushMail();
    const reset = mailToken();
    await route('/reset-password?token=' + reset, () =>
      container.querySelector('#recovery-password'),
    );
    assert.equal(dom.location.hash, '#/reset-password');
    await fill('#recovery-password', 'reset-password');
    await fill('#recovery-confirm', 'reset-password');
    await submit('.auth-card form');
    await wait(() => container.textContent.includes('Semua sesi lama diakhiri'));
    await route('/reset-password?token=' + reset, () =>
      container.querySelector('#recovery-password'),
    );
    await fill('#recovery-password', 'reused-password');
    await fill('#recovery-confirm', 'reused-password');
    await submit('.auth-card form');
    await wait(() => container.querySelector('.auth-error'));
    assert.match(container.querySelector('.auth-error').textContent, /Tautan tidak valid/);
    emailReady = false;
    await route('/forgot-password', () => container.querySelector('#recovery-email'));
    await wait(() => container.textContent.includes('Layanan email toko belum diaktifkan'));
    assert.equal(container.querySelector('.auth-card fieldset').disabled, true);
  } finally {
    if (root) await act(async () => root.unmount());
    await vite.close();
    api.db.close();
    globalThis.fetch = oldFetch;
    dom.happyDOM.abort();
  }
});
