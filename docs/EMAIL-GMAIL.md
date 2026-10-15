# Menyiapkan email toko dengan Gmail — v36

Halaman **Ruang admin → Pengaturan email** menyediakan panduan tiga langkah dan tombol **Gunakan Gmail**. Hanya akun **Pemilik toko** yang dapat membuka, menyimpan, atau menguji pengaturan. Verifikasi email pelanggan tetap wajib sebelum memesan.

Fitur ini menyiapkan formulir dan koneksi pengiriman. Anda tetap memerlukan akun Gmail atau Google Workspace yang Anda kuasai dan mengizinkan App Password. Paket tidak membawa alamat email, akun Google, password, atau layanan SMTP milik pembuat aplikasi.

## 1. Pilih Gmail dan siapkan akun Google

1. Masuk ke BAM menggunakan akun pemilik, lalu buka **Pengaturan email**.
2. Klik **Gunakan Gmail**. Server otomatis menjadi `smtp.gmail.com` dengan port `587` (STARTTLS). Tombol ini hanya mengisi draf; belum menyimpan atau mengirim email.
3. Masuk ke Google dengan akun yang akan dipakai mengirim email toko.
4. Aktifkan [Verifikasi 2 Langkah Google](https://myaccount.google.com/signinoptions/two-step-verification).
5. Buka [App Passwords Google](https://myaccount.google.com/apppasswords), buat dengan nama **Website BAM**, lalu salin kode yang diberikan. Jika pilihannya tidak tersedia, baca [ketentuan App Password Google](https://support.google.com/accounts/answer/185833?hl=id). Sebagian akun organisasi atau akun dengan perlindungan tertentu tidak mengizinkannya.

Masukkan App Password langsung ke website lokal milik Anda. Jangan mengirimkannya ke chat, memasukkannya ke kode, atau mengunggahnya ke GitHub. Website tidak memerlukan kata sandi utama Gmail Anda untuk alur ini.

## 2. Lengkapi pengirim dan website

| Kolom                 | Yang dimasukkan                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| Server SMTP           | Sudah diisi `smtp.gmail.com`                                                                        |
| Port SMTP             | Sudah diisi `587`                                                                                   |
| Alamat Gmail pengirim | Alamat Gmail lengkap yang Anda miliki dan dipakai membuat App Password                              |
| App Password Google   | Kode dari Google; spasi pemisah dibuang otomatis saat penyimpanan pada pilihan Gmail                |
| Alamat pengirim       | Mengikuti alamat Gmail yang diketik; bisa diberi nama dengan format `Nama Toko <alamat Gmail Anda>` |
| Alamat website        | Alamat website yang dapat dibuka penerima tautan email                                              |

Isian alamat pengirim mengikuti Gmail hanya ketika masih kosong atau sama dengan alamat sebelumnya. Nama/alamat pengirim yang sudah Anda ubah sendiri tidak ditimpa otomatis. Gunakan alamat yang sama dengan akun Gmail, atau alias yang memang diizinkan Google.

Klik **Gunakan alamat uji di komputer ini** jika sedang membuka website dari localhost, atau **Gunakan alamat website ini** jika membuka website melalui HTTPS. Tombol memakai alamat halaman yang sedang dibuka tanpa rute hash. Pengaturan dapat diedit sebelum disimpan.

Alamat localhost hanya untuk pengujian pada komputer yang sama. Penerima di HP atau komputer lain tidak dapat membuka tautan localhost. Saat toko online, isi domain HTTPS website yang benar, kemudian simpan kembali. Server produksi mensyaratkan HTTPS.

Server dan port Gmail mengikuti [panduan resmi Google](https://support.google.com/a/answer/176600?hl=id). Pilih **Penyedia lain** jika menggunakan layanan SMTP lain, lalu sesuaikan semua rincian dengan penyedia tersebut. Memilih Gmail tidak menghapus kata sandi SMTP lama dari server; App Password baru harus diisi sebelum menyimpan perpindahan dari penyedia lain atau akun Gmail berbeda.

## 3. Simpan dan uji

1. Periksa **Penerima email uji**. Alamat ini berasal dari akun pemilik BAM yang sedang masuk, dan boleh berbeda dari Gmail pengirim. Pastikan Anda memiliki akses ke kotak masuknya.
2. Masukkan **Kata sandi akun pemilik**, yaitu kata sandi yang dipakai masuk ke BAM.
3. Klik **Simpan pengaturan email**. Setelah berhasil, kedua isian kata sandi dikosongkan di layar; kata sandi SMTP tetap tersimpan terenkripsi di server.
4. Isi kembali kata sandi akun pemilik, lalu klik **Kirim email uji**.
5. Buka kotak masuk dan spam pada alamat penerima. Pengiriman uji dibatasi satu kali per menit per pemilik. Status diterima layanan SMTP belum menjamin email masuk inbox.
6. Setelah uji diterima, coba pendaftaran dengan email lain milik Anda, buka tautan verifikasi, dan periksa email kabar pesanan. Perubahan SMTP langsung digunakan tanpa restart.

Jika mengedit pengaturan, simpan dahulu sebelum menguji. Isian App Password boleh kosong untuk mempertahankan kata sandi tersimpan pada akun Gmail yang sama. Mengganti akun Gmail memerlukan App Password untuk akun yang baru.

## Jika alamat pemilik masih memakai contoh panduan

`pemilik@perusahaan.id` pada panduan sebelumnya adalah contoh dan tidak otomatis membuat kotak email. Aplikasi menampilkan pengingat jika akun yang sedang masuk memakai alamat ini.

Untuk membuat akun pemilik dengan email sungguhan, ikuti [PEMILIK-DAN-EMAIL.md](./PEMILIK-DAN-EMAIL.md). Gunakan email aktif milik Anda ketika menjalankan perintah `create-owner` atau `create-owner:company` sesuai database instalasi. Berbeda email membuat akun pemilik tambahan; perintah tersebut tidak mengganti email akun lama. Jangan menghapus database atau mengganti mode database untuk memperbaiki alamat email.

## Pemeliharaan

Cadangkan database bersama kunci email yang dipakai. Penjelasan enkripsi, audit, akses pemilik, dan pemulihan terdapat dalam [PEMILIK-DAN-EMAIL.md](./PEMILIK-DAN-EMAIL.md). Pengujian otomatis memakai layanan email palsu; pengiriman Gmail nyata baru dapat diuji setelah pemilik mengisi kredensial yang sah pada instalasinya.
