#!/usr/bin/env bash
#
# jalankan-smoke-materi.sh — nyalakan layanan yang dibutuhkan smoke pemutar materi,
# jalankan `smoke-ui-materi.mjs`, lalu matikan semuanya. Semua dalam satu proses
# shell supaya layanan tetap hidup sampai harness selesai (proses latar milik shell
# perintah akan ikut mati begitu perintahnya berakhir).
#
# Yang dibutuhkan: backend :8000, vite :5173, Chrome headless CDP :9333.
# Realtime tidak diperlukan — pemutar materi hanya memakai REST.
#
# Layanan yang SUDAH hidup (mis. dari `./nyalakan-local.sh`) dipakai apa adanya dan
# TIDAK dimatikan; runner hanya mematikan proses yang benar-benar ia nyalakan.
set -u
cd "$(dirname "$0")/.." || exit 1
ROOT="$(pwd)"

# Kolom baru `materials.rasio` perlu ada di DB dev sebelum harness jalan.
( cd "$ROOT/backend" && php artisan migrate --force ) || {
  echo "migrasi gagal"
  exit 1
}

CDP="http://127.0.0.1:9333"
HTTP_BACKEND="http://127.0.0.1:8000/sanctum/csrf-cookie"
HTTP_VITE="http://localhost:5173/"

# curl mencetak 000 sendiri saat koneksi gagal; JANGAN menambah `|| echo 000`
# (itu membuat kode gagal jadi "000000" dan pemeriksaan "!= 000" selalu lolos).
kode_http() {
  local kode
  kode="$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "$1" 2>/dev/null)"
  printf '%s' "${kode:-000}"
}
hidup_backend() { [ "$(kode_http "$HTTP_BACKEND")" != "000" ]; }
hidup_vite() { [ "$(kode_http "$HTTP_VITE")" = "200" ]; }
hidup_chrome() { curl -s -o /dev/null --max-time 2 "$CDP/json/version" 2>/dev/null; }
ada_listener_9333() { lsof -nP -iTCP:9333 -sTCP:LISTEN -t >/dev/null 2>&1; }

PIDS=()
CHROME_PID=""

bersihkan() {
  for pid in "${PIDS[@]:-}"; do
    [ -n "$pid" ] && kill "$pid" 2>/dev/null
  done
  [ -n "$CHROME_PID" ] && kill "$CHROME_PID" 2>/dev/null
  # Anak proses (npm → vite, artisan serve → php) kadang tidak ikut mati bersama induknya.
  for pid in "${PIDS[@]:-}"; do
    [ -n "$pid" ] && pkill -P "$pid" 2>/dev/null
  done
}
trap bersihkan EXIT

if hidup_backend; then
  echo "backend  :8000  sudah hidup — dipakai apa adanya"
else
  ( cd "$ROOT/backend" && exec php artisan serve --host=127.0.0.1 --port=8000 ) >/tmp/srv-materi-b.log 2>&1 &
  PIDS+=($!)
fi

if hidup_vite; then
  echo "frontend :5173  sudah hidup — dipakai apa adanya"
else
  ( cd "$ROOT/frontend" && exec node node_modules/vite/bin/vite.js --host --port 5173 --strictPort ) >/tmp/srv-materi-f.log 2>&1 &
  PIDS+=($!)
fi

siap=0
for _ in $(seq 1 30); do
  v=$(kode_http "$HTTP_VITE")
  b=$(kode_http "$HTTP_BACKEND")
  if [ "$v" = "200" ] && [ "$b" != "000" ]; then siap=1; break; fi
  sleep 1
done
if [ "$siap" != "1" ]; then
  echo "layanan tidak siap: vite=$v backend=$b"
  tail -5 /tmp/srv-materi-b.log /tmp/srv-materi-f.log 2>/dev/null
  exit 1
fi
echo "layanan siap: vite=$v backend=$b"

# Chrome satu run biasanya belum benar-benar keluar saat run berikutnya mulai
# (proses anaknya masih memegang :9333 beberapa detik). Chrome baru lalu hidup
# TANPA memegang port debug, dan harness-nya hanya mencetak "fetch failed".
nyalakan_chrome() {
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    --headless --disable-gpu --no-first-run --no-proxy-server \
    --remote-debugging-port=9333 --user-data-dir=/tmp/chrome-smoke-materi \
    --autoplay-policy=no-user-gesture-required --mute-audio \
    about:blank >/tmp/chrome-materi.log 2>&1 &
  CHROME_PID=$!

  for _ in $(seq 1 25); do
    hidup_chrome && return 0
    sleep 1
  done
  return 1
}

bersihkan_9333_bisu() {
  # Listener ada tapi CDP tidak menjawab = sisa Chrome yang separuh mati.
  for _ in $(seq 1 10); do
    ada_listener_9333 || return 0
    hidup_chrome && return 1
    sleep 1
  done
  pkill -f "remote-debugging-port=9333" 2>/dev/null
  sleep 1
  return 0
}

if hidup_chrome; then
  echo "chrome   :9333  sudah hidup — dipakai apa adanya"
else
  if ! bersihkan_9333_bisu; then
    echo "chrome   :9333  sudah hidup — dipakai apa adanya"
  elif nyalakan_chrome || { echo "   (Chrome pertama tidak memegang :9333 — mencoba sekali lagi)"; nyalakan_chrome; }; then
    echo "chrome   :9333  siap"
  else
    echo "chrome   :9333  GAGAL dipakai (CDP tidak menjawab) — log terakhir:"
    tail -5 /tmp/chrome-materi.log 2>/dev/null
    exit 1
  fi
fi

node "$ROOT/docs/smoke-ui-materi.mjs"
ST=$?
echo "hasil smoke: $ST"
exit $ST
