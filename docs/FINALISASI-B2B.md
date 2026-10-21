# Finalisasi pesanan toko oleh Admin

Foto produk tidak wajib untuk finalisasi. Barang, ukuran, harga, isi kemasan dan stok harus sudah sesuai data fisik. Fitur ini berjalan pada server/database BAM yang sama dengan keranjang toko.

## Alur penggunaan

1. Pembeli, Sales yang ditugaskan, maupun Admin/Pemilik memilih toko dan tanggal rencana pengiriman, lalu mengisi keranjang bersama ketika masih **Terbuka**. Admin/Pemilik menambah SKU langsung dari **Admin → Keranjang bersama**.
2. Admin/Pemilik membuka **Admin → Keranjang bersama**. Bagian **Antrean keranjang toko** menampilkan periode yang sudah dibuat. Cari nama/kode toko atau tanggal, pilih status, lalu tekan **Periksa keranjang**.
3. Tekan **Kunci untuk diperiksa**, periksa nama/kode toko dan tanggal, lalu konfirmasi. Pembeli dan Sales tetap dapat melihat isi; perubahan jumlah, penambahan, penghapusan dan pembaruan harga ditahan selama dikunci. Penguncian belum mencadangkan stok.
4. Tekan **Periksa dan finalisasi**. Daftar menunjukkan harga/kemasan terbaru, perubahan terhadap isian awal, jumlah satuan dasar yang diperlukan bersama oleh SKU satuan/pack/dus, dan stok yang tersedia. Produk yang dihapus atau stok kurang menahan finalisasi.
5. Jika perlu diperbaiki, tutup pemeriksaan lalu pilih **Buka kembali untuk diperbaiki** dan isi alasan. Pembeli/Sales yang berhak serta Admin/Pemilik dapat memperbaiki isi saat terbuka; Admin lalu mengunci dan memeriksa ulang. Stok fisik diperbaiki melalui menu Stok oleh petugas berwenang. Admin yang mengisi sendiri boleh memfinalisasi setelah mengikuti pemeriksaan ulang dan audit yang sama.
6. Setelah semua sesuai, periksa **metode pembayaran yang dipilih pembeli/Sales**, lalu centang **Saya sudah memeriksa barang, harga terbaru dan stok** dan tekan **Finalisasi dan cadangkan stok**. Metode dapat berupa COD atau transfer manual BCA/BRI/Mandiri. Untuk transfer, rekening tujuan harus dikonfigurasi Pemilik BAM sebelum finalisasi. Pengiriman gratis; tanggal keranjang masih rencana, bukan janji pengiriman otomatis.
7. Tunggu pesan keberhasilan. Pesanan masuk status **Diproses** dan stok dicadangkan. Link **Lihat pesanan toko** membuka snapshot final. Periode tersebut tidak dapat diedit atau difinalisasi menjadi pesanan kedua.
8. Admin melanjutkan pengiriman, penyelesaian atau pembatalan dari **Admin → Pesanan**. Pembatalan yang diizinkan sebelum pengiriman mengembalikan stok sekali; penyelesaian mencatat penjualan sekali. Pesanan yang dibatalkan tetap menjadi riwayat periode tersebut, bukan membuka ulang keranjang final.

## Pembayaran COD dan transfer manual B2B

- Pembeli toko atau Sales yang ditugaskan memilih metode pembayaran pada keranjang **open**: COD, transfer BCA, transfer BRI, atau transfer Mandiri. Pilihan berlaku bersama untuk satu toko dan periode; perubahan tercatat di `cart_events` beserta pelaku, revisi dan pilihan sebelumnya. Admin/Pemilik melihat dan memeriksa metode tersebut tetapi tidak dapat menggantinya.
- **Pemilik BAM** mengatur rekening tujuan masing-masing bank di **Admin → Keranjang bersama → Pengaturan rekening transfer BAM**. Nomor rekening dan nama pemilik wajib valid; penyimpanan ulang memerlukan kata sandi Pemilik BAM. Perubahan bank dicatat sebagai audit dan menggugurkan token review yang mengacu pada data rekening lama.
- Review finalisasi harus menunjukkan metode dan rekening tujuan yang dipilih. Transfer tidak dapat difinalisasi jika rekening bank tersebut belum dikonfigurasi. Setelah finalisasi, detail pesanan menyimpan **snapshot** rekening agar perubahan rekening berikutnya tidak mengubah instruksi pesanan lama.
- COD: pesanan diproses setelah finalisasi, pembayaran diterima ketika barang diserahkan dan Admin mencatat penyelesaian.
- Transfer: pesanan dibuat dalam status **Diproses** dengan pembayaran **Menunggu transfer**; stok dicadangkan pada finalisasi. Pembeli/Sales berizin membuka **Detail Pesanan**, melihat rekening tujuan, dan mengunggah bukti JPG/PNG/WebP maksimal 1 MB. Bukti tersimpan privat, dapat diperiksa atau ditolak Admin, dan **tidak otomatis membuat pembayaran lunas**. Admin menandai lunas hanya setelah melihat bukti dan memastikan dana benar-benar diterima. Tindakan pembayaran tersebut tercatat bersama identitas Admin.
- Penolakan bukti memerlukan alasan dan membuka kesempatan unggah ulang (hingga batas percobaan). Pengiriman transfer diblokir sampai pembayaran dinyatakan lunas. Hak unggah hilang setelah akses toko dicabut.
- Checkout pribadi pembeli/Sales dan kalender pengiriman otomatis belum termasuk implementasi pembayaran toko ini. Faktur B2B tanpa harga tetap pekerjaan terpisah; harga/nominal pembayaran hanya di detail pesanan dan pemeriksaan berizin.

## Konflik dan gangguan koneksi

- Jika keranjang diubah setelah konfirmasi penguncian dibuka, penguncian lama ditolak. Tekan Muat terbaru dan periksa kembali.
- Jika katalog, stok, toko atau penugasan Sales berubah sejak pemeriksaan, finalisasi lama ditolak. Tekan **Muat pemeriksaan terbaru**, periksa dan centang ulang; tidak ada harga baru yang disetujui diam-diam.
- Bila status penyimpanan belum pasti, tutup dialog dan gunakan **Pastikan penyimpanan**. Permintaan yang sama diulang; pesanan dan pencadangan stok tidak digandakan. Setelah reload/perangkat berganti, buka periode yang sama untuk melihat apakah sudah mempunyai pesanan.
- Dua Admin yang memproses periode sama tetap mendapatkan satu pesanan. Dua toko yang berebut stok terakhir tidak boleh sama-sama berhasil memakai stok tersebut.

## Akses dan penyimpanan

- Hanya Admin/Pemilik aktif dan disetujui yang dapat mengunci, membuka kembali atau memfinalisasi. Admin/Pemilik juga dapat mengubah isi keranjang **open** lewat endpoint keranjang umum; `cart_events` tetap mencatat aktor. Pemisahan pelaku pengisi dan pemfinalisasi tidak diwajibkan. Pembeli/Sales tidak membuat order lewat checkout lama.
- Pembeli yang terhubung dan Sales yang sedang ditugaskan dapat membaca pesanan toko lewat Pesanan saya, termasuk dari perangkat lain. Akses yang dicabut ditolak server pada pembacaan berikutnya. Halaman detail memuat ulang saat kembali fokus dan setiap 15 detik ketika aktif.
- Pesanan menyimpan snapshot barang, harga, foto, konversi kemasan, identitas/alamat toko, nama Sales dan Admin pemroses. Mengubah katalog/toko tidak mengubah transaksi lama.
- `b2b_cart_orders` menjamin satu pesanan per keranjang. Penguncian, alasan dibuka kembali dan finalisasi dicatat pada `cart_events`. Transaksi finalisasi meliputi validasi, order, stok, pemetaan periode, audit dan antrean email; kegagalan salah satu langkah membatalkan semuanya.
- Email memakai layanan toko yang sudah tersedia. Penerima mengikuti akses toko, email harus terverifikasi untuk dikirim, dan akses diperiksa ulang sebelum pengiriman. Pengujian menggunakan pengirim palsu; bukan bukti email/WhatsApp sungguhan telah dikirim.
- Faktur B2B tanpa harga merupakan pekerjaan berikutnya. Tombol faktur lama dengan harga tidak ditampilkan pada pesanan B2B baru. Faktur historis tetap dapat dibuka seperti sebelumnya.

## Endpoint

| Endpoint                                                    | Kegunaan                                                                                                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/admin/b2b/carts?q=&status=pending&page=1`         | Antrean 25 periode per halaman; status `pending`, `open`, `locked`, `finalized`, atau `all`                                                                  |
| `GET /api/admin/b2b/stores/:id/cart/review?date=YYYY-MM-DD` | Pemeriksaan keranjang terkunci beserta token snapshot                                                                                                        |
| `POST /api/admin/b2b/stores/:id/cart`                       | `lock`, `unlock`, atau `finalize` dengan `date`, `revision`, `requestId`; unlock memerlukan `reason`, finalize memerlukan `reviewToken` dan `accepted: true` |

Semua endpoint memerlukan sesi Admin aktif. Origin dan isi JSON diperiksa. Revisi/snapshot yang berubah mengembalikan HTTP 409. Harga, jumlah dan aktor finalisasi diambil dari server; klien tidak menetapkan harga order.

## Pemeriksaan pembaruan

Hentikan server lama, ambil branch B2B, lalu jalankan `npm test`, `npm run lint`, `npm run build`, dan `npm run dev:full`. Dari terminal kedua, `npm run check:local` harus LULUS untuk **Admin: antrean, pemeriksaan dan finalisasi keranjang** serta **Server: finalisasi pesanan B2B oleh Admin**. Buka alamat Local yang diperiksa lalu tekan Ctrl+Shift+R.

Pengujian khusus:

```powershell
node --test server/b2bFinalization.test.js src/pages/b2bFinalizationUi.test.js
```

Pengujian memakai database sementara, akun contoh, beberapa proses server, konflik stok/harga, rollback, kehilangan respons, snapshot historis dan pencabutan akses. Perubahan skema ditambahkan saat server baru dimulai; jangan mengganti database toko dengan database contoh.
