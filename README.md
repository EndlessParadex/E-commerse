# BAM — E-commerce

Frontend React dan Vite dengan API Node.js serta database SQLite untuk akun dan katalog.

Panduan pemasangan, pembuatan admin, impor data pratinjau, dan batas tahap ini ada di [BACKEND-TAHAP-1.md](./BACKEND-TAHAP-1.md).

Pembaruan tombol kembali, pembatalan, pilihan pembayaran, dan katalog tersedia di [FRONTEND-TAHAP-4.md](./FRONTEND-TAHAP-4.md).

Pilihan Satuan, Pack, dan Dus serta panduan memperbarui database lama tersedia di [KEMASAN-PACK-DUS.md](./KEMASAN-PACK-DUS.md).

```powershell
npm ci --include=dev
npm run dev:full
```

```powershell
npm test
npm run lint
npm run build
```

Stok dan pesanan di database akan ditambahkan pada tahap berikutnya. Checkout saat ini masih simulasi.

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
