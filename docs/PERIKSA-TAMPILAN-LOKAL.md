# Memastikan pembaruan tampil pada komputer Anda

1. Hentikan server lama dengan Ctrl+C. Simpan isian form yang masih diperlukan.
2. Dari folder proyek B2B, jalankan `git pull --ff-only origin feature/b2b-store-sales-shared-cart`.
3. Jalankan `npm ci`, `npm test`, `npm run lint`, dan `npm run build` satu per satu. Berhenti jika ada yang gagal.
4. Jalankan `npm run dev:full` dan biarkan terminal tetap berjalan. Jika port sudah dipakai, server baru berhenti supaya frontend tidak terhubung ke backend lama. Hentikan server yang memakai port tersebut lalu coba lagi.
5. Di terminal kedua pada folder yang sama, jalankan `npm run check:local`. Jika alamat Local berbeda, cantumkan alamat itu, misalnya `npm run check:local -- http://localhost:5174`.
6. Semua pemeriksaan harus bertuliskan **LULUS**. Perintah ini memeriksa halaman, kode frontend yang benar-benar disajikan, dan kemampuan backend melalui alamat yang sama. Ini tidak menggantikan test maupun pemeriksaan tampilan browser.
7. Buka alamat yang diperiksa dan tekan Ctrl+Shift+R.

## Hasil yang diharapkan

- Header toko tidak memiliki bayangan saat halaman berada paling atas. Bayangan muncul ketika header menempel saat scroll, lalu hilang setelah kembali ke atas.
- Di Admin → Daftar produk, bayangan hanya muncul ketika pencarian menempel di atas layar.
- Pada HP, pencarian tetap tersedia. Tombol **Filter** membuka/menutup pilihan PT pemasok dan merek. Angka pada tombol menunjukkan jumlah filter aktif; menutup pilihan tidak menghapus filter.
- Pada HP dalam posisi mendatar dengan layar pendek, header toko ikut bergulir agar tidak menutupi sebagian besar konten.
- Nama pengguna dan foto profil tampil setelah masuk; setelah keluar, tulisan menjadi **Guest**. Foto merek/profil tetap ada setelah halaman dimuat ulang.

Jika pemeriksaan gagal, catat alamat dan baris **GAGAL** yang muncul. Jangan menghapus database atau menjalankan reset Git untuk mengatasi perbedaan versi.
