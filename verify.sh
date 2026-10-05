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
