import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement, StrictMode } from 'react';
import { createTestApp } from '../../server/testingHelpers.js';

test('account website: buyer security summary, admin password settings, registration, verification, reset and SMTP-off message', async () => {
  let emailReady = true;
  let time = Date.now();
  const whatsapp = [];
  const api = createTestApp({
    dbPath: ':memory:',
    now: () => time,
    whatsappSender: {
      enabled: true,
      send: async (value) => {
        whatsapp.push(value);
      },
    },
  });
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
  // FileReader is real; image decoding is simulated because Happy DOM has no image decoder.
  dom.Image = class {
    set src(value) {
      queueMicrotask(() =>
        value.startsWith('data:image/png;base64,iVBORw0KGgo') ? this.onload?.() : this.onerror?.(),
      );
    }
  };
  let cookie = '';
  let sessionDelay = 0;
  const requests = [];
  globalThis.fetch = async (path, options = {}) => {
    if (path === '/api/auth/me' && sessionDelay)
      await new Promise((resolve) => setTimeout(resolve, sessionDelay));
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
    assert.equal(container.querySelector('.account-trigger-name').textContent, 'Guest');
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
    assert.match(container.textContent, /Admin atau Pemilik akan memeriksa pendaftaran/);
    assert.ok(container.querySelector('.auth-registration-help button'));
    assert.match(container.textContent, /Verifikasi email dapat dilakukan sambil menunggu/);
    const pendingCustomer = api.db
      .prepare('SELECT id FROM users WHERE email=?')
      .get('website@fixture.test');
    assert.equal(
      api.db.prepare('SELECT status FROM account_approvals WHERE user_id=?').get(pendingCustomer.id)
        .status,
      'pending',
    );
    await act(async () => {
      container.querySelector('.auth-registration-help button').click();
      await settle();
    });
    await wait(() =>
      container.textContent.includes('Permintaan diterima. Jika email masih perlu diverifikasi'),
    );
    assert.ok(requests.some((request) => request.path === '/api/auth/verification/resend'));
    await api.identity.flushMail();
    const activation = mailToken();
    await route('/verifikasi-email', () => container.querySelector('#verification-email'));
    assert.equal(
      container.querySelector('#recovery-password'),
      null,
      'missing links do not show a locked password field',
    );
    assert.match(container.textContent, /Tautan verifikasi belum lengkap/);
    await fill('#verification-email', 'website@fixture.test');
    await submit('.auth-recovery-request');
    await wait(() => container.querySelector('.auth-submit-notice'));
    assert.ok(
      requests.some(
        (request) =>
          request.path === '/api/auth/verification/resend' &&
          request.body?.email === 'website@fixture.test',
      ),
    );
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
    await wait(() => container.textContent.includes('persetujuan pengelola masih diperlukan'));
    assert.equal(dom.location.hash, '#/login', 'Email terverifikasi belum cukup untuk login');
    api.db
      .prepare("UPDATE account_approvals SET status='approved',revision=revision+1 WHERE user_id=?")
      .run(pendingCustomer.id);
    await submit('.auth-card form');
    await wait(() => dom.location.hash === '#/');
    await route('/akun', () => container.querySelector('#account-tab-security'));
    assert.equal(container.querySelector('.account-trigger-name').textContent, 'Pembeli Website');
    const accountCenter = container.querySelector('.account-premium');
    assert.ok(accountCenter, 'Premium Account Center is visible for signed-in accounts');
    assert.match(accountCenter.querySelector('.account-premium-hero').textContent,
      /Halo, Pembeli Website/);
    assert.equal(accountCenter.querySelector('.account-tabs').getAttribute('aria-orientation'),
      'vertical');
    assert.equal(accountCenter.querySelectorAll('.account-menu a[href="#/admin"]').length, 0,
      'buyer cannot see the Admin route');
    assert.ok(accountCenter.querySelector('.account-premium-profile-main'));
    assert.ok(accountCenter.querySelector('.account-premium-profile-side'));
    assert.equal(container.querySelectorAll('.account-premium-shortcuts .account-premium-shortcut').length, 3,
      'Quick links are rendered after the account workspace, at full page width');
    await act(async () => {
      container.querySelector('#account-tab-calendar').click();
      await settle();
    });
    assert.match(container.querySelector('#account-panel-calendar').textContent,
      /Tidak ada tanggal perkiraan yang dibuat otomatis/);
    await act(async () => {
      container.querySelector('#account-tab-profile').click();
      await settle();
    });
    await fill('#account-phone', '0812abc');
    await submit('.account-phone-form');
    assert.match(container.querySelector('#account-phone-error').textContent, /nomor HP Indonesia/);
    assert.equal(requests.filter((request) => request.path === '/api/profile/phone').length, 0);
    await fill('#account-phone', '0812-3456-7890');
    await submit('.account-phone-form');
    await wait(() => container.querySelector('.account-phone-notice'));
    assert.equal(container.querySelector('#account-phone').value, '+6281234567890');
    assert.equal(
      api.db
        .prepare('SELECT phone FROM user_contact_phones WHERE user_id=?')
        .get(pendingCustomer.id).phone,
      '+6281234567890',
    );
    assert.match(
      container.querySelector('.account-phone-verification').textContent,
      /Nomor HP belum dikonfirmasi/,
    );
    await act(async () => {
      [...container.querySelectorAll('.account-phone-verification button')]
        .find((button) => button.textContent === 'Kirim kode ke WhatsApp')
        .click();
      await settle();
    });
    await wait(() => container.querySelector('#phone-otp'));
    assert.equal(whatsapp.length, 1);
    assert.equal(
      api.phoneVerification.contact(pendingCustomer.id).phoneVerified,
      false,
      'sending alone is not confirmation',
    );
    await fill('#phone-otp', whatsapp[0].code === '000000' ? '000001' : '000000');
    await submit('.account-phone-verification form');
    await wait(() => container.querySelector('.account-phone-verification [role=alert]'));
    assert.equal(api.phoneVerification.contact(pendingCustomer.id).phoneVerified, false);
    await fill('#phone-otp', whatsapp[0].code);
    await submit('.account-phone-verification form');
    await wait(() => container.querySelector('.account-phone-verification .is-confirmed'));
    assert.match(
      container.querySelector('.account-phone-verification').textContent,
      /Nomor HP terkonfirmasi/,
    );
    assert.equal(container.querySelector('#phone-otp'), null);
    assert.ok(container.querySelector('.account-phone-verification time'));
    api.identity.issue('verify', 'website@fixture.test', { id: pendingCustomer.id });
    await api.identity.flushMail();
    const signedInLink = mailToken();
    await act(async () => root.unmount());
    dom.history.replaceState(null, '', '/#/verifikasi-email?token=' + signedInLink);
    sessionDelay = 120;
    root = createRoot(container);
    await act(async () => {
      root.render(createElement(StrictMode, null, createElement(App)));
      await settle();
    });
    await wait(() => container.querySelector('#recovery-password'));
    assert.equal(container.querySelector('#recovery-password').disabled, false);
    assert.equal(
      container.querySelector('#verification-email'),
      null,
      'authenticated session startup must not discard the email link',
    );
    assert.equal(dom.location.hash, '#/verifikasi-email');
    sessionDelay = 0;
    await route('/akun', () => container.querySelector('#account-phone'));
    await route('/verifikasi-email', () =>
      container.textContent.includes('Email akun Anda sudah dikonfirmasi'),
    );
    assert.equal(container.querySelector('#recovery-password'), null);
    await route('/akun', () => container.querySelector('#account-phone'));
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9i0AAAAASUVORK5CYII=';
    const upload = async (file) =>
      act(async () => {
        const input = container.querySelector('#account-photo');
        const transfer = new dom.DataTransfer();
        transfer.items.add(file);
        input.files = transfer.files;
        input.dispatchEvent(new dom.Event('change', { bubbles: true }));
        await settle();
      });
    await upload(new dom.File(['text'], 'invalid.txt', { type: 'text/plain' }));
    assert.match(container.querySelector('#account-photo-error').textContent, /JPG, PNG/);
    assert.equal(requests.filter((x) => x.path === '/api/profile/photo').length, 0);
    await upload(
      new dom.File([Buffer.from(png.split(',')[1], 'base64')], 'profil.png', { type: 'image/png' }),
    );
    await wait(() => container.querySelector('.account-trigger img'));
    assert.equal(container.querySelector('.account-trigger img').getAttribute('src'), png);
    assert.equal(container.querySelector('.account-page-avatar img').getAttribute('src'), png);
    assert.equal(container.querySelector('.account-avatar-large img').getAttribute('src'), png);
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
    assert.ok(container.querySelector('.account-premium-hero .account-premium-role').textContent.includes('Admin'),
      'Admin profile displays the actual account role');
    assert.ok(container.querySelector('.account-premium .account-menu a[href="#/admin"]'),
      'Admin retains access to the admin dashboard');
    assert.equal(
      container.querySelector('#account-phone').value,
      '+6281234567890',
      'phone restored after account reload',
    );
    assert.match(
      container.querySelector('.account-phone-verification').textContent,
      /Nomor HP terkonfirmasi/,
    );
    assert.equal(
      container.querySelector('.account-trigger img').getAttribute('src'),
      png,
      'avatar restored after reload',
    );
    await act(async () => {
      container.querySelector('.account-avatar-card .photo-upload-remove').click();
      await settle();
    });
    await wait(() => !container.querySelector('.account-trigger img'));
    assert.equal(container.querySelector('.account-trigger-name').textContent, 'Pembeli Website');
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
    assert.equal(container.querySelector('.account-trigger-name').textContent, 'Guest');
    assert.equal(api.db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 0);
    // Several resend paths were exercised above; keep the real per-hour email limit in place.
    time += 3600001;
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
    await act(async () => {
      container.querySelector('.auth-register-again').click();
      await settle();
    });
    assert.equal(container.querySelector('#recovery-password'), null);
    assert.ok(container.querySelector('a[href="#/forgot-password"]'));
    await route('/verifikasi-email?token=' + activation, () =>
      container.querySelector('#recovery-password'),
    );
    // A full reload clears the secret from the URL. Recovery must offer a new link, not a dead input.
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => {
      root.render(createElement(StrictMode, null, createElement(App)));
      await settle();
    });
    await wait(() => container.querySelector('#verification-email'));
    assert.equal(container.querySelector('#recovery-password'), null);
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
