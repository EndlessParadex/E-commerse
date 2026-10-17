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

**Penting:** Tahap 1 adalah API internal, belum mempunyai halaman UI untuk penugasan. Belum ada login nomor HP, shared cart, atau perubahan aturan checkout; karena itu jangan aktifkan sebagai alur produksi B2B sebelum tahap selanjutnya selesai.

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
