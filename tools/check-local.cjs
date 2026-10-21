const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');

async function checkLocal(baseUrl = 'http://localhost:5173', request = globalThis.fetch) {
  const url = new URL(baseUrl);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password
  )
    throw new Error('Gunakan alamat Local dari terminal, misalnya http://localhost:5173.');
  const checks = [];
  const get = async (path, label, validate) => {
    try {
      const response = await request(new URL(path, url), {
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const value = await response.text();
      if (!validate(value)) throw new Error('Kode atau kemampuan server belum sesuai pembaruan.');
      checks.push({ ok: true, label });
    } catch (error) {
      checks.push({ ok: false, label, error: error.message });
    }
  };
  await get('/', 'Halaman dari server pengembangan', (text) => text.includes('/@vite/client'));
  await get('/src/components/layout/Navbar.jsx', 'Header: bayangan hanya saat scroll', (text) =>
    text.includes('is-scrolled'),
  );
  await get(
    '/src/components/admin/AdminProductFilters.jsx',
    'Pencarian admin dan filter HP terbaru',
    (text) => text.includes('is-stuck') && text.includes('admin-filter-toggle'),
  );
  await get(
    '/src/components/shop/ShopActions.jsx',
    'Nama akun, foto profil, dan Guest',
    (text) => text.includes('account-trigger-name') && text.includes('Guest'),
  );
  await get(
    '/src/state/useSharedCart.js',
    'Keranjang bersama: kode sinkronisasi terbaru',
    (text) => text.includes('/api/b2b/cart-context') && text.includes('retryPending'),
  );
  await get('/api/catalog', 'Server: foto merek, katalog, dan keranjang bersama', (text) => {
    const value = JSON.parse(text);
    return (
      value.version === 1 &&
      value.capabilities?.brandPhotos === true &&
      value.capabilities?.gallery === true &&
      value.capabilities?.workflow === true &&
      value.capabilities?.sharedCarts === true
    );
  });
  await get(
    '/src/pages/AccountRecoveryPage.jsx',
    'Verifikasi email: bantuan tautan dan form terbaru',
    (text) => text.includes('auth-recovery-help') && text.includes('Kirim tautan verifikasi baru'),
  );
  await get(
    '/src/components/account/AccountPhone.jsx',
    'Profil: isian nomor HP akun',
    (text) => text.includes('account-phone') && text.includes('Simpan nomor HP'),
  );
  await get(
    '/api/auth/features',
    'Server: nomor HP dan konfirmasi kontak',
    (text) =>
      JSON.parse(text).profilePhone === true && JSON.parse(text).contactVerification === true,
  );
  await get(
    '/src/components/shop/ProductCard.jsx',
    'Kartu produk: tunggu simpan dan pilih toko',
    (text) => text.includes('Menyimpan…') && text.includes('Pilih toko dahulu'),
  );
  await get(
    '/src/state/useOrderSearch.js',
    'Pencarian seluruh riwayat pesanan',
    (text) => text.includes('searchServerOrders') && text.includes('nextCursor'),
  );
  await get(
    '/src/state/serverWorkflow.js',
    'Stok terpisah dari gangguan daftar pesanan',
    (text) => text.includes('inventoryFailed') && text.includes('adminOrdersFailed'),
  );
  await get(
    '/src/pages/AdminB2BStoresPage.jsx',
    'Toko & Sales: ubah dan cabut penugasan',
    (text) => text.includes('Ganti Sales') && text.includes('Cabut penugasan'),
  );
  await get('/api/catalog', 'Server: pencarian pesanan dan perubahan penugasan', (text) => {
    const value = JSON.parse(text);
    return (
      value.capabilities?.orderSearch === true && value.capabilities?.b2bStoreMaintenance === true
    );
  });
  await get(
    '/src/components/shop/AdminCartProcessing.jsx',
    'Admin: antrean, pemeriksaan dan finalisasi keranjang',
    (text) => text.includes('Finalisasi dan cadangkan stok') && text.includes('reviewToken'),
  );
  await get(
    '/api/catalog',
    'Server: finalisasi pesanan B2B oleh Admin',
    (text) => JSON.parse(text).capabilities?.b2bFinalization === true,
  );
  return { url: url.origin, checks, ok: checks.every((entry) => entry.ok) };
}

module.exports = { checkLocal };
if (require.main === module) {
  (async () => {
    console.log('Folder proyek: ' + resolve(__dirname, '..'));
    console.log('Node.js: ' + process.versions.node);
    if (Number(process.versions.node.split('.')[0]) < 24)
      throw new Error('Gunakan Node.js 24 atau lebih baru.');
    try {
      const git = (...args) =>
        execFileSync('git', args, {
          cwd: resolve(__dirname, '..'),
          encoding: 'utf8',
          timeout: 3000,
          windowsHide: true,
        }).trim();
      console.log('Branch: ' + git('branch', '--show-current'));
      console.log('Commit: ' + git('log', '-1', '--format=%h %s'));
      if (git('status', '--porcelain'))
        console.log('CATATAN: ada perubahan lokal yang belum di-commit.');
    } catch {
      console.log('Informasi Git tidak tersedia pada folder ini.');
    }
    const result = await checkLocal(process.argv[2]);
    console.log('Alamat yang diperiksa: ' + result.url);
    for (const entry of result.checks)
      console.log(
        (entry.ok ? 'LULUS' : 'GAGAL') +
          ' · ' +
          entry.label +
          (entry.error ? ': ' + entry.error : ''),
      );
    if (!result.ok) {
      console.log(
        'Hentikan server lama, jalankan npm run dev:full dari folder ini, lalu buka alamat Local yang ditampilkan dan periksa kembali.',
      );
      process.exitCode = 1;
    } else
      console.log(
        'Server dan kode pembaruan terdeteksi. Gunakan alamat di atas, lalu tekan Ctrl+Shift+R dan periksa tampilan.',
      );
  })().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
