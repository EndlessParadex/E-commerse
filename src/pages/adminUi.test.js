import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement } from 'react';
import { readFile } from 'node:fs/promises';

test('form admin: navigasi batal mempertahankan isian, setuju menutup form, PT/merek baru tersedia dan SKU baru tidak terkunci', async () => {
  const dom = new Window({ url: 'http://localhost/#/admin' });
  const themeStyle = dom.document.createElement('style');
  themeStyle.textContent = (
    await Promise.all(
      [
        '../styles/themes.css',
        '../styles/global.css',
        './AdminPage.css',
        './AdminDesign2.css',
        './AdminUnifiedUI.css',
      ].map((path) => readFile(new URL(path, import.meta.url), 'utf8')),
    )
  ).join('\n');
  dom.document.head.append(themeStyle);
  const server = await createServer({
    configFile: false,
    resolve: { preserveSymlinks: true },
    oxc: { jsx: { runtime: 'automatic' } },
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: 'custom',
    ssr: { external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'] },
  });
  const module = await server.ssrLoadModule('/src/pages/AdminPage.jsx').catch(async (error) => {
    await server.close();
    throw error;
  });
  globalThis.window = dom;
  globalThis.document = dom.document;
  Object.defineProperty(globalThis, 'navigator', { value: dom.navigator, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', {
    value: dom.localStorage,
    configurable: true,
  });
  globalThis.HTMLElement = dom.HTMLElement;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  dom.scrollTo = () => {};
  let accepted = false;
  let confirmCount = 0;
  dom.confirm = () => {
    confirmCount += 1;
    return accepted;
  };
  const { createRoot } = await import('react-dom/client');
  const container = dom.document.createElement('div');
  dom.document.body.append(container);
  const root = createRoot(container);
  const AdminPage = module.default;
  const render = async (view) => {
    await act(async () => {
      root.render(createElement(AdminPage, { view, key: view }));
    });
  };
  const click = async (element) => {
    assert.ok(element, 'button/link found');
    await act(async () => {
      element.click();
    });
  };
  const button = (text) =>
    [...container.querySelectorAll('button')].find((entry) => entry.textContent === text);
  const fill = async (selector, value) => {
    const input = container.querySelector(selector);
    assert.ok(input, selector);
    const prototype =
      input.tagName === 'SELECT' ? dom.HTMLSelectElement.prototype : dom.HTMLInputElement.prototype;
    await act(async () => {
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value);
      input.dispatchEvent(
        new dom.Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }),
      );
    });
  };
  try {
    await render('overview');
    assert.ok(
      container.querySelector('.admin-home-hero'),
      'Design 2 hero is rendered on the Admin dashboard',
    );
    assert.ok(container.querySelector('.admin-ops-orders'), 'live order activity panel is present');
    assert.ok(
      container.querySelector('.admin-ops-inventory'),
      'real inventory summary panel is present',
    );
    assert.ok(
      container.querySelector('.admin-navigation a[aria-current="page"]'),
      'current route remains accessible',
    );
    assert.ok(
      container.querySelector('.admin-header .admin-page-title-icon .admin-icon'),
      'all Admin routes use the same icon style as Toko & Sales',
    );
    assert.equal(
      container.querySelectorAll('.admin-page-guide-step').length,
      4,
      'dashboard shows a concise four-step Admin guide',
    );
    assert.ok(
      container.querySelector('.admin-ops-orders .admin-unified-section-icon'),
      'order overview has its own clear section icon and separator',
    );
    assert.ok(
      container.querySelector('.admin-ops-inventory .admin-unified-section-icon'),
      'inventory overview has its own clear section icon',
    );
    assert.equal(container.querySelectorAll('.admin-metric').length, 4);
    assert.ok(
      container.querySelector('.admin-overview-table'),
      'dashboard uses the real catalog table',
    );
    assert.ok(
      container.querySelector('.admin-topbar-search'),
      'catalog search is available in the Admin toolbar',
    );
    assert.ok(container.querySelector('nav a[href="#/admin/toko-sales"]'));
    assert.ok(container.querySelector('nav a[href="#/admin/keranjang"]'));
    assert.ok(container.querySelector('nav a[href="#/admin/produk"]'));
    assert.equal(
      dom.getComputedStyle(container.querySelector('.admin-page-guide')).marginBottom,
      '20px',
      'shared guide has a consistent gap to the following panel',
    );
    assert.equal(
      dom.getComputedStyle(container.querySelector('.admin-metric')).minHeight,
      '160px',
      'metric cards have a consistent baseline height',
    );
    await render('products');
    assert.equal(
      dom.getComputedStyle(container.querySelector('.admin-table td')).verticalAlign,
      'middle',
      'product rows and actions use the same vertical alignment',
    );
    await render('overview');
    const adminTheme = await readFile(new URL('./AdminDesign2.css', import.meta.url), 'utf8');
    assert.match(adminTheme, /\.admin-shell \.admin-sidebar\s*\{/);
    assert.match(adminTheme, /\.admin-shell \.admin-home-hero\s*\{/);
    assert.match(adminTheme, /\.admin-shell \.workflow-order-card/);
    assert.match(adminTheme, /\.admin-shell \.b2b-panel/);
    assert.match(adminTheme, /@media\s*\(\s*max-width:\s*950px\s*\)/);
    await click(button('+ Tambah produk'));
    assert.ok(
      container.querySelector('aside.admin-form-preview .admin-preview-image'),
      'product photo remains visible in the right-side preview',
    );
    assert.ok(
      container.querySelector(
        '.admin-editor-grid .admin-editor-sections + aside.admin-form-preview',
      ),
      'preview follows the compact editing sections in the desktop grid',
    );
    assert.equal(
      container.querySelector('#product-description')?.getAttribute('rows'),
      '3',
      'description begins at three lines and can be resized',
    );
    assert.ok(
      container.querySelector('.admin-variant-cards .admin-variant-card'),
      'SKU variants appear as editable cards',
    );
    assert.ok(
      container.querySelector('details.admin-info-card'),
      'product information can expand on demand',
    );
    assert.ok(
      container.querySelector('details.admin-photo-card'),
      'photo controls can expand on demand',
    );
    const colorPicker = container.querySelector('.admin-color-picker');
    assert.ok(colorPicker, 'card color has a swatch picker');
    assert.equal(
      colorPicker.querySelectorAll('.admin-color-option').length,
      10,
      'each catalog color is visible with a color swatch',
    );
    assert.equal(
      colorPicker.querySelectorAll('.admin-color-options .admin-color-swatch').length,
      10,
    );
    await click(colorPicker.querySelector('summary'));
    await click(colorPicker.querySelector('button[data-color-id="rose"]'));
    assert.equal(colorPicker.hasAttribute('open'), false, 'picker closes after selection');
    assert.match(colorPicker.querySelector('summary').textContent, /Merah muda/);
    assert.equal(
      colorPicker.querySelector('button[data-color-id="rose"]').getAttribute('aria-pressed'),
      'true',
    );
    assert.match(
      container.querySelector('.admin-form-preview .admin-preview-image').getAttribute('style'),
      /linear-gradient/,
      'the selected swatch updates the live card preview',
    );
    assert.ok(
      container.querySelector('.admin-editor .admin-product-photos .admin-photo-controls'),
      'photo upload remains accessible in the compact photo section',
    );
    await fill('#product-baseName', 'Isian belum disimpan');
    await click(container.querySelector('nav a[href="#/admin"]'));
    assert.equal(container.querySelector('#product-baseName').value, 'Isian belum disimpan');
    assert.equal(confirmCount, 1);
    accepted = true;
    await click(container.querySelector('nav a[href="#/admin"]'));
    assert.equal(container.querySelector('.admin-editor'), null);
    await click(button('+ Tambah produk'));
    assert.equal(container.querySelector('#product-baseName').value, '');
    await click(container.querySelector('nav a[href="#/admin/produk"]'));
    assert.equal(container.querySelector('.admin-editor'), null);
    await render('suppliers');
    assert.equal(
      container.querySelectorAll('.admin-page-guide-step').length,
      3,
      'supplier page has short practical steps',
    );
    assert.ok(
      container.querySelector('.admin-panel-heading .admin-unified-section-icon'),
      'supplier heading uses the shared icon system',
    );
    await click(button('+ Tambah PT pemasok'));
    await fill('#master-name', 'Isian PT sementara');
    accepted = false;
    await click(container.querySelector('nav a[href="#/admin/pemasok"]'));
    assert.equal(container.querySelector('#master-name').value, 'Isian PT sementara');
    accepted = true;
    await click(container.querySelector('nav a[href="#/admin/pemasok"]'));
    assert.equal(container.querySelector('.admin-master-form'), null);
    await click(button('+ Tambah PT pemasok'));
    await fill('#master-name', 'PT UI Uji');
    await fill('#master-initials', 'UU');
    await click(button('Simpan PT pemasok'));
    assert.match(container.textContent, /PT UI Uji/);
    assert.match(container.textContent, /berhasil disimpan/);
    const masters = await server.ssrLoadModule('/src/data/catalogMasters.js');
    const supplierModule = await server.ssrLoadModule('/src/data/suppliers.js');
    const newSupplier = supplierModule.suppliers.find((entry) => entry.name === 'PT UI Uji');
    await click(container.querySelector(`button[aria-label="Edit ${newSupplier.name}"]`));
    await fill('#master-color', 'rose');
    const sample = container.querySelector('.admin-master-sample');
    assert.equal(dom.getComputedStyle(sample).backgroundColor, '#fdf2f8');
    dom.document.documentElement.dataset.theme = 'dark';
    assert.equal(dom.getComputedStyle(sample).backgroundColor, '#321f2c');
    assert.equal(dom.getComputedStyle(sample.querySelector('p')).color, '#c1cfdf');
    dom.document.documentElement.dataset.theme = 'light';
    await click(button('Simpan PT pemasok'));
    assert.equal(
      supplierModule.suppliers.find((entry) => entry.id === newSupplier.id).color,
      'rose',
    );
    await render('brands');
    await click(button('+ Tambah merek'));
    await fill('#master-name', 'Merek UI Uji');
    const ptCheckbox = [...container.querySelectorAll('fieldset label')]
      .find((label) => label.textContent === 'PT UI Uji')
      .querySelector('input');
    await click(ptCheckbox);
    await click(button('Simpan merek'));
    assert.match(container.textContent, /berhasil disimpan/);
    await click(container.querySelector('button[aria-label="Edit Merek UI Uji"]'));
    dom.Image = class {
      set src(value) {
        queueMicrotask(() =>
          value.startsWith('data:image/png;base64,iVBORw0KGgo')
            ? this.onload?.()
            : this.onerror?.(),
        );
      }
    };
    const brandPhoto =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9i0AAAAASUVORK5CYII=';
    const brandUpload = new dom.DataTransfer();
    brandUpload.items.add(
      new dom.File([Buffer.from(brandPhoto.split(',')[1], 'base64')], 'merek.png', {
        type: 'image/png',
      }),
    );
    await act(async () => {
      const input = container.querySelector('#master-logo');
      input.files = brandUpload.files;
      input.dispatchEvent(new dom.Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    assert.equal(
      container.querySelector('.admin-brand-photo-preview').getAttribute('src'),
      brandPhoto,
    );
    await click(button('Simpan merek'));
    assert.equal(masters.brands.find((entry) => entry.name === 'Merek UI Uji').logo, brandPhoto);
    assert.ok(container.querySelector('.admin-brand-avatar'));
    await click(container.querySelector('button[aria-label="Edit Merek UI Uji"]'));
    assert.equal(
      container.querySelector('.admin-brand-photo-preview').getAttribute('src'),
      brandPhoto,
    );
    await click(button('Batal'));
    await render('categories');
    await click(button('+ Tambah kategori'));
    await fill('#master-name', 'Kategori UI Uji');
    await fill('#master-icon', '🥔');
    await fill('#child-0', 'Laptop UI Uji');
    await click(button('+ Tambah subkategori'));
    await fill('#child-1', 'Aksesori UI Uji');
    await click(button('Simpan kategori'));
    assert.match(container.textContent, /Aksesori UI Uji/);
    await render('products');
    assert.ok(
      container.querySelector('.admin-page-guide'),
      'product catalog exposes its quick-start guide',
    );
    assert.ok(
      container.querySelector('.admin-products-panel .admin-unified-section-icon'),
      'products use the unified section header',
    );
    const filterPanel = container.querySelector('.admin-products-panel');
    assert.ok(filterPanel, 'product catalog has its own sticky filter container');
    assert.ok(filterPanel.querySelector('.admin-filters #admin-search'));
    assert.ok(filterPanel.querySelector('.admin-filters #admin-supplier'));
    assert.ok(filterPanel.querySelector('.admin-filters #admin-brand'));
    assert.match(
      themeStyle.textContent,
      /\.admin-products-panel \.admin-filters\s*\{[^}]*position:\s*sticky/,
    );
    assert.match(themeStyle.textContent, /\.admin-products-panel\s*\{[^}]*overflow:\s*visible/);
    await click(button('+ Tambah produk'));
    await fill('#product-supplierId', newSupplier.id);
    const options = [...container.querySelector('#product-brandId').options];
    assert.ok(options.some((entry) => entry.textContent === 'Merek UI Uji'));
    assert.equal(options.filter((entry) => entry.value).length, 1);
    const brand = masters.brands.find((entry) => entry.name === 'Merek UI Uji');
    await fill('#product-brandId', brand.id);
    assert.match(container.querySelector('.admin-form-preview').textContent, /Merek UI Uji/);
    const categoryModule = await server.ssrLoadModule('/src/data/catalog.js');
    const category = categoryModule.categories.find((entry) => entry.name === 'Kategori UI Uji');
    assert.equal(category.icon, '🥔');
    await fill('#product-categoryId', category.id);
    assert.equal(container.querySelector('#product-subcategoryId').options.length, 3);
    const transfer = new dom.DataTransfer();
    transfer.items.add(new dom.File(['invalid photo'], 'test.txt', { type: 'text/plain' }));
    const photoInput = container.querySelector('input[type="file"]');
    await act(async () => {
      photoInput.files = transfer.files;
      photoInput.dispatchEvent(new dom.Event('change', { bubbles: true }));
    });
    assert.match(container.textContent, /Pilih JPG, PNG, atau WebP/);
    await click(button('Batal'));
    await click(
      container.querySelector('button[aria-label="Edit Keripik Singkong Balado ukuran 180g"]'),
    );
    await click(button('+ Tambah varian'));
    assert.equal(
      container.querySelectorAll('.admin-variant-card').length,
      5,
      'new variant creates an additional grid card',
    );
    assert.ok(
      container.querySelector('#admin-variant-editor'),
      'new variant immediately opens its edit dialog',
    );
    assert.match(
      themeStyle.textContent,
      /\.admin-shell \.admin-editor \.admin-variant-dialog\[open\]\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0;[^}]*margin:\s*auto;/,
      'native dialog must be centered despite the global margin reset',
    );
    assert.match(
      themeStyle.textContent,
      /@media \(max-width: 1180px\)/,
      'narrow desktop layouts stack preview instead of squeezing inputs',
    );
    await fill('#variant-4-id', 'snack-pedas');
    assert.equal(container.querySelector('#variant-4-id').readOnly, false);
    await fill('#variant-4-id', 'SKU-UI-BARU');
    assert.equal(container.querySelector('#variant-4-id').value, 'SKU-UI-BARU');
    await click(button('Selesai mengedit'));
    assert.match(container.querySelectorAll('.admin-variant-card')[4].textContent, /SKU-UI-BARU/);
    await click(container.querySelector('.admin-variant-card[data-variant-index="0"]'));
    assert.equal(container.querySelector('#variant-0-id').readOnly, true);
    await click(button('Selesai mengedit'));
    await click(button('Batal'));
    await render('suppliers');
    const usedDelete = container.querySelector(
      'button[aria-label="Hapus PT pemasok PT Pangan Contoh"]',
    );
    assert.equal(usedDelete.disabled, true);
    assert.match(container.textContent, /Belum dapat dihapus/);
    assert.equal(
      container.querySelector('button[aria-label="Hapus PT pemasok PT UI Uji"]').disabled,
      true,
    );
    await render('brands');
    const deleteBrand = container.querySelector('button[aria-label="Hapus merek Merek UI Uji"]');
    assert.equal(deleteBrand.disabled, false);
    accepted = false;
    await click(deleteBrand);
    assert.ok(masters.brands.some((entry) => entry.id === brand.id));
    accepted = true;
    await click(deleteBrand);
    assert.ok(!masters.brands.some((entry) => entry.id === brand.id));
    await render('suppliers');
    await click(container.querySelector('button[aria-label="Hapus PT pemasok PT UI Uji"]'));
    assert.ok(!supplierModule.suppliers.some((entry) => entry.id === newSupplier.id));
    await render('categories');
    await click(container.querySelector('button[aria-label="Hapus kategori Kategori UI Uji"]'));
    assert.ok(!categoryModule.categories.some((entry) => entry.id === category.id));
  } finally {
    await act(async () => root.unmount());
    await server.close();
    dom.happyDOM.abort();
  }
});
