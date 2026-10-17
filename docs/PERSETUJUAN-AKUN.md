# Persetujuan manual pendaftaran

Pendaftaran pembeli melalui website menghasilkan status **Menunggu persetujuan**. Sebelum persetujuan, kredensial tidak dapat digunakan untuk login dan sesi lama (jika ada) tidak dapat digunakan pada API. Pendaftaran tidak memberikan hak Admin atau Pemilik.

## Alur pengelola

1. Masuk sebagai **Pemilik** atau **Admin operasional**, lalu buka **Ruang admin → Persetujuan akun**.
2. Pilih filter *Menunggu persetujuan*. Cari email atau nama pelanggan.
3. Pilih **Setujui** atau **Tolak**, isi alasan (5–300 karakter), masukkan **kata sandi akun pengelola yang sedang masuk**, lalu konfirmasi.
4. Pengelola lain harus memuat ulang apabila revisi berubah; permintaan kedua dengan revisi lama menerima HTTP 409.
5. Pendaftaran yang ditolak masih terlihat pada filter *Ditolak*. Admin atau Pemilik dapat menyetujuinya kemudian, tetapi tidak dapat menolak kedua kalinya.

Admin operasional **tidak** mendapat akses ke **Kelola akun** milik Pemilik, pengaturan SMTP, atau promosi jabatan. Pendaftaran pembeli dan keputusan persetujuan disimpan terpisah dari penonaktifan. Pengelola tetap perlu menggunakan menu Kelola akun (khusus Pemilik) untuk menonaktifkan akun yang sudah disetujui.

## Petunjuk yang dilihat pembeli

1. Setelah formulir pendaftaran diterima, BAM **secara otomatis menyiapkan email verifikasi** bila SMTP sudah aktif. Pembeli memeriksa inbox/spam dan mengikuti tautan.
2. **Persetujuan Admin/Pemilik terpisah dari verifikasi email**. Pembeli tidak perlu masuk ke menu Keamanan hanya untuk meminta tautan awal, dan dapat memverifikasi email sambil menunggu keputusan.
3. Jika email terlambat, halaman selesai pendaftaran menyediakan tombol **Kirim ulang tautan verifikasi**. Endpoint `POST /api/auth/verification/resend` memakai pembatasan permintaan email; responsnya sama untuk akun tidak dikenal maupun akun yang sudah diverifikasi sehingga tidak membocorkan keberadaan akun.
4. Tautan tetap memerlukan **kata sandi pendaftaran**, hanya dapat dipakai sekali, dan masa berlakunya tidak berubah.
5. Setelah email terkonfirmasi, pembeli tetap menunggu persetujuan pengelola bila belum disetujui. Setelah keduanya selesai, pelanggan dapat login dan memesan.
6. Bila SMTP belum dikonfigurasi, pelanggan melihat instruksi untuk menghubungi pengelola; website tidak mengklaim telah mengirim email.

**Catatan 2FA:** Langkah di atas adalah verifikasi email dan persetujuan manual, bukan autentikasi dua faktor. 2FA Owner/Admin perlu dirancang terpisah (mis. TOTP, pemulihan, enrollment, pengujian keamanan) sebelum dipakai untuk publik.

## Verifikasi email

Persetujuan bukan verifikasi email. Email dapat dikonfirmasi sebelum atau sesudah persetujuan, namun pelanggan harus memenuhi **keduanya** sebelum dapat memesan. Pendaftaran saat SMTP belum aktif tetap membutuhkan persetujuan pengelola dan konfirmasi email setelah layanan tersedia.

Tidak ada notifikasi persetujuan otomatis; pelanggan dapat mencoba masuk kembali setelah pengelola menyetujuinya.

## Database dan migrasi

Tabel `account_approvals` dibuat otomatis saat backend startup. Registrasi baru membuat status `pending` pada transaksi yang sama dengan penyimpanan pengguna. **Akun lama tanpa baris di tabel ini diperlakukan sebagai `approved`** untuk mencegah terkuncinya database yang sudah berjalan. Rekaman yang ditolak tidak dihapus sehingga email tidak dapat didaftarkan ulang untuk menghindari penolakan.

Pengelola perlu mencadangkan database, kunci email, dan konfigurasi terlebih dahulu. Tidak ada migrasi destruktif maupun perubahan akses Owner yang sudah ada. Setelah memasang pembaruan, restart backend dan jalankan pengujian:

```powershell
node --test server/approval.test.js server/accounts.test.js
npm test
npm run lint
npm run build
```

Pengujian lokal/build dan uji browser tetap harus dijalankan pada instalasi asli sebelum merge dan deployment.
