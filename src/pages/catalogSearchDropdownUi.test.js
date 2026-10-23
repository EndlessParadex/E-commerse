import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { createElement } from 'react';
import { act } from 'react';
import { readFile } from 'node:fs/promises';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test('katalog: kategori dan merek dapat dicari, dipilih dan dioperasikan dengan keyboard', async () => {
  const dom = new Window({ url: 'http://localhost/#/cari?q=' });
  globalThis.window = dom;
  globalThis.document = dom.document;
  globalThis.HTMLElement = dom.HTMLElement;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const server = await createServer({
    configFile: false,
    resolve: { preserveSymlinks: true },
    oxc: { jsx: { runtime: 'automatic' } },
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: 'custom',
    ssr: { external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'] },
  });
  const { default: CatalogSearchDropdown } = await server.ssrLoadModule(
    '/src/components/shop/CatalogSearchDropdown.jsx',
  );
  const { createRoot } = await import('react-dom/client');
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const options = [
    { id: '', name: 'Semua kategori', icon: '▦', count: 9 },
    { id: 'potato', name: 'Snack Kentang', icon: '🥔', count: 5 },
    { id: 'cookies', name: 'Snack Cookies', icon: '🍪', count: 4 },
  ];
  const selected = [];
  const render = async (props = {}) => {
    await act(async () => {
      root.render(createElement(CatalogSearchDropdown, {
        label: 'Kategori', value: '', options, onChange: (id) => selected.push(id),
        ...props,
      }));
      await settle();
    });
  };
  const click = async (element) => {
    assert.ok(element);
    await act(async () => { element.click(); await settle(); });
  };
  const type = async (input, value) => {
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(dom.HTMLInputElement.prototype, 'value').set;
      setter.call(input, value);
      input.dispatchEvent(new dom.Event('input', { bubbles: true }));
      await settle();
    });
  };
  try {
    await render();
    const trigger = container.querySelector('.catalog-search-trigger');
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
    await click(trigger);
    assert.equal(trigger.getAttribute('aria-expanded'), 'true');
    const search = container.querySelector('input[type="search"]');
    assert.ok(search);
    assert.equal(document.activeElement, search, 'pencarian mendapat fokus');
    assert.equal(container.querySelectorAll('.catalog-search-option').length, 3);
    assert.match(container.querySelector('.catalog-search-option').textContent, /9 produk/);
    await type(search, 'cookies');
    assert.equal(container.querySelectorAll('.catalog-search-option').length, 1);
    assert.match(container.querySelector('.catalog-search-option').textContent, /Snack Cookies/);
    await act(async () => {
      search.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await settle();
    });
    assert.equal(document.activeElement, container.querySelector('.catalog-search-option'),
      'ArrowDown moves focus from search to the first matching choice');
    await click(container.querySelector('.catalog-search-option'));
    assert.deepEqual(selected, ['cookies']);
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');

    await render({ label: 'Merek', value: 'potato' });
    await click(container.querySelector('.catalog-search-trigger'));
    assert.equal(container.querySelector('.catalog-search-option[aria-pressed="true"]')
      .textContent.includes('Snack Kentang'), true);
    const input = container.querySelector('input[type="search"]');
    await type(input, 'tidak ada');
    assert.match(container.querySelector('.catalog-search-empty').textContent, /Tidak ada pilihan/);
    await act(async () => {
      document.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await settle();
    });
    assert.equal(container.querySelector('.catalog-search-panel'), null);
    assert.equal(document.activeElement, container.querySelector('.catalog-search-trigger'),
      'Escape mengembalikan fokus ke tombol');

    await click(container.querySelector('.catalog-search-trigger'));
    await act(async () => {
      document.body.dispatchEvent(new dom.Event('pointerdown', { bubbles: true }));
      await settle();
    });
    assert.equal(container.querySelector('.catalog-search-panel'), null, 'klik luar menutup dropdown');

    const css = await readFile(new URL('../components/shop/CatalogSearchDropdown.css', import.meta.url), 'utf8');
    assert.match(css, /--color-surface/);
    assert.match(css, /@media \(max-width: 520px\)/);
    assert.match(css, /prefers-reduced-motion/);
    const home = await readFile(new URL('./Home.jsx', import.meta.url), 'utf8');
    assert.equal((home.match(/<CatalogSearchDropdown/g) || []).length, 2);
    assert.match(home, /onChange=\{\(categoryId\) => setFilter\(\{ categoryId, subcategoryId: '' \}\)\}/);
    assert.match(home, /onChange=\{\(brandId\) => setFilter\(\{ brandId \}\)\}/);
  } finally {
    await act(async () => root.unmount());
    await server.close();
    dom.happyDOM.abort();
    for (const key of ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT'])
      delete globalThis[key];
  }
});
