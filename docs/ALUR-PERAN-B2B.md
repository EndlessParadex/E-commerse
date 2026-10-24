# Alur peran dan keranjang BAM B2B

Dokumen ini adalah sumber ringkas untuk perilaku aktif aplikasi.
Dokumen versi di direktori ini tetap dipertahankan untuk riwayat keputusan teknis.

## Pemisahan identitas, toko dan keranjang

- **Pemilik BAM** (akun admin dengan hak pemilik): membuat toko, memilih pemilik toko,
  mengangkat Sales dan mengatur hubungan akun/toko.
- **Admin BAM**: meninjau dan memfinalisasi pesanan **keranjang bersama toko**. Admin
  dapat membantu menambahkan barang ke keranjang toko yang terbuka, tetapi belum boleh
  mengubah metode pembayaran toko tanpa izin yang sesuai.
- **Penanggung jawab toko**: akun pembeli yang secara eksplisit ditetapkan oleh Pemilik
  BAM; bukan Pemilik BAM. Satu akun penanggung jawab dipilih dari akun aktif yang belum
  terhubung dengan toko lain.
- **Anggota toko**: akun pembeli yang dihubungkan ke toko. Hubungan dapat berbeda dari
  status penanggung jawab. Penggantian penanggung jawab secara default mencabut akses
  pemilik sebelumnya, kecuali opsi "pertahankan sebagai anggota" dipilih.
- **Sales**: akun pengguna yang ditunjuk Pemilik BAM dan memperoleh penugasan ke toko
  tertentu. Sales tidak otomatis menjadi pemilik toko.

## Mode keranjang

| Kemampuan | Pembeli B2B | Sales B2B | Admin BAM |
| --- | --- | --- | --- |
| Melihat toko terhubung/ditugaskan | Ya | Ya | Ya |
| Mengubah keranjang toko terbuka sesuai hak akses | Ya | Ya | Ya |
| Membuat pesanan toko final | Tidak | Tidak | Ya |
| Memakai keranjang pribadi terpisah | Ya | Ya | Melalui alur pribadi reguler |
| Checkout pribadi | Ya, setelah verifikasi email | Ya, setelah verifikasi email | Sesuai aturan pesanan reguler |
| Memilih/mengganti penanggung jawab | Tidak | Tidak | Hanya Pemilik BAM |

Beranda Sales menampilkan dua tujuan: **List Toko** (keranjang bersama) dan
**Belanja biasa** (katalog dalam mode pribadi). Beranda pembeli B2B juga memisahkan
**Toko Saya** dan **Belanja pribadi**. Pada halaman keranjang terdapat tombol
perpindahan mode. Keranjang pribadi tersimpan terpisah menurut akun pada browser,
sementara keranjang toko tersimpan pada server dan terkait toko/tanggal.

**Konsekuensi:** berpindah mode tidak memfinalisasi keranjang bersama.
Checkout reguler hanya mengirim item keranjang pribadi ke `POST /api/orders`,
dan backend tetap memvalidasi harga, ketersediaan, kepemilikan akun, serta pembayaran.
Finalisasi keranjang bersama tetap memerlukan Admin BAM.

## Perlindungan dan deployment

1. Pakai HTTPS dan set `BAM_APP_ORIGIN=https://domain-anda`. Cookie sesi juga dapat
   dipaksa `Secure` dengan `BAM_SECURE_COOKIES=true`; `NODE_ENV=production`
   tetap disarankan untuk deployment.
2. Jangan mengunggah `data/*.sqlite`, `*.mail-key`, file `.env`,
   ataupun ZIP yang memuat rahasia dan database asli.
3. Jika data asli sudah dibagikan, lakukan rotasi password dan kunci email dengan
   prosedur backup serta migrasi yang benar. Menghapus file dari Git lokal saja tidak
   mencabut salinan yang telah dibagikan.
4. Endpoint inventaris publik mengikuti pengaturan perusahaan
   `profile.showExactStock`. Saat dimatikan, klien publik menerima status
   ketersediaan, bukan jumlah stok persis. Tetapkan kebijakan ini secara sadar
   sebelum produksi.
5. CI memeriksa lint, tes dan build pada branch fitur, pull request, serta `main`.

## Batasan yang masih perlu diuji

- Uji langsung browser desktop dan HP pada lebar 375, 768 dan 1280 px.
- Uji dua tab/two devices, sesi kedaluwarsa, dan kegagalan jaringan saat checkout.
- Uji beban dan race condition menggunakan database dan konfigurasi **pengujian**.
- Pemisahan modul domain dari `src/` untuk backend dan pemecahan file besar
  merupakan refactor bertahap tersendiri; jangan dilakukan tanpa regression suite.

## Batas pemesanan dan periode terlewat (opsional di development)

Tidak ada jam cut-off default sampai operasional BAM menyetujuinya. Untuk mengaktifkan,
set **keduanya** sebelum menjalankan server:

```powershell
$env:BAM_B2B_CUTOFF_DAYS_BEFORE = '1'
$env:BAM_B2B_CUTOFF_TIME = '18:00'
npm run dev:full
```

Contoh: pesanan pengiriman Senin ditutup Minggu pukul 18:00 WIB. Nilai tersebut
hanya ilustrasi; bukan kebijakan otomatis BAM. Semua perhitungan memakai WIB (UTC+7).
Nilai hari harus 0–14. Jika tidak diatur, penguncian tetap manual seperti sebelumnya.

Saat cut-off aktif, backend mengunci keranjang yang sudah ada ketika diakses atau
ketika antrean/periode dibaca. Catatan `auto_lock` dicatat dalam tabel
`b2b_cycle_lifecycle_events`. Keranjang yang belum dibuat tidak bisa dibuat
setelah batas tersebut. Data barang dan riwayat tidak dihapus; finalisasi tetap
hanya dapat dilakukan Admin dan stok baru dipesan setelah finalisasi.
Status `overdue` pada respons keranjang berarti tanggal pengiriman sudah terlewati
dan keranjang belum difinalisasi. Itu bukan pembatalan otomatis. Pemindahan
periode harus melewati alur Admin yang diaudit; jangan menyalin barang otomatis.
