# Daftar pembeli dan akses tim — v39

Pembeli mendaftar melalui **Daftar akun**. Akun yang berhasil dibuat langsung tercatat dalam daftar, termasuk akun yang emailnya belum dikonfirmasi. Tidak ada pemilihan jabatan atau persetujuan manual saat mendaftar. Sesudah pendaftaran, halaman menampilkan petunjuk konfirmasi email dan tombol menuju halaman masuk.

## Menunjuk Ketua, Wakil, atau staf terpercaya

1. Rekan mendaftar dengan email dan kata sandinya sendiri, lalu mengonfirmasi email.
2. Pemilik masuk ke **Ruang admin → Kelola akun**.
3. Cari rekan berdasarkan nama atau email, periksa identitasnya, lalu pilih **Atur akses**.
4. Pilih **Ketua**, **Wakil**, atau **Staf terpercaya**. Ketiganya memiliki izin melihat daftar pembeli yang sama.
5. Periksa alasan yang sudah diisi, masukkan kata sandi Pemilik, lalu konfirmasikan.
6. Rekan memuat ulang website atau masuk kembali. Menu **Akun saya → Daftar pembeli** akan muncul. Akun rekan yang sebelumnya pembeli juga diarahkan ke daftar ini saat login.

Rekan perlu memiliki akun aktif dengan email terkonfirmasi. Kata sandi rekan tidak ditampilkan atau dibagikan kepada Pemilik. Akun Pemilik yang sudah ada tetap terlindungi dari perubahan lewat tombol ini.

## Yang dapat dilihat

- Nama pembeli dan alamat email.
- Tanggal pendaftaran.
- Status aktif/nonaktif dan status konfirmasi email.
- Pencarian nama/email, filter status dan konfirmasi email, serta daftar 25 akun per halaman.

Daftar ini memuat akun pembeli, tidak memasukkan Pemilik, admin, atau rekan yang telah diberi akses tim. Data yang dikirim ke halaman tidak memuat kata sandi/hash, token, alamat rumah, alasan penonaktifan, jumlah pesanan, atau laporan keuangan. Gunakan **Muat ulang** untuk memperbarui daftar; kembali ke jendela website juga memuat ulang data.

## Batas izin dan pencabutan

Izin tim hanya membuka daftar pembeli. Izin ini tidak mengubah akun menjadi admin atau Pemilik dan tidak memberi hak menonaktifkan, mengaktifkan, menghapus akun, mengubah email toko, maupun mengelola stok/pesanan. Jika akun tersebut sudah mempunyai hak Admin operasional sebelumnya, hak itu tetap berlaku secara terpisah.

Untuk mencabut izin, Pemilik memilih **Atur akses → Tanpa akses daftar pembeli**, lalu mengonfirmasi. Server menolak pembacaan berikutnya dari sesi yang sudah masuk sekalipun. Saat daftar dimuat ulang dan izin ditolak, data lama dibersihkan dari halaman. Akun tetap bisa digunakan berbelanja. Menonaktifkan akun juga mengakhiri semua sesinya; izin tim tersimpan dan dapat berlaku lagi setelah akun diaktifkan, masuk kembali, dan emailnya tetap terkonfirmasi.

Perubahan izin membutuhkan kata sandi Pemilik, memeriksa revisi akun untuk menghindari perubahan bersamaan, dan dicatat dalam audit. Pendaftaran dan perubahan profil tidak dapat digunakan untuk memberi izin kepada diri sendiri.

## Email dan pemasangan

Verifikasi email tetap wajib sebelum membuat pesanan. Pendaftaran dapat disimpan ketika SMTP belum dikonfigurasi, tetapi konfirmasi email membutuhkan layanan email toko. Panduan pengaturannya ada di [EMAIL-GMAIL.md](./EMAIL-GMAIL.md). Pembaruan ini tidak mengaktifkan SMTP otomatis atau mengonfirmasi email atas nama pengguna.

Tidak ada dependensi baru. Setelah kode lengkap disalin ke proyek dan backend dijalankan kembali, tabel izin tim ditambahkan otomatis tanpa mengubah izin akun lama. Tidak ada rekan yang mendapat akses otomatis. Cadangkan kode, database, `.env`, dan kunci email saat backend berhenti sebelum memasang. Untuk kembali ke versi lama, pulihkan kode dan database cadangan bersama.

Pemeriksaan otomatis mencakup pemberian/pencabutan izin, semua peran tim, larangan mengelola akun, pembatasan data, pencarian/filter/halaman, sesi yang masih terbuka, restart dan dua koneksi database. Pengujian halaman memakai Happy DOM dan server dalam memori; tampilan browser nyata serta HP masih perlu diperiksa setelah pemasangan.
