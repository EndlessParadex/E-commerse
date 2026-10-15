# Transaksi toko — v31

Website memakai alur **permintaan pesanan grosir dengan penawaran toko**. Mengirim permintaan belum menjamin stok atau total akhir. Persetujuan toko menahan stok; pelanggan kemudian menyetujui ongkir dan total akhirnya. Alur ini mencegah pembeli langsung menghabiskan persediaan melalui pesanan yang belum diperiksa.

## Menyiapkan toko

1. Masuk sebagai admin dan buka **Pengaturan perusahaan**. Bagian **Kesiapan toko** menunjukkan konfigurasi email, rekening, permintaan menunggu dan masalah pengiriman notifikasi.
2. Isi nama, kontak dan alamat perusahaan. Aktifkan COD jika tersedia.
3. Untuk transfer, isi **Nama bank tujuan**, **Nomor rekening**, dan **Nama pemilik rekening** secara lengkap. Petunjuk transfer opsional. Rekening yang belum lengkap tidak dapat disimpan.
4. Konfigurasikan SMTP, alamat publik website dan kunci antrean melalui [EMAIL-DAN-PROXY.md](./EMAIL-DAN-PROXY.md), lalu restart backend.
5. Daftarkan alamat pengujian yang Anda kuasai, buka email verifikasi, dan gunakan kata sandi yang dipilih saat mendaftar. Coba seluruh alur pesanan sebelum menerima pelanggan.

**Verifikasi email wajib sebelum pelanggan membuat permintaan atau menyetujui penawaran.** Tanpa SMTP, pendaftaran tetap tersimpan dan akun dapat masuk, tetapi pelanggan belum dapat memesan. Admin mendapat indikator bahwa toko belum selesai disiapkan. Konfigurasi email lengkap tidak membuktikan pesan telah diterima di kotak masuk; pengiriman nyata perlu diuji dengan penyedia email.

## Metode pembayaran yang tersedia

Pelanggan hanya melihat COD yang diaktifkan dan transfer ke rekening toko yang sudah lengkap. VA dan e-wallet otomatis disembunyikan karena belum ada integrasi bank/payment gateway. Website tidak menghasilkan nomor VA, QRIS atau transaksi gateway palsu.

Rekening tujuan disalin ke pesanan saat toko mengirim penawaran. Mengubah pengaturan bank kemudian tidak mengubah rekening pada penawaran yang sudah diberikan. Jika perlu mengganti instruksi pada pesanan yang sudah disetujui, hubungi pelanggan dan tangani pembatalan/penawaran baru dengan jelas; jangan meminta pelanggan memakai rekening dari pesan tidak resmi.

## Alur permintaan sampai pengiriman

1. Pelanggan yang sudah terverifikasi mengirim permintaan dengan alamat, barang, jumlah dan metode pembayaran. Ongkir ditandai **Dikonfirmasi toko**; angka yang ditampilkan adalah subtotal sementara.
2. Admin menerima email permintaan baru dan melihat antreannya pada menu **Pesanan**. Admin memeriksa barang, tujuan, kurir, serta biaya pengiriman sebenarnya.
3. Pilih **Konfirmasi COD** atau **Setujui untuk pembayaran**, isi ongkir akhir dan kurir/metode penyerahan. Isi 0 jika penyerahan memang gratis. Server memeriksa seluruh alokasi stok dan menahannya dalam satu transaksi.
4. Pelanggan mendapat email bahwa total akhir siap disetujui. Penawaran awal menahan stok paling lama 24 jam. Pelanggan dapat menerima total atau membatalkan.
5. COD: pelanggan memilih **Setujui total COD**; pesanan masuk Diproses dan dibayar saat diterima. Transfer: pelanggan memilih **Setujui dan lanjutkan pembayaran**, lalu melihat rekening resmi, nama pemilik, total dan batas pembayaran.
6. Batas pembayaran awal 30 menit dihitung dari persetujuan pelanggan, bukan dari klik admin. Batas tersebut tetap tidak melewati akhir reservasi penawaran.
7. Untuk transfer, pelanggan mengunggah bukti JPG/PNG/WebP maksimal 1 MB. Bukti hanya dapat dilihat pemilik pesanan dan admin. **Bukti bukan konfirmasi pembayaran.** Admin memeriksa dana/referensi bank sebelum memilih **Catat pembayaran manual**.
8. Bukti yang menunggu pemeriksaan tidak membuat pesanan dibatalkan otomatis saat batas pembayaran lewat. Jika perlu diperbaiki, admin memilih **Minta perbaikan bukti** dan menuliskan alasannya. Pelanggan mendapat waktu baru 30 menit dan maksimal 3 unggahan per pesanan. Hubungi toko bila batas unggah tercapai.
9. Admin mencatat kurir/resi, kemudian menyelesaikan pesanan sesuai pengiriman sebenarnya. Jumlah terjual hanya bertambah ketika pesanan selesai.

Pesanan dengan pembayaran/bukti yang sedang diperiksa memerlukan penyelesaian oleh toko; jangan membatalkan atau melepaskan stok jika dana mungkin sudah masuk tanpa memeriksa pengembalian dana. Pengiriman/ongkir ditetapkan toko, belum terhubung otomatis ke API kurir.

## Jika stok kurang

Dua pelanggan boleh mengirim permintaan 80 satuan ketika stok 120 karena belum ada reservasi. Persetujuan pertama menahan 80. Jika admin mencoba menyetujui permintaan kedua, server membatalkannya dengan alasan **stok tidak cukup**, dan pelanggan mendapat pembaruan. Tidak ada reservasi sebagian atau status menunggu tanpa keputusan. Pelanggan dapat mengirim jumlah baru atau menghubungi toko.

Admin juga dapat membatalkan permintaan dengan alasan. Alasan tampil di detail pesanan dan email pembatalan. Permintaan yang belum disetujui tidak menambah stok ketika dibatalkan karena tidak pernah menahannya.

## Notifikasi dan kontak

Email mencakup permintaan baru untuk admin, total siap disetujui, pembayaran dimulai, pengingat menjelang batas waktu, bukti masuk/perlu diperbaiki, pembayaran diterima, pengiriman, pembatalan, dan penyelesaian. Notifikasi di dalam aplikasi tetap tersedia.

Antrean persisten memakai lease agar worker pada database yang sama tidak mengerjakan kiriman yang sama bersamaan. Kegagalan dicoba lagi dengan jeda bertambah; setelah 10 kegagalan, admin dapat mengirim ulang melalui bagian Kesiapan toko. Masalah pengiriman terlihat sejak percobaan yang gagal. Status antrean email verifikasi/reset juga ditampilkan agar kesalahan SMTP terlihat sebelum pelanggan dapat memesan. Status terkirim berarti server SMTP menerima pesan, bukan jaminan kotak masuk penerima.

Proses yang terhenti sesudah SMTP menerima pesan dapat menyebabkan email dikirim ulang. Tautan akun tetap sekali pakai dan perubahan pesanan tidak dijalankan ulang oleh email. Periksa juga folder spam dan status layanan penyedia email.

WhatsApp bersifat **kontak manual opsional**. Nomor yang disetujui pelanggan digunakan tombol **Hubungi pembeli via WhatsApp** pada admin; operator memeriksa dan mengirim pesan sendiri. Tidak ada janji pengiriman WhatsApp otomatis atau integrasi Meta yang belum disediakan.

## Batas waktu dan permintaan

| Variabel                             |     Awal | Keterangan                                      |
| ------------------------------------ | -------: | ----------------------------------------------- |
| `BAM_REVIEW_HOURS`                   |  168 jam | Pemeriksaan permintaan, tanpa menahan stok      |
| `BAM_QUOTE_HOLD_HOURS`               |   24 jam | Reservasi penawaran menunggu pelanggan          |
| `BAM_PAYMENT_HOLD_MINUTES`           | 30 menit | Pembayaran setelah total diterima pelanggan     |
| `BAM_MAX_OPEN_ORDERS`                |        5 | Permintaan yang belum selesai diperiksa/dibayar |
| `BAM_MAX_RESERVED_UNITS`             |     1000 | Total satuan dasar permintaan tersebut per akun |
| `BAM_MAX_RESERVED_UNITS_PER_PRODUCT` |      200 | Satuan dasar per produk/ukuran per akun         |

Durasi baru berlaku pada deadline baru; deadline tersimpan tidak diperpanjang oleh restart. Permintaan checkout juga dibatasi 20 per akun dalam 24 jam dan 30 per sumber IP per jam. Retry dengan nomor permintaan yang sama mengembalikan pesanan semula dan tidak menggunakan kuota baru. Batas ini tidak menggantikan perlindungan jaringan terhadap serangan terdistribusi.

## Pesanan lama

Migrasi v31 dilakukan sekali. Pesanan lama yang belum dibayar dan masih menunggu pemeriksaan/konfirmasi/pembayaran kembali ke pemeriksaan penawaran. Reservasi lama dilepas, ongkir ditetapkan ulang, dan metode non-COD lama ditawarkan sebagai transfer manual yang memerlukan persetujuan pelanggan. Detail barang/harga historis dipertahankan, dan metode/total sebelumnya dicatat sebagai penanda migrasi.

Pesanan yang sudah dibayar, diproses sebagai COD terkonfirmasi, dikirim atau selesai tidak dialihkan ke penawaran baru. Jika ada transfer yang sudah masuk tetapi belum dicatat sebelum pembaruan, selesaikan pencatatannya sebelum memasang pembaruan atau periksa secara manual setelah migrasi. Jangan menganggap status belum dibayar membuktikan dana belum masuk.

Cadangkan kode dan seluruh folder database saat backend berhenti. Untuk rollback, pulihkan kode dan database cadangan bersama; versi lama tidak memahami penawaran/bukti pembayaran baru.

## Cetak dan berbagi produk

Detail pesanan memiliki **Faktur / ringkasan pesanan → Cetak / simpan PDF**. Dokumen memakai rincian barang, harga, ongkir, status dan referensi pembayaran yang tersimpan. Ringkasan sebelum ongkir ditetapkan ditandai sementara. Dokumen ini tidak menggantikan faktur pajak.

Tombol **Bagikan produk** menggunakan URL publik `/produk/SKU`, tanpa fragmen `#`. Server menyajikan HTML produk, judul, deskripsi, canonical, Open Graph dan data terstruktur sebelum JavaScript dijalankan. `/sitemap.xml` memerlukan `BAM_PUBLIC_URL` yang benar. Rute hash lama tetap bisa dipakai untuk tautan yang sudah ada; akun/pesanan tidak dijadikan halaman publik yang dapat diindeks.

Untuk pengembangan gunakan `npm run dev:full`. Untuk deployment, bangun dengan `npm run build`, lalu jalankan `npm run server` di belakang HTTPS/reverse proxy pada domain yang dikonfigurasi. Backend juga menyajikan folder `dist` dan halaman produk publik. `npm run preview` hanya untuk pratinjau bundle statis, bukan server deployment metadata produk.

Kemampuan menyajikan HTML/metadata tidak menjamin mesin pencari akan mengindeks situs atau layanan berbagi akan memperbarui cache seketika. Pemeriksaan visual browser desktop/HP, pengiriman SMTP nyata, dan uji beban produksi tetap dilakukan pada deployment perusahaan.
