import { waitForAdmin } from './testUiReady.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement } from 'react';
import { createApp } from '../../server/app.js';

test('frontend: stok bersama, pembayaran ulang, admin pesanan/resi, kedaluwarsa, akses, dan halaman error', async () => {
  const api = createApp({ dbPath: ':memory:' });
  api.catalog.workflowEnabled = false; // Exercise compatibility with the earlier catalog-only API.
  const seed = JSON.parse(JSON.stringify(api.catalog.snapshot()));
  api.db.close();
  const group = seed.edits.find((entry) => entry.groupId === 'snack-pedas');
  const stockPhoto =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9i0AAAAASUVORK5CYII=';
  group.gallery = [{ src: stockPhoto, alt: 'Foto utama Balado' }];
  group.variants.find((entry) => entry.sizeValue === '62').gallery = [];
  const original = group.variants.find((entry) => entry.id === 'snack-pedas');
  group.variants.push({
    ...original,
    id: 'QA-PACK',
    packagingType: 'pack',
    unitsPerPackage: '6',
    price: '90000',
    oldPrice: '',
  });
  group.variants.push({
    ...original,
    id: 'QA-PACK-10',
    packagingType: 'pack',
    unitsPerPackage: '10',
    price: '150000',
    oldPrice: '',
  });
  group.variants.push({
    ...original,
    id: 'QA-DUS',
    packagingType: 'dus',
    unitsPerPackage: '24',
    packsPerBox: '4',
    price: '350000',
    oldPrice: '',
  });
  group.variants.push({
    ...original,
    id: 'QA-DUS-PLAIN',
    packagingType: 'dus',
    unitsPerPackage: '40',
    packsPerBox: '',
    price: '500000',
    oldPrice: '',
  });
  const server = await createServer({
    configFile: false,
    resolve: { preserveSymlinks: true },
    oxc: { jsx: { runtime: 'automatic' } },
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: 'custom',
    ssr: { external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'] },
  });
  const [{ default: App }, orderModel, workflow, catalog] = await Promise.all(
    [
      '/src/App.jsx',
      '/src/state/orderModel.js',
      '/src/state/frontendWorkflow.js',
      '/src/data/products.js',
    ].map((path) => server.ssrLoadModule(path)),
  );
  const dom = new Window({ url: 'http://localhost/#/admin/stok' });
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
  dom.scrollTo = () => {};
  dom.confirm = () => true;
  dom.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  dom.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  let catalogFailed = true;
  let profileRelease;
  let profileWrites = 0;
  globalThis.fetch = async (url) => {
    if (url === '/api/profile') {
      profileWrites++;
      return new Promise((resolve) => {
        profileRelease = resolve;
      });
    }
    return url === '/api/catalog'
      ? new Response(JSON.stringify(catalogFailed ? { error: 'Unavailable' } : seed), {
          status: catalogFailed ? 503 : 200,
        })
      : url === '/api/auth/me'
        ? new Response(
            JSON.stringify({
              user: {
                id: 'qa-admin',
                role: 'admin',
                name: 'Admin Uji',
                email: 'qa@example.test',
                address: '',
              },
            }),
          )
        : new Response('{}', { status: 404 });
  };
  const { createRoot } = await import('react-dom/client');
  const container = dom.document.createElement('div');
  dom.document.body.append(container);
  const root = createRoot(container);
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  const button = (text) =>
    [...container.querySelectorAll('button')].find((element) => element.textContent === text);
  const click = (element) =>
    act(async () => {
      assert.ok(element, 'control exists');
      element.click();
      await settle();
    });
  const fill = (selector, value) =>
    act(async () => {
      const element = container.querySelector(selector);
      assert.ok(element, selector);
      const prototype =
        element.tagName === 'TEXTAREA'
          ? dom.HTMLTextAreaElement.prototype
          : element.tagName === 'SELECT'
            ? dom.HTMLSelectElement.prototype
            : dom.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
      element.dispatchEvent(
        new dom.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }),
      );
      await settle();
    });
  const navigate = (route) =>
    act(async () => {
      const changed = new Promise((resolve) =>
        dom.addEventListener('hashchange', resolve, { once: true }),
      );
      dom.location.hash = route;
      await changed;
      await settle();
    });
  const stockCard = () =>
    [...container.querySelectorAll('.workflow-stock-card')].find(
      (card) => /Keripik Singkong Balado/.test(card.textContent) && /180g/.test(card.textContent),
    );
  const fillStockUnits = async (value) => {
    await fill('#stock-dus', '0');
    await fill('#stock-pack', '0');
    await fill('#stock-satuan', value);
  };
  const stockAmountText = () =>
    (
      stockCard().querySelector('.workflow-stock-amount') ||
      stockCard().querySelector('.workflow-stock-compact-total')
    ).textContent;
  const setStock = async (value) => {
    await navigate('/admin/stok');
    await click(stockCard().querySelector('button'));
    await fillStockUnits(value);
    await click(button('Simpan stok'));
  };
  const checkout = async () => {
    await click(container.querySelector('a[href="#/checkout"]'));
    await fill('#checkout-name', 'Pembeli Uji');
    await fill('#checkout-address', 'Alamat pengujian frontend lengkap');
    await click(
      [...container.querySelectorAll('.payment-group-options button')].find((element) =>
        element.textContent.endsWith('Virtual Account'),
      ),
    );
    await click(container.querySelector('input[value="va-bca"]'));
    await act(async () => {
      const changed = new Promise((resolve) =>
        dom.addEventListener('hashchange', resolve, { once: true }),
      );
      container.querySelector('.checkout-desktop-submit').click();
      await changed;
      await settle();
    });
  };
  try {
    await act(async () => {
      root.render(createElement(App));
      await settle();
    });
    await waitForAdmin(container, act);
    assert.match(container.querySelector('h1').textContent, /belum dapat dimuat/);
    catalogFailed = false;
    await click(button('Coba lagi'));
    await waitForAdmin(container, act);
    assert.ok(stockCard());
    assert.match(
      stockCard().querySelector('.workflow-stock-compact-total').textContent,
      /120 satuan/,
    );
    await click(container.querySelector('input[name="stock-layout"][value="full"]'));
    assert.equal(stockCard().querySelector('.workflow-stock-photo img').src, stockPhoto);
    const packagingRow = (sku) =>
      [...stockCard().querySelectorAll('.workflow-stock-packages > li')].find(
        (row) => row.querySelector('small').textContent === sku,
      );
    assert.equal(
      packagingRow('snack-pedas').querySelector('.workflow-stock-package-count').textContent,
      '120 satuan',
    );
    assert.equal(
      packagingRow('QA-PACK').querySelector('.workflow-stock-package-count').textContent,
      '20 pack',
    );
    assert.equal(
      packagingRow('QA-DUS').querySelector('.workflow-stock-package-count').textContent,
      '5 dus',
    );
    assert.equal(packagingRow('snack-pedas').querySelector('strong').textContent, 'Satuan');
    assert.equal(packagingRow('QA-PACK').querySelector('strong').textContent, 'Pack (6)');
    assert.equal(packagingRow('QA-DUS').querySelector('strong').textContent, 'Dus (24)');
    assert.equal(packagingRow('QA-DUS-PLAIN').querySelector('strong').textContent, 'Dus (40)');
    assert.equal(
      packagingRow('QA-DUS-PLAIN').querySelector('.workflow-stock-package-count').textContent,
      '3 dus',
    );
    const breakdownCounts = () =>
      [...stockCard().querySelectorAll('.workflow-stock-stat dd > strong')].map(
        (element) => element.textContent,
      );
    assert.deepEqual(breakdownCounts(), ['3', '0', '0']);
    await click(stockCard().querySelector('button'));
    await fillStockUnits('119');
    await click(button('Simpan stok'));
    assert.deepEqual(
      breakdownCounts(),
      ['2', '3', '9'],
      'summary divides shared stock, instead of showing three independent balances',
    );
    assert.match(stockAmountText(), /119/);
    assert.equal(
      packagingRow('QA-PACK-10').querySelector('.workflow-stock-package-count').textContent,
      '11 pack',
      'sale capacity is different from remaining packs in the breakdown',
    );
    assert.equal(
      packagingRow('QA-DUS-PLAIN').querySelector('.workflow-stock-package-count').textContent,
      '2 dus',
    );
    assert.equal(
      packagingRow('snack-pedas').querySelector('.workflow-stock-package-count').textContent,
      '119 satuan',
    );
    await click(stockCard().querySelector('button'));
    await fillStockUnits('120');
    await click(button('Simpan stok'));
    const noPhotoCard = [...container.querySelectorAll('.workflow-stock-card')].find(
      (card) =>
        /Keripik Singkong Balado/.test(card.textContent) && /62g per satuan/.test(card.textContent),
    );
    assert.ok(
      !noPhotoCard.querySelector('.workflow-stock-photo img'),
      'missing size photo never borrows a different size photo',
    );
    assert.ok(noPhotoCard.querySelector('.bam-product-fallback'));
    await fill('#admin-stock-search', 'QA-PACK');
    assert.equal(container.querySelectorAll('.workflow-stock-card').length, 1);
    assert.equal(stockCard().querySelector('.workflow-stock-photo img').src, stockPhoto);
    await fill('#admin-stock-search', '');
    await click(stockCard().querySelector('button'));
    const stockDialog = container.querySelector('dialog.workflow-stock-dialog[open]');
    assert.ok(stockDialog, 'stok diedit melalui pop-up tanpa memanjangkan daftar');
    assert.ok(stockDialog.querySelector('#stock-satuan'), 'isian satuan berada di dalam pop-up');
    assert.equal(
      stockDialog.querySelector('.workflow-stock-dialog-product .workflow-stock-photo img').src,
      stockPhoto,
      'foto produk yang diedit tetap ditampilkan di header pop-up',
    );
    assert.equal(
      stockCard().querySelector('.workflow-stock-package-editor'),
      null,
      'daftar stok tidak memuat form di dalam kartu produk',
    );
    await fillStockUnits('10');
    await click(button('Simpan stok'));
    assert.equal(
      packagingRow('QA-PACK').querySelector('.workflow-stock-package-count').textContent,
      '1 pack',
    );
    assert.equal(
      packagingRow('QA-DUS').querySelector('.workflow-stock-package-count').textContent,
      '0 dus',
    );
    assert.deepEqual(breakdownCounts(), ['0', '1', '0']);
    await navigate('/produk/QA-PACK');
    assert.match(container.querySelector('.detail-stock').textContent, /1 pack/);
    assert.equal(container.querySelector('button[aria-label="Tambah jumlah"]').disabled, true);
    await click(button('Beli sekarang'));
    await navigate('/produk/snack-pedas');
    for (let index = 0; index < 3; index++)
      await click(container.querySelector('button[aria-label="Tambah jumlah"]'));
    await click(button('Beli sekarang'));
    assert.equal(container.querySelectorAll('.cart-item').length, 2);
    await checkout();
    const first = orderModel.readOrders(dom.sessionStorage)[0];
    assert.equal(first.inventory[0].units, 10);
    assert.equal(first.status, 'awaiting_payment');
    await click(container.querySelector('.payment-continue'));
    assert.match(container.querySelector('h1').textContent, /Pembayaran pesanan/);
    await click(button('Simulasikan pembayaran gagal'));
    assert.match(container.querySelector('.payment-status').textContent, /gagal/);
    await click(button('Coba pembayaran simulasi kembali'));
    await click(button('Simulasikan pembayaran berhasil'));
    assert.equal(orderModel.readOrder(first.id, dom.sessionStorage).payment.status, 'paid');
    assert.equal(button('Simulasikan pembayaran berhasil'), undefined);
    await navigate('/admin/pesanan');
    await click(button('Kirim pesanan simulasi'));
    await click(button('Simpan status simulasi'));
    assert.match(
      container.querySelector('dialog [role="alert"]').textContent,
      /kurir dan nomor resi/,
    );
    await fill('#shipment-courier', 'Kurir Uji');
    await fill('#shipment-tracking', 'RESI-FRONTEND-123');
    await click(button('Simpan status simulasi'));
    await navigate('/pesanan');
    await click(button('Dikirim'));
    assert.equal(container.querySelectorAll('.orders-card').length, 1);
    await click(container.querySelector('.orders-card a[href^="#/pesanan/"]'));
    assert.match(container.querySelector('.workflow-shipment').textContent, /RESI-FRONTEND-123/);
    assert.equal(button('Batalkan pesanan').disabled, true);
    await navigate('/admin/pesanan');
    await click(button('Selesaikan pesanan simulasi'));
    await click(button('Simpan status simulasi'));
    await navigate('/pesanan');
    await click(button('Selesai'));
    assert.equal(container.querySelectorAll('.orders-card').length, 1);
    await setStock('12');
    await navigate('/produk/QA-PACK');
    await click(container.querySelector('button[aria-label="Tambah jumlah"]'));
    await click(button('Beli sekarang'));
    await checkout();
    const second = orderModel.readOrders(dom.sessionStorage)[0];
    await click(container.querySelector('.payment-continue'));
    await click(button('Simulasikan kedaluwarsa'));
    assert.equal(orderModel.readOrder(second.id, dom.sessionStorage).status, 'expired');
    assert.equal(button('Simulasikan pembayaran berhasil'), undefined);
    await navigate('/admin/stok');
    assert.match(stockAmountText(), /12/);
    await navigate('/produk/QA-PACK');
    await click(button('Beli sekarang'));
    await checkout();
    await click(button('Batalkan pesanan'));
    await click(button('Ya, batalkan pesanan'));
    assert.match(container.querySelector('h1').textContent, /dibatalkan/);
    const notifications = () => JSON.parse(dom.localStorage.getItem('bam.shop.v1')).notifications;
    assert.equal(
      notifications().length,
      9,
      'created, failed, paid, shipped, completed, expired and cancelled alerts reach the provider',
    );
    await navigate('/notifikasi');
    assert.equal(container.querySelectorAll('.notifications-panel .notification-item').length, 9);
    assert.match(container.querySelector('.notification-day h2').textContent, /Hari ini/);
    const notificationFilter = (label) =>
      [...container.querySelectorAll('.notification-filters button')].find(
        (element) => element.querySelector('span').textContent === label,
      );
    await click(notificationFilter('Pembayaran'));
    assert.equal(container.querySelectorAll('.notifications-panel .notification-item').length, 3);
    await fill('.notification-search input', first.id.slice(-8));
    assert.equal(container.querySelectorAll('.notifications-panel .notification-item').length, 2);
    await fill('.notification-search input', 'tidak-ada-notifikasi-ini');
    assert.match(
      container.querySelector('.notification-empty').textContent,
      /Tidak ada notifikasi yang cocok/,
    );
    await click(button('Tampilkan semua notifikasi'));
    await click(container.querySelector('.notification-mark-read'));
    assert.equal(notifications().filter((item) => !item.read).length, 8);
    assert.ok(container.querySelector('a[aria-label="Notifikasi, 8 belum dibaca"]'));
    await click(notificationFilter('Belum dibaca'));
    assert.equal(container.querySelectorAll('.notifications-panel .notification-item').length, 8);
    await click(button('Hapus yang sudah dibaca'));
    assert.ok(container.querySelector('dialog[open]'));
    await click(button('Kembali'));
    assert.equal(notifications().length, 9);
    await click(button('Hapus yang sudah dibaca'));
    await click(button('Ya, hapus notifikasi'));
    assert.equal(notifications().length, 8);
    assert.ok(notifications().every((item) => !item.read));
    await act(async () => {
      dom.dispatchEvent(new dom.Event('focus'));
      await settle();
    });
    assert.equal(
      notifications().length,
      8,
      'refreshing workflow does not restore deleted notifications',
    );
    const deletedId = notifications()[0].id;
    await click(container.querySelector('.notifications-panel .notification-item .shop-delete'));
    assert.equal(notifications().length, 7);
    await click(button('Urungkan hapus'));
    assert.equal(notifications().length, 8);
    assert.ok(notifications().some((item) => item.id === deletedId));
    await click(button('Tandai semua dibaca'));
    assert.match(container.querySelector('.notification-empty').textContent, /Semua sudah dibaca/);
    assert.equal(notifications().filter((item) => !item.read).length, 0);
    await click(notificationFilter('Semua'));
    const orderLink = container.querySelector('.notifications-panel .notification-item a');
    assert.ok(orderLink);
    await click(orderLink);
    assert.equal(
      container.querySelector('.notifications-panel'),
      null,
      'notification link opens its exact order',
    );
    await navigate('/notifikasi');
    await click(button('Hapus yang sudah dibaca'));
    await click(button('Ya, hapus notifikasi'));
    assert.match(
      container.querySelector('.notification-empty').textContent,
      /Belum ada notifikasi/,
    );
    assert.equal(orderModel.readOrders(dom.sessionStorage).length, 3);
    await navigate('/admin/stok');
    assert.match(stockAmountText(), /12/);
    await navigate('/produk/QA-PACK');
    await click(button('Beli sekarang'));
    await act(async () =>
      workflow.setAvailableStock(
        catalog.products.find((product) => product.id === 'QA-PACK'),
        0,
        dom.sessionStorage,
      ),
    );
    assert.match(container.querySelector('.cart-review').textContent, /Stok/);
    assert.equal(container.querySelector('a[href="#/checkout"]'), null);
    await click(button('Hapus dari keranjang'));
    assert.equal(container.querySelectorAll('.cart-item').length, 0);
    await navigate('/produk/%broken');
    assert.match(container.querySelector('h1').textContent, /Produk tidak ditemukan/);
    await navigate('/pesanan/%broken/pembayaran');
    assert.match(container.querySelector('h1').textContent, /Pesanan tidak ditemukan/);
    await navigate('/tidak-ada');
    assert.match(container.querySelector('h1').textContent, /Halaman tidak ditemukan/);
    await navigate('/akun');
    for (
      let attempt = 0;
      !container.querySelector('#account-tab-address') && attempt < 100;
      attempt++
    )
      await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    await click(container.querySelector('#account-tab-address'));
    await fill('#account-name', 'Nama baru');
    await fill('#account-address', 'Alamat baru untuk pengujian');
    dom.confirm = () => false;
    await navigate('/cari?q=balado');
    assert.equal(dom.location.hash, '#/akun');
    assert.equal(container.querySelector('#account-name').value, 'Nama baru');
    await click(container.querySelector('.skip-to-content'));
    assert.equal(dom.location.hash, '#/akun');
    const beforeProfile = dom.localStorage.getItem('bam.delivery.v1');
    await click(button('Simpan perubahan'));
    assert.equal(container.querySelector('#account-name').disabled, true);
    await navigate('/');
    assert.equal(dom.location.hash, '#/akun');
    await act(async () =>
      container
        .querySelector('.account-profile-card form')
        .dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true })),
    );
    assert.equal(profileWrites, 1);
    await act(async () => {
      profileRelease(new Response('{}', { status: 500 }));
      await settle();
    });
    assert.equal(container.querySelector('#account-name').value, 'Nama baru');
    assert.equal(dom.localStorage.getItem('bam.delivery.v1'), beforeProfile);
    assert.match(
      container.querySelector('.account-notice').textContent,
      /belum dapat dikonfirmasi/,
    );
    await click(button('Simpan perubahan'));
    await act(async () => {
      profileRelease(
        new Response(
          JSON.stringify({
            user: {
              id: 'qa-admin',
              role: 'admin',
              name: 'Nama baru',
              email: 'qa@example.test',
              address: 'Alamat baru untuk pengujian',
            },
          }),
        ),
      );
      await settle();
    });
    assert.match(container.querySelector('.account-notice').textContent, /berhasil diperbarui/);
    assert.match(dom.localStorage.getItem('bam.delivery.v1'), /Alamat baru/);
    dom.confirm = () => true;
    await navigate('/admin/produk');
    await click(button('+ Tambah produk'));
    await fill('#product-baseName', 'Isian sementara');
    dom.confirm = () => false;
    await navigate('/admin');
    assert.equal(dom.location.hash, '#/admin/produk');
    assert.equal(container.querySelector('#product-baseName').value, 'Isian sementara');
    dom.confirm = () => true;
    await navigate('/admin');
    assert.equal(container.querySelector('#product-baseName'), null);
    assert.equal(container.querySelector('h1').textContent, 'Dashboard Admin');
    assert.equal(dom.location.hash, '#/admin');
  } finally {
    await act(async () => root.unmount());
    await server.close();
    dom.happyDOM.abort();
    globalThis.fetch = previousFetch;
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.localStorage;
    delete globalThis.HTMLElement;
    delete globalThis.ResizeObserver;
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
