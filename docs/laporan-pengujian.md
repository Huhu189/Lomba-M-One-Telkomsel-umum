# Laporan Pengujian

Diperbarui: 5 Oktober 2026 (sesi prompt 2 — revisi dokumen acuan).

## A. Sudah dijalankan (dengan perintah dan hasil)

### A.1 Pagar mutu slice 00 — `./verify.sh`
- Waktu: 2026-10-05 18:13:51 WIB (dari root repo).
- Hasil: **SEMUA HIJAU** —
  Backend Pest OK · Backend Pint OK · Frontend checkJs OK · Frontend ESLint OK ·
  Frontend Vitest OK · Realtime node --test OK.
- Catatan: dijalankan sekali untuk pelaporan (prompt v2 Tahap 1); setelahnya hanya
  dokumen yang diubah — tidak ada kode aplikasi yang disentuh.

### A.2 Validasi JSON (dijalankan, hasil: lolos)
Perintah: skrip Python (json.load semua berkas; periksa skema chunk; periksa
`depends_on`/`loads` merujuk id yang ada; periksa `slice_order` di chunk_map; periksa
daftar chunk di 00-index).
Hasil: `SEMUA JSON VALID; semua referensi ada.` — mencakup perubahan prompt 2:
`chunk_map.json` (journal_plan), `chunks/rules-lomba.json`, `chunks/slice-04.json`,
`chunks/slice-08.json`, `00-index.json` (penjelasan-fitur.md + word-arsip).

### A.3 Validasi struktur hasil ekspor Word (dijalankan, hasil: lolos)
Perintah: skrip Python — daftar isi `docs/word/` dan `docs/word-arsip/`, cek berkas
wajib, cek awalan `(ARSIP) `, buka tiap .docx dengan python-docx dan hitung paragraf.
Hasil:
- `docs/word/`: `AGENT.docx` ✓, `log-mentah.docx` ✓ (tepat 2 berkas).
- `docs/word-arsip/`: 6 berkas `(ARSIP) ...` ✓.
- Semua .docx terbuka dan berisi paragraf (tidak korup).

## B. Ditulis tetapi belum dijalankan (jujur)

- Ekspor Word versi baru dijalankan sekali saat pembuatan (output OK, 8 berkas .docx),
  tetapi **belum dijalankan ulang setelah commit akhir** — jalankan ulang
  `./docs/export-word.sh` tiap akhir slice berikutnya.
- Smoke run aplikasi (backend/frontend/realtime hidup bersamaan) terakhir dilakukan
  pada sesi prompt 1 (slice 00), **bukan** pada sesi ini — sesi ini tidak menyentuh kode.
- `verify.sh` belum dijalankan ulang setelah perubahan dokumen (perubahan dokumen tidak
  memengaruhi test, tetapi dilaporkan apa adanya).

## C. Yang memang tidak diuji di sesi ini

- Fitur F2 (materi berblok + kuis sisipan): baru sebatas dokumen acuan — test-nya baru
  akan ada pada slice-08 (lihat chunks/slice-08.json bagian tests).
- Slice 01 ke atas: belum dikerjakan (sesuai batasan prompt v2).

---

## A.4 Slice 02 — Sekolah, Kelas, Mapel, Murid, Impor/Ekspor CSV, Pengaturan Tiga Lapis

Diperbarui: 2026-10-06 04:54 WIB.

### A.4.1 Pagar mutu — `./verify.sh` (dari root repo)

Hasil: **SEMUA HIJAU** —
- Backend Pest: **43 passed (183 assertions)** (21 auth slice 01 + 1 health + 8 sekolah + 7 impor + 6 pengaturan).
- Backend Pint: PASS (99 berkas).
- Frontend checkJs (`tsc --noEmit`): OK.
- Frontend ESLint: OK.
- Frontend Vitest: **37 passed (9 berkas)**.
- Realtime `node --test`: 2 passed.

### A.4.2 Test baru slice 02

- `backend/tests/Feature/SekolahTest.php` (8): policy murid hanya-baca; CRUD kelas/mapel/murid oleh guru; validasi tingkat 1–6 & nama kelas unik; update sekolah; 401 JSON untuk API non-JSON.
- `backend/tests/Feature/ImporMuridTest.php` (7): impor valid 2 baris; laporan galat per baris; batas 100 galat + `dihentikan`; upsert 500 baris dalam batch (idempoten, tetap 500); ekspor mengamankan sel `= + - @`; kolom wajib hilang → 422; murid tidak boleh impor → 403.
- `backend/tests/Feature/PengaturanTest.php` (6): nilai bawaan; guru set lalu murid melihat; resolusi kuis > kelas > sekolah + lock sekolah; invalidasi cache; murid tidak boleh ubah → 403; tipe nilai salah → 422.
- `backend/tests/Arch/ArchitectureTest.php`: +1 arch "controller tidak memanggil fasade DB" (5 passed).
- Vitest baru: `school/validasi.test.js` (7), `school/impor.test.js` (5), `settings/api.test.js` (2).

### A.4.3 Smoke run nyata via curl (HTTP, backend dev `:8000`)

Dijalankan dengan cookie jar + CSRF + header `Origin` (Sanctum stateful):
1. `POST /api/v1/auth/masuk` admin → 200.
2. `POST /api/v1/murid/impor` (berkas `database/data/contoh-murid.csv`) → 200, `sukses: 4, gagal: 0`.
3. `GET /api/v1/murid` → 4 murid pada kelas 6A/6B/5A.
4. `GET /api/v1/murid/ekspor` → 200 `text/csv`, `Content-Disposition: attachment`, header `nis,nisn,nama,email,kelas`.
5. `PUT /api/v1/pengaturan` retry=false (sekolah) → tersimpan; `GET` melihat `sumber: sekolah`.
6. Login murid (hasil impor dengan kolom `kata_sandi`) → `GET /api/v1/pengaturan` retry=false; `PUT` → **403**; `GET /api/v1/murid/ekspor` → 200 (baca boleh).
7. `GET /api/v1/murid/ekspor` tanpa sesi, Accept non-JSON → **401 JSON** (sebelumnya 500 "Route [login] not defined" — diperbaiki).

### A.4.4 Keputusan teknis slice 02 (jujur)

- Hashing: produksi tetap **Argon2id** (`HASH_DRIVER=argon2id`); test memakai bcrypt rounds 4 lewat `tests/TestCase.php` agar impor 500 baris cepat (78 detik → 1,5 detik). Tidak ada test/assertion yang dilemahkan.
- `User` diberi trait `HasApiTokens` (standar Sanctum) agar `Sanctum::actingAs` bisa dipakai di test; aplikasi tetap memakai sesi cookie tanpa token di localStorage.
- `email_verified_at` tidak mass-assignable; service impor/tambah murid memakai `forceFill` (akun dibuat guru/admin = terverifikasi).
- Rute API kini selalu 401 JSON untuk tamu (termasuk unduhan non-JSON) lewat `redirectGuestsTo` + render `AuthenticationException`.
