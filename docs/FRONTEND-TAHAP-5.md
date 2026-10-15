# BAM — Frontend tahap 5

Pembaruan 9 Oktober 2026. Paket ini melengkapi frontend belanja dan halaman admin pesanan/stok. Alur pesanan, pembayaran, stok, dan pengiriman masih pratinjau di tab browser; akun dan katalog tetap menggunakan API yang sudah tersedia.

## Memasang pembaruan

1. Cadangkan folder `src` proyek yang sedang Anda jalankan.
2. Ekstrak `BAM-frontend-tahap-5.zip`.
3. Salin folder `src` hasil ekstrak ke proyek `C:\Productive\CV BAM\E-commerse - Copy`, lalu timpa file yang sama. Paket memuat seluruh frontend terakhir, termasuk pilihan pack/dus dan penghapusan metode Kartu.
4. Pastikan server API tetap berjalan. Mulai ulang frontend jika pembaruan belum muncul, lalu muat ulang browser dengan Ctrl+Shift+R.
5. Buka toko pada alamat lokal yang ditampilkan terminal. Masuk dengan akun admin yang sudah Anda miliki untuk membuka menu Pesanan dan Stok.

Tidak ada perubahan database atau server dalam paket ini. Jangan menghapus database, produk, atau penyimpanan browser untuk memasang pembaruan. Jika Anda membuat perubahan sendiri pada `src` setelah versi sebelumnya, bandingkan dengan salinan cadangan sebelum menimpa.

## Yang ditambahkan

- Admin **Pesanan**: pencarian nomor/penerima/produk/SKU; filter status; rincian barang, kemasan, penerima, alamat, catatan, dan resi; mencatat pembayaran simulasi; mengirim dan menyelesaikan pesanan; pembatalan pesanan yang masih memenuhi syarat.
- Admin **Stok**: persediaan per produk dan ukuran, pencarian, filter habis/menipis, dan perubahan stok tersedia. Satuan, pack, dan dus pada ukuran yang sama memakai stok bersama.
- Stok habis dan jumlah melebihi persediaan ditampilkan di produk/keranjang. Checkout memeriksa ulang stok; barang tidak otomatis dihapus atau diganti jumlahnya tanpa tindakan pembeli.
- **Lanjutkan pembayaran** pada detail dan daftar pesanan. Halaman pratinjau menyediakan hasil berhasil, gagal, coba lagi, dan kedaluwarsa. Metode Kartu tetap tidak tersedia, termasuk untuk melanjutkan pesanan lama yang memakai Kartu.
- Batas pembayaran pratinjau **24 jam** setelah checkout untuk transfer/VA/e-wallet. Batas ini adalah aturan demo, bukan kebijakan resmi BAM. COD tetap tersedia dan tidak memakai batas tersebut.
- Pembatalan dan kedaluwarsa melepas stok simulasi. Pembayaran gagal menahan stok sampai dicoba kembali, dibatalkan, atau kedaluwarsa. Pembayaran berhasil, pengiriman, dan penyelesaian menjaga alokasi barang.
- Resi, kurir, waktu pengiriman, dan waktu diterima terlihat pada detail pesanan. Tidak ada tautan pelacakan palsu atau nomor pembayaran nyata yang dibuat.
- Filter dan pencarian pesanan pembeli, status kedaluwarsa, serta halaman tidak ditemukan untuk URL yang tidak valid.
- Form akun terkunci saat menyimpan, mencegah kiriman ganda, dan mempertahankan isian saat API gagal. Penyimpanan alamat lokal menunggu konfirmasi API untuk pengguna yang sudah masuk.
- Perlindungan isian form berlaku juga saat hash/alamat halaman berubah. Tombol lewat ke isi halaman tidak dianggap meninggalkan form. Keluar akun memeriksa perubahan yang belum disimpan sebelum logout.
- Permintaan sesi/profil/logout/katalog diberi batas waktu agar tampilan tidak terus menunggu. Hasil penyimpanan yang belum dikonfirmasi tidak dilaporkan sebagai berhasil.

## Cara mencoba

1. Masuk sebagai admin, buka **Stok**, cari produk dengan pilihan satuan/pack/dus, lalu ubah stok ukuran yang sama menjadi **30 satuan**.
2. Buka toko, pilih **2 pack isi 6** dan **1 dus isi 24** dengan ukuran yang sama. Kebutuhan total 36 satuan, sehingga keranjang/checkout harus menolak jumlah tersebut. Untuk 30 satuan, gunakan 1 pack isi 6 dan 1 dus isi 24.
3. Checkout dengan VA atau e-wallet. Stok tersedia berkurang sesuai jumlah satuan yang ditahan oleh pesanan.
4. Tekan **Lanjutkan pembayaran**, coba hasil **gagal**, lalu **coba kembali**. Pilih berhasil untuk membuat pesanan siap diproses. Tidak ada dana yang diproses.
5. Buka admin **Pesanan**, pilih **Kirim pesanan simulasi**, isi kurir dan resi uji. Buka detail pesanan di toko untuk melihat resi, lalu coba status selesai dari admin.
6. Buat pesanan baru yang belum dibayar dan batalkan. Stok kembali tersedia. Pembatalan kedua tidak boleh menambah stok lagi.
7. Buat pesanan baru yang belum dibayar dan coba kedaluwarsa. Tombol pembayaran tidak tersedia lagi dan stok dilepas.
8. Coba stok 0; tombol membeli kemasan yang kehabisan stok tidak tersedia. Jika stok berubah setelah barang masuk keranjang, pemberitahuan membantu mengurangi jumlah atau menghapus barang.
9. Isi form produk/akun tanpa menyimpan lalu pindah halaman. Menolak konfirmasi harus mempertahankan isian. Coba juga koneksi gagal, katalog kosong, pencarian tanpa hasil, keranjang kosong, dan pesanan yang tidak ditemukan.

Pengujian pratinjau dilakukan di **tab yang sama**. Membuka tab terpisah tidak membagikan pembaruan pesanan/stok karena penyimpanannya masih sementara. Pesanan lama tetap dapat dibaca; pesanan tanpa metadata alokasi dari versi lama tidak dipotong dari stok demo baru. Stok awal demo adalah **120 satuan per produk/ukuran**, bukan stok gudang nyata.

## Pemeriksaan

- **118 pengujian otomatis lulus**, termasuk interaksi aplikasi dari stok sampai checkout, pembayaran, pembatalan, pengiriman, resi, pesanan selesai, dan kegagalan penyimpanan profil.
- Lint lulus tanpa peringatan.
- Build produksi lulus.
- Tata letak baru menggunakan kartu responsif, teks panjang yang dapat membungkus, ukuran tombol minimal 44 px, label form, fokus keyboard, dan dialog konfirmasi.
- **Pemeriksaan visual versi baru di browser belum disahkan.** Pratinjau terpisah tidak dapat diakses oleh browser sesi ini, dan sesi ini tidak mendapat akses menulis ke `src` proyek aktif. Website lama pada localhost:5173 dapat dibaca, tetapi itu tidak membuktikan tampilan kode baru. Pemeriksaan desktop/HP dan lintas browser perlu dilanjutkan setelah paket dipasang.

## Sebelum dipakai untuk transaksi nyata

Sambungkan pesanan/stok ke server dan akun pembeli, gunakan layanan pembayaran serta konfirmasi server, dan hubungkan pengiriman nyata. Validasi stok, pembayaran, perubahan status, serta batas waktu harus ditegakkan oleh server. Kontak layanan pelanggan, alamat usaha, ketentuan pembatalan/retur, dan kebijakan resmi masih menunggu data dari pengelola. Frontend tahap ini siap diuji sebagai pratinjau; belum dinyatakan selesai untuk produksi.
