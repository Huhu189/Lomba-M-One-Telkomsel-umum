# Jurnal Prompt

Jurnal penggunaan prompt AI (maksimal 5 entri — batas ini berlaku untuk entri jurnal, bukan jumlah prompt ke AI) — M-ONE Telkomsel Coding Competition.
Seluruh prompt dan jawaban (utuh, mentah, dengan tanggal-jam asli) ada di `docs/log-mentah/`:
transkrip `sesi-2026-10-05-transkrip.md` dan salinan byte-exact `sesi-2026-10-05-chat-messages.json.gz`.
Log mentah tidak disunting; rujukan tanggal-jam di bawah menunjuk ke berkas itu.

---

## Entri 1 — Struktur project, scaffold slice 00, dan penjelasan fitur

- **Waktu**: 5 Oktober 2026, ± 14.30–18.45 WIB
- **Tujuan**: membangun fondasi dari nol — dokumen acuan AI agent, monorepo (backend/frontend/realtime) dari scaffold resmi, pagar mutu, tema/icons/toast, lalu memperbarui dokumen acuan (revisi aturan jurnal, fitur F2, penjelasan fitur untuk juri/guru) dan menata ulang ekspor Word.
- **Prompt inti (ringkas)**: (a) prompt v1 — "buat struktur project + dokumen acuan + slice 00, jangan kerjakan fitur"; (b) prompt v2 — "perbarui dokumen acuan: batas 5 = entri jurnal; fitur F2 materi berblok + kuis sisipan; tulis penjelasan-fitur.md; jangan tulis kode". Kedua prompt tersimpan utuh di log mentah: `log-mentah/sesi-2026-10-05-transkrip.md` (salinan byte-exact: `log-mentah/sesi-2026-10-05-chat-messages.json.gz`).
- **Hasil**: dokumen acuan lengkap (AGENT.md, 00-index.json, chunk_map.json, 18 chunk, docs/), slice 00 hijau (verify 6/6, smoke run 3 layanan OK), dokumen acuan terevisi (jurnal vs prompt, F2 di slice-08/slice-04, penjelasan-fitur.md), ekspor Word dua folder (word/ = AGENT + log-mentah; word-arsip/ = bukti revisi berawalan (ARSIP) — sejak 7 Okt 2026 word-arsip/ dihapus dan ringkasan prompt dipindah ke `docs/word/AGENT.md`).
- **Rujukan log mentah**: `log-mentah/sesi-2026-10-05-transkrip.md` (14:48:54 WIB — pemeriksaan lingkungan; verify hijau 17:25 WIB; ekspor word 17:28 WIB; push awal) dan `log-mentah/sesi-2026-10-05-transkrip.md` (verify baca-saja 18:13:51 WIB; temuan pembacaan; tiga perubahan dokumen; keputusan ekspor Word dari pengguna).

## Entri 2 — Auth, sekolah & kelas, bank soal (slice 01–03)

- **Waktu**: 5 Oktober 2026 ± 19.50 WIB sampai 6 Oktober 2026 09.50 WIB (± 14 jam kerja berselang, termasuk perbaikan pagar mutu).
- **Tujuan**: mengubah kerangka menjadi fitur asli — (1) auth lengkap (masuk, daftar, verifikasi email, lupa sandi, sesi cookie Sanctum, peran guru/admin/murid, middleware "akun layak"); (2) data induk sekolah, kelas, mapel, murid, impor & ekspor CSV, pengaturan tiga lapis (sekolah → kelas → kuis, dengan kunci sekolah); (3) bank soal + kuis + tag: enam belas berkas backend (registry empat tipe soal objektif, kebijakan akses, validasi kelengkapan publikasi, soal terkunci saat kuis berjalan) dan antarmuka guru/murid (editor soal dengan pratinjau, pengelola kuis dengan jadwal & susun soal, halaman tag, daftar ulangan murid).
- **Prompt inti (ringkas)**: (a) "mulai fitur asli" — kerjakan slice berikutnya sampai hijau, jangan lompat; (b) "lanjutkan" — slice 02 (sekolah/kelas/mapel/murid/impor CSV/pengaturan); (c) "lanjutkan" lalu "lanjut" — slice 03 (bank soal, kuis, tag, soal objektif), termasuk permintaan UX auth yang menyertai: setelah daftar langsung masuk, pengiriman email jangan mematikan pendaftaran (fail-open), dan tautan verifikasi/reset sandi harus sekali pakai.
- **Hasil**: commit berurutan `eb5327e` → `82c030c` (slice 01 backend+frontend, slice 02 backend+frontend, dokumentasi, UI baru, slice 03 backend, auth UX, hapus maskot). `./verify.sh` hijau di setiap akhir slice; kondisi terakhir **Pest 59 passed (297 assertions)**, **Pint 139 berkas**, **Vitest 21 berkas/122 test**, **realtime 2 test**, `npm run build` sukses. Bukti perilaku lewat browser sungguhan: smoke CDP slice 02 (login guru; halaman Kelas/Mapel/Murid/Impor/Pengaturan berisi data seeder) dan smoke CDP slice 03 **8/8 lulus** (guru membuat tag + soal lewat formulir, menjadwalkan & menerbitkan kuis, murid membuka kuisnya tanpa melihat kunci jawaban).
- **Rujukan log mentah**: `log-mentah/sesi-2026-10-05-transkrip.md` — `2026-10-05 ±19:5x WIB` (permintaan "mulai fitur asli"), `2026-10-06 dini hari WIB` (lanjutan slice 01), `2026-10-06 04:54 WIB` (slice 02), `2026-10-06 06:42 WIB` (patch UI baru, smoke CDP, tata ulang Word, revisi mapel tanpa guru pengampu), `2026-10-06 ±07.00–09.49 WIB` (commit bertahap, frontend slice 03, pagar mutu, smoke 8/8).

## Entri 3 — Engine kuis dan penilaian (slice 04–06)

- **Waktu**: 6 Oktober 2026 (slice 04 pagi–siang; slice 05 siang; slice 06 sore, ditutup dengan perbaikan bug penilaian isian).
- **Tujuan**: mengubah kerangka menjadi mesin ulangan sungguhan — murid mengerjakan kuis dengan pengacakan dan autosave, jawaban dinilai server, hasil tampil tanpa kunci; lalu sistem skor yang adil (skor asli permanen, retry terkontrol, ranking dari skor asli, badge per mapel, remedial otomatis, laporan pemahaman per tema/tag); dan akhirnya paket soal lengkap — delapan tipe soal (enam objektif + isian singkat & uraian bertingkat) beserta koreksi manual guru yang teraudit.
- **Prompt inti (ringkas)**: (a) "lanjutkan" — slice 04 (pengerjaan, penilaian objektif, deadline server, submit idempoten, halaman hasil); (b) "lanjutkan" — slice 05 (retry, ranking, badge, remedial, laporan per tag) termasuk permintaan singkat "sudah tau paletnya kan? dan warna yang untuk guru dan murid?" yang dijawab dari `chunks/theme.json`: latar #F8FAFC, sidebar/panel guru #1A2F65, aksen #0EA5E9, pendukung #95A7D5, sorot hangat murid #EEF385 (selalu dengan garis tepi), teks #0F172A, dan mode gelap #0B1530/#14214A — semua hex hanya di blok variabel `theme.css`; (c) "lanjut" — slice 06 sebagai MVP fitur yang belum ada, dengan arahan pengguna lewat pilihan ganda: "Slice 06: isian/uraian + koreksi manual, semua nya (mvp untuk fitur yang ada ui dan testable namun ketat di pure sys no ui seperti cache dll)", dan "tunda dulu, fokus fitur" untuk bagian deploy.
- **Hasil**: slice 04 — migrasi `attempts`/`answers`, `AttemptService` (mulai/jawab/kumpulkan/`PenilaianObjektif`/`Pengacakan`), layar `/kerjakan/:kuisId` dan `/hasil/:attemptId`; temuan bug zona waktu (jadwal bergeser 7 jam) diperbaiki lewat `keIso()`/`keLokal()`. Slice 05 — kolom `attempt_no`/`asli`, section `Report` (Ranking/Badge/Remedial/LaporanTag), kunci pengaturan baru (`ambang_paham`, `ambang_mulai_paham`, `data_minimum_tag`) dan **ranking bawaan mati**, halaman `/peringkat/:kuisId`, `/kuis/:id/laporan`, `/badge`, `/progres-tema`. Slice 06 — registry delapan tipe soal (tambah `letak_kata`, `hubung_kata`, `isian_singkat`, `uraian`), `BantuanTeks`/`PenanganIsianSingkat`/`PenanganUraian` beserta `PenilaianTeks` dan router `PenilaiSoal`, tabel `confirmation_tokens` + kolom `answers.dinilai_manual`/`alasan_koreksi`, `TokenKonfirmasiService` (token hash, 300 detik, sekali pakai) dan `KoreksiService` (antrean → token → koreksi teraudit + `hitungUlang()`), editor soal & renderer untuk empat tipe baru (frontend), serta halaman guru `/kuis/:id/koreksi`. Kondisi terakhir: **Pest 88 passed (598 assertions)**, **Pint 182 berkas**, **Vitest 27 berkas/193 test**, **realtime 2 test**, `npm run build` sukses; smoke CDP slice 04 **13/13**, slice 05 **17/17**, dan slice 06 **27/27** lulus (yang pertama langsung menemukan bug penilaian isian → diperbaiki dan diuji ulang). Ditutup dengan **putaran audit library & kualitas kode**: laporan audit dari snapshot zip lama diperiksa ulang terhadap kode berjalan (sebagian temuan ternyata usang), lalu diperbaiki — tautan reset sandi kini benar-benar menuju frontend, akun *suspended* tidak lagi dihidupkan tautan verifikasi, waktu respons login diseragamkan + throttle per-IP, closure rute diganti controller agar `route:cache` jalan, peran punya satu penulis (`User::tetapkanPeran`), arch test controller diperbaiki, klien CSRF frontend di-cache, dan scaffold Tailwind backend dibersihkan (root backend kini mengalihkan ke frontend). Satu temuan (**enumerasi email saat daftar**) sengaja dipertahankan 422 dan dicatat jujur karena berbenturan dengan alur auto-login. Kondisi terakhir: **Pest 95 passed (629 assertions)**, **Pint 183 berkas**, **Vitest 27 berkas/197 test**.
- **Rujukan log mentah**: `log-mentah/sesi-2026-10-05-transkrip.md` — `2026-10-06 11:10 WIB` (slice 04: backend, verifikasi, frontend, bug jadwal 7 jam, pagar mutu, smoke 13/13), `2026-10-06` (slice 05: rintisan diverifikasi, section Report, test 8/100, frontend, `memory_limit` suite, smoke 17/17), dan `2026-10-06 sore–malam WIB` (slice 06: pusatkan berkas uji, dokumentasi penanda, backend delapan tipe + koreksi manual, frontend editor/renderer/antrean koreksi, penambahan Vitest, smoke 27/27 yang menemukan bug `angka_persis`, sampai ekspor Word dan push), dan `2026-10-06 19:41 WIB` (putaran audit slice 01: prompt "cek" + laporan audit, verdict tiap temuan, keputusan pengguna "semua termasuk B2" dengan trade-off "pertahankan 422 + note jujur", perbaikan backend/frontend, verifikasi akhir 95/629 + 197 test, build, route:cache, root redirect, sampai dokumentasi A.10 dan ekspor Word).

## Entri 4 — Anti-cheat, realtime, materi, upload dan AI (slice 07–09)

- **Waktu**: 6 Oktober 2026, malam (slice 07), setelah putaran audit slice 01 ditutup dan di-push.
- **Tujuan**: mengubah ulangan agar bisa dipantau dengan jujur — proteksi tiga lapis yang **fail-open** dan
default mati, presence yang hemat kuota (tanpa detak jantung), dan Live Monitor guru yang tetap berisi walau
service realtime mati.
- **Prompt inti (ringkas)**: pengguna lebih dulu bertanya "ada fitur yang belum selesai?" (jawaban saya:
14 butir, slice 07–10, dengan deploy sebagai satu-satunya yang aturan lomba tandai tidak boleh dipotong),
lalu memberi izin: "boleh lanjutkan". Deploy tetap ditunda sesuai permintaan sebelumnya ("tunda dulu, fokus
fitur"), jadi yang dikerjakan adalah slice berikutnya secara berurutan: **slice 07**.
- **Hasil**: section `Cheat` (enum 13 kategori + skor risiko, catatan **append-only**, service tulis/baca/tinjau
+ audit) dan `Presence` (kehadiran dari aktivitas normal dengan ambang 45 detik, deteksi sesi ganda, catatan
lama tidak aktif, tiket SSE sekali pakai, snapshot Live Monitor); orkestrator klien `useExamSecurity`
beserta pengirim kejadian berkelompok (dedupe, antrean offline 200 entri/48 jam, aturan retry), presence
ping + `sendBeacon`, dan halaman guru `/kuis/:id/monitor` dengan polling 5 detik sebagai jalur keselamatan
plus SSE dari Node bila hidup. Service Node mendapat endpoint `GET /sse/monitor` (tiket dari Redis, `GETDEL`,
cek Origin, `X-Accel-Buffering: no`, keepalive). Kondisi terakhir: **Pest 107 passed (740 assertions)**,
**Pint 203 berkas**, **Vitest 29 berkas/209 test**, **realtime 9 test**, dan smoke CDP
`docs/smoke-ui-slice07.mjs` **21/21 lulus**.
- **Dua bug nyata yang ditemukan pengujian**: (a) kunci tiket SSE di-prefix Laravel sehingga service Node
  tidak pernah menemukannya (handshake selalu 401) — diperbaiki dengan koneksi Redis `realtime` tanpa prefix;
  (b) **menutup layar Live Monitor mematikan seluruh service realtime**, karena pembersihan memanggil
  `unsubscribe()`/`disconnect()` yang menyisakan promise tanpa penangkap di ioredis — diperbaiki dengan
  penutupan sekali jalan memakai `quit()` plus test regresi.
- **Rujukan log mentah**: `log-mentah/sesi-2026-10-05-transkrip.md` — `2026-10-06 ±20.30–22.00 WIB` (pertanyaan
"fitur mana yang belum selesai", izin "boleh lanjutkan", backend Cheat + Presence, test 12 baru, frontend
security/presence/Live Monitor, SSE Node, smoke 21/21, dua bug di atas, sampai dokumentasi A.11).

## Entri 5 — Cache, Swoole, deploy, dan perbaikan akhir (slice 10)

- **Status**: sebagian terisi — slice 08, slice 09 lengkap (lampiran jawaban, saran AI lewat queue, mode tim),
  dan **ekspor nilai kuis (CSV)** sudah selesai dan hijau. Mode gelap ternyata sudah dibangun sejak awal
  bersama tema (store + tombol + palet CSS), jadi tidak dibuat ulang di slice 10. Sisa: layar guru → perangkat
  murid (SSE), cache L1 SQLite, Octane Swoole (ekstensi `swoole` tidak ada di mesin dev — dicatat jujur), dan
  deploy yang masih menunggu keputusan host dari pengguna. Bagian ini ditutup di akhir slice 10.
