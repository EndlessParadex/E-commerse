# Memasang BAM di layar HP (PWA)

Website BAM bisa dipasang ke layar utama HP dan terbuka layar penuh seperti aplikasi, tanpa Play
Store. Isinya tetap website yang sama, jadi setiap pembaruan langsung sampai ke semua pembeli.

Syaratnya website dibuka lewat alamat **HTTPS** (domain sendiri). Lewat `http://` atau alamat IP,
tombol pasang tidak muncul.

## Cara memasang

| Perangkat        | Langkah                                                                              |
| ---------------- | ------------------------------------------------------------------------------------ |
| Android (Chrome) | Buka website → titik tiga → **Pasang aplikasi** (atau **Tambahkan ke layar utama**). |
| iPhone (Safari)  | Buka website → tombol Bagikan → **Tambahkan ke Layar Utama**.                        |
| Komputer         | Chrome atau Edge → ikon pasang di ujung kanan bilah alamat.                          |

Pembeli yang sudah memasang pintasan lama (sebelum fitur ini ada) perlu menghapusnya dan
memasang ulang agar mendapat tampilan layar penuh.

## Nama dan ikon

- Nama di bawah ikon diambil dari **Nama toko** di Admin → Perusahaan; nama lengkap aplikasi
  dari **Nama perusahaan**. Server menulis `/manifest.webmanifest` dari data itu setiap diminta.
- HP menyimpan nama saat aplikasi dipasang. Setelah nama perusahaan diubah, Android
  memperbaruinya sendiri dalam beberapa hari; di iPhone aplikasi perlu dipasang ulang.
- Ikon ada di `public/` (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`,
  `apple-touch-icon.png`). Ganti keempat berkas itu dengan ukuran yang sama untuk memakai logo
  lain, lalu `npm run build`. Pada ikon _maskable_, logo harus berada di 80% bagian tengah karena
  Android memotong tepinya.

## Batasan

- Tidak ada mode luring: tanpa internet halaman tidak terbuka. Ini disengaja, karena harga, stok
  dan keranjang harus selalu dari server.
- Tidak ada notifikasi dorong. Info pesanan tetap lewat WhatsApp dan email.
- Tidak tampil di Play Store atau App Store. Pembeli memasangnya dari tautan website.
