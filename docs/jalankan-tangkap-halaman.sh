#!/usr/bin/env bash
#
# jalankan-tangkap-halaman.sh — nyalakan layanan yang dibutuhkan, jalankan
# docs/tangkap-semua-halaman.mjs, lalu bungkus semua PNG jadi satu ZIP di Desktop.
#
# Semua proses latar hidup di dalam satu proses shell ini supaya ikut mati saat
# perintah berakhir (proses latar milik shell perintah tidak bertahan setelah
# tool selesai).
#
# Pemakaian:
#   docs/jalankan-tangkap-halaman.sh
#
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
ROOT="$(pwd)"

TMP="$(mktemp -d /tmp/tangkapan-halaman-XXXXXX)"
KELUARAN="$TMP/tangkapan-halaman-lomba-m"
mkdir -p "$KELUARAN"
NAMA_ZIP="${NAMA_ZIP:-tangkapan-halaman-lomba-m-$(date +%Y-%m-%d)}"
DEST="$HOME/Desktop/$NAMA_ZIP.zip"

( cd "$ROOT/backend" && exec php artisan serve --host=127.0.0.1 --port=8000 ) >/tmp/tangkao-b.log 2>&1 &
B=$!
( cd "$ROOT/frontend" && exec node node_modules/vite/bin/vite.js --host --port 5173 --strictPort ) >/tmp/tangkao-f.log 2>&1 &
F=$!
( cd "$ROOT/realtime" && exec node src/server.js ) >/tmp/tangkao-r.log 2>&1 &
R=$!

bersihkan() {
  kill "$B" "$F" "$R" 2>/dev/null
  pkill -f "remote-debugging-port=9333" 2>/dev/null
  pkill -f "artisan serve" 2>/dev/null
}
trap bersihkan EXIT

siap=0
for _ in $(seq 1 40); do
  v=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/ || true)
  b=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8000/sanctum/csrf-cookie || true)
  r=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4000/health || true)
  if [ "$v" = "200" ] && [ "$b" != "000" ] && [ "$r" = "200" ]; then siap=1; break; fi
  sleep 1
done
if [ "$siap" != "1" ]; then
  echo "layanan tidak siap: vite=$v backend=$b realtime=$r"
  tail -5 /tmp/tangkao-b.log /tmp/tangkao-f.log /tmp/tangkao-r.log
  exit 1
fi
echo "layanan siap: vite=$v backend=$b realtime=$r"

# Profil Chrome dibuang lebih dulu: sisa sesi login dari tangkapan sebelumnya
# membuat halaman tamu (/masuk, /daftar, /lupa-sandi) dialihkan ke Beranda.
rm -rf /tmp/chrome-tangkapan
("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-first-run --no-proxy-server \
  --remote-debugging-port=9333 --user-data-dir="/tmp/chrome-tangkapan" \
  --autoplay-policy=no-user-gesture-required --mute-audio \
  about:blank >/tmp/chrome-tangkapan.log 2>&1 &)

for _ in $(seq 1 25); do
  curl -s -o /dev/null http://127.0.0.1:9333/json/version && break
  sleep 1
done

node "$ROOT/docs/tangkap-semua-halaman.mjs" "$KELUARAN"
ST=$?

jumlah=$(find "$KELUARAN" -name '*.png' | wc -l | tr -d ' ')
echo "tangkapan terkumpul: $jumlah"

if [ "$jumlah" = "0" ]; then
  echo "tidak ada tangkapan — batal zip"
  exit 1
fi

rm -f "$DEST"
( cd "$TMP" && zip -q -r "$DEST" "$(basename "$KELUARAN")" )
Z=$?
echo "zip: $DEST (exit $Z)"
ls -lh "$DEST"

if [ "$ST" != "0" ]; then echo "harness melaporkan halaman gagal (exit $ST)"; exit "$ST"; fi
exit "$Z"
