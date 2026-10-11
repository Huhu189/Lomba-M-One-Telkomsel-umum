#!/usr/bin/env bash
#
# nyalakan-local.sh — nyalakan seluruh layanan pengembangan dalam satu perintah,
# TANPA menghapus data.
#
# Kenapa skrip ini ada: prosedur lama memakai `php artisan migrate:fresh --seed`
# (lihat docs/catatan-demo.md). Perintah itu MENGHAPUS seluruh tabel — termasuk
# tabel `sessions` — jadi setiap kali local dinyalakan, semua sesi login mati dan
# pengguna wajib login ulang. Skrip ini memakai `migrate` (bukan `migrate:fresh`)
# dan hanya menyemai saat basis data masih kosong, sehingga sesi login tetap
# hidup di antara restart.
#
# Pemakaian:
#   ./nyalakan-local.sh          # nyalakan Redis + backend + realtime + frontend
#   ./nyalakan-local.sh status   # cek kesehatan keempatnya
#   ./nyalakan-local.sh stop     # matikan semuanya
#
set -uo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
LOKAL="$ROOT/.local"
LOG="$LOKAL/log"
PID="$LOKAL/pid"

BACKEND_PORT="${BACKEND_PORT:-8000}"
REALTIME_PORT="${REALTIME_PORT:-4000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

inf()   { printf '\033[36m%s\033[0m\n' "$*"; }
baik()  { printf '\033[32m%s\033[0m\n' "$*"; }
buruk() { printf '\033[31m%s\033[0m\n' "$*"; }

mkdir -p "$LOG" "$PID"

ada_port() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

# ---- stop ----------------------------------------------------------------
hentikan() {
  inf "Mematikan layanan local…"
  for nama in backend realtime frontend; do
    if [ -f "$PID/$nama.pid" ]; then
      kill "$(cat "$PID/$nama.pid")" 2>/dev/null || true
      rm -f "$PID/$nama.pid"
    fi
  done
  # Sapu sisa proses yang masih memegang port (anak proses artisan/npm).
  for port in "$BACKEND_PORT" "$REALTIME_PORT" "$FRONTEND_PORT"; do
    for p in $(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null); do
      kill "$p" 2>/dev/null || true
    done
  done
  sleep 1
  baik "Selesai."
}

# ---- status --------------------------------------------------------------
status() {
  if redis-cli ping >/dev/null 2>&1; then baik "  redis    :6379  HIDUP"; else buruk "  redis    :6379  MATI"; fi
  for pasangan in "backend:$BACKEND_PORT" "realtime:$REALTIME_PORT" "frontend:$FRONTEND_PORT"; do
    nama="${pasangan%%:*}"; port="${pasangan##*:}"
    if ada_port "$port"; then baik "  $nama  :$port  HIDUP"; else buruk "  $nama  :$port  MATI"; fi
  done
}

# ---- start ---------------------------------------------------------------
nyalakan_redis() {
  if redis-cli ping >/dev/null 2>&1; then
    baik "Redis sudah hidup."
    return 0
  fi

  inf "Redis belum hidup — menyalakan redis-server…"
  redis-server --daemonize yes >/dev/null 2>&1 || true

  for _ in $(seq 1 25); do
    if redis-cli ping >/dev/null 2>&1; then
      baik "Redis hidup."
      return 0
    fi
    sleep 0.2
  done

  buruk "Gagal menyalakan Redis. Jalankan 'redis-server' sendiri lalu ulangi."
  return 1
}

siapkan_backend() {
  cd "$ROOT/backend" || return 1

  if [ ! -f .env ]; then
    inf "backend/.env belum ada — menyalin dari .env.example…"
    cp .env.example .env
    php artisan key:generate --force >/dev/null 2>&1 || true
  fi

  [ -f database/database.sqlite ] || touch database/database.sqlite

  # `migrate` — BUKAN `migrate:fresh`. Data & sesi yang ada tidak disentuh.
  if ! php artisan migrate --force >"$LOG/migrate.log" 2>&1; then
    buruk "Migrasi gagal — lihat $LOG/migrate.log"
    return 1
  fi

  # Semai HANYA bila basis data masih kosong. Seeder-nya idempoten, tetapi pagar
  # ini menjaga data demo yang sengaja kamu ubah/hapus tidak muncul kembali.
  lokal_users="$(php artisan tinker --execute='echo \Illuminate\Support\Facades\DB::table("users")->count();' 2>/dev/null | tr -dc '0-9')"
  if [ "${lokal_users:-1}" = "0" ]; then
    inf "Basis data kosong — menjalankan seeder contoh…"
    php artisan db:seed --force >"$LOG/seed.log" 2>&1 || buruk "Seeder gagal — lihat $LOG/seed.log"
  fi

  baik "Backend siap (migrasi saja, data & sesi dipertahankan)."
}

jalankan() { # nama port perintah...
  local nama="$1" port="$2"; shift 2
  if ada_port "$port"; then
    baik "$nama sudah hidup di port ${port}."
    return 0
  fi
  inf "Menyalakan $nama di port ${port}…"
  nohup "$@" >"$LOG/$nama.log" 2>&1 &
  echo $! >"$PID/$nama.pid"
}

tunggu() { # port
  for _ in $(seq 1 60); do
    ada_port "$1" && return 0
    sleep 0.5
  done
  return 1
}

mulai() {
  nyalakan_redis || exit 1
  siapkan_backend || exit 1

  jalankan backend  "$BACKEND_PORT"  php "$ROOT/backend/artisan" serve --port="$BACKEND_PORT"
  jalankan realtime "$REALTIME_PORT" env PORT="$REALTIME_PORT" node "$ROOT/realtime/src/server.js"
  jalankan frontend "$FRONTEND_PORT" npm --prefix "$ROOT/frontend" run dev -- --port "$FRONTEND_PORT"

  echo
  gagal=0
  for pasangan in "backend:$BACKEND_PORT" "realtime:$REALTIME_PORT" "frontend:$FRONTEND_PORT"; do
    nama="${pasangan%%:*}"; port="${pasangan##*:}"
    if tunggu "$port"; then baik "  $nama  :$port  SIAP"; else buruk "  $nama  :$port  GAGAL (lihat $LOG/$nama.log)"; gagal=1; fi
  done

  echo
  if [ "$gagal" -eq 0 ]; then
    baik "Local menyala. Buka http://localhost:$FRONTEND_PORT"
    inf  "Login dev: admin@sekolah.test / Passw0rd!Aman · guru1@sekolah.test / password12"
    inf  "Log: $LOG · Matikan: ./nyalakan-local.sh stop"
  else
    buruk "Ada layanan yang gagal menyala. Periksa log di $LOG."
    exit 1
  fi
}

case "${1:-start}" in
  start|"") mulai ;;
  stop)     hentikan ;;
  status)   status ;;
  *)        echo "Pemakaian: $0 [start|stop|status]" >&2; exit 2 ;;
esac
