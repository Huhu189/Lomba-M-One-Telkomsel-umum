#!/usr/bin/env bash
#
# verify.sh — pagar mutu (chunk quality-gates).
# Menjalankan seluruh pemeriksaan; wajib hijau di akhir setiap slice.
#
set -uo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
GAGAL=0

jalankan() {
  local nama="$1"; shift
  echo ""
  echo "=== ${nama} ==="
  if ( cd "$ROOT" && "$@" ); then
    echo ">>> OK: ${nama}"
  else
    echo ">>> GAGAL: ${nama}"
    GAGAL=1
  fi
}

jalankan "Backend Pest"        bash -c "cd backend && php artisan test"

# Jalur Redis tidak boleh di-skip.
#
# Presence (P-02) dan kontrak kunci/kanal SSE dibuktikan di Redis SUNGGUHAN, dan
# kedua berkas itu melewati dirinya sendiri (skip) bila Redis mati — exit
# code-nya tetap 0. Tanpa langkah ini, "SEMUA HIJAU" bisa berarti jalur presence
# + SSE tidak pernah diuji sama sekali.
#
# `REDIS_WAJIB=1` membuat skip menjadi GAGAL keras (lihat tests/Pest.php).
# Nyalakan Redis dulu (`redis-server`) — atau biarkan langkah ini MERAH dengan
# sadar, karena merah di sini berarti benar: jalur Redis tidak terbukti.
jalankan "Backend Redis wajib" bash -c "cd backend && REDIS_WAJIB=1 php artisan test --filter='PresenceRedisTest|SseKontrakRedisTest'"

jalankan "Backend Pint"        bash -c "cd backend && ./vendor/bin/pint --test"
jalankan "Frontend checkJs"    bash -c "cd frontend && npm run check"
jalankan "Frontend ESLint"     bash -c "cd frontend && npm run lint"
jalankan "Frontend Vitest"     bash -c "cd frontend && npm run test"
jalankan "Realtime node --test" bash -c "cd realtime && npm test"

echo ""
if [ "$GAGAL" -eq 0 ]; then
  echo "verify.sh: SEMUA HIJAU"
  exit 0
else
  echo "verify.sh: ADA YANG GAGAL"
  exit 1
fi
