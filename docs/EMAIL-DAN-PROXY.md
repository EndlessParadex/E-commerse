# Konfigurasi email dan proxy — v34

Anda belum memiliki SMTP, jadi biarkan semua isian email kosong dahulu. Akun yang sudah ada tetap dapat masuk. Formulir ubah kata sandi di halaman akun hanya tersedia untuk admin dan hanya mengubah kata sandi admin yang sedang masuk. Pembeli melihat informasi keamanan tanpa formulir ubah kata sandi; server juga menolak perubahan langsung oleh pembeli. Pemulihan melalui **Lupa kata sandi?** di halaman masuk tetap tersedia untuk pemilik akun setelah SMTP aktif. Pendaftaran menyimpan akun belum terverifikasi dan kata sandi awal. Pelanggan wajib memverifikasi email sebelum membuat pesanan; tautan verifikasi/reset serta email pesanan memerlukan SMTP. Status kesiapan terlihat di admin.

## Mengatur email dari website (v34)

Pemilik toko dapat membuka **Ruang admin → Pengaturan email** (`#/admin/email`). Admin operasional dan pembeli tidak dapat membuka atau mengubah halaman/API ini. Hak pemilik ditetapkan secara eksplisit melalui perintah server satu kali, bukan melalui pendaftaran atau isian profil. Langkah penetapan akun ada pada [PEMILIK-DAN-EMAIL.md](./PEMILIK-DAN-EMAIL.md).

Isi server dan port SMTP, nama pengguna, kata sandi/app password, alamat pengirim yang diizinkan, serta alamat website. Masukkan kata sandi akun pemilik untuk menyimpan. Pengaturan langsung digunakan dan dimuat ulang oleh proses server lain yang memakai database yang sama. Tidak perlu mengedit `.env` atau restart setiap kali mengubah pengaturan dari website.

Setelah tersimpan, masukkan kembali kata sandi pemilik lalu pilih **Kirim email uji**. Pesan uji hanya dikirim ke alamat akun pemilik yang sedang masuk, paling sering sekali per menit. Respons sukses berarti layanan SMTP menerima pesan, bukan jaminan kotak masuk; periksa juga spam. Konfigurasi disimpan walaupun belum diuji. Pengiriman yang gagal tetap terlihat dan dicoba ulang melalui antrean sebelumnya.

Kata sandi SMTP tidak dikembalikan melalui API atau ditampilkan ulang pada formulir. Kosongkan isian kata sandi SMTP saat mengubah pengaturan lain untuk mempertahankan kata sandi tersimpan. Kata sandi akun pemilik tetap wajib untuk menyimpan maupun mengirim uji.

Pengaturan website disimpan terenkripsi dan mengungguli pengaturan SMTP `.env`. Jika sebelumnya belum memiliki `BAM_MAIL_QUEUE_KEY`, server membuat berkas kunci di samping database, misalnya `data/bam.sqlite.mail-key` atau `data/company.sqlite.mail-key`. Berkas ini tidak dapat dilihat dari website dan tidak disertakan dalam paket/Git. Cadangkan database dan kuncinya bersama secara aman; batasi akses folder server. Jika sudah memakai `BAM_MAIL_QUEUE_KEY`, kunci lama dipertahankan agar antrean akun tetap dapat dibaca. Jangan mengganti atau membuang kunci yang sedang digunakan.

## Menyiapkan .env (alternatif konfigurasi server)

Salin `.env.example` ke `.env` di folder proyek yang berisi `package.json`. Jika `.env` sudah ada, gabungkan isian baru tanpa menimpa konfigurasi lama. Backend dan peluncur mode perusahaan memuat `.env` saat dijalankan dari folder proyek. Nilai lingkungan yang sudah diberikan oleh terminal/hosting tetap diprioritaskan. Perubahan memerlukan restart backend.

`.env` tidak dimasukkan paket atau Git. Jangan mengirim kata sandi SMTP atau kunci antrean dalam percakapan, screenshot atau commit.

## Ketika layanan email sudah tersedia

Dapatkan alamat server, port, pengguna, kata sandi khusus SMTP dan alamat pengirim yang diizinkan dari penyedia layanan. Lengkapi semua isian berikut sekaligus:

```dotenv
BAM_SMTP_HOST=smtp.perusahaan.example
BAM_SMTP_PORT=587
BAM_SMTP_USER=pengguna-dari-penyedia
BAM_SMTP_PASSWORD="kata-sandi-khusus-smtp"
BAM_MAIL_FROM="Nama Toko <akun@perusahaan.example>"
BAM_PUBLIC_URL=https://alamat-website-perusahaan.example/
BAM_MAIL_QUEUE_KEY=isi-dengan-kunci-acak-64-karakter-heksadesimal
```

Contoh di atas adalah placeholder, bukan akun email yang bisa dipakai. Gunakan tanda kutip untuk nilai yang memuat `#`, spasi, atau karakter khusus. Jangan mengatur hostname ke situs placeholder.

Buat kunci acak sendiri di terminal lokal:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Salin hasilnya ke `BAM_MAIL_QUEUE_KEY`, lalu simpan kunci secara aman dan konsisten saat restart. Kunci digunakan untuk membaca antrean email yang terenkripsi; mengganti atau kehilangan kunci membuat pesan lama tidak dapat dibaca. Cadangkan kunci terpisah dari database.

Port 465 menggunakan TLS sejak awal. Port lain memerlukan STARTTLS; sertifikat harus valid. Konfigurasi parsial menghentikan backend sehingga email tidak berjalan dengan pengaturan yang salah. Detail transport mengikuti [dokumentasi SMTP Nodemailer](https://nodemailer.com/smtp).

`BAM_PUBLIC_URL` harus menunjuk alamat website yang dapat dibuka penerima email, tanpa query/token atau kredensial. Di produksi gunakan HTTPS. Untuk pengujian pada komputer yang sama, `http://localhost:5173/` diizinkan pada mode pengembangan; alamat itu tidak dapat dipakai pelanggan dari komputer lain. Tautan dibangun dari konfigurasi ini, bukan header Host pengunjung.

Restart backend sesudah semua isian lengkap. Fitur email dianggap tersedia setelah konfigurasi lengkap; hal tersebut belum membuktikan SMTP dapat mengirim. Worker mengirim pesan setiap 5 detik dan mencoba kembali saat gagal.

## Memeriksa layanan setelah konfigurasi

1. Gunakan alamat email pengujian yang Anda kuasai untuk mendaftar. Akun belum boleh memesan sebelum tautan dibuka dan email dikonfirmasi.
2. Buka tautan dari kotak masuk/spam, masukkan kata sandi pendaftaran, lalu masuk ke akun.
3. Minta reset melalui **Lupa kata sandi?**, buka email, dan ubah kata sandi. Sesi akun sebelumnya harus berakhir.
4. Coba tautan yang sudah digunakan: website harus meminta tautan baru.
5. Jika email tidak masuk, periksa konfigurasi/provider dan log operasi `account_email_delivery`. Log aplikasi sengaja tidak mencetak alamat penerima, tautan, isi pesan atau kata sandi SMTP.

Penyedia mungkin mewajibkan verifikasi domain/pengirim dan pengaturan DNS. Ikuti petunjuk penyedia yang dipilih; fitur ini belum terhubung ke layanan email sungguhan milik perusahaan.

## Reverse proxy

Tanpa konfigurasi, server menggunakan alamat socket dan mengabaikan `X-Forwarded-For`. Isi hanya IP atau CIDR proxy yang memang Anda kelola:

```dotenv
# Proxy Vite lokal pada komputer ini:
BAM_TRUSTED_PROXIES=127.0.0.1/32,::1/128
```

Proxy pengembangan Vite sudah meneruskan alamat klien. Untuk produksi, ganti contoh dengan IP/CIDR proxy deployment sebenarnya. Proxy harus menambahkan alamat koneksi nyata dan tidak meneruskan header klien begitu saja. Jika ada beberapa hop proxy, daftarkan hop yang Anda kelola; pembacaan berhenti pada hop tidak terpercaya terdekat. Mekanismenya memakai [proxy-addr](https://github.com/jshttp/proxy-addr).

Jangan memakai `*`, `0.0.0.0/0`, `::/0` atau daftar luas yang mempercayai seluruh pengunjung. Server menolak wildcard dan alias jaringan umum. Konfigurasi yang salah dapat menggabungkan semua pengunjung dalam satu batas IP atau mempercayai alamat palsu.

Gunakan `BAM_APP_ORIGIN` untuk origin HTTPS website ketika frontend dan API berada di balik deployment tersebut. Jalankan produksi dengan `NODE_ENV=production` agar cookie sesi Secure aktif. Pengaturan `.env` dimuat dengan API bawaan [Node.js process.loadEnvFile](https://nodejs.org/api/process.html#processloadenvfilepath).

Email pesanan juga dikirim worker. Bagian Kesiapan toko menampilkan antrean, percobaan gagal dan tombol kirim ulang. Lihat [TRANSAKSI-TOKO.md](./TRANSAKSI-TOKO.md) untuk penawaran, persetujuan total dan pemeriksaan bukti pembayaran.
