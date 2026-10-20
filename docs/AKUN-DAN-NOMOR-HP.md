# Nomor HP akun dan tautan verifikasi email

## Menambahkan nomor ke akun yang sudah ada

1. Masuk seperti biasa menggunakan email dan kata sandi.
2. Buka **Akun saya → Profil**.
3. Isi **Nomor HP / WhatsApp (opsional)**, lalu pilih **Simpan nomor HP**.
4. Nomor Indonesia dapat ditulis `08...`, `628...`, atau `+628...`; format tersimpan memakai `+62`.
5. Muat ulang halaman untuk memastikan nomor tetap ada. Kosongkan kolom dan simpan untuk menghapusnya.

Nomor tersimpan pada database server untuk akun yang sedang masuk. Nomor baru berstatus **belum dikonfirmasi**. Menambah nomor tidak membuat akun baru, tidak menghubungkan akun ke toko, tidak mengirim pesan WhatsApp, dan tidak mengaktifkan login nomor HP. Nomor toko di halaman Toko & Sales tetap terpisah. Nomor yang sama boleh digunakan sebagai kontak beberapa akun; nomor kontak bukan identitas autentikasi.

## Mengonfirmasi email dan nomor HP

Pada **Akun saya → Profil**, status email dan nomor HP ditampilkan terpisah:

- **Email:** pilih **Kirim konfirmasi email**, buka tautan lengkap dari email, dan masukkan kata sandi BAM. Kembali ke profil lalu pilih **Perbarui status email**. Status hanya diambil dari hasil verifikasi server.
- **Nomor HP:** simpan nomor, lalu pilih **Kirim kode ke WhatsApp**. Masukkan kode 6 angka yang diterima dan pilih **Konfirmasi nomor HP**. Pengiriman membutuhkan layanan Meta yang telah dikonfigurasi. Jika belum aktif, tombol pengiriman dinonaktifkan dengan penjelasan yang sesuai.
- Status **terkonfirmasi** menampilkan waktu konfirmasi. Status ini membuktikan bahwa tautan/kode dapat diterima pada saat tersebut, bukan jaminan alamat atau nomor akan selalu aktif, membaca pesan berikutnya, atau membalasnya.
- Mengubah nomor menghapus status konfirmasi dan kode lama. Menyimpan format berbeda dari nomor yang sama mempertahankan statusnya. Menghapus lalu menambahkan kembali nomor tetap membutuhkan konfirmasi baru.
- Pemilik melihat kedua status dan nomor pada **Kelola akun**, dapat mencari nomor lengkap dalam format `08...` atau `+62...`, dan dapat memilih **Buka WhatsApp** untuk membuka chat secara manual. Membuka chat tidak mengubah status konfirmasi atau mengirim pesan otomatis.

Kode OTP berlaku 5 menit, maksimal 5 percobaan per kode. Pengiriman ulang minimal 60 detik, maksimal 10 permintaan per akun/nomor per 24 jam dan 20 per IP per jam. Kuota dan kode yang telah dihash tetap ada setelah server dimulai ulang. Respons pengiriman gagal/tidak pasti tidak dianggap konfirmasi; jika kode ternyata tiba, kode tersebut masih dapat diperiksa. Kode, token layanan, dan respons rahasia penyedia tidak dikembalikan melalui API atau log aplikasi.

Login nomor HP tetap belum diaktifkan. Konfirmasi kontak tidak mengubah status email, hak Admin/Sales, keanggotaan toko, atau persetujuan akun. Migrasi login memerlukan pemetaan identitas yang unik dan pemulihan akun tersendiri; nomor kontak bersama belum dapat dipakai sebagai identitas login.

## Menyambungkan pengiriman WhatsApp resmi

Integrasi server memakai **WhatsApp Cloud API Meta**, dengan template kategori **Authentication** dan tombol **Copy code** yang telah disetujui. Pengelola tetap harus memiliki akun layanan Meta, pengirim yang aktif, template yang sesuai, izin pengiriman, dan pengaturan biaya yang diperlukan. Kode aplikasi tidak membuat akun Meta, pengirim, template, atau saldo secara otomatis.

Isi konfigurasi pada `.env` server saja, lalu mulai ulang server:

| Pengaturan                  | Isi                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------ |
| `BAM_WHATSAPP_TOKEN`        | Token akses milik pengirim yang sah dari Meta                                        |
| `BAM_WHATSAPP_PHONE_ID`     | Phone Number ID pengirim dari Meta, bukan nomor HP penerima                          |
| `BAM_WHATSAPP_API_VERSION`  | Versi Graph API yang didukung dan dipilih pada penyiapan Meta, dengan format `vNN.N` |
| `BAM_WHATSAPP_OTP_TEMPLATE` | Nama template Authentication / Copy code yang telah disetujui                        |
| `BAM_WHATSAPP_OTP_LANGUAGE` | Bahasa template yang disetujui, misalnya `id`                                        |

Gunakan masa berlaku template yang sesuai dengan batas server 5 menit. Jangan memakai template contoh `hello_world` sebagai OTP. Jangan mengirim token ke chat, memasukkannya ke kode, memakai variabel berawalan `VITE_`, atau mengunggah `.env` ke GitHub. Semua pengiriman hanya menuju endpoint HTTPS Meta yang tetap; tidak ada pengalihan ke URL bebas, pengiriman ulang otomatis, atau fallback SMS.

Pengujian otomatis memakai pengirim palsu yang diinjeksi pada salinan aplikasi. Tidak ada mode kode universal atau tombol untuk menandai nomor terkonfirmasi tanpa OTP. Pengiriman WhatsApp sungguhan baru dapat diverifikasi setelah konfigurasi sah tersedia dan kode benar-benar diterima pemilik nomor.

## Mengapa kolom konfirmasi email sebelumnya terkunci?

Halaman verifikasi membutuhkan kode rahasia dari tautan lengkap di email. Kode dihapus dari bilah alamat sesudah dibuka untuk mengurangi kebocoran; kode hanya disimpan dalam memori halaman. Memuat ulang halaman, membuka alamat halaman tanpa kode, atau menyalin alamat setelah pembersihan dapat menghilangkan kode tersebut.

Halaman menunggu pemuatan sesi akun selesai sebelum membaca dan membersihkan tautan. Ini mencegah kode hilang saat tautan dibuka di tab baru oleh pengguna yang sudah masuk.

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
