# BAM — Pack kembali menjadi Satuan setelah disimpan

## Penyebab yang ditemukan

Pemeriksaan API lokal pada 9 Oktober 2026 menunjukkan seluruh 29 SKU belum memiliki informasi kemasan dalam respons server. SKU `KSK-LH-180g` hanya mengembalikan ukuran 180g dan harga Rp 250.000, tanpa jenis kemasan ataupun isi pack. Berkas frontend dan server pada proyek sudah cocok dengan paket kemasan, tetapi server API yang sedang berjalan masih menggunakan versi lama.

Tampilan Vite dapat memperbarui kode saat berkas disalin. Proses yang dijalankan dengan `npm run server` perlu dihentikan dan dijalankan ulang agar memuat kode server terbaru. Bila server dijalankan dari folder proyek lain, gunakan folder proyek yang sudah diperbarui.

## Memperbaiki produk yang sudah tersimpan

1. Pada terminal yang menjalankan **npm run server**, tekan **Ctrl+C**. Pastikan server lama berhenti. Jika memakai `npm run dev:full`, hentikan terminal tersebut.
2. Jalankan server dari folder proyek yang digunakan:

```powershell
Set-Location -LiteralPath 'C:\Productive\CV BAM\E-commerse - Copy'
npm run server
```

Terminal untuk `npm run dev` boleh tetap berjalan. Jika menggunakan `dev:full`, jalankan `npm run dev:full` kembali dari folder proyek yang sama sebagai pengganti dua terminal.

3. Muat ulang browser dengan **Ctrl+Shift+R**. Isian yang belum disimpan perlu dicatat sebelum memuat ulang.
4. Edit **Kusuka Lada Hitam**, SKU `KSK-LH-180g`: pilih **Pack**, isi **12**, ukuran **180g per satuan**, harga **Rp 250.000 per pack**, lalu simpan kembali.
5. Daftar produk seharusnya menampilkan **180g · Pack isi 12 satuan**. Buka edit lagi atau muat ulang daftar untuk memastikan isinya tetap tersimpan.

Informasi kemasan yang dibuang server lama perlu diisi ulang. Tidak perlu membuat produk baru, mengganti SKU, menghapus katalog, atau menghapus database.

## Pemeriksaan tambahan pada kode

Paket `BAM-perbaikan-simpan-kemasan.zip` menambahkan pemeriksaan sebelum menyimpan Pack/Dus. Jika API masih memakai versi lama, permintaan penyimpanan dihentikan, alasan ditampilkan, dan isian form tetap tersedia. Balasan sukses yang kehilangan informasi kemasan juga tidak akan dianggap sebagai keberhasilan.

Untuk memasang pemeriksaan ini:

1. Hentikan server, lalu salin berkas dalam folder `E-commerse` pada ZIP ke folder proyek yang sama; timpa berkas yang sama. Paket memuat perubahan `src/data/adminStore.js`, `server/catalog.js`, serta satu pengujian tambahan dan panduan ini.
2. Pertahankan folder **data**. Paket tidak memuat database atau akun.
3. Jalankan ulang server dan muat ulang browser sesuai langkah di atas. Dependensi tidak berubah.

109 pengujian otomatis, lint, dan build lulus. Pengujian mencakup server lama yang menolak penyimpanan sebelum data dikirim, penyimpanan Pack isi 12 setelah server diperbarui, serta balasan server yang kehilangan metadata kemasan.

Perbaikan kode dibuat pada salinan kerja Codex. Folder proyek yang sedang Anda jalankan dan produk pada database belum diubah langsung oleh Codex.
