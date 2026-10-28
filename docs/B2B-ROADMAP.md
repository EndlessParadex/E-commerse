# BAM B2B — status fitur, 27 Oktober 2026

Branch: `feature/b2b-store-sales-shared-cart`. Dokumen ini menggantikan status parsial lama. [Arsip keputusan sebelumnya](archive/B2B-ROADMAP-sebelum-2026-10-27.md) merupakan riwayat, bukan daftar pekerjaan aktif.

## Tersedia pada kode

| Bagian                | Perilaku                                                                                                    | Panduan                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Akun dan peran        | Login email/nomor HP dengan kata sandi; persetujuan, verifikasi, reset dan pembatasan server                | [Akun](AKUN-DAN-NOMOR-HP.md)        |
| Dua keranjang         | Pribadi per akun/perangkat; bersama per toko/periode di server, tanpa penggabungan otomatis                 | [Alur peran](ALUR-PERAN-B2B.md)     |
| Toko dan Sales        | Pemilik menghubungkan pembeli, menunjuk/mengganti/mencabut Sales dan menetapkan jadwal tetap                | [Keranjang](KERANJANG-BERSAMA.md)   |
| Finalisasi            | Admin mengunci, memeriksa, memfinalisasi; stok atomik, audit, idempotensi, COD/transfer manual              | [Finalisasi](FINALISASI-B2B.md)     |
| Kemasan               | Satuan, Pack, Box, Dus, Renceng; konversi per varian dan stok satuan dasar                                  | [Operasional](FITUR-OPERASIONAL.md) |
| Dokumen B2B           | Nama toko/Sales, barang dan kuantitas; tanpa harga/alamat/tanda tangan; A4 dan dot matrix                   | [Cetak](FITUR-OPERASIONAL.md)       |
| Kalender profil       | Jadwal toko yang dapat diakses dan wilayah pribadi, mingguan/dua mingguan                                   | [Kalender](FITUR-OPERASIONAL.md)    |
| Wilayah               | Pemilik mengelola wilayah/hubungan akun; tanggal pesanan pribadi direkam saat dibuat                        | [Wilayah](FITUR-OPERASIONAL.md)     |
| Email/WhatsApp        | Adapter, verifikasi, pembatasan percobaan, status dan penanganan kegagalan; layanan nyata perlu konfigurasi | [Email](PEMILIK-DAN-EMAIL.md)       |
| Tampilan dan pemuatan | Tema admin bersama, responsif; halaman akun/autentikasi/favorit/pemulihan dimuat saat dibuka                | [Admin](ADMIN-UI-CONSISTENCY.md)    |
| Backup/pemulihan      | Snapshot SQLite, checksum, pemeriksaan integritas, restore ke lokasi baru                                   | [Backup](BACKUP-DAN-PEMULIHAN.md)   |

## Batas yang tetap berlaku

- Jadwal adalah rencana rutin, bukan bukti pengiriman. Tidak ada optimasi rute atau pengaturan sopir otomatis.
- Jadwal tetap toko yang sudah ditetapkan mengikuti penguncian yang sudah berlaku; pengaturan wilayah tidak mengubahnya.
- Keranjang pribadi belum disinkronkan lintas perangkat. Pesanan dan keranjang toko disimpan di server.
- Transfer memerlukan pemeriksaan dana oleh Admin. Bukti unggah tidak otomatis melunasi pesanan. Gateway VA/e-wallet dan kurir otomatis tidak termasuk keputusan alur saat ini.
- Cut-off B2B dapat dikonfigurasi di server; tidak ada tenggat operasional yang dibuat tanpa keputusan BAM.
- Konfigurasi email/WhatsApp tidak membuktikan pesan diterima. Cetak browser tidak membuktikan kesesuaian printer fisik.

## Gerbang sebelum fitur Sales baru

Audit kode, skenario pengujian lintas-peran, dan keputusan yang harus
dikonfirmasi ada pada [audit kesiapan fitur Sales](SALES-READINESS-AUDIT.md).
Jangan menambahkan rekap WA, frequent items, mode lapangan atau Today's Call
sebelum syarat manual dan privasi terkait dipenuhi.

## Gerbang penggunaan operasional

1. Backup instalasi sebenarnya dan buktikan restore ke lokasi terpisah.
2. Pasang pembaruan; jalankan `npm test`, `npm run lint`, `npm run build` dan pemeriksaan format berkas yang berubah.
3. Isi wilayah, hubungan akun, jadwal, rekening dan kebijakan cut-off yang benar. Tidak ada wilayah operasional contoh yang otomatis dimasukkan.
4. Uji email/WhatsApp milik penguji melalui layanan BAM. Jangan menaruh token atau kata sandi di GitHub/chat.
5. Uji printer A4 dan dot matrix sebenarnya: ukuran form, skala dan pemotongan halaman.
6. Lakukan pilot pesanan kecil dengan Pemilik/Admin/pembeli/Sales, dua perangkat dan koneksi terputus sebelum pemakaian rutin.

Hasil uji kode dan browser lokal harus dilaporkan terpisah dari layanan eksternal, printer dan produksi.
