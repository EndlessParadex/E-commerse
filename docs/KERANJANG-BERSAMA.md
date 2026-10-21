# Keranjang bersama toko — tahap 3

Foto produk belum wajib untuk memakai keranjang. Kode SKU, harga, ukuran dan isi kemasan tetap mengikuti katalog yang telah disimpan.

## Memperbarui salinan lokal

Hentikan server lama dengan Ctrl+C. Simpan pekerjaan yang belum disimpan dan salin database sebagai cadangan saat server sudah berhenti. Database standar berada di `data/bam.sqlite`; instalasi yang memakai `BAM_DB_PATH` harus mencadangkan berkas pada lokasi tersebut. Jangan mengganti database dengan database contoh.

Jalankan dari folder proyek B2B:

```powershell
git switch feature/b2b-store-sales-shared-cart
git pull --ff-only origin feature/b2b-store-sales-shared-cart
git log -1 --oneline
npm ci
npm test
npm run lint
npm run build
npm run dev:full
```

Jalankan satu per satu dan berhenti jika ada yang gagal. Jika Git melaporkan perubahan lokal atau konflik, pertahankan perubahan tersebut; jangan memakai reset paksa.

Biarkan server berjalan. Dari terminal kedua pada folder yang sama:

```powershell
npm run check:local
```

Semua pemeriksaan harus **LULUS**, termasuk kode sinkronisasi keranjang dan kemampuan keranjang bersama pada server. Buka alamat Local dari terminal, lalu Ctrl+Shift+R. Skema keranjang ditambahkan otomatis ketika server baru berjalan; produk, akun, stok dan riwayat pesanan lama tetap disimpan.

## Menyiapkan akun

1. Masuk sebagai **Pemilik BAM**, buka **Admin → Toko & Sales**.
2. Buat/pilih toko pelanggan. Hubungkan akun pembeli ke toko itu.
3. Daftarkan akun staf non-Admin sebagai Sales, lalu tugaskan ke toko yang sama.
4. Muat ulang halaman atau masuk kembali pada akun pembeli/Sales setelah penugasan. Gunakan akun sungguhan yang telah dibuat/disetujui di instalasi Anda; pembaruan ini tidak membuat akun atau kata sandi contoh.

Nama toko pada profil akun saja belum merupakan hubungan B2B. Hubungan toko dan penugasan harus dibuat melalui Toko & Sales.

## Memakai keranjang

1. Sebagai pembeli/Sales, buka ikon keranjang. Pilih toko dan tanggal **rencana pengiriman**, lalu **Buka keranjang**. Jika akun hanya memiliki satu toko, toko tersebut dipilih ketika pertama kali membuka halaman; untuk beberapa toko, pilih secara eksplisit.
2. Gunakan **Pilih barang dari katalog**, buka produk, pilih SKU/kemasan dan jumlah, kemudian **Tambah ke keranjang** atau **Tambah dan buka keranjang**. Nama toko/periode aktif tampil di bawah navigasi.
3. Untuk mengganti jumlah, isi jumlah kemasan lalu **Simpan jumlah**. Jumlah dihitung sebagai kemasan yang dipilih: 2 pack isi 10 berarti 20 satuan; 2 dus isi 120 berarti 240 satuan. Konversi tidak ditebak.
4. Tunggu pesan **Tersimpan di keranjang bersama**. Keranjang akun lain pada toko/periode yang sama diperbarui paling lambat sekitar 5 detik ketika halaman aktif, atau dengan **Muat terbaru**.
5. **Riwayat perubahan** mencatat nama pembeli/Sales, perubahan dan waktu WIB. Bagian periode di bawahnya membuka keranjang tanggal lain; periode tidak berpindah otomatis saat berganti hari.
6. Jika muncul konflik, isian server terbaru dimuat. Periksa dan ulangi perubahan yang masih diinginkan. Jika koneksi terputus setelah menyimpan, tekan **Pastikan penyimpanan**; tombol ini mengulang perubahan yang sama tanpa menggandakan barang. Toko/periode dan perubahan berikutnya ditahan sampai statusnya jelas.
7. **Kosongkan keranjang** meminta konfirmasi karena hasilnya terlihat oleh seluruh pembeli/Sales toko tersebut. Konfirmasi lama ditolak jika orang lain sudah mengubah isi setelah dialog konfirmasi dibuka.

## Memeriksa dari Admin

Buka **Admin → Keranjang bersama** (`#/admin/keranjang`), pilih toko/tanggal, lalu pilih **Tambah barang ke keranjang toko** untuk mencari SKU/kemasan dan mengisi jumlah. Admin/Pemilik dapat menambah, mengubah jumlah, menghapus, dan mengosongkan keranjang selama status **Terbuka**. Perubahan dicatat pada `cart_events` atas nama pelaku dan dapat dilihat pembeli/Sales yang berhak. Saat dikunci atau sudah difinalisasi, siapa pun tidak dapat mengubah isi. Untuk koreksi, Admin harus membuka kembali dengan alasan, mengubah barang, mengunci ulang, kemudian memeriksa ulang sebelum finalisasi. Baca juga [Finalisasi B2B](FINALISASI-B2B.md).

## Uji penerimaan

1. Buka pembeli di browser biasa dan Sales di browser/profil lain agar sesi terpisah. Pilih toko/tanggal yang sama.
2. Pembeli menambah produk. Sales melihat barang tersebut, mengubah jumlah, kemudian pembeli melihat jumlah terbaru. Refresh kedua browser: isi tetap sama.
3. Pembeli mulai mengetik jumlah baru tanpa menyimpan. Sales menyimpan jumlah berbeda. Pembeli menyimpan: perubahan lama harus ditolak dan jumlah Sales tetap ada.
4. Pilih tanggal lain: keranjang terpisah. Buka kembali tanggal semula: isi sebelumnya tetap ada.
5. Masuk dengan pembeli dari toko berbeda: toko pertama tidak muncul dan tidak dapat dibaca dengan menyalin alamat API.
6. Masuk sebagai Admin dan buka Keranjang bersama: tambahkan SKU, ubah jumlah, dan hapus/kosongkan barang saat keranjang terbuka. Periksa audit pelaku. Setelah dikunci, tombol ubah tidak tersedia dan API mengembalikan 409; buka kembali dengan alasan sebelum memperbaiki isi. Pembeli/Sales yang diarahkan ke `#/checkout` tetap diminta memakai keranjang bersama.
7. Hentikan dan hidupkan kembali server, lalu buka keranjang yang sama: barang dan riwayat tetap ada.

Pengujian khusus fitur:

```powershell
node --test server/sharedCarts.test.js src/pages/sharedCartUi.test.js
```

Test otomatis memakai database uji, termasuk dua koneksi SQLite, kehilangan respons setelah commit, akses dicabut, SKU huruf besar, batas jumlah, riwayat dan pergantian periode. Hasil browser lokal disertakan terpisah dari test otomatis.

## Batas tahap ini

- Keranjang terbuka/dikunci adalah daftar permintaan bersama, belum order final. Stok dicadangkan ketika finalisasi Admin berhasil; harga dan isi disnapshot pada pesanan.
- Tanggal dipilih sebagai rencana; belum ada kalender jadwal dari Admin atau batas waktu otomatis.
- Maksimum 100 SKU berbeda dan 99 kemasan per SKU untuk satu toko/periode.
- Akun pembeli yang sudah dihubungkan ke toko dan seluruh akun Sales diblokir dari pembuatan pesanan melalui endpoint checkout lama. Akun yang belum masuk migrasi B2B tetap memakai alur lama; pesanan historis tetap dapat dibaca.
- Keranjang pribadi lama tetap disimpan terpisah dan tidak diimpor otomatis agar isi tidak masuk ke toko yang salah.
- Dua perangkat harus mengakses server/database yang sama. `localhost` di HP menunjuk ke HP itu sendiri, bukan server pada PC.
- Login masih email/kata sandi. Finalisasi Admin sudah tersedia; layanan OTP untuk login dan faktur B2B tanpa harga merupakan pekerjaan terpisah.

## API

Seluruh endpoint memerlukan sesi aktif dan persetujuan akun. Mutasi memakai pemeriksaan asal permintaan dan JSON yang sudah digunakan aplikasi.

| Endpoint                                                  | Fungsi                                                                                                    |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `GET /api/b2b/cart-context`                               | Peran, status partisipasi B2B, dan tanggal WIB saat ini                                                   |
| `GET /api/b2b/stores?page=1&q=...`                        | Pencarian toko sesuai akses akun, 25 hasil per halaman                                                    |
| `GET /api/b2b/stores/:id/cart?date=YYYY-MM-DD`            | Keranjang periode dan 30 aktivitas terbaru; membaca keranjang kosong tidak membuat baris baru             |
| `POST /api/b2b/stores/:id/cart`                           | Mutasi atomik dengan `date`, `revision`, `requestId`, `action`, serta `productId`/`quantity` jika relevan |
| `GET /api/b2b/stores/:id/carts?page=1`                    | Daftar periode toko, 25 hasil per halaman                                                                 |
| `GET /api/b2b/stores/:id/cart/events?date=...&before=...` | Riwayat sebelum nomor revision tertentu, 30 hasil per halaman                                             |

Action pembeli/Sales yang ditugaskan dan Admin/Pemilik pada keranjang **open**: `add`, `set`, `remove`, `clear`, `refresh`. Pembeli/Sales juga dapat mengirim `payment` dengan `paymentId` (`cod`, `transfer-bca`, `transfer-bri`, `transfer-mandiri`); Admin/Pemilik tidak boleh mengirim aksi pemilihan pembayaran. Server mengambil nama/harga/kemasan dari katalog; isian harga atau aktor dari klien tidak dipercaya. Setiap mutasi menggunakan `requestId` unik serta revisi agar retry idempoten dan konflik mengembalikan HTTP 409. Admin/Pemilik dapat mengedit barang lewat endpoint umum, sedangkan penguncian dan finalisasi memakai endpoint Admin terpisah.
