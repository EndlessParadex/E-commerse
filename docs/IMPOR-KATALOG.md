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
- `--tambah-varian` untuk daftar harga yang hanya menambah kemasan ke produk yang sudah ada
  (misalnya renceng dari distributor). Produk dicocokkan lewat `id` atau nama. Foto, nama,
  deskripsi, dan harga SKU lama tidak diubah; SKU yang sudah ada dilewati. Bila `pemasok` di
  `katalog.json` berbeda dengan PT produk, kemasan baru tercatat dari PT tersebut dan PT itu
  dihubungkan dengan mereknya. Produk yang belum ada dibuat seperti biasa.
- `--folder <path>` memakai folder lain selain `katalog-lokal`.
- `--tanpa-backup` melewati backup otomatis.

Database yang dipakai mengikuti `BAM_DB_PATH` (default `data/bam.sqlite`).

## Ukuran foto

Setiap foto maksimal 1 MB (JPG, PNG, atau WebP). Foto disimpan terpisah di database (tabel
`catalog_photos`) dan dikirim ke browser sebagai file ber-cache, jadi banyaknya foto tidak
memperlambat halaman toko. Sekitar 800 px sisi terpanjang sudah cukup untuk kartu dan halaman
produk; foto lebih kecil berarti backup lebih kecil dan halaman lebih cepat di jaringan seluler.
Satu kali impor dibatasi 300 MB; bila lebih, bagi foto ke beberapa folder impor.
