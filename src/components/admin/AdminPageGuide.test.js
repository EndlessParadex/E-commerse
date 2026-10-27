import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { createServer } from 'vite';

test('every BAM Admin route has a concise accessible guide except Toko & Sales', async () => {
  const vite = await createServer({
    configFile: false,
    resolve: { preserveSymlinks: true },
    oxc: { jsx: { runtime: 'automatic' } },
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: 'custom',
    ssr: { external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'] },
  });
  try {
    const { default: AdminPageGuide, adminGuideByView } =
      await vite.ssrLoadModule('/src/components/admin/AdminPageGuide.jsx');
    const routes = [
      'overview', 'products', 'suppliers', 'brands', 'categories',
      'orders', 'stock', 'sharedCarts', 'accounts', 'approvals', 'company', 'email',
    ];
    for (const route of routes) {
      assert.ok(adminGuideByView[route]?.length >= 3 && adminGuideByView[route].length <= 4,
        route + ' needs three or four concise steps');
      for (const step of adminGuideByView[route]) {
        assert.equal(step.length, 3);
        for (const part of step) assert.ok(part.length > 0);
      }
      const html = renderToStaticMarkup(createElement(AdminPageGuide, { view: route }));
      assert.match(html, /aria-label="Panduan halaman Admin"/);
      assert.match(html, /<details class="admin-page-guide">/);
      assert.match(html, /<summary>Petunjuk halaman \(opsional\)<\/summary>/);
      assert.equal((html.match(/class="admin-page-guide-step"/g) || []).length,
        adminGuideByView[route].length);
    }
    assert.equal(renderToStaticMarkup(createElement(AdminPageGuide, { view: 'b2bStores' })), '',
      'Toko & Sales already renders its own five-step guide');
  } finally {
    await vite.close();
  }
});
