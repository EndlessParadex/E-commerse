# Backend stok dan pesanan — v23

> Dokumen tahap sebelumnya. Untuk alur aktif v31 (rekening toko, ongkir, penawaran, verifikasi email dan bukti transfer), gunakan [TRANSAKSI-TOKO.md](./TRANSAKSI-TOKO.md).

Versi ini menambahkan penyimpanan stok dan pesanan pada database Node.js yang sama dengan akun, identitas perusahaan, dan katalog. Pesanan terhubung ke akun pemiliknya. Admin membaca pesanan pelanggan melalui ruang admin; pelanggan hanya membaca pesanan mereka sendiri.

## Memasang pada BAM yang sudah digunakan

1. Hentikan frontend dan backend dengan **Ctrl+C** pada terminal masing-masing.
2. Setelah server berhenti, salin folder `data` ke lokasi cadangan Anda. Folder ini berisi database akun, katalog, dan pengaturan perusahaan.
3. Ekstrak **BAM-backend-stok-pesanan-v23.zip**.
4. Buka folder **BAM-backend-stok-pesanan-v23** pada hasil ekstrak. Drag seluruh isinya ke proyek yang memiliki `package.json`, lalu pilih **Replace**. Gabungkan `src` dan `server` dengan folder proyek yang sama.
5. Jalankan kembali:

```powershell
npm run dev:full
```

6. Muat ulang website dengan **Ctrl+Shift+R**. Pada ruang admin, halaman Stok dan Pesanan menampilkan keterangan **Database / server**. Jika masih tertulis bahwa stok tersimpan di tab, pastikan backend dijalankan ulang dari folder proyek yang sudah diperbarui.

Database yang sudah ada tetap digunakan. Tabel baru dibuat otomatis ketika backend dijalankan; akun, katalog, logo, dan pengaturan perusahaan tetap dipertahankan. Paket pembaruan tidak membawa database pengganti.

## Stok awal dan stok simulasi lama

Pada pembaruan pertama instalasi BAM/demo, ukuran yang sudah ada memakai angka contoh 120 seperti pratinjau sebelumnya. Instalasi perusahaan baru dimulai dengan 0. **Produk atau ukuran yang ditambahkan setelah backend aktif selalu dimulai dengan 0**, termasuk pada BAM, sampai admin mengisi stoknya.

Jika tab browser Anda masih menyimpan stok simulasi yang pernah diubah, halaman **Stok** menyediakan tombol **Periksa stok lama untuk impor**:

1. Buka tab dan browser yang sebelumnya dipakai mengubah stok.
2. Masuk sebagai admin dan buka Stok.
3. Tekan tombol tersebut, lalu periksa nama, ukuran, dan angka sisa stok dalam dialog.
4. Jika sesuai, tekan **Impor angka stok ini**.

Impor hanya tersedia sebelum stok server pernah diubah atau pesanan server pertama dibuat. Seluruh daftar diperiksa dan disimpan bersama; data yang tidak valid membatalkan seluruh impor. Impor tidak menyalin riwayat pesanan simulasi sebagai pesanan pelanggan. Jika tombol tidak muncul, atau impor awal sudah ditutup, isi stok melalui **Ubah stok tersedia** berdasarkan jumlah yang telah diperiksa.

Angka yang disimpan adalah jumlah satuan tersedia untuk pembelian baru. Satuan, Pack, dan Dus pada produk/ukuran yang sama memakai stok bersama. Ringkasan Dus + Pack + Satuan lepas tetap digunakan. Stok yang sudah ditahan pesanan tidak dihapus ketika admin mengubah jumlah tersedia.

## Cara mencoba sebagai pelanggan

1. Masuk atau buat akun pelanggan. Checkout baru membutuhkan akun agar riwayat memiliki pemilik yang jelas.
2. Pilih produk, ukuran, dan kemasan, lalu masukkan ke keranjang.
3. Periksa alamat, pengiriman, metode pembayaran, dan total sebelum checkout.
4. Buat pesanan. Server memeriksa SKU, harga, jumlah, dan stok; harga/ongkir dari isian yang diubah pada browser tidak dipercaya.
5. Buka **Pesanan saya**. Pesanan tetap tersedia setelah muat ulang atau penyimpanan browser dibersihkan. Dari perangkat lain, buka website yang mengarah ke backend/database yang sama dan masuk ke akun tersebut.

Server menahan stok pada saat pesanan dibuat. Pembatalan pesanan yang belum dibayar/dikirim dan batas pembayaran 24 jam yang berakhir mengembalikan stok satu kali. Pesanan yang dikirim atau selesai tetap mengurangi stok.

Pengulangan checkout memakai nomor permintaan yang sama sampai hasilnya diketahui. Jika koneksi terputus setelah server menyimpan, coba kembali dengan isian yang sama atau periksa Pesanan saya terlebih dahulu. Jangan menganggap gangguan koneksi berarti pesanan belum tersimpan. Nomor permintaan teknis disimpan pada tab agar pengulangan dapat dikenali; isi pesanan dan stok utama disimpan di database.

## Cara mencoba sebagai admin

- **Stok:** ubah jumlah tersedia lalu simpan. Jika orang lain mengubah stok atau pembeli mengambil barang ketika form terbuka, server menolak versi yang sudah lama. Tekan **Muat stok terbaru ke form**, periksa ulang jumlah, lalu simpan.
- **Pesanan:** lihat pesanan semua pelanggan. Halaman Pesanan saya pada toko tetap menampilkan pesanan admin sendiri.
- **Pembayaran manual:** periksa pembayaran melalui saluran resmi perusahaan, tekan **Catat pembayaran manual**, dan isi referensi pembayaran yang telah diperiksa. Pelanggan tidak dapat menandai pesanan menjadi lunas. Tombol simulasi pembayaran tidak digunakan pada pesanan backend.
- **Pengiriman:** setelah pesanan siap, tekan **Catat pengiriman**, lalu isi kurir dan nomor resi. Nomor resi dan status tersimpan pada server dan muncul pada detail pelanggan.
- **Selesai:** setelah penerimaan telah diperiksa, selesaikan pesanan. Untuk COD, admin sekaligus mencatat penerimaan pembayaran.

Riwayat dimuat 50 pesanan per halaman. Gunakan **Muat pesanan lebih lama** untuk riwayat sebelumnya. Detail pesanan lama tetap dapat dibuka langsung dari tautannya. Perubahan status diperiksa ulang secara berkala setiap 15 detik ketika halaman aktif, ketika jendela kembali mendapat fokus, dan setelah penyimpanan.

## Penyimpanan foto dan histori

Harga, nama, ukuran, kemasan, dan foto dicatat pada saat checkout. Perubahan katalog berikutnya tidak mengganti informasi pesanan lama. Foto pesanan disimpan sebagai data gambar pada database; gambar yang identik dapat dipakai beberapa pesanan tanpa menggandakan byte gambar. Akses foto tetap memerlukan akun pemilik atau admin.

Data pratinjau lama pada browser tidak dihapus oleh pembaruan. Daftar pesanan baru menggunakan data server. Notifikasi pada browser dipisahkan menurut akun; notifikasi, favorit, keranjang, dan preferensi tampilan belum dipindahkan seluruhnya ke server.

## Yang masih perlu dilanjutkan

Pencatatan di database sudah berjalan, tetapi **aplikasi belum memproses pembayaran online, menerbitkan nomor VA/QR, mengirim WhatsApp, atau melacak kurir secara otomatis**. Biaya pengiriman masih memakai tarif contoh Reguler Rp10.000 / Express Rp20.000 yang ditampilkan pada checkout. Pencatatan pembayaran/pengiriman oleh admin tidak mengirim instruksi ke bank atau kurir.

Jika website masih dibuka melalui `localhost`, backend dan database masih berada pada komputer yang menjalankannya. Untuk pemakaian bersama dari perangkat lain, aplikasi perlu dipasang pada server perusahaan dan frontend diarahkan ke backend yang sama. Paket ini belum melakukan deployment ke server luar.

Paket lengkap **Aplikasi-perusahaan-kosong-v23.zip** tersedia untuk perusahaan lain. Ikuti MODE-PERUSAHAAN.md untuk membuat admin, lalu isi identitas, pemasok, kategori, merek, produk, dan stok mereka sendiri. Paket lengkap tidak membawa database atau data akun BAM.

## Pemeriksaan

169 tes, lint, dan build telah lulus. Pengujian mencakup database yang dibuka ulang, harga/ongkir server, stok bersama Satuan/Pack/Dus, checkout serentak dari beberapa proses, pengulangan saat respons terputus, pembatalan/kedaluwarsa satu kali, batas akun/admin, konflik stok, impor awal yang utuh, foto/harga histori, pergantian akun dengan respons terlambat, serta alur React pelanggan/admin.

Pengujian antarmuka menggunakan DOM simulasi. Periksa tampilan di browser desktop/HP sesudah paket dipasang. Build menghasilkan catatan ukuran bundel frontend; ini tidak membatalkan build, tetapi pemecahan bundel dapat dikerjakan sebelum deployment produksi.
