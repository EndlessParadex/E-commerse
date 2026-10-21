import { waitForAdmin } from './testUiReady.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement } from 'react';
import { createApp, hashPassword } from '../../server/app.js';

test('frontend server: impor stok, checkout yang responsnya terputus, pembatalan, perangkat baru, batas akun dan admin pembayaran/resi', async () => {
  const demo = createApp({ dbPath: ':memory:' });
  const catalog = demo.catalog.snapshot();
  demo.db.close();
  let serverTime = Date.now();
  const api = createApp({
    dbPath: ':memory:',
    installMode: 'company',
    legacyCommerceFixture: true,
    now: () => serverTime,
  });
  api.catalog.save({ ...catalog, revision: 0 });
  const candidate = api.catalog.snapshot();
  const group = candidate.edits.find((row) => row.groupId === 'snack-pedas');
  const unit = group.variants.find((row) => row.id === 'snack-pedas');
  group.variants.push({
    ...unit,
    id: 'SERVER-PACK',
    packagingType: 'pack',
    unitsPerPackage: '10',
    price: '150000',
    oldPrice: '',
  });
  group.variants.push({
    ...unit,
    id: 'SERVER-DUS',
    packagingType: 'dus',
    unitsPerPackage: '40',
    price: '500000',
    oldPrice: '',
  });
  api.catalog.save(candidate);
  const stockKey = `${group.groupId}:${unit.sizeValue}-${unit.sizeUnit}`;
  const password = 'fixture-password-2026';
  for (const [id, role] of [
    ['admin', 'admin'],
    ['alice', 'user'],
    ['bob', 'user'],
  ])
    api.db
      .prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)')
      .run(
        id,
        'Akun ' + id,
        id + '@fixture.test',
        'Alamat lengkap akun ' + id,
        await hashPassword(password),
        new Date().toISOString(),
        role,
      );
  api.db.exec(
    'INSERT OR REPLACE INTO auth_account_state(user_id,verified_at) SELECT id,1 FROM users',
  );
  const settings = api.company.snapshot();
  api.company.save({
    ...settings,
    profile: {
      ...settings.profile,
      bankName: 'Bank Fixture',
      bankAccount: '12345678',
      bankHolder: 'Fixture Company',
    },
  });
  async function request(method, path, body, cookie = '') {
    const req = Readable.from(body ? [body] : []);
    req.method = method;
    req.url = path;
    req.headers = {
      host: 'backend.test',
      origin: 'http://backend.test',
      'content-type': 'application/json',
      cookie,
    };
    let status;
    let headers;
    let value;
    await api.handler(req, {
      writeHead(code, responseHeaders) {
        status = code;
        headers = responseHeaders;
      },
      end(data) {
        value = Buffer.isBuffer(data) ? data : JSON.parse(data);
      },
    });
    return { status, headers, ok: status >= 200 && status < 300, json: async () => value };
  }
  let cookie = '';
  let loseResponse = false;
  let offline = false;
  let failOrders = false;
  let holdSearch = '';
  let releaseSearch;
  const previousFetch = globalThis.fetch;
  const sentKeys = [];
  const dom = new Window({ url: 'http://backend.test/#/admin/stok' });
  globalThis.window = dom;
  globalThis.document = dom.document;
  globalThis.HTMLElement = dom.HTMLElement;
  globalThis.ResizeObserver = dom.ResizeObserver;
  globalThis.FileReader = dom.FileReader;
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
  globalThis.fetch = async (path, options = {}) => {
    if (offline && ['/api/inventory', '/api/admin/inventory'].includes(path))
      throw new Error('offline');
    if (failOrders && path.startsWith('/api/admin/orders'))
      return {
        ok: false,
        status: 503,
        json: async () => ({ errors: { form: 'Daftar pesanan sedang terganggu.' } }),
      };
    const response = await request(options.method || 'GET', path, options.body, cookie);
    if (holdSearch && path.includes('q=' + holdSearch))
      await new Promise((resolve) => {
        releaseSearch = resolve;
      });
    if (response.headers['set-cookie']) cookie = response.headers['set-cookie'].split(';')[0];
    if (path === '/api/orders' && options.method === 'POST') {
      sentKeys.push(JSON.parse(options.body).requestKey);
      if (loseResponse) {
        loseResponse = false;
        throw new Error('respons koneksi terputus setelah server menyimpan');
      }
    }
    return response;
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
    const [{ default: App }, workflow, company] = await Promise.all(
      ['/src/App.jsx', '/src/state/serverWorkflow.js', '/src/data/companyStore.js'].map((path) =>
        vite.ssrLoadModule(path),
      ),
    );
    const { createRoot } = await import('react-dom/client');
    const container = dom.document.createElement('div');
    dom.document.body.append(container);
    const settle = () => new Promise((resolve) => setTimeout(resolve, 35));
    const wait = async (check) => {
      const until = Date.now() + 5000;
      while (!check() && Date.now() < until) await act(settle);
      assert.ok(check(), container.textContent.slice(-2000));
    };
    const navigate = async (path) =>
      act(async () => {
        dom.location.hash = path;
        dom.dispatchEvent(new dom.HashChangeEvent('hashchange'));
        await settle();
      });
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
        const element = container.querySelector(selector);
        assert.ok(element);
        Object.getOwnPropertyDescriptor(dom.HTMLInputElement.prototype, 'value').set.call(
          element,
          value,
        );
        element.dispatchEvent(new dom.Event('input', { bubbles: true }));
        await settle();
      });
    async function mountAs(id, path, oldStock = false) {
      if (root) await act(async () => root.unmount());
      dom.localStorage.clear();
      dom.sessionStorage.clear();
      const login = await request(
        'POST',
        '/api/auth/login',
        JSON.stringify({ email: id + '@fixture.test', password }),
      );
      assert.equal(login.status, 200);
      cookie = login.headers['set-cookie'].split(';')[0];
      if (oldStock)
        dom.sessionStorage.setItem(
          'bam.stock.preview.v1.company.' + api.company.snapshot().instanceId,
          JSON.stringify({ [stockKey]: 119 }),
        );
      dom.location.hash = path;
      dom.dispatchEvent(new dom.HashChangeEvent('hashchange'));
      root = createRoot(container);
      await act(async () => {
        root.render(createElement(App));
        await settle();
      });
      await act(settle);
      await waitForAdmin(container, act);
    }
    await mountAs('admin', '/admin/stok', true);
    await click(button('Periksa stok lama untuk impor'));
    await click(button('Impor angka stok ini'));
    assert.equal(api.workflow.stock().stock[stockKey].available, 119);
    assert.match(container.textContent, /telah diimpor ke database/);
    assert.equal(button('Periksa stok lama untuk impor'), undefined);
    await mountAs('alice', '/produk/SERVER-PACK');
    assert.equal(container.querySelector('.detail-buy').disabled, false);
    assert.equal(container.querySelector('.detail-stock-remaining').textContent, '11 pack');
    assert.equal(container.querySelector('.detail-sold-count'), null);
    await click(container.querySelector('.detail-buy'));
    assert.equal(dom.location.hash, '#/keranjang');
    await navigate('/checkout');
    await click(
      [...container.querySelectorAll('.payment-group-options button')].find((entry) =>
        entry.textContent.includes('Transfer bank'),
      ),
    );
    const submit = () =>
      act(async () => {
        container
          .querySelector('#checkout-form')
          .dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true }));
        await settle();
      });
    loseResponse = true;
    await submit();
    assert.ok(container.querySelector('#checkout-form'));
    assert.match(container.textContent, /Periksa Pesanan saya/);
    assert.equal(api.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 1);
    assert.equal(api.workflow.stock().stock[stockKey].available, 119);
    await submit();
    assert.equal(sentKeys.length, 2);
    assert.equal(sentKeys[0], sentKeys[1]);
    assert.equal(api.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 1);
    const saved = api.workflow.list({ id: 'alice', role: 'user' }).orders[0];
    assert.equal(saved.total, 150000);
    assert.equal(saved.items[0].details.packaging.unitsPerPackage, 10);
    assert.equal(dom.location.hash, '#/pesanan/' + saved.id);
    // The browser dispatches hashchange after the request resolves; wait for the
    // confirmation to render rather than treating a fixed 35 ms delay as ready.
    const confirmationDeadline = Date.now() + 2000;
    while (!container.querySelector('.confirmation-hero') && Date.now() < confirmationDeadline)
      await act(settle);
    assert.match(container.textContent, /di server pada akun Anda/);
    assert.equal(
      dom.sessionStorage.getItem(company.companyStorageKey('bam.orders.v1')),
      null,
      'riwayat pesanan utama tidak ditulis pada tab',
    );
    await navigate('/pesanan/' + saved.id + '/pembayaran');
    assert.equal(button('Simulasikan pembayaran berhasil'), undefined);
    assert.match(container.textContent, /Toko memeriksa stok dan ongkir/);
    await navigate('/produk/SERVER-PACK');
    assert.equal(container.querySelector('.detail-stock-remaining').textContent, '11 pack');
    assert.equal(container.querySelector('.detail-stock-reserved'), null);
    assert.equal(container.querySelector('.detail-sold-count'), null);
    await navigate('/pesanan/' + saved.id);
    await click(button('Batalkan pesanan'));
    await click(button('Ya, batalkan pesanan'));
    assert.equal(api.workflow.get({ id: 'alice', role: 'user' }, saved.id).status, 'cancelled');
    assert.equal(api.workflow.stock().stock[stockKey].available, 119);
    assert.equal(api.workflow.stock().stock[stockKey].reservedUnits, 0);
    assert.equal(api.workflow.stock().stock[stockKey].soldUnits, 0);
    await mountAs('alice', '/pesanan');
    assert.equal(container.querySelectorAll('.orders-card').length, 1);
    assert.match(container.textContent, /Dibatalkan/);
    await mountAs('bob', '/pesanan');
    assert.equal(container.querySelectorAll('.orders-card').length, 0);
    await navigate('/pesanan/' + saved.id);
    assert.match(container.textContent, /tidak ditemukan/);
    assert.doesNotMatch(container.textContent, /Alamat lengkap akun alice/);
    const bobOrder = api.workflow.create(
      { id: 'bob', role: 'user' },
      {
        requestKey: randomUUID(),
        recipient: 'Penerima Bob',
        address: 'Alamat milik Bob lengkap',
        shippingId: 'regular',
        paymentId: 'manual-transfer',
        note: '',
        items: [{ id: 'SERVER-PACK', quantity: 1, expectedPrice: 150000 }],
      },
    );
    await mountAs('admin', '/admin/pesanan');
    assert.equal(container.querySelectorAll('.workflow-order-card').length, 2);
    await click(button('Setujui untuk pembayaran'));
    await fill('#quote-shipping-cost', '10000');
    await fill('#quote-courier', 'Kurir fixture');
    await click(button('Simpan perubahan'));
    assert.equal(
      api.workflow.get({ id: 'bob', role: 'user' }, bobOrder.id).status,
      'awaiting_acceptance',
    );
    await mountAs('bob', '/pesanan/' + bobOrder.id);
    await click(button('Setujui dan lanjutkan pembayaran'));
    assert.match(container.querySelector('.commerce-bank').textContent, /12345678/);
    await act(async () => {
      const input = container.querySelector('.commerce-upload input');
      const bytes = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9i0AAAAASUVORK5CYII=',
        'base64',
      );
      Object.defineProperty(input, 'files', {
        configurable: true,
        value: [new dom.File([bytes], 'bukti.png', { type: 'image/png' })],
      });
      input.dispatchEvent(new dom.Event('change', { bubbles: true }));
      await settle();
    });
    const proofDeadline = Date.now() + 3000;
    while (
      api.workflow.get({ id: 'bob', role: 'user' }, bobOrder.id).payment.status !==
        'proof_submitted' &&
      Date.now() < proofDeadline
    )
      await act(settle);
    assert.equal(
      api.workflow.get({ id: 'bob', role: 'user' }, bobOrder.id).payment.status,
      'proof_submitted',
      container.querySelector('.payment-details').textContent,
    );
    assert.match(container.querySelector('.payment-details').textContent, /sedang diperiksa/);
    assert.ok(container.querySelector('.order-invoice').textContent.includes(bobOrder.id));
    const invoice = container.querySelector('.order-invoice');
    assert.match(invoice.textContent, /Informasi pembayaran/);
    assert.match(invoice.textContent, /Dikirim kepada/);
    assert.match(invoice.textContent, /RINCIAN PESANAN/);
    // This fixture is an existing manual-transfer order awaiting staff verification, not COD.
    assert.match(invoice.textContent, /Transfer bank toko/);
    assert.match(invoice.textContent, /Belum dikonfirmasi dibayar/);
    assert.ok(invoice.querySelector('.invoice-items thead'));
    assert.equal(invoice.querySelector('.invoice-items thead').textContent.includes('SKU'), false);
    assert.equal(invoice.querySelector('.invoice-items thead').textContent.includes('No.'), true);
    assert.equal(invoice.querySelector('.invoice-product small'), null);
    assert.equal(
      invoice.querySelector('.invoice-summary').textContent.includes('Ongkos kirim'),
      false,
    );
    assert.equal(
      invoice.querySelector('.invoice-summary').textContent.includes('Total pembayaran'),
      true,
    );
    assert.ok(invoice.querySelector('.invoice-grand-total'));
    assert.equal(invoice.querySelectorAll('.invoice-items tbody tr').length, bobOrder.items.length);
    await mountAs('admin', '/admin/pesanan');
    assert.ok(button('Minta perbaikan bukti'));
    assert.ok(
      [...container.querySelectorAll('a')].some((a) => a.textContent === 'Periksa bukti transfer'),
    );

    assert.equal(
      api.workflow.get({ id: 'bob', role: 'user' }, bobOrder.id).status,
      'awaiting_payment',
    );
    await click(button('Catat pembayaran manual'));
    await click(button('Simpan perubahan'));
    assert.match(
      container.querySelector('[role=alert]').textContent,
      /Referensi pembayaran manual/,
    );
    await fill('#payment-reference', 'BANK-BOB-001');
    await click(button('Simpan perubahan'));
    assert.equal(api.workflow.get({ id: 'bob', role: 'user' }, bobOrder.id).payment.status, 'paid');
    await click(button('Catat pengiriman'));
    await fill('#shipment-courier', 'JNE');
    await fill('#shipment-tracking', 'RESI-BOB-001');
    await click(button('Simpan perubahan'));
    await click(button('Selesaikan pesanan'));
    await click(button('Simpan perubahan'));
    assert.equal(api.workflow.get({ id: 'bob', role: 'user' }, bobOrder.id).status, 'completed');
    assert.equal(api.workflow.stock().stock[stockKey].available, 109);
    await navigate('/produk/SERVER-PACK');
    assert.equal(container.querySelector('.detail-sold-count').textContent, '10 satuan terjual');
    assert.equal(container.querySelector('.detail-stock-remaining').textContent, '10 pack');
    assert.equal(container.querySelector('.detail-stock-reserved'), null);
    await navigate('/');
    const soldCard = [...container.querySelectorAll('.product-card')].find((card) =>
      card.textContent.includes('Keripik Singkong Balado'),
    );
    assert.equal(
      soldCard.querySelector('.product-sold-count').textContent,
      '10 satuan terjual',
      'SKU pack/dus dengan stok bersama tidak menggandakan jumlah terjual',
    );
    await navigate('/pesanan');
    assert.equal(
      container.querySelectorAll('.orders-card').length,
      0,
      'pesanan saya pada admin hanya berisi pesanan admin sendiri',
    );
    await mountAs('bob', '/pesanan/' + bobOrder.id);
    assert.match(container.textContent, /RESI-BOB-001/);
    assert.match(container.textContent, /Selesai/);
    const codInput = {
      requestKey: randomUUID(),
      recipient: 'Penerima COD',
      address: 'Alamat lengkap penerima COD',
      shippingId: 'regular',
      paymentId: 'cod',
      items: [{ id: unit.id, quantity: 1, expectedPrice: Number(unit.price) }],
    };
    const codOrder = api.workflow.create({ id: 'bob', role: 'user' }, codInput);
    await act(async () => {
      await workflow.refreshServerWorkflow();
      await settle();
    });
    await navigate('/pesanan/' + codOrder.id);
    assert.match(
      container.querySelector('.confirmation-hero').textContent,
      /menunggu konfirmasi toko/,
    );
    assert.match(
      container.querySelector('.payment-details').textContent,
      /Toko memeriksa stok dan ongkir/,
    );
    assert.equal(container.querySelector('.payment-continue'), null);
    assert.match(
      container.querySelector('.order-tracking-summary').textContent,
      /Menunggu konfirmasi COD/,
    );
    await navigate('/pesanan');
    await click(button('Aktif'));
    assert.match(container.querySelector('.orders-card').textContent, /Menunggu konfirmasi COD/);
    await click(button('Menunggu konfirmasi COD'));
    assert.equal(container.querySelectorAll('.orders-card').length, 1);
    await mountAs('admin', '/admin/pesanan');
    assert.equal(button('Catat pengiriman'), undefined);
    await click(button('Konfirmasi COD'));
    await fill('#quote-shipping-cost', '10000');
    await fill('#quote-courier', 'Kurir fixture');
    assert.match(
      container.querySelector('dialog[open]').textContent,
      /Pembayaran tetap dilakukan saat barang diterima/,
    );
    await click(button('Simpan perubahan'));
    assert.equal(
      api.workflow.get({ id: 'bob', role: 'user' }, codOrder.id).status,
      'awaiting_acceptance',
    );
    await mountAs('bob', '/pesanan/' + codOrder.id);
    await click(button('Setujui total COD'));
    await mountAs('admin', '/admin/pesanan');
    assert.equal(api.workflow.get({ id: 'bob', role: 'user' }, codOrder.id).status, 'processing');
    assert.ok(button('Catat pengiriman'));
    api.workflow.update({ id: 'bob', role: 'user' }, codOrder.id, {
      action: 'cancel',
      revision: api.workflow.get({ id: 'bob', role: 'user' }, codOrder.id).revision,
      reason: 'Pengujian selesai',
    });
    const expiredCOD = api.workflow.create(
      { id: 'bob', role: 'user' },
      { ...codInput, requestKey: randomUUID() },
    );
    serverTime += 7 * 86400000;
    api.workflow.tick();
    await mountAs('bob', '/pesanan/' + expiredCOD.id);
    assert.match(
      container.querySelector('.confirmation-hero').textContent,
      /Batas konfirmasi COD telah berakhir/,
    );
    assert.match(
      container.querySelector('.payment-details').textContent,
      /Batas waktu pesanan berakhir/,
    );
    assert.equal(container.querySelector('.payment-continue'), null);
    assert.equal(api.workflow.stock().stock[stockKey].available, 109);
    offline = true;
    await act(async () => {
      await workflow.refreshServerWorkflow();
      await settle();
    });
    await navigate('/produk/SERVER-PACK');
    assert.equal(container.querySelector('.detail-buy').disabled, true);
    assert.equal(
      container.querySelector('.detail-stock-remaining').textContent,
      'Belum dapat diperiksa',
    );
    assert.equal(container.querySelector('.detail-sold-count'), null);
    offline = false;
    await act(async () => {
      await workflow.refreshServerWorkflow();
      await settle();
    });
    assert.equal(container.querySelector('.detail-buy').disabled, false);
    const lastStock = api.workflow.stock().stock[stockKey];
    api.workflow.setStock(
      { id: 'admin', role: 'admin' },
      { key: stockKey, available: 5, revision: lastStock.revision },
    );
    await act(async () => {
      await workflow.refreshServerWorkflow();
      await settle();
    });
    assert.equal(container.querySelector('.detail-stock-remaining').textContent, '0 pack');
    assert.equal(container.querySelector('.detail-buy').disabled, true);
    await navigate('/produk/snack-pedas');
    assert.equal(container.querySelector('.detail-stock-remaining').textContent, '5 satuan');
    assert.equal(container.querySelector('.detail-sold-count'), null);

    // Old orders must be searchable without manually loading every preceding page.
    const oldBase = api.workflow.get({ id: 'bob', role: 'user' }, bobOrder.id);
    for (let index = 0; index < 61; index++) {
      const record = {
        ...oldBase,
        id: 'OLD-' + String(index).padStart(3, '0'),
        createdAt: serverTime - 86400000 * 30 + index,
        recipient: 'Penerima Lawas ' + index,
      };
      api.db
        .prepare('INSERT INTO orders VALUES(?,?,?,?,?,?,?,?)')
        .run(
          record.id,
          'bob',
          randomUUID(),
          'fixture',
          record.createdAt,
          record.status,
          record.revision,
          JSON.stringify(record),
        );
    }
    await mountAs('admin', '/admin/pesanan');
    await wait(() => container.querySelectorAll('.workflow-order-card').length === 50);
    assert.doesNotMatch(container.querySelector('.workflow-order-list').textContent, /OLD-000/);
    await fill('#admin-order-search', 'Penerima Lawas 0');
    await wait(
      () =>
        container.querySelectorAll('.workflow-order-card').length === 1 &&
        container.querySelector('.workflow-order-card h3')?.textContent === 'OLD-000',
    );
    assert.equal(button('Muat pesanan lebih lama'), undefined);
    await fill('#admin-order-search', 'OLD-');
    await wait(() => container.querySelectorAll('.workflow-order-card').length === 50);
    assert.match(container.querySelector('.admin-result-pill').textContent, /61 pesanan/);
    await click(button('Muat pesanan lebih lama'));
    await wait(() => container.querySelectorAll('.workflow-order-card').length === 61);
    await act(async () => {
      await workflow.refreshServerWorkflow();
      await settle();
    });
    await wait(() => container.querySelectorAll('.workflow-order-card').length === 61);
    // Release an older search after a newer one; the older response must be discarded.
    holdSearch = 'OLD-000';
    await fill('#admin-order-search', 'OLD-000');
    await wait(() => releaseSearch);
    holdSearch = '';
    await fill('#admin-order-search', 'OLD-001');
    await wait(() => container.querySelector('.workflow-order-card h3')?.textContent === 'OLD-001');
    await act(async () => {
      releaseSearch();
      await settle();
    });
    assert.equal(container.querySelector('.workflow-order-card h3').textContent, 'OLD-001');
    await mountAs('bob', '/pesanan');
    await fill('#buyer-order-search', 'OLD-000');
    await wait(
      () =>
        container.querySelectorAll('.orders-card').length === 1 &&
        container.querySelector('.orders-number')?.textContent === 'OLD-000',
    );
    await mountAs('alice', '/pesanan');
    await fill('#buyer-order-search', 'OLD-000');
    await wait(() => container.textContent.includes('Belum ada pesanan pada pilihan ini'));
    assert.equal(container.querySelector('#buyer-order-search').value, 'OLD-000');
    assert.equal(container.querySelectorAll('.orders-card').length, 0);
    failOrders = true;
    await mountAs('admin', '/admin/stok');
    assert.ok(
      container.querySelector('.workflow-stock-card'),
      'an order endpoint failure must not hide stock',
    );
    await navigate('/admin/pesanan');
    await wait(() => container.textContent.includes('Daftar pesanan sedang terganggu.'));
    failOrders = false;
    await click(button('Coba lagi'));
    await wait(() => container.querySelectorAll('.workflow-order-card').length === 50);
  } finally {
    releaseSearch?.();
    if (root) await act(async () => root.unmount());
    await vite.close();
    api.db.close();
    globalThis.fetch = previousFetch;
    dom.happyDOM.abort();
  }
});
