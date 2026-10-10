import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement, StrictMode } from 'react';
import postcss from 'postcss';
import { appearanceStorageKey } from '../state/appearanceModel.js';

test('tampilan akun: perubahan langsung, muat ulang, mengikuti perangkat, pergantian akun, reset, dan form alamat tetap terjaga', async () => {
  const dom = new Window({ url: 'http://localhost/#/akun' });
  globalThis.window = dom; globalThis.document = dom.document; globalThis.HTMLElement = dom.HTMLElement;
  Object.defineProperty(globalThis, 'navigator', { value: dom.navigator, configurable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const listeners = new Set();
  const media = { matches: false, addEventListener: (_, listener) => listeners.add(listener), removeEventListener: (_, listener) => listeners.delete(listener) };
  dom.matchMedia = () => media;
  const page = dom.document.documentElement;
  page.setAttribute('data-theme', 'previous-theme'); page.setAttribute('data-background', 'previous-background');
  const server = await createServer({ configFile: false, resolve: { preserveSymlinks: true }, oxc: { jsx: { runtime: 'automatic' } }, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom', ssr: { external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'] } });
  const [{ default: AppearanceProvider }, { default: AccountPage }, { DeliveryContext }] = await Promise.all(['/src/state/AppearanceProvider.jsx', '/src/pages/AccountPage.jsx', '/src/state/useDelivery.js'].map((path) => server.ssrLoadModule(path)));
  const { createRoot } = await import('react-dom/client');
  const container = dom.document.createElement('div'); dom.document.body.append(container);
  let root = createRoot(container);
  let user = { id: 'first', name: 'Akun Pertama', email: 'first@example.com', address: 'Alamat pertama' };
  let saves = 0;
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  const render = () => act(async () => { root.render(createElement(StrictMode, null, createElement(DeliveryContext.Provider, { value: { user, savedLocation: { namaToko: user?.name, namaJalan: user?.address }, saveLocation: async () => { saves++; return { ok: true }; } } }, createElement(AppearanceProvider, null, createElement(AccountPage))))); await settle(); });
  const openTab = (id) => act(async () => { container.querySelector(`#account-tab-${id}`).click(); await settle(); assert.equal(container.querySelector(`#account-panel-${id}`).hidden, false); });
  const choose = async (name, value) => { await openTab('appearance'); await act(async () => { const radio = container.querySelector(`input[name="${name}"][value="${value}"]`); assert.ok(radio); radio.click(); await settle(); assert.equal(radio.checked, true); }); };
  const changedSystem = (dark) => act(async () => { media.matches = dark; listeners.forEach((listener) => listener()); await settle(); });
  const current = () => ({ mode: page.getAttribute('data-theme'), background: page.getAttribute('data-background') });
  const saved = (owner) => JSON.parse(dom.localStorage.getItem(appearanceStorageKey(owner)));
  try {
    await render();
    assert.deepEqual(current(), { mode: 'light', background: 'default' });
    assert.equal(container.querySelector('.account-page-avatar').textContent, 'A');
    assert.equal(container.querySelector('.account-avatar-large').textContent, 'A');
    assert.equal(container.querySelector('#account-tab-profile').getAttribute('aria-selected'), 'true');
    assert.equal(container.querySelectorAll('[role="tabpanel"]:not([hidden])').length, 1);
    assert.match(container.querySelector('.account-biodata').textContent, /first@example.com/);
    for (const [key, id] of [['ArrowLeft', 'appearance'], ['Home', 'profile'], ['ArrowRight', 'address'], ['End', 'appearance']]) {
      await act(async () => { container.querySelector('[role="tab"][aria-selected="true"]').dispatchEvent(new dom.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); await settle(); });
      const selected = container.querySelector(`#account-tab-${id}`);
      assert.equal(selected.getAttribute('aria-selected'), 'true'); assert.equal(dom.document.activeElement, selected);
      assert.equal(container.querySelectorAll('[role="tab"][tabindex="0"]').length, 1);
      assert.equal(container.querySelector(`#account-panel-${id}`).hidden, false);
    }
    assert.equal(container.querySelector('input[type="file"]'), null, 'the profile remains a plain initial');
    assert.equal(container.querySelectorAll('.appearance-settings fieldset').length, 2);
    assert.ok(container.querySelector('input[value="dark"]').closest('label').textContent.includes('Gelap'));
    await openTab('address');
    const address = container.querySelector('#account-address');
    await act(async () => { const setter = Object.getOwnPropertyDescriptor(dom.HTMLTextAreaElement.prototype, 'value').set; setter.call(address, 'Alamat baru belum disimpan'); address.dispatchEvent(new dom.Event('input', { bubbles: true })); await settle(); });
    await choose('appearance-mode', 'dark'); await choose('appearance-background', 'lavender');
    assert.deepEqual(current(), { mode: 'dark', background: 'lavender' });
    assert.deepEqual(saved('user:first'), { mode: 'dark', background: 'lavender' });
    assert.equal(address.value, 'Alamat baru belum disimpan'); assert.equal(saves, 0);
    assert.ok(container.querySelector('#account-tab-address .account-draft-dot'));
    await openTab('profile'); await openTab('address');
    assert.equal(container.querySelector('#account-address'), address, 'tab changes keep the same draft form');
    assert.equal(address.value, 'Alamat baru belum disimpan');
    await openTab('appearance');
    assert.match(container.querySelector('.appearance-notice').textContent, /tersimpan di perangkat ini/);
    assert.equal(user.address, 'Alamat pertama', 'appearance does not save or overwrite the address');
    let confirmations = 0; dom.confirm = () => { confirmations++; return false; };
    await act(async () => { container.querySelector('a[href="#/pesanan"]').click(); await settle(); });
    assert.equal(confirmations, 1, 'appearance does not clear the existing unsaved address guard');
    assert.equal(dom.location.hash, '#/akun');

    await changedSystem(false); assert.equal(current().mode, 'dark');
    await choose('appearance-mode', 'system'); assert.equal(current().mode, 'light');
    await changedSystem(true); assert.equal(current().mode, 'dark');
    await choose('appearance-mode', 'light'); await changedSystem(true); assert.equal(current().mode, 'light');
    await choose('appearance-mode', 'dark');
    await act(async () => root.unmount());
    assert.deepEqual(current(), { mode: 'previous-theme', background: 'previous-background' });
    assert.equal(listeners.size, 0);
    root = createRoot(container); await render();
    assert.deepEqual(current(), { mode: 'dark', background: 'lavender' }, 'saved choice survives a remount');
    assert.equal(container.querySelector('#account-address').value, 'Alamat pertama');

    user = { id: 'second', name: 'Budi', email: 'second@example.com', address: 'Alamat kedua' }; await render();
    assert.deepEqual(current(), { mode: 'light', background: 'default' });
    assert.equal(container.querySelector('.appearance-notice'), null);
    await choose('appearance-background', 'mint');
    assert.deepEqual(saved('user:second'), { mode: 'light', background: 'mint' });
    user = null; await render();
    assert.deepEqual(current(), { mode: 'light', background: 'default' });
    assert.equal(container.querySelector('.appearance-settings'), null);
    user = { id: 'first', name: 'Akun Pertama', email: 'first@example.com', address: 'Alamat pertama' }; await render();
    assert.deepEqual(current(), { mode: 'dark', background: 'lavender' });
    dom.localStorage.setItem(appearanceStorageKey('user:second'), JSON.stringify({ mode: 'dark', background: 'sky' }));
    await act(async () => { dom.dispatchEvent(new dom.StorageEvent('storage', { key: appearanceStorageKey('user:second'), storageArea: dom.localStorage })); await settle(); });
    assert.deepEqual(current(), { mode: 'dark', background: 'lavender' }, 'another account cannot change the current appearance');
    dom.localStorage.setItem(appearanceStorageKey('user:first'), JSON.stringify({ mode: 'system', background: 'sky' }));
    await act(async () => { dom.dispatchEvent(new dom.StorageEvent('storage', { key: appearanceStorageKey('user:first'), storageArea: dom.localStorage })); await settle(); });
    assert.deepEqual(current(), { mode: 'dark', background: 'sky' }, 'a same-account change in another tab is applied');
    await act(async () => { container.querySelector('.appearance-reset').click(); await settle(); });
    assert.deepEqual(current(), { mode: 'light', background: 'default' });
    assert.deepEqual(saved('user:second'), { mode: 'dark', background: 'sky' }, 'reset affects only this account');
    assert.equal(container.querySelector('.appearance-reset').disabled, true);

    const storage = dom.localStorage;
    Object.defineProperty(dom, 'localStorage', { configurable: true, get() { throw new Error('Storage blocked'); } });
    await choose('appearance-mode', 'dark');
    assert.equal(current().mode, 'dark');
    assert.match(container.querySelector('.appearance-notice').textContent, /belum tersimpan/);
    assert.deepEqual(JSON.parse(storage.getItem(appearanceStorageKey('user:first'))), { mode: 'light', background: 'default' });
    Object.defineProperty(dom, 'localStorage', { configurable: true, value: storage });
  } finally {
    await act(async () => root.unmount()); await server.close(); dom.happyDOM.abort();
    delete globalThis.window; delete globalThis.document; delete globalThis.HTMLElement; delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});

test('tema gelap: teks utama, pendukung, tautan dan status tetap kontras pada latar yang tersedia', async () => {
  const values = {};
  const css = postcss.parse(await readFile(new URL('../styles/themes.css', import.meta.url), 'utf8'));
  css.walkRules((rule) => { if (rule.selector === ':root' || rule.selector === ':root[data-theme="dark"]') rule.walkDecls((declaration) => { values[declaration.prop] = declaration.value; }); });
  const resolve = (name) => values[name].startsWith('var(') ? resolve(values[name].slice(4, -1)) : values[name];
  const luminance = (hex) => hex.slice(1, 7).match(/../g).map((part) => parseInt(part, 16) / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
  const contrast = (first, second) => { const values = [luminance(first), luminance(second)].sort((a, b) => b - a); return (values[0] + .05) / (values[1] + .05); };
  for (const background of ['#0e1726', '#0b1d2a', '#1b152a', '#0f211d', resolve('--color-surface'), resolve('--color-surface-tint'), resolve('--color-info-soft')]) {
    for (const name of ['--color-text', '--color-text-muted', '--color-text-secondary', '--color-link', '--color-info-text']) assert.ok(contrast(resolve(name), background) >= 4.5, `${name} on ${background} must remain legible`);
  }
  for (const status of ['info', 'notice', 'success', 'warning', 'danger']) assert.ok(contrast(resolve(`--color-${status}-text`), resolve(`--color-${status}-soft`)) >= 4.5, `${status} status must remain legible`);
});
