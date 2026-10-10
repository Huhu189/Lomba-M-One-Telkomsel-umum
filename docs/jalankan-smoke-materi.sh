#!/usr/bin/env bash
#
# jalankan-smoke-materi.sh — nyalakan layanan yang dibutuhkan smoke pemutar materi,
# jalankan `smoke-ui-materi.mjs`, lalu matikan semuanya. Semua dalam satu proses
# shell supaya layanan tetap hidup sampai harness selesai (proses latar milik shell
# perintah akan ikut mati begitu perintahnya berakhir).
#
# Yang dihidupkan: backend :8000, vite :5173, Chrome headless CDP :9333.
# Realtime tidak diperlukan — pemutar materi hanya memakai REST.
set -u
cd "$(dirname "$0")/.." || exit 1
ROOT="$(pwd)"

# Kolom baru `materials.rasio` perlu ada di DB dev sebelum harness jalan.
( cd "$ROOT/backend" && php artisan migrate --force ) || {
  echo "migrasi gagal"
  exit 1
}

( cd "$ROOT/backend" && exec php artisan serve --host=127.0.0.1 --port=8000 ) >/tmp/srv-materi-b.log 2>&1 &
B=$!
( cd "$ROOT/frontend" && exec node node_modules/vite/bin/vite.js --host --port 5173 --strictPort ) >/tmp/srv-materi-f.log 2>&1 &
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
  tail -5 /tmp/srv-materi-b.log /tmp/srv-materi-f.log
  exit 1
fi
echo "layanan siap: vite=$v backend=$b"

("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-first-run --no-proxy-server \
  --remote-debugging-port=9333 --user-data-dir=/tmp/chrome-smoke-materi \
  --autoplay-policy=no-user-gesture-required \
  about:blank >/tmp/chrome-materi.log 2>&1 &)

for _ in $(seq 1 20); do
  curl -s -o /dev/null http://127.0.0.1:9333/json/version && break
  sleep 1
done

node "$ROOT/docs/smoke-ui-materi.mjs"
ST=$?
echo "hasil smoke: $ST"
exit $ST
