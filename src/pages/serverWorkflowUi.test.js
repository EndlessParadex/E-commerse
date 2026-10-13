import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement } from 'react';
import { createApp, hashPassword } from '../../server/app.js';

test('frontend server: impor stok, checkout yang responsnya terputus, pembatalan, perangkat baru, batas akun dan admin pembayaran/resi', async () => {
  const demo = createApp({ dbPath: ':memory:' }); const catalog = demo.catalog.snapshot(); demo.db.close();
  const api = createApp({ dbPath: ':memory:', installMode: 'company' }); api.catalog.save({ ...catalog, revision: 0 });
  const candidate = api.catalog.snapshot(); const group = candidate.edits.find((row) => row.groupId === 'snack-pedas'); const unit = group.variants.find((row) => row.id === 'snack-pedas');
  group.variants.push({ ...unit, id: 'SERVER-PACK', packagingType: 'pack', unitsPerPackage: '10', price: '150000', oldPrice: '' });
  group.variants.push({ ...unit, id: 'SERVER-DUS', packagingType: 'dus', unitsPerPackage: '40', price: '500000', oldPrice: '' }); api.catalog.save(candidate);
  const stockKey = `${group.groupId}:${unit.sizeValue}-${unit.sizeUnit}`; const password = 'fixture-password-2026';
  for (const [id, role] of [['admin', 'admin'], ['alice', 'user'], ['bob', 'user']]) api.db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)').run(id, 'Akun ' + id, id + '@fixture.test', 'Alamat lengkap akun ' + id, await hashPassword(password), new Date().toISOString(), role);
  async function request(method, path, body, cookie = '') {
    const req = Readable.from(body ? [body] : []); req.method = method; req.url = path; req.headers = { host: 'backend.test', origin: 'http://backend.test', 'content-type': 'application/json', cookie };
    let status; let headers; let value;
    await api.handler(req, { writeHead(code, responseHeaders) { status = code; headers = responseHeaders; }, end(data) { value = Buffer.isBuffer(data) ? data : JSON.parse(data); } });
    return { status, headers, ok: status >= 200 && status < 300, json: async () => value };
  }
  let cookie = ''; let loseResponse = false; let offline = false; const previousFetch = globalThis.fetch; const sentKeys = [];
  const dom = new Window({ url: 'http://backend.test/#/admin/stok' });
  globalThis.window = dom; globalThis.document = dom.document; globalThis.HTMLElement = dom.HTMLElement; globalThis.ResizeObserver = dom.ResizeObserver;
  Object.defineProperty(globalThis, 'navigator', { value: dom.navigator, configurable: true }); Object.defineProperty(globalThis, 'localStorage', { value: dom.localStorage, configurable: true }); globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  dom.scrollTo = () => {}; dom.confirm = () => true; dom.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); }; dom.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  globalThis.fetch = async (path, options = {}) => {
    if (offline && path === '/api/inventory') throw new Error('offline');
    const response = await request(options.method || 'GET', path, options.body, cookie);
    if (response.headers['set-cookie']) cookie = response.headers['set-cookie'].split(';')[0];
    if (path === '/api/orders' && options.method === 'POST') {
      sentKeys.push(JSON.parse(options.body).requestKey);
      if (loseResponse) { loseResponse = false; throw new Error('respons koneksi terputus setelah server menyimpan'); }
    }
    return response;
  };
  const vite = await createServer({ configFile: false, resolve: { preserveSymlinks: true }, oxc: { jsx: { runtime: 'automatic' } }, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom', ssr: { external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'] } });
  let root;
  try {
    const [{ default: App }, workflow, company] = await Promise.all(['/src/App.jsx', '/src/state/serverWorkflow.js', '/src/data/companyStore.js'].map((path) => vite.ssrLoadModule(path)));
    const { createRoot } = await import('react-dom/client'); const container = dom.document.createElement('div'); dom.document.body.append(container);
    const settle = () => new Promise((resolve) => setTimeout(resolve, 35));
    const navigate = async (path) => act(async () => { dom.location.hash = path; dom.dispatchEvent(new dom.HashChangeEvent('hashchange')); await settle(); });
    const button = (label) => [...container.querySelectorAll('button')].find((entry) => entry.textContent.trim() === label);
    const click = async (element) => { assert.ok(element); await act(async () => { element.click(); await settle(); }); };
    const fill = async (selector, value) => act(async () => { const element = container.querySelector(selector); assert.ok(element); Object.getOwnPropertyDescriptor(dom.HTMLInputElement.prototype, 'value').set.call(element, value); element.dispatchEvent(new dom.Event('input', { bubbles: true })); await settle(); });
    async function mountAs(id, path, oldStock = false) {
      if (root) await act(async () => root.unmount());
      dom.localStorage.clear(); dom.sessionStorage.clear();
      const login = await request('POST', '/api/auth/login', JSON.stringify({ email: id + '@fixture.test', password })); assert.equal(login.status, 200); cookie = login.headers['set-cookie'].split(';')[0];
      if (oldStock) dom.sessionStorage.setItem('bam.stock.preview.v1.company.' + api.company.snapshot().instanceId, JSON.stringify({ [stockKey]: 119 }));
      dom.location.hash = path; dom.dispatchEvent(new dom.HashChangeEvent('hashchange')); root = createRoot(container);
      await act(async () => { root.render(createElement(App)); await settle(); }); await act(settle);
    }
    await mountAs('admin', '/admin/stok', true);
    await click(button('Periksa stok lama untuk impor')); await click(button('Impor angka stok ini'));
    assert.equal(api.workflow.stock().stock[stockKey].available, 119); assert.match(container.textContent, /telah diimpor ke database/);
    assert.equal(button('Periksa stok lama untuk impor'), undefined);
    await mountAs('alice', '/produk/SERVER-PACK'); assert.equal(container.querySelector('.detail-buy').disabled, false);
    await click(container.querySelector('.detail-buy')); assert.equal(dom.location.hash, '#/keranjang'); await navigate('/checkout');
    await click([...container.querySelectorAll('.payment-group-options button')].find((entry) => entry.textContent.includes('Virtual Account')));
    const submit = () => act(async () => { container.querySelector('#checkout-form').dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })); await settle(); });
    loseResponse = true; await submit(); assert.ok(container.querySelector('#checkout-form')); assert.match(container.textContent, /Periksa Pesanan saya/); assert.equal(api.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 1);
    assert.equal(api.workflow.stock().stock[stockKey].available, 109);
    await submit(); assert.equal(sentKeys.length, 2); assert.equal(sentKeys[0], sentKeys[1]); assert.equal(api.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 1);
    const saved = api.workflow.list({ id: 'alice', role: 'user' }).orders[0]; assert.equal(saved.total, 160000); assert.equal(saved.items[0].details.packaging.unitsPerPackage, 10);
    assert.equal(dom.location.hash, '#/pesanan/' + saved.id);
    // The browser dispatches hashchange after the request resolves; wait for the
    // confirmation to render rather than treating a fixed 35 ms delay as ready.
    const confirmationDeadline = Date.now() + 2000;
    while (!container.querySelector('.confirmation-hero') && Date.now() < confirmationDeadline) await act(settle);
    assert.match(container.textContent, /di server pada akun Anda/);
    assert.equal(dom.sessionStorage.getItem(company.companyStorageKey('bam.orders.v1')), null, 'riwayat pesanan utama tidak ditulis pada tab');
    await navigate('/pesanan/' + saved.id + '/pembayaran'); assert.equal(button('Simulasikan pembayaran berhasil'), undefined); assert.match(container.textContent, /Menunggu pembayaran dicatat/);
    await navigate('/pesanan/' + saved.id); await click(button('Batalkan pesanan')); await click(button('Ya, batalkan pesanan'));
    assert.equal(api.workflow.get({ id: 'alice', role: 'user' }, saved.id).status, 'cancelled'); assert.equal(api.workflow.stock().stock[stockKey].available, 119);
    await mountAs('alice', '/pesanan'); assert.equal(container.querySelectorAll('.orders-card').length, 1); assert.match(container.textContent, /Dibatalkan/);
    await mountAs('bob', '/pesanan'); assert.equal(container.querySelectorAll('.orders-card').length, 0); await navigate('/pesanan/' + saved.id); assert.match(container.textContent, /tidak ditemukan/); assert.doesNotMatch(container.textContent, /Alamat lengkap akun alice/);
    const bobOrder = api.workflow.create({ id: 'bob', role: 'user' }, { requestKey: randomUUID(), recipient: 'Penerima Bob', address: 'Alamat milik Bob lengkap', shippingId: 'regular', paymentId: 'va-bca', note: '', items: [{ id: 'SERVER-PACK', quantity: 1, expectedPrice: 150000 }] });
    await mountAs('admin', '/admin/pesanan'); assert.equal(container.querySelectorAll('.workflow-order-card').length, 2);
    await click(button('Catat pembayaran manual')); await click(button('Simpan perubahan')); assert.match(container.querySelector('[role=alert]').textContent, /Referensi pembayaran manual/);
    await fill('#payment-reference', 'BANK-BOB-001'); await click(button('Simpan perubahan')); assert.equal(api.workflow.get({ id: 'bob', role: 'user' }, bobOrder.id).payment.status, 'paid');
    await click(button('Catat pengiriman')); await fill('#shipment-courier', 'JNE'); await fill('#shipment-tracking', 'RESI-BOB-001'); await click(button('Simpan perubahan'));
    await click(button('Selesaikan pesanan')); await click(button('Simpan perubahan')); assert.equal(api.workflow.get({ id: 'bob', role: 'user' }, bobOrder.id).status, 'completed'); assert.equal(api.workflow.stock().stock[stockKey].available, 109);
    await navigate('/pesanan'); assert.equal(container.querySelectorAll('.orders-card').length, 0, 'pesanan saya pada admin hanya berisi pesanan admin sendiri');
    await mountAs('bob', '/pesanan/' + bobOrder.id); assert.match(container.textContent, /RESI-BOB-001/); assert.match(container.textContent, /Selesai/);
    offline = true; await act(async () => { await workflow.refreshServerWorkflow(); await settle(); }); await navigate('/produk/SERVER-PACK'); assert.equal(container.querySelector('.detail-buy').disabled, true);
    offline = false; await act(async () => { await workflow.refreshServerWorkflow(); await settle(); }); assert.equal(container.querySelector('.detail-buy').disabled, false);
  } finally { if (root) await act(async () => root.unmount()); await vite.close(); api.db.close(); globalThis.fetch = previousFetch; dom.happyDOM.abort(); }
});
