# BAM — Frontend admin tahap 2

## Menjalankan

1. Ekstrak ZIP ke folder proyek baru, atau salin berkas yang berubah ke proyek lama.
2. Jalankan `npm ci` lalu `npm run dev`.
3. Buka alamat yang tampil di terminal, lalu tambahkan `#/admin/produk`.
4. Klik **Tambah produk**, atau **Edit produk** pada SKU yang tersedia.

## Fitur

- Nama, merek, PT pemasok, kategori, subkategori, dan deskripsi produk.
- Foto utama JPG, PNG, atau WebP, maksimal 1 MB, dengan pratinjau langsung.
- Beberapa ukuran per produk: SKU, gram/ml/buah, harga jual, dan harga sebelum diskon opsional.
- Validasi SKU duplikat (termasuk beda huruf besar/kecil), ukuran duplikat, harga, dan kolom wajib.
- SKU yang sudah ada tetap dipertahankan agar tautan produk tidak rusak.
- Pembaruan daftar admin, ringkasan, filter pemasok/merek, dan katalog/detail toko.
- Perubahan tersimpan di localStorage pada browser dan alamat situs yang sama, termasuk setelah reload.
- Pesan kesalahan jika penyimpanan browser penuh/tidak tersedia; data form tetap tersedia.
- Konfirmasi saat membatalkan isian atau mengikuti tautan dengan perubahan belum tersimpan.

## Batas tahap frontend

Penyimpanan ini untuk pratinjau lokal. Perubahan belum dikirim ke GitHub, database, atau browser/perangkat lain. Jangan memakai halaman ini sebagai admin produksi; otorisasi admin dan penyimpanan server menjadi pekerjaan backend berikutnya. Data awal, stok, rating, dan pesanan masih mengikuti simulasi proyek.

Harga pada keranjang/pesanan yang sudah dibuat mengikuti snapshot historis yang sudah ada, bukan ditimpa otomatis oleh edit katalog.

## Verifikasi

`npm run build`, `npm run lint`, dan `node --test`.

Pengujian tambahan mencakup tabrakan SKU/ukuran, harga invalid, kegagalan penyimpanan, integrasi katalog/pemasok, muat ulang, dan data tersimpan yang rusak.

Pemeriksaan visual browser belum selesai karena browser pratinjau tidak dapat menjangkau server lokal pada sesi ini. Cek tampilan desktop dan HP, unggah foto, tambah dua ukuran, simpan, reload, lalu buka produk di toko.

## Berkas yang berubah

- `src/App.jsx`
- `src/pages/AdminPage.jsx` dan `AdminPage.css`
- `src/pages/AdminProductForm.jsx` (baru)
- `src/data/adminEditor.js`, `adminStore.js`, `adminEditor.test.js` (baru)
- `src/components/shop/ProductDetailPage.jsx` dan `ProductDetailPage.css`

ZIP berisi salinan proyek lengkap tanpa `.git`, `node_modules`, atau hasil build. Backend yang sudah ada disertakan tanpa perubahan.
