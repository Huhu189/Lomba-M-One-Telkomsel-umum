#!/usr/bin/env bash
#
# jalankan-smoke-perjalanan.sh — nyalakan layanan yang dibutuhkan smoke tema
# perjalanan materi (backend :8000, vite :5173, Chrome headless CDP :9333),
# jalankan `smoke-ui-perjalanan.mjs`, lalu matikan semuanya. Semua dalam satu
# proses shell supaya layanan tetap hidup sampai harness selesai.
#
# Realtime tidak diperlukan — tema perjalanan hanya memakai REST.
set -u
cd "$(dirname "$0")/.." || exit 1
ROOT="$(pwd)"

# Kolom `materials.tema` harus ada di DB dev sebelum harness jalan.
( cd "$ROOT/backend" && php artisan migrate --force ) || {
  echo "migrasi gagal"
  exit 1
}

# Video uji kecil (2 detik) yang diunggah harness sebagai latar tema.
VIDEO_UJI=/tmp/jelajah-smoke.mp4
if [ ! -s "$VIDEO_UJI" ]; then
  if command -v ffmpeg >/dev/null 2>&1; then
    ffmpeg -f lavfi -i "color=c=0x1a2f65:s=320x180:d=2" -pix_fmt yuv420p -movflags +faststart -y "$VIDEO_UJI" >/dev/null 2>&1
  else
    echo "ffmpeg tidak ada; siapkan $VIDEO_UJI sendiri atau lewati pemeriksaan video latar"
    exit 1
  fi
fi
export VIDEO_UJI

( cd "$ROOT/backend" && exec php artisan serve --host=127.0.0.1 --port=8000 ) >/tmp/srv-perjalanan-b.log 2>&1 &
B=$!
( cd "$ROOT/frontend" && exec node node_modules/vite/bin/vite.js --host --port 5173 --strictPort ) >/tmp/srv-perjalanan-f.log 2>&1 &
F=$!

bersihkan() {
  kill "$B" "$F" 2>/dev/null
  pkill -f "remote-debugging-port=9333" 2>/dev/null
  pkill -f "artisan serve" 2>/dev/null
}
trap bersihkan EXIT

siap=0
for _ in $(seq 1 30); do
  v=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/ || true)
  b=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8000/sanctum/csrf-cookie || true)
  if [ "$v" = "200" ] && [ "$b" != "000" ]; then siap=1; break; fi
  sleep 1
done
if [ "$siap" != "1" ]; then
  echo "layanan tidak siap: vite=$v backend=$b"
  tail -5 /tmp/srv-perjalanan-b.log /tmp/srv-perjalanan-f.log
  exit 1
fi
echo "layanan siap: vite=$v backend=$b"

("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-first-run --no-proxy-server \
  --remote-debugging-port=9333 --user-data-dir=/tmp/chrome-smoke-perjalanan \
  --autoplay-policy=no-user-gesture-required \
  about:blank >/tmp/chrome-perjalanan.log 2>&1 &)

for _ in $(seq 1 20); do
  curl -s -o /dev/null http://127.0.0.1:9333/json/version && break
  sleep 1
done

node "$ROOT/docs/smoke-ui-perjalanan.mjs"
ST=$?
echo "hasil smoke: $ST"
exit $ST
