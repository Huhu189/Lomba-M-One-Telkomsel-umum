# Catatan Demo

Cara menjalankan dan mendemokan aplikasi pada setiap akhir slice.
Semua perintah dijalankan dari root repo `lomba_m`.

## Menjalankan ketiga layanan (slice 00)

```bash
# 1. Backend (Laravel, http://localhost:8000)
cd backend && php artisan serve

# 2. Frontend (Vite, http://localhost:5173)
cd frontend && npm run dev

# 3. Realtime (Fastify + SSE, http://localhost:4000)
cd realtime && npm run dev
```

Pemeriksaan kesehatan:
- Backend: `curl http://localhost:8000/api/health` → JSON `{"ok":true,...}`
- Frontend: buka http://localhost:5173 → halaman demo tema + toast + ikon
- Realtime: `curl http://localhost:4000/health` → JSON `{"ok":true,...}`

## Pagar mutu

```bash
./verify.sh   # dari root repo; wajib hijau tiap akhir slice
```

## Demo per slice (rencana)

- **Slice 00**: ketiga layanan hidup; halaman demo tema (palet guru/murid, mode terang), toast, ikon SVG; hasil verify hijau.
- **Slice 01**: daftar + verifikasi email + login murid; guru dari seeder; proteksi throttle dan enumerasi.
- **Slice 02**: kelola kelas/mapel/murid; impor CSV contoh; ubah pengaturan tiga lapis.
- **Slice 03**: buat bank soal + kuis; editor soal objektif dengan preview MathML.
- **Slice 04**: kerjakan kuis penuh sampai hasil (pengacakan, autosave, submit idempoten, deadline).
- **Slice 05**: retry, ranking, badge, remedial, laporan per tag.
- **Slice 06**: koreksi manual isian/uraian dengan token konfirmasi.
- **Slice 07**: Live Monitor SSE + presence + proteksi anti-cheat aktif.
- **Slice 08**: unggah materi, layar guru ke murid, avatar + laporan.
- **Slice 09**: upload jawaban (gambar/rekam/file), saran penilaian AI, mode tim.
- **Slice 10**: cache L1, mode gelap, Octane Swoole, demo dari link deploy VPS.
