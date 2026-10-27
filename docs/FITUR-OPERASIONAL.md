# Kemasan, daftar barang B2B, dan jadwal pengiriman

## Box dan Renceng

Form varian produk menyediakan Satuan, Pack, Box, Dus dan Renceng. Setiap kemasan selain Satuan harus mempunyai jumlah satuan dasar yang benar. Box tidak otomatis sama dengan Dus atau Karton. Tidak ada faktor konversi standar yang ditebak.

Ketersediaan, reservasi dan penjualan tetap dihitung per produk/ukuran dalam satuan dasar. Editor stok menampilkan kemasan yang tersedia beserta sisa satuannya; setiap bagian hanya dihitung sekali. Contoh 2 Box isi 24 dan 3 Renceng isi 12 menggunakan 84 satuan. Migrasi katalog mempertahankan SKU, revisi, harga dan stok lama. Backup sebelum upgrade database operasional.

## Dokumen B2B tanpa harga

Buka **Detail Pesanan** atau kartu pesanan pada **Admin → Pesanan**, lalu buka **Daftar barang B2B · tanpa harga** pada pesanan toko yang telah difinalisasi. Pilih format lalu **Cetak / simpan PDF tanpa harga**.

- A4: 210 × 297 mm.
- Dot matrix setengah: continuous form 9,5 × 5,5 inci (241,3 × 139,7 mm).
- Dot matrix penuh: continuous form 9,5 × 11 inci (241,3 × 279,4 mm).

Samakan ukuran pada pengaturan printer/driver, gunakan skala 100%, dan matikan header/footer browser. Lebar fisik continuous form termasuk tepi lubang; margin kiri/kanan menyediakan ruang tepi. Driver tertentu dapat mengabaikan ukuran CSS sehingga uji pada perangkat sebenarnya tetap diperlukan. Memilih format tidak mengubah pesanan atau langsung mencetak.

Dokumen hanya berisi nama toko, nama Sales dari snapshot finalisasi, nama/ukuran/isi kemasan barang, kolom Satuan/Pack/Box/Dus/Renceng, total setiap kemasan dan jumlah jenis barang. Barang dengan merek/nama/ukuran sama dihitung satu jenis walau dipesan dalam beberapa kemasan. Kuantitas pada kolom adalah jumlah kemasan yang dipesan.

Harga, diskon, pembayaran/COD, alamat, kontak, catatan bebas, dan tanda tangan tidak disalin ke dokumen. Harga tetap tersedia di website. Hanya dokumen yang dipilih masuk area cetak, walau Admin menampilkan banyak pesanan. Data berasal dari snapshot pesanan, bukan katalog hari ini. Snapshot barang/kemasan tidak lengkap ditolak untuk cetak; sistem tidak menebak dari katalog atau menawarkan faktur berharga sebagai pengganti.

## Kalender dan wilayah

**Akun Saya → Kalender** menampilkan jadwal rutin toko yang dapat diakses akun dan wilayah pengiriman pribadinya. Kalender hanya menandai jadwal; bukan pilihan tanggal checkout. Bulan dapat diganti; tiga pengiriman berikutnya ditampilkan. Hak toko diperiksa pada server dan daftar toko dipaginasi. Ketika belum diatur, website menyatakan bahwa jadwal belum ditetapkan.

Pemilik BAM membuka **Admin → Pengaturan Perusahaan → Wilayah & jadwal pengiriman pribadi**:

1. Masukkan nama wilayah, hari, frekuensi mingguan/dua mingguan dan tanggal acuan yang sesuai hari tersebut.
2. Simpan. Cari pembeli/Sales aktif yang disetujui, pilih wilayah dan simpan hubungannya.
3. Untuk mengubah wilayah, muat data terbaru, ubah lalu simpan. Revisi lama ditolak; isian tidak menimpa perubahan dari tab/perangkat lain.

Pengaturan wilayah hanya mengatur belanja pribadi. Jadwal toko B2B tetap dikelola pada **Toko & Sales**. Tidak ada wilayah atau hubungan akun contoh pada instalasi operasional.

Checkout pribadi menampilkan jadwal wilayah jika tersedia. Backend merekam wilayah, aturan jadwal dan tanggal berikutnya berdasarkan waktu WIB ketika pesanan pertama dibuat. Pengiriman ulang permintaan yang sama mengembalikan pesanan yang sama; tanggal pesanan lama tidak berubah saat jadwal diperbarui. Wilayah nonaktif menahan pesanan baru sampai Pemilik memperbaiki hubungan akun. Akun tanpa wilayah mempertahankan alur sebelumnya.

Jadwal rutin tidak menjamin tanggal tiba. Detail/status pesanan tetap menjadi acuan proses sebenarnya. Perubahan wilayah dan hubungan akun tercatat pada audit server. Admin operasional, Sales dan pembeli tidak dapat mengubah pengaturan ini melalui API.

## Layanan dan validasi

Status **Kesiapan toko** pada Admin membedakan pengaturan email/WhatsApp yang tersedia dari bukti pengiriman nyata. Layanan harus dikonfigurasi dengan kredensial sah milik BAM. Pengujian otomatis memakai pengirim uji; tidak mengirim ke pelanggan.

Batas waktu toko dapat diaktifkan melalui `BAM_B2B_CUTOFF_DAYS_BEFORE` dan `BAM_B2B_CUTOFF_TIME` (WIB) setelah kebijakan ditentukan. Kedua nilai harus diisi bersama. Saat kosong, tidak ada cut-off buatan; penguncian/review/finalisasi tetap berlaku.
