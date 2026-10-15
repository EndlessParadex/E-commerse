# Admin lebih mudah digunakan — v40

Pembaruan ini berfokus pada Kelola akun dan Kesiapan toko di halaman Pesanan.

## Kelola akun

- Cari nama/email dan pilih peran atau status. Filter peran kini mencakup Ketua, Wakil, dan Staf terpercaya.
- Peran tim menjadi label utama. Jika rekan juga merupakan Admin, izin operasional itu tetap dijelaskan di bawahnya. Filter mengikuti peran utama yang ditampilkan.
- Buka **Cara menambahkan Ketua, Wakil, atau staf** bila membutuhkan petunjuk.
- **Atur akses** ditonjolkan. Nonaktifkan menghentikan akses; Hapus hanya tersedia untuk akun yang memang boleh dihapus. Akun yang dilindungi menampilkan penjelasan.
- Aktif berarti akun dapat masuk. Pembeli tetap harus mengonfirmasi email sebelum memesan. Pengelolaan akun dan pemberian izin tetap khusus Pemilik.
- Tabel memakai teks pendamping lebih besar dan menjadi kartu pada layar kecil. Warna mengikuti tema pengguna.

Ketua, Wakil, dan staf dengan izin melihat hanya membuka **Daftar pembeli**. Pembaruan ini tidak menambah akses pengelolaan akun, SMTP, atau keuangan bagi mereka.

## Kesiapan toko

Tiga kartu menunjukkan email toko, rekening transfer, dan permintaan pesanan yang perlu diperiksa. Tautan pengaturan email hanya muncul untuk Pemilik. Pekerja lain mendapat petunjuk menghubungi Pemilik.

**Pengaturan tersimpan** berarti isian layanan email tersedia. Pemilik tetap perlu melakukan uji kirim dari Pengaturan email untuk memastikan layanan dapat mengirim.

### Arti angka email

Angka menghitung pemberitahuan email, bukan pesanan. Satu pesanan dapat menghasilkan beberapa email kepada pembeli dan admin.

| Status              | Arti dan tindakan                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| Terkirim            | Layanan email menerima pesan. Kotak masuk penerima belum dijamin; periksa juga spam.              |
| Menunggu kirim      | Pesan berada dalam antrean. Jika pernah gagal, sistem akan mencoba lagi sesuai jadwal.            |
| Sedang dikirim      | Pesan sedang diproses.                                                                            |
| Menunggu pengaturan | Pemilik perlu melengkapi layanan email.                                                           |
| Perlu diperiksa     | Percobaan otomatis sudah berhenti. Periksa pengaturan dan gunakan Coba kirim ulang bila tersedia. |
| Dilewati            | Pesan tidak dikirim dan tidak otomatis dicoba ulang. Buka alasan di bawah ringkasan.              |

Alasan yang dicatat sejak v40 meliputi email belum dikonfirmasi, status pesanan berubah, pesan lebih dari tujuh hari, pesanan/akun tidak ditemukan, akun dihapus/dinonaktifkan, atau penerima tidak lagi memiliki akses admin. Panduan berikutnya ditampilkan untuk setiap alasan.

**Riwayat lama:** pesan yang sudah berstatus dilewati sebelum v40 tidak mempunyai alasan tersimpan. Website menampilkan **Alasan belum tercatat**, bukan menebak penyebabnya. Penyimpanan layanan email sekarang tidak membuat riwayat lama otomatis terkirim.

Pesan yang dilewati tidak masuk daftar tombol kirim ulang. Hasil **masuk antrean** berarti permintaan kirim ulang diterima, bukan bukti email sudah terkirim. Jika status berubah saat tombol ditekan, website menjelaskannya dan memperbarui daftar.

Email konfirmasi akun/pemulihan kata sandi ditampilkan terpisah dari email pesanan. Status dapat dimuat ulang lewat tombol dan diperbarui otomatis setiap 30 detik selama panel terbuka.

## Pemasangan dan batas pemeriksaan

Paket v40 adalah kode lengkap, tanpa dependensi baru. Hentikan backend, cadangkan data toko dan kunci email, lalu gabungkan berkas kode ke instalasi yang sama. Jangan menghapus data, kunci, atau pengaturan pribadi. `src/data/` merupakan kode yang ikut diperbarui; berbeda dari folder database `data/` di tingkat teratas.

Saat backend dimulai kembali, tabel email mendapat kolom alasan secara otomatis. Migrasi mempertahankan status dan riwayat yang sudah ada, serta aman dijalankan kembali. Untuk instalasi yang menyajikan hasil produksi, bangun ulang frontend sebelum membuka website.

Pemeriksaan otomatis mencakup migrasi data lama, alasan email dilewati, izin dan tindakan akun, filter peran, antrean kirim ulang, serta interaksi halaman menggunakan DOM pengujian. Pengujian tidak mengirim email sungguhan. Pemeriksaan visual browser nyata/HP dan pengiriman SMTP sungguhan tetap perlu dilakukan pada instalasi toko.
