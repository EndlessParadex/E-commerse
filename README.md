# BAM — E-commerce

Frontend React dan Vite dengan API Node.js serta database SQLite untuk akun, katalog, stok dan pesanan.

Gunakan **Node.js 24 atau lebih baru**. Pembaruan **v31** menyediakan COD dan transfer manual yang dikonfigurasi toko, penawaran ongkir/total akhir, persetujuan pelanggan, unggah bukti, notifikasi email pesanan, serta cetak faktur/ringkasan. Panduan utama ada di [TRANSAKSI-TOKO.md](./docs/TRANSAKSI-TOKO.md).

**Verifikasi email wajib sebelum memesan.** Pendaftaran tetap menyimpan kata sandi awal meskipun SMTP belum diisi, tetapi pelanggan belum dapat memesan sebelum verifikasi. Admin menampilkan status kesiapan email dan rekening. Siapkan layanan melalui [EMAIL-DAN-PROXY.md](./docs/EMAIL-DAN-PROXY.md). Rincian perlindungan/migrasi ada di [KEAMANAN-BACKEND.md](./docs/KEAMANAN-BACKEND.md).

Tautan berbagi produk memakai `/produk/SKU` dengan HTML/metadata dari server, sedangkan tautan hash lama tetap berfungsi. Empat banner dikompres dari sekitar 5 MB menjadi 1,06 MB. Halaman admin dimuat terpisah dan error render memiliki layar pemulihan.

Pembaruan backend **v23** menyimpan stok dan pesanan pada database, menghubungkan pesanan ke akun pelanggan, serta menyediakan pencatatan pembayaran/pengiriman oleh admin. Panduan pemasangan dan batas integrasi ada di [BACKEND-TAHAP-2.md](./docs/BACKEND-TAHAP-2.md).

Mode perusahaan dengan katalog awal kosong dan pengaturan nama/logo/kontak tersedia pada [MODE-PERUSAHAAN.md](./docs/MODE-PERUSAHAAN.md). Untuk perusahaan baru gunakan `npm run dev:company`; perintah BAM di bawah tetap mempertahankan data instalasi yang sudah ada.

Panduan pemasangan, pembuatan admin, impor data pratinjau, dan batas tahap ini ada di [BACKEND-TAHAP-1.md](./docs/BACKEND-TAHAP-1.md).

Pembaruan tombol kembali, pembatalan, pilihan pembayaran, dan katalog tersedia di [FRONTEND-TAHAP-4.md](./docs/FRONTEND-TAHAP-4.md).

Pilihan Satuan, Pack, dan Dus serta panduan memperbarui database lama tersedia di [KEMASAN-PACK-DUS.md](./docs/KEMASAN-PACK-DUS.md).

Halaman admin pesanan/stok, alur pembayaran ulang/kedaluwarsa, serta resi simulasi tersedia di [FRONTEND-TAHAP-5.md](./docs/FRONTEND-TAHAP-5.md). Pemeriksaan visual versi ini perlu dilanjutkan setelah pemasangan; frontend belum disahkan untuk produksi.

```powershell
npm ci --include=dev
npm run dev:full
```

```powershell
npm test
npm run lint
npm run format:check
npm run build
```

Stok dan pesanan tersimpan di database. Transfer memakai rekening toko dan konfirmasi dana oleh admin; COD dibayar saat diterima. Ongkir ditetapkan toko dan disetujui pelanggan. VA/e-wallet gateway serta kurir belum terhubung otomatis; WhatsApp berupa tombol kontak manual. Dokumen frontend tahap sebelumnya menjelaskan versi pratinjau sebelum backend stok/pesanan ini.

## Struktur proyek

- `src/`: kode frontend aktif, aset, dan pengujiannya.
- `server/`: API, penyimpanan SQLite, dan pengujian server.
- `public/`: berkas statis untuk website.
- `data/`: database pengembangan, misalnya `bam.sqlite`; tidak diunggah ke Git.
- `tools/`: perapihan kode lama beserta pengujiannya.

## Merapikan salinan kode lama

Versi lama pernah menyimpan salinan frontend pada tingkat teratas proyek. Website memakai `src/main.jsx`, sehingga salinan lama tersebut dapat dirapikan. Untuk salinan lokal yang masih memilikinya:

```powershell
npm run cleanup
```

Perintah ini hanya mengarsipkan daftar file duplikat yang telah diperiksa. Cadangan dibuat dan diverifikasi dalam folder `.bam-code-backups` di samping folder proyek. File yang telah berubah menyebabkan perapihan berhenti sebelum pemindahan. Database, source aktif, dan file di luar daftar tetap tersedia. Perintah pemulihan ditampilkan setelah perapihan.

Pemeriksaan tanpa pemindahan:

```powershell
npm run cleanup -- --check
```

Sesudah perapihan, jalankan `npm test`, `npm run lint`, dan `npm run build` dari folder proyek. Tes seluruh repositori harus mencakup kode aktif dan alat perapihan tanpa menjalankan ulang tes pada salinan frontend lama.

Untuk deployment HTML produk publik, jalankan `npm run build`, lalu `npm run server` di belakang HTTPS/reverse proxy. Backend menyajikan `dist` dan metadata produk. `npm run preview` hanya untuk pratinjau statis. Jangan sertakan database atau `.env` di GitHub.

## Pemilik toko dan pengaturan email — v34

Layanan email dapat dikelola dari **Ruang admin → Pengaturan email** oleh akun pemilik toko. Admin operasional dan pembeli tidak memiliki akses. Penetapan pemilik pertama dilakukan satu kali dari komputer server; sesudahnya isian SMTP, alamat website dan email uji dikelola dari website. Lihat [PEMILIK-DAN-EMAIL.md](./docs/PEMILIK-DAN-EMAIL.md). Pengaturan SMTP dari website langsung digunakan, terenkripsi saat disimpan, dan tidak menampilkan kembali kata sandinya. Tidak ada dependensi baru pada pembaruan v34.

## Kelola akun — v35

Pemilik toko dapat mencari, menonaktifkan, mengaktifkan kembali, atau menghapus akun melalui **Ruang admin → Kelola akun**. Akun pemilik dilindungi; akun yang memiliki pesanan hanya dapat dinonaktifkan agar riwayat dan stok tetap terjaga. Setiap tindakan memerlukan konfirmasi kata sandi pemilik. Lihat [KELOLA-AKUN.md](./docs/KELOLA-AKUN.md). Tidak ada dependensi baru pada pembaruan v35.

## Panduan Gmail di website — v36

Halaman **Pengaturan email** menyediakan pilihan Gmail yang mengisi server/port otomatis, panduan membuat App Password Google, pengisian alamat pengirim, dan penerima email uji yang jelas. Akun Gmail serta App Password tetap disediakan pemilik toko. Lihat [EMAIL-GMAIL.md](./docs/EMAIL-GMAIL.md). Tidak ada dependensi baru pada pembaruan v36.

## Tampilan pembeli dan admin — v37

Perapihan mencakup keterbacaan kartu produk, pilihan varian, panel pembelian, checkout, stok dan formulir admin. Navigasi admin dikelompokkan menjadi Operasional, Katalog, dan Pengaturan dengan ikon seragam. Tema serta ukuran teks tetap mengikuti preferensi pengguna. Rincian ada di [TAMPILAN-V37.md](./docs/TAMPILAN-V37.md). Tidak ada dependensi baru pada pembaruan v37.

## Formulir perusahaan — v38

Pengaturan perusahaan memiliki jarak tepi yang konsisten, area logo dengan satu tombol unggah, kelompok profil/kontak, serta bagian pembayaran dan informasi produk yang lebih jelas. Kotak centang COD dan informasi stok memakai ukuran yang sesuai. Lihat [PERUSAHAAN-V38.md](./docs/PERUSAHAAN-V38.md). Tidak ada dependensi baru pada pembaruan v38.
