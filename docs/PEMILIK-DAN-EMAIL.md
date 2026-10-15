# Pemilik toko dan pengaturan email — v34

Halaman **Ruang admin → Pengaturan email** dipakai untuk mengatur layanan email tanpa mengisi `.env` secara manual. Hanya pemilik toko yang dapat membukanya. Admin operasional tetap dapat mengelola katalog, pesanan dan stok, tetapi tidak dapat membaca atau mengganti pengaturan email.

## Menetapkan pemilik pertama

Penetapan pertama dilakukan satu kali dari terminal PowerShell di komputer server, pada folder proyek yang berisi `package.json`. Ini memastikan pengunjung atau admin operasional tidak dapat mengangkat dirinya sendiri menjadi pemilik lewat website. Admin yang sudah ada tidak otomatis menjadi pemilik.

Ganti contoh email, nama dan alamat berikut dengan data pemilik yang Anda kuasai. Jika email sudah terdaftar, akun yang sama menjadi pemilik dan kata sandi, nama serta alamatnya diperbarui; seluruh sesi lamanya diakhiri. Gunakan kata sandi yang memang ingin dipakai pada akun itu.

```powershell
$ownerPassword = Read-Host 'Kata sandi akun pemilik (8–128 karakter)' -AsSecureString
try {
  $env:BAM_ADMIN_PASSWORD = ([System.Net.NetworkCredential]::new('', $ownerPassword)).Password
  npm run create-owner -- 'pemilik@perusahaan.id' 'Pemilik Toko' 'Alamat lengkap pemilik perusahaan'
} finally {
  Remove-Item Env:BAM_ADMIN_PASSWORD -ErrorAction SilentlyContinue
  $ownerPassword.Dispose()
}
```

Jika instalasi biasanya memakai `npm run dev:company` atau `server:company`, ganti `create-owner` dengan `create-owner:company` pada blok tersebut. Pertahankan `BAM_DB_PATH` yang digunakan instalasi sebelumnya. Jangan membuat pemilik di database BAM/demo jika website yang dipakai menunjuk database perusahaan.

Setelah muncul **Pemilik toko siap**, masuk kembali pada website dengan akun tersebut. Menu **Pengaturan email** muncul di sidebar admin. Akun admin lain tetap tidak mendapat menu atau akses API ini. Perintah `create-admin` tetap membuat admin operasional biasa.

## Mengisi pengaturan di website

Untuk Gmail, klik **Gunakan Gmail** dan ikuti panduan langsung pada halaman. Server dan port diisi otomatis; Anda tetap perlu memasukkan alamat Gmail serta App Password milik sendiri. Langkah lengkap tersedia pada [EMAIL-GMAIL.md](./EMAIL-GMAIL.md).

1. Buka **Ruang admin → Pengaturan email**.
2. Isi server SMTP dan port sesuai penyedia layanan. Port 465 menggunakan TLS sejak awal; port lainnya memerlukan STARTTLS.
3. Isi nama pengguna SMTP dan kata sandi/app password dari penyedia, bukan kata sandi akun toko.
4. Isi pengirim yang diizinkan, misalnya `Nama Toko <email@perusahaan.id>`.
5. Isi alamat website HTTPS yang dapat dibuka penerima email. Untuk pengujian pada komputer yang sama, `http://localhost:5173/` dapat dipakai; alamat localhost tidak dapat dibuka pelanggan di komputer lain.
6. Masukkan kata sandi **akun pemilik toko**, lalu pilih **Simpan pengaturan email**. Konfigurasi langsung digunakan oleh pengiriman akun dan pesanan.
7. Masukkan kembali kata sandi akun pemilik dan pilih **Kirim email uji**. Pesan hanya dikirim ke alamat akun pemilik yang sedang masuk. Periksa kotak masuk dan spam. Uji dibatasi satu kali per menit per akun.

Simpan perubahan sebelum mengirim uji. Jika kata sandi SMTP sudah tersimpan, isian kata sandi ditampilkan kosong; biarkan kosong untuk mempertahankannya atau isi yang baru jika ingin menggantinya. Setiap simpan/uji tetap memerlukan konfirmasi kata sandi akun pemilik.

Sukses uji berarti layanan SMTP menerima pesan. Hal itu belum menjamin pesan masuk inbox atau domain memenuhi semua persyaratan provider. Konfigurasi yang belum diuji tetap dapat disimpan dan digunakan; masalah pengiriman tampil pada Kesiapan toko. Layanan SMTP sungguhan, domain/pengirim, dan koneksi internet tetap harus tersedia. Fitur ini tidak menyediakan akun email gratis atau menghubungkan WhatsApp otomatis.

Verifikasi email tetap wajib sebelum pelanggan memesan. Penetapan pemilik tidak mengonfirmasi emailnya secara otomatis dan tidak mengubah ketentuan pesanan. Pemilik dapat mengaktifkan SMTP sebelum memverifikasi alamatnya agar konfigurasi awal tidak terhalang.

## Penyimpanan dan cadangan

- Kredensial SMTP disimpan terenkripsi dalam database; kata sandi dan kunci tidak dikembalikan ke browser maupun API publik.
- Jika sudah menggunakan `BAM_MAIL_QUEUE_KEY`, kunci tersebut dipertahankan. Jika belum, server membuat berkas kunci di samping database saat penyimpanan pertama, contohnya `data/bam.sqlite.mail-key` atau `data/company.sqlite.mail-key`.
- Cadangkan database bersama berkas/kunci yang digunakan. Simpan cadangan dengan akses terbatas, dan jangan unggah kunci atau `.env` ke GitHub. Kehilangan kunci membuat pengaturan/antrean terenkripsi tidak dapat dibaca. Server tidak membuat kunci pengganti secara diam-diam untuk pengaturan yang sudah tersimpan.
- Setelah pengaturan disimpan dari website, pengaturan tersebut mengungguli SMTP `.env`. Konfigurasi `.env` lama tetap dipakai jika belum pernah menyimpan pengaturan dari website.
- Proses server lain yang menggunakan database yang sama memuat revisi baru ketika menerima permintaan atau menjalankan worker email. Tidak diperlukan restart untuk perubahan dari website. Database dan berkas kunci harus sama-sama tersedia pada host/proses tersebut.
- Audit menyimpan akun pelaku, waktu dan hasil simpan/uji tanpa menyimpan kata sandi dalam catatan audit.

## Memasang pembaruan

Hentikan frontend dan backend, cadangkan proyek/database/kunci, lalu salin isi paket lengkap v34 ke folder proyek lama dan pilih Replace. Pertahankan folder `data` dan `.env`. Paket tidak membawa data toko, akun, kredensial, kunci atau `node_modules`. Tidak ada dependensi baru sehingga instalasi v31–v33 yang sudah berjalan tidak perlu menjalankan `npm ci` lagi.

Jalankan aplikasi dengan peluncur yang biasa digunakan dan muat ulang browser memakai Ctrl+Shift+R. Untuk produksi, bangun ulang dengan `npm run build` sebelum menyalakan server. Penambahan tabel pemilik dan pengaturan dilakukan saat startup; data pesanan, stok dan akun lama dipertahankan. Jika rollback, pulihkan kode dan database cadangan bersama.

Pengujian otomatis menggunakan layanan email palsu dan database sementara. Pengiriman SMTP nyata, tampilan browser desktop/HP dan konfigurasi produksi perlu diuji pada instalasi milik Anda setelah data penyedia diisi.
