# Audit kesiapan fitur Sales BAM — 28 Oktober 2026

Branch acuan: `feature/b2b-store-sales-shared-cart`.

## Tujuan dan batas audit

Dokumen ini adalah **gerbang sebelum mengembangkan fitur baru**, bukan pernyataan
bahwa implementasi produksi telah diaudit secara menyeluruh. Cakupannya ialah
keterkaitan akun Sales–Toko–Admin, keranjang bersama, nomor kontak toko,
riwayat order, serta kesiapan operasional untuk:

1. Rekap draft keranjang toko melalui tautan WhatsApp.
2. Produk yang sering dipesan toko.
3. Input cepat Sales di ponsel.
4. Rencana kunjungan harian Sales.

Fitur-fitur tersebut **belum dibuat oleh audit ini**. Tidak ada akses ke
server produksi, data/nomor HP pelanggan nyata, perangkat Sales sebenarnya,
atau sistem WhatsApp eksternal.

## Hasil pemeriksaan kode dan tes

| Area             | Temuan kode                                                                                                                            | Bukti / status                                                                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pembatasan toko  | `b2bStores.page()` dan `sharedCarts.access()` membatasi toko ke member atau Sales yang ditugaskan. Admin memiliki akses operasional.   | Ditambah tes `server/salesReadiness.test.js` untuk pencarian, toko lain, pencabutan Sales dan penolakan akses ulang.                               |
| Nomor kontak     | `b2bStores.create/update()` menormalisasi dan memvalidasi nomor toko Indonesia.                                                        | Tes kesiapan memeriksa nomor toko yang dapat diakses Sales. Belum ada persetujuan/opt-out WhatsApp toko yang diuji.                                |
| Draft vs pesanan | Mutasi keranjang hanya mencatat item dan audit; tidak otomatis membuat order atau mencadangkan stok.                                   | Tes kesiapan memastikan draft bukan pesanan. Rekap WA harus diberi label **DRAFT — belum final / bukan bukti pemesanan resmi**.                    |
| Konkurensi       | Revisi dan `requestId` dipakai untuk konflik serta retry idempoten.                                                                    | Tes baru memeriksa konflik buyer/Sales serta retry setelah hak Sales dicabut. Tes yang sudah ada meliputi dua koneksi/worker dan gangguan respons. |
| Finalisasi       | `b2bFinalization.admin()` mewajibkan Admin, disertai review/token, validasi stok, dan satu order per periode.                          | Tes baru mencakup penguncian, penolakan edit Sales dan finalisasi/retry satu kali.                                                                 |
| Pembayaran       | Pembeli/Sales memilih COD atau transfer; Admin memeriksa, rekening dikonfigurasi Pemilik. Bukti transfer tidak otomatis berarti lunas. | Sudah ada `server/b2bFinalization.test.js`; perlu uji penerimaan dana nyata secara manual pada pilot.                                              |
| Penjadwalan      | Jadwal pengiriman toko dan kalender profil sudah ada.                                                                                  | Tidak boleh dianggap sebagai jadwal **kunjungan Sales**. Today's Call membutuhkan jadwal/otorisasi baru tersendiri.                                |
| Cadangan data    | Tersedia backup, verifikasi, dan restore ke database terpisah.                                                                         | Tes otomatis memakai database contoh. Backup dan restore **database instalasi nyata** masih wajib dilakukan operator.                              |
| Pengujian        | Workflow CI memeriksa build, lint, tes, audit dependensi, dan Prettier.                                                                | Semua harus hijau pada commit kandidat sebelum fitur dimulai.                                                                                      |
| Mobile           | Sudah terdapat aturan responsif dan tes komponen.                                                                                      | Belum terbukti nyaman untuk Sales di lapangan; masih perlu pengujian browser/perangkat dan koneksi buruk.                                          |
| Branch           | Branch pengembangan belum dilindungi aturan branch protection.                                                                         | Aktifkan required checks dan review pada pengaturan GitHub; perubahan ini tidak dilakukan otomatis.                                                |

## Keputusan desain yang harus dikunci sebelum menambah fitur

- **Rekap WhatsApp:** tentukan siapa yang boleh mengirim (Sales yang
  ditugaskan / pembeli toko), sumber nomor penerima dan persetujuan kontak,
  template, apakah nominal harga boleh tampil, dan cara menangani keranjang
  yang berubah setelah rekap dibuat. Draft tidak boleh disebut pesanan resmi.
  `wa.me` hanya membuka pesan untuk ditinjau; tidak membuktikan pesan dikirim.
- **Produk langganan:** hitung dari **pesanan toko yang sudah difinalisasi**,
  tidak dari item draft, dan hanya berdasarkan toko yang dapat diakses Sales.
  Jangan menganggap pesanan yang batal sebagai penjualan selesai; putuskan
  apakah metrik berarti sering **dipesan** atau benar-benar **terjual**.
- **Mode lapangan:** gunakan endpoint keranjang bersama yang sudah ada, bukan
  membuat keranjang kedua. Sediakan status simpan, retry idempoten, tampilan
  konflik dan pembaruan harga/stok, serta validasi batas 99 kemasan/SKU.
- **Today's Call:** rencanakan kunjungan Sales terpisah dari hari pengiriman.
  Konfirmasi penanggung jawab jadwal, perubahan penugasan, status kunjungan
  dan kebijakan data lokasi; **tidak perlu GPS pelacakan otomatis**.

## Checklist penerimaan sebelum implementasi fitur baru

- [x] Pemeriksaan kode hak akses dan pemisahan draft/final.
- [x] Tambahan tes regresi lintas-peran dan kondisi konflik.
- [ ] GitHub Actions kandidat terbaru hijau (periksa commit ini).
- [ ] Uji nyata Sales → Toko → Admin dengan dua akun/perangkat, termasuk
      putus sambung internet dan perubahan keranjang bersamaan.
- [ ] Uji antarmuka ponsel pada pencarian toko, varian, kemasan, simpan,
      notifikasi konflik dan modal.
- [ ] Validasi kontak toko/izin pengiriman WA serta kelengkapan pesanan riil
      untuk fitur produk langganan, tanpa mengunggah data pribadi ke Git.
- [ ] Backup dan restore database instalasi nyata dibuktikan di lokasi
      terpisah; verifikasi stok dan pesanan setelah restore.
- [ ] Konfigurasi HTTPS, secrets, rekening, email/WA dan branch protection
      diperiksa oleh pengelola deployment.
- [ ] Keputusan draft WA, penghitungan frequent items dan Today's Call
      disetujui sebelum membuat migrasi data atau UI baru.

## Skenario pilot yang direkomendasikan

1. Pemilik menyiapkan akun uji Sales, Toko A, Toko B, jadwal dan stok.
2. Sales hanya melihat Toko A; Toko B menolak akses baca/tulis.
3. Sales menambah 2 kemasan, pembeli Toko A mengubah 3 kemasan. Sales
   mendapat konflik jika menyimpan dari revisi lama dan dapat memuat ulang.
4. Admin mengunci dan memeriksa, Sales/Toko tidak bisa mengubah saat terkunci.
5. Admin finalisasi tepat sekali; draft tidak boleh menjadi order kedua,
   dan transfer tetap menunggu konfirmasi pembayaran.
6. Pemilik mencabut akses Sales ke Toko A; daftar toko, keranjang, riwayat
   dan fungsi yang kelak memuat kontak WA harus ikut menolak akses.
7. Putus koneksi, muat ulang, lakukan restore latihan terpisah, dan
   bandingkan order/stok terhadap data sebelum gangguan.

**Kriteria selesai:** CI hijau, seluruh pengujian manual pilot lulus,
keputusan komunikasi/privasi disepakati, backup nyata telah diuji, lalu
baru buat branch implementasi fitur **Kirim Rekap WhatsApp Draft**.
