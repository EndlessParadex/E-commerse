# BAM — Frontend tahap 3

## Pembaruan dari tahap 2

Salin folder `src`, `package.json`, dan `package-lock.json` dari ZIP ke proyek yang dipakai, lalu jalankan `npm ci` dan `npm run dev`. Gunakan alamat situs/port serta browser yang sama untuk melihat kembali data lokal yang sudah dibuat. Alternatifnya, ekstrak sebagai proyek baru dan jalankan dengan langkah yang sama.

Jangan menghapus penyimpanan browser. Pembaruan memakai kunci penyimpanan tahap 2 yang sama dan dapat membaca produk lama, termasuk merek yang sebelumnya diisi sebagai teks bebas. Perubahan belum diunggah ke GitHub.

## Menu dan urutan penggunaan

1. **PT pemasok** (`#/admin/pemasok`): tambah/edit nama PT, singkatan kartu, dan warna.
2. **Merek** (`#/admin/merek`): tambah/edit nama merek dan pilih PT pemasoknya. Satu merek bisa terhubung ke beberapa PT.
3. **Kategori** (`#/admin/kategori`): tambah/edit nama kategori, ikon, dan daftar subkategori.
4. **Daftar produk** (`#/admin/produk`): pilih PT, kemudian merek yang terhubung; pilih kategori/subkategori dan isi ukuran/SKU/harga.

Nama PT/merek/kategori/subkategori dapat diubah tanpa mengubah ID atau tautan yang sudah tersedia. Hubungan PT pada merek dan subkategori yang masih dipakai produk tidak boleh dilepas. Penghapusan data master belum disediakan.

Form mendukung pencarian daftar, pesan validasi, konfirmasi perubahan yang belum disimpan saat mengikuti tautan atau menekan Batal, serta pesan kegagalan penyimpanan browser. Pada menu yang sama, konfirmasi keluar juga menutup form.

## Penyimpanan

PT, merek, kategori, produk, dan foto tersimpan di browser untuk pratinjau. Data belum terhubung ke database/server, admin belum dilindungi otorisasi produksi, stok dan checkout mengikuti simulasi proyek.

## Verifikasi

Jalankan `npm run build`, `npm run lint`, dan `node --test`. Pengujian baru memeriksa hubungan data master, rename dan reload, kompatibilitas data tahap 2, kegagalan penyimpanan, alur keranjang/pesanan produk baru, interaksi form PT/merek/kategori, pilihan merek per PT, penolakan file foto yang salah, navigasi batal/setuju, serta SKU baru yang dapat dikoreksi.

Tes interaksi memakai DOM simulasi. Pemeriksaan visual pada browser desktop/HP belum selesai karena koneksi browser pratinjau ke server lokal mengalami timeout pada sesi ini.

## Pengecekan visual yang masih perlu dicoba

- Buka menu admin pada HP dan periksa form PT, merek, kategori, serta produk.
- Unggah foto JPG/PNG/WebP yang valid, ganti, hapus, lalu simpan dan reload.
- Tambahkan produk memakai PT/merek/kategori baru; buka detail dan pilih ukurannya.
- Cek nama, harga dan jumlah dari keranjang sampai checkout dan riwayat pesanan.

ZIP berisi proyek lengkap tanpa `.git`, `node_modules`, dan hasil build. Backend yang sudah ada disertakan tanpa perubahan. `happy-dom` ditambahkan sebagai dependensi pengujian saja.
