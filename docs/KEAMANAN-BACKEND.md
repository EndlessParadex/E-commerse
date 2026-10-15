# Keamanan backend — v34

Pengelolaan akun v35 tersedia pada [KELOLA-AKUN.md](./KELOLA-AKUN.md). Akses pengelolaan hanya untuk pemilik, termasuk API daftar/perubahan pengguna lama. Penonaktifan mencabut sesi dan token, menghalangi login/pemulihan, serta diperiksa lagi di dalam transaksi pesanan/stok. Penghapusan akun tanpa riwayat dilakukan atomik; akun pemilik dan akun yang sedang digunakan dilindungi. Akun lama tetap aktif saat migrasi. Audit tidak menyimpan kata sandi.

Alur transaksi dan migrasi terbaru dijelaskan pada [TRANSAKSI-TOKO.md](./TRANSAKSI-TOKO.md). Persetujuan toko menahan stok, pelanggan menyetujui total akhir, dan pembayaran transfer diperiksa admin. VA/e-wallet belum ditawarkan tanpa integrasi nyata.

## Akses pemilik toko dan pengaturan email

Pemilik merupakan admin dengan hak tambahan yang tersimpan di tabel `store_owners`. Admin lama tidak otomatis menjadi pemilik. Perintah `create-owner` atau `create-owner:company` menetapkan hak ini dari komputer server; tidak ada endpoint promosi lewat profil/registrasi. Server memeriksa hak pemilik langsung dari database pada setiap pembacaan maupun perubahan pengaturan email.

Simpan dan kirim email uji memerlukan kata sandi akun pemilik yang berlaku. Pemeriksaan dibatasi antrean scrypt dan pembatas sumber login; hak dan hash diperiksa kembali setelah penantian. Admin operasional/pembeli mendapatkan 403 pada API pengaturan, termasuk ketika mengirim flag/peran palsu. Revisi mencegah pengaturan lama menimpa pembaruan dari perangkat lain.

Kredensial SMTP disimpan dengan AES-256-GCM. API hanya mengembalikan isian non-rahasia dan penanda adanya kata sandi. Kunci tetap berada di konfigurasi/berkas server dan tidak dikirim ke browser. Catatan audit menyimpan pelaku, waktu dan hasil tindakan tanpa sandi atau isi pengaturan. Email uji hanya dapat menuju alamat pemilik yang sedang masuk dengan jeda satu menit per akun. Kesalahan pengiriman tidak memuat rincian kredensial dalam respons/log.

Panduan penggunaan, bootstrap pemilik, pencadangan dan batas pemeriksaan ada pada [PEMILIK-DAN-EMAIL.md](./PEMILIK-DAN-EMAIL.md).

## Identitas dan login

Verifikasi email wajib sebelum membuat permintaan pesanan dan menyetujui penawaran. Pendaftaran menyimpan hash kata sandi yang dipilih sejak awal; pelanggan tidak perlu membuat kata sandi baru saat verifikasi. Akun belum terverifikasi dapat masuk untuk mengirim ulang tautan, tetapi tidak dapat membuat pesanan. Tanpa SMTP, pendaftaran tetap diterima dan status toko yang belum siap ditampilkan dengan jelas.

Pendaftaran/lupa kata sandi memakai jawaban umum untuk alamat yang ada maupun tidak ada. Mendaftar ulang ke alamat yang sudah terdaftar dapat mengirim tautan pemulihan akses, tanpa mengubah kata sandi atau data akun sebelum pemilik membuktikan emailnya. Kata sandi awal tidak disimpan dalam bentuk teks biasa.

Email verifikasi berlaku 24 jam; reset 30 menit. Token di-hash, pesan berisi tautan akun disimpan terenkripsi dengan kunci terpisah, dan tautan hanya dapat digunakan sekali. Verifikasi akun memerlukan kata sandi akun. Reset/perubahan kata sandi mencabut seluruh sesi dan token lama. Login yang sedang berlangsung memeriksa ulang hash sebelum menerbitkan sesi. Pembuatan ulang admin melalui terminal juga mencabut sesi/token akun tersebut.

Formulir ubah kata sandi di halaman akun hanya untuk admin dan mengubah akun yang sedang masuk, bukan akun pembeli lain. Pembeli hanya melihat informasi kata sandi. Endpoint perubahan menolak pembeli dengan 403, dan peran admin diperiksa lagi dari database sebelum menyimpan untuk menangani pencabutan akses saat proses berlangsung. Pemulihan melalui tautan email dari halaman masuk tetap tersedia bagi pemilik akun; pembatas ini tidak menonaktifkan verifikasi email atau reset dengan token.

Permintaan email dibatasi 3 per alamat per jam dan maksimal 6 per 24 jam berjalan, lintas jenis permintaan. Counter memakai hash alamat, tersimpan di database, dan tidak mengunci login pemilik akun. Sumber permintaan juga dibatasi.

Email yang ada/tidak ada sama-sama menjalani scrypt dengan hash dummy untuk data yang hilang/rusak. Tidak ada kuota keras per email atau seluruh situs yang dapat digunakan untuk mengunci korban. Kegagalan dihitung menurut IP dan pasangan IP+email: ambang 60/IP dan 10/pasangan per menit. Setelah ambang, sumber diperlambat satu detik dan kegagalan mendapat 429; kata sandi benar tetap dapat diterima.

Antrean membatasi pekerjaan kata sandi per proses: 8 aktif, 2 aktif/IP, 64 menunggu dan 4 menunggu/IP. Antrean penuh mendapat 503 sementara. Counter gagal berlaku lintas proses yang berbagi database; antrean CPU berlaku per proses. Perlindungan ini tidak menjamin kebal DDoS dari banyak sumber.

## Transaksi stok

Permintaan awal tidak menahan stok. Pemeriksaan sumber, batas akun, harga dan alokasi SKU memakai transaksi server. Persetujuan toko memeriksa seluruh alokasi sebelum mengurangi stok; konflik stok menghasilkan pembatalan dengan alasan kepada pelanggan. Snapshot isi kemasan, harga dan rekening penawaran tidak berubah ketika katalog/pengaturan bank diubah.

Kedaluwarsa/pembatalan melepas reservasi paling banyak sekali. Permintaan yang tidak pernah menahan stok tidak menambah persediaan. Penawaran memiliki batas maksimum reservasi meskipun pelanggan belum membuka email. Pengingat tidak mengubah revisi transaksi sehingga tidak membuat persetujuan pelanggan gagal hanya karena sebuah pemberitahuan dicatat.

Bukti transfer dibatasi JPG/PNG/WebP maksimal 1 MB dengan pemeriksaan format dan signature. SVG/HTML ditolak. Bukti hanya disajikan melalui rute yang memeriksa sesi pemilik/admin, memakai `private, no-store`, `nosniff` dan sandbox. Bukti bukan bukti otomatis bahwa dana diterima. Pesanan yang buktinya sedang diperiksa tidak dilepas otomatis; admin harus memeriksa, menerima atau meminta perbaikan. Batas unggah 3 kali per pesanan.

## Privasi persediaan

`GET /api/inventory` hanya memuat ketersediaan publik; statistik rinci `soldUnits` dan `reservedUnits` hanya ada pada `GET /api/admin/inventory` yang memerlukan admin. Pembacaan publik tidak mengambil transaksi tulis atau memindai riwayat pesanan. Statistik diisi sekali ketika migrasi, lalu diperbarui bersama perubahan pesanan.

Pengelola dapat menampilkan/menyembunyikan jumlah stok dan memilih angka penjualan publik yang dibulatkan. Menampilkan stok tetap memungkinkan pengunjung memantau perubahan ketersediaan; ini bukan mekanisme merahasiakan seluruh aktivitas toko.

## Email pesanan, restart dan proxy

Email pesanan memakai antrean persisten dengan deduplikasi per peristiwa/penerima, lease antarworker, percobaan ulang dan status kegagalan yang dapat dilihat admin. SMTP diterima tidak menjamin email masuk ke kotak utama; crash setelah penerimaan SMTP bisa menyebabkan kiriman ulang. Worker berhenti secara tertib sebelum database ditutup. Pengujian mencakup klaim antar-koneksi dan kedaluwarsa selama downtime.

IP forwarded hanya dipercaya dari IP/CIDR proxy yang dikonfigurasi eksplisit. Default kosong mengabaikan header forwarded; jangan membuka kepercayaan untuk seluruh jaringan. Petunjuk SMTP/kunci/proxy ada pada [EMAIL-DAN-PROXY.md](./EMAIL-DAN-PROXY.md).

Kesalahan tak terduga dicatat dengan ID operasi/permintaan, jenis/kode dan lokasi stack. Body, cookie, query/token, kata sandi dan pesan exception mentah tidak dicetak. Respons 500 tidak memuat rincian internal. Halaman publik meng-escape teks katalog dan data terstruktur; akun, bukti dan pesanan tidak disajikan sebagai metadata produk publik.

## Pemeriksaan

Gunakan Node.js 24 atau lebih baru. Pengujian memakai database fixture/memori; tidak menyentuh data perusahaan atau mengirim email sungguhan.

```powershell
npm ci --include=dev
npm test
npm run lint
npm run format:check
npm run build
```

Tes interaksi memakai Happy DOM/Vite, termasuk alur pelanggan-admin, unggah bukti, pemulihan tampilan dan cetak. Ini tidak menggantikan pemeriksaan visual browser/HP atau uji beban deployment. Folder `review/` tidak diperlukan aplikasi dan tidak disertakan paket v31.
