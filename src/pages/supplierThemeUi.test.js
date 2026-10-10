import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';
import { createServer } from 'vite';
import { act, createElement } from 'react';

const luminance = (hex) => hex.slice(1, 7).match(/../g).map((part) => parseInt(part, 16) / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
const contrast = (foreground, background) => { const levels = [luminance(foreground), luminance(background)].sort((a, b) => b - a); return (levels[0] + .05) / (levels[1] + .05); };

test('kartu PT: seluruh palet mengikuti tema dan nama, kategori, jumlah serta tautan terbaca; warna logo tetap utuh', async () => {
  const dom = new Window({ url: 'http://localhost/#/' });
  globalThis.window = dom; globalThis.document = dom.document; globalThis.HTMLElement = dom.HTMLElement;
  Object.defineProperty(globalThis, 'navigator', { value: dom.navigator, configurable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const styles = dom.document.createElement('style');
  // The global foundation is imported after App; this order also catches specificity errors.
  styles.textContent = (await Promise.all(['../styles/themes.css', '../components/shop/SupplierSection.css', '../styles/global.css'].map((path) => readFile(new URL(path, import.meta.url), 'utf8')))).join('\n');
  dom.document.head.append(styles);
  const server = await createServer({ configFile: false, resolve: { preserveSymlinks: true }, oxc: { jsx: { runtime: 'automatic' } }, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom', ssr: { external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'] } });
  const [{ default: SupplierSection }, { suppliers }, { catalogColors, catalogColor }] = await Promise.all(['/src/components/shop/SupplierSection.jsx', '/src/data/suppliers.js', '/src/data/catalogColors.js'].map((path) => server.ssrLoadModule(path)));
  const originalSuppliers = [...suppliers];
  suppliers.splice(0, suppliers.length, ...[...catalogColors, { id: 'unknown', name: 'Palet tidak dikenal' }].map((color) => ({ id: `qa-${color.id}`, name: `PT ${color.name}`, color: color.id, initials: 'PT', logo: '', productIds: [] })));
  const { createRoot } = await import('react-dom/client');
  const container = dom.document.createElement('div'); dom.document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(SupplierSection)));
    const cards = [...container.querySelectorAll('.bam-supplier-card')];
    assert.equal(cards.length, catalogColors.length + 1);
    for (const mode of ['light', 'dark', 'light']) {
      dom.document.documentElement.dataset.theme = mode;
      for (let index = 0; index < cards.length; index++) {
        const card = cards[index];
        const palette = catalogColor(suppliers[index].color);
        const background = dom.getComputedStyle(card).backgroundColor;
        if (mode === 'light') assert.equal(background.toLowerCase(), palette.tint);
        else assert.ok(luminance(background) < .08, `${palette.id} supplier card must adapt to dark mode`);
        for (const selector of ['h3', ':scope > p', '.bam-supplier-bottom > span', '.bam-supplier-bottom strong']) {
          const foreground = dom.getComputedStyle(card.querySelector(selector)).color;
          assert.ok(contrast(foreground, background) >= 4.5, `${mode} ${palette.id}: ${selector} must remain readable on the actual card background`);
        }
        const logoStyle = dom.getComputedStyle(card.querySelector('.bam-supplier-logo'));
        assert.equal(logoStyle.backgroundColor.toLowerCase(), palette.border);
        assert.equal(logoStyle.color.toLowerCase(), palette.ink);
        assert.ok(contrast(logoStyle.color, logoStyle.backgroundColor) >= 4.5);
        assert.ok(card.getAttribute('href').startsWith('#/pemasok/'));
      }
    }
  } finally {
    await act(async () => root.unmount()); suppliers.splice(0, suppliers.length, ...originalSuppliers); await server.close(); dom.happyDOM.abort();
    delete globalThis.window; delete globalThis.document; delete globalThis.HTMLElement; delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
