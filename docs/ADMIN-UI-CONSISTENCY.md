# BAM — Audit dan konsistensi seluruh admin panel

Tanggal: 27 Oktober 2026. Branch: `feature/b2b-store-sales-shared-cart`.
Basis: `1a09122` (hasil fetch branch GitHub pada sesi ini).

## Konteks dan urutan keputusan

Chat **Opsi B Kemudian A** hanya berisi pilihan pengguna. Definisi terakhir ditemukan di chat **Cek Konsistensi Tampilan**:

1. **Opsi B:** master CSS consistency patch dan class bersama.
2. **Opsi A:** daftar/perbaikan terperinci per file dan halaman, setelah standar global tersedia.

Basis branch sudah memuat perapihan awal B/A. Sesi ini mengonsolidasikan B lebih dahulu dalam `AdminUnifiedUI.css`, kemudian mengerjakan A berdasarkan audit kode dan browser. Checkout lama memiliki pekerjaan B2B yang belum di-commit; semua perubahan sesi ini berada di salinan kerja terpisah agar pekerjaan tersebut tetap utuh.

## B — standar bersama yang diterapkan

| Elemen | Standar |
| --- | --- |
| Header → pemberitahuan → panduan | Jarak 20 px |
| Antar panel besar | Jarak 24 px |
| Padding panel | 24 px desktop/tablet; 16 px pada lebar ≤650 px |
| Radius panel utama | 20 px |
| Tombol aksi utama/sekunder/hapus/link tindakan | Tinggi minimum 44 px |
| Badge dan chip informasi | Tinggi minimum 34 px; teks boleh membungkus |
| Ikon judul/panel | Kotak 36 px; tidak menyusut saat teks panjang |
| Judul panel dan deskripsi | 1.125 rem dan 0.875 rem; separator mengikuti warna tema |
| Kartu statistik | Tinggi minimum 160 px, 144 px di ponsel; tinggi baris seragam |
| Form pada ponsel | Teks input/select/textarea 1 rem (16 px pada ukuran teks normal) |
| Logo sidebar | Logo gambar 40 × 40 px, rasio gambar dipertahankan oleh CompanyBrand |
| Sidebar | Pergantian ke menu ringkas konsisten pada 950 px |
| Panduan | Membungkus menjadi dua/satu kolom pada tablet/ponsel, tanpa strip minimum 720–890 px |

Class bersama: `.admin-header`, `.admin-page-title-icon`, `.admin-page-title-text`, `.admin-demo-badge`, `.admin-preview-notice`, `.admin-page-guide`, `.admin-panel`, `.admin-panel-heading`, `.admin-unified-section-icon`, `.admin-heading-actions`, `.admin-field`.

`AdminUnifiedUI.css` dimuat sesudah seluruh CSS halaman admin. Aturan hanya berlaku di `.admin-shell`; tema terang/gelap tetap memakai palet aplikasi. Kalender tetap memiliki ukuran sel tanggal tersendiri.

## A — perubahan per file

| File | Perubahan sesi ini |
| --- | --- |
| `src/pages/AdminUnifiedUI.css` | Menggabungkan aturan global yang bertumpuk; menetapkan token ukuran/jarak; merapikan header, logo, badge, panduan, panel, formulir, tabel, pesan pesanan, kesiapan toko dan sidebar. Mengatasi prioritas selector yang sebelumnya menghalangi ukuran teks ponsel. |
| `src/pages/AdminPage.jsx` | Memindahkan impor tiga stylesheet admin ke akhir impor; membungkus teks judul agar pembungkusan teks panjang tidak merusak alignment ikon. |
| `src/pages/AdminDesign2.css` | Menghapus override padding/tipografi header panel operasional yang mengalahkan standar bersama. |
| `src/pages/AdminStockPage.css` | Menghapus separator atas ganda dan efek toolbar yang berulang; menyamakan gutter kontrol serta tinggi pilihan tampilan stok. |
| `src/pages/AdminB2BStoresPage.css` | Menyamakan padding seluruh panel Toko & Sales, gap workspace, heading dan separator; memperbesar kontrol navigasi kalender dan pilihan penugasan Sales; mengganti separator vertikal dengan horizontal saat kolom ditumpuk di ponsel. Lima langkah, tiga tanggal mendatang dan kalender tetap dipertahankan. |
| `src/components/shop/SharedCartPage.css` | Menyamakan lebar, padding, gap, radius dan heading kartu keranjang Admin; memastikan langkah transaksi dan workspace membungkus pada ponsel. Semua tambahan dibatasi oleh `.admin-shell`. |
| `src/pages/AdminCompanyPage.css` | Menyamakan padding catatan instalasi, jarak identitas/logo/pembayaran dan footer aksi. |
| `src/pages/AdminAccountsPage.css` | Tinggi minimum tombol tindakan akun menjadi 44 px. |
| `src/pages/adminUi.test.js` | Memuat lapisan CSS yang dipakai aplikasi; mengganti tiga pencocokan teks CSS dengan pemeriksaan gaya terhitung untuk gap panduan, tinggi kartu dan alignment sel tabel. Pemeriksaan navigasi serta isian yang belum disimpan tetap berjalan. |
| `docs/ADMIN-UI-CONSISTENCY.md` | Laporan ini: standar, pemetaan file, cakupan audit dan bukti pengujian aktual. |

## Cakupan halaman

Semua 13 menu diperiksa: Dashboard, Pesanan, Stok, Daftar produk, PT pemasok, Merek, Kategori, Toko & Sales, Keranjang bersama, Perusahaan, Persetujuan akun, Kelola akun, dan Email.

Halaman pemasok/merek/kategori, Pesanan, Persetujuan dan Email mengikuti perbaikan lapisan bersama tanpa perubahan logika lokal. Basis branch sudah menggabungkan informasi pembayaran/pengiriman Pesanan ke disclosure; perilaku itu diperiksa ulang dan dipertahankan.

## Pengujian aktual

| Pemeriksaan | Hasil |
| --- | --- |
| `npm test` | **347 lulus, 0 gagal**, termasuk server, hak akses, transaksi, stok, B2B dan UI. |
| `npm run build` | **Lulus**. Ada peringatan bundle utama >500 kB sesudah minifikasi. |
| `npm run lint` | **Lulus / exit 0**, dengan satu peringatan yang sudah ada pada ekspor konstanta `AdminPageGuide.jsx` (`react/only-export-components`). |
| `git diff --check` | **Lulus**. |
| 13 halaman × desktop 1440 px, tema terang | Tidak ada luapan horizontal halaman. |
| 13 halaman × ponsel 360 px, tema terang | Tidak ada luapan horizontal halaman; header panel memakai padding 16 px. |
| 13 halaman × tablet 768 px, tema gelap | Tidak ada luapan horizontal halaman. |
| 13 halaman × desktop 1440 px, tema gelap | Tidak ada luapan horizontal halaman atau konten terpotong pada header/aksi/field yang diperiksa. |
| 13 halaman × ponsel 430 px, tema gelap | Tidak ada luapan horizontal halaman atau konten terpotong pada header/aksi/field yang diperiksa. |
| Sidebar 920 px | Menu ringkas tampil, dapat dibuka dan seluruh menu dapat diakses. |
| Form produk 390 px | Tidak meluap; input terlihat 16 px dan tinggi 44 px. |
| Penugasan Sales 390 px | Disclosure dapat dibuka; select penugasan tinggi 44 px dan teks 16 px. |
| Pencarian/reset produk | Pencarian tanpa hasil dan reset filter bekerja. |
| Informasi Pesanan | Disclosure pembayaran/pengiriman terbuka; panel kesiapan tersedia, banner rutin ganda tidak kembali. |
| Konsol browser pada akhir pengujian | Tidak ada pesan error. |

Matriks utama berisi **65 kombinasi halaman/ukuran/tema**. Tabel lebar pada dashboard memakai area gulir internal; halaman tetap sesuai lebar layar. Bukti memakai database contoh terpisah, akun fiktif, dua toko dan keranjang contoh. Tidak ada data produksi yang diedit.

## Batas verifikasi dan penyerahan

- Browser diperiksa melalui Chromium bawaan aplikasi. Safari/Firefox, ponsel fisik dan zoom browser 125%/150% belum diperiksa.
- Audit visual memakai akun pemilik contoh. Batas akses akun admin/pembeli diperiksa oleh rangkaian tes yang sudah tersedia, bukan dengan perubahan peran akun produksi.
- Tidak ada perubahan pada berkas server, model data, aturan harga, stok, pembayaran, finalisasi atau hak akses.
- Branch tujuan perubahan adalah `feature/b2b-store-sales-shared-cart`. Verifikasi ini tidak mencakup deployment produksi.
- Patch lokal dibuat relatif terhadap `1a09122`. Setelah commit tersedia di GitHub, checkout lain dapat mengambil perubahan melalui `git pull origin feature/b2b-store-sales-shared-cart`.
