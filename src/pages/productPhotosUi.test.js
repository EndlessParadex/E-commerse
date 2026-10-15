import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement } from 'react';
import { readFile } from 'node:fs/promises';
import { createApp } from '../../server/app.js';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9i0AAAAASUVORK5CYII=',
  'base64',
);

test('admin menambah beberapa foto, memilih foto utama, menghapus dan menyimpan; pembeli mengganti foto tanpa label tampak', async () => {
  const dom = new Window({ url: 'http://localhost/#/admin/produk' });
  const style = dom.document.createElement('style');
  style.textContent = (
    await Promise.all(
      ['../styles/themes.css', './AdminPage.css', '../components/shop/ProductGallery.css'].map(
        (path) => readFile(new URL(path, import.meta.url), 'utf8'),
      ),
    )
  ).join('\n');
  dom.document.head.append(style);
  const server = await createServer({
    configFile: false,
    resolve: { preserveSymlinks: true },
    oxc: { jsx: { runtime: 'automatic' } },
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: 'custom',
    ssr: { external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'] },
  });
  const api = createApp({ dbPath: ':memory:' });
  api.catalog.workflowEnabled = false; // Exercise compatibility with the earlier catalog-only API.

  const [{ default: Form }, { default: Gallery }, store, catalog] = await Promise.all(
    [
      '/src/pages/AdminProductForm.jsx',
      '/src/components/shop/ProductGallery.jsx',
      '/src/data/adminStore.js',
      '/src/data/products.js',
    ].map((path) => server.ssrLoadModule(path)),
  );
  globalThis.window = dom;
  globalThis.document = dom.document;
  globalThis.HTMLElement = dom.HTMLElement;
  Object.defineProperty(globalThis, 'navigator', { value: dom.navigator, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', {
    value: dom.localStorage,
    configurable: true,
  });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // Happy DOM does not decode images; emulate decoding while using its real FileReader.
  dom.Image = class {
    set src(value) {
      queueMicrotask(() => {
        if (value.startsWith('data:image/png;base64,iVBORw0KGgo')) this.onload?.();
        else this.onerror?.();
      });
    }
  };
  let saved = 0;
  let closed = 0;
  let acceptDiscard = false;
  dom.confirm = () => acceptDiscard;
  const transport = async (_url, options = {}) =>
    new Response(
      JSON.stringify(
        options.method === 'PUT'
          ? api.catalog.save(JSON.parse(options.body))
          : api.catalog.snapshot(),
      ),
    );
  const { createRoot } = await import('react-dom/client');
  const container = dom.document.createElement('div');
  dom.document.body.append(container);
  const root = createRoot(container);
  const settle = () => new Promise((resolve) => setTimeout(resolve, 10));
  const renderForm = (key) =>
    act(async () =>
      root.render(
        createElement(Form, {
          key,
          groupId: 'snack-pedas',
          onClose: () => {
            closed += 1;
          },
          onSaved: () => {
            saved += 1;
          },
        }),
      ),
    );
  const click = (element) =>
    act(async () => {
      assert.ok(element, 'control exists');
      element.click();
      await settle();
    });
  const button = (text) =>
    [...container.querySelectorAll('button')].find((entry) => entry.textContent === text);
  const file = (number) =>
    new dom.File([Buffer.concat([png, Buffer.from([number])])], `foto-${number}.png`, {
      type: 'image/png',
    });
  const upload = async (files) => {
    await act(async () => {
      const transfer = new dom.DataTransfer();
      files.forEach((entry) => transfer.items.add(entry));
      const input = container.querySelector('input[type="file"]');
      input.files = transfer.files;
      input.dispatchEvent(new dom.Event('change', { bubbles: true }));
      await settle();
    });
    for (
      let attempt = 0;
      attempt < 100 &&
      container.querySelector('.admin-product-photos').getAttribute('aria-busy') === 'true';
      attempt += 1
    ) {
      await act(async () => {
        await settle();
      });
    }
    assert.equal(
      container.querySelector('.admin-product-photos').getAttribute('aria-busy'),
      'false',
    );
  };
  try {
    await store.initializeCatalog(transport);
    await renderForm('initial');
    assert.equal(container.querySelector('input[type="file"]').multiple, true);
    await upload([file(1), file(2)]);
    assert.equal(
      container.querySelectorAll('.admin-photo-item').length,
      2,
      container.querySelector('.admin-product-photos').textContent,
    );
    const sources = [...container.querySelectorAll('.admin-photo-image img')].map(
      (entry) => entry.src,
    );
    assert.ok(sources[0] !== sources[1]);
    assert.equal(container.querySelector('.admin-form-preview img').src, sources[0]);
    await click(button('Batal'));
    assert.equal(closed, 0, 'unsaved photo changes trigger discard confirmation');
    await upload([new dom.File(['text'], 'wrong.txt', { type: 'text/plain' })]);
    assert.match(container.querySelector('[role="alert"]').textContent, /JPG, PNG/);
    assert.equal(container.querySelectorAll('.admin-photo-item').length, 2);
    await upload([new dom.File(['broken'], 'broken.png', { type: 'image/png' })]);
    assert.match(container.querySelector('[role="alert"]').textContent, /tidak dapat dibaca/);
    assert.equal(container.querySelectorAll('.admin-photo-item').length, 2);
    await upload([
      new dom.File([new Uint8Array(1024 * 1024 + 1)], 'large.png', { type: 'image/png' }),
    ]);
    assert.match(container.querySelector('[role="alert"]').textContent, /maksimal 1 MB/);
    await upload(Array.from({ length: 7 }, (_, index) => file(index + 3)));
    assert.match(container.querySelector('[role="alert"]').textContent, /Maksimal 8/);
    assert.equal(container.querySelectorAll('.admin-photo-item').length, 2);
    await click(container.querySelector('button[aria-label="Jadikan foto 2 sebagai foto utama"]'));
    assert.equal(container.querySelector('.admin-form-preview img').src, sources[1]);
    await click(button('Simpan produk'));
    assert.equal(saved, 1);
    await store.initializeCatalog(transport);
    await renderForm('reloaded');
    assert.equal(container.querySelectorAll('.admin-photo-item').length, 2);
    assert.equal(container.querySelector('.admin-form-preview img').src, sources[1]);
    let product = catalog.products.find((entry) => entry.id === 'snack-pedas');
    await act(async () => root.render(createElement(Gallery, { product })));
    assert.equal(container.querySelectorAll('.gallery-thumbnail').length, 2);
    assert.ok(!container.querySelector('.gallery-caption'));
    assert.ok(!container.querySelector('.gallery-thumbnail-label'));
    assert.ok(!/Depan|Belakang|Samping|Detail/.test(container.textContent));
    assert.equal(container.querySelector('.detail-image img').src, sources[1]);
    await click(container.querySelectorAll('.gallery-thumbnail')[1]);
    assert.equal(container.querySelector('.detail-image img').src, sources[0]);
    assert.equal(
      container.querySelectorAll('.gallery-thumbnail')[1].getAttribute('aria-pressed'),
      'true',
    );
    assert.equal(container.querySelector('.gallery-status').textContent, 'Foto 2 dari 2');
    assert.equal(
      dom.getComputedStyle(container.querySelector('.gallery-status')).clipPath,
      'inset(50%)',
    );
    await act(async () => {
      container.querySelector('.detail-image img').dispatchEvent(new dom.Event('error'));
      await settle();
    });
    assert.ok(container.querySelector('.detail-image .bam-product-fallback'));
    await renderForm('remove');
    await click(container.querySelector('button[aria-label="Hapus foto 1"]'));
    assert.equal(container.querySelector('.admin-form-preview img').src, sources[0]);
    await click(button('Simpan produk'));
    assert.equal(saved, 2);
    await store.initializeCatalog(transport);
    product = catalog.products.find((entry) => entry.id === 'snack-pedas');
    await act(async () => root.render(createElement(Gallery, { product })));
    assert.ok(
      !container.querySelector('.gallery-thumbnails'),
      'one photo does not need a duplicate thumbnail',
    );
    await renderForm('clear');
    await click(container.querySelector('button[aria-label="Hapus foto 1"]'));
    await click(button('Simpan produk'));
    assert.equal(saved, 3);
    await store.initializeCatalog(transport);
    product = catalog.products.find((entry) => entry.id === 'snack-pedas');
    assert.equal(product.image, '');
    assert.deepEqual(product.gallery, []);
    await act(async () => root.render(createElement(Gallery, { product })));
    assert.ok(container.querySelector('.gallery-demo'));
    assert.ok(!/Depan|Belakang|Samping|Detail/.test(container.textContent));
    await renderForm('limit');
    await upload(Array.from({ length: 8 }, (_, index) => file(index)));
    assert.equal(container.querySelectorAll('.admin-photo-item').length, 8);
    assert.equal(container.querySelector('input[type="file"]').disabled, true);
    await click(container.querySelector('button[aria-label="Hapus foto 8"]'));
    assert.equal(container.querySelector('input[type="file"]').disabled, false);
    acceptDiscard = true;
    await click(button('Batal'));
    assert.equal(closed, 1);
  } finally {
    await act(async () => root.unmount());
    api.db.close();
    await server.close();
    dom.happyDOM.abort();
  }
});
