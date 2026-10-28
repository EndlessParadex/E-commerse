# Audit dropdown BAM — konsistensi visual

Tanggal: 23 Oktober 2026
Branch: `feature/b2b-store-sales-shared-cart`

## Pemeriksaan

- Inventarisasi **85 komponen JSX** di `src/` pada branch ini. Kode aplikasi menggunakan dua jenis selector: popup khusus dan HTML `<select>`.
- Halaman katalog `src/pages/Home.jsx`: **Kategori, Subkategori, PT Pemasok, Merek, Urutkan** sekarang memakai **satu komponen `CatalogSearchDropdown`**. Empat filter berpotensi memiliki banyak pilihan sehingga menyediakan pencarian, ikon, dan hitungan produk aktual; Urutkan hanya tiga pilihan sehingga memakai popup ringkas tanpa pencarian/hitungan produk.
- Pemilihan tetap memanggil `setFilter` semula; pembentukan URL, filter pemasok/merek, hitungan produk, pengurutan, dan tombol reset tidak diubah.
- `src/components/shop/CatalogSearchDropdown.css` memakai CSS token tema BAM, focus-visible, panel mengambang, batas ketinggian, serta tata letak desktop/mobile dan reduced motion.
- `src/styles/themes.css` menyediakan tampilan native select yang konsisten di browser: border, radius, interaksi hover/focus/disabled, warna teks/surface, dan `color-scheme` per tema. Pada browser yang mendukung `appearance: base-select`, popup yang terbuka juga mengikuti tema BAM melalui `::picker(select)` tanpa mengubah event React. `AdminDesign2.css` tetap secara eksplisit menetapkan tampilan Admin terang.

## Kontrol native yang **belum** diganti komponen popup

Audit menunjukkan **30 native `<select>` dalam 13 file JSX** di luar halaman katalog. Formulir ini tetap dipertahankan sebagai native untuk meminimalkan risiko regresi validasi, checkout, dan aksesibilitas; kontrol tertutup dan, pada browser yang mendukung `appearance: base-select`, panel pilihan yang dibuka mengikuti token visual BAM. Pada browser lain, popup masih bisa mengikuti Windows/browser:

| Komponen                    | Jumlah | Konteks                           |
| --------------------------- | -----: | --------------------------------- |
| `AppearanceSettings.jsx`    |      2 | pilihan font dan kepadatan UI     |
| `AdminCartProcessing.jsx`   |      2 | pemrosesan pesanan                |
| `CancelOrderDialog.jsx`     |      1 | pembatalan pesanan                |
| `SharedCartPage.jsx`        |      6 | toko, SKU, kategori, metode bayar |
| `AdminAccountsPage.jsx`     |      3 | pengaturan akun                   |
| `AdminApprovalsPage.jsx`    |      1 | persetujuan                       |
| `AdminB2BStoresPage.jsx`    |      4 | jadwal dan Sales                  |
| `AdminMasterPage.jsx`       |      2 | master data                       |
| `AdminOrdersPage.jsx`       |      1 | pesanan                           |
| `AdminPage.jsx`             |      2 | manajemen Admin                   |
| `AdminProductForm.jsx`      |      3 | formulir katalog                  |
| `AdminStockPage.jsx`        |      1 | filter stok                       |
| `CustomerDirectoryPage.jsx` |      2 | filter pelanggan                  |

## Batasan dan tindak lanjut

CSS dengan `appearance: base-select` meningkatkan konsistensi pada browser yang mendukungnya, namun **tidak menjamin tampilan popup seragam pada semua browser/OS**. Browser lama membutuhkan migrasi selektif agar menu yang terbuka terlihat identik. Jangan mengganti semua `<select>` secara massal tanpa pengujian per halaman dan pengujian operasional.

Referensi: https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Customizable_select

Setelah `git pull`:

```powershell
node --test src/pages/catalogSearchDropdownUi.test.js
npm test
npm run lint
npm run build
```
