# WhatsApp pesanan dan faktur otomatis

Server mengirim faktur PDF dan info pesanan secara otomatis. Email berjalan begitu layanan email aktif. WhatsApp baru berjalan setelah akun Meta dan template di bawah disiapkan.

## Kapan dikirim

| Peristiwa                                                                | Pembeli menerima                               |
| ------------------------------------------------------------------------ | ---------------------------------------------- |
| Pesanan dibuat dengan total final (COD harga tetap, pesanan toko B2B)    | Faktur PDF: email dan WhatsApp                 |
| Pembeli menyetujui total akhir (pesanan yang diperiksa toko)             | Faktur PDF: email dan WhatsApp                 |
| Transfer dikonfirmasi Admin                                              | Faktur PDF berstatus LUNAS: email dan WhatsApp |
| Total siap disetujui, pengingat batas waktu, bukti ditolak               | Info pesanan: WhatsApp                         |
| Dikirim, selesai, dibatalkan, batas pembayaran atau persetujuan berakhir | Info pesanan: WhatsApp                         |

Pesanan yang totalnya belum final tidak mendapat faktur. Pesanan toko B2B dikirim ke akun anggota toko, bukan Sales. Email status pesanan yang sudah ada tetap dikirim terpisah. Dokumen ini adalah rincian pesanan, bukan faktur pajak.

## Syarat penerima WhatsApp

Pembeli harus memiliki nomor HP terkonfirmasi dan mencentang **Kirim faktur dan info pesanan ke WhatsApp nomor ini** di halaman akun. Persetujuan dapat dicabut kapan saja dan terhapus saat nomor diganti. Konfirmasi nomor sendiri tidak dianggap persetujuan menerima pesan.

## Menyambungkan WhatsApp

1. Siapkan WhatsApp Business Platform di Meta: akun bisnis, nomor pengirim, dan metode pembayaran.
2. Buat template kategori **Authentication** untuk kode verifikasi nomor HP, dalam bahasa Indonesia dengan tombol salin kode, misalnya `bam_otp`. Lalu buat dua template kategori **Utility** dalam bahasa Indonesia dan tunggu persetujuan Meta. Meta tidak mengizinkan variabel di awal atau akhir isi template.

   **`order_invoice`** dengan header **Document**:

   ```text
   Halo {{1}}, faktur pesanan {{2}} dengan total {{3}} terlampir. Status: {{4}}. Terima kasih.
   ```

   **`order_update`** tanpa header:

   ```text
   Halo {{1}}, ada kabar terbaru untuk pesanan Anda dengan nomor {{2}} di BAM. Keterangan: {{3}} Silakan buka menu Pesanan di website BAM untuk melihat detail lengkapnya. Terima kasih.
   ```

   Meta menolak isi yang terlalu pendek dibanding jumlah variabelnya, jadi teks tetapnya dibuat lebih panjang. Urutan variabel tetap: nama, nomor pesanan, keterangan status.

3. Isi `.env` server. Jangan menaruh token di GitHub atau chat.

   | Variabel                         | Isi                                               |
   | -------------------------------- | ------------------------------------------------- |
   | `BAM_WHATSAPP_TOKEN`             | Token akses pengirim dari Meta                    |
   | `BAM_WHATSAPP_PHONE_ID`          | Phone Number ID pengirim                          |
   | `BAM_WHATSAPP_API_VERSION`       | Versi Graph API, format `vNN.N`                   |
   | `BAM_WHATSAPP_OTP_TEMPLATE`      | Nama template kode verifikasi yang disetujui      |
   | `BAM_WHATSAPP_OTP_LANGUAGE`      | Bahasa template kode, misalnya `id` (bawaan `id`) |
   | `BAM_WHATSAPP_INVOICE_TEMPLATE`  | Nama template faktur yang disetujui               |
   | `BAM_WHATSAPP_ORDER_TEMPLATE`    | Nama template info pesanan yang disetujui         |
   | `BAM_WHATSAPP_TEMPLATE_LANGUAGE` | Bahasa template, misalnya `id` (bawaan `id`)      |

4. Jalankan ulang server. Uji dengan akun dan nomor milik sendiri sebelum dipakai pembeli.

Template dapat diaktifkan satu per satu: template yang kosong berarti jenis pesan itu tidak dikirim. Pesanan yang dibuat saat WhatsApp belum aktif tidak dikirim mundur ke WhatsApp.

## Memantau pengiriman

Halaman **Kesiapan toko** pada Admin menampilkan pengiriman yang gagal dan tombol kirim ulang. Pengiriman dicoba ulang otomatis dengan jeda bertahap, sampai 10 kali, dan dihentikan setelah 7 hari. Jika pengiriman tidak dapat dipastikan, percobaan ulang dapat menghasilkan pesan ganda. Pengujian otomatis memakai pengirim palsu, jadi pengiriman sungguhan baru terbukti setelah pesan benar-benar diterima.
