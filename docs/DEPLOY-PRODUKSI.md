# Deploy produksi BAM

Panduan ini memasang BAM di satu server (VPS) di Jakarta, di belakang Cloudflare, dengan cadangan
terus-menerus ke luar server. Berkas siap pakai ada di folder [`deploy/`](../deploy).

```
Pembeli → Cloudflare (DNS, CDN, WAF, TLS) → Caddy (TLS asal, batas ukuran) → Node 24 (systemd)
                                                                             └ SQLite (WAL) → Litestream → bucket S3/R2
```

**Satu proses saja.** SQLite hanya mengizinkan satu penulis. Menjalankan dua salinan server pada
database yang sama membuat keduanya saling mengunci. Untuk beban lebih besar, perbesar server
(CPU/RAM), jangan menambah proses.

## Yang sudah diuji dan yang belum

| Bagian                                                         | Status                                                                                                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `deploy/bam.service`, `bam-backup.service`, `bam-backup.timer` | Lolos `systemd-analyze verify`                                                                                                              |
| `deploy/backup-harian.sh`                                      | Dijalankan pada database demo: membuat, memverifikasi, menghapus cadangan > 14 hari, kode keluar 1 saat gagal                               |
| Rantai IP Cloudflare → Caddy → Node                            | Diuji otomatis terhadap logika server (`server/deployProxyChain.test.js`)                                                                   |
| `GET /api/health`                                              | Diuji otomatis (`server/health.test.js`)                                                                                                    |
| `deploy/Caddyfile`, `deploy/litestream.yml`                    | **Belum dijalankan.** Ditulis dari dokumentasi resmi Caddy 2.10 dan Litestream 0.5. Validasi di server pada langkah 5 dan 7 sebelum dipakai |
| `deploy/firewall-cloudflare.sh`                                | Sintaks shell diperiksa; **belum dijalankan** (butuh root dan `ufw`)                                                                        |

## 0. Yang perlu disiapkan

- VPS di Jakarta, Ubuntu 24.04, disk NVMe. Awal: 2 vCPU / 4 GB. Naikkan bila CPU puncak > 60 %
  atau waktu respons p95 > 500 ms.
- Domain dan akun Cloudflare (paket gratis cukup).
- Bucket S3-kompatibel untuk cadangan (contoh: Cloudflare R2) dan sepasang kunci aksesnya.
- Layanan SMTP untuk email verifikasi (lihat [EMAIL-DAN-PROXY.md](./EMAIL-DAN-PROXY.md)).
- Pengelola kata sandi untuk menyimpan rahasia (langkah 7).

WhatsApp OTP **bukan** syarat rilis: verifikasi email sudah cukup untuk memesan.

## 1. Server

```bash
sudo timedatectl set-timezone Asia/Jakarta
sudo adduser --system --group --home /opt/bam bam
sudo mkdir -p /opt/bam/app /var/lib/bam /var/backups/bam /etc/bam
sudo chown -R bam:bam /opt/bam /var/lib/bam /var/backups/bam
sudo chmod 700 /var/lib/bam /var/backups/bam
```

Pasang Node.js 24 dari [NodeSource](https://github.com/nodesource/distributions) dan pastikan
`/usr/bin/node --version` menampilkan v24. Aktifkan pembaruan keamanan otomatis:

```bash
sudo apt install -y unattended-upgrades fail2ban
sudo dpkg-reconfigure -plow unattended-upgrades
```

SSH: masuk dengan kunci saja. Di `/etc/ssh/sshd_config` atur `PasswordAuthentication no` dan
`PermitRootLogin no`, lalu `sudo systemctl restart ssh`. Uji dari terminal kedua sebelum menutup
sesi yang sedang terbuka.

## 2. Aplikasi

```bash
sudo -u bam git clone https://github.com/EndlessParadex/E-commerse /opt/bam/app
cd /opt/bam/app
sudo -u bam npm ci
sudo -u bam npm run build
sudo cp deploy/bam.env.example /etc/bam/bam.env
sudo chmod 600 /etc/bam/bam.env
sudo nano /etc/bam/bam.env        # ganti toko.example.com dengan domain Anda
```

Perintah berikutnya memakai `deploy/sebagai-bam.sh`, yang menjalankan perintah sebagai pengguna
`bam` dengan variabel dari `/etc/bam/bam.env` (berkas itu hanya bisa dibaca root).

Buat akun Pemilik pada database perusahaan (lihat [MODE-PERUSAHAAN.md](./MODE-PERUSAHAAN.md) dan
[PEMILIK-DAN-EMAIL.md](./PEMILIK-DAN-EMAIL.md)). Kata sandi diketik tanpa tampil di layar dan
tidak tersimpan di riwayat perintah:

```bash
sudo bash -c 'read -rsp "Kata sandi Pemilik: " BAM_ADMIN_PASSWORD; echo; export BAM_ADMIN_PASSWORD;
  sh deploy/sebagai-bam.sh npm run create-owner:company -- \
  pemilik@domain-anda "Nama Pemilik" "Alamat lengkap perusahaan"'
```

Katalog asli (data dan foto) **tidak ada di GitHub**. Salin folder `katalog-lokal/` ke
`/opt/bam/app/` lewat `scp`, lalu impor sebelum layanan dinyalakan (langkah 3):

```bash
sudo sh deploy/sebagai-bam.sh npm run import:katalog              # periksa saja
sudo sh deploy/sebagai-bam.sh npm run import:katalog -- --tulis   # simpan
```

Hapus `katalog-lokal/` dari server setelah impor berhasil bila tidak diperlukan lagi.

## 3. Layanan systemd

```bash
sudo cp deploy/bam.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now bam
curl -s http://127.0.0.1:3001/api/health      # harus {"status":"ok"}
sudo journalctl -u bam -n 50
```

Layanan dibatasi: hanya `/var/lib/bam` yang bisa ditulis, tanpa hak root, memori maksimal 1 GB,
dan otomatis hidup lagi bila berhenti.

## 4. Cloudflare

1. Tambahkan domain, arahkan record `A` ke IP server dengan **Proxy aktif** (awan oranye).
2. SSL/TLS → mode **Full (strict)**.
3. SSL/TLS → Origin Server → **Create Certificate**. Simpan sertifikat sebagai
   `/etc/caddy/certs/origin.pem` dan kuncinya sebagai `/etc/caddy/certs/origin-key.pem`
   (`chmod 600`, pemilik `caddy`).
4. Security → WAF → Rate limiting rules: batasi `/api/auth/*` (misalnya 20 permintaan per menit
   per IP, tindakan _Managed Challenge_).

## 5. Caddy

Pasang Caddy dari [repositori resminya](https://caddyserver.com/docs/install#debian-ubuntu-raspbian), lalu:

```bash
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile     # ganti toko.example.com
sudo caddy validate --config /etc/caddy/Caddyfile     # WAJIB lolos sebelum lanjut
sudo systemctl reload caddy
curl -s https://toko.example.com/api/health
```

**Periksa rantai alamat IP.** Buka website dari HP (data seluler), lalu lihat log:

```bash
sudo tail -n 1 /var/log/caddy/bam.log | grep -o '"client_ip":"[^"]*"\|"remote_ip":"[^"]*"'
```

`client_ip` harus alamat HP Anda (cek di whatismyip.com); `remote_ip` adalah alamat Cloudflare.
Jika `client_ip` berisi alamat Cloudflare, daftar `trusted_proxies` tidak cocok: batas percobaan
masuk akan menggabungkan banyak pembeli dan bisa mengunci pembeli sungguhan saat ramai.

Caddy mengirim **satu** alamat ke Node (`header_up X-Forwarded-For {client_ip}`), dan Node hanya
mempercayai Caddy (`BAM_TRUSTED_PROXIES=127.0.0.1/32,::1/128`). Jangan menambahkan rentang
Cloudflare ke `BAM_TRUSTED_PROXIES`.

## 6. Firewall

```bash
sudo sh deploy/firewall-cloudflare.sh              # SSH dari mana saja
sudo SSH_FROM=203.0.113.10 sh deploy/firewall-cloudflare.sh   # atau hanya dari IP kantor
```

Skrip mengambil daftar IP Cloudflare terbaru dan hanya mengizinkan port 80/443 dari sana, sehingga
server tidak bisa diserang dengan melewati Cloudflare. **Buka sesi SSH kedua lebih dulu** agar
tidak terkunci bila aturan salah. Jalankan ulang tiap beberapa bulan, dan samakan daftar
`trusted_proxies` di Caddyfile.

## 7. Cadangan dan rahasia

**Lapisan 1: Litestream (terus-menerus, kehilangan data hitungan detik).** Pasang paket `.deb`
terbaru dari [rilis resmi Litestream](https://github.com/benbjohnson/litestream/releases), lalu:

```bash
sudo cp deploy/litestream.yml /etc/litestream.yml
sudo nano /etc/litestream.yml                  # bucket dan endpoint
sudo sh -c 'printf "LITESTREAM_ACCESS_KEY_ID=...\nLITESTREAM_SECRET_ACCESS_KEY=...\n" > /etc/litestream.env'
sudo chmod 600 /etc/litestream.env
sudo systemctl edit litestream                 # isi dua baris di bawah, simpan
#   [Service]
#   EnvironmentFile=/etc/litestream.env
sudo systemctl enable --now litestream
sudo journalctl -u litestream -n 20            # tidak boleh ada error
```

**Lapisan 2: cadangan harian terverifikasi** (alat yang sama dengan
[BACKUP-DAN-PEMULIHAN.md](./BACKUP-DAN-PEMULIHAN.md)), disimpan 14 hari di `/var/backups/bam`:

```bash
sudo cp deploy/bam-backup.service deploy/bam-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now bam-backup.timer
sudo systemctl start bam-backup && systemctl status bam-backup --no-pager
```

**Rahasia yang TIDAK ikut cadangan.** Simpan di pengelola kata sandi:

- `/etc/bam/bam.env`
- `/var/lib/bam/company.sqlite.mail-key` (tanpa berkas ini pengaturan email tidak bisa dibuka)
- sertifikat dan kunci asal Cloudflare, kunci akses bucket

Tanpa rahasia ini database yang dipulihkan tidak bisa dijalankan sepenuhnya.

**Latihan pemulihan (sebulan sekali, catat lamanya):**

```bash
sudo mkdir -p /tmp/uji-pulih
sudo sh -c 'set -a; . /etc/litestream.env; set +a;
  litestream restore -o /tmp/uji-pulih/company.sqlite /var/lib/bam/company.sqlite'
sudo chown -R bam:bam /tmp/uji-pulih
sudo BAM_ENV_FILE=/etc/bam/bam.env sh deploy/sebagai-bam.sh \
  env BAM_DB_PATH=/tmp/uji-pulih/company.sqlite PORT=3999 node server/index.js &
curl -s http://127.0.0.1:3999/api/health      # harus {"status":"ok"}
```

Periksa jumlah pesanan pada salinan itu sama dengan produksi, hentikan prosesnya dengan
`sudo fuser -k 3999/tcp`, lalu hapus `/tmp/uji-pulih`. Cadangan yang belum pernah dipulihkan belum terbukti.

## 8. Email: SPF, DKIM, DMARC

Verifikasi email adalah syarat memesan. Bila email masuk spam, pembeli tidak bisa membeli. Di DNS
(Cloudflare, **tanpa** proxy untuk record ini) tambahkan sesuai petunjuk penyedia SMTP Anda:

| Jenis     | Nama                    | Isi                                                    |
| --------- | ----------------------- | ------------------------------------------------------ |
| TXT       | `@`                     | `v=spf1 include:<domain-penyedia> -all`                |
| TXT/CNAME | `<selector>._domainkey` | kunci DKIM dari penyedia                               |
| TXT       | `_dmarc`                | `v=DMARC1; p=quarantine; rua=mailto:dmarc@domain-anda` |

Uji dengan mengirim email verifikasi ke Gmail, buka **Tampilkan asli**: SPF, DKIM dan DMARC harus
`PASS`.

## 9. Pemantauan

Daftarkan `https://toko.example.com/api/health` di pemantau uptime (UptimeRobot, Better Stack)
dengan interval 1 menit dan peringatan ke WhatsApp/Telegram. Jawaban selain 200 berarti server
atau database bermasalah.

## 10. Memperbarui aplikasi

Lakukan di jam sepi (setelah batas pesanan sore). Server berhenti 1–3 detik.

```bash
cd /opt/bam/app
sudo systemctl start bam-backup          # cadangan sebelum perubahan
sudo -u bam git pull
sudo -u bam npm ci
sudo -u bam npm run build
sudo systemctl restart bam
curl -s https://toko.example.com/api/health
```

Bila bermasalah: `sudo -u bam git checkout <commit-sebelumnya>`, ulangi `npm ci`, `npm run build`,
`systemctl restart bam`. CI di GitHub (`verify` dan tes browser `e2e`) harus hijau sebelum `git pull`.

## Daftar periksa sebelum dibuka

- [ ] `caddy validate` lolos; `client_ip` di log = alamat pengunjung
- [ ] Firewall hanya menerima 80/443 dari Cloudflare
- [ ] `/api/health` dipantau dan peringatan sampai ke HP
- [ ] Litestream berjalan tanpa error; cadangan harian terverifikasi
- [ ] Satu latihan pemulihan selesai dan dicatat lamanya
- [ ] Rahasia tersimpan di pengelola kata sandi
- [ ] SPF/DKIM/DMARC `PASS`; daftar → verifikasi email → pesan berhasil dari HP
- [ ] Sopir pengiriman sudah diisi di Pengaturan perusahaan
- [ ] Uji cetak faktur dan daftar muat di printer yang dipakai
- [ ] Rilis terbatas 3–5 toko selama seminggu sebelum dibuka penuh
