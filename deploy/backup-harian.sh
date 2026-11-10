#!/bin/sh
# Cadangan harian: buat, verifikasi, lalu hapus cadangan lebih tua dari 14 hari.
# Gagal dengan kode keluar bukan nol bila pembuatan atau verifikasi gagal, sehingga
# `systemctl status bam-backup` dan pemantau bisa melihatnya.
set -eu
OUT="${BAM_BACKUP_DIR:-/var/backups/bam}"
KEEP_DAYS="${BAM_BACKUP_KEEP_DAYS:-14}"

node tools/database-backup.mjs backup --out "$OUT"
LATEST="$(ls -1dt "$OUT"/*/ | head -n 1)"
node tools/database-backup.mjs verify --from "$LATEST"

# Hapus hanya folder cadangan lama; yang terbaru selalu dipertahankan.
find "$OUT" -mindepth 1 -maxdepth 1 -type d -mtime +"$KEEP_DAYS" ! -path "${LATEST%/}" -exec rm -rf {} +
echo "Cadangan terverifikasi: $LATEST"
