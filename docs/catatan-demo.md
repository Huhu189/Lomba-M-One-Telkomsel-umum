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

---

## Demo Slice 02 — Sekolah, Kelas, Mapel, Murid, Impor/Ekspor CSV, Pengaturan Tiga Lapis

Prasyarat: backend `php artisan serve` (port 8000) dan frontend `npm run dev` (port 5173) hidup; database sudah di-seed:

```bash
cd backend && php artisan migrate:fresh --seed
```

Seeder membuat sekolah contoh, 3 kelas (6A/6B/5A), 3 mapel, dan akun admin `admin@sekolah.test` / `Passw0rd!Aman`.

### Langkah demo (antarmuka http://localhost:5173)

1. Masuk sebagai guru/admin (`admin@sekolah.test`). Menu **Kelas · Mapel · Murid · Pengaturan** muncul (hanya guru/admin).
2. **Kelas**: tambah "4A" tingkat 4 → muncul di tabel; ubah/hapus berfungsi.
3. **Mapel**: tambah "Seni Budaya" kode SBD.
4. **Murid → Impor CSV**: unggah `backend/database/data/contoh-murid.csv` → laporan "4 baris berhasil diimpor, 0 baris gagal". Coba berkas dengan email salah / kelas tidak ada → muncul laporan galat per baris (maks 100 baris).
5. **Murid → Ekspor CSV**: tautan Ekspor mengunduh CSV (kolom `nis,nisn,nama,email,kelas`).
6. **Pengaturan**: nonaktifkan "Izinkan ulangan ulang (retry)" di lapis **Sekolah**; pilih lapis **Kelas** → nilai kelas menimpa sekolah; centang **"Kunci di sekolah"** → nilai sekolah menang.
7. Masuk sebagai murid hasil impor (impor dengan kolom `kata_sandi`) → murid melihat pengaturan yang berlaku, tetapi tidak bisa mengubahnya.

### Bukti lewat API (curl)

Lihat `docs/laporan-pengujian.md` bagian A.4.3 — smoke nyata: csrf → login admin → impor 4 murid → daftar → ekspor CSV → set pengaturan → login murid → murid melihat `retry=false` → murid ubah = 403.
