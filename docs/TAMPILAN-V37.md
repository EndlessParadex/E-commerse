# Perapihan tampilan pembeli dan admin — v37

Pembaruan ini mengikuti pilihan pengguna untuk memaksimalkan tampilan pembeli sekaligus admin. Fokusnya keterbacaan, menu yang mudah ditemukan, dan gaya kartu/kontrol yang konsisten.

## Tampilan pembeli

- Nama produk, rating, label promo, dan tombol pada kartu diperbesar, termasuk penyesuaian pada layar kecil.
- Kartu kategori dan produk memakai bayangan lembut serta garis batas yang konsisten. Hover menonjolkan kartu tanpa menggeser posisinya.
- Pilihan gramasi/kemasan memakai latar netral; pilihan aktif tetap memakai aksen warna pengguna. Garis pilihan aktif mengikuti pengaturan warna, termasuk tema gelap.
- Panel pembelian memiliki garis aksen dan penekanan harga yang lebih jelas. Perilaku gambar dan panel mengikuti scroll tetap menggunakan batas area yang sudah ada.
- Tab detail/spesifikasi memiliki penanda aktif yang lebih jelas; baris spesifikasi dipisahkan agar mudah dipindai.
- Formulir checkout, kartu pesanan, angka, label, serta fokus input diselaraskan dengan tampilan produk.
- Banner utama, isi dan urutan bagian Home tetap menggunakan susunan sebelumnya.

## Tampilan admin

- Navigasi dibagi menjadi **Operasional** (Ringkasan, Pesanan, Stok), **Katalog** (Daftar produk, PT pemasok, Merek, Kategori), dan **Pengaturan**.
- Menu memakai ikon garis yang seragam. Halaman yang sedang dibuka ditandai warna dan garis di sisi menu.
- Identitas **Pemilik toko** atau **Admin operasional** ditampilkan pada sidebar desktop. Menu Kelola akun dan Pengaturan email tetap khusus pemilik.
- Sidebar desktop dapat digulir ketika menu tidak muat di tinggi layar. Pada layar kecil, tombol Menu admin membuka kelompok menu dengan susunan yang menyesuaikan lebar layar.
- Ringkasan katalog memakai angka yang jelas dan ikon yang konsisten.
- Teks kecil pada tabel, tombol, formulir, dan pengaturan perusahaan diperbesar. Kontrol mengikuti pilihan ukuran teks pengguna.
- Kartu stok tetap menyediakan mode Ringkas dan Kartu lengkap. Angka Dus/Pack/Satuan tetap berasal dari data yang sama; editor yang sedang aktif diberi batas yang lebih jelas.
- Kartu stok, pesanan, dan panel memakai latar serta bayangan yang seragam.

## Cakupan dan pemeriksaan

Pembaruan berisi komponen navigasi/ikon serta stylesheet. Tidak ada perubahan database, aturan transaksi, perhitungan stok, pembayaran, atau layanan email. Tidak ada dependensi baru.

Pemeriksaan otomatis mencakup navigasi dan penjagaan isian yang belum disimpan, hak akses pemilik, tema/warna/ukuran teks, detail produk, pengubahan stok, serta alur akun dan pesanan. Build sumber dan paket juga diperiksa. Pemeriksaan otomatis tidak menggantikan penilaian visual pada browser nyata.

Sesudah pemasangan, periksa Home, detail produk, admin Stok dan Pesanan pada desktop dan HP. Coba tema terang/gelap serta ukuran teks normal/besar/sangat besar. Pastikan semua menu dan tombol tetap mudah dicapai. Pengiriman email nyata masih mengikuti konfigurasi dan pengujian tersendiri pada [EMAIL-GMAIL.md](./EMAIL-GMAIL.md).
