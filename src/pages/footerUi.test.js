import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement, StrictMode } from 'react';

test('footer: logo kembali ke atas, membuka beranda tanpa posisi lama, dan menghormati isian yang belum disimpan', async () => {
  const dom = new Window({ url: 'http://localhost/#/' });
  globalThis.window = dom; globalThis.document = dom.document; globalThis.HTMLElement = dom.HTMLElement;
  Object.defineProperty(globalThis, 'navigator', { value: dom.navigator, configurable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const server = await createServer({ configFile: false, resolve: { preserveSymlinks: true }, oxc: { jsx: { runtime: 'automatic' } }, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom', ssr: { external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'] } });
  const { default: Footer } = await server.ssrLoadModule('/src/components/layout/StoreFooter.jsx');
  const navigation = await server.ssrLoadModule('/src/state/shopNavigation.js');
  const { default: useUnsavedChanges } = await server.ssrLoadModule('/src/state/useUnsavedChanges.js');
  const { createRoot } = await import('react-dom/client');
  const container = dom.document.createElement('div'); dom.document.body.append(container);
  const root = createRoot(container);
  const scrollCalls = []; dom.scrollTo = (options) => scrollCalls.push(options);
  let reducedMotion = false; dom.matchMedia = () => ({ matches: reducedMotion });
  let accepted = false; let confirmations = 0;
  dom.confirm = () => { confirmations += 1; return accepted; };
  const unsubscribe = navigation.subscribeShopRoute(() => {});
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  const logo = () => container.querySelector('.store-footer-brand');
  const routeTo = (route) => { dom.history.replaceState(null, '', '#' + route); dom.dispatchEvent(new dom.HashChangeEvent('hashchange')); };
  function UnsavedForm() { useUnsavedChanges(true); return createElement('input', { defaultValue: 'Alamat yang belum disimpan' }); }
  const render = (dirty = false) => act(async () => {
    root.render(createElement('main', { id: 'main-content', tabIndex: -1 }, dirty && createElement(UnsavedForm), createElement(Footer)));
    await settle();
  });
  try {
    await render();
    await act(async () => { logo().click(); await settle(); });
    assert.deepEqual(scrollCalls.pop(), { top: 0, left: 0, behavior: 'smooth' });
    assert.equal(dom.location.hash, '#/');
    assert.equal(dom.document.activeElement.id, 'main-content', 'keyboard focus returns to the page content');
    reducedMotion = true;
    await act(async () => { logo().click(); await settle(); });
    assert.equal(scrollCalls.pop().behavior, 'instant', 'reduced motion disables the scroll animation');
    for (const modifier of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey']) {
      const click = new dom.MouseEvent('click', { bubbles: true, cancelable: true, [modifier]: true });
      await act(async () => { logo().dispatchEvent(click); await settle(); });
      assert.equal(click.defaultPrevented, false, `${modifier} preserves the ordinary link action`);
      assert.equal(scrollCalls.length, 0);
    }

    Object.defineProperty(dom, 'scrollY', { value: 720, configurable: true });
    routeTo('/produk/snack-pedas');
    assert.equal(navigation.shopRouteSnapshot().productReturnTo, '/');
    routeTo('/');
    assert.equal(navigation.shopRouteSnapshot().restoreY, 720, 'the normal product Back action retains the home position');
    routeTo('/produk/snack-pedas');
    await act(async () => { logo().click(); await settle(); });
    assert.equal(navigation.shopRouteSnapshot().route, '/');
    assert.equal(navigation.shopRouteSnapshot().restoreY, 0, 'the logo opens the top instead of the previous home position');

    routeTo('/checkout');
    await render(true);
    container.querySelector('input').focus();
    await act(async () => { logo().click(); await settle(); });
    assert.equal(confirmations, 1);
    assert.equal(navigation.shopRouteSnapshot().route, '/checkout');
    assert.equal(dom.location.hash, '#/checkout');
    assert.equal(container.querySelector('input').value, 'Alamat yang belum disimpan');
    assert.equal(dom.document.activeElement, container.querySelector('input'));
    assert.equal(scrollCalls.length, 0, 'declining navigation keeps the page position');
    accepted = true;
    await act(async () => { logo().click(); await settle(); });
    assert.equal(confirmations, 2, 'accepted navigation asks once, without a second confirmation');
    assert.equal(navigation.shopRouteSnapshot().route, '/');
    assert.equal(navigation.shopRouteSnapshot().restoreY, 0);
  } finally {
    unsubscribe(); await act(async () => root.unmount()); await server.close(); dom.happyDOM.abort();
    delete globalThis.window; delete globalThis.document; delete globalThis.HTMLElement; delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});

test('footer: profil Bryan memuat avatar tanpa portofolio, tutup/Escape/backdrop, dan pemulihan fokus serta scroll', async () => {
  const server = await createServer({ configFile: false, resolve: { preserveSymlinks: true }, oxc: { jsx: { runtime: 'automatic' } }, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom', ssr: { external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'] } });
  const { default: Footer } = await server.ssrLoadModule('/src/components/layout/StoreFooter.jsx');
  const dom = new Window({ url: 'http://localhost/#/' });
  globalThis.window = dom; globalThis.document = dom.document; globalThis.HTMLElement = dom.HTMLElement;
  Object.defineProperty(globalThis, 'navigator', { value: dom.navigator, configurable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  dom.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  dom.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  dom.document.body.style.overflow = 'scroll';
  const { createRoot } = await import('react-dom/client');
  const container = dom.document.createElement('div'); dom.document.body.append(container);
  const root = createRoot(container);
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  const credit = () => container.querySelector('button[aria-label="Lihat profil Bryan"]');
  const dialog = () => container.querySelector('dialog');
  const open = () => act(async () => { credit().focus(); credit().click(); await settle(); });
  const closed = () => {
    assert.equal(dialog(), null);
    assert.equal(credit().getAttribute('aria-expanded'), 'false');
    assert.equal(dom.document.activeElement, credit(), 'closing restores keyboard focus to the credit');
    assert.equal(dom.document.body.style.overflow, 'scroll', 'the previous page scroll setting is restored');
  };
  try {
    await act(async () => { root.render(createElement(StrictMode, null, createElement(Footer))); await settle(); });
    assert.equal(container.querySelectorAll('.store-footer-inner nav').length, 2);
    assert.ok(container.querySelector('a[href="#/bantuan"]'));
    assert.ok(container.querySelector('a[href="#/pembatalan"]'));
    assert.equal(dialog(), null, 'the dialog and image are not loaded until requested');
    await open();
    assert.equal(dialog().open, true);
    assert.equal(credit().getAttribute('aria-controls'), dialog().id);
    assert.equal(credit().getAttribute('aria-expanded'), 'true');
    assert.equal(dom.document.getElementById(dialog().getAttribute('aria-labelledby')).textContent, 'Bryan');
    assert.equal(dialog().querySelector('img').alt, 'Avatar pilihan Bryan');
    assert.match(dialog().querySelector('img').getAttribute('src'), /creator-bryan\.jpg/);
    assert.equal(dialog().querySelectorAll('a').length, 0, 'the requested profile has no portfolio or social links');
    assert.equal(dom.document.body.style.overflow, 'hidden');
    assert.equal(dom.document.activeElement.getAttribute('aria-label'), 'Tutup profil Bryan');
    await act(async () => { dialog().querySelector('.creator-profile-close').click(); await settle(); }); closed();

    await open();
    await act(async () => { dialog().querySelector('.creator-profile-done').click(); await settle(); }); closed();

    await open();
    const cancel = new dom.Event('cancel', { cancelable: true });
    await act(async () => { dialog().dispatchEvent(cancel); await settle(); });
    assert.equal(cancel.defaultPrevented, true); closed();

    await open();
    dialog().getBoundingClientRect = () => ({ left: 20, right: 280, top: 20, bottom: 420 });
    await act(async () => {
      dialog().querySelector('h2').dispatchEvent(new dom.PointerEvent('pointerdown', { bubbles: true, clientX: 60, clientY: 60 }));
      dialog().dispatchEvent(new dom.MouseEvent('click', { bubbles: true, clientX: 0, clientY: 0 }));
      await settle();
    });
    assert.equal(dialog().open, true, 'a gesture beginning inside the profile must not dismiss it');
    await act(async () => {
      dialog().dispatchEvent(new dom.PointerEvent('pointerdown', { bubbles: true, clientX: 0, clientY: 0 }));
      dialog().dispatchEvent(new dom.MouseEvent('click', { bubbles: true, clientX: 0, clientY: 0 }));
      await settle();
    }); closed();

    await open();
    await act(async () => { dialog().querySelector('img').dispatchEvent(new dom.Event('error')); await settle(); });
    assert.equal(dialog().querySelector('img'), null);
    assert.equal(dialog().querySelector('[role="img"]').textContent, 'B', 'a failed image keeps a usable profile');
    await act(async () => root.unmount());
    assert.equal(dom.document.body.style.overflow, 'scroll', 'unmounting an open profile cannot leave the page locked');
  } finally {
    await act(async () => root.unmount()); await server.close(); dom.happyDOM.abort();
    delete globalThis.window; delete globalThis.document; delete globalThis.HTMLElement; delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
