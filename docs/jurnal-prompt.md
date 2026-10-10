# Jurnal Prompt

Jurnal penggunaan prompt AI (maksimal 5 entri — batas ini berlaku untuk entri jurnal, bukan jumlah prompt ke AI) — M-ONE Telkomsel Coding Competition.
Seluruh prompt dan jawaban (utuh, mentah, dengan tanggal-jam asli) ada di `docs/log-mentah/`:
transkrip `sesi-2026-10-05-transkrip.md` dan salinan byte-exact `sesi-2026-10-05-chat-messages.json.gz`.
Log mentah tidak disunting; rujukan tanggal-jam di bawah menunjuk ke berkas itu.
Berkas mentah disegarkan ulang 8 Oktober 2026 (207 pesan) dan transkripnya kini memuat isi **utuh
apa adanya tanpa potong**; angka byte & md5 salinan byte-exact tercatat di kepala transkrip.

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
  **ekspor nilai kuis (CSV)**, **cache L1 SQLite di tmpfs** beserta gerbang lalu lintas dan invalidasi
  berlapis (dipakai pengaturan tiga lapis), dan **layar guru → perangkat murid (SSE)** sudah selesai dan
  hijau — artinya seluruh daftar potong dari chunk_map.json kini selesai. Mode gelap ternyata sudah dibangun
  sejak awal bersama tema (store + tombol + palet CSS), jadi tidak dibuat ulang di slice 10. Sisa:
  Octane Swoole (ekstensi `swoole` tidak ada di mesin dev — dicatat jujur) dan deploy yang masih menunggu
  keputusan host dari pengguna. Bagian ini ditutup di akhir slice 10.

- **Perbaikan akhir (8 Oktober 2026)**: laporan pengguna tentang **403** pada `/avatar`, `/progres/saya`,
  `/badge/saya` serta *"This action is unauthorized."* saat ganti foto profil, plus permintaan agar rute
  progres-tema & lencana sinkron GET/POST dan tautan reset kata sandi sekali pakai diberi halaman khusus.
  Akar masalah: murid yang **mendaftar sendiri** tidak dibuatkan baris `students` sehingga semua endpoint
  murid menolak; `AvatarPolicy::viewAny` menolak guru; frontend mengirim **POST** sementara rute hanya GET;
  respons reset belum membawa penanda tautan terpakai. Perbaikan: `RegisterService` membuat profil murid +
  kelas penampung `"Tanpa Kelas"` dalam satu transaksi; policy dilonggarkan (guru dapat respons rapi, unggah
  tetap khusus murid); alias `POST /progres/saya` & `/badge/saya` ditambahkan; dan kartu *"Tautan sudah
  pernah dipakai"* di halaman atur ulang sandi. Diverifikasi `./verify.sh` **HIJAU** — Pest **173 passed
  (1418 assertions)**, Pint **304 berkas**, Vitest **36 berkas/279 test**, realtime **13 test** — ditambah
  **smoke HTTP nyata** (login cookie+CSRF sebagai murid dan guru) yang semuanya lulus. Dua temuan smoke:
  `http.cookiejar` bawaan Python tidak mengirim cookie berdomain `.localhost` (keterbatasan alat, bukan bug
  aplikasi — skrip dikelola cookie manual), dan seeder guru belum memanggil `assignRole('guru')` sehingga
  `isGuru()` salah → diperbaiki. Detail lengkap di `laporan-pengujian.md` bagian A.15 dan
  `penjelasan-fitur.md` bagian 16. **Lanjutan (bug 403 yang sama, akun lama):** akun murid yang sudah ada
  sebelum kelas penampung (mis. `dgcam22@gmail.com`) tetap 403 karena baris `students`-nya memang belum
  ada. Ditambahkan `MuridService::pastikanProfil()` yang idempoten dan kini dipakai `RegisterService`
  (satu titik kebenaran) serta `BadgeController`/`ProgresController`/`AvatarController` — murid lama
  disembuhkan saat pertama mengakses, guru tetap 403. Diverifikasi `./verify.sh` **HIJAU** (Pest
  **174 passed (1424 assertions)**) plus smoke HTTP nyata dengan akun tanpa profil yang seluruh endpoint-nya
  200 dan profilnya terbentuk. Detail di `laporan-pengujian.md` bagian A.16.

- **Penyempurnaan palet "Tinta & Kertas" (8 Oktober 2026)**: palet bawaan masih sangat generik
  (slate-50, sky-500, dst.). Peran warna dari `chunk theme` **dipertahankan** — panel navy, aksen
  biru, pendukung periwinkle, sorot hangat stabilo, mode gelap navy pekat — tetapi nilai dilembutkan
  ke dunia buku tulis & stabilo yang lebih khas dan tetap ramah anak SD: kertas hangat `#F5F2EA`,
  tinta navy `#1B2A5E`, aksen laguna `#0FA3B8`, pendukung `#92A5D6`, dan stabilo `#EEF385`
  **dipertahankan** sebagai tanda tangan. Semua 18 pasangan kontras teruji ≥ AA (teks di aksen
  5.32:1, teks-lembut di kertas 5.67:1, garis input 4.19:1). Perubahan hanya di blok variabel
  `theme.css` (dijaga `tema.test.js`), dibuktikan visual lewat tangkapan Chrome headless
  (`docs/log-mentah/palet-terang.png`, `palet-gelap.png`) dan `./verify.sh` HIJAU — Pest **175 passed
  (1433 assertions)**, Vitest 36 berkas/279 test.

- **Editor materi "video editor" + pratinjau langsung (8 Oktober 2026)**: permintaan
  pengguna — menyusun materi di `/materi` harus terasa seperti video editor dan hasilnya
  terlihat seketika. `PanelMateri` dirombak jadi dua panel: **timeline klip** (satu klip
  per blok, drag-to-reorder HTML5 native, klik untuk memilih, tombol ↑/↓ dipertahankan
  untuk keyboard) dan **monitor pratinjau** yang merender blok terpilih persis seperti
  dilihat murid (teks pre-wrap, media via URL bertanda tangan, kuis sisipan sebagai
  kartu) langsung dari state editor — reaksi instan tanpa menyentuh server. Ditambah
  navigasi ←/→ dengan indikator "Blok X dari Y" (aria-live) dan badge **"Belum
  tersimpan"** otomatis. Kontrak API tidak berubah. Diverifikasi `./verify.sh` HIJAU
  (Pest 175/1433, Vitest 36/279) plus smoke UI Chrome headless yang membuktikan teks
  yang baru diketik langsung muncul di monitor; bukti visual terang/gelap di
  `docs/log-mentah/editor-materi-*.png` (diverifikasi MD5 + piksel). Temuan alat dicatat
  jujur di `laporan-pengujian.md` A.17: capture CDP beku pasca-reload, cookie
  `.localhost` tak tersimpan di origin 127.0.0.1.

- **Putaran audit eksternal ProjectLA dan perbaikan per temuan (8 Oktober 2026)**: pengguna
  melampirkan laporan audit statis (`audit-projectla-lomba.md` — 84 temuan: 1 kritis, 18 tinggi,
  51 sedang, 14 rendah; berkas prompt & lognya disalin apa adanya ke
  `docs/log-mentah/prompt-claude-eksternal.md` + `log-claude-eksternal.md`) dengan instruksi
  "cek lagi dan kerjakan progres penyelesaian bug". Dari 84 temuan hanya **23 yang membawa
  rincian lokasi + skenario** (U-01..U-04, Q-01..Q-19), ditambah enam temuan dari ringkasan
  Top-10 yang skenarionya cukup jelas (S-01, S-04, S-05, S-07, S-14, I-01) — jadi total
  **29 temuan** diselesaikan. Sisanya hanya berupa daftar tanpa lokasi/skenario sehingga
  **tidak ditebak** dan tidak diklaim selesai. Cara kerja tiap ID: verifikasi bug di kode →
  tulis test yang MERAH → perbaiki → test HIJAU → `./verify.sh` → commit + push; tanpa refactor
  di luar temuan dan tanpa mengubah skema DB tanpa migrasi aman. Sorotan: timer klien benar-benar
  berkurang (`offsetServer` dihitung sekali per respons — Q-01) dan kumpul otomatis berhenti pada
  galat permanen (Q-04); antrean jawaban, `tandaiTerkirim`, dan cadangan lokal tidak lagi menimpa
  jawaban yang lebih baru (Q-02, Q-03, Q-05); simpan-vs-tutup diamankan `lockForUpdate` (Q-06);
  satu attempt aktif per tim lewat indeks unik + `Mulai` ramah dobel klik (Q-07); deadline dipotong
  `selesai_at` (Q-08); soal dan setelan kuis dibekukan saat attempt dimulai serta hapus soal tidak
  lagi menghapus jawaban murid (Q-09, Q-12); jendela waktu jawab = kumpul (Q-10); isian singkat
  menolak jawaban berlawanan arti dan menghormati ambang guru (Q-11); penutup attempt basi lanjut
  walau satu penutupan gagal (Q-13); presence tim tak lagi memunculkan bukti sesi ganda palsu
  (Q-14); kode mati dibersihkan (Q-15); ekspor/impor CSV ramah Excel Indonesia (Q-16: BOM UTF-8,
  pemisah `,`/`;`/tab, deteksi encoding, jam ekspor WIB) dan impor murid atomik + laporan galat
  alih-alih 500 (Q-17); keanggotaan tim dibekukan di tabel baru `attempt_members` (Q-18); penilaian
  menjodohkan/mengurutkan menolak elemen non-skalar (Q-19). Di sisi UI: media soal dibatasi
  allowlist host + fallback gambar + dimensi (U-01), kontainer soal di-`inert` dengan fokus pindah
  ke overlay `alertdialog` (U-02), pesan galat awal ulangan memakai pesan server + tombol "Coba
  lagi" (U-03), dan spinner ber-`aria-busy` + teks panjang dipatahkan (U-04). Ditutup dengan
  pembatasan hak ubah kuis/soal/setelan anti-cheat/nilai ke guru pembuatnya (S-04/S-05), throttle
  auth per IP dilonggarkan agar satu kelas di balik NAT tak kena 429 (S-01), batas piksel gambar
  avatar (S-07), pembersihan cadangan jawaban & cache saat keluar (S-14), dan penjagaan versi +
  umur salinan lapisan Redis (I-01). Diverifikasi `./verify.sh` **HIJAU** — Pest **211 passed
  (1670 assertions)**, Pint OK, checkJs OK, ESLint **0 error (2 warning lama)**, Vitest
  **41 berkas/327 test**, realtime **13 test**. Batasan jujur ada di `laporan-pengujian.md`
  A.18.5.

- **Perapian dokumen lomba (8 Oktober 2026)**: permintaan pengguna — "perbaiki docs nya: untuk
  prompt pakai `docs`, untuk log pakai yang benar-benar mentah, dan yang ada ringkasan di Word".
  Yang dikerjakan: (1) **prompt** tetap satu tempat di `docs/` — `jurnal-prompt.md` (maks 5 entri)
  dan `log-mentah/` (seluruh prompt/jawaban mentah); (2) **log mentah** disegarkan dari sesi asli —
  `sesi-2026-10-05-chat-messages.json.gz` (salinan byte-exact, 207 pesan) dan transkripnya kini
  **utuh tanpa potong** (transkrip sebelumnya memotong setiap argumen panggilan alat di 400
  karakter), serta transkrip dibaca dari berkas `.gz` yang ikut dikumpulkan supaya byte/md5 di
  kepalanya benar-benar sepadan dengan salinan mentahnya; (3) **ringkasan di Word** diekspor ulang
  ke `docs/word/` (`AGENT.docx`, `jurnal-prompt.docx`, `log-mentah.docx`, `penjelasan-fitur.docx`,
  `catatan-demo.docx`, `laporan-pengujian.docx`).

- **Rujukan log mentah**: `log-mentah/sesi-2026-10-05-transkrip.md` — `2026-10-08 ±15.30–19.45 WIB`
  (audit U-01..U-04 + Q-01..Q-19 + S-01/S-04/S-05/S-07/S-14/I-01 dikerjakan satu per ID sampai
  ekspor Word ulang) dan `2026-10-08 ±20.10 WIB` (perapian dokumen: transkrip mentah utuh +
  ekspor Word). Salinan byte-exact: `log-mentah/sesi-2026-10-05-chat-messages.json.gz`.

- **Putaran audit 5 pilar (9 Oktober 2026)**: permintaan pengguna — mengerjakan temuan `audit.md`
  menurut prioritas, satu per ID, dengan bukti angka. Yang selesai: kelompok 1 (otorisasi lintas
  guru + kunci jawaban/`Policy` di setiap endpoint) dan performa jalur pengerjaan (P-03 autosave
  bebas bank soal, P-04 pengumpulan satu `upsert` alih-alih query per soal), lalu **P-02 presence**:
  kehadiran dipindah dari satu peta utuh per kuis di cache ke **satu hash Redis per kuis + set
  indeks**, sehingga satu request murid hanya menyentuh satu medan (`HGET`/`HSET`, O(1)) dan dua
  request bersamaan tidak saling menimpa; guru tetap membaca satu kelas dengan satu `HGETALL`.
  Cadangan non-Redis (`GudangPeta`) dipertahankan, jalur gagal tetap *fail-open*, dan ada pemulihan
  kunci sisa bertipe string dari driver lama. Verifikasi: `./verify.sh` **HIJAU** — Pest **226 passed
  (1808 assertions)**, Pint 318 berkas, checkJs OK, ESLint 0 error, Vitest 42 berkas/338 test,
  realtime 15 test; smoke HTTP nyata dengan layanan lokal hidup (backend :8000, realtime :4000,
  frontend :5173) **242/242 lulus**; jumlah perintah Redis diukur sungguhan lewat `INFO commandstats`
  (satu request murid = 1 hget + 1 hset, tanpa `HGETALL`). Batasan jujur ada di
  `laporan-pengujian.md` A.22.6 (P-01 paginasi masih terbuka, belum ada uji beban lapangan).

- **Putaran P-01 paginasi (9 Oktober 2026)**: lanjutan prioritas `audit.md` — satu-satunya temuan
  kelompok 2 yang masih terbuka sesudah P-02/P-03/P-04. Endpoint yang paling tidak terbatas
  (**daftar murid**) dijadikan contoh pertama: `MuridController::index` sekarang `->paginate`
  (**50/halaman**, batas atas 200) dengan bentuk respons paginator Laravel (`data[]` + `meta`),
  frontend `HalamanMurid` mendapat tombol Sebelumnya/Berikutnya + "Menampilkan N dari M murid",
  dan `skemaHalamanMurid` menolak bentuk array lama. Verifikasi: `php artisan test` **227 passed
  (1818 assertions)**, `./verify.sh` **HIJAU** (Vitest kini 43 berkas/342 test), smoke HTTP nyata
  **242/242 lulus**. Batasan jujur: P-01 baru sebagian — kuis, materi, koreksi, peringkat, ekspor
  nilai, monitor, dan kecurangan masih memuat semua baris (lihat `laporan-pengujian.md` A.23.6).

- **Putaran UI (10 Oktober 2026)**: permintaan pengguna — tombol Ubah di `/kuis` belum responsif,
  layout kurang rapih, minta **hamburger** untuk tiap bagian, utamakan **ikon**, dan matangkan
  **editor materi** ("saat di play video gak jalan" → pakai media native HTML + sinkron). Yang
  dikerjakan: shell baru (navbar pil ber-ikon ≥ lg, laci hamburger < lg, tutup lewat Escape/overlay/
  tautan), baris aksi kartu kuis ber-ikon yang membungkus rapi, dan pratinjau editor materi memakai
  `<video>`/`<audio>` native yang mengikuti jam timeline (`offsetMedia`), plus perbaikan klip
  berdurasi 0 supaya media tetap muncul. Verifikasi: `./verify.sh` **HIJAU** (Pest 227 passed/1818
  assertions, Vitest 44 berkas/355 test), `npm run build` lolos, smoke CDP baru
  `docs/smoke-ui-nav.mjs` **13/13** (390 px & 1280 px), dan cek editor via CDP **7/7** (media benar
  berjalan saat timeline diputar). Batasan: perombakan seluruh halaman belum, lihat A.24.6.

- **Putaran desain Ulangan Sekolah (10 Oktober 2026)**: pengguna menyerahkan paket desain
  `desain-ulangan-sekolah.zip` (12 papan: audit + contoh "sesudah" + papan Standar) dan meminta
  melanjutkan UI dengan acuan itu; lewat pilihan, pengguna memutuskan **palet diselaraskan ke palet
  resmi spesifikasi** dan pekerjaan mengikuti urutan papan mulai dari fondasi. Yang dikerjakan:
  token baru (cincin fokus yang lolos kontras, skala jarak & huruf), `Tombol` varian bahaya + ukuran
  44 px + `TombolIkon` ber-`aria-label`, komponen `DialogKonfirmasi` (menggantikan 6 dari 7
  `window.confirm`), `Skeleton`, `KosongData`, `HeaderHalaman`, `TabelData` (tabel → kartu di HP),
  `PanelForm` (dialog samping), dan `KerangkaUmum` menjadi panel samping indigo berkelompok
  (Ringkasan/Ujian/Data induk/Belajar) dengan menu Beranda serta ikon Kuis berbeda dari Bank Soal.
  Papan 3 "Kelola Kelas (sesudah)" diterapkan penuh, lalu polanya dipakai di Mapel, Murid, Tag,
  Bank Soal, dan Kuis. Verifikasi: `./verify.sh` **SEMUA HIJAU exit 0** — Pest **227 passed
  (1818 assertions)**, Pint 318 berkas, checkJs OK, ESLint 0 error, Vitest **46 berkas/373 test**
  (naik dari 44/355), realtime 15 test. Batasan jujur ada di `laporan-pengujian.md` A.25.6 — layar
  ulangan (papan 4/5), beranda (2), dan papan 7–12 belum dikerjakan.

- **Putaran desain lanjutan — layar ulangan & beranda (10 Oktober 2026)**: melanjutkan urutan papan
  desain ke papan 4/5 dan 2. Layar ulangan murid sekarang punya **kepala lengket** (judul, lencana
  pengaman, progress bar terjawab, sisa waktu, tombol Selesai), **satu soal per layar**, **navigator
  nomor** empat keadaan (dijawab / ragu-ragu / belum dijawab / aktif) yang dilipat di HP, **penanda
  ragu**, banner **koneksi putus**, dan **dialog ringkasan sebelum mengumpulkan** — ini menggantikan
  `window.confirm` terakhir, jadi tidak ada lagi `window.confirm` di seluruh `src/`. Skala huruf murid
  dibesarkan (teks soal 26 px, pilihan 20 px/68 px). Beranda guru menjadi **dasbor berbasis tugas**:
  "Perlu perhatian" (berlangsung → Buka monitor, antrean koreksi, laporan avatar), 4 angka ringkas, dan
  jadwal kuis bertab Hari ini / Minggu ini; beranda murid menampilkan ulangan berikutnya + pintasan.
  Verifikasi: `./verify.sh` **SEMUA HIJAU exit 0** — Pest **227 passed (1818 assertions)**, Pint 318
  berkas, checkJs OK, ESLint 0 error, Vitest **49 berkas/397 test** (A.25: 46/373), realtime 15 test,
  `npm run build` lolos. Batasan jujur di `laporan-pengujian.md` A.26.6 — papan 7–12 (Monitor, Koreksi,
  Progres, Kuis 3 langkah, EditorSoal, EditorMateri) belum dikerjakan.

- **Putaran desain lanjutan — Monitor, Koreksi, Progres (10 Oktober 2026)**: menutup urutan papan 7–9.
  Live Monitor memakai kepala halaman bersama, **strip angka ringkas dari snapshot server**
  (Mengerjakan / Selesai / Tidak aktif / Perlu ditinjau), tabel murid via `TabelData` (jadi kartu di HP,
  kolom Catatan tidak lagi terdorong keluar layar), kolom **Terakhir aktif** dalam bahasa manusia, pil
  saringan catatan, dan keadaan kosong per saringan. Koreksi manual dan Progres Tema mendapat kepala
  bersama, skeleton, kosong-data, ukuran tombol 44 px, dan Progres Tema mendapat **saringan "Semua tema /
  Perlu dilatih"**. Verifikasi: `./verify.sh` **SEMUA HIJAU exit 0** — Pest **227 passed (1818
  assertions)**, Pint 318 berkas, checkJs OK, ESLint 0 error, Vitest **50 berkas/401 test** (A.26:
  49/397), realtime 15 test, `npm run build` lolos. Batasan di A.27.6: papan 10–12 (Kuis 3 langkah,
  EditorSoal, EditorMateri) belum, papan 8 baru sebagian, 3 halaman masih `table-responsive`.
- **Putaran desain lanjutan — papan 10 & 11 + satu sistem tombol (10 Oktober 2026)**: menutup dua papan
  terakhir paket desain. **Papan 10**: halaman kuis guru jadi alur **tiga langkah** (info & jadwal → susun
  soal → tinjau & publikasi) dengan pil langkah bernomor (`LangkahPil`, `aria-current="step"`), bank soal
  sebagai baris centang ber-label, panel susunan bernomor dengan tombol naik/turun ber-`aria-label`, dan
  langkah 3 berisi daftar kelengkapan + ringkasan (tombol terbit mati selama ada butir "Belum").
  **Papan 11**: editor soal jadi tiga kartu bernomor + sisi kanan lengket berisi pratinjau (`RendererSoal`
  yang sama dengan layar murid) dan daftar **Kelengkapan** yang diturunkan dari validator yang sama
  (`kelengkapanSoal()`), jadi daftar periksa tidak pernah berbeda pendapat dengan galat simpan; kunci
  benar/salah dan pemilih tipe memakai pil (bukan `<select>`). **Butir DoD "satu sistem tombol"**: seluruh
  kelas tombol Bootstrap di JSX (`btn-sm`, `btn-outline-*`, `btn-primary`) diganti `Tombol`/`TombolTaut`/
  `TombolIkon`, pemetaannya di `theme.css` dihapus, dan dijaga tes baru `sistemTombol.test.js`.
  Verifikasi: `./verify.sh` **SEMUA HIJAU exit 0** — Pest **227 passed (1818 assertions)**, Pint OK,
  checkJs OK, ESLint 0 error, Vitest **53 berkas/428 test** (A.27: 50/401), realtime 15 test,
  `npm run build` lolos, smoke CDP baru `docs/smoke-ui-susun.mjs` **40/40**; `smoke-ui-nav.mjs` 14/14 dan
  `smoke-ui-slice03.mjs` 9/9 setelah disesuaikan. Batasan di A.28.7: papan 8 baru sebagian, smoke
  slice 04–07 belum dibereskan.

- **Putaran verifikasi — smoke mandiri slice 04–07 dan bug payload soal letak kata (10 Oktober 2026)**:
  menutup utang A.28.7. Semua harness slice 04–07 ditulis ulang jadi **mandiri** (membuat soal + ulangan
  untuk kelas murid uji, memeriksa lewat layar sungguhan, lalu menghapus jejaknya di blok `finally` dan
  memulihkan pengaturan yang diubah), plus tahan **429** (throttle masuk 5/menit), menutup tab Chrome
  sendiri, dan mengikuti teks UI baru (satu soal per layar, "x dari N terjawab", "Selesai" →
  "Kumpulkan", panel "Catatan untuk ditinjau"). Harness baru itu **menemukan bug nyata (Q-19)**:
  `AttemptService::payloadSoal()` hanya menyalin `opsi/kiri/kanan/item`, sehingga soal **letak kata**
  sampai ke perangkat murid **tanpa `kata` dan `posisi`** — soal tampil kosong dan mustahil dijawab dari
  layar, sementara penilaian lewat API tetap "benar" sehingga tidak tertangkap uji lama. Perbaikan:
  daftar putih ditambah `kata` + `posisi`; penjaganya tes baru di `Slice06Test` yang sudah dibuktikan
  gagal bila perbaikan dibalik. Satu salah tulis seeder (`UserStatus` → `Usa_erStatus`, 213 tes gagal)
  juga tertangkap `verify.sh` dan dipulihkan. Verifikasi: `./verify.sh` **SEMUA HIJAU exit 0** — Pest
  **228 passed (1833 assertions)**, Pint OK, checkJs OK, ESLint 0 error, Vitest 53 berkas/428 test,
  realtime 15 test; seluruh smoke UI satu tarikan **148 pemeriksaan lulus** (nav 14/14 · susun 40/40 ·
  slice03 9/9 · slice04 18/18 · slice05 20/20 · slice06 27/27 · slice07 20/20), `smoke-http-fitur.mjs`
  **242/242**, dan slice04/slice05 diulang berturut-turut tetap penuh (harness mandiri memang bisa
  dijalankan berulang). Batasan di A.29.7: papan 8 (Koreksi) masih sebagian, tanpa uji visual, smoke UI
  butuh empat layanan hidup.
