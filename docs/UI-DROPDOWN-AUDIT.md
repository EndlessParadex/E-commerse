# Audit dropdown BAM — konsistensi visual

Tanggal: 23 Oktober 2026
Branch: `feature/b2b-store-sales-shared-cart`

## Pemeriksaan

- Inventarisasi **85 komponen JSX** di `src/` pada branch ini. Kode aplikasi menggunakan dua jenis selector: popup khusus dan HTML `<select>`.
- Halaman katalog `src/pages/Home.jsx`: **Kategori, Subkategori, PT Pemasok, Merek, Urutkan** sekarang memakai **satu komponen `CatalogSearchDropdown`**. Empat filter berpotensi memiliki banyak pilihan sehingga menyediakan pencarian, ikon, dan hitungan produk aktual; Urutkan hanya tiga pilihan sehingga memakai popup ringkas tanpa pencarian/hitungan produk.
- Pemilihan tetap memanggil `setFilter` semula; pembentukan URL, filter pemasok/merek, hitungan produk, pengurutan, dan tombol reset tidak diubah.
- `src/components/shop/CatalogSearchDropdown.css` memakai CSS token tema BAM, focus-visible, panel mengambang, batas ketinggian, serta tata letak desktop/mobile dan reduced motion.
- `src/styles/themes.css` kini menyediakan tampilan dasar native select yang konsisten: border, radius, interaksi hover/focus/disabled, warna teks/surface, dan `color-scheme` per tema. `AdminDesign2.css` tetap secara eksplisit menetapkan tampilan Admin terang.

## Kontrol native yang **belum** diganti komponen popup

Audit menunjukkan **30 native `<select>` dalam 13 file JSX** di luar halaman katalog. Formulir ini tetap dipertahankan sebagai native untuk meminimalkan risiko regresi validasi, checkout, dan aksesibilitas; kontrol tertutup mendapat token visual yang konsisten, tetapi panel pilihan yang dibuka masih bisa mengikuti Windows/browser:

| Komponen | Jumlah | Konteks |
| --- | ---: | --- |
| `AppearanceSettings.jsx` | 2 | pilihan font dan kepadatan UI |
| `AdminCartProcessing.jsx` | 2 | pemrosesan pesanan |
| `CancelOrderDialog.jsx` | 1 | pembatalan pesanan |
| `SharedCartPage.jsx` | 6 | toko, SKU, kategori, metode bayar |
| `AdminAccountsPage.jsx` | 3 | pengaturan akun |
| `AdminApprovalsPage.jsx` | 1 | persetujuan |
| `AdminB2BStoresPage.jsx` | 4 | jadwal dan Sales |
| `AdminMasterPage.jsx` | 2 | master data |
| `AdminOrdersPage.jsx` | 1 | pesanan |
| `AdminPage.jsx` | 2 | manajemen Admin |
| `AdminProductForm.jsx` | 3 | formulir katalog |
| `AdminStockPage.jsx` | 1 | filter stok |
| `CustomerDirectoryPage.jsx` | 2 | filter pelanggan |

## Batasan dan tindak lanjut

CSS **tidak bisa menjamin seluruh tampilan menu native Windows/browser ketika opsi dibuka**. Konsistensi popup sepenuhnya pada halaman Admin/Checkout memerlukan migrasi selektif ke komponen dropdown yang mendukung label, keyboard, fokus, disabled, dan event `onChange` asli tanpa merusak test/formulir. Jangan mengganti semua `<select>` secara massal tanpa pengujian per halaman dan pengujian operasional.

Setelah `git pull`:
```powershell
node --test src/pages/catalogSearchDropdownUi.test.js
npm test
npm run lint
npm run build
```
