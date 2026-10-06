# Jurnal Prompt

Jurnal penggunaan prompt AI (maksimal 5 entri — batas ini berlaku untuk entri jurnal, bukan jumlah prompt ke AI) — M-ONE Telkomsel Coding Competition.
Seluruh prompt dan jawaban (utuh, mentah, dengan tanggal-jam asli) ada di `docs/log-mentah/`; log mentah tidak disunting.

---

## Entri 1 — Struktur project, scaffold slice 00, dan penjelasan fitur

- **Waktu**: 5 Oktober 2026, ± 14.30–18.45 WIB
- **Tujuan**: membangun fondasi dari nol — dokumen acuan AI agent, monorepo (backend/frontend/realtime) dari scaffold resmi, pagar mutu, tema/icons/toast, lalu memperbarui dokumen acuan (revisi aturan jurnal, fitur F2, penjelasan fitur untuk juri/guru) dan menata ulang ekspor Word.
- **Prompt inti (ringkas)**: (a) prompt v1 — "buat struktur project + dokumen acuan + slice 00, jangan kerjakan fitur"; (b) prompt v2 — "perbarui dokumen acuan: batas 5 = entri jurnal; fitur F2 materi berblok + kuis sisipan; tulis penjelasan-fitur.md; jangan tulis kode". Kedua prompt tersimpan mentah di `log-mentah/arsip-prompt/`.
- **Hasil**: dokumen acuan lengkap (AGENT.md, 00-index.json, chunk_map.json, 18 chunk, docs/), slice 00 hijau (verify 6/6, smoke run 3 layanan OK), dokumen acuan terevisi (jurnal vs prompt, F2 di slice-08/slice-04, penjelasan-fitur.md), ekspor Word dua folder (word/ = AGENT + log-mentah; word-arsip/ = bukti revisi berawalan (ARSIP)).
- **Rujukan log mentah**: `log-mentah/2026-10-05-prompt-1.md` (14:48:54 WIB — pemeriksaan lingkungan; verify hijau 17:25 WIB; ekspor word 17:28 WIB; push awal) dan `log-mentah/2026-10-05-prompt-2.md` (verify baca-saja 18:13:51 WIB; temuan pembacaan; tiga perubahan dokumen; keputusan ekspor Word dari pengguna).

## Entri 2 — Auth, sekolah & kelas, bank soal (slice 01–03)

- **Waktu**: 5 Oktober 2026 ± 19.50 WIB sampai 6 Oktober 2026 09.50 WIB (± 14 jam kerja berselang, termasuk perbaikan pagar mutu).
- **Tujuan**: mengubah kerangka menjadi fitur asli — (1) auth lengkap (masuk, daftar, verifikasi email, lupa sandi, sesi cookie Sanctum, peran guru/admin/murid, middleware "akun layak"); (2) data induk sekolah, kelas, mapel, murid, impor & ekspor CSV, pengaturan tiga lapis (sekolah → kelas → kuis, dengan kunci sekolah); (3) bank soal + kuis + tag: enam belas berkas backend (registry empat tipe soal objektif, kebijakan akses, validasi kelengkapan publikasi, soal terkunci saat kuis berjalan) dan antarmuka guru/murid (editor soal dengan pratinjau, pengelola kuis dengan jadwal & susun soal, halaman tag, daftar ulangan murid).
- **Prompt inti (ringkas)**: (a) "mulai fitur asli" — kerjakan slice berikutnya sampai hijau, jangan lompat; (b) "lanjutkan" — slice 02 (sekolah/kelas/mapel/murid/impor CSV/pengaturan); (c) "lanjutkan" lalu "lanjut" — slice 03 (bank soal, kuis, tag, soal objektif), termasuk permintaan UX auth yang menyertai: setelah daftar langsung masuk, pengiriman email jangan mematikan pendaftaran (fail-open), dan tautan verifikasi/reset sandi harus sekali pakai.
- **Hasil**: commit berurutan `eb5327e` → `82c030c` (slice 01 backend+frontend, slice 02 backend+frontend, dokumentasi, UI baru, slice 03 backend, auth UX, hapus maskot). `./verify.sh` hijau di setiap akhir slice; kondisi terakhir **Pest 59 passed (297 assertions)**, **Pint 139 berkas**, **Vitest 21 berkas/122 test**, **realtime 2 test**, `npm run build` sukses. Bukti perilaku lewat browser sungguhan: smoke CDP slice 02 (login guru; halaman Kelas/Mapel/Murid/Impor/Pengaturan berisi data seeder) dan smoke CDP slice 03 **8/8 lulus** (guru membuat tag + soal lewat formulir, menjadwalkan & menerbitkan kuis, murid membuka kuisnya tanpa melihat kunci jawaban).
- **Rujukan log mentah**: `log-mentah/2026-10-05-prompt-2.md` — `2026-10-05 ±19:5x WIB` (permintaan "mulai fitur asli"), `2026-10-06 dini hari WIB` (lanjutan slice 01), `2026-10-06 04:54 WIB` (slice 02), `2026-10-06 06:42 WIB` (patch UI baru, smoke CDP, tata ulang Word, revisi mapel tanpa guru pengampu), `2026-10-06 ±07.00–09.49 WIB` (commit bertahap, frontend slice 03, pagar mutu, smoke 8/8).

## Entri 3 — Engine kuis dan penilaian (slice 04–06)

- **Waktu**: 6 Oktober 2026 (slice 04 pagi–siang; slice 05 menyusul).
- **Tujuan**: mengubah kerangka menjadi mesin ulangan sungguhan — murid mengerjakan kuis dengan pengacakan dan autosave, jawaban dinilai server, hasil tampil tanpa kunci; lalu sistem skor yang adil (skor asli permanen, retry terkontrol, ranking dari skor asli, badge per mapel, remedial otomatis, laporan pemahaman per tema/tag).
- **Prompt inti (ringkas)**: (a) "lanjutkan" — slice 04 (pengerjaan, penilaian objektif, deadline server, submit idempoten, halaman hasil); (b) "lanjutkan" — slice 05 (retry, ranking, badge, remedial, laporan per tag) termasuk permintaan singkat "sudah tau paletnya kan? dan warna yang untuk guru dan murid?" yang dijawab dari `chunks/theme.json`: latar #F8FAFC, sidebar/panel guru #1A2F65, aksen #0EA5E9, pendukung #95A7D5, sorot hangat murid #EEF385 (selalu dengan garis tepi), teks #0F172A, dan mode gelap #0B1530/#14214A — semua hex hanya di blok variabel `theme.css`.
- **Hasil**: slice 04 — migrasi `attempts`/`answers`, `AttemptService` (mulai/jawab/kumpulkan/`PenilaianObjektif`/`Pengacakan`), layar `/kerjakan/:kuisId` dan `/hasil/:attemptId`; temuan bug zona waktu (jadwal bergeser 7 jam) diperbaiki lewat `keIso()`/`keLokal()`. Slice 05 — kolom `attempt_no`/`asli`, section `Report` (Ranking/Badge/Remedial/LaporanTag), kunci pengaturan baru (`ambang_paham`, `ambang_mulai_paham`, `data_minimum_tag`) dan **ranking bawaan mati**, halaman `/peringkat/:kuisId`, `/kuis/:id/laporan`, `/badge`, `/progres-tema`. Kondisi terakhir: **Pest 79 passed (491 assertions)**, **Pint 166 berkas**, **Vitest 25 berkas/156 test**, **realtime 2 test**, `npm run build` sukses; smoke CDP slice 04 **13/13** dan slice 05 **17/17** lulus. Slice 06 (koreksi manual isian/uraian) belum dikerjakan.
- **Rujukan log mentah**: `log-mentah/2026-10-05-prompt-2.md` — `2026-10-06 11:10 WIB` (slice 04: backend, verifikasi, frontend, bug jadwal 7 jam, pagar mutu, smoke 13/13) dan `2026-10-06` (slice 05: rintisan diverifikasi, section Report, test 8/100, frontend, `memory_limit` suite, smoke 17/17).

## Entri 4 — Anti-cheat, realtime, materi, upload dan AI (slice 07–09)

- **Status**: belum terisi — slice 07–09 belum dikerjakan.

## Entri 5 — Cache, Swoole, deploy, dan perbaikan akhir (slice 10)

- **Status**: belum terisi — slice 10 belum dikerjakan.
