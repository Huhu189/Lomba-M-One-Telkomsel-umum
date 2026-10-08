#!/usr/bin/env bash
# Rangkaian bukti visual editor materi: nyalakan backend+vite, Chrome headless,
# jalankan tangkap-editor-materi.mjs, lalu matikan semuanya. Semua dalam satu
# proses shell supaya layanan tetap hidup sampai tangkapan selesai.
set -u
cd "$(dirname "$0")/.." || exit 1
ROOT="$(pwd)"

cd "$ROOT/backend" && php artisan serve --port=8000 >/tmp/srv-b.log 2>&1 &
B=$!
cd "$ROOT"
(cd "$ROOT/frontend" && exec node node_modules/vite/bin/vite.js --host --port 5173 --strictPort) >/tmp/srv-f.log 2>&1 &
F=$!

bersihkan() {
  kill "$B" "$F" 2>/dev/null
  pkill -f "remote-debugging-port=9333" 2>/dev/null
  pkill -f "artisan serve" 2>/dev/null
}
trap bersihkan EXIT

# Tunggu kedua layanan siap (maks 30 detik).
siap=0
for i in $(seq 1 30); do
  v=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/ || true)
  b=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8000/sanctum/csrf-cookie || true)
  if [ "$v" = "200" ] && [ "$b" != "000" ]; then siap=1; break; fi
  sleep 1
done
if [ "$siap" != "1" ]; then
  echo "layanan tidak siap: vite=$v backend=$b"
  tail -5 /tmp/srv-b.log /tmp/srv-f.log
  exit 1
fi
echo "layanan siap: vite=200 backend=$b"

("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-first-run --no-proxy-server \
  --remote-debugging-port=9333 --user-data-dir=/tmp/chrome-editor-materi \
  about:blank >/tmp/chrome-editor.log 2>&1 &)

# Tunggu CDP siap.
for i in $(seq 1 20); do
  curl -s -o /dev/null http://127.0.0.1:9333/json/version && break
  sleep 1
done

node "$ROOT/docs/tangkap-editor-materi.mjs"
ST=$?
echo "hasil tangkap: $ST"
exit $ST
