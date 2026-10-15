# Instalasi perusahaan — v23

Aplikasi dapat dipasang sebagai toko terpisah untuk setiap perusahaan. Masing-masing instalasi menggunakan database sendiri. Data produk, pemasok, kategori, merek, akun, dan identitas perusahaan tidak disalin dari database BAM.

## Memperbarui BAM yang sudah digunakan

Gunakan paket **BAM-mode-perusahaan-v23.zip**. Hentikan server dan frontend dengan Ctrl+C, ekstrak paket, lalu salin isi folder `BAM-mode-perusahaan-v23` ke proyek BAM yang sama dan pilih Replace. Jalankan kembali:

```powershell
npm run dev:full
```

Database BAM tetap digunakan. Pembaruan ini tidak mengosongkan katalog, akun, maupun riwayat browser BAM. Database lama dikenali sebagai instalasi BAM/demo; mode tidak dapat diubah menjadi perusahaan kosong melalui pengaturan atau pergantian variabel lingkungan.

Masuk sebagai admin, buka **Pengaturan perusahaan** pada menu admin. Isi nama toko, nama perusahaan, deskripsi, alamat, email, nomor telepon, dan logo. Logo JPG/PNG/WebP maksimal 1 MB. Simpan untuk menerapkan nama dan logo pada navbar, banner, footer, serta informasi toko. Logo tampil utuh dengan penyesuaian ukuran. Kontak yang dibiarkan kosong tidak ditampilkan.

## Memberikan aplikasi kosong kepada perusahaan lain

Gunakan paket lengkap **Aplikasi-perusahaan-kosong-v23.zip**, kemudian ekstrak ke folder baru milik perusahaan tersebut. Paket ini tidak membawa database, akun, kata sandi, foto unggahan, keranjang, ataupun pesanan BAM. Gambar dan data contoh dalam kode pengujian/demo tidak dimasukkan ke katalog perusahaan.

Perintah utama pada paket lengkap ini sudah memilih mode perusahaan. Paket pembaruan BAM mempertahankan perintah utama sebelumnya; gunakan perintah dengan akhiran `:company` ketika menyiapkan perusahaan baru dari source BAM.

### 1. Siapkan instalasi baru

Buka terminal pada folder yang berisi `package.json`. Gunakan Node.js dan npm yang sudah terpasang pada komputer Anda. Instal dependensi:

```powershell
npm ci --include=dev
```

Database perusahaan baru menggunakan `data/company.sqlite`. Setiap perusahaan harus memakai folder instalasi dan database sendiri. Database BAM jangan disalin ke folder perusahaan baru. Bila ingin menentukan lokasi berbeda, atur pada **setiap terminal** untuk server dan pembuatan admin:

```powershell
$env:BAM_DB_PATH = 'D:\Aplikasi\Perusahaan-A\data\company.sqlite'
```

Gunakan lokasi yang belum berisi database perusahaan lain. Peluncur perusahaan menolak database BAM/demo dan tidak menghapusnya. Database perusahaan yang sudah dibuat tetap digunakan setelah restart; mode disimpan dalam database sehingga katalog tidak diisi contoh secara otomatis.

### 2. Buat akun admin perusahaan

Perintah ini menggunakan email, nama admin, dan alamat yang Anda tentukan. Ubah tiga contoh argumen di bawah sebelum menjalankan. Kata sandi diminta tanpa ditampilkan pada terminal.

```powershell
$companyPassword = Read-Host 'Kata sandi admin baru (minimal 8 karakter)' -AsSecureString
$companyCredential = [System.Net.NetworkCredential]::new('', $companyPassword)
$env:BAM_ADMIN_PASSWORD = $companyCredential.Password
try {
  npm run create-admin:company -- 'admin@perusahaan.id' 'Admin Perusahaan' 'Alamat lengkap admin perusahaan'
} finally {
  Remove-Item Env:BAM_ADMIN_PASSWORD -ErrorAction SilentlyContinue
  $companyCredential = $null
  $companyPassword = $null
}
```

Registrasi pada website selalu membuat pelanggan biasa. Admin dibuat melalui perintah di server. Menjalankan pembuatan admin lagi dengan email yang sama memperbarui nama, alamat, dan kata sandi admin tersebut.

### 3. Jalankan aplikasi

```powershell
npm run dev:company
```

Pada **paket lengkap perusahaan**, `npm run dev:full` juga menjalankan mode perusahaan. Buka alamat frontend yang ditampilkan terminal. Masuk dengan admin yang baru dibuat.

### 4. Isi data perusahaan

Urutannya tersedia pada Ringkasan admin:

1. **Pengaturan perusahaan**: nama, logo, deskripsi, dan kontak.
2. **PT pemasok**: pemasok milik perusahaan.
3. **Kategori**: kategori dan subkategori.
4. **Merek**: merek yang dihubungkan ke pemasok.
5. **Daftar produk**: produk, foto, ukuran, Satuan/Pack/Dus, dan harga.

Katalog awal, pemasok, kategori, dan merek kosong. Stok awal adalah **0** per ukuran, sehingga stok harus diisi sebelum menerima pesanan. Isi produk pertama melalui ruang admin; data katalog tersimpan pada database perusahaan.

## Penyimpanan dan batas tahap ini

**Identitas perusahaan, logo, akun, alamat akun, katalog, harga, foto produk, pesanan, dan stok sudah disimpan ke database oleh backend Node.js.** Lokasinya mengikuti server tempat backend dijalankan. Saat ini aplikasi tetap dapat dijalankan pada komputer untuk pengembangan; memindahkannya ke server perusahaan perlu pengaturan deployment berikutnya.

**Keranjang, favorit, notifikasi, dan preferensi tampilan masih pada browser.** Pesanan terhubung ke akun dan dapat dibuka dari perangkat lain setelah masuk ke backend/database yang sama. Nomor permintaan checkout disimpan pada tab untuk mencegah pengulangan membuat pesanan ganda. Instalasi perusahaan mempunyai ruang penyimpanan browser sendiri; notifikasi dipisahkan menurut akun.

Pembayaran online, WhatsApp, dan kurir belum terhubung otomatis. Tarif pengiriman masih berupa contoh yang ditampilkan pada checkout. Pelanggan tidak bisa menandai pesanan lunas; admin mencatat pembayaran setelah diperiksa dengan referensi yang sesuai. Panduan penggunaan tersedia di **BACKEND-TAHAP-2.md**.

Sistem ini menggunakan satu instalasi/database per perusahaan. Untuk pemakaian bersama, aplikasi perlu dipasang pada server perusahaan. Paket ini belum melakukan deployment ke server luar dan belum menjadi satu marketplace dengan banyak penjual.

## Pemeriksaan versi ini

169 tes, lint, dan build lulus. Pemeriksaan mencakup perusahaan kosong, produk/stok pertama, pelestarian database BAM, pesanan akun, transaksi stok, pembatalan/kedaluwarsa, pengulangan checkout, akses admin, foto/harga histori, serta alur antarmuka. Detail tersedia di BACKEND-TAHAP-2.md.
