# Jurnal Prompt

Jurnal penggunaan prompt AI (maksimal 5 entri) — M-ONE Telkomsel Coding Competition.
Log mentah setiap entri tersedia di `docs/log-mentah/`.

---

## Prompt 1 — Struktur project + dokumen acuan + slice 00

- **Tanggal/jam**: 5 Oktober 2026, ± 14.30–15.30 WIB
- **Permintaan**: Membuat folder project beserta instalasi seluruh kebutuhan (backend, frontend, realtime) dalam satu main folder, lalu menuruti prompt acuan: Tahap A (dokumen acuan AI agent: AGENT.md, 00-index.json, chunk_map.json, chunks/, docs/, ekspor Word) dan Tahap B (scaffold monorepo + slice 00). Belum ada fitur yang dikerjakan.
- **Hasil**: Main folder `lomba_m` berisi `backend/` (Laravel + Sanctum + spatie×3 + league/csv + Pest), `frontend/` (Vite React + seluruh dependensi stack), `realtime/` (Fastify + ioredis, ESM), dokumen acuan lengkap, pagar mutu (`verify.sh`), tema + icons + toast, README.
- **Catatan kendala**: satu percobaan `composer create-project` latar belakang mati tanpa log lalu diulang sinkron (berhasil); satu perintah npm gagal 404 karena salah nama paket `@tanstack/query` dan diperbaiki menjadi `@tanstack/react-query`; dua kali broker terminal gagal sementara (`posix_spawn bash`) lalu berhasil saat diulang.
