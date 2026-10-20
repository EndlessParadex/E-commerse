const test = require('node:test');
const assert = require('node:assert/strict');
const { checkLocal } = require('./check-local.cjs');

test('local checks identify a stale frontend and backend instead of reporting an up-to-date install', async () => {
  const files = {
    '/': '<script src="/@vite/client"></script>',
    '/src/components/layout/Navbar.jsx': 'store-navigation is-scrolled',
    '/src/components/admin/AdminProductFilters.jsx': 'is-stuck admin-filter-toggle',
    '/src/components/shop/ShopActions.jsx': 'account-trigger-name Guest',
    '/src/state/useSharedCart.js': '/api/b2b/cart-context retryPending',
    '/src/pages/AccountRecoveryPage.jsx': 'auth-recovery-help Kirim tautan verifikasi baru',
    '/src/components/account/AccountPhone.jsx': 'account-phone Simpan nomor HP',
    '/api/auth/features': JSON.stringify({ profilePhone: true, contactVerification: true }),
    '/api/catalog': JSON.stringify({
      version: 1,
      capabilities: { brandPhotos: true, gallery: true, workflow: true, sharedCarts: true },
    }),
  };
  const request = async (url) =>
    new Response(files[url.pathname] || '', { status: files[url.pathname] ? 200 : 404 });
  assert.equal((await checkLocal('http://localhost:5173', request)).ok, true);
  files['/src/components/layout/Navbar.jsx'] = 'old header';
  files['/api/catalog'] = JSON.stringify({ version: 1, capabilities: { gallery: true } });
  const outdated = await checkLocal('http://localhost:5174', request);
  assert.equal(outdated.ok, false);
  assert.equal(outdated.url, 'http://localhost:5174');
  assert.equal(outdated.checks.filter((entry) => !entry.ok).length, 2);
  const offline = await checkLocal('http://127.0.0.1:5173', async () => {
    throw new Error('Connection refused');
  });
  assert.equal(offline.ok, false);
  assert.ok(offline.checks.every((entry) => !entry.ok));
  await assert.rejects(checkLocal('https://example.com', request), /Gunakan alamat Local/);
});
