# Impor Katalog dari Folder Lokal

`npm run import:katalog` memasukkan banyak produk sekaligus (pemasok, merek, subkategori,
varian, harga, dan foto) ke database BAM. Validasinya sama dengan form admin
(`normalizeCatalog` di `server/catalog.js`) dan disimpan dalam satu transaksi.

## Data tidak masuk repo

Harga distributor dan foto produk **tidak** disimpan di GitHub karena repo ini publik.
Simpan di folder `katalog-lokal/` di root proyek. Folder ini ada di `.gitignore`.
Bagikan folder itu lewat Drive/flashdisk ke PC lain, bukan lewat Git.

```
katalog-lokal/
  katalog.json
  foto/
    nama-file.jpg
```

Format `katalog.json` ada di `docs/contoh-katalog-lokal/katalog.json` (data fiktif).

| Kolom varian   | Isi                                                                  |
| -------------- | -------------------------------------------------------------------- |
| `sku`          | Unik. Huruf, angka, `-` atau `_`, maksimal 64 karakter.              |
| `ukuran`       | Ukuran per satuan, misalnya `70`.                                    |
| `satuan`       | `g`, `ml`, atau `pcs`.                                               |
| `kemasan`      | `satuan`, `pack`, `dus`, `renceng`, atau `box`.                      |
| `isi`          | Total satuan dalam kemasan (abaikan untuk `satuan`).                 |
| `packDalamDus` | Opsional. Harus membagi `isi` dengan tepat. Contoh 6×10 → isi 60, 6. |
| `harga`        | Harga per kemasan (harga 1 dus), bilangan bulat rupiah.              |
| `hargaCoret`   | Opsional, harus lebih besar dari `harga`.                            |
| `foto`         | Path relatif terhadap `katalog-lokal/`, JPG/PNG/WebP ≤ 1 MB.         |

Foto varian pertama yang punya foto menjadi galeri produk. Varian lain dengan foto memakai
fotonya sendiri; varian tanpa foto memakai galeri produk.

## Menjalankan

1. Hentikan server BAM (`Ctrl+C` pada `npm run dev:full`).
2. Periksa dulu. Tidak ada yang ditulis:

   ```powershell
   npm run import:katalog
   ```

3. Kalau ringkasannya benar, simpan. Backup otomatis dibuat di `backups/` sebelum menulis:

   ```powershell
   npm run import:katalog -- --tulis
   ```

4. Jalankan server lagi, lalu atur **stok** produk baru di Admin. Stok awal produk impor = 0,
   jadi produk belum bisa dipesan sebelum stok diisi.

Opsi tambahan:

- `--hapus-contoh` menghapus 8 produk contoh bawaan BAM dan pemasok/merek/kategori contoh
  yang tidak dipakai lagi.
- `--perbarui` mengganti produk dengan `id` yang sama (misalnya harga baru). Semua SKU lama
  produk itu harus tetap ada di `katalog.json`.
- `--folder <path>` memakai folder lain selain `katalog-lokal`.
- `--tanpa-backup` melewati backup otomatis.

Database yang dipakai mengikuti `BAM_DB_PATH` (default `data/bam.sqlite`).

## Batas ukuran foto

Saat ini seluruh katalog, termasuk foto dalam bentuk base64, dikirim oleh `GET /api/catalog`
ke setiap pengunjung tanpa cache, dan `PUT /api/admin/catalog` dibatasi 20 MB. Karena itu
skrip menolak katalog di atas 15 MB dan memberi peringatan di atas 5 MB. Kecilkan foto
(sekitar 800 px sisi terpanjang sudah cukup untuk kartu dan halaman produk) sebelum impor.
Perbaikan jangka panjang: sajikan foto sebagai file terpisah dengan cache, bukan di dalam JSON
katalog.
