# Pengaturan perusahaan — v38

Buka **Ruang admin → Pengaturan perusahaan**. Pembaruan ini merapikan formulir identitas perusahaan yang sebelumnya terlalu dekat dengan tepi kartu, menampilkan dua kontrol unggah, dan memiliki kotak centang terlalu besar.

## Perubahan tampilan

- Logo mendapat area pratinjau sendiri. Gunakan **Pilih logo** atau **Ganti logo** untuk membuka pemilih gambar; **Hapus logo** tetap tersedia.
- Profil toko dan alamat/kontak memiliki kelompok yang jelas. Deskripsi serta alamat lebih ringkas dan tetap dapat diperbesar secara vertikal.
- Pembayaran dipisahkan dari identitas. COD memiliki pilihan yang mudah diklik; rekening transfer berada di kelompok tersendiri.
- Pengaturan angka terjual dan sisa stok menjadi dua pilihan dengan keterangan masing-masing.
- Tombol simpan, muat ulang, dan lihat toko berada di bagian bawah dengan jarak yang konsisten.
- Pada layar sempit, kelompok logo dan isian disusun ke bawah. Warna mengikuti tema dan pilihan aksen pengguna.

## Perilaku yang dipertahankan

Logo tetap menerima JPG, PNG, dan WebP maksimal 1 MB. Perubahan baru tersimpan setelah menekan **Simpan pengaturan**. Penjagaan isian belum disimpan, validasi, dan penanganan konflik pengaturan tetap digunakan. Tidak ada perubahan server, database, aturan pembayaran, hak akses atau dependensi.

Pengujian mencakup tombol pemilih logo, penolakan berkas selain gambar, unggah/hapus logo, penyimpanan rekening dan pilihan COD/visibilitas, pemuatan kembali nilai, serta penjagaan isian saat navigasi. Tampilan pada browser nyata dan HP masih perlu ditinjau setelah paket dipasang.
