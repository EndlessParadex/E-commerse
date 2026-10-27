# BAM — Checklist UI Konsistensi Admin Panel
Branch: `feature/b2b-store-sales-shared-cart`

Dokumen ini adalah **Opsi A (audit per file)** setelah implementasi **Opsi B (master CSS)**.
Fokus: hierarki informasi, spacing, keseragaman panel dan form, serta tampilan tabel.
Tidak mengubah hak akses, database, atau aturan transaksi.

## B. Master CSS — perubahan bersama

| File | Implementasi |
|---|---|
| `src/pages/AdminUnifiedUI.css` | Standar jarak (8/12/16/20px), page header dan badge, jarak guide ke konten, panel heading berikon, tinggi kartu metrik, responsivitas 950px/650px, toolbar katalog, alignment tabel dan tombol aksi |
| `src/pages/AdminPage.jsx` | Sudah mengimpor `AdminUnifiedUI.css` sesudah CSS utama sehingga master style berlaku pada seluruh panel Admin |

Kaidah:
- Guide bukan tab/wizard wajib; seluruh menu tetap bebas dibuka.
- Konten utama harus dimulai di bawah guide dengan jarak yang konsisten.
- Judul ikon, subjudul dan aksi harus sejajar dengan separator bawah.
- Jangan mengubah struktur HTML tindakan sensitif untuk sekadar styling.
- Tetap pertahankan height kontrol yang dapat disentuh, text wrapping, dan responsivitas.

## A. Audit dan penyesuaian per halaman

| Halaman/file | Perubahan yang diterapkan | Pemeriksaan visual sesudah pull |
|---|---|---|
| `AdminPage.jsx` | Eyebrow dan penjelasan mengikuti kategori menu (Katalog, Operasional, B2B, Pengaturan), badge pengaturan tidak salah menyebut Katalog. | Header, badge dan title tidak melompat antar menu |
| Dashboard (`AdminPage.jsx` + CSS bersama) | Guide dipisahkan dari hero, statistik memiliki tinggi, padding dan gap seragam. | Hero tidak menempel pada guide; empat kartu sama tinggi |
| Pesanan (`AdminOrdersPage.jsx`) | Dua banner informasi rutin dikonsolidasikan: jumlah hasil kecil setelah filter, penjelasan teknis pada detail buka-tutup. | Tidak ada dua banner biru berulang, pencarian/status tetap berfungsi |
| Stok (`AdminStockPage.jsx` + CSS bersama) | Header icon, guide, panel spacing dan kontrol mengikuti standar Admin. | Filter dan dialog edit stok tetap nyaman di desktop/mobile |
| Daftar produk (`AdminPage.jsx` + CSS bersama) | Toolbar/filter, penghitung hasil, padding tabel, alignment vertikal dan jarak aksi disejajarkan. | Badge SKU/tombol rata; teks SKU dan aksi tidak bertabrakan |
| PT pemasok, Merek, Kategori (`AdminMasterPage.jsx` + CSS bersama) | Header icon, guide, dan ukuran panel mengikuti standar. | Form tambah/edit dan foto/logo tetap benar |
| Kelola akun (`AdminAccountsPage.jsx` + CSS bersama) | Header dan guide seragam tanpa mengubah konfirmasi dan akses. | Status, filter, dialog dan izin Owner tetap benar |
| Persetujuan (`AdminApprovalsPage.jsx` + `AdminPage.jsx`) | Header dan badge kategori Pengaturan & Akses. | Tombol setuju/tolak, pagination, dan pesan validasi tidak berubah |
| Perusahaan (`AdminCompanyPage.jsx` + `AdminPage.jsx`) | Header kategori Pengaturan & Akses, panel dan field seragam. | Bagian identitas, logo dan pembayaran tidak menutupi form |
| Email (`AdminEmailPage.jsx` + CSS bersama) | Header kategori Pengaturan & Akses, panduan, separator, dan spacing. | Konfigurasi SMTP dan validasi tetap berjalan |
| Keranjang bersama (`SharedCartPage.jsx` + CSS bersama) | Panduan operasional di shell Admin; tata letak transaksi dipertahankan. | Kunci, cek stok dan finalisasi tetap sesuai izin |
| Toko & Sales (`AdminB2BStoresPage.jsx`) | Desain lima langkah yang sebelumnya sudah disetujui tetap dipertahankan. | Kalender/jadwal mingguan dan penugasan Sales tidak terpengaruh |

## QA wajib

- [ ] Desktop 1440px: judul, badge, panduan dan konten tidak berhimpit.
- [ ] Tablet 768–1024px: panel tidak overflow, panduan dapat digeser horizontal bila perlu.
- [ ] Mobile 360–430px: tabel memiliki scroll horizontal internal dan tombol tidak tertutup.
- [ ] Dark/Light Mode: kontras teks dan separator cukup.
- [ ] Browser zoom 125%/150%: kolom tindakan tetap dapat diakses.
- [ ] Pesanan: menghitung hasil filter dengan benar, penjelasan teknis bisa dibuka.
- [ ] Katalog: sticky filter tetap bekerja; edit/hapus masih membuka konfirmasi sesuai aturan.
- [ ] Owner/Admin: tombol dan hak akses berbeda tetap dipertahankan.
- [ ] Build/lint/tes otomatis lolos.

### Catatan

Garis pembatas di atas konten dapat berasal dari separator toolbar global BAM.
Karena itu tidak otomatis dihapus dari satu halaman saja agar navigasi tidak menjadi
tidak konsisten. Perubahan fokus pada ruang yang berhimpit dan penataan informasi.
Pemeriksaan visual pada browser tetap diperlukan meskipun CI lolos.
