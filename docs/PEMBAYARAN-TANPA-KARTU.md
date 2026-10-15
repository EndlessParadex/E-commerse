# BAM — Hapus metode Kartu dari checkout

> Dokumen tahap sebelumnya. Untuk alur aktif v31 (rekening toko, ongkir, penawaran, verifikasi email dan bukti transfer), gunakan [TRANSAKSI-TOKO.md](./TRANSAKSI-TOKO.md).

Pilihan **Kartu**, termasuk Visa, Mastercard, dan JCB, dihapus dari checkout sesuai pilihan pengelola. Membuat pesanan baru dengan ID metode kartu juga ditolak oleh validasi checkout.

Pilihan yang tersedia sekarang:

- Bayar di tempat (COD).
- Transfer bank: BCA, Mandiri, BNI, BRI.
- Virtual Account: BCA, Mandiri, BNI, BRI.
- E-wallet: DANA, GoPay, ShopeePay, OVO.

Halaman bantuan mengikuti pilihan tersebut. Riwayat pesanan lama tetap dapat dibaca dengan metode pembayaran yang dahulu tercatat; menghapus pilihan Kartu tidak menghapus pesanan.

## Memasang

1. Ekstrak `BAM-pembayaran-tanpa-kartu.zip`.
2. Salin isi folder `E-commerse` pada ZIP ke folder proyek yang digunakan, lalu timpa berkas dengan nama yang sama. Perubahan berada pada `src/state/paymentMethods.js`, `src/components/shop/PaymentPicker.jsx`, dan `src/pages/StoreInfoPage.jsx`; paket juga memuat pembaruan pengujian serta panduan.
3. Muat ulang browser dengan **Ctrl+Shift+R**. Jika tampilan belum berubah, jalankan ulang `npm run dev` dari folder proyek yang sudah diperbarui.
4. Buka checkout dan periksa tombol **Kartu** tidak muncul. Pilih Transfer bank, Virtual Account, atau E-wallet dan pastikan layanan masing-masing masih tersedia.

Server dan database tidak berubah pada pembaruan ini. Pertahankan folder `data`; tidak perlu memasang ulang dependensi.

109 pengujian otomatis, lint, dan build lulus, termasuk pemeriksaan tombol Kartu tidak muncul dan metode Visa/Mastercard/JCB ditolak untuk checkout baru. Pemeriksaan visual desktop/HP tetap perlu dilakukan pada browser proyek setelah pemasangan.

Pembayaran masih merupakan simulasi frontend. Menghapus metode Kartu tidak mengaktifkan pemrosesan dana nyata.
