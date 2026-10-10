# BAM — Pilihan Satuan, Pack, dan Dus

Pembaruan 9 Oktober 2026. Paket lengkap ini juga memuat perbaikan frontend sebelumnya, gambar pada menu kategori/PT, serta tombol kembali di bawah breadcrumb halaman produk.

## Perilaku baru

- Satu produk dapat memiliki beberapa ukuran dan kemasan. Setiap kombinasi ukuran, jenis kemasan, dan jumlah isi memiliki SKU unik serta harga sendiri.
- Admin mengisi ukuran **per satuan**, memilih **Satuan / Pack / Dus**, lalu mengisi **harga per kemasan**. Pack dan dus memerlukan jumlah isi; isi sebenarnya ditentukan admin, bukan angka bawaan.
- Isi dus adalah **total satuan dalam dus**. Jumlah pack di dalam dus opsional. Contoh: isi 24 satuan, jumlah pack 4 → 4 pack × 6 satuan. Angka jumlah pack harus membagi isi dus secara tepat.
- Pembeli memilih ukuran, kemudian kemasan yang tersedia untuk ukuran tersebut. Harga, SKU, dan jumlah mengikuti pilihan. Jika berpindah ukuran, kemasan yang sama dipertahankan bila tersedia; jika tidak, pilihan beralih ke kemasan yang tersedia dan keterangannya terlihat.
- Jumlah menghitung kemasan: 2 pack isi 6 = 12 satuan; biaya barang = 2 × harga satu pack. Satuan, pack, dan dus muncul sebagai baris berbeda di keranjang.
- Jenis kemasan, isi, ukuran, jumlah, dan harga ikut dicatat di checkout serta riwayat pesanan. Perubahan katalog sesudahnya tidak mengubah informasi pesanan yang sudah dibuat.
- Jika isi/harga barang di keranjang berubah, pembeli harus meninjau informasi terbaru sebelum checkout. Keterangan kemasan terbaru ditampilkan sebelum tombol pembaruan.
- Produk lama tetap menjadi **Satuan, isi 1**, dengan SKU, nama, dan harga yang sama. Riwayat pesanan lama tanpa metadata kemasan tetap dapat dibaca tanpa mengarang jumlah isi.

## Memasang pembaruan

1. Hentikan kedua layanan pengembangan. Cadangkan proyek, terutama folder `data` yang berisi database Anda.
2. Ekstrak `BAM-kemasan-pack-dus.zip`. Dari folder `E-commerse`, salin folder **src dan server**, serta `public`, `index.html`, `package.json`, `package-lock.json`, `vite.config.js`, `.gitignore`, `.oxlintrc.json`, dan panduan ke proyek yang sedang digunakan. Timpa berkas dengan nama yang sama.
3. **Jangan menghapus atau menimpa folder data.** ZIP tidak memuat database, akun, ataupun kata sandi. Pembaruan ini memerlukan kode frontend dan server sekaligus; menyalin `src` saja belum cukup.
4. Pada terminal di folder proyek yang berisi `package.json`, jalankan:

```powershell
npm ci --include=dev
```

Gunakan Node.js 24 atau lebih baru. Setelah itu jalankan terminal pertama:

```powershell
npm run server
```

Saat server dijalankan, struktur varian katalog lama diperbarui otomatis dalam satu transaksi. SKU, foto, harga, akun, dan revisi katalog dipertahankan. Database tidak perlu dibuat ulang. Jika perubahan struktur gagal, transaksi dibatalkan.

Jalankan terminal kedua:

```powershell
npm run dev
```

Buka alamat yang ditampilkan Vite lalu muat ulang halaman, termasuk tab admin yang sebelumnya terbuka. Panduan akses admin tersedia pada `BACKEND-TAHAP-1.md`.

## Cara mengisi produk

Pada **Tambah produk** atau **Edit produk**, buka bagian **03 · Ukuran, kemasan, dan harga**. Tekan **+ Tambah varian** untuk setiap kemasan tambahan. Nama, merek, PT, kategori, dan deskripsi tetap satu produk.

Contoh pengisian berikut hanya untuk memahami format, bukan harga atau isi resmi produk:

| SKU | Ukuran per satuan | Satuan ukuran | Jenis kemasan | Isi kemasan | Pack dalam dus | Harga per kemasan |
| --- | --- | --- | --- | --- | --- | --- |
| BUMBU-23G | 23 | Gram (g) | Satuan | 1 otomatis | — | Rp 12.000 |
| BUMBU-23G-PACK6 | 23 | Gram (g) | Pack | 6 | — | Rp 65.000 |
| BUMBU-23G-DUS24 | 23 | Gram (g) | Dus | 24 | 4, opsional | Rp 250.000 |

Untuk 62g atau 130g, tambahkan varian tersendiri hanya untuk kombinasi kemasan yang benar-benar dijual. SKU harus berbeda, termasuk saat ukurannya sama. Pack isi 6 dan pack isi 12 dapat menjadi dua varian yang berbeda.

Minimal isi pack/dus adalah 2 satuan, maksimal 1.000.000, tanpa pecahan. Jumlah pack dalam dus boleh dikosongkan; bila diisi, minimal 2 pack dan masing-masing minimal 2 satuan. Maksimal 20 varian per produk. SKU yang sudah tersimpan tetap dipertahankan seperti sebelumnya.

## Pemeriksaan

107 pengujian otomatis lulus, termasuk pengisian admin melalui API, perpindahan ukuran dengan kemasan yang tidak tersedia, perhitungan keranjang/checkout, riwayat setelah katalog berubah, validasi duplikat/isi, dan migrasi database lama yang dibuka kembali. Pemeriksaan kode dan build berhasil.

Pengujian interaksi menggunakan DOM otomatis. Pemeriksaan visual desktop/HP di browser proyek Anda masih perlu dilakukan setelah pemasangan, karena browser alat belum dapat mengakses server lokal lingkungan kerja.

1. Edit satu produk: tambahkan pack dan dus pada ukuran yang sudah ada, lalu simpan dan muat ulang halaman.
2. Buka detail produk. Periksa pilihan ukuran tidak berulang, harga mengikuti kemasan, dan ukuran tanpa pack/dus hanya menampilkan kemasan yang tersedia.
3. Beli 2 pack lalu 1 dus; periksa baris, jumlah isi, subtotal, checkout, serta detail pesanan. Muat ulang detail pesanan untuk memastikan datanya tetap sama.
4. Periksa di HP: pilihan kemasan dan keterangan isi harus terbaca tanpa melewati lebar layar.

```powershell
npm test
npm run lint
npm run build
```

Stok dan konversi persediaan belum dibuat. Pesanan/pembayaran masih simulasi, dan riwayat tetap memakai `sessionStorage` pada tab browser. Jumlah isi kemasan saat ini membantu memilih dan menghitung pembelian; belum mengurangi stok gudang. Tahap berikutnya memerlukan stok serta pesanan pada database.
