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
