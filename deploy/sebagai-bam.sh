#!/bin/sh
# Jalankan satu perintah sebagai pengguna `bam` dengan lingkungan yang sama dengan server.
# /etc/bam/bam.env hanya bisa dibaca root, jadi skrip ini dijalankan dengan sudo:
#   sudo sh deploy/sebagai-bam.sh npm run import:katalog
set -eu
ENV_FILE="${BAM_ENV_FILE:-/etc/bam/bam.env}"
APP_DIR="${BAM_APP_DIR:-/opt/bam/app}"
RUN_AS="${BAM_RUN_AS:-bam}"
[ "$#" -gt 0 ] || { echo "Pemakaian: sudo sh deploy/sebagai-bam.sh <perintah...>" >&2; exit 2; }
[ -r "$ENV_FILE" ] || { echo "Tidak bisa membaca $ENV_FILE (jalankan dengan sudo)." >&2; exit 1; }
set -a
. "$ENV_FILE"
set +a
cd "$APP_DIR"
exec runuser -u "$RUN_AS" -- "$@"
