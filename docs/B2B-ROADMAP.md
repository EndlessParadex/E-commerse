# BAM B2B — Rencana migrasi bertahap

Branch: `feature/b2b-store-sales-shared-cart`.

## Tahap 1: Identitas toko & Sales (fondasi backend)

- Tabel terpisah untuk ID toko stabil (`TKB-000001`), nama, nomor HP, alamat.
- Pemilik BAM menghubungkan akun pembeli ke toko, mendaftarkan akun Sales, dan menugaskan Sales ke toko.
- `GET /api/b2b/stores`: daftar toko berdasarkan hak akses (pemilik toko / Sales yang ditugaskan); Admin melihat semuanya.
- `GET /api/b2b/sales`: staf Admin melihat daftar Sales aktif.
- `POST /api/b2b/stores/create`: Owner BAM membuat toko.
- `POST /api/b2b/sales/appoint`: Owner BAM menunjuk akun pengguna menjadi Sales.
- `POST /api/b2b/stores/:id/members`: Owner BAM menghubungkan pembeli dengan toko.
- `POST /api/b2b/stores/:id/sales`: Owner BAM menugaskan Sales ke toko.
- Semua mutasi mencatat aktor dan perubahan di tabel `b2b_store_audit`.

### Halaman Toko & Sales

- Buka menu **Toko & Sales** di ruang Admin (`#/admin/toko-sales`).
- Pemilik BAM dapat membuat toko, mencari akun pembeli aktif yang sudah disetujui, menghubungkan pembeli ke toko, mendaftarkan akun staf sebagai Sales, dan menugaskan Sales ke toko.
- Admin operasional dapat melihat toko, pembeli yang terhubung, dan penugasan Sales. Tombol perubahan hanya tersedia untuk pemilik; API juga memeriksa hak pemilik.
- Nama/kode/nomor HP toko dan nama/email calon akun dicari di server dengan halaman berisi 25 hasil, sehingga hasil pencarian tidak terbatas pada halaman yang sedang ditampilkan.
- `GET /api/b2b/stores?page=1&q=...` mengembalikan hasil beserta `total`, `page`, `pageSize`, dan `pages`. Pembeli/Sales tetap hanya mendapatkan toko yang terhubung/ditugaskan. Bentuk respons tanpa parameter `page` tetap kompatibel dengan API sebelumnya.
- `GET /api/b2b/stores/:id` khusus Admin/Pemilik mengembalikan profil toko beserta akun pembeli dan Sales yang terhubung.
- `GET /api/b2b/accounts?page=1&q=...` khusus Pemilik mencari akun non-Admin aktif yang sudah disetujui dan belum menjadi Sales.
- Data disimpan ke SQLite. Perubahan yang gagal mempertahankan isian; pemuatan ulang yang gagal setelah penyimpanan berhasil menampilkan kesalahan pemuatan secara terpisah.

**Batas tahap ini:** login masih memakai akun yang tersedia. Layanan SMS OTP belum dipilih. Keranjang bersama, finalisasi khusus Admin, dan faktur B2B tanpa harga belum diimplementasikan; alur checkout yang tersedia masih mengikuti versi sebelumnya.

### Verifikasi halaman

1. Gunakan Node.js 24+, jalankan `npm ci`, lalu `npm run dev:full` dari branch B2B.
2. Masuk dengan akun **Pemilik BAM**, buka **Toko & Sales**, pilih **Tambah toko**, isi nama, nomor HP Indonesia, dan alamat, kemudian simpan. Pastikan kode `TKB-......` muncul.
3. Pilih toko, cari akun pembeli yang sudah aktif/disetujui, dan pilih **Hubungkan pembeli**. Pastikan akun masuk pada daftar pembeli toko tersebut.
4. Cari akun staf non-Admin, pilih **Daftarkan sebagai Sales**, periksa nama/email pada dialog, lalu konfirmasi. Pilih akun itu pada **Tugaskan Sales ke toko ini**, kemudian simpan penugasan.
5. Muat ulang halaman dan pastikan toko, pembeli, dan penugasan tetap ada. Masuk sebagai Admin operasional: data dapat dibaca, tetapi form perubahan tidak tersedia.
6. Jalankan `node --test server/b2bStores.test.js server/b2bManagement.test.js src/pages/b2bManagementUi.test.js`, `npm test`, `npm run lint`, dan `npm run build`.

## Tahap 2: Autentikasi pembeli menggunakan nomor HP

- Integrasi penyedia SMS OTP asli, throttle pengiriman dan verifikasi OTP, batas percobaan, expiry, dan anti-enumeration.
- Migrasi akun lama, verifikasi kepemilikan nomor HP, serta pemetaan akun ke toko.
- Jangan gunakan nomor HP saja sebagai bukti autentikasi.

## Tahap 3: Keranjang bersama per toko dan per periode

- `cart_cycles`, `cart_items`, `cart_events`: simpan pada SQLite, tidak hanya localStorage.
- Satu keranjang aktif per toko dan jadwal pengiriman, dengan `revision` untuk mencegah perubahan bersamaan saling menimpa.
- Pembeli hanya boleh mengedit keranjang tokonya. Sales hanya boleh mengedit keranjang toko yang ditugaskan.
- Admin dapat memeriksa semua keranjang; tidak boleh menciptakan order final dari jalur pembeli.

## Tahap 4: Finalisasi eksklusif Admin

- Admin mengunci keranjang pada jadwal pemrosesan (manual, bukan otomatis).
- Harga disnapshot, stok dicek dan dicadangkan dalam transaksi atomik, idempotency key mencegah order ganda.
- Hanya endpoint Admin yang membuat order final. Checkout pembeli dan Sales tidak boleh memanggil jalur pembuatan order lama.
- Sistem COD dan pesanan historis tetap dapat dibaca.

## Tahap 5: Portal Sales, Pembeli, dan Admin

- Sales: toko yang ditugaskan, produk, penawaran, keranjang bersama dan riwayat aktivitas.
- Pembeli: toko sendiri, katalog, harga, diskon dan keranjang bersama.
- Admin: antrean keranjang, jadwal, finalisasi dan persiapan pengiriman.

## Tahap 6: Faktur/daftar barang tanpa harga

- Dokumen cetak **hanya nama toko, nama Sales, dan daftar barang**.
- Kolom: nama barang, Satuan, Pack, Box, Dus, Renceng. Baris bawah: total kuantitas per kemasan dan jumlah jenis barang.
- Tidak menampilkan harga, diskon, subtotal, total COD, alamat, ataupun tanda tangan.
- Harga dan diskon **tetap terlihat pada website** dan tetap tersimpan dalam database untuk laporan internal.
- Tambahkan Box dan Renceng sebagai varian kemasan; konversi kemasan khusus produk tidak boleh ditebak.
- Faktur historis harus ditangani secara eksplisit supaya tidak bocor angka harga pada versi cetak baru.

## Pengujian minimum sebelum produksi

Jalankan `node --test server/b2bStores.test.js`, `npm test`, `npm run lint`, dan `npm run build`. Uji pula akses lintas toko, racing keranjang, idempotensi, stok, kompatibilitas pesanan lama, dan tidak munculnya nominal pada halaman print.
