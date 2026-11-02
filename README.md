# BAM — E-commerce

Aplikasi React/Vite dengan API Node.js dan SQLite untuk katalog, belanja pribadi, keranjang toko bersama, stok, serta pengelolaan pesanan.

## Menjalankan proyek

Gunakan Node.js 24 atau lebih baru. Dari folder repositori:

```powershell
npm ci
npm run dev:full
```

Untuk instalasi perusahaan baru, ikuti [mode perusahaan](docs/MODE-PERUSAHAAN.md). Untuk akun dan data demonstrasi, ikuti [setup PC demo](docs/SETUP-PC-DUMMY.md). Jangan menjalankan seed pada database produksi.

## Verifikasi sebelum push

```powershell
npm run hooks:install
npm run verify
```

Hook pre-push hanya menjalankan format dan lint tanpa warning (`npm run verify:quick`). Jalankan `npm run verify` sebelum mengirim perubahan perilaku; seluruh tes, build produksi, dan audit dependensi tetap dijalankan di CI. Hook perlu dipasang sekali pada setiap clone. Perbaiki kegagalan lokal sebelum push; CI tetap menjadi pemeriksaan independen. Hook lokal dapat dilewati oleh Git dan bukan pengganti aturan branch.

## Build dan server

```powershell
npm run build
npm run server
```

Server mengirim Brotli atau gzip untuk aset JS/CSS/SVG dan HTML publik ketika browser mendukungnya, dengan `Vary: Accept-Encoding`, negosiasi kualitas encoding, dan cache kompresi aset terbatas. API akun dan transaksi tidak dikompresi. Semua respons mendapat perlindungan frame, nosniff, dan referrer policy. HSTS aktif bila URL publik terkonfigurasi HTTPS atau koneksi server memakai TLS; header dari klien tidak dipakai sebagai sumber kepercayaan. Ini tidak memasang sertifikat TLS atau menggantikan konfigurasi reverse proxy.

## Panduan utama

- [Alur peran dan pemisahan keranjang](docs/ALUR-PERAN-B2B.md)
- [Fitur operasional dan kemasan](docs/FITUR-OPERASIONAL.md)
- [Keamanan backend](docs/KEAMANAN-BACKEND.md)
- [Backup dan pemulihan](docs/BACKUP-DAN-PEMULIHAN.md)
- [WhatsApp pesanan dan faktur otomatis](docs/WHATSAPP-DAN-FAKTUR.md)
- [Roadmap dan status fitur](docs/B2B-ROADMAP.md)
- [Catatan versi dan panduan lama](docs/README-HISTORY.md)

## Struktur

- `src/`: frontend dan tes UI. Gaya komposisi beranda berada di `src/pages/StorefrontFeatureRail.css`; gaya kartu produk di `src/components/shop/ProductCard.css`. Edit aturan yang ada sebelum menambahkan override.
- `server/`: API, SQLite, dan tes integrasi.
- `public/`: aset statis.
- `tools/`: alat operasional dan tesnya.
- `data/`: database lokal yang tidak dilacak Git.

Stok dan pesanan tersimpan di database. Transfer memerlukan konfirmasi Admin; COD dibayar saat diterima. Gateway pembayaran dan kurir otomatis belum terintegrasi. Verifikasi lokal tidak membuktikan konfigurasi produksi atau kesesuaian visual terhadap referensi desain.
