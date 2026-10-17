import { waitForAdmin } from './testUiReady.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement } from 'react';
import { createApp, hashPassword } from '../../server/app.js';

test('perusahaan: halaman kosong, pengaturan tersimpan, logo tampil, guard isian, katalog pertama dan stok 0 tanpa impor demo', async () => {
  const api = createApp({ dbPath: ':memory:', installMode: 'company', legacyCommerceFixture: true });
  const demo = createApp({ dbPath: ':memory:' });
  const seed = demo.catalog.snapshot();
  demo.db.close();
  api.db
    .prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)')
    .run(
      'owner',
      'Admin Perusahaan',
      'owner@test.id',
      'Alamat lengkap pemilik',
      await hashPassword('owner-test-password'),
      new Date().toISOString(),
      'admin',
    );
  async function request(method, path, body, cookie = '') {
    const req = Readable.from(body ? [body] : []);
    req.method = method;
    req.url = path;
    req.headers = {
      host: 'company.test',
      origin: 'http://company.test',
      'content-type': 'application/json',
      cookie,
    };
    let status;
    let headers;
    let data;
    await api.handler(req, {
      writeHead(code, value) {
        status = code;
        headers = value;
      },
      end(value) {
        data = JSON.parse(value);
      },
    });
    return { status, headers, ok: status >= 200 && status < 300, json: async () => data };
  }
  const login = await request(
    'POST',
    '/api/auth/login',
    JSON.stringify({ email: 'owner@test.id', password: 'owner-test-password' }),
  );
  const cookie = login.headers['set-cookie'].split(';')[0];
  const dom = new Window({ url: 'http://company.test/#/admin' });
  const oldFetch = globalThis.fetch;
  globalThis.window = dom;
  globalThis.document = dom.document;
  globalThis.HTMLElement = dom.HTMLElement;
  globalThis.FileReader = dom.FileReader;
  globalThis.ResizeObserver = dom.ResizeObserver;
  Object.defineProperty(globalThis, 'navigator', { value: dom.navigator, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', {
    value: dom.localStorage,
    configurable: true,
  });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  dom.scrollTo = () => {};
  dom.confirm = () => false;
  dom.localStorage.setItem(
    'bam.admin.catalog.v1',
    JSON.stringify({ version: 2, masters: seed.masters, edits: seed.edits }),
  );
  dom.localStorage.setItem(
    'bam.shop.v1',
    JSON.stringify({
      cart: [{ id: 'snack-pedas', quantity: 2 }],
      favoriteIds: ['snack-pedas'],
      notifications: [],
    }),
  );
  dom.sessionStorage.setItem('bam.orders.v1', '{corrupt old demo history}');
  let failSave = false;
  globalThis.fetch = async (path, options = {}) => {
    if (failSave && path === '/api/admin/company')
      return {
        ok: false,
        status: 500,
        json: async () => ({ errors: { form: 'Server percobaan offline' } }),
      };
    return request(options.method || 'GET', path, options.body, cookie);
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
    const [{ default: App }, adminStore, catalog, masters, companyStore, workflow] =
      await Promise.all(
        [
          '/src/App.jsx',
          '/src/data/adminStore.js',
          '/src/data/products.js',
          '/src/data/catalogMasters.js',
          '/src/data/companyStore.js',
          '/src/state/frontendWorkflow.js',
        ].map((path) => vite.ssrLoadModule(path)),
      );
    const { createRoot } = await import('react-dom/client');
    const container = dom.document.createElement('div');
    dom.document.body.append(container);
    root = createRoot(container);
    const settle = () => new Promise((resolve) => setTimeout(resolve, 30));
    await act(async () => {
      root.render(createElement(App));
      await settle();
    });
    await act(settle);
    await waitForAdmin(container, act);
    assert.equal(catalog.products.length, 0);
    assert.equal(adminStore.pendingLocalImport, false);
    assert.match(container.textContent, /Siapkan katalog perusahaan Anda/);
    assert.equal(container.querySelectorAll('.admin-metric strong')[0].textContent, '0');
    assert.ok((await adminStore.importLocalCatalog()).storageError);
    const route = async (path) => {
      await act(async () => {
        dom.location.hash = path;
        dom.dispatchEvent(new dom.HashChangeEvent('hashchange'));
        await settle();
      });
    };
    await route('/admin/perusahaan');
    assert.ok(container.querySelector('#company-shortName'));
    assert.equal(container.querySelector('#company-shortName').value, 'Toko Anda');
    const change = async (id, value) =>
      act(async () => {
        const input = container.querySelector('#' + id);
        const prototype =
          input.tagName === 'TEXTAREA'
            ? dom.HTMLTextAreaElement.prototype
            : dom.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value);
        input.dispatchEvent(new dom.Event('input', { bubbles: true }));
        await settle();
      });
    await change('company-shortName', 'Toko Baru');
    await change('company-legalName', 'PT Perusahaan Baru');
    await change('company-address', 'Jl. Perusahaan Baru No. 9');
    await change('company-email', 'bantuan@baru.id');
    await act(async () => {
      container.querySelector('.admin-store-link').click();
      await settle();
    });
    assert.equal(dom.location.hash, '#/admin/perusahaan');
    assert.equal(container.querySelector('#company-shortName').value, 'Toko Baru');
    failSave = true;
    const submit = () =>
      act(async () => {
        container
          .querySelector('.company-settings-form')
          .dispatchEvent(new dom.Event('submit', { bubbles: true, cancelable: true }));
        await settle();
      });
    await submit();
    assert.match(container.querySelector('[role=alert]').textContent, /offline/);
    assert.equal(container.querySelector('#company-shortName').value, 'Toko Baru');
    assert.equal(api.company.snapshot().profile.shortName, 'Toko Anda');
    const png =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9i0AAAAASUVORK5CYII=';
    const fileInput = container.querySelector('#company-logo');
    let pickerOpened = 0;
    fileInput.addEventListener('click', (event) => {
      event.preventDefault();
      pickerOpened++;
    });
    assert.equal(fileInput.hidden, true, 'pemilih bawaan tidak menduplikasi tombol unggah');
    await act(async () => {
      container.querySelector('.company-upload-button').click();
      await settle();
    });
    assert.equal(pickerOpened, 1, 'tombol unggah membuka pemilih file');
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [new dom.File(['text'], 'bukan-logo.txt', { type: 'text/plain' })],
    });
    await act(async () => {
      fileInput.dispatchEvent(new dom.Event('change', { bubbles: true }));
      await settle();
    });
    assert.match(container.querySelector('#company-error-logo').textContent, /JPG, PNG, atau WebP/);
    assert.equal(container.querySelector('.company-logo-preview img'), null);
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [new dom.File([Buffer.from(png, 'base64')], 'logo.png', { type: 'image/png' })],
    });
    await act(async () => {
      fileInput.dispatchEvent(new dom.Event('change', { bubbles: true }));
      await settle();
    });
    assert.ok(container.querySelector('.company-logo-preview img'));
    assert.equal(container.querySelector('#company-error-logo'), null);
    for (const [id, expected] of [
      ['codEnabled', false],
      ['showSoldCount', true],
      ['showExactStock', false],
    ]) {
      await act(async () => {
        container.querySelector(`label[for="company-${id}"]`).click();
        await settle();
      });
      assert.equal(
        container.querySelector(`#company-${id}`).checked,
        expected,
        'seluruh label dapat dipilih',
      );
    }
    await change('company-bankName', 'Bank Contoh');
    await change('company-bankAccount', '0012345678');
    await change('company-bankHolder', 'PT Perusahaan Baru');
    failSave = false;
    await submit();
    assert.match(container.querySelector('[role=status]').textContent, /tersimpan di server/);
    assert.equal(api.company.snapshot().profile.shortName, 'Toko Baru');
    assert.equal(api.company.snapshot().profile.codEnabled, false);
    assert.equal(api.company.snapshot().profile.showSoldCount, true);
    assert.equal(api.company.snapshot().profile.showExactStock, false);
    assert.equal(api.company.snapshot().profile.bankAccount, '0012345678');
    assert.equal(
      container.querySelector('.admin-sidebar-caption').textContent,
      'PT Perusahaan Baru',
    );
    await route('/');
    for (const selector of ['.navbar-logo', '.store-footer-brand', '.bam-promo-brand']) {
      const brand = container.querySelector(selector);
      assert.ok(brand.querySelector('img'), 'gambar perusahaan tetap ditampilkan');
      assert.match(
        brand.textContent,
        /Toko Baru/,
        'nama toko tetap terbaca meskipun memakai gambar',
      );
    }
    assert.match(container.querySelector('.store-footer').textContent, /bantuan@baru.id/);
    assert.match(container.querySelector('.bam-promo-brand').textContent, /PT Perusahaan Baru/);
    assert.match(dom.document.title, /Toko Baru/);
    await act(async () => {
      container.querySelector('.navbar-logo img').dispatchEvent(new dom.Event('error'));
      await settle();
    });
    assert.match(
      container.querySelector('.navbar-logo').textContent,
      /Toko Baru/,
      'nama toko tetap tampil jika gambar gagal dimuat',
    );
    assert.equal(container.querySelector('.navbar-logo img'), null);
    assert.equal(container.querySelector('.product-card'), null);
    assert.ok(dom.localStorage.getItem('bam.shop.v1').includes('snack-pedas'));
    await route('/admin');
    let supplier;
    let category;
    let brand;
    await act(async () => {
      supplier = await adminStore.saveMaster('suppliers', {
        id: '',
        name: 'PT Baru',
        initials: 'PB',
        color: 'sky',
        logo: '',
      });
      assert.ok(supplier.id, JSON.stringify(supplier));
      category = await adminStore.saveMaster('categories', {
        id: '',
        name: 'Kategori Baru',
        icon: '📦',
        children: [{ id: '', name: 'Umum' }],
      });
      assert.ok(category.id, JSON.stringify(category));
      brand = await adminStore.saveMaster('brands', {
        id: '',
        name: 'Merek Baru',
        supplierIds: [supplier.id],
      });
      assert.ok(brand.id, JSON.stringify(brand));
      const result = await adminStore.saveProduct({
        groupId: '',
        baseName: 'Produk Pertama',
        brand: 'Merek Baru',
        brandId: brand.id,
        supplierId: supplier.id,
        categoryId: category.id,
        subcategoryId: masters.masterSnapshot().categories[0].children[0].id,
        description: 'Produk pertama milik perusahaan baru.',
        color: 'sky',
        image: '',
        imageAlt: '',
        gallery: [],
        variants: [
          {
            id: 'PRODUK-1',
            sizeValue: '1',
            sizeUnit: 'pcs',
            price: '5000',
            oldPrice: '',
            packagingType: 'satuan',
            unitsPerPackage: '1',
            packsPerBox: '',
          },
        ],
      });
      assert.ok(result.groupId, JSON.stringify(result));
      await settle();
    });
    assert.equal(api.catalog.snapshot().edits.length, 1);
    assert.equal(catalog.products.length, 1);
    assert.equal(companyStore.companySnapshot().profile.shortName, 'Toko Baru');
    assert.equal(workflow.availableStock(catalog.products[0], dom.sessionStorage), 0);
    await route('/admin/stok');
    assert.match(container.textContent, /Stok tersimpan di database/);
    assert.equal(container.querySelector('.workflow-stock-amount strong').textContent, '0');
    await act(async () => {
      await adminStore.initializeCatalog();
      await settle();
    });
    assert.equal(catalog.products.length, 1);
    assert.equal(adminStore.pendingLocalImport, false);
    await route('/admin/perusahaan');
    assert.equal(container.querySelector('#company-shortName').value, 'Toko Baru');
    assert.equal(container.querySelector('#company-codEnabled').checked, false);
    assert.equal(container.querySelector('#company-showSoldCount').checked, true);
    assert.equal(container.querySelector('#company-showExactStock').checked, false);
    assert.equal(container.querySelector('#company-bankAccount').value, '0012345678');
    await act(async () => {
      const removeLogo = [...container.querySelectorAll('.company-settings-form button')].find(
        (button) => button.textContent === 'Hapus logo',
      );
      assert.ok(removeLogo, 'tindakan Hapus logo tersedia pada formulir perusahaan');
      removeLogo.click();
      await settle();
    });
    assert.ok(
      !container.querySelector('.company-logo-preview img'),
      'logo hilang setelah Hapus logo dipilih',
    );
    await submit();
    assert.equal(api.company.snapshot().profile.logo, '');
    await route('/');
    assert.match(container.querySelector('.navbar-logo').textContent, /Toko Baru/);
  } finally {
    if (root) await act(async () => root.unmount());
    await vite.close();
    api.db.close();
    globalThis.fetch = oldFetch;
    dom.happyDOM.abort();
  }
});
