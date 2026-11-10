#!/bin/sh
# Izinkan web (80/443) hanya dari Cloudflare, dan SSH dari mana saja (atau dari IP kantor).
# Jalankan sebagai root di server. Aman dijalankan ulang: daftar diambil langsung dari
# Cloudflare setiap kali. Perbarui juga `trusted_proxies` di deploy/Caddyfile bila
# daftar ini berubah.
set -eu
SSH_FROM="${SSH_FROM:-any}"

V4="$(curl -fsS https://www.cloudflare.com/ips-v4)"
V6="$(curl -fsS https://www.cloudflare.com/ips-v6)"
[ -n "$V4" ] && [ -n "$V6" ] || { echo "Gagal mengambil daftar IP Cloudflare; firewall tidak diubah." >&2; exit 1; }

ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow from "$SSH_FROM" to any port 22 proto tcp
for range in $V4 $V6; do
  ufw allow from "$range" to any port 80,443 proto tcp
done
ufw --force enable
ufw status numbered
