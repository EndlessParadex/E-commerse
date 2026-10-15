# BAM — Backend tahap 1.1: katalog, hapus, warna, dan akses admin

Produk, SKU, harga, foto, warna kartu, PT pemasok, merek, kategori, dan subkategori disimpan ke SQLite. Toko membaca katalog yang sama melalui API. Halaman admin memerlukan akun dengan peran admin; server juga menolak penyimpanan dari pengunjung dan akun biasa.

## Pembaruan 1.1

- **Hapus produk** tersedia di daftar produk, untuk desktop dan HP. Konfirmasi menyebutkan nama produk serta jumlah SKU; seluruh ukuran produk dihapus bersama. Riwayat pesanan yang sudah dibuat tetap memakai data historisnya.
- **Hapus PT pemasok/merek/kategori** tersedia pada daftar masing-masing. Data yang masih dipakai produk tidak dapat dihapus. PT yang masih terhubung dengan merek juga belum dapat dihapus: ubah hubungan PT pada merek atau hapus mereknya dahulu. Alasan ditampilkan di bawah tombol.
- **Warna kartu** memiliki 10 pilihan. Pada **Edit PT pemasok**, pilih **Warna kartu**, lalu simpan; kartu PT di admin dan toko berubah. Pada **Edit produk**, pilih **Warna kartu** pada informasi produk; warna latar gambar berlaku untuk semua ukurannya, termasuk kartu toko dan galeri detail. Pratinjau berubah saat warna dipilih. Warna ini mengubah latar kartu, bukan isi foto yang diunggah.
- Jika penghapusan gagal atau dibatalkan, data tetap tersedia. Produk yang sudah dihapus tidak muncul kembali setelah halaman dimuat ulang, termasuk produk contoh bawaan.
- Pembaruan ini dapat memakai database tahap 1 yang sudah ada. Jangan menghapus folder `data` atau membuat database baru untuk memperbarui kode. Paket baru juga memuat fitur dan perbaikan frontend sebelumnya.

Tahap ini untuk pengembangan lokal. Keranjang, favorit, checkout, dan riwayat pesanan masih menggunakan mekanisme simulasi sebelumnya. Stok, pesanan di database, pembayaran, dan pengiriman nyata belum dibuat.

## Memasang ke proyek yang sudah ada

1. Cadangkan folder proyek terlebih dahulu, termasuk folder `data` jika sudah ada. Hentikan server yang berjalan.
2. Ekstrak ZIP. Salin folder `src` dan `server`, serta `package.json`, `package-lock.json`, `vite.config.js`, dan `.gitignore` ke proyek; timpa file dengan nama sama. ZIP juga menyediakan proyek lengkap untuk dijalankan terpisah.
3. Jalankan semua perintah berikut dari folder yang berisi `package.json`. Gunakan Node.js 24 atau lebih baru.

```powershell
npm ci
```

Jangan hapus atau timpa folder `data`. Database dibuat otomatis pada `data/bam.sqlite`. Database lama untuk akun tetap dapat digunakan; kolom peran ditambahkan jika belum ada. Database baru diawali katalog contoh: 8 produk utama dan 25 SKU.

## Membuat akun admin

Gunakan email, nama, alamat, dan kata sandi pilihan Anda. Kata sandi minimal 8 dan maksimal 128 karakter. Pendaftaran di website selalu menghasilkan akun biasa.

Di PowerShell, ambil kata sandi tanpa menampilkannya di layar:

```powershell
$adminSecret = Read-Host "Kata sandi admin" -AsSecureString
$adminPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminSecret)
try {
  $env:BAM_ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($adminPointer)
  npm run create-admin -- "admin@contoh.com" "Admin BAM" "Alamat lengkap admin BAM"
} finally {
  Remove-Item Env:BAM_ADMIN_PASSWORD -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($adminPointer)
  $adminSecret.Dispose()
}
```

Ganti contoh email/nama/alamat sebelum menjalankan. Jika email sudah terdaftar, perintah ini menjadikan akun tersebut admin dan mengganti kata sandi, nama, serta alamatnya. Gunakan hanya untuk akun yang memang ingin dijadikan admin.

## Menjalankan

```powershell
npm run dev:full
```

Buka alamat lokal yang ditampilkan oleh Vite, lalu masuk menggunakan akun admin. Setelah masuk, halaman admin terbuka; bisa juga dibuka dari menu akun **Ruang admin** atau `#/admin`.

API berjalan di `127.0.0.1:3001`. Jalankan kedua layanan melalui `dev:full`; menjalankan `dev` saja tidak menyediakan API. Jika API belum berjalan, halaman menampilkan pesan gagal memuat katalog dan tombol **Coba lagi**.

## Membawa data pratinjau sebelumnya

Pada browser dan alamat lokal yang sama dengan sebelumnya, buka **Ringkasan** setelah masuk sebagai admin. Jika data pratinjau lama masih ada dan database belum pernah menerima perubahan katalog, akan muncul **Impor katalog dari browser**.

Impor membawa keseluruhan katalog lokal, termasuk PT/merek/kategori, produk uji, ukuran, harga, dan foto. Data di browser tetap disimpan sebagai salinan. Jika database sudah diubah, impor ini tidak tersedia agar katalog server yang sudah digunakan tidak tertimpa. Data lokal rusak juga tidak diimpor otomatis.

Gunakan impor sebelum mulai mengedit katalog server. Browser lain membaca katalog database setelah memuat ulang halaman. Pembaruan langsung tanpa muat ulang belum tersedia.

## Penyimpanan dan pengujian

- Penyimpanan katalog dilakukan sebagai satu transaksi. Isian yang tidak valid atau kegagalan database tidak menghasilkan perubahan sebagian.
- SKU unik tanpa membedakan huruf besar/kecil. SKU tetap tidak dapat diganti atau dihapus satu per satu saat mengedit produk yang sudah tersimpan. Gunakan **Hapus produk** untuk menghapus seluruh ukurannya. Tautan produk yang sudah dihapus menampilkan halaman produk tidak ditemukan.
- Foto JPG/PNG/WebP maksimal 1 MB per foto. Permintaan penyimpanan seluruh katalog dibatasi 20 MB pada tahap ini; jika total foto mendekati batas tersebut, gunakan foto yang lebih kecil. Penyimpanan foto terpisah akan menjadi pengembangan berikutnya.
- Jika ada perubahan katalog dari sesi admin lain, penyimpanan ditolak. Form tetap terbuka: salin isian yang diperlukan, muat ulang halaman, lalu lakukan perubahan pada katalog terbaru.
- Jika sesi berakhir atau koneksi gagal, form tetap berisi perubahan dan menampilkan alasan kegagalan.
- Database dan kata sandi tidak dimasukkan ke ZIP. Akun admin dibuat sendiri pada komputer yang menjalankan server.

```powershell
node --test
npm run lint
npm run build
```

Pengujian mencakup peran admin, registrasi, login/logout, validasi SKU/harga/relasi, konflik antar sesi, pembatalan transaksi, foto setelah membuka ulang database, impor data lokal, serta interaksi form melalui simulasi DOM. Tampilan dan akses melalui browser/perangkat nyata perlu dicoba setelah dipasang.

## Konfigurasi opsional

`BAM_DB_PATH` dapat menunjuk database lain; gunakan nilai yang sama ketika membuat admin dan menjalankan API. `PORT` mengatur port API; bila diubah, sesuaikan target proxy pada `vite.config.js`.

Untuk hosting nanti, diperlukan penyajian frontend dan API pada satu origin, HTTPS, `NODE_ENV=production` untuk cookie Secure, `BAM_APP_ORIGIN` berisi origin website tanpa garis miring akhir, serta lokasi database yang persisten. ZIP ini belum menyediakan pemasangan hosting. Jangan gunakan server pengembangan Vite sebagai layanan produksi.

Untuk mencadangkan SQLite dengan mudah, hentikan API lalu salin seluruh folder `data`. Jangan hanya menyalin file utama saat server aktif, karena SQLite juga dapat menggunakan file `-wal` dan `-shm`.

Tahap berikutnya: stok per SKU, penyimpanan pesanan milik akun, panel pesanan admin, dan perhitungan checkout di server.
