# Arsip keputusan sebelum 27 Oktober 2026

Status aktif: [B2B-ROADMAP.md](../B2B-ROADMAP.md).

## Masuk menggunakan email atau nomor HP (23 Oktober 2026)

- **Pendaftaran baru:** nama, alamat, email, nomor HP Indonesia aktif, dan kata sandi. Nomor dinormalisasi ke format `+628...` dan disimpan tanpa status terverifikasi sampai OTP WhatsApp dikonfirmasi.
- **Masuk:** satu kolom menerima email atau nomor `08...`, `628...`, atau `+628...` dengan **kata sandi akun yang sama**. OTP bukan pengganti kata sandi; verifikasi email dan persetujuan akun tetap berlaku menurut ketentuan yang sudah ada.
- **Akun lama:** masih dapat masuk lewat email. Nomor yang ditambahkan melalui **Akun Saya → Profil → Nomor HP** langsung menjadi alias login dengan kata sandi; status verifikasi WhatsApp tetap terpisah.
- **Perlindungan:** klaim nomor baru dicegah jika nomor tersebut sudah terkait akun lain. Pendaftaran akun tidak membocorkan apakah nomor sudah digunakan; bila nomor tidak tersedia pendaftaran tidak membuat akun baru. Nomor lama yang ambigu karena sudah digunakan beberapa akun tidak dapat digunakan untuk login lewat nomor sampai konflik diselesaikan, tetapi login lewat email tetap berfungsi.
- **Penyimpanan:** tabel `phone_login_numbers` hanya merupakan indeks nomor ternormalisasi dari `user_contact_phones`; data kontak dan bukti verifikasi yang lama tidak dihapus saat aplikasi melakukan migrasi. Pastikan melakukan backup SQLite sebelum upgrade seperti biasa.

## Beranda Sales dan Pembeli Toko — Design No. 2 role-aware (23 Oktober 2026)

**Sudah ditambahkan pada frontend:** `B2BHomeExperience.jsx` membedakan hero dan tiga kartu akses cepat untuk akun Sales dan pembeli yang terhubung ke B2B. Sales melihat toko yang ditugaskan, pembeli melihat toko terhubung dan jadwal mingguan/dua mingguan dari `deliverySchedule` server. Nama toko, hitungan penugasan, dan tanggal tidak dibuat sebagai data demo. Header menampilkan **Daftar Toko** atau **Toko Saya** sesuai peran, sementara pembeli biasa/Admin tetap melihat beranda katalog lama. Keduanya menuju `#/keranjang` untuk pemilihan toko dan keranjang bersama yang sudah tersedia. Implementasi navigasi halaman `#/toko` khusus dan dua keranjang pribadi/toko yang berjalan paralel tetap menjadi tahap selanjutnya.

## Tampilan Admin BAM — Desain 2 (Modern Light)

**Sudah diterapkan sebagai tema bersama pada branch B2B:** sidebar putih dan menu bertingkat Utama/Katalog/B2B/Pengaturan, aksen biru, header profil/pencarian katalog, banner dashboard, kartu metrik katalog, panel pesanan terbaru dan ringkasan stok, tabel serta formulir modern, tata letak responsif. Tema diimplementasikan pada `src/pages/AdminDesign2.css` dan hanya aktif dalam `.admin-shell` sehingga tidak mengubah halaman storefront/pembeli.

- Seluruh rute Admin memakai tema yang sama, termasuk pesanan, stok, toko & Sales, keranjang bersama, katalog dan pengaturan.
- Metrik produk/pemasok/merek, daftar pesanan, serta ringkasan stok dihitung dari data yang tersedia; tidak menggunakan angka ilustrasi pada mockup. Tampilkan loading, error, dan empty state ketika data belum tersedia.
- Tidak ada perubahan hak akses, pembayaran COD/transfer, penguncian, review, pencadangan stok, atau finalisasi karena penyegaran tampilan.
- **Wajib verifikasi lokal sebelum rilis:** `npm test`, `npm run lint`, `npm run build`, kemudian pengujian manual navigasi desktop/mobile dan transaksi B2B. Penyegaran tampilan yang sudah di-commit belum sama dengan verifikasi produksi.

# BAM B2B — Rencana migrasi bertahap

Branch: `feature/b2b-store-sales-shared-cart`.

## Keputusan alur, hak akses, dan dua keranjang — 21 Oktober 2026

**Status implementasi parsial:** keputusan nomor 1 sudah diterapkan: Admin/Pemilik dapat menambah, mengubah jumlah, menghapus, dan mengosongkan keranjang **open** serta memfinalisasinya mengikuti alur penguncian, review dan audit. Keputusan nomor 2–4 (dua keranjang, checkout pribadi B2B, navigasi toko) masih target. Login dan pembatasan checkout lama belum berubah.

### Keputusan bisnis

1. **Admin operasional dan Pemilik BAM boleh mengisi/mengubah keranjang toko serta memfinalisasinya sendiri.** Pemisahan dua pelaku bukan syarat perusahaan pada tahap ini; risiko disadari dan dikendalikan lewat penguncian, review, audit, dan konfirmasi finalisasi.
2. **Sales dan pembeli yang terhubung ke toko mempunyai dua keranjang paralel:** pribadi (milik akun) dan bersama (milik toko/periode). Tidak ada pemindahan atau penggabungan otomatis.
3. **Masuk ke toko melalui header utama, bukan hanya strip keranjang.** Sales melihat tautan **Daftar Toko**, pembeli yang terhubung melihat **Toko Saya**. Keduanya dapat menuju rute bersama `#/toko` yang menampilkan toko sesuai izin. Satu toko boleh dibuka langsung; banyak toko memerlukan pemilihan eksplisit. Navigasi berlaku untuk desktop dan ponsel. Header dasar konsisten, tautan khusus mengikuti kemampuan.
4. **Keputusan visual terbaru (23 Oktober 2026): Home memiliki hero dan kartu akses cepat berbeda bagi Sales dan Pembeli Toko, tetapi tetap satu storefront dan satu katalog.** Sales melihat Daftar Toko/Produk/Keranjang Toko, pembeli terhubung melihat Toko Saya/Jadwal/Keranjang Toko. Tautan toko sementara menuju halaman keranjang bersama (`#/keranjang`) yang sudah memiliki pemilihan toko berbasis server. Keranjang pribadi paralel belum tersedia bagi akun B2B; jangan membuat tombol atau klaim checkout pribadi sebelum alurnya selesai. Tidak ada tombol Belanja biasa palsu. Ketika dua keranjang selesai, konteks pribadi/toko harus dipilih secara jelas.

### Matriks kemampuan (target)

| Akun                | Keranjang/checkout pribadi                | Toko terlihat                  | Isi keranjang toko terbuka     | Kunci/periksa/finalisasi | Ruang Admin |
| ------------------- | ----------------------------------------- | ------------------------------ | ------------------------------ | ------------------------ | ----------- |
| Pengunjung          | Keranjang pratinjau; login untuk checkout | Tidak                          | Tidak                          | Tidak                    | Tidak       |
| Pembeli tanpa toko  | Ya                                        | Tidak                          | Tidak                          | Tidak                    | Tidak       |
| Pembeli dengan toko | Ya                                        | Toko tempat ia menjadi anggota | Toko tempat ia menjadi anggota | Tidak                    | Tidak       |
| Sales               | Ya                                        | Toko yang ditugaskan           | Toko yang ditugaskan           | Tidak                    | Tidak       |
| Admin operasional   | Tidak termasuk alur pribadi tahap ini     | Semua toko aktif               | Semua toko aktif               | Ya                       | Ya          |
| Pemilik BAM         | Tidak termasuk alur pribadi tahap ini     | Semua toko aktif               | Semua toko aktif               | Ya                       | Ya          |

- Backend harus menyediakan resolver kemampuan terpusat, minimal `boleh_belanja_pribadi`, `boleh_checkout_pribadi`, `boleh_lihat_toko`, `boleh_isi_keranjang_toko`, `boleh_kunci_keranjang`, `boleh_periksa_keranjang`, `boleh_finalisasi`, `boleh_lihat_ruang_admin`, dan `boleh_atur_toko`. Kemampuan dibatasi oleh status akun/disetujui, identitas toko, penugasan yang masih berlaku, serta status keranjang.
- Endpoint konteks mengirim `capabilities` untuk mengatur tampilan. **Keputusan otorisasi final tetap ada di server untuk setiap request**; klien tidak boleh mengirim boolean izin yang dipercaya backend. Akses dicabut langsung berlaku pada request berikutnya, termasuk dari tab lama.
- Admin/Pemilik dapat memutasi toko aktif walaupun bukan anggota toko. Sales/anggota pembeli hanya dapat mengubah toko terhubung/ditugaskan. Satu akun yang berperan ganda memperoleh gabungan akses sah, bukan akses seluruh toko.

### Kontrol bagi Admin yang mengisi sekaligus memfinalisasi

- Endpoint mutasi barang `add/set/remove/clear/refresh` boleh digunakan Admin/Pemilik selama keranjang **open**, sama seperti pembeli/Sales berizin. Tidak seorang pun boleh mengubah isi ketika **locked** atau **finalized**.
- Jika Admin perlu mengubah isi yang sudah dikunci, lakukan **buka kembali dengan alasan → ubah → kunci lagi → review ulang → finalisasi**. Token review lama wajib gugur ketika item, harga, stok, data toko atau penugasan terkait berubah.
- `b2b_store_audit` mencatat perubahan profil toko dan penugasan; `cart_events` mencatat perubahan item dan status keranjang termasuk tindakan Admin (aktor, peran, toko, tanggal, SKU, kuantitas sebelum/sesudah bila relevan, waktu, request ID, serta alasan membuka kembali). Snapshot dan pelaku finalisasi tetap terekam pada order. Kedua audit tersebut **tidak saling menggantikan**.
- Pertahankan pemeriksaan `revision`, request idempotent, batas SKU/jumlah, pengecekan stok dan konversi di server, transaksi atomik, serta konfirmasi eksplisit yang merujuk snapshot terbaru. Tidak diwajibkan aktor kedua.

### Dua keranjang dan jalur pembuatan pesanan

- **Pribadi:** milik `userId`; tahap pertama memakai keranjang lokal per akun yang sudah ada. Tidak memiliki `storeId` atau tanggal periode B2B. Sinkronisasi pribadi lintas perangkat belum menjadi bagian fitur ini.
- **Toko:** milik `(storeId, deliveryDate)` dalam SQLite, dapat dipakai bersama akun berizin; perubahan selalu diperiksa ulang oleh backend. Status `open` → `locked` → `finalized` dan satu order toko per periode.
- `ShopProvider.jsx` tidak boleh lagi memilih keranjang aktif hanya dari `shared.enabled`. Simpan kedua state secara bersamaan dan aktifkan konteks `personal` atau `store` secara eksplisit. Ikon, counter, aksi tambah/ubah, dan checkout mengikuti konteks; pergantian akun/toko tidak boleh menampilkan isi milik akun sebelumnya.
- Sales dan pembeli B2B dapat membuat **order pribadi** melalui endpoint checkout pribadi setelah otorisasi server diperbarui. Backend wajib menolak `storeId`/penyamaran identitas toko pada jalur pribadi dan menghitung harga/stok sendiri. **Order toko** tetap hanya dapat dibuat oleh endpoint finalisasi Admin. Jangan gunakan `POST /api/orders` untuk melewati finalisasi toko.
- Riwayat dan keranjang lama tidak digabung ke keranjang toko. Data katalog/harga dapat digunakan bersama, tetapi item, kepemilikan, proses finalisasi dan audit tetap terpisah.

### Urutan implementasi dan pengujian

1. **Sebagian selesai:** hak edit Admin pada `sharedCarts.js`, UI tambah SKU, audit dan pengujian. **Berikutnya:** resolver kemampuan terpusat diperlukan untuk alur dua keranjang/checkout lintas peran.
2. Terapkan dua keranjang paralel di `ShopProvider.jsx` dan pilihan konteks eksplisit; pertahankan isi pribadi ketika memilih toko dan sebaliknya.
3. Batasi endpoint `/api/orders` untuk order pribadi yang sah dan endpoint Admin untuk order B2B. Tambah uji agar Sales/pembeli B2B bisa checkout pribadi tetapi tidak dapat membuat order toko langsung.
4. Tambahkan halaman `#/toko` dan tautan utama **Daftar Toko/Toko Saya** berbasis kemampuan pada `Navbar`/`App`; cek responsif desktop/ponsel. Tidak perlu kartu Belanja biasa di `Home`.
5. Uji dua akun dan dua perangkat, konflik revisi, perpindahan konteks dan akun, isolasi toko, finalisasi tunggal, idempotensi, serta faktur B2B tanpa harga pada tahap terpisah.

**Dokumen `KERANJANG-BERSAMA.md` dan `FINALISASI-B2B.md` sudah menjelaskan izin edit Admin terbaru; keputusan dua keranjang dan navigasi tetap pekerjaan berikutnya.**

## Tahap 1: Identitas toko & Sales (fondasi backend)

- Tabel terpisah untuk ID toko stabil (`TKB-000001`), nama, nomor HP, alamat.
- Pemilik BAM menghubungkan akun pembeli ke toko, mendaftarkan akun Sales, dan menugaskan Sales ke toko.
- `GET /api/b2b/stores`: daftar toko berdasarkan hak akses (pemilik toko / Sales yang ditugaskan); Admin melihat semuanya.
- `GET /api/b2b/sales`: staf Admin melihat daftar Sales aktif.
- `POST /api/b2b/stores/create`: Owner BAM membuat toko.
- `POST /api/b2b/sales/appoint`: Owner BAM menunjuk akun pengguna menjadi Sales.
- `POST /api/b2b/stores/:id/members`: Owner BAM menghubungkan pembeli dengan toko.
- `POST /api/b2b/stores/:id/sales`: Owner BAM menugaskan Sales ke toko.
- `PUT /api/b2b/stores/:id`: Owner mengubah nama, nomor HP dan alamat toko dengan `revision` dari detail toko. ID/kode tetap.
- `POST /api/b2b/stores/:id/sales` dengan `replaceUserId`, `userId` pengganti dan `revision`: ganti Sales dalam satu transaksi.
- `POST /api/b2b/stores/:id/sales/remove` dan `/members/remove` dengan `userId` serta `revision`: cabut satu penugasan atau hubungan pembeli. Riwayat keranjang/pesanan tidak dihapus.
- Perubahan lama yang memakai revisi berbeda ditolak dengan HTTP 409. Hak Pemilik, akses akun dan akses toko tetap diperiksa di server. Jika satu akun mempunyai hubungan pembeli sekaligus penugasan Sales, cabut keduanya untuk menghentikan seluruh aksesnya ke toko tersebut. **Saat ini** akun yang pernah dihubungkan B2B tetap diblokir dari checkout lama setelah hubungan terakhir dilepas. **Target:** checkout pribadi kembali diizinkan berdasarkan kemampuan, tanpa memberi izin membuat pesanan toko.
- Semua mutasi mencatat aktor dan perubahan di tabel `b2b_store_audit`.

### Halaman Toko & Sales

- Buka menu **Toko & Sales** di ruang Admin (`#/admin/toko-sales`).
- Pemilik BAM dapat membuat toko, mencari akun pembeli aktif yang sudah disetujui, menghubungkan pembeli ke toko, mendaftarkan akun staf sebagai Sales, dan menugaskan Sales ke toko.
- Admin operasional dapat melihat toko, pembeli yang terhubung, dan penugasan Sales. Tombol perubahan hanya tersedia untuk pemilik; API juga memeriksa hak pemilik.
- Nama/kode/nomor HP toko dan nama/email calon akun dicari di server dengan halaman berisi 25 hasil, sehingga hasil pencarian tidak terbatas pada halaman yang sedang ditampilkan.
- `GET /api/b2b/stores?page=1&q=...` mengembalikan hasil beserta `total`, `page`, `pageSize`, dan `pages`. Pembeli/Sales tetap hanya mendapatkan toko yang terhubung/ditugaskan. Bentuk respons tanpa parameter `page` tetap kompatibel dengan API sebelumnya.
- `GET /api/b2b/stores/:id` khusus Admin/Pemilik mengembalikan profil toko beserta akun pembeli dan Sales yang terhubung.
- `GET /api/b2b/accounts?page=1&q=...` khusus Pemilik mencari akun non-Admin aktif yang sudah disetujui dan belum menjadi Sales.
- Data disimpan ke SQLite. Perubahan yang gagal mempertahankan isian; pemuatan ulang yang gagal setelah penyimpanan berhasil menampilkan kesalahan pemuatan secara terpisah.
- Pemilik dapat memilih **Ubah data toko**, **Ganti Sales**, **Cabut penugasan**, dan **Lepas pembeli** pada detail toko. Dialog menampilkan nama/kode toko dan akun yang diubah; Admin operasional tetap hanya membaca.

### Perbaikan operasional 21 Oktober 2026

- Kartu produk menunggu hasil penyimpanan keranjang bersama. Status memilih toko, menyimpan, berhasil, gagal dan stok dibedakan; klik ganda saat menyimpan diblokir.
- `GET /api/orders` dan `/api/admin/orders` menerima `q`, `status`, `before`; pencarian nomor pesanan, penerima, nama produk dan SKU dilakukan sebelum pagination 50 hasil. Respons menyertakan `total` seluruh hasil yang sesuai. Pembeli tetap hanya mendapat pesanan sendiri. Karakter `%` dan `_` dicari sebagai teks biasa.
- Hasil pencarian dipisahkan dari cache notifikasi/detail. Pergantian kata pencarian atau akun mengabaikan respons lama; refresh mempertahankan jumlah halaman hasil yang sudah dibuka.
- Kegagalan pemuatan pesanan tidak menutup stok yang berhasil dimuat. Kegagalan stok tetap memblokir perubahan yang memerlukan ketersediaan stok; data dari sesi lama tidak boleh masuk setelah akun berganti.
- `npm run check:local` kini memeriksa kode frontend dan kemampuan backend untuk perbaikan operasional ini. Perintah memeriksa server pengembangan pada alamat Local yang diberikan, bukan otomatis menerapkan pembaruan.

**Status saat ini:** tahap 1, keranjang bersama tahap 3 dan finalisasi Admin tahap 4 sudah diimplementasikan. Login masih memakai email/kata sandi. Konfirmasi nomor kontak melalui OTP WhatsApp tersedia pada kode aplikasi, tetapi pengiriman sungguhan masih memerlukan konfigurasi Meta. Faktur B2B tanpa harga dikerjakan berikutnya. Akun pembeli yang sudah dihubungkan ke toko dan akun Sales tidak dapat membuat pesanan melalui checkout lama.

### Verifikasi halaman

1. Gunakan Node.js 24+, jalankan `npm ci`, lalu `npm run dev:full` dari branch B2B.
2. Masuk dengan akun **Pemilik BAM**, buka **Toko & Sales**, pilih **Tambah toko**, isi nama, nomor HP Indonesia, dan alamat, kemudian simpan. Pastikan kode `TKB-......` muncul.
3. Pilih toko, cari akun pembeli yang sudah aktif/disetujui, dan pilih **Hubungkan pembeli**. Pastikan akun masuk pada daftar pembeli toko tersebut.
4. Cari akun staf non-Admin, pilih **Daftarkan sebagai Sales**, periksa nama/email pada dialog, lalu konfirmasi. Pilih akun itu pada **Tugaskan Sales ke toko ini**, kemudian simpan penugasan.
5. Muat ulang halaman dan pastikan toko, pembeli, dan penugasan tetap ada. Masuk sebagai Admin operasional: data dapat dibaca, tetapi form perubahan tidak tersedia.
6. Jalankan `node --test server/b2bStores.test.js server/b2bManagement.test.js src/pages/b2bManagementUi.test.js`, `npm test`, `npm run lint`, dan `npm run build`.

## Tahap 2: Autentikasi pembeli menggunakan nomor HP

Profil dan Kelola akun menampilkan status konfirmasi email/nomor HP. Alur konfirmasi nomor dengan OTP WhatsApp dan adapter Cloud API tersedia; pengiriman sungguhan masih memerlukan konfigurasi layanan Meta yang sah. Ini **belum mengaktifkan login nomor HP**. Lihat [Nomor HP akun dan tautan email](../AKUN-DAN-NOMOR-HP.md).

- Integrasi pengirim WhatsApp OTP asli untuk login, throttle pengiriman dan verifikasi OTP, batas percobaan, expiry, dan anti-enumeration. Verifikasi kontak pada akun yang sudah masuk telah tersedia; login nomor HP tetap tahap terpisah.
- Migrasi akun lama, verifikasi kepemilikan nomor HP, serta pemetaan akun ke toko.
- Jangan gunakan nomor HP saja sebagai bukti autentikasi.

## Tahap 3: Keranjang bersama per toko dan per periode

Sudah diimplementasikan. Panduan penggunaan dan pengujian: [KERANJANG-BERSAMA.md](../KERANJANG-BERSAMA.md).

- `cart_cycles`, `cart_items`, `cart_events` tersimpan pada SQLite; isi keranjang tidak disimpan ke localStorage. Pilihan toko/tanggal saja disimpan sebagai preferensi perangkat dan akun.
- Satu keranjang per toko/tanggal rencana pengiriman. Tanggal bukan janji pengiriman dan tidak berganti otomatis ketika hari berganti. Daftar periode lama dapat dibuka kembali.
- Pembeli yang terhubung dan Sales yang ditugaskan mengedit keranjang yang sama. Semua akses diperiksa di server, termasuk setelah penugasan atau akses akun dicabut.
- Pembaruan berkala setiap 5 detik ketika halaman aktif, saat fokus kembali, serta tombol Muat terbaru. Konflik `revision` ditolak tanpa menimpa isian lain, termasuk ketika pengguna masih mengetik atau membuka konfirmasi kosongkan.
- Setiap perubahan memakai kode unik. Respons yang terputus dapat dipastikan dengan mengirim ulang kode/perubahan yang sama tanpa menggandakan barang.
- Nama, harga dan konversi kemasan diambil dari katalog server; SKU yang dihapus tetap terlihat sampai dikeluarkan. Harga/informasi yang berubah perlu diperbarui secara eksplisit.
- **Sudah diterapkan:** Admin/Pemilik melihat semua toko melalui **Keranjang bersama** di ruang Admin dan dapat mengubah isi keranjang `open`, dengan audit, penguncian, dan review wajib sebelum finalisasi. Pencarian toko, periode dan riwayat memiliki halaman lanjutan.
- Batas 100 SKU per keranjang dan 99 kemasan per SKU. Keranjang belum mencadangkan stok; reservasi dan order dibuat ketika finalisasi Admin berhasil.
- Akun yang belum pernah dihubungkan ke toko dan belum menjadi Sales tetap memakai alur lama selama migrasi. Keranjang pribadi lama tidak otomatis digabung ke keranjang toko; foto produk dapat ditambahkan belakangan.

## Tahap 4: Finalisasi eksklusif Admin

Sudah diimplementasikan. Panduan: [Finalisasi pesanan B2B](../FINALISASI-B2B.md).

- Admin mengunci keranjang pada jadwal pemrosesan (manual, bukan otomatis).
- Harga disnapshot, stok dicek dan dicadangkan dalam transaksi atomik, idempotency key mencegah order ganda.
- Hanya endpoint Admin yang membuat **order toko B2B** final. **Saat ini** checkout lama diblokir bagi pembeli B2B/Sales; **target** membolehkan checkout pribadi mereka tanpa memberikan akses membuat order toko melalui checkout pribadi.
- Sistem COD dan pesanan historis tetap dapat dibaca.
- Antrean per toko/periode mempunyai pencarian server dan halaman lanjutan. Pemeriksaan menampilkan harga/konversi terbaru, perubahan dari isian awal dan kebutuhan stok gabungan. Persetujuan finalisasi wajib diulang ketika snapshot berubah.
- Pembeli/Sales membaca pesanan sesuai akses toko; perubahan order final dilakukan Admin. Pengiriman dan penyelesaian memakai workflow yang sudah ada. Faktur lama dengan harga tidak ditawarkan pada order B2B baru.

## Tahap 5: Portal Sales, Pembeli, dan Admin

- Sales: tautan **Daftar Toko** di header, toko yang ditugaskan, katalog, dua konteks keranjang pribadi/toko dan riwayat aktivitas.
- Pembeli terhubung: tautan **Toko Saya** di header, katalog, harga/diskon, dua konteks keranjang pribadi/toko.
- Admin/Pemilik: antrean, hak edit ketika `open`, penguncian, review, finalisasi dan pengiriman.
- Beranda kini memakai kartu cepat berbasis peran sesuai keputusan visual terbaru; tidak ada tombol pribadi B2B yang belum berfungsi.

## Pembayaran B2B: COD dan transfer manual (implementasi bertahap)

**Sudah diterapkan pada keranjang dan pesanan toko:** pembeli toko/Sales yang ditugaskan memilih **COD / BCA / BRI / Mandiri** saat keranjang `open`; metode tercatat sebagai revisi dan audit. Admin/Pemilik hanya membaca dan memeriksa metode sebelum finalisasi, tanpa hak mengganti metode pembayaran. Penguncian dan review mencegah perubahan diam-diam.

- Pemilik BAM memasukkan rekening dan nama pemilik bank yang benar melalui pengaturan rekening transfer di halaman keranjang Admin. Konfigurasi rekening BCA, BRI, dan Mandiri independen; transfer tanpa rekening sesuai bank **tidak dapat difinalisasi**. Review token memuat snapshot metode dan rekening tujuan.
- Setelah finalisasi toko, instruksi rekening disimpan pada pesanan, sehingga perubahan master bank selanjutnya tidak mengubah pesanan lama.
- **COD:** bayar saat barang diterima, Admin mencatat pelunasan melalui penyelesaian pesanan.
- **Transfer manual:** pembeli/Sales berizin mengunggah bukti transfer berupa gambar (JPG/PNG/WebP maksimal 1 MB) lewat **Detail Pesanan**. Admin memeriksa bukti dan dana yang diterima; bila salah, bukti ditolak dengan alasan dan dapat diunggah ulang. Unggah bukti tidak otomatis menandai lunas. Pengiriman transfer ditahan sampai pembayaran dinyatakan lunas.
- Hak lihat/unggah bukti diperiksa di backend sesuai hubungan toko yang masih aktif, bukti tidak dibuka publik. Riwayat perubahan metode tersimpan di `cart_events`; perubahan rekening di `b2b_bank_events` tanpa menyimpan nomor rekening penuh pada log tersebut.
- **Belum termasuk tahap ini:** perluasan metode transfer ke checkout pribadi dan implementasi dua keranjang, kalender pengiriman tetap berdasarkan toko/wilayah, dan faktur B2B tanpa harga. Status pekerjaan ini tidak boleh disamakan dengan kesiapan produksi sebelum seluruh pengujian lokal/CI lolos.

### Jadwal tetap toko — implementasi awal sudah ada

- **Sudah ditambahkan:** pemilik BAM dapat memasukkan hari pengiriman, interval 1/2 minggu dan tanggal acuan saat membuat toko. Untuk toko lama, jadwal ditetapkan sekali pada **Toko & Sales**; setelah itu terkunci di database dengan audit `schedule_assigned`. API menolak penggantian jadwal, perubahan oleh non-Pemilik, tanggal acuan yang salah hari, serta siklus keranjang **baru** pada tanggal di luar jadwal toko.
- **Sudah ditambahkan pada UI:** setelah jadwal ditetapkan, Admin, pembeli toko dan Sales melihat tanggal pengiriman berikutnya secara otomatis tanpa mengedit tanggal pada formulir toko terjadwal. Periode awal diselaraskan otomatis dengan jadwal yang disimpan.
- **Masa transisi:** toko lama yang belum diberi jadwal masih menampilkan pemilihan tanggal manual agar keranjang lama tidak rusak. Pemilik wajib menetapkan jadwal untuk mengaktifkan mode otomatis. Keranjang lama tetap dapat ditinjau melalui riwayat.
- **Masih berikutnya:** kalender profil untuk toko/wilayah, jadwal pengiriman berdasarkan wilayah bagi pembeli tanpa toko, dan aturan cut-off pemrosesan pesanan. Tanggal otomatis adalah jadwal rutin, belum jaminan barang diterima.

### Kalender pengiriman tetap — rancangan berikutnya

- Toko mempunyai hari tetap dan frekuensi pengiriman 1 atau 2 minggu, berdasarkan tanggal acuan yang tercatat; pembeli/Sales/Admin tidak mengubahnya saat belanja.
- Pembeli tanpa toko mengikuti jadwal tetap wilayah alamatnya, juga mingguan atau dua mingguan.
- Tampilkan **kalender jadwal rutin hanya di Profil** dan **estimasi serta status pengiriman di Detail Pesanan**, bukan kalender pilihan bebas di keranjang atau checkout.
- Tanggal rencana pengiriman yang saat ini masih dapat dipilih pada keranjang B2B harus diganti perhitungan otomatis serta pemeriksaan backend pada tahap kalender terpisah. Tidak ada fitur pengaturan jadwal sopir untuk Admin.

## Tahap 6: Faktur/daftar barang tanpa harga

- Dokumen cetak **hanya nama toko, nama Sales, dan daftar barang**.
- Kolom: nama barang, Satuan, Pack, Box, Dus, Renceng. Baris bawah: total kuantitas per kemasan dan jumlah jenis barang.
- Tidak menampilkan harga, diskon, subtotal, total COD, alamat, ataupun tanda tangan.
- Harga dan diskon **tetap terlihat pada website** dan tetap tersimpan dalam database untuk laporan internal.
- Tambahkan Box dan Renceng sebagai varian kemasan; konversi kemasan khusus produk tidak boleh ditebak.
- Faktur historis harus ditangani secara eksplisit supaya tidak bocor angka harga pada versi cetak baru.

## Pengujian minimum sebelum produksi

Jalankan `node --test server/b2bStores.test.js`, `npm test`, `npm run lint`, dan `npm run build`. Uji pula akses lintas toko, racing keranjang, idempotensi, stok, kompatibilitas pesanan lama, dan tidak munculnya nominal pada halaman print.
