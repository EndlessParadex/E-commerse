# Setup database dummy BAM pada PC baru

Setup ini **tidak mengambil atau mengubah database laptop** dan tidak pernah menimpa
database yang sudah ada. Hanya untuk development lokal, bukan untuk produksi.

## 1. Clone / perbarui branch dan instal dependensi

Gunakan Node.js 24+ dan buka PowerShell pada folder \`E-commerse\`.

\`\`\`powershell
git switch feature/b2b-store-sales-shared-cart
git pull --ff-only
npm ci
\`\`\`

Jika PC belum punya repository, jalankan \`git clone -b feature/b2b-store-sales-shared-cart https://github.com/EndlessParadex/E-commerse.git\` lebih dahulu.

## 2. Buat database contoh satu kali

Pastikan server BAM dalam keadaan mati.

\`\`\`powershell
npm run seed:pc
\`\`\`

Perintah ini membuat \`data/bam-pc-demo.sqlite\`, menampilkan enam akun demo beserta **satu
kata sandi acak** yang berlaku untuk seluruh akun tersebut. Simpan kata sandi yang dicetak
di terminal secara lokal (jangan commit atau bagikan).

Akun demo:

- Pemilik BAM: \`owner.pc-demo@bam.test\`
- Admin operasional: \`admin.pc-demo@bam.test\`
- Sales: \`sales.pc-demo@bam.test\`
- Pembeli toko pertama: \`toko.ice.pc-demo@bam.test\`
- Pembeli toko kedua: \`toko.nusantara.pc-demo@bam.test\`
- Pembeli pribadi: \`pribadi.pc-demo@bam.test\`

Sudah dibuat dua toko dengan jadwal tetap mingguan dan dua mingguan, satu Sales yang
ditugaskan ke keduanya, serta satu keranjang contoh per toko. Katalog demo dan stok
contoh berasal dari mode \`demo\` bawaan aplikasi.

Akun ini telah ditandai disetujui dan email terverifikasi **hanya di database demo**.
Jangan menganggapnya sebagai verifikasi email sungguhan.

## 3. Jalankan backend memakai database dummy

\`\`\`powershell
$env:BAM_DB_PATH = "data/bam-pc-demo.sqlite"
npm run dev:full
\`\`\`

Buka \`http://localhost:5173\` lalu masuk memakai salah satu akun demo.

Pastikan \`BAM_DB_PATH\` tetap menunjuk ke database demo setiap kali menjalankan server.
Bila ingin otomatis, tambah \`BAM_DB_PATH=data/bam-pc-demo.sqlite\` ke file \`.env\`
lokal (file ini diabaikan oleh Git).

## 4. Jika database dummy sudah ada

Perintah \`npm run seed:pc\` sengaja **menolak membuat ulang** file yang telah ada.
Gunakan saja databasenya dengan perintah pada langkah 3.

Jika ingin memulai ulang dari nol, tutup server, backup \`bam-pc-demo.sqlite\`
beserta file \`-wal\`/\`-shm\` jika masih ada, lalu pindahkan semua file tersebut
ke folder arsip sebelum menjalankan seeding ulang. Jangan menghapus database laptop
atau \`data/bam.sqlite\` yang lain.

**Catatan:** Nomor HP toko dalam data contoh hanyalah kontak fiktif. Akun demo
masuk dengan email, bukan nomor HP, sampai nomor login secara eksplisit dikonfigurasi.
