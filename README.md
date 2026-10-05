# Ulangan Sekolah — Monorepo Slice 00

Platform ulangan/form online untuk sekolah (M-ONE Telkomsel Coding Competition).
Struktur monorepo: `backend/` (Laravel), `frontend/` (React + Vite), `realtime/` (Fastify + SSE).

## Menjalankan (dev)

```bash
# 1. Backend — http://localhost:8000
cd backend && php artisan serve

# 2. Frontend — http://localhost:5173 (proxy /api & /sanctum ke backend, /sse ke realtime)
cd frontend && npm run dev

# 3. Realtime — http://localhost:4000
cd realtime && npm run dev
```

Cek kesehatan:
- Backend: `curl http://localhost:8000/api/v1/health`
- Frontend: buka http://localhost:5173 (halaman demo tema/toast/ikon)
- Realtime: `curl http://localhost:4000/health` dan `/ready`

## Pagar mutu

```bash
./verify.sh
```

Menjalankan: Pest (backend), Pint `--test`, `tsc` checkJs strict, ESLint, Vitest, `node --test` (realtime). Wajib hijau di akhir setiap slice.

## Catatan

- Database dev/test: SQLite in-memory (`phpunit.xml`); produksi: MySQL di VPS (slice 10).
- Auth mode SPA: cookie sesi Sanctum; tanpa token di localStorage. `SANCTUUM_STATEFUL_DOMAINS=localhost:5173`.
- Password hashing: Argon2id (`HASH_DRIVER=argon2id`).
- Realtime tanpa akses database; Redis lazy + fail-open.
- Dokumen acuan AI agent: `AGENT.md`, `chunk_map.json`, `chunks/`, `docs/`.
