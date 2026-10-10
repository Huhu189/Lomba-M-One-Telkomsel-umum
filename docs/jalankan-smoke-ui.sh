#!/usr/bin/env bash
#
# jalankan-smoke-ui.sh <nama-harness> — nyalakan layanan yang dibutuhkan satu
# harness smoke UI, jalankan `docs/smoke-ui-<nama>.mjs`, lalu matikan semuanya.
#
# Dipakai supaya smoke yang butuh beberapa layanan bisa dijalankan sebagai satu
# perintah SYNC: proses latar milik shell perintah ikut mati begitu perintahnya
# berakhir, jadi semuanya harus hidup di dalam satu proses shell seperti ini.
#
# Contoh:
#   docs/jalankan-smoke-ui.sh slice06
#   docs/jalankan-smoke-ui.sh slice07
#
set -u
NAMA="${1:-}"
if [ -z "$NAMA" ]; then
  echo "pakai: $0 <nama-harness>   (contoh: slice06)"
  exit 1
fi

cd "$(dirname "$0")/.." || exit 1
ROOT="$(pwd)"
HARNESS="$ROOT/docs/smoke-ui-$NAMA.mjs"
[ -f "$HARNESS" ] || { echo "harness tidak ada: $HARNESS"; exit 1; }

( cd "$ROOT/backend" && exec php artisan serve --host=127.0.0.1 --port=8000 ) >/tmp/srv-b.log 2>&1 &
B=$!
( cd "$ROOT/frontend" && exec node node_modules/vite/bin/vite.js --host --port 5173 --strictPort ) >/tmp/srv-f.log 2>&1 &
F=$!
( cd "$ROOT/realtime" && exec node src/server.js ) >/tmp/srv-r.log 2>&1 &
R=$!
( cd "$ROOT/backend" && exec php artisan queue:work --stop-when-empty --tries=1 ) >/tmp/srv-q.log 2>&1 &
Q=$!

bersihkan() {
  kill "$B" "$F" "$R" "$Q" 2>/dev/null
  pkill -f "remote-debugging-port=9333" 2>/dev/null
  pkill -f "artisan serve" 2>/dev/null
}
trap bersihkan EXIT

siap=0
for _ in $(seq 1 30); do
  v=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/ || true)
  b=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8000/sanctum/csrf-cookie || true)
  r=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4000/health || true)
  if [ "$v" = "200" ] && [ "$b" != "000" ] && [ "$r" = "200" ]; then siap=1; break; fi
  sleep 1
done
if [ "$siap" != "1" ]; then
  echo "layanan tidak siap: vite=$v backend=$b realtime=$r"
  tail -5 /tmp/srv-b.log /tmp/srv-f.log /tmp/srv-r.log
  exit 1
fi
echo "layanan siap: vite=$v backend=$b realtime=$r"

("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-first-run --no-proxy-server \
  --remote-debugging-port=9333 --user-data-dir="/tmp/chrome-smoke-$NAMA" \
  --autoplay-policy=no-user-gesture-required \
  about:blank >/tmp/chrome-smoke.log 2>&1 &)

for _ in $(seq 1 20); do
  curl -s -o /dev/null http://127.0.0.1:9333/json/version && break
  sleep 1
done

node "$HARNESS"
ST=$?
echo "hasil smoke $NAMA: $ST"
exit $ST
