# Kebijakan BAM: COD dan gratis ongkir

## Pembeli (pesanan baru)

- Semua pesanan baru menggunakan **COD / Bayar di tempat**. Tidak ada pilihan transfer bank di checkout.
- **Ongkir Rp0** dan **total harga final** dihitung dari harga katalog terbaru ketika checkout; backend mengecek harga dan stok.
- Ketika checkout berhasil, sistem mencadangkan stok secara atomik dan status langsung **Diproses**. Pembeli **tidak perlu** menekan tombol persetujuan harga kedua.
- Pembeli membayar nominal total tersebut ketika barang diterima.
- Verifikasi email dan persetujuan akun tetap berlaku seperti sebelumnya.

## Pengelola toko

- Di Pesanan, status **Diproses** menunjukkan stok sudah dicadangkan dan nominal COD tidak boleh ditambah ongkir.
- Siapkan barang, lalu gunakan **Catat pengiriman** saat pengiriman benar-benar dilakukan, dan **Selesaikan pesanan** ketika barang diterima dan pembayaran COD telah diterima.
- Jika stok tidak mencukupi atau harga katalog berubah sebelum checkout disimpan, checkout ditolak tanpa pesanan parsial.
- Ketentuan biaya operasional atau penyerahan barang adalah urusan toko; sistem tidak mengenakan ongkir pada pembeli.

## Data historis

- Pesanan yang sudah ada, termasuk penawaran yang masih menunggu persetujuan dan riwayat transfer bank, **tidak dimodifikasi otomatis**. Penyimpanan tetap menerima pembayaran historis untuk penyelesaian pesanan lama.
- Admin perlu meninjau atau menyelesaikan pesanan lama sesuai ketentuan saat pesanan tersebut dibuat. Jangan mengubah total historis secara sepihak.

## Pengujian

Jalankan dari root repository:

```powershell
git pull origin feature/manual-account-approval-20261015
node --test server/codFreeShipping.test.js
npm test
npm run lint
npm run build
```

Jangan lanjut ke hosting publik jika ada test gagal. Untuk uji manual, gunakan akun pelanggan email-terverifikasi: checkout satu produk, pastikan ongkir **GRATIS**, metode **COD**, total final, dan pesanan langsung **Diproses** pada pelanggan dan admin. Uji juga pembatalan serta pengiriman.
