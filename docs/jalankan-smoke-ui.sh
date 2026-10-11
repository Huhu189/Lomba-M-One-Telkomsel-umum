#!/usr/bin/env bash
#
# jalankan-smoke-ui.sh <nama-harness> — nyalakan layanan yang dibutuhkan satu
# harness smoke UI, jalankan `docs/smoke-ui-<nama>.mjs`, lalu matikan semuanya.
#
# Dipakai supaya smoke yang butuh beberapa layanan bisa dijalankan sebagai satu
# perintah SYNC: proses latar milik shell perintah ikut mati begitu perintahnya
# berakhir, jadi semuanya harus hidup di dalam satu proses shell seperti ini.
#
# Layanan yang SUDAH hidup tidak disentuh: kalau kamu sudah menyalakan
# `./nyalakan-local.sh` (backend :8000, realtime :4000, frontend :5173), skrip
# ini memakai yang ada dan hanya menyalakan Chrome miliknya sendiri. Sebaliknya
# kalau belum ada apa-apa, ia menyalakan backend + vite + realtime + queue
# worker + Chrome sendiri seperti biasa — dan hanya mematikan proses yang
# benar-benar ia nyalakan.
#
# Contoh:
#   docs/jalankan-smoke-ui.sh slice06
#   docs/jalankan-smoke-ui.sh tamu      # mode tamu + kode perangkat
#
set -u
NAMA="${1:-}"
if [ -z "$NAMA" ]; then
  echo "pakai: $0 <nama-harness>   (contoh: slice06 · lihat docs/smoke-ui-*.mjs)"
  exit 1
fi

cd "$(dirname "$0")/.." || exit 1
ROOT="$(pwd)"
HARNESS="$ROOT/docs/smoke-ui-$NAMA.mjs"
[ -f "$HARNESS" ] || { echo "harness tidak ada: $HARNESS"; exit 1; }

CDP="http://127.0.0.1:9333"
HTTP_BACKEND="http://127.0.0.1:8000/sanctum/csrf-cookie"
HTTP_VITE="http://localhost:5173/"
HTTP_REALTIME="http://127.0.0.1:4000/health"

# curl mencetak 000 sendiri saat koneksi gagal; JANGAN menambah `|| echo 000`
# (dulu itu membuat kode gagal jadi "000000" dan pemeriksaan "!= 000" selalu lolos).
kode_http() {
  local kode
  kode="$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "$1" 2>/dev/null)"
  printf '%s' "${kode:-000}"
}
hidup_backend() { [ "$(kode_http "$HTTP_BACKEND")" != "000" ]; }
hidup_vite() { [ "$(kode_http "$HTTP_VITE")" = "200" ]; }
hidup_realtime() { [ "$(kode_http "$HTTP_REALTIME")" = "200" ]; }
hidup_chrome() { curl -s -o /dev/null --max-time 2 "$CDP/json/version" 2>/dev/null; }
ada_listener_9333() { lsof -nP -iTCP:9333 -sTCP:LISTEN -t >/dev/null 2>&1; }

# PID proses yang kita nyalakan sendiri — hanya ini yang dimatikan nanti.
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

# ---- 1. Layanan: pakai yang sudah hidup, nyalakan sisanya -------------------
if hidup_backend; then
  echo "backend  :8000  sudah hidup — dipakai apa adanya"
else
  ( cd "$ROOT/backend" && exec php artisan serve --host=127.0.0.1 --port=8000 ) >/tmp/srv-b.log 2>&1 &
  PIDS+=($!)
fi

if hidup_vite; then
  echo "frontend :5173  sudah hidup — dipakai apa adanya"
else
  ( cd "$ROOT/frontend" && exec node node_modules/vite/bin/vite.js --host --port 5173 --strictPort ) >/tmp/srv-f.log 2>&1 &
  PIDS+=($!)
fi

if hidup_realtime; then
  echo "realtime :4000  sudah hidup — dipakai apa adanya"
else
  ( cd "$ROOT/realtime" && exec node src/server.js ) >/tmp/srv-r.log 2>&1 &
  PIDS+=($!)
fi

# Queue worker selalu dijalankan sendiri: `--stop-when-empty` membuatnya keluar
# saat antrean kosong, jadi ia tidak pernah menabrak apa pun yang sudah hidup.
( cd "$ROOT/backend" && exec php artisan queue:work --stop-when-empty --tries=1 ) >/tmp/srv-q.log 2>&1 &

siap=0
for _ in $(seq 1 30); do
  v=$(kode_http "$HTTP_VITE")
  b=$(kode_http "$HTTP_BACKEND")
  r=$(kode_http "$HTTP_REALTIME")
  if [ "$v" = "200" ] && [ "$b" != "000" ] && [ "$r" = "200" ]; then siap=1; break; fi
  sleep 1
done
if [ "$siap" != "1" ]; then
  echo "layanan tidak siap: vite=$v backend=$b realtime=$r"
  tail -5 /tmp/srv-b.log /tmp/srv-f.log /tmp/srv-r.log 2>/dev/null
  exit 1
fi
echo "layanan siap: vite=$v backend=$b realtime=$r"

# ---- 2. Chrome --------------------------------------------------------------
# Chrome satu run biasanya belum benar-benar keluar saat run berikutnya mulai
# (proses anaknya masih memegang :9333 selama beberapa detik). Chrome yang baru
# lalu hidup TANPA memegang port debug, dan harness-nya hanya mencetak
# "fetch failed" yang tidak menjelaskan apa pun. Karena itu: tunggu port bebas →
# bersihkan sisa Chrome yang tidak menjawab CDP → nyalakan → satu kali coba ulang.
nyalakan_chrome() {
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    --headless --disable-gpu --no-first-run --no-proxy-server \
    --remote-debugging-port=9333 --user-data-dir="/tmp/chrome-smoke-$NAMA" \
    --autoplay-policy=no-user-gesture-required \
    about:blank >/tmp/chrome-smoke.log 2>&1 &
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
    tail -5 /tmp/chrome-smoke.log 2>/dev/null
    exit 1
  fi
fi

# ---- 3. Harness -------------------------------------------------------------
node "$HARNESS"
ST=$?
echo "hasil smoke $NAMA: $ST"
exit $ST
