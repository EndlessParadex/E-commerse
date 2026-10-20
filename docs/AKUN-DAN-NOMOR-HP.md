# Nomor HP akun dan tautan verifikasi email

## Menambahkan nomor ke akun yang sudah ada

1. Masuk seperti biasa menggunakan email dan kata sandi.
2. Buka **Akun saya → Profil**.
3. Isi **Nomor HP / WhatsApp (opsional)**, lalu pilih **Simpan nomor HP**.
4. Nomor Indonesia dapat ditulis `08...`, `628...`, atau `+628...`; format tersimpan memakai `+62`.
5. Muat ulang halaman untuk memastikan nomor tetap ada. Kosongkan kolom dan simpan untuk menghapusnya.

Nomor tersimpan pada database server untuk akun yang sedang masuk. Nomor ini merupakan **kontak yang belum diverifikasi**. Menambah nomor tidak membuat akun baru, tidak menghubungkan akun ke toko, tidak mengirim pesan WhatsApp, dan tidak mengaktifkan login nomor HP. Nomor toko di halaman Toko & Sales tetap terpisah. Nomor yang sama boleh digunakan sebagai kontak beberapa akun; nomor kontak bukan identitas autentikasi.

Login nomor HP memerlukan verifikasi kepemilikan melalui OTP dan integrasi WhatsApp resmi. Akun lama perlu menghubungkan nomor yang telah diverifikasi ke akun yang sama, sehingga toko, Sales, pesanan, dan hak aksesnya tidak berpindah hanya karena seseorang mengetik nomor tersebut. Layanan WhatsApp belum dikonfigurasi pada tahap ini.

## Mengapa kolom konfirmasi email sebelumnya terkunci?

Halaman verifikasi membutuhkan kode rahasia dari tautan lengkap di email. Kode dihapus dari bilah alamat sesudah dibuka untuk mengurangi kebocoran; kode hanya disimpan dalam memori halaman. Memuat ulang halaman, membuka alamat halaman tanpa kode, atau menyalin alamat setelah pembersihan dapat menghilangkan kode tersebut.

Halaman sekarang menampilkan **Tautan verifikasi belum lengkap**, bukan kolom kata sandi yang terkunci:

- Akun yang sudah masuk dan belum terverifikasi dapat memilih **Kirim tautan verifikasi baru** untuk email akun sendiri.
- Pengguna yang masih menunggu persetujuan dapat mengisi email pendaftaran dan meminta tautan baru tanpa masuk. Respons tetap umum agar keberadaan akun tidak dibocorkan.
- Akun yang telah disetujui dapat masuk, lalu meminta tautan melalui **Akun saya → Keamanan**.
- Akun yang emailnya sudah terverifikasi mendapatkan pemberitahuan dan tautan kembali ke profil.
- Untuk pemulihan kata sandi tanpa tautan lengkap, pilih **Minta tautan pemulihan baru**.

Buka tautan lengkap dari email yang diterima, lalu gunakan kata sandi BAM pada kolom **Kata sandi akun**. Jangan gunakan App Password Gmail. Token yang salah, telah dipakai, atau kedaluwarsa tetap ditolak server. Kode tidak disimpan di localStorage atau sessionStorage.

## Verifikasi pembaruan lokal

Gunakan branch `feature/b2b-store-sales-shared-cart`, jalankan `npm ci`, `npm test`, `npm run lint`, dan `npm run build`. Jalankan `npm run dev:full`, lalu pada terminal lain jalankan `npm run check:local -- http://localhost:5173` (sesuaikan dengan alamat Local yang ditampilkan).

Pemeriksaan lokal mencakup form verifikasi, isian nomor HP, dan kemampuan server menyimpan nomor. Lakukan penyegaran penuh browser. Database yang sudah ada tidak perlu dihapus atau diganti; tabel kontak akun dibuat otomatis saat server terbaru mulai.
