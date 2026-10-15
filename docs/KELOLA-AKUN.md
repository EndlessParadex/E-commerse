# Kelola akun — v35

Menu **Ruang admin → Kelola akun** hanya tersedia untuk akun **Pemilik toko**. Daftar lengkap dan tindakan pengelolaan akun di menu ini tetap khusus Pemilik. Sejak v39, Pemilik dapat menunjuk Ketua, Wakil, dan staf terpercaya untuk melihat **Daftar pembeli** yang terpisah dan terbatas. Lihat [AKUN-TIM-V39.md](./AKUN-TIM-V39.md). Akun pemilik pertama ditetapkan satu kali dari komputer server mengikuti [PEMILIK-DAN-EMAIL.md](./PEMILIK-DAN-EMAIL.md).

## Melihat akun

Masuk sebagai pemilik, buka Kelola akun, lalu cari berdasarkan nama atau email. Filter Peran memilih Pemilik toko, Admin atau Pembeli; filter Status akses memilih Aktif atau Nonaktif. Daftar menampilkan status konfirmasi email dan jumlah pesanan. Setiap halaman memuat maksimal 25 akun.

## Nonaktifkan

1. Cari akun dan pilih **Nonaktifkan**.
2. Periksa nama dan email pada dialog.
3. Isi alasan sepanjang 5–300 karakter, masukkan kata sandi akun pemilik yang sedang masuk, lalu konfirmasikan.

Akun tidak dapat masuk atau menggunakan sesi lama. Semua sesi dan token pemulihan/verifikasi lama dicabut. Mendaftar ulang atau meminta reset tidak mengaktifkan kembali akun tersebut. Pemeriksaan terakhir saat login mencegah proses masuk yang sudah berjalan menerbitkan sesi setelah akun dinonaktifkan.

Riwayat pesanan, status pembayaran dan stok tetap tersimpan. Penonaktifan tidak membatalkan pesanan atau melepaskan stok otomatis; pemilik/admin tetap menangani pesanan melalui menu Pesanan. Pemberitahuan transaksi kepada pembeli dapat tetap dikirim sesuai status/verifikasi sebelumnya. Notifikasi operasional kepada admin yang nonaktif dihentikan.

## Aktifkan kembali

Pilih filter Nonaktif, cari akun, lalu pilih **Aktifkan kembali**. Isi alasan dan kata sandi pemilik. Akun dapat masuk lagi dengan kata sandi yang dimilikinya, tetapi sesi dan token pemulihan lama tetap tidak berlaku. Jika perlu, pemilik akun dapat meminta tautan pemulihan baru setelah aktif dan layanan email tersedia.

## Hapus akun

Penghapusan permanen hanya tersedia untuk akun yang belum memiliki pesanan dan tidak masih menjadi rujukan pengaturan toko. Akun yang memiliki riwayat pesanan harus dinonaktifkan agar riwayat tetap tersimpan.

1. Pilih **Hapus** pada akun yang memenuhi syarat.
2. Periksa nama/email, isi alasan, lalu ketik ulang email akun yang akan dihapus.
3. Masukkan kata sandi akun pemilik dan konfirmasikan penghapusan.

Akun, sesi, token dan data autentikasi terkait dihapus bersama dalam satu transaksi. Akun lain dan data pesanan/stok tidak dihapus. Tindakan tidak dapat dibatalkan dari website; pemulihan membutuhkan cadangan database. Catatan tindakan dan pembatas anti-penyalahgunaan tetap disimpan. Alamat email akun yang sudah dihapus dapat dipakai untuk pendaftaran baru dengan identitas akun yang baru.

## Perlindungan

- Akun yang sedang digunakan dan seluruh akun pemilik dilindungi dari penonaktifan/penghapusan lewat menu ini. Tidak ada promosi atau pencabutan hak pemilik melalui formulir profil/registrasi.
- Setiap tindakan memerlukan kata sandi pemilik. Hak pemilik dan kredensial diperiksa kembali sesudah pemeriksaan kata sandi. Tindakan juga memeriksa revisi/status akun di dalam transaksi agar layar lama tidak menimpa perubahan dari perangkat lain.
- Jika muncul konflik atau hasil tidak dapat dikonfirmasi karena koneksi terputus, tutup dialog, muat ulang daftar dan periksa hasil sebelum mengulangi.
- Kata sandi akun tidak dikirim pada daftar akun dan tidak disimpan dalam catatan tindakan. Catatan memuat pelaku, akun tujuan, tindakan, alasan dan waktu.
- API lama `/api/admin/users` beserta perubahan profil akun lain kini khusus pemilik. Pembeli/admin biasa tetap dapat mengubah nama/alamat akunnya sendiri melalui Profil.
- Pembuatan admin lewat terminal tidak mengaktifkan kembali akun nonaktif secara otomatis. Perintah `create-owner` dari komputer server merupakan jalur pemulihan terpercaya; perintah itu dapat menetapkan serta mengaktifkan kembali akun pemilik dan mengganti kata sandinya.

## Memasang pembaruan

Paket lengkap v35 memuat pembaruan sebelumnya sampai v34. Hentikan frontend dan backend, cadangkan folder proyek, seluruh `data`, `.env`, serta berkas/kunci email yang digunakan. Salin isi paket ke folder proyek lama dan pilih Replace tanpa membuang data/configurasi lama.

Tidak ada dependensi baru. Instalasi v31–v34 yang sudah berjalan tidak perlu menjalankan `npm ci` atau `npm install`. Jalankan website dengan peluncur dan lokasi database yang biasa digunakan; untuk produksi, jalankan `npm run build` sebelum menyalakan server. Muat ulang browser dengan Ctrl+Shift+R dan masuk sebagai pemilik.

Tabel pengelolaan akses dan catatan tindakan ditambahkan saat startup. Semua akun lama tetap aktif sampai pemilik memilih tindakan. Paket tidak membawa atau mengubah akun/database instalasi Anda secara otomatis. Jika rollback, pulihkan kode dan database cadangan bersama.

Pengujian otomatis memakai database sementara dan Happy DOM. Tampilan di browser nyata dan HP tetap perlu diperiksa setelah pemasangan.
