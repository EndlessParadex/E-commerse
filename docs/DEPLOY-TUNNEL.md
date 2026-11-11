# Deploy BAM lewat Cloudflare Tunnel (komputer sendiri atau VPS)

Panduan ini menjalankan BAM di komputer cadangan di kantor atau rumah, dan membukanya ke internet
lewat **Cloudflare Tunnel**. Cocok untuk uji coba terbatas dengan 3–5 toko. Cara yang sama juga
berlaku di VPS, dan di sana lebih sederhana daripada rantai Caddy di
[DEPLOY-PRODUKSI.md](./DEPLOY-PRODUKSI.md).

```
Pembeli → Cloudflare (HTTPS, WAF) ⇐ koneksi keluar ⇐ cloudflared → Node 24 (systemd) → SQLite
```

`cloudflared` yang menghubungi Cloudflare, bukan sebaliknya. Karena itu tidak ada port yang
dibuka di router, cara ini tetap jalan di belakang CGNAT, dan alamat IP rumah tidak terlihat.
Yang **tidak** diperlukan di jalur ini: Caddy, sertifikat asal, dan `deploy/firewall-cloudflare.sh`.

## Batasan komputer sendiri

- Website mati saat listrik atau internet di lokasi mati. Tidak ada jaminan dari ISP rumahan.
- Kecepatan unggah internet rumahan kecil. Rencanakan untuk puluhan pengguna bersamaan.
- Satu disk. Tanpa cadangan ke luar (langkah 7), kerusakan disk berarti semua pesanan hilang.
- Data pembeli (nama, alamat, nomor HP) tunduk pada UU PDP 27/2022 di mana pun servernya berada.

Pindah ke VPS begitu pesanan sungguhan rutin masuk. Berkas `deploy/` yang sama dipakai di sana.

## Yang sudah diuji dan yang belum

| Bagian                                                  | Status                                                                           |
| ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Alamat pengunjung lewat tunnel                          | Logika server diuji otomatis (`server/deployProxyChain.test.js`)                 |
| `deploy/bam.service`, cadangan harian, `/api/health`    | Sama dengan DEPLOY-PRODUKSI: sudah diuji                                         |
| `deploy/cloudflared-config.yml`, perintah `cloudflared` | **Belum dijalankan.** Ditulis dari dokumentasi Cloudflare; validasi di langkah 5 |

## 0. Yang perlu disiapkan

- Komputer cadangan: 2 inti / 4 GB RAM, **SSD** (jangan kartu SD atau HDD), kabel **Ethernet** ke router.
- Domain yang sudah ditambahkan ke Cloudflare (paket gratis). Alamat acak `trycloudflare.com`
  tidak dipakai: pengaturan produksi menolak permintaan dari alamat selain `BAM_APP_ORIGIN`.
- Layanan SMTP luar (lihat [EMAIL-DAN-PROXY.md](./EMAIL-DAN-PROXY.md)). Email tidak bisa dikirim
  langsung dari internet rumahan.
- Sebaiknya UPS kecil, supaya listrik padam tidak memutus penulisan database.

## 1. Sistem operasi

Pasang **Ubuntu Server 24.04 LTS** dan centang "Install OpenSSH server". Di halaman admin router,
kunci alamat komputer ini (DHCP reservation), misalnya `192.168.1.50`.

```bash
sudo timedatectl set-timezone Asia/Jakarta
sudo apt update && sudo apt upgrade -y
sudo apt install -y git ufw fail2ban unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

SSH dengan kunci saja: dari komputer kerja jalankan `ssh-copy-id nama@192.168.1.50`, lalu di
server atur `PasswordAuthentication no` dan `PermitRootLogin no` di `/etc/ssh/sshd_config` dan
jalankan `sudo systemctl restart ssh`. Uji dari terminal kedua sebelum menutup sesi.

Firewall: tunnel hanya butuh koneksi keluar, jadi semua koneksi masuk ditolak kecuali SSH dari
jaringan lokal (sesuaikan `192.168.1.0/24` dengan jaringan Anda):

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.1.0/24 to any port 22 proto tcp
sudo ufw enable
```

**Jika komputernya laptop:** cegah tidur saat layar ditutup. Di `/etc/systemd/logind.conf` atur
`HandleLidSwitch=ignore` dan `HandleLidSwitchExternalPower=ignore`, lalu
`sudo systemctl restart systemd-logind`.

## 2. Node.js dan pengguna khusus

Pasang Node.js 24 dari [NodeSource](https://github.com/nodesource/distributions) sampai
`/usr/bin/node --version` menampilkan v24, lalu:

```bash
sudo adduser --system --group --home /opt/bam bam
sudo mkdir -p /opt/bam/app /var/lib/bam /var/backups/bam /etc/bam
sudo chown -R bam:bam /opt/bam /var/lib/bam /var/backups/bam
sudo chmod 700 /var/lib/bam /var/backups/bam
```

## 3. Aplikasi

```bash
sudo -u bam git clone https://github.com/EndlessParadex/E-commerse /opt/bam/app
cd /opt/bam/app
sudo -u bam npm ci
sudo -u bam npm run build
sudo cp deploy/bam.env.example /etc/bam/bam.env
sudo chmod 600 /etc/bam/bam.env
sudo nano /etc/bam/bam.env
```

Di `/etc/bam/bam.env`:

- ganti `toko.example.com` dengan domain Anda di `BAM_APP_ORIGIN` dan `BAM_PUBLIC_URL`;
- biarkan `BAM_TRUSTED_PROXIES=127.0.0.1/32,::1/128`. `cloudflared` berjalan di komputer ini, dan
  Cloudflare mengisi alamat pengunjung. Tanpa baris ini semua pembeli terhitung sebagai satu
  alamat, dan batas percobaan masuk bisa mengunci semuanya sekaligus;
- tambahkan baris WhatsApp dari `.env` laptop (`BAM_WHATSAPP_TOKEN`, `BAM_WHATSAPP_PHONE_ID`,
  `BAM_WHATSAPP_API_VERSION`, dan nama-nama template). Jangan mengirim token lewat chat atau email.

Buat akun Pemilik dan impor katalog persis seperti **langkah 2 di
[DEPLOY-PRODUKSI.md](./DEPLOY-PRODUKSI.md)** (`deploy/sebagai-bam.sh`). Jangan menjalankan
`npm run ...` langsung sebagai pengguna `bam`: tanpa `/etc/bam/bam.env`, perintah itu memakai
database yang salah.

## 4. Layanan

```bash
sudo cp deploy/bam.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now bam
curl -s http://127.0.0.1:3001/api/health      # harus {"status":"ok"}
```

Server hanya mendengarkan di komputer ini sendiri (`HOST=127.0.0.1`), jadi belum bisa dibuka
dari perangkat lain. Itu disengaja: satu-satunya pintu masuk adalah tunnel di langkah 5. Masuk
akun juga baru bisa diuji lewat alamat HTTPS, karena dalam mode produksi cookie masuk hanya
dikirim lewat HTTPS.

## 5. Cloudflare Tunnel

Pasang `cloudflared` dari repositori resmi Cloudflare:

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install cloudflared
```

Buat tunnel dan arahkan domain:

```bash
cloudflared tunnel login                       # buka tautan yang muncul, pilih domain Anda
cloudflared tunnel create bam                  # catat Tunnel UUID yang ditampilkan
cloudflared tunnel route dns bam toko.example.com
```

Pindahkan kredensial dan konfigurasi ke `/etc/cloudflared`, lalu isi UUID dan domain:

```bash
sudo mkdir -p /etc/cloudflared
sudo mv ~/.cloudflared/<TUNNEL-UUID>.json /etc/cloudflared/
sudo cp /opt/bam/app/deploy/cloudflared-config.yml /etc/cloudflared/config.yml
sudo chmod 600 /etc/cloudflared/<TUNNEL-UUID>.json
sudo nano /etc/cloudflared/config.yml
sudo cloudflared tunnel --config /etc/cloudflared/config.yml ingress validate   # WAJIB lolos
sudo cloudflared --config /etc/cloudflared/config.yml service install
sudo systemctl status cloudflared --no-pager
curl -s https://toko.example.com/api/health    # harus {"status":"ok"}
```

Di dasbor Cloudflare nyalakan **Always Use HTTPS** dan buat satu aturan rate limiting untuk
`/api/auth/*`.

**Periksa alamat pengunjung.** Pakai satu akun uji dan dua HP di jaringan berbeda:

1. HP A (data seluler): masuk ke akun uji dengan kata sandi **salah** berulang kali, sekitar 10
   kali, sampai muncul "Terlalu banyak percobaan gagal dari koneksi ini".
2. HP B (Wi-Fi lain atau operator lain): masuk ke akun yang sama dengan kata sandi **salah** satu
   kali.

HP B harus mendapat pesan kata sandi salah yang biasa. Kalau HP B langsung mendapat "Terlalu
banyak percobaan", server menganggap kedua HP satu alamat: periksa `BAM_TRUSTED_PROXIES` di
`/etc/bam/bam.env`, lalu `sudo systemctl restart bam`. Kata sandi yang benar tetap diterima, jadi
uji ini harus memakai kata sandi salah di kedua HP.

## 6. Email

Ikuti **langkah 8 di [DEPLOY-PRODUKSI.md](./DEPLOY-PRODUKSI.md)** (SPF, DKIM, DMARC). Pembeli tidak
bisa memesan sebelum emailnya terverifikasi, jadi email yang masuk spam berarti pembeli tidak
bisa membeli.

## 7. Cadangan dan rahasia

Ikuti **langkah 7 di [DEPLOY-PRODUKSI.md](./DEPLOY-PRODUKSI.md)** tanpa perubahan: Litestream ke
bucket di luar lokasi, cadangan harian terverifikasi, dan satu latihan pemulihan. Di komputer
sendiri langkah ini lebih penting daripada di VPS, karena disk, listrik dan pencurian adalah
risiko nyata. Simpan juga di pengelola kata sandi:

- `/etc/bam/bam.env` (berisi token WhatsApp)
- `/var/lib/bam/company.sqlite.mail-key`
- `/etc/cloudflared/<TUNNEL-UUID>.json`

## 8. Pemantauan dan pembaruan

Daftarkan `https://toko.example.com/api/health` di pemantau uptime dengan peringatan ke HP.
Untuk komputer sendiri, peringatan ini yang memberi tahu saat listrik atau internet mati.

Memperbarui aplikasi: **langkah 10 di [DEPLOY-PRODUKSI.md](./DEPLOY-PRODUKSI.md)**.

## Daftar periksa sebelum uji coba

- [ ] `ingress validate` lolos dan `https://domain/api/health` menjawab `{"status":"ok"}`
- [ ] Uji dua HP di langkah 5 lolos (HP B mendapat pesan kata sandi salah yang biasa)
- [ ] Daftar → disetujui Admin → verifikasi email → pesan COD berhasil dari HP
- [ ] OTP dan faktur WhatsApp masuk
- [ ] Cadangan harian terverifikasi dan satu latihan pemulihan selesai
- [ ] Rahasia tersimpan di pengelola kata sandi
- [ ] Komputer tetap hidup setelah listrik dicabut lalu dipasang lagi (BIOS: nyala otomatis)
- [ ] Sopir pengiriman dan nama perusahaan sudah diisi di Admin → Perusahaan

## Pindah ke VPS nanti

Hentikan layanan di komputer lama, pulihkan cadangan terakhir di VPS, salin tiga rahasia di atas,
lalu jalankan `cloudflared` di VPS dengan kredensial tunnel yang sama. Domain tidak perlu diubah.
Jangan menjalankan dua server pada salinan database yang sama.
