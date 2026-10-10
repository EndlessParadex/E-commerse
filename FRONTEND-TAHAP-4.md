# BAM — Frontend tahap 4

Pembaruan 9 Oktober 2026. Paket ini memuat proyek lengkap, termasuk katalog dan akses admin dari backend tahap 1.1.

## Perubahan

- Tombol **Kembali** di atas detail produk mempertahankan halaman asal, pencarian, filter, urutan, dan posisi daftar.
- **Batalkan belanja** pada keranjang dan **Batalkan checkout** pada checkout menampilkan konfirmasi. Secara bawaan barang tetap di keranjang; tersedia pilihan untuk mengosongkannya juga.
- **Batalkan pesanan** tersedia pada daftar dan detail pesanan percobaan yang belum dibayar, dikirim, atau selesai. Alasan serta status pembatalan tersimpan, riwayat tidak dihapus, dan notifikasi ditambahkan.
- Pembayaran menyediakan bayar di tempat; transfer BCA, Mandiri, BNI, BRI; VA keempat bank tersebut; Visa, Mastercard, JCB; DANA, GoPay, ShopeePay, dan OVO. Pilihan layanan, petunjuk, serta status tampil pada detail pesanan.
- Keranjang memeriksa SKU, nama, dan harga terbaru. Checkout mengambil ulang katalog sebelum membuat pesanan. Barang yang dihapus diblokir; perubahan harga harus disetujui lewat **Gunakan informasi dan harga terbaru**.
- Menu **Semua Kategori** menyediakan kategori/subkategori dan PT/merek. Filter katalog dapat digabungkan; pencarian juga menerima SKU. Jumlah hasil serta urutan mengikuti pilihan aktif.
- Banner memilih produk yang tersedia dan memakai ID kategori yang tetap. Label contoh yang sebelumnya berlaku pada semua produk/PT telah dirapikan.
- Halaman profil, privasi, pengiriman, pembatalan/retur, dan bantuan tersedia dari footer, termasuk pada layar HP. Kontak atau ketentuan resmi yang belum diberikan ditandai belum tersedia.
- Login dan checkout menampilkan keadaan menunggu serta mencegah pengiriman ganda.

## Memasang pada proyek yang sedang digunakan

1. Hentikan layanan pengembangan dan cadangkan proyek, termasuk folder `data`.
2. Ekstrak `BAM-frontend-tahap-4.zip`. Di dalam folder `E-commerse`, salin `src`, `server`, `public`, `index.html`, `package.json`, `package-lock.json`, `vite.config.js`, `.gitignore`, dan `.oxlintrc.json` ke proyek Anda; timpa file yang sama. Paket juga dapat dijalankan sebagai proyek terpisah.
3. **Pertahankan folder `data` yang lama.** ZIP tidak memuat database atau akun. Jangan menghapus database untuk memperbarui tampilan.
4. Dari folder proyek yang berisi `package.json`, jalankan:

```powershell
npm ci --include=dev
```

Gunakan Node.js 24 atau lebih baru. Jika backend tahap 1.1 sudah terpasang dan hanya memperbarui frontend, perubahan kode tahap ini berada pada folder `src`. Setelah menimpanya, tetap jalankan `npm ci --include=dev` untuk memastikan dependensi pengujian sudah terpasang sesuai `package-lock.json`. Panduan backend tetap tersedia di `BACKEND-TAHAP-1.md`.

## Menjalankan

Terminal pertama:

```powershell
npm run server
```

Terminal kedua, pada folder proyek yang sama:

```powershell
npm run dev
```

Buka alamat yang dicetak Vite. Biasanya `http://localhost:5173/#/`; jika port tersebut terpakai, Vite dapat memakai port lain. API tetap berjalan pada `127.0.0.1:3001`. Muat ulang halaman setelah menyalin kode.

## Yang masih merupakan simulasi

Pembayaran belum memindahkan dana, membuat nomor VA, menampilkan QR pembayaran, atau meminta data kartu. Jangan melakukan pembayaran nyata berdasarkan tampilan ini.

Pesanan serta pembatalan masih disimpan pada `sessionStorage` di tab browser, belum pada database dan belum terhubung ke akun pembeli. Muat ulang mempertahankan riwayat; menutup tab dapat menghilangkannya. Katalog dan akun tetap menggunakan server serta SQLite. Stok, ongkir aktual, kurir, pembayaran, pengembalian dana, dan panel pesanan admin memerlukan tahap backend berikutnya.

Kontak WhatsApp, email, alamat usaha, serta kebijakan retur resmi belum tersedia, sesuai informasi yang diberikan pengelola. Halaman informasi menjelaskan perilaku pratinjau tanpa mengarang data tersebut.

## Validasi dan pengecekan setelah pemasangan

101 pengujian otomatis lulus, termasuk interaksi aplikasi untuk tombol kembali, kombinasi filter, pembatalan dengan/ tanpa mengosongkan keranjang, validasi alamat, pilihan pembayaran, pengiriman ganda, perubahan harga, dan status pembatalan. Pemeriksaan kode serta build berhasil.

Pemeriksaan visual pembaruan ini belum berhasil: browser alat pengujian tidak dapat terhubung ke server lokal yang dibuat di lingkungan kerja. Ukuran, pemotongan gambar, serta dialog perlu diperiksa pada browser yang menjalankan proyek setelah pemasangan.

- Desktop dan HP: buka produk dari katalog terfilter, pilih ukuran, lalu gunakan **Kembali**. Periksa filter dan urutannya tetap sama.
- Coba **Batalkan belanja** dan **Batalkan checkout**. Tutup konfirmasi untuk melanjutkan; konfirmasi pembatalan untuk kembali ke beranda. Coba juga pilihan mengosongkan keranjang.
- Buat pesanan percobaan dengan VA/kartu/e-wallet. Periksa layanan yang dipilih tampil pada ringkasan dan detail. Batalkan pesanan, lalu muat ulang dan periksa statusnya.
- Tambahkan barang ke keranjang, ubah harganya atau hapus produk dari admin, lalu coba checkout. Periksa perubahan harus ditinjau dan barang yang dihapus tidak dapat diproses.
- Periksa menu kategori, filter, foto besar pada detail pesanan, dan seluruh tautan informasi pada HP.

Perintah pemeriksaan proyek:

```powershell
npm test
npm run lint
npm run build
```

Jika `npm test` melaporkan `Cannot find package 'happy-dom'` dan tiga berkas pengujian antarmuka gagal, jalankan `npm ci --include=dev` dari folder proyek, lalu ulangi `npm test`. `happy-dom` sudah tercantum pada dependensi pengembangan; menyalin kode saja tidak memasang paket tersebut. Folder database `data` tidak perlu diubah.
