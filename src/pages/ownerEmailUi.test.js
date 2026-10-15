import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement } from 'react';
import { createApp, hashPassword } from '../../server/app.js';

test('owner website: guided Gmail setup, credential changes, manual SMTP, private test mail and owner-only access', async () => {
  const sent = [],
    transports = [];
  const api = createApp({
    dbPath: ':memory:',
    mailer: { enabled: false },
    mailConfig: {},
    mailTransportFactory: (env) => {
      transports.push(env);
      return {
        enabled: Boolean(env.BAM_SMTP_HOST),
        send: async (value) => {
          sent.push(value);
        },
      };
    },
  });
  const password = 'owner-website-password',
    hash = await hashPassword(password);
  for (const id of ['owner', 'operator'])
    api.db
      .prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)')
      .run(
        id,
        'Akun ' + id,
        id + '@fixture.test',
        'Alamat lengkap fixture',
        hash,
        new Date().toISOString(),
        'admin',
      );
  api.db.prepare('INSERT INTO store_owners VALUES(?,?)').run('owner', new Date().toISOString());
  const dom = new Window({ url: 'https://fixture.test/#/login' }),
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
    await wait(() => container.querySelector('nav a[href="#/admin/email"]'));
    await route('/admin/email');
    await wait(() => container.querySelector('#email-setting-host'));
    const button = (text) =>
      [...container.querySelectorAll('.email-settings-page button')].find(
        (element) => element.textContent === text,
      );
    const click = async (text) =>
      act(async () => {
        assert.ok(button(text), text);
        button(text).click();
        await settle();
      });
    await click('Gunakan Gmail');
    assert.equal(container.querySelector('#email-setting-host').value, 'smtp.gmail.com');
    assert.equal(container.querySelector('#email-setting-host').readOnly, true);
    assert.equal(container.querySelector('#email-setting-port').value, '587');
    assert.equal(container.querySelector('#email-setting-user').value, '');
    assert.equal(container.querySelector('#email-setting-from').value, '');
    assert.equal(container.querySelector('#email-setting-password').value, '');
    assert.ok(container.querySelector('a[href="https://myaccount.google.com/apppasswords"]'));
    assert.match(
      container.querySelector('.email-setup-recipient').textContent,
      /owner@fixture.test/,
    );
    assert.equal(api.db.prepare('SELECT count(*) AS n FROM store_email_settings').get().n, 0);
    assert.equal(sent.length, 0);
    await fill('#email-setting-user', 'sender@fixture.test');
    assert.equal(container.querySelector('#email-setting-from').value, 'sender@fixture.test');
    await fill('#email-setting-password', 'abcd efgh ijkl mnop');
    await click('Gunakan alamat website ini');
    assert.equal(
      container.querySelector('#email-setting-publicUrl').value,
      'https://fixture.test/',
    );
    await fill('#email-owner-password', password);
    await submit('.email-settings-page form');
    await wait(() => container.querySelector('.email-settings-notice'));
    assert.equal(transports.at(-1).BAM_SMTP_HOST, 'smtp.gmail.com');
    assert.equal(transports.at(-1).BAM_SMTP_PASSWORD, 'abcdefghijklmnop');
    assert.equal(container.querySelector('#email-setting-password').value, '');
    assert.equal(container.querySelector('#email-setting-password').required, false);
    await fill('#email-setting-from', 'Toko Fixture <sender@fixture.test>');
    await fill('#email-setting-user', 'sender2@fixture.test');
    assert.equal(
      container.querySelector('#email-setting-from').value,
      'Toko Fixture <sender@fixture.test>',
    );
    assert.equal(container.querySelector('#email-setting-password').required, true);
    const revision = api.db.prepare('SELECT revision FROM store_email_settings').get().revision;
    await fill('#email-owner-password', password);
    await submit('.email-settings-page form');
    await wait(() => container.querySelector('.email-settings-error'));
    assert.match(container.querySelector('.email-settings-error').textContent, /Isi App Password/);
    assert.equal(
      api.db.prepare('SELECT revision FROM store_email_settings').get().revision,
      revision,
    );
    await click('Penyedia lain');
    assert.equal(container.querySelector('#email-setting-host').readOnly, false);
    for (const [key, value] of Object.entries({
      host: 'smtp.fixture.test',
      port: '587',
      user: 'smtp-user',
      password: 'smtp-secret-web-fixture',
      from: 'Fixture <sender@fixture.test>',
      publicUrl: 'https://shop.fixture.test/',
    }))
      await fill('#email-setting-' + key, value);
    await fill('#email-owner-password', password);
    await submit('.email-settings-page form');
    await wait(() => container.querySelector('.email-settings-notice'));
    assert.equal(api.identity.ready, true);
    assert.equal(container.querySelector('#email-setting-password').value, '');
    assert.equal(container.querySelector('#email-owner-password').value, '');
    assert.doesNotMatch(container.textContent, /smtp-secret-web-fixture/);
    const testButton = () =>
      [...container.querySelectorAll('.email-settings-page button')].find(
        (e) => e.textContent === 'Kirim email uji',
      );
    await wait(() => !testButton().disabled);
    await fill('#email-owner-password', password);
    await act(async () => {
      testButton().click();
      await settle();
    });
    await wait(() => sent.some((message) => message.subject === 'Uji email toko'));
    assert.equal(sent.at(-1).to, 'owner@fixture.test');
    await fill('#email-setting-host', 'smtp-unsaved.fixture.test');
    dom.confirm = () => false;
    await route('/admin/produk');
    assert.equal(dom.location.hash, '#/admin/email');
    assert.equal(container.querySelector('#email-setting-host').value, 'smtp-unsaved.fixture.test');
    dom.confirm = () => true;
    await globalThis.fetch('/api/auth/logout', { method: 'POST' });
    await globalThis.fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'operator@fixture.test', password }),
    });
    await act(async () => root.unmount());
    root = createRoot(container);
    const reads = requests.filter((path) => path === '/api/admin/email-settings').length;
    await act(async () => {
      root.render(createElement(App));
      await settle();
    });
    await wait(() => container.textContent.includes('Pengaturan khusus pemilik toko'));
    assert.equal(container.querySelector('nav a[href="#/admin/email"]'), null);
    assert.equal(container.querySelector('#email-setting-password'), null);
    assert.equal(requests.filter((path) => path === '/api/admin/email-settings').length, reads);
  } finally {
    if (root) await act(async () => root.unmount());
    await vite.close();
    api.db.close();
    globalThis.fetch = oldFetch;
    dom.happyDOM.abort();
  }
});
