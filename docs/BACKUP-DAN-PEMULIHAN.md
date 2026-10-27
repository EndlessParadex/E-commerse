# Backup dan pemulihan database BAM

Gunakan Node.js 24+. Alat memakai SQLite backup API sehingga salinan mencakup transaksi yang sudah committed pada database WAL yang masih berjalan. Jangan menyalin berkas `.sqlite` aktif sendirian karena perubahan dapat masih berada di WAL.

## Buat dan periksa

Jalankan dari direktori proyek:

```powershell
npm run backup -- --source data/bam.sqlite --out backups
npm run backup:verify -- --from backups/bam-FOLDER-HASIL
```

Tanpa `--source`, alat memakai `BAM_DB_PATH` dari lingkungan/`.env`, lalu `data/bam.sqlite`. Setiap backup membuat folder baru dengan `database.sqlite`, `manifest.json` dan `database.sqlite.mail-key` bila kunci email berada di samping database sumber. Alat memeriksa `quick_check`, foreign key dan tabel utama sebelum/sesudah snapshot, serta SHA-256 berkas. Jumlah akun/pesanan dilaporkan untuk pemeriksaan.

Folder `backups/` diabaikan Git. Simpan salinan tambahan di lokasi terkontrol yang terpisah dari komputer server. Database dan kunci dapat berisi/memberi akses ke informasi sensitif; batasi akses folder/media. Checksum mendeteksi kerusakan/perubahan dibanding manifest, bukan tanda tangan keaslian terhadap penyerang yang dapat mengubah keduanya.

`.env`, reverse proxy, sertifikat dan rahasia terpisah tidak dimasukkan. Jika memakai `BAM_MAIL_QUEUE_KEY`, amankan nilainya secara terpisah agar pengaturan email dapat dibuka kembali. Jangan unggah backup, kunci atau `.env` ke GitHub.

## Buktikan restore

```powershell
npm run backup:restore -- --from backups/bam-FOLDER-HASIL --to data/pemulihan-uji.sqlite
```

Restore memverifikasi backup lalu membuat database di **lokasi baru**. Tujuan yang sudah mempunyai database, WAL, SHM atau kunci ditolak agar data tidak tertimpa. Alat tidak mengganti database server yang sedang berjalan.

Untuk beralih ke hasil restore setelah pemeriksaan:

1. Hentikan server BAM dan worker yang memakai database.
2. Pertahankan database lama beserta berkas pendampingnya untuk pemulihan balik.
3. Atur `BAM_DB_PATH` ke hasil restore. Gunakan konfigurasi email/rahasia yang sesuai instalasi.
4. Jalankan server dengan versi kode yang sesuai. Periksa akun, jumlah/detail pesanan, stok, toko, keranjang dan kemampuan membuka pengaturan email.
5. Setelah yakin, buka akses pengguna. Jangan mengoperasikan dua server pada database hasil salinan berbeda untuk transaksi produksi yang sama.

Pengujian otomatis membuktikan snapshot WAL, verifikasi, restore ke database baru, penolakan overwrite dan deteksi kerusakan pada database contoh. Tetap lakukan latihan pemulihan dengan backup instalasi sebenarnya sebelum penggunaan operasional.
