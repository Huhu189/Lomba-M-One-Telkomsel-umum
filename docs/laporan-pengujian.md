# Laporan Pengujian

Diperbarui: 10 Oktober 2026 (putaran editor materi gaya video editor — A.31 — dan penunjuk langkah koreksi manual — A.32).
Bagian A.1–A.30 adalah catatan apa adanya dari sesi-sesinya masing-masing; status terkini ada di A.31 dan A.32.

> **Catatan revisi dokumentasi (7 Oktober 2026):** tata letak dokumen dirapikan atas permintaan
> pengguna. Ringkasan prompt kini ada di `docs/word/AGENT.md` + `AGENT.docx` (bukan lagi dump prompt
> verbatim), `docs/word/` memuat seluruh dokumen `.docx` yang dikumpulkan, arsip `docs/word-arsip/`
> beserta berkas log bertanggal di `docs/log-mentah/` dihapus, dan log mentah sesi diganti oleh
> `docs/log-mentah/2026-10-05T07-39-24.876Z/chat-messages.json.gz` (byte-exact) + transkrip bacanya.
> Penyebutan nama berkas lama di bawah ini adalah catatan apa adanya dari sesi saat itu.
>
> **Catatan revisi dokumentasi (8 Oktober 2026):** atas permintaan pengguna, log mentah disegarkan
> ulang dari sesi asli (207 pesan) dan transkrip mentahnya kini **utuh tanpa potong** (argumen
> panggilan alat tidak lagi diringkas 400 karakter); transkrip juga dibaca dari berkas `.gz` yang
> ikut dikumpulkan agar angka byte + md5 di kepalanya sepadan dengan salinan byte-exact-nya.
> Jurnal prompt diperbarui (entri 5) dan seluruh dokumen Word di `docs/word/` diekspor ulang.
> Selengkapnya di A.18.6.

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
- (Catatan sesi lama, sudah tidak berlaku.) Smoke run aplikasi terakhir saat itu dilakukan pada
  sesi prompt 1 (slice 00) — sesi tersebut tidak menyentuh kode. **Status terbaru:** smoke run
  penuh dijalankan berulang pada 9 Oktober 2026 (lihat A.19), termasuk `verify.sh` setelah setiap
  perubahan kode.

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

---

## A.5 Slice 03 — Bank Soal, Kuis, Tag, Soal Objektif (+ perbaikan UX auth)

### A.5.1 Pagar mutu — `./verify.sh` (dari root repo)

```
=== Backend Pest ===        >>> OK   Tests: 59 passed (297 assertions)
=== Backend Pint ===        >>> OK   PASS 139 files
=== Frontend checkJs ===    >>> OK
=== Frontend ESLint ===     >>> OK   0 error, 2 warning (react-hooks/incompatible-library dari watch() RHF)
=== Frontend Vitest ===     >>> OK   21 berkas / 122 test
=== Realtime node --test ===>>> OK   2 test
verify.sh: SEMUA HIJAU
```

Tambahan: `npm run build` sukses (285 modul; `dist/assets/index-*.js` 585,23 kB, gzip 175,31 kB;
`index-*.css` 249,27 kB). Peringatan Vite "chunk > 500 kB" dicatat apa adanya dan belum ditangani.

### A.5.2 Test baru slice 03

- `backend/tests/Feature/BankSoalTest.php` (9 test): CRUD tag + keunikan nama per sekolah; guru membuat
  soal pilihan ganda dan melihat kunci di bank soal; registry menolak struktur tidak lengkap (tanpa opsi,
  kunci menunjuk opsi tak ada, tipe esai ditolak); penilai registry benar untuk empat tipe objektif;
  publikasi kuis ditolak bila belum lengkap (`soal`, `jadwal`) lalu berhasil setelah dilengkapi;
  soal terkunci saat kuis pemakainya berjalan (ubah/hapus/susun ditolak, soal bebas tetap bisa);
  murid melihat kuis terbit kelasnya tanpa kunci (`assertJsonValidationErrors` tidak; respons mentah
  dipastikan **tidak memuat** `"kunci"`); kuis draf/kelas lain tidak bisa dibuka murid (403).
- `backend/tests/Feature/AuthUxTest.php` (7 test): daftar langsung membuat sesi tetapi akun pending hanya
  boleh mengakses jalur verifikasi; kirim ulang verifikasi; daftar tetap 201 saat SMTP mati dengan
  `email_terkirim=false`; respons lupa sandi tetap identik saat SMTP mati (anti-enumerasi); tautan
  verifikasi idempoten; token reset sandi terhapus setelah dipakai sehingga pemakaian ulang ditolak;
  notifikasi terkirim saat mailer hidup.
- Vitest baru: `question/validasi.test.js` (14), `question/render/renderer.test.jsx` (17, jsdom),
  `question/skema.test.js` (7), `quiz/skema.test.js` (7), `auth/skemaDaftar.test.js` (5).

### A.5.3 Smoke browser sungguhan (Chrome CDP) — `docs/smoke-ui-slice03.mjs` — 8/8 lulus

1. Login guru lewat API sesi Sanctum (200).
2. `/tag`: menu guru lengkap (Kelas | Mapel | Murid | Bank Soal | Tag | Kuis | Pengaturan); tag "Pecahan"
   yang diketik lewat formulir muncul di tabel.
3. `/bank-soal`: guru mengisi mapel + teks + opsi A/B + kunci A + skor lewat editor, menekan "Simpan soal",
   daftar bertambah 4 → 5 baris.
4. `/kuis`: kartu kuis draf seeder tampil dengan status "Draf", 4 soal, 20 menit.
5. Guru mengisi jadwal, memilih 2 soal lewat "Susun soal", menyimpan susunan, lalu "Terbitkan" → kartu
   berubah menjadi "Belum dimulai", 5 soal, jadwal 6 Okt 2026 16.47 s.d. 17.48 (tombol Terbitkan hilang).
6. Murid uji dibuat lewat API (201) dan bisa masuk (200).
7. `/kuis` sebagai murid: menu "Ulangan Saya" dan kuis terbit kelasnya tampil.
8. `/kuis/{id}` sebagai murid: teks soal tampil dan **tidak ada kata "kunci" maupun pembahasan** di halaman.

Catatan jujur: smoke menulis data contoh ke basis data dev (tag "Pecahan", 1 soal, murid "Smoke Murid",
kuis draf seeder diterbitkan). Test backend tetap memakai basis data test terpisah.

### A.5.4 Keputusan teknis slice 03 (jujur)

- **MathML tanpa `dangerouslySetInnerHTML`**: aturan lint repo `react/no-danger: error`, jadi MathML dari
  guru diubah ke elemen React lewat `DOMParser` + daftar putih tag/atribut MathML; tag di luar daftar putih
  hanya diambil teksnya (diuji dengan `<script>` di dalam `<math>`).
- **Satu renderer untuk guru dan murid**: `RendererSoal` dipakai di editor (dengan `tampilkanKunci`) dan
  di layar murid/guru; kunci hanya muncul bila prop `tampilkanKunci` true, sehingga tidak ada renderer
  terpisah yang bisa "lupa" menyembunyikan kunci.
- **Validasi klien mencerminkan registry server** supaya guru tidak menabrak 422; server tetap penentu akhir.
  Pesan validasi dari Laravel (`errors`) ditampilkan lewat `pesanGalatApi`.
- **Format jadwal memakai `Intl.DateTimeFormat('id-ID')`**, bukan locale dayjs, karena impor locale dayjs
  membuat `tsc` (checkJs) menelusuri berkas JS tanpa tipe di `node_modules` dan gate checkJs gagal.
- **Db dev = SQLite** (`backend/database/database.sqlite`); tabel slice 03 baru dibuat dengan
  `php artisan migrate --force` sebelum seeding/demo.
- **Siswa tidak menerima kunci**: dijamin `SoalMuridResource`/`KuisMuridResource` di server dan diuji dua
  lapis (Pest memastikan JSON mentah tanpa `"kunci"`; Vitest memastikan skema murid tidak punya `kunci`).

## A.6 Slice 04 — Pengerjaan Ulangan, Penilaian Objektif, dan Hasil

### A.6.1 Pagar mutu — `./verify.sh` (dari root repo)

```
=== Backend Pest ===        >>> OK   Tests: 71 passed (391 assertions)
=== Backend Pint ===        >>> OK   PASS 156 files
=== Frontend checkJs ===    >>> OK
=== Frontend ESLint ===     >>> OK   0 error, 2 warning (react-hooks/incompatible-library dari watch() RHF)
=== Frontend Vitest ===     >>> OK   24 berkas / 146 test
=== Realtime node --test ===>>> OK   2 test
verify.sh: SEMUA HIJAU
```

Tambahan: `npm run build` sukses (`dist/assets/index-*.js` 600,82 kB, gzip 179,78 kB).
Peringatan Vite "chunk > 500 kB" masih ada dan belum ditangani.

### A.6.2 Test baru slice 04

- `backend/tests/Feature/AttemptTest.php` (12 test / 94 assertion): mulai attempt + deadline server +
  tanpa kunci; satu attempt aktif per murid (idempoten); pengacakan soal stabil dan opsi berpermutasi;
  IDOR ditolak di 4 endpoint; guru tidak bisa mulai tetapi bisa melihat hasil; jawaban tersimpan satu
  baris, bisa diperbarui, dan pulih dari DB; jawaban ditolak setelah deadline dan untuk soal di luar kuis;
  kumpulkan menilai + idempoten + menolak jawaban sesudahnya; terlambat ≤120 detik dinilai, >120 detik 422;
  soal rusak (tipe tak dikenal) berstatus `gagal` tetapi soal lain tetap dinilai; hasil tanpa kunci/pembahasan;
  kuis kelas lain 403 dan kuis di luar jadwal 422.
- Vitest baru: `attempt/hitungMundur.test.js` (9), `attempt/simpananJawaban.test.js` (6, jsdom),
  `attempt/skema.test.js` (6), dan 3 test konversi jadwal di `quiz/skema.test.js`.

### A.6.3 Smoke browser sungguhan (Chrome CDP) — `docs/smoke-ui-slice04.mjs` — 13/13 lulus

1. Login guru (200); guru menjadwalkan ulang kuis terbit agar sedang berjalan (200).
2. Login murid (200); daftar ulangan menampilkan tombol "Kerjakan sekarang".
3. `/kerjakan/1`: timer tampil `20:00`, soal tampil, **tanpa kata kunci/pembahasan**.
4. Respons `POST /v1/kuis/1/mulai` diperiksa mentah: **tidak memuat** `kunci` maupun `pembahasan`.
5. Klik opsi kunci → autosave terkirim; `GET /v1/attempt/1` memuat jawaban `"C"`.
6. Penghitung "Terjawab 1 / 5" bertambah; "Kumpulkan jawaban" mengarahkan ke `/hasil/2`.
7. Halaman hasil menampilkan skor; server melaporkan skor 1/8, benar 1, belum dijawab 4, tanpa lencana kunci.
8. Kumpulkan ulang (idempoten) tetap 200 dan hasil tidak berubah; menjawab sesudah dikumpulkan ditolak (403).

### A.6.4 Bug yang ditemukan dan diperbaiki — jadwal bergeser 7 jam

`config('app.timezone') = UTC`, sedangkan `<input type="datetime-local">` mengirim waktu lokal tanpa
offset. Jadwal yang diisi guru tersimpan 7 jam lebih lambat dari yang dimaksud sehingga murid melihat
"Kuis belum dimulai" (bukti: jadwal 09:47 UTC tampil sebagai "16.47"). Perbaikan di sisi kirim:
`keIso()`/`keLokal()` di `frontend/src/sections/quiz/status.js`, dipakai `HalamanKuis.jsx`, dan diuji
Vitest (konversi lokal → UTC, input kosong/tidak valid, dan bolak-balik ISO → lokal → ISO).

### A.6.5 Keputusan teknis slice 04 (jujur)

- **Semua keputusan di server**: urutan soal/opsi (seed per attempt), skor, deadline, dan status `terlambat`
  ditentukan backend; timer di klien hanya tampilan dan dikoreksi `server_now`.
- **Tanpa `additional()` pada resource**: karena `withoutWrapping()` dipakai, `additional()` memaksa
  pembungkus `data`; data tambahan ditaruh sebagai properti publik pada class resource.
- **Payload jawaban berbentuk daftar** `[{question_id, jawaban}]`, bukan peta, agar kunci numerik aman di JSON.
- **Submit idempoten**: kunci idempotensi per attempt dari klien + `lockForUpdate` di server; dobel klik
  atau dua tab tidak menggandakan hasil.
- **Fail-open di klien**: `BatasGalatUlangan.jsx` (react-error-boundary) mencegah satu galat render
  mematikan seluruh aplikasi.

## A.7 Slice 05 — Skor Asli, Retry, Ranking, Badge, Remedial, dan Laporan per Tema

### A.7.1 Pagar mutu — `./verify.sh` (dari root repo)

```
=== Backend Pest ===        >>> OK   Tests: 79 passed (491 assertions)
=== Backend Pint ===        >>> OK   PASS 166 files
=== Frontend checkJs ===    >>> OK
=== Frontend ESLint ===     >>> OK   0 error, 2 warning (react-hooks/incompatible-library dari watch() RHF)
=== Frontend Vitest ===     >>> OK   25 berkas / 156 test
=== Realtime node --test ===>>> OK   2 test
verify.sh: SEMUA HIJAU
```

Tambahan: `npm run build` sukses (`dist/assets/index-*.js` 615,37 kB, gzip 182,43 kB; `index-*.css` 250,11 kB).
Peringatan Vite "chunk > 500 kB" masih ada dan belum ditangani.

### A.7.2 Test baru slice 05

- `backend/tests/Feature/Slice05Test.php` (8 test / 100 assertion): respons `mulai` memuat `attempt_no` & `asli`;
  retry menambah `attempt_no` **tanpa mengubah skor asli** (baris percobaan pertama tetap, hanya satu baris `asli`);
  retry mengikuti saklar `retry` dan `batas_percobaan` (422 dengan pesan berbeda);
  ranking hanya memakai skor asli dengan tie-break waktu selesai lebih cepat lalu nama, `top N` dipotong, saklar
  `ranking` menyembunyikan isi dari murid (bawaan mati) tetapi guru tetap melihat, lalu peringkat murid tampil
  setelah saklar dinyalakan; badge per mapel terbentuk dari rata-rata skor asli (100% → emas);
  remedial menyusun latihan dari tema lemah, payload tanpa `"kunci"`, dan **tidak** menambah attempt sehingga skor
  asli utuh, serta saklar `remedial` mematikan rekomendasi tanpa menghapus riwayat; laporan per tema mengikuti
  ambang guru (50% → `paham`) dan murid selalu 403; guru tidak punya badge/progres (403).
- Vitest baru: `report/tampilan.test.js` (9 test) untuk `tingkatTampilan`, `kelasLencana`, `ringkasTingkat`,
  `urutkanPeringkat` (skor menurun, seri → waktu selesai → nama), `milikMurid`, dan skema Zod peringkat/progres.
- **Catatan pagar mutu**: `backend/phpunit.xml` kini menyetel `memory_limit=512M`. Suite bertambah ke 79 test
  dan 500-baris impor CSV membuat proses menyentuh batas bawaan 128M (fatal "Allowed memory size exhausted"
  setelah `HealthTest`). Ini penyesuaian sumber daya, bukan pelonggaran asersi.

### A.7.3 Smoke browser sungguhan (Chrome CDP) — `docs/smoke-ui-slice05.mjs` — 17/17 lulus

1. Login guru (200); guru menjadwalkan ulang kuis terbit agar sedang berjalan (200).
2. Guru menyalakan `retry`, menaikkan `batas_percobaan`, dan **mematikan** `ranking` lewat `PUT /v1/pengaturan`.
3. Login murid (200); saklar ranking mati → `GET /v1/kuis/1/ranking` mengembalikan `tampil:false` dan `peringkat:[]`.
4. Murid mulai ulang kuis → `attempt_no` bertambah (>1) dan `asli:false`; skor ulang tercatat sebagai baris terpisah.
5. Halaman `/hasil/:id` menautkan **Peringkat** dan **Progres tema**.
6. `/peringkat/1` memberi tahu "ranking sedang dimatikan guru"; `/progres-tema` menampilkan ambang + "Latihan
   remedial"; `/badge` menampilkan lencana per mapel — ketiganya dirender browser sungguhan.
7. `GET /v1/progres/saya`: tema berlabel tingkat (`belum_paham`) dan soal remedial tanpa kunci (3 soal).
8. Guru menyalakan `ranking` → `GET /v1/kuis/1/ranking` memakai **attempt asli** (attempt 1), attempt retry
   (attempt 4) tidak ada di daftar; guru tidak punya `peringkat_saya`.
9. `GET /v1/kuis/1/laporan`: status 200 dengan ambang 80% dan dua murid sekelas; halaman `/kuis/1/laporan`
   menampilkan "Laporan Tema" dan catatan "hanya nilai asli" (murid 403).
10. Murid membuka `/peringkat/1` setelah saklar menyala: tabel tampil, baris sendiri disorot (`.sorot-hangat`).

Keluaran terakhir:

```
LULUS · ranking memakai attempt asli, bukan attempt ulang · peringkat attempt 1 · retry attempt 4 · skor asli 1
LULUS · halaman peringkat menampilkan tabel dan menyorot baris murid · baris disorot 1
smoke slice 05: 17/17 lulus
```

### A.7.4 Keputusan teknis slice 05 (jujur)

- **Skor asli = baris, bukan kolom yang bisa berubah.** Kolom `attempt_no` + `asli` (migrasi
  `2026_10_06_000012`) membuat percobaan pertama tetap utuh; ranking menyaring `jenis='ulangan' AND asli=1`.
  Tidak ada jalur dari klien untuk menyentuh baris itu — `AttemptPolicy` tetap menolak `jawab`/`kumpulkan`
  pada attempt yang bukan milik murid, dan `simpanJawaban` menolak attempt yang sudah dikumpulkan.
- **Saklar `ranking` bawaan mati** (chunk slice-05 & `docs/penjelasan-fitur.md`). Guru tetap bisa melihat
  peringkat untuk keperluan laporan; murid hanya melihat saat saklar menyala. `RankingService` mengembalikan
  `tampil` supaya klien bisa menjelaskan alasannya, bukan sekadar 403 tanpa konteks.
- **Remedial bersifat baca-saja.** `RemedialService` hanya menyusun daftar soal dari tema lemah (dan melewati
  soal yang sudah pernah dijawab benar); tidak ada penulisan ke `attempts`/`answers`, sehingga mustahil mengubah
  skor asli.
- **Ambang laporan ikut pengaturan tiga lapis.** Kunci baru `ambang_paham` (bawaan 80), `ambang_mulai_paham`
  (60), dan `data_minimum_tag` (3) divalidasi 0–100 untuk ambang; tingkat `data_belum_cukup` mencegah label
  "belum paham" hanya dari satu-dua soal.
- **Section baru `Report`** menampung Ranking/Badge/Remedial/Laporan (controller hanya bicara dengan service,
  tanpa fasade `DB`), mengikuti aturan "kode fitur berada di `Sections`".
- **Perbaikan data dev**: dua attempt lama slice 04 masih `asli=1` (kolomnya baru ditambahkan dengan nilai
  bawaan `true`) sehingga satu murid muncul dua kali di peringkat; baris kedua dirapikan menjadi
  `attempt_no=2, asli=false` sebelum smoke.

## A.8 Rapikan Lokasi Berkas Uji + Dokumentasi Penanda

### A.8.1 Berkas uji frontend dipusatkan di `src/__tests__/`

Sebelumnya 25 berkas `*.test.js(x)` ditaruh di samping berkas sumbernya (tersebar di
`sections/`, `shared/`, `theme/`, dan akar `src/`). Atas permintaan pengguna ("rapihkan lokasi
file test, jangan di setiap folder"), seluruh berkas uji dipindahkan ke **satu lokasi terpusat**
`frontend/src/__tests__/` dengan struktur yang mencerminkan `src/`:

```
src/__tests__/icons.test.jsx
src/__tests__/theme/tema.test.js
src/__tests__/shared/{api,store,ui}/…
src/__tests__/sections/{attempt,auth,home,question,quiz,report,school,settings}/…
```

Semua spesifier impor relatif (termasuk `vi.mock('./api.js', …)` dan JSDoc `import('./api.js')`)
diperbaiki otomatis dengan menghitung ulang jalur relatif, dan `import.meta.glob` di
`theme/tema.test.js` diganti dari `'../**/*'` menjadi `'../../**/*'` supaya tetap memindai
seluruh `src/`. `jsconfig.json` tidak perlu diubah karena `include: ["src"]` sudah mencakup
`src/__tests__/`.

Hasil setelah pemindahan (dijalankan, bukan diklaim):

```
=== Frontend checkJs ===    >>> OK
=== Frontend ESLint ===     >>> OK   0 error, 2 warning lama
=== Frontend Vitest ===     >>> OK   25 berkas / 156 test
./verify.sh: SEMUA HIJAU (Pest 79 passed / 491 assertions, Pint PASS 166 files, realtime 2 test)
```

Kebiasaan ini dicatat di `AGENT.md` bagian Pagar Mutu: berkas uji frontend terpusat di
`src/__tests__/`, backend di `backend/tests/`, realtime di `realtime/test/`.

### A.8.2 Berkas penanda pengguna dimasukkan ke dokumentasi utama

Dua berkas penanda di `docs/log-mentah/` (`log_claude(tambahkan ke main dokumentasion.txt` dan
`promt_claude.txt`) berisi hasil kerja AI lain yang merombak UI/UX slice 00–02 **di luar
repository**, beserta prompt yang dikirim ke AI tersebut. Isinya dimasukkan **apa adanya** ke
dokumentasi utama:

- `docs/log-mentah/2026-10-06-log-claude-ui-baru.md` — log pekerjaan itu, dengan keterangan
  jujur bahwa pekerjaan dilakukan di luar repo memakai salinan zip lalu disalin masuk, dan
  bahwa tidak ada klaim di dalamnya yang dianggap bukti (harus diverifikasi ulang di repo ini).
- `docs/log-mentah/2026-10-06-prompt-claude-ui-baru.md` — promptnya, apa adanya.
- Keduanya otomatis ikut ke **`docs/log-mentah/log-mentah.docx`** (log mentah utama) karena
  `export_word_sesi.py` menyertakan seluruh `docs/log-mentah/*.md`.
- Prompt Claude juga dilampirkan sebagai prompt ketiga di **`docs/word/AGENT.docx` + `AGENT.md`**
  (`export-word.sh` diperbarui: `PROMPT_V3`), dan diarsipkan sebagai
  `docs/word-arsip/(ARSIP) prompt-claude.docx`.

Verifikasi isi dokumen Word setelah ekspor ulang (dibaca dari `word/document.xml`):
`log-mentah.docx` memuat `log-claude-ui-baru`, `prompt-claude-ui-baru`, dan "rombak UI/UX slice 00";
`AGENT.docx` memuat `prompt-claude-ui-baru` dan kalimat prompt aslinya. Berkas `.txt` asli
dibiarkan utuh (tidak dihapus) sebagai jejak berkas penanda.

## A.9 Slice 06 — Delapan Tipe Soal, Penilaian Teks, dan Koreksi Manual Ber-token

### A.9.1 Pagar mutu — `./verify.sh` (dari root repo)

```
=== Backend Pest ===        >>> OK   Tests: 88 passed (598 assertions)
=== Backend Pint ===        >>> OK   PASS 182 files
=== Frontend checkJs ===    >>> OK
=== Frontend ESLint ===     >>> OK   0 error, 2 warning lama (react-hooks/incompatible-library dari watch() RHF)
=== Frontend Vitest ===     >>> OK   27 berkas / 193 test
=== Realtime node --test ===>>> OK   2 test
verify.sh: SEMUA HIJAU
```

Tambahan: `npm run build` sukses (305 modul; `index-*.js` 638,17 kB gzip 187,14 kB, `index-*.css` 250,11 kB;
peringatan Vite "chunk > 500 kB" masih ada dan belum ditangani).

### A.9.2 Test baru slice 06

- **Backend** — `backend/tests/Feature/Slice06Test.php` (9 test / 104 assertion): registry delapan tipe
  (isian singkat & uraian `bertingkat()`, uraian bukan `objektif()`); isian singkat — normalisasi
  (huruf besar/tanda baca), sinonim, toleransi typo per kata; angka harus persis (`12` = `12.0`, bukan `13`,
  `1/2` ≠ `0,5`, `12` bukan `120`), sinonim kata pada kunci angka diterima, penjaga negasi menolak
  "tidak"/"bukan"; uraian — kata kunci berbobot memberi skor parsial dan di bawah ambang ditandai
  `perlu_tinjau`; letak kata & hubung kata dinilai lewat registry; ulangan bertingkat menilai otomatis
  lalu menandai yang perlu ditinjau; antrean koreksi hanya berisi attempt terkumpul dan memuat kunci;
  koreksi butuh token sekali pakai + alasan ≥ 10 karakter; koreksi menghitung ulang total attempt dari baris
  jawaban dan menulis activity log `koreksi_nilai`.
- **Vitest** — 2 berkas baru dan 2 berkas lama diperbarui (total 27 berkas / 193 test, dari 25/156):
  - `sections/question/render/renderer.test.jsx` (+29 test): 4 renderer baru (isian singkat, uraian,
    letak kata, hubung kata) — kendali yang sesuai, kunci hanya saat `tampilkanKunci`, nilai murid dipakai
    ulang; `RendererSoal` mengarahkan tipe baru ke renderer bertingkat dan tetap menjelaskan tipe tak dikenal.
    Dua tes lama ("tipe `uraian` belum didukung") diperbarui karena kini tipe itu justru didukung.
  - `sections/question/validasi.test.js` (+28 test): state/konten/kunci untuk 4 tipe baru (termasuk
    `angka_persis:false`, negasi, bobot kata kunci, sinonim uraian), `stateDariSoal` membuka soal tersimpan
    dari server, aturan penolakan tiap tipe, bantuan `pisahKata`/`sinonimUraianDariTeks`/`teksDariSinonimUraian`.
    Tes lama "menolak tipe esai yang belum didukung" dihapus karena aturannya sudah tidak ada.
  - `sections/scoring/tampilan.test.js` (6 test) — `jawabanTeks` (null/kosong/boolean/angka/daftar/peta),
    `ringkasKunci`, `kelasStatus`.
  - `sections/scoring/api.test.js` (5 test) — skema Zod antrean koreksi, token, dan hasil koreksi
    (termasuk penolakan item yang kehilangan bidang wajib).

### A.9.3 Smoke browser sungguhan (Chrome CDP) — `docs/smoke-ui-slice06.mjs` — 27/27 lulus

Skrip menjalankan alur lengkap lewat Chrome asli (bukan hanya API), dan **idempoten** (soal smoke dipakai
ulang bila sudah ada, kuis dilonggarkan dulu sebelum susunannya diubah):

1. Guru menyimpan **empat soal baru** (isian singkat, uraian, letak kata, hubung kata) lewat `POST /v1/soal`
   → semua `201`, lalu dibaca ulang `GET /v1/soal/{id}` untuk memastikan konten + kunci utuh di server.
2. Guru menggabungkan soal itu ke kuis demo (`PUT /v1/kuis/{id}/soal` → 9 soal) dan menjadwalkannya berjalan.
3. Halaman **detail kuis** (guru) menampilkan keempat label tipe baru + tombol **Koreksi manual**.
4. Murid membuka `/kerjakan/{kuisId}`: kendali yang muncul sesuai tipe (1 kotak teks isian, 1 kotak uraian,
   4 daftar pilih untuk letak kata & hubung kata) — dihitung dari DOM sungguhan.
5. Murid menjawab: isian `sembilan` (lewat **sinonim**), uraian `tidak tahu`, letak kata benar, hubung kata
   tertukar. Jawaban berbentuk peta diterima server (200).
6. Layar kerja dimuat ulang → jawaban uraian muncul kembali di kotak teks (`"tidak tahu"`).
7. Hasil penilaian otomatis: isian **4/4** (sinonim), letak kata **4/4**, hubung kata **0/4**, uraian
   ditandai **perlu_tinjau** (`benar: null`) alih-alih dihukum nol.
8. Antrean koreksi guru memuat baris uraian itu beserta kuncinya dan `alasan_min: 10`.
9. **Koreksi lewat UI sungguhan**: guru mengisi skor + alasan, menekan **Minta token konfirmasi**
   (muncul "Token konfirmasi aktif sampai …"), lalu **Simpan koreksi** → baris itu hilang dari antrean dan
   nilai uraian menjadi 6/6 (`status: dinilai`).
10. Penjaga token di API: alasan `pendek` → **422**; token asli `ttl_detik: 300`; token palsu → **422**;
    token yang sudah dipakai → **422**; koreksi kedua (skor 5) sukses dan total attempt dihitung ulang
    (14 → 13); skor total tetap di atas skor sebelum koreksi (8 → 13).

Keluaran terakhir:

```
LULUS · isian singkat dinilai benar lewat sinonim · skor 4
LULUS · uraian yang belum cocok kata kuncinya ditandai perlu ditinjau, bukan dihukum nol · status perlu_tinjau
LULUS · UI menerbitkan token konfirmasi setelah alasan diisi
LULUS · token sekali pakai tidak bisa dipakai dua kali · status 422
smoke slice 06: 27/27 lulus
```

### A.9.4 Bug yang ditemukan dan diperbaiki — kunci angka mematikan sinonimnya

Smoke putaran pertama gagal pada satu butir: **isian singkat skor 0** padahal jawaban `sembilan` ada di
daftar sinonim kunci `9`. Penyebabnya `PenanganIsianSingkat::kemiripanTerbaik()` memeriksa `angkaCocok()`
terhadap **gabungan semua kandidat satu indeks**, sehingga kandidat angka menutup kandidat kata — kolom
"sinonim" di editor jadi tidak ada gunanya untuk soal ber-kunci angka.

Perbaikan: pemeriksaan dipindah **per kandidat** (`b8525aa`). Kandidat angka tetap wajib persis (`12` tidak
lolos untuk `120` — ini penting karena kemiripan huruf `12` vs `120` justru 80% dan akan lolos tanpa
penjaga), sedangkan kandidat kata dibandingkan dengan toleransi typo seperti biasa. Ditambahkan asersi
regresi di `Slice06Test` (4 assertion baru) dan smoke diulang → **27/27 lulus**.

### A.9.5 Keputusan teknis slice 06 (jujur)

- **Dua rute penilaian, satu router.** `PenilaiSoal` mengarahkan tipe objektif ke `PenilaianObjektif` dan
  sisanya (isian singkat, uraian) ke `PenilaianTeks`; keduanya tidak pernah melempar exception — satu soal
  bermasalah hanya menjadi status `gagal` pada baris itu, bukan 500 untuk seluruh ulangan.
- **Uraian belum dinilai AI.** Tahap kata kunci berbobot hanya bisa menyimpulkan "dinilai" atau
  "perlu_tinjau"; penilaian bahasa (AI) menyusul di slice 09 sesuai chunk. Guru tetap pemutus akhir lewat
  antrean koreksi.
- **Perubahan nilai wajib dua langkah.** `confirmation_tokens` menyimpan hash token (bukan token mentah),
  berlaku 300 detik, sekali pakai, terikat `attempt_id` + `question_id`, dan alasan koreksi minimal 10
  karakter. Setiap koreksi menulis activity log `koreksi_nilai` berisi skor sebelum/sesudah + alasan, dan
  total attempt **dihitung ulang** dari jumlah baris jawaban (`hitungUlang()`), bukan ditambah manual.
- **Data dev ikut berubah karena smoke.** Empat soal smoke (`SMOKE-06 …`, id 6–9) kini ada di bank soal dan
  **terpasang di kuis "Latihan Operasi Hitung"** sehingga demo punya soal bertingkat; satu baris jawaban
  uraian juga sudah ditandai "sudah dikoreksi". Ini disengaja supaya halaman koreksi punya isi saat demo —
  bukan kekeliruan data.
- **Waktu & zona waktu**: token memakai `Carbon::now()` (UTC) seperti sisa aplikasi; `expires_at` dikirim
  ISO8601 dan ditampilkan klien dengan `toLocaleTimeString('id-ID')`.

### A.9.6 Yang belum diuji

- **Mode gelap, cache L1, xlsx, Octane, dan deploy (slice 10)** belum dikerjakan — deploy ditunda atas
  permintaan pengguna ("tunda dulu, fokus fitur").
- **Presence/anti-cheat realtime (slice 07)** dan **materi + kuis sisipan F2 (slice 08)** belum dikerjakan;
  folder `frontend/src/sections/{cheat,presence}` masih kosong.
- **Uji beban/taraf besar** (mis. 40 murid serentak) belum dijalankan.

---

## A.10 Audit Library & Kualitas Kode Slice 01 — Verdict dan Perbaikan

### A.10.1 Sumber audit

Pengguna menyerahkan `laporan-audit-slice-01.md` (audit statis atas snapshot zip: `src_2.zip`, `backend_3.zip`,
`Arsip_4.zip`). Laporan itu dibuat **dari snapshot lama**, jadi sebagian temuannya sudah tidak berlaku di
kode sekarang. Seluruh temuan diuji ulang terhadap kode berjalan sebelum diputuskan; hasilnya di bawah.
Laporan aslinya (utuh) diarsipkan di `docs/log-mentah/2026-10-06-audit-library-kualitas-slice-01.md`.

### A.10.2 Verdict tiap temuan

| # | Verdict terhadap kode sekarang | Tindakan |
|---|---|---|
| B1 | **Nyata, tetapi bukan 500.** `PasswordBroker::reset()` hanya menerima 2 argumen (dicek di vendor `PasswordBroker.php:122`), jadi closure ke-3 diabaikan; tak ada `createUrlUsing` → `route('password.reset')` tidak ada. Galatnya **ditelan fail-open** oleh `PengirimEmail`, jadi gejalanya bukan error, melainkan **lupa sandi diam-diam tidak pernah sampai**. | **Diperbaiki** |
| B2 | **Nyata** — `unique:users,email` di `DaftarMuridRequest` membocorkan email terdaftar lewat 422. | **Dipertahankan sadar + dicatat jujur** (lihat A.10.4) |
| B3 | **Nyata** — `VerifyEmailService` selalu menulis `status = Aktif`. | **Diperbaiki** |
| B4 | **Sudah beres** — `pulihkanSesi` sudah ada dan dipanggil di `App.jsx`. | Tidak ada perubahan |
| B5 | **Sudah beres** — `pasangListenerSesi` punya penanda `listenerTerpasang`. | Tidak ada perubahan |
| B6 | **Risiko laten saja** — semua request memakai `baseURL: '/api'` (satu origin), dan Axios 1.x tetap mengirim header XSRF bila same-origin. | Diperkuat lewat K9 (lihat di bawah) |
| K1 | **Nyata** — `expect('App\Sections\Http\Controllers')` menunjuk namespace yang tidak ada → test lolos tanpa memeriksa apa pun. | **Diperbaiki** |
| K2 | **Nyata** (selisih waktu login). | **Diperbaiki** |
| K3 | **Nyata** (throttle hanya per `ip|email`). | **Diperbaiki** |
| K4 | **Nyata** — `User::query()` langsung di controller. | **Diperbaiki** |
| K5 | **Nyata** — `$alasan` tidak dipakai. | **Diperbaiki** |
| K6 | **Sudah tidak ada** — ternary dua cabang identik sudah hilang. | Tidak ada perubahan |
| K7 | **Nyata** — closure `/v1/sesi` menolak `route:cache`. | **Diperbaiki** |
| K8 | **Nyata** — peran ditulis di dua tempat (`role` + Spatie). | **Diperbaiki** |
| K9 | **Nyata** — `ambilCsrfCookie()` sebelum setiap request; `toLowerCase()` berulang. | **Diperbaiki** |
| K10 | **Nyata** — `(bool)` berlebih, `terapkan(array)` bertipe longgar, sesi lama tidak dicabut setelah reset sandi. | **Diperbaiki** |
| P1 | **Nyata** — sisa scaffold Tailwind/Vite di backend. | **Diperbaiki** |
| P2 | **Sebagian usang** — `league/csv`, `query-builder`, `activitylog` **sudah dipakai** oleh slice 02/06; Octane & Debugbar memang belum (baru slice 10). | Dicatat |
| P3 | **Sebagian usang** — `backend/.env` tidak ter-track (di `.gitignore`); `verify.sh` & `jsconfig.json` sudah ada. `vite-env.d.ts` **sengaja dipertahankan** (lihat A.10.5). | Dicatat |

### A.10.3 Yang diperbaiki

**B1 — tautan reset sandi menuju frontend.** `ResetPassword::createUrlUsing()` didaftarkan di
`AppServiceProvider::boot()` dan membangun `{frontend_url}/atur-ulang-sandi?token=…&email=…`. Closure ke-3 yang
tidak pernah dipanggil di `PasswordResetService::terapkan()` dihapus. Bukti: `AuthTest` kini mengambil
notifikasi tanpa `Notification::fake()` untuk URL-nya dan memastikan URL diawali `FRONTEND_URL` (sekaligus
memastikan callback benar-benar terdaftar, dibaca lewat `ReflectionProperty`).

**B3 — akun suspended tidak dihidupkan tautan verifikasi.** `VerifyEmailService::verifikasi()` sekarang
idempoten dan **hanya menaikkan status dari `Pending`**; status lain (`Suspended`, `Dihapus`) tetap, meski
`email_verified_at` boleh diisi. Bukti: test "verifikasi tidak mengaktifkan akun suspended".

**K2, K3, K4, K5.** `LoginService` memanggil `Hash::check($password, self::sandiDummy())` saat user tidak ada
(hash dummy di-memoize sekali) sehingga waktu respons login seragam; `$alasan` yang tidak dipakai dibuang.
Throttle `auth` kini **dua batas** — `5/menit` per `ip|email` dan `20/menit` per IP — supaya penyerang yang
berganti-ganti email dari satu alamat tetap terbatas. Penelusuran email pada kirim-ulang verifikasi dipindah
dari controller ke `VerifyEmailService::kirimUlangPublik()`; controller tidak lagi menyentuh model `User`.

**K7 — `route:cache`.** Closure `/v1/sesi` diganti controller invokable `CekSesiController` (rute dinamai
`sesi`). Terbukti `php artisan route:cache` sukses (menulis `bootstrap/cache/routes-v7.php`), lalu di-clear.

**K8 — satu penulis peran.** Ditambahkan `User::tetapkanPeran(string)` sebagai **satu-satunya** penulis kolom
`role` + role Spatie (`forceFill` + `syncRoles`). Dipakai oleh `RegisterService`, `MuridService`, dan
`ImporMuridService`; parameter `Role` yang tadinya disuntikkan ke service dihapus. `UserFactory` memanggilnya
lewat `afterCreating` sehingga seeder & factory tetap sinkron. Bukti: test "peran sinkron di semua jalur"
membandingkan kolom `role` dengan `getRoleNames()` untuk jalur daftar, buat murid, dan impor.

**K9 — klien CSRF frontend.** `ambilCsrfCookie()` sekarang menyimpan **janji** cookie (in-flight) alih-alih
memanggil ulang setiap request, tidak menyimpan kegagalan, dan interceptor 419 memanggil `lupakanCsrfCookie()`
untuk memaksa ambil ulang. Normalisasi email dipusatkan di helper `emailBersih()` (trim + lowercase)
dan di skema Zod (`validasi.js` auth & school). Bukti: 3 test baru di blok "cache cookie CSRF" +
test normalisasi email.

**K10 — detail keras.** Cast `(bool)` berlebih dibuang. `PasswordResetService::terapkan()` kini menerima
**argumen bernama** (`$email, $token, $password`) alih-alih `array` longgar. Setelah reset sandi,
`remember_token` dicabut (`Str::random(60)`) dan baris `sessions` milik user dihapus bila
`SESSION_DRIVER=database` — jadi sesi lama di perangkat lain ikut berakhir, bukan hanya kata sandinya berubah.
Bukti: test "reset sandi mencabut sesi lain + remember_token".

**K1 — arch test yang benar-benar memeriksa.** `ArchitectureTest.php` ditulis ulang: helper
`namespaceController()` memindai folder controller yang benar-benar ada
(`glob(dirname(__DIR__, 2).'/app/Sections/*/Http/Controllers')`) — `app_path()` **tidak boleh dipakai** di
berkas arch karena container belum siap (fatal `Call to undefined method Illuminate\Container\Container::path()`).
Ada test pengaman bahwa namespace terdeteksi (bukan daftar kosong), lalu
`not->toUse([DB::class, Cache::class, Log::class, Schema::class])` untuk setiap controller. Terbukti tidak ada
controller yang melanggar aturan `chunks/quality-gates.json` ("controller tidak memanggil `DB::` langsung").

**P1 — scaffold dibersihkan.** `backend/resources/` (css/js/views) dan `backend/vite.config.js` dihapus
(`git rm -r`); `backend/package.json` ditulis ulang menjadi delegasi tipis ke frontend
(`npm --prefix ../frontend …`); `composer.json` script `setup` memakai `npm --prefix ../frontend`; dan
`routes/web.php` tidak lagi menyajikan halaman selamat datang bawaan Laravel — root backend **mengalihkan ke
frontend** (`GET http://127.0.0.1:8000/` → `302 → http://localhost:5173/`).

### A.10.4 Keputusan yang dipertahankan sadar — B2 (jujur)

Temuan B2 benar: pendaftaran dengan email yang sudah terdaftar membalas **422** berisi pesan validasi,
sedangkan email baru membalas **201**, sehingga email terdaftar bisa ditebak. Ini memang bertentangan dengan
klaim anti-enumerasi di `RegisterService::pesanResponsDaftar()` dan aturan keamanan #9 `AGENT.md`.

Namun alur pendaftaran yang disetujui pengguna pada slice 01 adalah **langsung masuk setelah daftar**
(auto-login). Kalau `unique` dihapus dan email terdaftar dibalas 201 dengan pesan yang sama (seperti usulan
audit), maka pemilik email itu **tidak bisa login** — dan pengguna yang salah mengetik email miliknya sendiri
akan bingung karena "daftar sukses" tetapi tidak masuk. Pilihan yang diambil pengguna:

> **Pertahankan 422 + catat jujur.**

Jadi B2 **tidak diperbaiki**; ia didokumentasikan terbuka di sini dan di `docs/catatan-demo.md`. Unique index
di database tetap menjadi pengaman terakhir. Perbaikan penuh (pola "kami sudah kirim email ke alamat itu"
tanpa auto-login) menunggu keputusan produk, dan sengaja tidak dikerjakan di sini agar tidak mengubah alur
yang sudah disepakati.

### A.10.5 Temuan tambahan dari pemeriksaan ulang

- **`dompurify`, `jszip`, `@tanstack/react-virtual` belum dipakai.** Ini wajar (fiturnya belum ada: materi,
  ekspor, daftar panjang). DOMPurify **tidak dibutuhkan** untuk soal saat ini karena `MediaSoal.jsx` memakai
  `DOMParser` + whitelist sendiri + aturan ESLint `react/no-danger`, dan sudah ada test XSS. Tetap dicatat
  sebagai ketergantungan yang menunggu pakai.
- **Laravel Pail & Pao tetap dipertahankan** meski di luar daftar stack: keduanya menopang `composer dev`,
  `php artisan dev`, dan `php artisan pail` yang benar-benar dipakai untuk pengembangan. Ini justifikasi
  yang diminta aturan P1.
- **`frontend/src/vite-env.d.ts` sengaja tidak dihapus.** Meski proyek ini JS-only, `jsconfig.json` tidak
  menyetel `types` sendiri, sehingga baris `/// <reference types="vite/client" />` di berkas itulah yang
  mengetik `import.meta.env` untuk `npm run check`. Menghapusnya akan memerahkan gate `checkJs`.

### A.10.6 Pagar mutu setelah perbaikan

```
=== Backend Pest ===        >>> OK   Tests: 95 passed (629 assertions)
=== Backend Pint ===        >>> OK   PASS 183 files
=== Frontend checkJs ===    >>> OK
=== Frontend ESLint ===     >>> OK   0 error, 2 warning lama (react-hooks/incompatible-library dari watch() RHF)
=== Frontend Vitest ===     >>> OK   27 berkas / 197 test
=== Realtime node --test ===>>> OK   2 test
verify.sh: SEMUA HIJAU
```

Tambahan yang dijalankan sekali jalan di akhir: `npm run build` sukses (305 modul; `index-*.js` 638,28 kB
gzip 187,18 kB; `index-*.css` 250,11 kB) — peringatan Vite "chunk > 500 kB" masih ada dan belum ditangani;
`php artisan route:cache` sukses; `GET http://127.0.0.1:8000/` → `302 → http://localhost:5173/`.

Test baru putaran ini: **7 test backend** (6 di `AuthTest` — URL reset ke frontend, callback terdaftar,
suspended tidak diaktifkan, daftar email terdaftar 422 sebagai dokumentasi trade-off B2, reset mencabut sesi +
`remember_token`, peran sinkron di semua jalur — dan 1 di `HealthTest` untuk root redirect) serta
**4 test frontend** (3 di `shared/api/client.test.js` blok cache cookie CSRF, 1 di
`sections/auth/validasi.test.js` untuk normalisasi email).

### A.10.7 Yang masih jujur belum dikerjakan

- **B2 dibiarkan** sesuai keputusan pengguna (A.10.4).
- **P2** — `laravel/octane` dan Debugbar memang belum dipasang; keduanya baru relevan di slice 10.
  `activitylog`, `query-builder`, dan `league/csv` **sudah** dipakai sehingga temuan P2 untuk paket itu usang.
- **P3** — `backend/.env` tidak pernah masuk git; bila zip lama pernah dibagikan, `php artisan key:generate`
  perlu dijalankan sekali oleh pemilik repo (tidak bisa dilakukan otomatis di sini karena akan mengubah
  kunci lokal aplikasi).
- Peringatan Vite "chunk > 500 kB", uji beban, serta **slice 07–10** masih belum dikerjakan seperti tercatat
  di A.9.6. (Sebagian sudah tertutup oleh A.11 di bawah.)

---

## A.11 Slice 07 — Anti-cheat, Presence, dan Live Monitor

### A.11.1 Pagar mutu — `./verify.sh` (dari root repo)

```
=== Backend Pest ===        >>> OK   Tests: 107 passed (740 assertions)
=== Backend Pint ===        >>> OK   PASS 203 files
=== Frontend checkJs ===    >>> OK
=== Frontend ESLint ===     >>> OK   0 error, 2 warning lama (react-hooks/incompatible-library dari watch() RHF)
=== Frontend Vitest ===     >>> OK   29 berkas / 209 test
=== Realtime node --test ===>>> OK   3 suite / 9 test (2 lama + 7 baru)
verify.sh: SEMUA HIJAU
```

### A.11.2 Yang dibangun

**Anti-cheat (server).** Section `Cheat`: `KategoriKecurangan` (9 kategori dari perangkat murid + 4 kategori
turunan server dengan skor risiko acuan), `StatusTinjauan`, model `KejadianKecurangan` yang **append-only**
(perubahan selain `review_status`/`reviewed_by`/`reviewed_at` ditolak di model, penghapusan ditolak),
`KecuranganService` (tulis berkelompok maks 50, dedupe lewat sidik `attempt_id + sidik` unik, baca untuk guru,
tinjau + activity log), policy, dua Form Request, resource, dan controller.

**Anti-cheat (klien).** Folder `src/security/`: `pengaturanProteksi.js` (pembacaan saklar + preset `exam_mode`),
`pengirimKejadian.js` (dedupe cooldown 1,2 detik, kelompok maks 50, antrean offline maks 200 entri/48 jam,
retry hanya untuk tanpa respons/5xx/408/429, buang pada 4xx lain), orkestrator `useExamSecurity`,
dan `ModalProteksi.jsx` sebagai **pemberitahuan, bukan gerbang**.

**Presence.** Section `Presence`: `PresenceService` (kehadiran dari aktivitas normal, ambang segar 45 detik,
deteksi **sesi ganda**, pencatatan **lama tidak aktif**), `SapuPresence` + penjadwalan tiap menit,
`MonitorService` (snapshot: presence + progres + ringkasan kecurangan), `TokenSseService` (tiket sekali pakai,
hash saja, TTL 45 detik), `PenyiarRealtime` (publish pub/sub), dan tiga controller.

**Live Monitor + SSE.** Halaman guru `/kuis/:id/monitor` dengan **polling 5 detik yang selalu jalan** sebagai
jalur utama-keselamatan, plus SSE dari service Node bila tersedia (polling melambat jadi 20 detik).
Service Node mendapat endpoint `GET /sse/monitor?tiket=…`: handshake tiket diambil atomik dari Redis
(`GETDEL`), tanpa kredensial database, cek Origin, `X-Accel-Buffering: no`, dan keepalive 20 detik.

### A.11.3 Dua bug nyata yang ditemukan pengujian (dan diperbaiki)

1. **Tiket SSE tidak pernah ditemukan service Node.** Laravel memberi prefix pada kunci Redis
   (`ulangan-sekolah-database-sse:tiket:…`) sementara Node mencari `sse:tiket:…` — handshake selalu 401.
   **Perbaikan:** koneksi Redis khusus `realtime` di `config/database.php` dengan `prefix => ''`, dipakai
   hanya untuk jalur ke Node. Kanal pub/sub sendiri tidak pernah diberi prefix, jadi siaran tetap jalan.
2. **Menutup layar Live Monitor mematikan seluruh service realtime.** Saat klien pergi, pembersihan memanggil
   `unsubscribe()` lalu `disconnect()`. ioredis menolak promise yang belum selesai (`Connection is closed.`)
   tanpa penangkap → **proses Node keluar**. Efek nyatanya: satu guru menutup tab, semua guru kehilangan
   aliran. **Perbaikan:** penutupan dijaga sekali jalan, semua promise ditangani, memakai `quit()` yang
   menyelesaikan antrean lebih dulu, dan koneksi langganan diberi penangkap `error` sendiri. Ditambahkan
   test regresi (9 test Node) dan **smoke membuktikannya** — service tetap hidup setelah aliran ditutup.

### A.11.4 Smoke browser sungguhan (Chrome CDP) — `docs/smoke-ui-slice07.mjs` — 21/21 lulus

Skrip membuka jendela baru, menyalakan proteksi lewat API, lalu memakai antarmuka seperti manusia:

1. Guru menyalakan `anti_cheat`, `block_paste`, `block_tab_switch` pada **lapis kuis** dan membuka jendela
   jadwal kuis sementara (dipulihkan di akhir).
2. Murid mengerjakan: server mengirim 11 saklar proteksi, dan **modal pemberitahuan muncul** di DOM;
   setelah ditutup, ulangan tetap bisa dilanjutkan (bukti "bukan gerbang").
3. Murid menempel teks → kejadian `paste_attempt` **tercatat di server** (dibuktikan dari antrean guru).
4. Guru membuka `/kuis/:id/monitor`: daftar murid tampil, status **Hadir** terbaca dari aktivitas normal
   (tanpa heartbeat), dan panel catatan menampilkan "Percobaan menempel jawaban".
5. Guru menekan **Tidak valid** di DOM → catatan keluar dari antrean menunggu dan status berubah di server.
6. Aliran SSE dari Node: **200**, memuat `event: siap` dengan `quiz_id` yang benar, header anti-buffer
   terpasang, dan **tiket yang sama ditolak pada pemakaian kedua** (401).
7. Di akhir, pengaturan proteksi dikembalikan **mati** dan jadwal kuis dipulihkan seperti semula.

### A.11.5 Keputusan teknis slice 07 (jujur)

- **Saklar induk `anti_cheat` diubah menjadi mati secara bawaan.** Chunk anticheat menulis "semua proteksi
  default mati", sedangkan kode slice 02 dulu menyalakannya. Akibat perubahan ini, satu asersi di
  `PengaturanTest` (yang mengunci `anti_cheat = true`) ikut diperbarui — bukan untuk meloloskan test, tetapi
  karena nilai bawaannya memang harus sesuai chunk. Saklar rinci juga otomatis dianggap mati bila induknya mati.
- **Presence disimpan sebagai satu peta per kuis**, bukan satu kunci Redis per attempt. Alasannya: satu
  pembacaan mengambil seluruh daftar (40 murid) alih-alih 40 kunci berurutan, dan tetap cocok dengan driver
  cache yang dipakai di dev/test sementara tetap ramah Redis di produksi. Isi dan semantiknya sama seperti
  yang diminta chunk: `last_seen` dengan ambang 45 detik; tab yang disembunyikan tetap dianggap hadir.
  *(Cara penyimpanannya diganti di A.22: satu hash Redis per kuis, satu medan per murid.)*
- **Penjadwal tidak bisa 10 detik.** Sapuan presence dijadwalkan tiap menit (batas cron Laravel) **dan**
  dijalankan setiap kali guru membuka Live Monitor, sehingga status yang dilihat guru tetap segar tanpa
  menyalahi jadwal yang mungkin dijalankan.
- **Kategori turunan server tidak bisa dikirim klien.** `duplicate_session`, `long_offline`, `late_submit`,
  dan `clock_jump` ditolak di validasi maupun di service — ini menutup celah murid "menuduh dirinya sendiri"
  dengan kategori berat untuk mengaburkan catatan.
- **`@tanstack/react-virtual` tetap belum dipakai.** Pada skala nyata (satu kelas, ±40 baris) daftar biasa
  sudah benar dan lebih sederhana; memaksakan virtualisasi hanya menambah risiko tanpa manfaat. Catatan ini
  menggantikan janji di A.10.5 yang menyebut paket itu menunggu fitur daftar panjang.

### A.11.6 Yang jujur BELUM dikerjakan di slice 07

- **Layar guru ke perangkat murid** (sinkron nomor blok/posisi lewat SSE) belum ada; ia bergantung pada materi
  berblok (slice 08) dan sengaja ditunda bersama fitur itu.
- **Deteksi tamper lanjutan** (canary, deteksi overlay asing, pemeriksaan `Function.prototype.toString`)
  belum ditulis **pada saat slice 07**; ia menyusul di A.53 lewat saklar `detect_tamper` (default mati, di
  luar preset `exam_mode`) dan mengirim `dom_injection`/`extension_detected`. Kategori `tamper_suspected`
  tetap **turunan server**, dan sisi server yang menurunkannya (denyut ber-nonce + sapuan) menyusul di
  **A.54** — jadi sejak itu ia benar-benar aktif, tetapi **hanya bila guru menyalakan proteksi**.
- **`fullscreen_exit`** belum dideteksi (tidak ada penanganan Fullscreen API), dan saklar
  `block_screenshot` untuk saat ini hanya menangkap tombol PrintScreen + mengaburkan layar; heuristik
  tiga jari/daya-volume yang disebut chunk belum ada.
- **`call_gate` (panggilan Zoom/Meet) dan `protected_text_canvas`** tidak dibuat — keduanya ditandai opsional
  dan dipotong lebih dulu menurut chunk.
- **Deteksi IP sama antar murid** (salah satu butir chunk) belum ada.
- **Uji beban dan koneksi SSE terhadap nginx sungguhan** belum dijalankan; verifikasi SSE masih di dev
  (`localhost:5173` → Node `:4000`).

## A.12 Slice 08 — Materi Berblok, Berkas Aman, Avatar, dan Moderasi

Dikerjakan dalam tiga commit terpisah (backend materi, frontend materi, avatar & moderasi), masing-masing
dengan pagar mutu hijau.

### A.12.1 Perintah dan hasil
- `./verify.sh` dari root → **SEMUA HIJAU** (log terakhir `/tmp/verify-avatar.log`).
- `php artisan test` → **130 passed (983 assertions)**; tambahan `Slice08Test` (8 test / 108 assertion)
  dan `Slice08AvatarTest` (10 test / 104 assertion).
- `./vendor/bin/pint --test` → PASS (238 berkas).
- `npm run check` (tsc `checkJs` strict) → lolos; `npm run lint` → 0 error, 2 warning lama
  (`react-hooks/incompatible-library` dari `watch()` React Hook Form di dua halaman auth).
- `npx vitest run` → 31 berkas uji; tambahan `src/__tests__/sections/avatar/api.test.js` (12 test).
- `node --test` (realtime) → 11 test lulus.

### A.12.2 Yang diuji (bukti perilaku dari test, bukan klaim)
**Materi berblok (`Slice08Test`)** — kategori berkas ditentukan magic bytes; berkas berisiko diunduh paksa
sebagai `.upload`; hash potongan yang tidak cocok ditolak; URL bertanda tangan yang kedaluwarsa → 403;
sapuan unggahan yatim menghapus baris + berkasnya; urutan blok wajib ditegakkan server (lompat blok → 422);
blok kuis membuat attempt `latihan` lewat mesin kuis yang sama (bukan skor asli, tidak masuk ranking);
laporan tema memuat skor latihan; retry kuis sisipan mengikuti pengaturan tiga lapis; blok kuis bersoal
uraian atau kelas lain ditolak.

**Avatar & moderasi (`Slice08AvatarTest`)** — PNG asli diencode ulang jadi JPEG 256×256 dengan nama berkas
acak; **SVG ditolak** walau dinamai `.png`; batas ukuran ditegakkan; laporan ganda dari murid yang sama tidak
menambah hitungan; ambang 3 laporan unik menyembunyikan avatar dari murid lain sementara pemiliknya tetap
melihatnya (dan tetap mendapat URL gambarnya); guru melihat antrean beserta laporan tiap pelapor;
**pulihkan** dan **hapus** tercatat di `activity_log` (log_name `avatar`, causer guru,
`properties.catatan`); berkas fisik terhapus setelah moderasi hapus dan URL bertanda tangannya mati (404);
avatar yang menunggu tinjauan tidak bisa dihapus pemiliknya (bukti tidak hilang sebelum guru melihatnya).

### A.12.3 Yang jujur BELUM dikerjakan di slice 08
- **Layar guru ke perangkat murid** (sinkron konten/nomor blok lewat SSE) belum dibuat; baru kunci
  pengaturannya yang ada. Disebut apa adanya di `docs/penjelasan-fitur.md` bagian 6.
  (Pembaruannya: kini sudah dibuat sebagai penyiaran **keadaan konten yang dipilih guru** — lihat A.14.5;
  ikut berpindah mengikuti halaman/blok materi yang dibuka guru tetap belum ada.)
- **Smoke UI Chrome (CDP) slice 08 belum dijalankan.** Berbeda dari slice 02–07 yang masing-masing punya
  `docs/smoke-ui-sliceNN.mjs`, pembuktian slice 08 masih pada tingkat test otomatis (Pest + Vitest).
- **Kuota penyimpanan sekolah belum diuji dengan berkas nyata berukuran besar**; yang diuji baru perhitungan
  dan penolakannya pada tingkat unit/feature.

## A.13 Slice 09 — Lampiran Jawaban, Saran AI, dan Mode Tim

Dikerjakan dalam tiga bagian: 09-A (unggah lampiran jawaban), 09-B (saran penilaian AI lewat queue), dan
09-C (mode tim).

### A.13.1 Perintah dan hasil
- `./verify.sh` dari root → **SEMUA HIJAU** (log terakhir `/tmp/verify-slice09c.log`, exit 0).
- `php artisan test` → **154 passed (1256 assertions)**; tambahan `Slice09UploadTest` (10 test / 98 assertion),
  `Slice09AiTest` (8 test / 83 assertion), dan `Slice09TimTest` (6 test / 92 assertion).
- `./vendor/bin/pint --test` → PASS (287 berkas).
- `npm run check` (tsc `checkJs` strict) → lolos; `npx eslint` pada berkas attempt/report/scoring → 0 error.
- `npx vitest run` → 33 berkas uji; tambahan `src/__tests__/sections/attempt/lampiran.test.js` (14 test) dan
  `src/__tests__/sections/attempt/tim.test.js` (8 test), plus penambahan pada uji scoring (8+8 test) dan
  peringkat (`tampilan.test.js` 13 test).
- `node --test` (realtime) → 11 test lulus.

### A.13.2 Yang diuji pada 09-A (bukti perilaku, bukan klaim)
**Gambar kanvas di-encode ulang jadi PNG di server** dengan nama berkas acak dan hash SHA-256 yang cocok;
**unggahan setelah deadline ditolak**, begitu pula potongan yang dikirim setelah deadline; **rekam diri**
hanya terbuka bila saklar sekolah menyala dan durasinya dibatasi 60 detik; batas 10 MiB dan maksimal 3
lampiran per soal ditegakkan; berkas dengan magic bytes `PK` (arsip) diunduh sebagai `.upload`, bukan
ditampilkan; potongan dengan hash tidak cocok ditolak (bukti unggahan bisa dilanjutkan tanpa korup);
sapuan unggahan yatim menghapus baris + berkasnya; **murid lain 403, guru bukan pemilik 403** tetapi guru
pemilik tetap bisa melihat daftar lampiran; URL lampiran yang kedaluwarsa → 403.

### A.13.3 Yang diuji pada 09-B (bukti perilaku, bukan klaim)
**Skor AI dipotong ke rentang soal** — model diuji mengembalikan 999 dan −5, tersimpan 4.0 dan 0.0 sesuai
skor maksimal soal; **skor final tidak pernah berubah karena AI** (`skor` tetap 0, status tetap
`perlu_tinjau`, `dinilai_manual` tetap false); **satu permintaan per ulangan**, dan otomatis dipecah dua saat
batas soal per permintaan diturunkan ke 2; **gagal/timeout/kontrak rusak = `ai_status = gagal`**, bukan nilai
nol diam-diam; **murid tidak bisa memicu AI** (403) dan respons `/hasil` milik murid tidak memuat `skor_ai`
maupun alasan mentah AI; **kunci API hanya di header** `Authorization` (diuji tidak pernah muncul di body
permintaan); **koreksi guru tidak ditimpa** — saran baru yang datang setelah koreksi dibuang, nilai tetap 4.0;
**bawaannya mati** — mengumpulkan ulangan tidak memanggil API sama sekali (`Http::assertNothingSent`).

### A.13.4 Yang diuji pada 09-C (bukti perilaku, bukan klaim)
**Pembagian otomatis** menghasilkan tim berisi semua murid kelas, dan **setiap murid hanya ada di satu tim**
(penyusup dari tim lain ditolak 422; murid kelas lain juga ditolak); **murid tidak bisa menyentuh endpoint tim**
(403). **Satu jawaban bersama**: dua anggota tim membuka kuis → **id attempt yang sama**, dan jawaban salah satu
anggota langsung terbaca anggota lain. **Versi jawaban**: menyimpan isi yang sama berulang tidak menambah versi,
mengubah isi menaikkan versi dan mencatat pelakunya di `answer_revisions` (urutannya `[1, 2]` dengan penjawab
berbeda). **Skor dibagi sama**: setelah satu anggota mengumpulkan, badge/ulangan kedua anggota memuat skor yang
sama (100%), sedangkan anggota tim lain yang belum mengerjakan masih kosong; anggota lain juga bisa membuka
halaman hasil attempt tim. **Peringkat per tim**: kolomnya nama tim, `murid_id` null, disertai daftar anggota,
`peringkat_saya` cocok lewat `tim_id`. **Susunan dibekukan** setelah ada attempt tim (ubah/hapus → 422), dan
**mode individu tidak berubah** saat mode tim mati (`tim` null di payload, tanpa baris `answer_revisions`).

### A.13.5 Keputusan teknis slice 09-C (jujur)
- **Satu attempt per tim, bukan satu attempt per anak.** Ini yang membuat "skor dibagi rata" tidak perlu
  menggandakan baris jawaban: skor tim tinggal dibaca oleh seluruh anggotanya lewat scope `milikMurid` di
  laporan tema dan badge. Efek sampingnya sengaja diterima: pada mode tim, `attempts.student_id` hanya mencatat
  anggota yang membuka kuis lebih dulu, bukan pemilik nilai.
- **Riwayat versi hanya dicatat pada mode tim.** Pada ulangan individu tidak ada sengketa "siapa yang mengganti
  jawaban kami", jadi tabel `answer_revisions` dibiarkan kosong dan tidak menambah beban tulis.
- **Nilai tim tidak masuk ranking per murid.** Saat mode tim menyala yang diperingkat adalah tim; peringkat murid
  dan tim tidak dicampur dalam satu daftar, supaya tidak ada nama anak yang muncul dua kali dengan angka berbeda.

### A.13.6 Keputusan teknis 09-A/09-B (jujur)
- **AI tidak pernah menulis ke kolom `skor`.** Saran disimpan di kolom terpisah, sehingga tidak mungkin ada
  nilai murid yang berubah tanpa koreksi guru bertoken. Ini juga yang membuat `ActivityLog` saran AI
  (`log_name` `penilaian_ai`) terpisah dari audit koreksi manual.
- **Antrean queue `sync` dipakai apa adanya di test**, jadi jalur "kumpulkan → minta saran AI" ikut teruji
  tanpa worker terpisah. Di produksi jalur itu berjalan di `database` queue (bawaan).
- **Jawaban yang hanya berisi lampiran dilewati AI** (tidak ada teks untuk dinilai) dan tetap menunggu
  tinjauan guru — disebutkan di bagian 10 `penjelasan-fitur.md`.

### A.13.7 Yang jujur BELUM dikerjakan di slice 09
- **AI belum membaca lampiran** (gambar/rekaman) — baru soal uraian berbasis teks, termasuk pada mode tim.
- **Smoke UI Chrome (CDP) slice 09 belum dijalankan**, dan **unggahan besar lewat jaringan lambat belum
  diuji nyata**; yang diuji adalah potongan, hash, dan penolakan deadline pada tingkat test.
- **Layar guru → perangkat murid (SSE) belum dibuat** (sama seperti catatan A.12.3).
  (Pembaruannya: sekarang sudah dibuat — lihat A.14.5.)
- **Mode tim belum diuji di browser sungguhan** dan **belum ada batas jumlah anggota per tim** selain minimal 2;
  yang diuji baru perilaku server (attempt bersama, versi, skor dibagi, peringkat tim).

## A.14 Slice 10 — Ekspor Nilai (CSV), Cache Berlapis L1, Layar Guru, dan Status Fitur Sisa

Dikerjakan bertahap. Yang sudah masuk slice ini: **ekspor nilai kuis**, **cache berlapis L1**, dan
**layar guru → perangkat murid (SSE)**. Octane Swoole dan deploy masih terbuka (lihat A.14.6).

### A.14.1 Perintah dan hasil
- `./verify.sh` dari root → **SEMUA HIJAU** (log terakhir `/tmp/verify-slice10a.log`, exit 0).
- `php artisan test` → **158 passed (1291 assertions)**; tambahan `Slice10EksporTest` (4 test / 35 assertion).
- `./vendor/bin/pint --test` → PASS (289 berkas); `npm run check` → lolos; `npx vitest run` → 33 berkas uji.
  (Angka ini keadaan setelah ekspor nilai; setelah cache berlapis ditambahkan, hasil terbaru ada di A.14.4.)

### A.14.2 Yang diuji (bukti perilaku, bukan klaim)
Berkas diunduh sebagai `text/csv` dengan `Content-Disposition` berisi `.csv`; **satu baris per murid** beserta
judul kolom sampai `soal_1`; skor **asli** yang dipakai (10 dan 0 pada contoh), termasuk persennya; **nama yang
mirip rumus** (`=SUM(1+1)`) diberi awalan kutip tunggal sehingga tidak dieksekusi spreadsheet; **kuis yang
belum dikerjakan** hanya menghasilkan baris judul; **murid 403** saat mencoba mengunduh nilai kelasnya; dan
pada **mode tim** kedua anggota satu tim mendapat baris dengan nama tim serta skor tim yang sama (2 baris).

### A.14.3 Keputusan teknis (jujur)
- **CSV, bukan xlsx.** Chunk slice-10 mengizinkan CSV secara eksplisit, dan proyek sudah memakai `league/csv`.
  Menambah penulis xlsx berarti dependensi baru plus penulis format biner yang harus dirawat di tengah lomba;
  CSV tetap bisa dibuka Excel/Google Sheets. Keputusan ini dicatat di `docs/penjelasan-fitur.md` bagian 12.
- **Pengaman CSV injection dipakai bersama** dengan ekspor murid lewat `EksporMuridService::amankanSel`,
  supaya tidak ada dua aturan berbeda untuk masalah yang sama.
- **Mode gelap sudah ada sejak slice awal** (store tema + tombol + palet variabel CSS + test-nya), jadi tidak
  dibangun ulang di slice 10 — hanya statusnya yang kini dicatat di `docs/penjelasan-fitur.md` bagian 13.

### A.14.4 Cache berlapis L1 (dikerjakan setelah ekspor)
Ditambahkan pada putaran berikutnya: `app/Sections/Cache/` berisi `Contracts/LapisanCache`, `LapisanL1`
(SQLite tmpfs, WAL), `LapisanL2` (cache store Laravel/Redis), `PintuTraffic` (gerbang lalu lintas), dan
`CacheBerlapis` (orkestrator). Lapisan ini dipakai `PengaturanService` — data yang paling sering dibaca saat
ulangan berjalan.

- `./verify.sh` → **SEMUA HIJAU** (`/tmp/verify-slice10b.log`); `php artisan test` → **163 passed
  (1314 assertions)**; tambahan `Slice10CacheTest` (5 test / 23 assertion); Pint PASS (296 berkas).
- Yang diuji (bukti perilaku, bukan klaim): **urutan invalidasi** versi naik → Redis dilupakan → L1 dilupakan
  (dan salinan L1 satu ruang dibuang sekaligus) lewat lapisan palsu yang mencatat jejak pemanggilan;
  **validation check**: salinan L1 dengan versi lama **ditolak** dan dibuang, bukan dipakai;
  **L1 hanya menyala saat padat** (di bawah 2 req/s tidak diisi) dan **dibuang saat reda** (nilai tetap
  dilayani L2, bukan dibaca ulang dari database); **histeresis** di antara dua ambang (4 req/s tidak
  mematikan L1 yang sudah menyala); dan **integrasi nyata**: guru mengubah pengaturan saat L1 menyala →
  pembacaan berikutnya sudah memakai nilai baru (DB ditulis dulu, salinan L1 lama dibuang).
- Keputusan teknis (jujur): (a) objek yang di-cache saat ini **peta pengaturan per lingkup** — kandidat
  terpanas pada hari ulangan dan sudah punya titik invalidasi eksplisit; (b) gerbang trafik dihitung
  **per ruang** dan saat ini hanya ada satu ruang (`pengaturan`), jadi frasa "satu state aktif per kuis"
  pada chunk belum diterapkan per kuis; (c) pub/sub disiarkan lewat `Redis::publish` dan **belum** disambung
  ke service realtime; (d) angka ambang 10/2 req/s masih nilai bawaan, belum dikalibrasi dengan uji beban.

### A.14.5 Layar guru → perangkat murid (SSE) — dikerjakan setelah cache berlapis
Fitur terakhir dari daftar potong kini jalan. Guru mengendalikan **satu keadaan layar per kuis**
(`quiz_screens`, satu baris per kuis dengan kolom `versi` yang naik setiap perubahan) dari halaman baru
`/kuis/:id/layar`: empat mode (`kosong`, `pengumuman`, `soal` yang disorot, `hasil`), dan setiap perubahan
disiarkan ke kanal `ulangan:kuis:{id}` yang sama dengan Live Monitor.

- Berkas baru: migrasi `2026_10_07_000021_create_quiz_screens`, enum `ModeLayar`, model `LayarKuis`,
  `LayarService` (baca/ubah + siaran + pemeriksaan saklar `layar_guru`), `SimpanLayarRequest`,
  `LayarController`, policy `KuisPolicy::layar`, rute `GET/PUT /kuis/{kuis}/layar` +
  `POST /kuis/{kuis}/sse-tiket-murid`; service Node mendapat alias `GET /sse/kuis` dengan aturan tiket
  yang sama; frontend memakai modul bersama `shared/api/realtime.js` (satu sumber URL SSE + encode tiket),
  hook `useLayar` (SSE + polling), `HalamanLayar` (guru), dan `PanelLayarMurid` yang ditempel di layar
  pengerjaan ulangan.
- `./verify.sh` → **SEMUA HIJAU** (`/tmp/verify-slice10c.log`); `php artisan test` → **169 passed
  (1384 assertions)**; tambahan `Slice10LayarTest` (6 test / 70 assertion) dan dua test Node baru
  (jalur `/sse/kuis` memakai tiket dan kanal yang sama, tetap sekali pakai); Vitest 35 berkas (tambahan
  `layar.test.js` 9 test + `realtime.test.js` 2 test); Pint PASS (303 berkas).
- Yang diuji (bukti perilaku, bukan klaim): murid kelas itu **ikut mengikuti** sorotan soal dan
  pengumuman, sedangkan **kunci jawaban dan pembahasan tidak pernah ada** di payload (kolom soal ditulis
  eksplisit; schema Zod di frontend juga tidak memiliki kolom kunci sehingga bocoran sekecil apa pun
  membuat parse gagal); **murid kelas lain 403** untuk membaca layar maupun meminta tiket; **saklar
  `layar_guru` dimatikan** → guru ditolak 403 dan murid melihat `aktif: false`; mode tak dikenal, sorotan
  soal di luar kuis, dan pengumuman tanpa tulisan **ditolak 422**; setiap perubahan **menaikkan versi dan
  disiarkan** ke `ulangan:kuis:{id}` (penyiar tiruan mencatat jejak — test tidak butuh Redis); tiket murid
  **sekali pakai** dan guru tetap memakai jalur tiket Live Monitor.
- Keputusan teknis (jujur): (a) yang disinkronkan adalah **keadaan konten yang dipilih guru**, bukan salinan
  layar atau posisi bacaan materi — sesuai batasan "tanpa WebRTC" di `penjelasan-fitur.md`; (b) payload
  siaran hanya berisi pemberitahuan (`jenis`, `mode`, `versi`), perangkat murid **membaca ulang keadaan**
  dari server — bentuk pesan tidak dipercaya sebagai sumber kebenaran; (c) guru tidak memakai SSE di
  halaman kendalinya (ia sumber perubahan; polling cukup dan menghindari tiket baru terus-menerus);
  (d) frontend dibaca dua peran lewat hook yang sama supaya pola fail-open polling tidak ditulis dua kali.

### A.14.6 Yang jujur BELUM dikerjakan di slice 10
- **Octane Swoole belum dipasang.** Ekstensi `swoole` tidak tersedia di mesin pengembangan ini
  (`php -m` hanya menampilkan `pdo_sqlite`, `redis`, `sqlite3`, `zip`), jadi Octane belum bisa dijalankan
  maupun diuji kebocoran state-nya. Dicatat apa adanya, bukan diklaim jalan.
- **Deploy belum dilakukan**; atas permintaan pengguna pekerjaan diarahkan ke penyelesaian fitur dulu, dan
  pilihan host masih menunggu keputusan pengguna.
- Lanjutan layar guru (di luar janji chunk): menyorot soal di dalam halaman materi, pembahasan
  langkah-demi-langkah, dan whiteboard — dicatat di bagian 15 `penjelasan-fitur.md` sebagai yang belum.

## A.15 Perbaikan Akses Murid Baru, Alias POST, dan Tautan Reset Sekali Pakai (8 Oktober 2026)

### A.15.1 Masalah yang dilaporkan
Empat keluhan dari pemakaian nyata: (1) endpoint murid `/api/v1/avatar`, `/api/v1/progres/saya`, dan
`/api/v1/badge/saya` menjawab **403**; (2) tombol ganti foto profil (PFP) menampilkan *"This action is
unauthorized."*; (3) permintaan **POST** dari frontend ke `progres/saya` dan `badge/saya` (bukan GET)
menabrak 405/403; (4) saat tautan reset kata sandi dibuka kembali, halaman menampilkan formulir yang pasti
gagal, tanpa penjelasan.

### A.15.2 Akar masalah (dibuktikan, bukan dugaan)
- **Murid yang mendaftar sendiri tidak punya profil.** `POST /api/v1/auth/daftar` membuat baris `users`
  tetapi **tidak** membuat baris `students`. Semua endpoint murid mengambil `$user->murid` sehingga
  `null` → policy menolak → **403**. Inilah akar terbesar.
- **Guru dipanggil endpoint milik murid.** `AvatarPolicy::viewAny` semula memeriksa `murid` sehingga guru
  yang membuka `/avatar/saya` kena **403** *"This action is unauthorized."*
- **Alias POST belum ada.** Frontend mengirim POST ke `progres/saya` & `badge/saya`; rute hanya punya GET.
- **Tautan reset sekali pakai tanpa UI.** Token memang sudah ditandai terpakai, tetapi responsnya tidak
  membawa penanda apa pun ke frontend.

### A.15.3 Perbaikan
- `RegisterService::daftarMurid()` dibungkus `DB::transaction` dan memanggil `hubungkanProfilMurid()`:
  membuat kelas penampung `"Tanpa Kelas"` lewat `firstOrCreate` (satu per sekolah) lalu `Murid::create`.
  Aman bila sekolah belum ada (pendaftaran tetap sukses).
- `AvatarPolicy::viewAny` dilonggarkan menjadi `isMurid() || isGuru()`; unggah/hapus sendiri tetap khusus
  murid lewat policy `unggah`/`hapusSendiri`.
- `AvatarController::saya()` untuk non-murid mengembalikan `{'avatar': null, 'bawaan': true,
  'tidak_tersedia': true}` — rapi, bukan 403.
- `routes/api.php` menambah `POST /badge/saya` & `POST /progres/saya` sebagai alias baca-setara (dibaca,
  bukan ditulis; hanya meneruskan ke `BadgeController::saya`/`ProgresController::saya`).
- `PasswordResetService::terapkan()` menandai token dipakai lewat `Cache` (`reset-dipakai:{sha256(email)}`,
  sehari) dan menyediakan `tautanSudahDipakai()`; `PasswordResetController::aturUlang()` menambahkan
  `tautan_dipakai`. Frontend (`api.js` + `HalamanAturUlangSandi.jsx`) menampilkan kartu *"Tautan sudah
  pernah dipakai"* dengan tombol Masuk & Minta tautan baru.
- `App.jsx` menambah gerbang `HanyaMurid` untuk rute lencana & progres tema (guru diarahkan ke beranda,
  bukan menabrak 403).

### A.15.4 Pagar mutu — `./verify.sh` (dari root repo)
```
./verify.sh  →  SEMUA HIJAU  (/tmp/verify-aksesmurid2.log, exit 0)
```
- Backend Pest: **173 passed (1418 assertions)**; backend terbaru `Tests\Feature\AksesMuridBaruTest` PASS.
- Backend Pint: **PASS (304 berkas)**.
- Frontend `checkJs` (tsc): OK; ESLint: OK.
- Frontend Vitest: **36 berkas, 279 test** passed.
- Realtime `node --test`: **13 test** passed.

### A.15.5 Test baru (bukti perilaku)
- `backend/tests/Feature/AksesMuridBaruTest.php` — **4 test / 34 assertion**: (a) setelah
  `POST /daftar`, profil murid + kelas `"Tanpa Kelas"` terbentuk dan `avatar`, `avatar/saya`,
  `progres/saya` (GET+POST), `badge/saya` (GET+POST) semuanya **200**, sedangkan `POST /avatar` kosong
  **422** (bukan 403); (b) kelas penampung dibuat **sekali**, murid kedua masuk kelas yang sama;
  (c) guru mendapat respons rapi (`tidak_tersedia: true`) tetapi unggah & progres tetap **403**;
  (d) tautan reset yang sudah dipakai → `tautan_dipakai: true`, token acak → `false`.
- `frontend/src/__tests__/sections/auth/aturUlang.test.js` — **3 test**: skema menolak respons tanpa
  `message`, `tautan_dipakai` bawaan `false`, dan menerima `tautan_dipakai: true`.

### A.15.6 Smoke HTTP nyata (sesi cookie sungguhan, bukan test)
Skrip `python3 /tmp/smoke_akses.py` meniru frontend: `GET /sanctum/csrf-cookie` lalu kirim header
`X-XSRF-TOKEN`, memakai cookie jar manual. Hasil (semua **OK**):

```
= murid uji.mandiri@murid.test =
GET  avatar/saya      200     POST progres/saya  200
GET  avatar           200     GET  badge/saya    200
GET  progres/saya     200     POST badge/saya    200
POST avatar (kosong)  422  → 422 "Pilih gambar terlebih dahulu."

= guru aadmin@sekolah.test =
POST avatar (unggah)  403  (memang khusus murid)   GET avatar/saya   200
GET  avatar           200                          GET progres/saya  403
POST progres/saya     403                          GET badge/saya    403
```

### A.15.7 Temuan saat smoke (dan diperbaiki)
- **Cookie `.localhost` tidak dikirim `http.cookiejar` Python** (bukan bug aplikasi): `curl` dengan jar yang
  sama berhasil login 200. Skrip smoke diberi pengelola cookie manual; sejak itu alur penuh hijau.
- **Akun guru seeder tidak punya role Spatie.** Perubahan seeder yang belum ter-commit membuat
  `aadmin@sekolah.test` (kolom `role='guru'`) **tanpa** `assignRole('guru')`, sehingga `isGuru()` = `false`
  dan guru tetap 403 di seluruh endpoint guru. Ditambahkan `$guru->assignRole('guru');` (idempoten) dan
  role diberikan pada DB dev; setelah itu smoke guru hijau. Ini menegaskan pentingnya smoke nyata — test
  Pest memakai `User::factory()->guru()` yang role-nya selalu benar, jadi tidak menangkap celah seeder ini.

### A.15.8 Catatan jujur
- Alias POST `progres/saya` & `badge/saya` sengaja tetap **dibatasi role murid** (guru tetap 403), sesuai
  kontrak `Slice05Test` yang mengharapkan guru tidak punya badge/progres tema.
- Smoke memakai data DB dev (murid `uji.mandiri@murid.test` id 13 dengan `students` id 8) — bukan data
  produksi.

## A.16 Perbaikan Lanjutan — Murid Lama Tanpa Profil (8 Oktober 2026)

### A.16.1 Masalah lanjutan yang dilaporkan pengguna
Setelah A.15, akun murid yang **sudah ada sebelum** kelas penampung diperkenalkan tetap menampilkan
`403 Forbidden` di `/api/v1/avatar`, `/api/v1/badge/saya`, dan `/api/v1/progres/saya` saat dipakai di
browser. Akar masalah dibuktikan dari DB dev: akun yang sedang masuk (`dgcam22@gmail.com`, user id 7)
punya role Spatie `murid` tetapi **tidak punya baris `students`**. A.15 hanya mengisi profil pada jalur
`POST /daftar`; akun lama (atau yang dibuat di luar jalur itu) tetap kosong, sementara ketiga endpoint
tadi menolak `abort(403)` begitu `$user->murid === null`.

### A.16.2 Perbaikan
- `MuridService::pastikanProfil(User $user): ?Murid` — mengembalikan profil yang ada atau membuatnya
  (idempoten) di kelas penampung `"Tanpa Kelas"` lewat `firstOrCreate`; `null` hanya bila instalasi belum
  punya data sekolah. Titik kebenaran kelas penampung pindah dari `RegisterService` ke `MuridService`
  (`RegisterService::KELAS_PENAMPUNG` kini alias).
- **Satu-satunya penulis** tetap `User::tetapkanPeran`; perbaikan ini hanya menambah baris `students`.
- Dipakai ulang di `BadgeController::saya`, `ProgresController::saya`, dan `AvatarController::saya`/
  `daftar`: bila pengguna `isMurid()` dan profilnya belum ada, profil dibuat lalu permintaan diteruskan —
  bukan 403. Guru/admin **tetap** 403 pada badge/progres dan tetap dapat respons rapi di avatar.

### A.16.3 Bukti perilaku
- Test baru `AksesMuridBaruTest` → *"murid lama tanpa profil disambungkan otomatis saat mengakses fitur
  murid (bukan 403)"*: user murid tanpa baris `students` membuka `/avatar`, `/avatar/saya`,
  `/progres/saya`, `/badge/saya` semuanya **200**, dan profilnya terbentuk di kelas `"Tanpa Kelas"`.
- `./verify.sh` → **SEMUA HIJAU** (`/tmp/verify-profilmurid.log`, exit 0): Pest **174 passed
  (1424 assertions)**, Pint 304 berkas, checkJs & ESLint OK, Vitest **36 berkas/279 test**, realtime
  **13 test**.
- **Smoke HTTP nyata** dengan akun sengaja dibuat **tanpa profil** (`lama.tanpa.profil@murid.test`):
  `masuk 200`, lalu `GET /avatar` 200, `GET /avatar/saya` 200, `GET /progres/saya` 200, `POST /progres/saya`
  200, `GET /badge/saya` 200, `POST /badge/saya` 200 — dan baris `students` (class_id 4 = `"Tanpa Kelas"`)
  terbentuk di DB setelah akses pertama.

### A.16.4 Catatan jujur
- Akun pengguna yang tadinya 403 (`dgcam22@gmail.com`, id 7) **sembuh otomatis** pada permintaan
  berikutnya — tidak ada migrasi data manual. Murid lama itu muncul di kelas `"Tanpa Kelas"` sampai guru
  memindahkannya lewat halaman Murid.
- Perilaku 403 untuk guru pada `badge/saya` & `progres/saya` **dipertahankan** sesuai kontrak `Slice05Test`.

## A.17 Editor Materi "Video Editor" dengan Pratinjau Langsung (8 Oktober 2026)

### A.17.1 Permintaan
Guru ingin menyusun materi `/materi` "seperti video editor" — hasil susunannya bisa
**dilihat langsung** saat menyusun, tanpa harus menerbitkan atau membuka akun murid.

### A.17.2 Implementasi (frontend saja, kontrak API tetap)
- **Timeline klip** horizontal: setiap blok jadi klip (ikon ¶/▶/?, nomor, label tipe,
  penanda opsional) yang bisa **di-drag** untuk mengurutkan (HTML5 drag native, tanpa
  dependensi baru) dan diklik untuk memilih.
- **Monitor pratinjau**: panel kanan menampilkan blok terpilih seperti dilihat murid —
  teks dirender persis (pre-wrap), media memakai URL bertanda tangan dari daftar
  unggahan selesai (img/video/audio/PDF/unduh sesuai mime), kuis sisipan sebagai kartu
  judul + jumlah soal. Dirender dari state lokal `blok`, jadi reaksi **instan**.
- **Navigasi playhead**: tombol ← Mundur / Lanjut →, indikator "Blok X dari Y"
  (aria-live polite), klip aktif disorot stabilo + garis tepi.
- **Status "Belum tersimpan"**: badge peringatan muncul bila muatan editor berbeda dari
  data server (perbandingan `muatanBlok`), hilang setelah simpan.
- Tombol ↑/↓/Hapus **dipertahankan** (aksesibilitas keyboard), semua aria-label tetap;
  semua warna via `var(--…)` tanpa hex baru (guard `tema.test.js`).
- CSS baru di `theme.css`: `.editor-materi` (grid dua-panel ≥lg), `.timeline-klip`,
  `.klip`/`.klip-aktif`/`.klip-diseret`, `.monitor-materi`.

### A.17.3 Bukti perilaku
- `./verify.sh` → **SEMUA HIJAU**: Pest 175/1433, Pint 304, checkJs & ESLint OK
  (2 warning pre-existing react-hooks), Vitest **36 berkas/279 test**, realtime 13.
- **Smoke UI nyata** via Chrome headless CDP (`docs/tangkap-editor-materi.mjs`,
  dijalankan `docs/jalankan-bukti-editor.sh`): login guru → buka /materi → pilih materi
  → tambah blok teks → ketik teks → DOM dicek: 2 klip, klip aktif "¶ Blok 2 Teks",
  indikator "Blok 2 dari 2", dan **monitor pratinjau menampilkan teks yang baru
  diketik** (reaksi langsung terbukti).
- **Bukti visual**: `docs/log-mentah/tangkapan/editor-materi-terang.png` (74,8% kertas krem,
  klip aktif stabilo) dan `editor-materi-gelap.png` (75,2% navy gelap #0F1631) —
  diverifikasi beda lewat MD5 + analisis piksel Python (dekode PNG manual).

### A.17.4 Catatan jujur (temuan alat, bukan bug aplikasi)
- `Page.captureScreenshot` Chrome headless (v143) mengembalikan **gambar beku** bila
  diambil setelah `Page.reload` atau navigasi ke URL yang sama. Solusinya: dua putusan
  terpisah dengan navigasi URL berbeda (`?putusan=gelap`) + tema dipilih lewat jalur
  resmi aplikasi (`localStorage tema-ulangan`) sebelum navigasi.
- Cookie Sanctum berdomain `.localhost` tidak tersimpan di origin `127.0.0.1`
  (konsisten temuan A.15) — smoke harus memakai `http://localhost:5173`.
- Pratinjau media/kuis memakai data yang sudah ada di state (unggahan selesai, daftar
  kuis); blok kuis tidak menjalankan attempt sungguhan di pratinjau — itu memang
  tampilan, bukan simulator attempt.

## A.18 Putaran Audit Eksternal — 29 Temuan Dikerjakan (8 Oktober 2026)

### A.18.1 Permintaan dan cakupan
Pengguna melampirkan hasil audit statis (`audit-projectla-lomba.md`: 84 temuan — 1 kritis, 18
tinggi, 51 sedang, 14 rendah, **tanpa ada kode yang dijalankan** karena PHP tidak tersedia di
sandbox audit) dengan instruksi "cek lagi dan kerjakan progres penyelesaian bug". Berkas prompt
dan log pekerjaan audit itu disimpan apa adanya di `docs/log-mentah/eksternal/prompt-claude-eksternal.md`
dan `docs/log-mentah/eksternal/log-claude-eksternal.md` supaya asal setiap temuan bisa ditelusuri.

Isi berkas audit **tidak lengkap**: hanya 23 temuan yang membawa rincian lokasi + skenario
(U-01..U-04, Q-01..Q-19). Enam temuan lain punya ringkasan Top-10 yang skenarionya cukup jelas
(S-01, S-04, S-05, S-07, S-14, I-01) sehingga ikut dikerjakan. Sisanya (S-*, I-*, R-*, Putaran 2)
hanya berupa daftar tanpa lokasi/skenario — **tidak ditebak dan tidak diklaim selesai**.

### A.18.2 Cara kerja (per ID temuan)
1. Buka kode yang disebut temuan, pastikan bug-nya masih ada di kode **sekarang** (sebagian
   temuan audit berasal dari salinan zip lama).
2. Tulis test yang **MERAH** lebih dulu (Pest untuk backend, Vitest untuk logika murni frontend).
3. Perbaiki akar masalahnya, lalu jalankan test itu sampai **HIJAU**.
4. `./verify.sh` (Pest + Pint + checkJs + ESLint + Vitest + realtime `node --test`).
5. Commit kecil per temuan + push. Tanpa refactor di luar temuan; perubahan skema hanya lewat
   migrasi baru yang aman untuk data lama.

### A.18.3 Temuan dan perbaikannya
| ID | Inti temuan | Perbaikan | Commit |
|---|---|---|---|
| Q-01 [K] | `sisaDetik` menghitung `deadline − (sekarangMs + (server_now − sekarangMs))` sehingga waktu saling meniadakan: timer ulangan beku | Koreksi jam dihitung sekali saat respons tiba (`dataUpdatedAt`) lalu dipakai sebagai offset tetap; auto-submit akhirnya berjalan | `d04515b` |
| Q-02 [T] | `kirimAntrean` mengembalikan entri gagal tanpa pemeriksaan sehingga jawaban lama menimpa jawaban lebih baru | Antrean menyimpan nomor urut per perubahan; entri gagal hanya kembali bila tidak ada entri lebih baru; satu pengirim tunggal agar autosave & kumpul tak berjalan bersamaan | `8d259ee` |
| Q-03 [S] | `tandaiTerkirim` membuang entri tanpa membandingkan nilai | Nilai tersimpan disertakan; entri hanya dibuang bila antrean masih memuat nilai itu | `c69eb58` |
| Q-04 [T] | Efek auto-submit memanggil ulang dirinya tanpa jeda saat kumpul gagal | Kebijakan percobaan di modul murni: backoff 2s berlipat sampai 30s, maks 4 percobaan, berhenti pada 4xx permanen, lalu tombol "Coba kirim lagi" | `690be53` |
| Q-05 [S] | `gabungJawaban` menaruh salinan lokal paling akhir sehingga selalu menimpa jawaban server | Hanya entri yang masih menunggu di `belumTerkirim` yang menang atas jawaban server | `c636d04` |
| Q-06 [T] | `simpanJawaban` memeriksa status/deadline di luar transaksi dan hanya mengunci baris `jawaban` | Status, deadline, dan kepemilikan soal dibaca ulang dari baris attempt yang dikunci (`lockForUpdate`) di dalam transaksi | `475531d` |
| Q-07 [T] | Dua anggota tim menekan "Mulai" bersamaan → dua attempt aktif; yang kalah menerima 500 dari pelanggaran indeks unik | Indeks unik `(quiz_id, team_id, jenis, aktif)` lewat migrasi baru; `mulai()` menangkap `UniqueConstraintViolationException` dan mengembalikan attempt yang menang | `9bf9dd8` |
| Q-08 [S] | Deadline attempt dihitung dari durasi kuis saja sehingga bisa melewati jadwal selesai kuis | `deadlineAttempt()` memotong deadline pada `selesai_at` kuis | `bfe9e49` |
| Q-09 [T] | Kunci/skor soal dibaca hidup → sunting bank soal mengubah nilai attempt lama; hapus soal ikut menghapus jawaban (`cascadeOnDelete`) | `snapshot_soal` (acak soal + daftar soal lengkap) diisi saat `mulai` dan dipakai untuk menyajikan & menilai; `SoalService::hapus` menolak (422) menghapus soal yang sudah dijawab | `ed0edcc` |
| Q-10 [S] | `jawab` dan unggah lampiran ditolak sedetik setelah deadline, `kumpulkan` masih menerima +120 detik | Ketiganya memakai satu toleransi `TENGGAT_TERLAMBAT` | `41bd0d9` |
| Q-11 [T] | Penilaian isian singkat: imbuhan pembalik ("invertebrata" vs "vertebrata") lolos, ambang guru tak berpengaruh pada jawaban satu kata, kata baku berulang bernilai 1,0, dan daftar negasi tak memuat bentuk sehari-hari | `melawanAntonim()` (kata dasar wajib persis, minimal 4 huruf), kemiripan huruf sungguhan per kata, penyebut memakai panjang asli jawaban, negasi `tak/nggak/gak/ga/belum/non`; jalur khusus "12" = "12.0" dipertahankan | `5c5740e` |
| Q-12 [S] | `payloadSoal` membaca `acak_opsi` hidup dari kuis sehingga ulangan yang sedang berjalan berubah saat halaman dimuat ulang | `acak_opsi` ikut masuk snapshot attempt dan dibaca dari sana (fallback setelan hidup untuk attempt lama) | `5eae341` |
| Q-13 [S] | Sapuan `tutupSemuaBasi` berhenti pada galat pertama sehingga attempt basi sesudahnya menumpuk | Tiap attempt dibungkus try/catch, galat dilaporkan, dan hitungan hanya memuat attempt yang benar-benar ditutup | `c191d87` |
| Q-14 [S] | Attempt tim (banyak anggota, satu lembar) dicatat `duplicate_session` berisiko 8 | Deteksi sesi ganda dilewati untuk attempt ber-`team_id`; `PresenceService::lupakan()` dipanggil saat attempt ditutup | `44ef14f`, `d935aca` |
| Q-15 [R] | `Attempt::soalTerurut()` mati dan pasti fatal; `ALASAN_MIN` hanya ditegakkan di Form Request; alias POST menumpang di controller reset sandi | Kode mati dihapus, aturan koreksi ditegakkan di `KoreksiService`, alias dipindah ke `ProgresController`/`BadgeController` | `d935aca` |
| Q-16 [S] | Ekspor tanpa BOM dan hanya koma → Excel Indonesia menampilkan nama rusak; impor berkas `;`/ANSI gagal | Helper baru `CsvExcel` (deteksi pemisah `,`/`;`/tab, konversi Windows-1252, BOM UTF-8), endpoint ekspor menerima `?delimiter=`, ekspor nilai memakai jam WIB + urutan `strcasecmp` | `e31c79e` |
| Q-17 [S] | Impor murid menulis per batch → galat di tengah meninggalkan data separuh dan melempar 500 tanpa laporan | Impor dibungkus satu transaksi (gagal di tengah menggulung seluruhnya) dan laporan galat per baris menggantikan 500 | `e31c79e` |
| Q-18 [S] | Ekspor nilai & peringkat tim membaca keanggotaan hidup → nilai historis berubah saat murid keluar/tim dihapus/akun dihapus | Tabel baru `attempt_members` (migrasi `2026_10_08_000003`) di-snapshot saat attempt tim dibuat, dipakai ekspor/peringkat/penelusuran; attempt lama tetap dilayani dari data hidup | `ebc1c20` |
| Q-19 [R] | Elemen jawaban berupa array dipaksa `(string)` → `ErrorException: Array to string conversion` sehingga soal berstatus gagal (bisa disalahgunakan murid); penghitung "Terjawab" menghitung isian kosong | Penjagaan skalar di `PenanganMenjodohkan`/`PenanganMengurutkan` (jawaban salah bentuk dinilai salah) + helper `ringkasanJawaban.js` (`adaJawaban`, `hitungTerjawab`) | `4ae9254` |
| U-01 [S] | Media soal boleh URL host mana pun (IP & Referer anak terkirim ke pihak ketiga), tanpa `onError`/dimensi/alt bermakna | Allowlist host (`config/media.php` + `BantuanKonten::mediaAman`), `onError` → keterangan pengganti, `width`/`height` cadangan, `alt` per soal | `f98cd43` |
| U-02 [S] | Overlay kunci layar hanya menutupi secara visual; soal di belakangnya tetap bisa difokus & diisi | Kontainer soal di-`inert`, overlay `role="alertdialog" aria-modal`, fokus dipindah ke dialog lalu dikembalikan | `1d1095f` |
| U-03 [S] | Kegagalan membuka ulangan selalu satu teks umum; `retry: 1` mengulang POST `mulai` yang ditolak 422 | Pesan server ditampilkan apa adanya, galat jaringan/5xx menawarkan "Coba lagi", retry hanya untuk galat sementara | `1d1095f` |
| U-04 [R] | Judul/nama tim panjang tanpa spasi meluber; tidak ada indikator memuat | Utilitas `.teks-patah` + indikator memuat ber-`aria-busy` | `1d1095f` |
| S-01 [S] | Throttle `auth` 20/menit per IP: murid ke-21 satu kelas di balik NAT sekolah langsung 429 | Batas per IP dinaikkan ke 120/menit; batas per akun+IP (5/menit) dipertahankan | `7fd13f7` |
| S-04/S-05 [S] | Semua guru setara: guru mana pun bisa mengubah kuis/soal/setelan anti-cheat dan mengoreksi nilai guru lain | `User::bolehKelola($pemilikId)` (admin boleh semua, guru hanya baris buatannya) dipakai `KuisPolicy`, `SoalPolicy`, `AttemptPolicy::koreksi`, dan `PengaturanPolicy` berlingkup; baris lama ber-`dibuat_oleh` NULL sengaja tetap boleh | `2880cf4` |
| S-07 [S] | Batas 2 MiB pada berkas gambar tidak menahan piksel: PNG kecil bisa meminta memori raksasa saat didekode | Dimensi dibaca dari header (`getimagesizefromstring`) dan ditolak bila melewati `avatar.batas_piksel` (24 juta piksel) sebelum didekode | `9d54105` |
| S-14 [S] | Keluar hanya menyetel `user: null`: cache TanStack Query, cadangan jawaban di localStorage, dan penanda klien HTTP tetap tersisa untuk murid berikutnya | `bersihkanJejakSesi()` dipanggil pada keluar sengaja dan sesi habis (401/419); klien query dipindah ke `shared/store/klienQuery.js`; `bersihkanSemua()` di `useSimpananJawaban` | `52c9d4b` |
| I-01 [—] | `dariLapisanTahanLama` tidak memeriksa `versi` dan `LapisanL2` menyimpan `forever` → pengaturan basi bisa bertahan selamanya | Salinan lapisan tahan lama dipakai hanya bila versinya sama dengan versi terkini (versi diambil SEBELUM sumber dibaca), plus TTL 1800 detik sebagai jaring pengaman | `93a528f` |

### A.18.4 Hasil verifikasi
- Tiap temuan diuji sendiri sebelum lanjut: test baru **merah** di kode lama, **hijau** setelah
  perbaikan; Pest naik bertahap 176 → 178 → 180 → 183 → 184 → 189 → 191 → 195 → 211 test.
- Penutup putaran, `./verify.sh` **HIJAU** (`verify.sh: SEMUA HIJAU`):
  Pest **211 passed (1670 assertions)** · Pint **OK** · `npm run check` (checkJs) **OK** ·
  ESLint **0 error, 2 warning lama** (`react-hooks/incompatible-library` dari `watch()` RHF di
  `HalamanDaftar.jsx`/`HalamanMasuk.jsx`) · Vitest **41 berkas / 327 test** · realtime
  `node --test` **13 test, 0 gagal**.
- Migrasi baru `2026_10_08_000003_create_attempt_members_table.php` sudah dijalankan di DB dev;
  deploy berikutnya butuh `php artisan migrate --force`.

### A.18.5 Batasan jujur (yang sengaja tidak dikerjakan / belum diuji otomatis)
- **61 temuan sisanya tidak dikerjakan** karena berkas audit tidak memuat lokasi/skenarionya;
  temuan SSE/service Node tidak bisa diperiksa karena kodenya tidak ada di unggahan audit.
- **U-02 dan U-04 belum punya test DOM otomatis** — proyek belum memakai
  `@testing-library/react`; keduanya diverifikasi lewat checkJs, ESLint, dan pemeriksaan markup.
- **Q-19 sub-item "login pakai NIS"** (saran produk di audit) sengaja tidak dikerjakan karena
  menambah jalur autentikasi baru di luar cakupan bug.
- **Q-15 `idempotency_key`** tersimpan tetapi tidak dipakai pembanding masih dibiarkan —
  mengubahnya berisiko pada perilaku kumpul-ganda yang sudah diuji.
- **Q-14** hanya menutup bukti palsu untuk attempt tim; dua tab dalam satu browser/efek login
  ulang tidak terpisahkan di sisi server (session id sama).
- Penandaan ID di dua pesan commit bertumpuk: `5eae341` menulis "(Q-09)" sedangkan `ed0edcc` juga
  "(Q-09)"; keduanya temuan berbeda di audit (snapshot soal vs `acak_opsi` hidup), dan isi
  perbaikannya sesuai tabel di atas.
- Dua celah kepatuhan lomba masih terbuka dan dicatat apa adanya: **belum ada deploy publik** dan
  **Octane Swoole** belum jalan (ekstensi `swoole` tidak ada di mesin dev).

### A.18.6 Perapian dokumen (8 Oktober 2026)
Permintaan pengguna: "perbaiki docs nya — untuk prompt pakai `docs`, untuk log pakai yang
benar-benar mentah, dan yang ada ringkasan di Word". Yang dikerjakan:
- **Prompt**: tetap satu tempat di `docs/` (`jurnal-prompt.md` untuk 5 entri jurnal, `log-mentah/`
  untuk seluruh prompt & jawaban mentah); tidak ada teks prompt yang dipindah keluar dari `docs/`.
- **Log mentah**: `docs/log-mentah/2026-10-05T07-39-24.876Z/chat-messages.json.gz` disegarkan dari sesi asli
  (207 pesan saat itu, salinan byte-exact) dan transkripnya kini **utuh tanpa potong** — sebelumnya setiap argumen
  panggilan alat dipotong di 400 karakter. Transkrip juga dibaca dari berkas `.gz` yang ikut
  dikumpulkan, sehingga angka byte + md5 di kepalanya benar-benar sepadan dengan salinan mentahnya
  (sebelumnya dihitung dari berkas sesi yang masih hidup dan bisa berbeda).
- **Ringkasan di Word**: `docs/word/` diekspor ulang (`AGENT.docx`, `jurnal-prompt.docx`,
  `log-mentah.docx`, `penjelasan-fitur.docx`, `catatan-demo.docx`, `laporan-pengujian.docx`).

### A.18.7 Rujukan log mentah
`docs/log-mentah/2026-10-05T07-39-24.876Z/transkrip.md` (dan salinan byte-exact
`docs/log-mentah/2026-10-05T07-39-24.876Z/chat-messages.json.gz`): `2026-10-08 ±15.30–19.45 WIB` (audit satu per ID sampai
`verify.sh` hijau + ekspor Word) dan `2026-10-08 ±20.10 WIB` (perapian dokumen).

## A.19 Pematangan & Pengujian Ulang Menyeluruh (9 Oktober 2026)

Permintaan pengguna: "mulai matangkan dan kau test masing-masing fitur dan pastikan udah sesuai".
Yang dikerjakan: menyalakan layanan sungguhan (backend `:8000`, realtime `:4000`, vite `:5173`,
Chrome CDP `:9333`), menjalankan **semua** pagar mutu dan skrip uji yang ada di repo, memperbaiki
skrip uji yang tuntutannya tidak lagi sesuai dengan kontrak nyata, lalu menutup cacat UI yang
ditemukan audit.

### A.19.1 Perintah dan hasil (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `./verify.sh` (dari root) | **SEMUA HIJAU** — Pest **213 passed (1693 assertions)** · Pint **312 files PASS** · checkJs **OK** · ESLint **0 error, 2 warning lama** · Vitest **41 berkas / 329 test** · realtime **13 test, 0 gagal** |
| `node docs/smoke-http-fitur.mjs` | **229/229 lulus, 0 gagal** (16 bagian A–P, 20.8–84.9 detik tergantung cache) |
| `node docs/audit-ui.mjs` | **44 tampilan BERSIH, 0 cacat** (`{}`) — hp 390×844 + laptop 1366×900 |
| `node docs/smoke-ui-slice03..07` | **8/8 · 13/13 · 17/17 · 27/27 · 21/21 lulus** |
| `node docs/smoke-ui-cdp.mjs` | login guru 200 + kelas/mapel/murid/impor/pengaturan terender |
| `npm run build` | sukses (`index-*.css` 258,03 kB · `index-*.js` 730,90 kB) — peringatan "chunk > 500 kB" Vite lama, dicatat apa adanya |
| `php artisan db:seed --force` | mengisi ulang data demo (`BankSoalSeeder` idempoten) agar smoke UI punya kuis ujian |

### A.19.2 Yang diperbaiki pada putaran ini

**Kode aplikasi (nyata, bukan dokumen uji):**

| Berkas | Perbaikan | Alasan |
| --- | --- | --- |
| `frontend/src/theme/theme.css` | `.form-check` & `.form-check-label` minimal 44 px; `.soal-opsi .form-check-input` 1,35 rem; kelas baru `.tautan-jari` (padding blok 0,65 rem) | Audit UI menemukan **107 sasaran sentuh < 44 px** di halaman Kerjakan kuis (radio opsi 17×17, kotak centang 15×15) — terlalu kecil untuk jari anak SD |
| `frontend/src/sections/attempt/HalamanKerjakan.jsx` | Tautan "Kembali ke daftar" memakai `.tautan-jari` | Tautan 17 px tinggi tidak layak jadi sasaran jari |
| `backend/app/Sections/Cheat/Enums/KategoriKecurangan.php` | Komentar enum diperbaiki | Komentar lama menyebut `tamper_suspected` sebagai kategori turunan server, padahal chunk anti-cheat menaruhnya di daftar kategori KLIEN — menyesatkan pembaca berikutnya |
| `backend/database/seeders/RolesAndAdminSeeder.php` | Penegasan akun guru kedua + peran | Guru kedua dipakai uji kepemilikan (guru lain menolak mengubah milik orang lain) |
| `backend/tests/Feature/Slice09TimTest.php` | Test baru **Q-18**: ekspor nilai memakai snapshot anggota tim | Uji nyata bahwa mengubah nama anak/nama tim setelah ujian **tidak** mengubah buku nilai |

**Skrip uji (tuntutan diselaraskan dengan kontrak nyata, bukan dilonggarkan):**

| Berkas | Perbaikan |
| --- | --- |
| `docs/audit-ui.mjs` | (a) Isian yang sengaja disembunyikan (`visually-hidden`/`sr-only`, mis. `input[type=file]` pengganti tombol "Lampirkan berkas") tidak lagi dihitung sebagai sasaran sentuh — yang diaudit tombolnya. (b) Kotak centang/radio kini diukur lewat **kotak labelnya** (label `for=` atau label pembungkus), sesuai WCAG 2.5.8 "Target Size" — sebelumnya hanya dilewati mentah tanpa diukur, sekarang justru lebih ketat |
| `docs/smoke-ui-slice03.mjs` | Jumlah soal dibaca dari `meta.total` API (daftar Bank Soal berpaginasi 50/halaman — jumlah baris tabel bukan ukuran bank soal); soal baru juga dipastikan terbaca di halaman pertama + toast "Soal ditambahkan". Kartu kuis tidak lagi menuntut status "Draf" (skrip ini dipakai ulang antar-jalan, jadi status bisa sudah "Sedang berjalan") |
| `docs/smoke-http-fitur.mjs` | Tujuh penyesuaian assertion agar sesuai kontrak nyata: mode tim butuh pengaturan `mode_tim` dinyalakan dulu; `hadir`/`kejadian` hanya untuk attempt yang masih jalan; ukuran unggahan harus ukuran sebenarnya; berkas hanya keluar lewat URL bertanda tangan; `lapor` avatar hanya untuk murid (kategori turunan server ditolak 422, kategori klien diterima) |

Pint juga menegur satu gaya di test baru (`single_quote` pada `substr_count($csv, ",2,")`); diperbaiki
menjadi kutip tunggal lalu pint hijau.

### A.19.3 Temuan yang jujur dicatat

- **Skrip smoke UI bergantung data demo.** `smoke-ui-slice03` (dan kuis uji `Latihan Operasi
  Hitung (draf)`) membutuhkan `php artisan db:seed`; pada basis data yang belum di-seed, uji ini
  gagal bukan karena aplikasi rusak. Ketergantungan itu dicatat di sini alih-alih disembunyikan.
- **`Node --watch`/`php artisan serve` tidak tahan pembersihan proses latar.** Dua kali layanan
  mati setelah perintah lain selesai sehingga `fetch failed`; dijalankan ulang sebagai proses latar
  yang dipantau (`lsof` diperiksa) sebelum uji diulang. Kegagalan itu kegagalan perkakas, bukan
  aplikasi.
- **Chunk build frontend masih 730 kB** (peringatan Vite lama) — belum dipecah; dicatat apa adanya.
- **Audit UI mengukur menurut tampilan, bukan fungsi.** Semua temuan putaran ini adalah ukuran
  sasaran sentuh; tidak ada galat konsol React, kontras, overflow, atau isian tanpa nama yang
  tersisa di 44 tampilan yang diperiksa.
- **Belum ada deploy publik dan Octane Swoole belum jalan** (ekstensi `swoole` tidak ada di mesin
  dev) — sama seperti catatan A.18.5.

### A.19.4 Rujukan log mentah & catatan jujur
- Sesi 9 Oktober 2026 (±10.50–15.10 WIB) melakukan pematangan + pengujian ulang menyeluruh, smoke
  HTTP/UI, audit UI, dan perbaikan sasaran sentuh.
- **Log mentah sesi ini SUDAH diekspor** ke `docs/log-mentah/` lewat `./docs/export-word.sh`
  (pukul ±15.08 WIB): `docs/log-mentah/2026-10-05T07-39-24.876Z/chat-messages.json.gz` (≈24,2 MB saat itu,
  salinan byte-exact) dan `docs/log-mentah/2026-10-05T07-39-24.876Z/transkrip.md` (≈10,7 MB saat itu,
  transkrip utuh tanpa potong). Kedua berkas disegarkan
  (menggantikan salinan lama), bukan ditulis sebagai berkas bertanggal baru, karena sesi ini adalah
  sesi `2026-10-05T07-39-24.876Z` yang sama dan terus berjalan.
- **Sesi masih berjalan**, jadi berkas `.gz` di atas adalah snapshot per ±15.08 WIB, bukan akhir
  sesi. Segarkan lagi dengan `./docs/export-word.sh` pada akhir sesi sebelum penilaian dikumpulkan.
- `docs/word/laporan-pengujian.docx` **sudah diekspor ulang** dari `docs/laporan-pengujian.md`
  (termasuk bagian A.19) pada pukul ±15.10 WIB.
- Deploy publik & Octane Swoole tetap belum ada (lihat A.19.3); itu bukan kekurangan putaran ini,
  melainkan ditunda dengan sadar.

## A.20 Putaran Audit 5 Pilar — Kelompok Prioritas 1 & Otorisasi Lintas Guru (9 Oktober 2026)

### A.20.1 Permintaan dan cakupan
Pengguna melampirkan hasil audit statis baru (`audit.md`, 5 pilar: Keamanan, QA, Performa,
Integrasi, UI/UX; penomoran K-01..K-16, Q-01..Q-21, P-01..P-09, I-01..I-06, U-01..U-07) dengan
pertanyaan "ini sudah di fix?" lalu instruksi "lanjutkan". Audit itu **tidak dijalankan di sandbox
mana pun** (PHP tidak tersedia di sana), jadi setiap temuan diperiksa ulang terhadap kode sekarang
sebelum dikerjakan — termasuk temuan yang ternyata sudah beres dari putaran sebelumnya.

Yang dikerjakan pada putaran ini mengikuti urutan prioritas audit (kelompok 1–3):
**K-01** (kredensial seeder), **K-02** (soal bocor sebelum `mulai_at`), **K-03** (kanal SSE bersama
guru+murid), **K-04** (BOLA baca lintas guru), **K-05** (pengaturan sekolah/kelas + bacanya oleh
murid), dan **K-15** (mutasi materi lintas guru). Temuan lain — termasuk P-01..P-09, Q-02..Q-21,
I-01..I-06, dan U-01..U-07 — **belum dikerjakan** dan tidak diklaim selesai (lihat A.20.5).

### A.20.2 Temuan dan perbaikannya

| ID | Inti temuan (dari `audit.md`) | Perbaikan |
|---|---|---|
| K-01 [T] | Sandi demo tertulis di seeder tanpa penjagaan environment | `RolesAndAdminSeeder` **berhenti total di produksi** (peringatan, tanpa membuat akun), sandi bisa ditimpa lewat `SEEDER_SANDI_ADMIN`/`SEEDER_SANDI_GURU`, email contoh dipindah ke domain `.test`, dan migrasi baru mengganti email akun demo lama `guru1@gmail.com` (hanya bila email tujuan belum dipakai dan barisnya memang akun guru demo) |
| K-02 [T] | `KuisMuridResource` mengirim seluruh soal + `konten` mentah begitu kuis terbit | Daftar `soal` **dibuang** dari resource murid (metadata saja); halaman detail murid ikut menjelaskan bahwa soal muncul lewat attempt; uji Pest + smoke HTTP menegaskan tidak ada `soal`/`kunci`/`pembahasan` di respons murid |
| K-03 [T] | Guru dan murid berbagi kanal `ulangan:kuis:{id}`; `peran` tiket tidak pernah diperiksa | Kanal dipisah `:guru` dan `:murid` (`PenyiarRealtime::kanalGuru/kanalMurid`); kejadian kecurangan (memuat `attempt_id`) hanya ke kanal guru, layar kelas hanya ke kanal murid; service Node punya `PERAN_JALUR`, **menolak tiket yang perannya tidak cocok** (403) dan menandai peran di event `siap` |
| K-04 [S/T] | Batas kepemilikan hanya pada mutasi; guru A bisa **membaca** kuis draf, kunci jawaban, nilai, ekspor CSV, monitor, dan catatan kecurangan guru B; baris `dibuat_oleh = NULL` dianggap milik bersama | `bolehKelola` dipakai untuk aksi **baca** juga (`KuisPolicy::view/laporan/koreksi/layar`, `SoalPolicy::view`, `AttemptPolicy::view/hasil/koreksi`, daftar kuis & bank soal disaring di controller); pengecualian baris-NULL **dihapus**, pemilik baris lama diisi migrasi baru, dan seeder contoh mengembalikan kepemilikan konten demonya ke akun guru demo |
| K-05 [S] | Lingkup sekolah/kelas bisa diubah guru mana pun; murid bisa membaca saklar proteksi | `PengaturanPolicy::update` = admin untuk sekolah/kelas, pemilik kuis untuk lingkup kuis; `viewAny` **khusus guru** (murid ditolak 403); halaman pengaturan menyusun pilihan sesuai peran (admin: sekolah/kelas/kuis, guru: kuis miliknya) lewat modul murni `lingkup.js` |
| K-15 [S] | Mutasi materi (ubah/hapus/terbitkan/unggah berkas) hanya memeriksa `isGuru()` | `MateriPolicy` memakai `bolehKelola` untuk `view/update/delete/publikasi/berkas` (kolom `dibuat_oleh` materi sudah ada) |

**Berkas aplikasi yang diubah/dibuat pada putaran ini (lengkap):**

- Backend, kebijakan & controller: `app/Models/User.php`,
  `app/Sections/Quiz/Policies/KuisPolicy.php`, `app/Sections/Quiz/Http/Controllers/KuisController.php`,
  `app/Sections/Quiz/Http/Resources/KuisMuridResource.php`,
  `app/Sections/Question/Policies/SoalPolicy.php`,
  `app/Sections/Question/Http/Controllers/SoalController.php`,
  `app/Sections/Attempt/Policies/AttemptPolicy.php`,
  `app/Sections/Material/Policies/MateriPolicy.php`,
  `app/Sections/Settings/Policies/PengaturanPolicy.php`,
  `app/Sections/Settings/Http/Controllers/PengaturanController.php`,
  `app/Sections/Presence/Services/PenyiarRealtime.php`,
  `app/Sections/Presence/Services/LayarService.php`,
  `app/Sections/Cheat/Http/Controllers/KecuranganController.php`.
- Backend, basis data: migrasi baru `2026_10_09_000001_isi_pemilik_baris_tanpa_pemilik.php` dan
  `2026_10_09_000002_ganti_email_demo_ke_domain_test.php`; seeder `RolesAndAdminSeeder.php` dan
  `BankSoalSeeder.php`; factory `KuisFactory.php` + `SoalFactory.php` (state `milik()`).
- Frontend: `sections/quiz/HalamanKuisDetail.jsx`, `sections/quiz/HalamanKuisMurid.jsx`,
  `sections/quiz/api.js` (komentar kontrak), `sections/settings/lingkup.js` (baru),
  `sections/settings/HalamanPengaturan.jsx`, `sections/settings/api.js` (parameter `kuis_id`).
- Realtime: `realtime/src/server.js`.
- Uji: `tests/Feature/OtorisasiPemilikTest.php`, `BankSoalTest.php`, `AttemptTest.php`,
  `PengaturanTest.php`, `Slice05Test.php`, `Slice06Test.php`, `Slice07Test.php`,
  `Slice09AiTest.php`, `Slice09TimTest.php`, `Slice09UploadTest.php`, `Slice10EksporTest.php`,
  `Slice10LayarTest.php`, `realtime/test/sse.test.js`,
  `frontend/src/__tests__/sections/settings/lingkup.test.js` (baru).
- Skrip uji manual: `docs/smoke-http-fitur.mjs`.

### A.20.3 Verifikasi (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `./verify.sh` | **SEMUA HIJAU** — Pest **218 passed (1744 assertions)** · Pint **314 files PASS** · checkJs **OK** · ESLint **0 error, 2 warning lama** (`watch()` RHF) · Vitest **42 berkas / 338 test** · realtime **15 test, 0 gagal** |
| `php artisan migrate --force` (dev) | dua migrasi baru `DONE`; sesudahnya `questions`/`quizzes`/`materials` **0 baris tanpa pemilik** (69/36/11 baris) |
| `php artisan db:seed --force` | idempoten; akun guru demo kini `guru1@sekolah.test` dan konten contoh (`Latihan Operasi Hitung (draf)`, `Ulangan Operasi Hitung`) kembali ber-pemilik akun guru demo |
| `node docs/smoke-http-fitur.mjs` (layanan hidup: backend :8000, realtime :4000) | **240/240 lulus, 0 gagal** (25,9 detik) — termasuk bukti baru: detail kuis murid tanpa daftar soal (K-02), `event: siap` memuat `peran`, tiket murid ditolak di aliran guru & sebaliknya (K-03), guru ditolak menyetel pengaturan sekolah/kelas dan murid ditolak membacanya (K-05), guru lain ditolak membaca ekspor/monitor/laporan/kejadian (K-04) |
| `node docs/smoke-ui-cdp.mjs` (Chrome headless CDP :9333, vite :5173) | login admin 200 dan lima halaman (`/kelas`, `/mapel`, `/murid`, `/murid/impor`, `/pengaturan`) terender; halaman Pengaturan menampilkan pemilih lingkup dan daftar saklar tanpa galat di layar |
| Pemeriksaan tambahan lewat CDP (skrip sekali pakai di luar repo) | login **guru** → `/pengaturan` hanya menawarkan lingkup **kuis miliknya** (tidak ada opsi sekolah/kelas), opsi pertama terpilih otomatis, daftar saklar terender, tanpa pesan galat |

### A.20.4 Catatan teknis yang perlu dibaca berikutnya
- **Klaim kepemilikan fixture uji.** Sejak K-04 batas baca mengikuti pemilik, fixture uji yang
  dibuat tanpa pemilik akan ditolak 403 kepada guru. Semua test yang menguji satu guru kini memakai
  state factory `milik($guru)`; test yang menguji guru lain sengaja tetap `null`/berbeda pemilik.
  Perubahan ini membuat **43 test lama merah** lebih dulu, lalu hijau setelah fixture dan harapan
  kontraknya diselaraskan — bukan setelah assertion dilonggarkan.
- **Pemilik baris lama diisi admin lebih dulu, guru kedua sebagai cadangan** (migrasi
  `2026_10_09_000001`). Untuk basis data yang belum pernah di-seed sama sekali, migrasi itu tidak
  mengisi apa pun (tidak ada pengguna), sehingga baris tanpa pemilik hanya bisa disentuh admin.
- **Tiket SSE yang salah jalur sudah terpakai.** Pemeriksaan peran terjadi setelah tiket diambil
  atomik (`GETDEL`), jadi klien yang salah jalur harus meminta tiket baru. Ini disebut inheren pada
  desain "tiket sekali pakai" dan bukan celah tambahan (tiket itu tetap tidak bisa dipakai ulang).

### A.20.5 Batasan jujur (yang sengaja belum dikerjakan)
- **Sisanya belum dikerjakan**: K-06..K-14, K-16, Q-02..Q-21, P-01..P-09 (paginasi, presence
  O(N^2), beban autosave/submit), I-01..I-06, U-01..U-07. Tidak ada satu pun yang diklaim selesai.
- Anti-cheat per kuis kini **wajib lewat halaman pengaturan** (pemilih kuis); belum ada pintasan
  dari halaman kuis itu sendiri — dicatat sebagai kekurangan UX, bukan bug keamanan.
- Perombakan UI/UX yang diminta audit (modal kumpul menggantikan `window.confirm`, indikator simpan,
  pesan ramah anak) belum dikerjakan.
- Deploy publik dan Octane Swoole masih belum ada, sama seperti catatan sebelumnya.
- Berkas pra-sesi yang **tidak** termasuk putaran ini dan sengaja tidak dikomit: perubahan
  `PasswordReset*`, `AuthTest`, `AksesMuridBaruTest`, `HalamanAturUlangSandi.jsx`, `sections/auth/api.js`,
  `aturUlang.test.js`, dan migrasi `2026_10_08_000004_buang_unique_nama_users.php`.

## A.21 Putaran Audit 5 Pilar — Performa Jalur Pengerjaan (P-03, P-04) (9 Oktober 2026)

### A.21.1 Permintaan dan cakupan
Lanjutan dari A.20 mengikuti urutan prioritas `audit.md`: kelompok **2 = P-01 paginasi,
P-02 presence O(N²), P-03/P-04 beban autosave dan pengumpulan serentak**. Putaran ini
mengambil **P-03 dan P-04** karena keduanya satu jalur (pengerjaan ujian), saling terkait,
dan bisa dibuktikan dengan angka — bukan karena kelompoknya sudah selesai.

**P-01 (paginasi) dan P-02 (presence) belum dikerjakan** pada putaran ini; keduanya
berdampak luas (kontrak respons semua daftar; butuh struktur Redis ZSET/HSET) dan akan
memecah banyak uji sekaligus bila dikerjakan setengah jalan. Semua temuan lain (K-06..K-14,
K-16, Q-02..Q-21, P-05..P-09, I-01..I-06, U-01..U-07) juga belum.

### A.21.2 Temuan dan perbaikannya

| ID | Inti temuan (dari `audit.md`) | Perbaikan |
|---|---|---|
| P-03 [T] | Setiap autosave memuat seluruh soal kuis beserta konten + kunci (`soalMilikKuis` → `$kuis->load('soal')`), jadi biaya tiap ketukan (~0,8 detik sekali per murid) tumbuh seiring besar bank soal | `soalMilikKuis` sekarang membaca **snapshot attempt** (id soal yang sudah dibekukan saat `mulai`) dan **tidak menyentuh tabel `questions` sama sekali**; tidak ada lagi pemuatan bank soal di jalur simpan jawaban. Attempt lama tanpa snapshot diperiksa lewat satu `EXISTS` ber-indeks pada pivot `quiz_questions`. Snapshot juga lebih benar: itu sumber urutan & skor yang dipakai saat menilai (Q-09), jadi autosave tidak lagi memakai daftar soal hidup yang bisa berubah di tengah ulangan |
| P-04 [T] | `tutup()` menembak satu `SELECT` + satu `save()` **per soal** di dalam transaksi ber-kunci; N murid mengumpulkan bersamaan di detik deadline = O(N × Q) query, ditambah N job AI | `nilaiSemuaSoal()`: seluruh baris jawaban attempt dibaca **satu query**, dinilai di memori, lalu ditulis **satu `upsert`** yang sekaligus membuat baris kosong untuk soal yang tidak dijawab (perilaku lama dipertahankan). `jawaban` sengaja tidak ikut di-update supaya jawaban murid tidak tersentuh, dan kolom kunci/`dinilai_at` tetap terisi seperti sebelumnya |

### A.21.3 Verifikasi (dijalankan, bukan klaim)

| Perintah / pengukuran | Hasil |
| --- | --- |
| `php artisan test --filter=AttemptTest` | **25 passed (185 assertions)** — termasuk dua uji baru di bawah |
| `./verify.sh` (dari root repo) | **SEMUA HIJAU** — Pest **220 passed (1769 assertions)** · Pint **314 files PASS** · checkJs **OK** · ESLint **0 error, 2 warning lama** · Vitest **42 berkas / 338 test** · realtime **15 test, 0 gagal** |
| Uji baru: query DB saat `POST /attempt/{id}/kumpulkan` dihitung lewat `DB::listen` | **11 query untuk kuis 2 soal, 11 query untuk kuis 12 soal** (selisih 0). Pola lama diukur pada data yang sama: **14 vs 34** (selisih 20 = 2 query per soal). Ambang uji `besar ≤ kecil + 4`, jadi regresi ke pola per soal langsung merah |
| Uji baru: `AttemptService::simpanJawaban` pada kuis berisi **30 soal** | Tidak ada satu pun query bertipe `from "questions"`/``from `questions` `` — jalur autosave tidak lagi menghidrasi bank soal. Bagian kedua uji menutup-uji fallback: attempt lama (`snapshot_soal = null`) tetap menerima soal milik kuis dan menolak soal di luar kuis (422) |
| `node docs/smoke-http-fitur.mjs` (backend :8000, realtime :4000 hidup) | **240/240 lulus, 0 gagal** (27,1 detik) — termasuk jalur nyata `mulai → jawab → kumpulkan` dan pemeriksaan skor/per-soal |

### A.21.4 Catatan teknis
- Urutan `upsert` mengandalkan indeks unik `answers (attempt_id, question_id)` yang sudah ada
  di migrasi; kolom yang di-update sengaja hanya `status`, `benar`, `skor`, `dinilai_at`.
- Nilai `benar`/`skor` ditulis lewat `upsert` sehingga **tidak** melewati cast model. Nilainya
  sudah bertipe `bool`/`float`/`null` dari penilai, dan uji lama (skor 10.0, `jumlah_benar` 2,
  `per_soal` semua `dinilai`) tetap hijau — jadi perilaku tersimpan tidak berubah.
- `simpanJawaban` masih membaca baris `jawaban` dengan `lockForUpdate`; `tutup()` tidak mengunci
  baris jawaban, tetapi baris attempt sudah dikunci lebih dulu, jadi tidak ada penulisan bersaing
  pada attempt yang sama.

### A.21.5 Batasan jujur (yang sengaja belum dikerjakan)
- **P-01 (paginasi) dan P-02 (presence O(N²)) belum dikerjakan.** Presence masih satu peta per
  kuis di cache (`Cache::get` + `Cache::put` utuh setiap `tandaiHadir`), dan `.env` dev masih
  `CACHE_STORE=database`. Perbaikan sebenarnya butuh struktur Redis (HSET/ZSET) — di luar putaran
  ini dan belum diuji di driver database. *(P-02 sudah tertutup di A.22; P-01 masih terbuka.)*
- Tidak ada perubahan frontend pada putaran ini, jadi **smoke UI (`docs/smoke-ui-cdp.mjs`)
  tidak dijalankan ulang**; yang diuji lewat antarmuka nyata adalah API pengerjaan yang dipakai
  halaman ujian.
- Perombakan UI/UX audit (U-01 modal kumpul, U-02 indikator simpan, U-06 modal hapus) dan sisa
  kelompok performa (P-05..P-09) masih terbuka.
- Berkas pra-sesi yang **tidak** termasuk putaran ini dan sengaja tidak dikomit tetap sama seperti
  catatan A.20.5 (`PasswordReset*`, `AuthTest`, `AksesMuridBaruTest`, `HalamanAturUlangSandi.jsx`,
  `sections/auth/api.js`, `aturUlang.test.js`, migrasi `2026_10_08_000004_buang_unique_nama_users.php`).

---

## A.22 Putaran Audit 5 Pilar — Presence Redis per Entri (P-02) (9 Oktober 2026)

### A.22.1 Permintaan dan cakupan
Lanjutan A.21 mengikuti urutan prioritas `audit.md`: kelompok **2 = P-01 paginasi, P-02 presence
O(N²), P-03/P-04 beban autosave dan pengumpulan serentak**. Putaran ini mengambil **P-02** (sisa
kelompok 2 sesudah P-03/P-04), karena sifatnya satu jalur tertutup: penulisan kehadiran pada setiap
request murid. **P-01 (paginasi) belum dikerjakan**, dan begitu pula temuan lain (K-06..K-16,
Q-02..Q-21, P-05..P-09, I-01..I-06, U-01..U-07).

### A.22.2 Temuan dan perbaikannya

| ID | Inti temuan (dari `audit.md`) | Perbaikan |
|---|---|---|
| P-02 [T] | Setiap `PresenceService::tandaiHadir` — dipanggil pada tiap `mulai`, `show`, `jawab`, dan ping — membaca **seluruh peta kelas** (`Cache::get`) lalu menulis ulang peta itu utuh (`Cache::put`). Biaya satu request murid tumbuh seiring jumlah murid di kelas, dan dua request yang jatuh bersamaan bisa saling menimpa (*lost update*) sehingga kehadiran seorang anak hilang | Penyimpanan dipindah ke kontrak baru `GudangPresence` yang **beroperasi per entri**, bukan per peta. `GudangRedis` memakai **satu hash Redis per kuis** (`presence:kuis:{id}`, medan = attempt id) plus satu **set indeks** `presence:indeks`: satu request murid = satu `HGET` + satu `HSET`, O(1) dan tidak menyentuh entri murid lain; guru tetap membaca seluruh kelas dengan **satu `HGETALL`** |

Detail yang menyertai perbaikan:

- **Cadangan non-Redis tetap ada.** Driver cache selain Redis (array/database, termasuk seluruh uji
  Pest) memakai `GudangPeta` — perilaku lama yang sudah teruji. Pilihan gudang diperiksa sekali per
  proses dari store di belakang `Repository` (`RedisStore` → `GudangRedis`, selain itu `GudangPeta`).
- **Fail-open tetap utuh.** Setiap operasi `GudangRedis` menangkap galatnya, melaporkannya, lalu
  mengembalikan nilai bawaan; Redis mati hanya menghilangkan penanda *online/offline* di Live Monitor  (yang tetap punya polling dan data attempt dari basis data), bukan menjatuhkan ulangan.
  - **Pemulihan `WRONGTYPE`.** Kehadiran slice 07 dulu disimpan sebagai **string** pada kunci yang sama
  (`presence:kuis:{id}`). Sesudah deploy, `HSET` di atas string ditolak Redis terus-menerus sampai
  TTL-nya habis. Kini kunci sisa dibuang lalu ditulis ulang sebagai hash, dengan uji khusus.
- **Pembersihan indeks.** Kuis yang hashnya sudah kosong dibuang bersama keanggotaan indeksnya, jadi
  sapuan berikutnya tidak memeriksa kuis mati terus-menerus.

### A.22.3 Berkas yang dibuat/diubah

Baru:

| Berkas | Isi |
|---|---|
| `backend/app/Sections/Presence/Contracts/GudangPresence.php` | Kontrak operasi per entri (`entri`, `simpan`, `semua`, `buang`, `kuis`, `lupakanKuis`) |
| `backend/app/Sections/Presence/Services/GudangRedis.php` | Hash Redis per kuis + set indeks, fail-open, pemulihan `WRONGTYPE` |
| `backend/app/Sections/Presence/Services/GudangPeta.php` | Perilaku lama (satu peta utuh per kuis) sebagai cadangan driver non-Redis |
| `backend/tests/Feature/PresenceRedisTest.php` | 6 uji keberadaan Redis: pemilihan gudang, jumlah perintah per request, sesi ganda, sapuan + `long_offline`, kunci string sisa, `lupakan` saat kumpul |

Diubah:

| Berkas | Perubahan |
|---|---|
| `backend/app/Sections/Presence/Services/PresenceService.php` | Memakai `GudangPresence`; `tandaiHadir` hanya membaca/menulis satu entri; `daftar`/`sapu`/`lupakan` lewat kontrak; `namaGudang()` untuk jejak |
| `backend/.env.example` | `CACHE_STORE=redis` + alasan singkatnya (hash Redis untuk presence; driver lain masih jalan tetapi membaca-menulis seluruh peta kelas) |
| `docs/smoke-http-fitur.mjs` | Dua pemeriksaan presence di bagian K: murid yang mengerjakan terbaca `online` di Live Monitor, dan ambang kesegaran 45 detik benar-benar dikirim ke guru |
| `docs/penjelasan-fitur.md` | Bagian 7 menjelaskan penyimpanan hash Redis (biaya per request tidak tumbuh seiring jumlah murid) |

Catatan: `backend/.env` dev di mesin ini disetel `CACHE_STORE=redis` supaya jalur produksi yang diuji
sama dengan yang dipakai. Berkas itu tidak dikomit (memang di-*ignore*), yang dikomit adalah
`.env.example`.

### A.22.4 Verifikasi (dijalankan, bukan klaim)

| Perintah / pengukuran | Hasil |
| --- | --- |
| `php artisan test` | **226 passed (1808 assertions)**, 13,34 detik |
| `php artisan test --filter=PresenceRedisTest` | **6 passed (39 assertions)** |
| `./verify.sh` (root repo, log `/tmp/verify-p02.log`) | **SEMUA HIJAU** — Pest 226 passed (1808 assertions) · Pint **PASS 318 files** · checkJs **OK** · ESLint **0 error, 2 warning lama** · Vitest **42 berkas / 338 test** · realtime **15 test, 0 gagal** |
| Uji jumlah perintah Redis pada jalur tulis (6 murid satu kuis, `CONFIG RESETSTAT` + `INFO commandstats`) | Satu `tandaiHadir` = **hget 1, hset 1, hgetall 0**; peta kelas tetap berisi 6 medan. Pola lama membaca-menulis seluruh peta (hgetall + penulisan utuh) |
| Uji jumlah perintah Redis pada jalur baca guru | `daftar()` = **hgetall 1, hset 0** untuk 6 murid (satu round-trip) |
| Uji lintas perilaku Redis sungguhan | sesi ganda tercatat sekali (`duplicate_session`, bukan dari klien), `online` jadi `false` setelah ambang 45 detik, sapuan membuang entri basi **dan** keanggotaan indeks lalu mencatat `long_offline`, kunci string sisa tidak mematikan presence, kehadiran hilang begitu attempt dikumpulkan |
| `node docs/smoke-http-fitur.mjs` (backend :8000, realtime :4000, frontend :5173 hidup; `.env` dev `CACHE_STORE=redis`) | **242/242 lulus, 0 gagal** (29,5 detik); bagian **K. Presence, anti-cheat, layar guru, SSE 25/25** — termasuk `online` di monitor, ambang 45 detik, tiket SSE sekali pakai, penolakan lintas peran, dan handshake `event: siap` |
| Bukti kunci di Redis sungguhan sesudah smoke (`redis-cli -n 1`) | `type …presence:kuis:74` = **hash**, `hlen = 1`; `…presence:indeks` (set) memuat id kuis 68 dan 74; tiap medan berisi `{student_id, sesi, terakhir}` |

### A.22.5 Keputusan teknis
- **Hash per kuis + set indeks, bukan kunci terpisah per attempt.** Satu `HGET`/`HSET` sudah O(1), dan
  guru tetap mendapat seluruh kelas dalam satu `HGETALL` — kunci per attempt akan memaksa 40 `GET`
  berurutan untuk satu layar monitor. Set indeks menjaga sapuan tetap tahu kuis mana yang hidup.
- **Prefiks cache ditambahkan sendiri.** Perintah hash dijalankan langsung ke koneksi (store Laravel
  tidak punya operasi hash), jadi kunci ditulis sebagai `getPrefix().'presence:kuis:{id}'` supaya tidak
  bertabrakan dengan kunci cache lain di basis data Redis yang sama.
- **Peta lama tetap disimpan sebagai kode**, bukan dihapus: itulah jalur yang dipakai seluruh uji Pest
  (driver `array`) dan cadangan saat Redis tidak ada. Semantik dan isi entrinya tidak berubah.
- **Kunci uji berprefiks `uji-presence-`.** Pembersihan sesudah tiap uji melepas prefiks klien Redis
  lebih dulu — `KEYS` mengembalikan nama lengkap, sedangkan perintah lewat Laravel menambahkan prefiks
  itu lagi; tanpa itu kunci uji tertinggal dan mencemari uji berikutnya (bug yang nyata ditemukan di
  sini dan diperbaiki).

### A.22.6 Batasan jujur (yang sengaja belum dikerjakan)
- **P-01 (paginasi) masih terbuka**, seperti tercatat di A.21.5; temuan audit lain juga belum.
  *(P-01 mulai ditutup sebagian di A.23: daftar murid sudah berpaginasi; endpoint lain belum.)*
- **Belum ada uji beban di lapangan.** Yang diukur di sini adalah **jumlah perintah Redis per request**
  (konstan terhadap jumlah murid), bukan latensi VPS dengan 40 murid sungguhan. Klaim yang boleh
  dipegang: biaya per request tidak lagi tumbuh seiring jumlah murid kelas.
- **Smoke UI (Chrome CDP) tidak dijalankan ulang** karena tidak ada perubahan frontend pada putaran ini.
- Berkas pra-sesi yang tidak dikomit tetap sama seperti catatan A.20.5/A.21.5.

---

## A.23 Putaran Audit 5 Pilar — Paginasi Daftar Murid (P-01, sebagian) (9 Oktober 2026)

### A.23.1 Permintaan dan cakupan
Lanjutan A.22 mengikuti urutan prioritas `audit.md`: **P-01 paginasi** — satu-satunya temuan
kelompok 2 yang masih terbuka sesudah P-02/P-03/P-04. P-01 menyentuh banyak endpoint sekaligus
(`audit.md` menyebut murid, soal, kuis, materi, antrean koreksi, peringkat, ekspor nilai, monitor,
dan catatan kecurangan), jadi putaran ini mengambil **satu endpoint paling tidak terbatas dulu:
daflar murid**, yang bisa berisi ribuan baris untuk satu sekolah.

Belum dikerjakan di putaran ini: paginasi `KuisController::index` dan `MateriController::index`
(keduanya dibaca juga oleh pemilih di editor/layar pengaturan, jadi perlu jalur "ambil semua"
terpisah), serta agregat baca `RankingService::semua`, `EksporNilaiService::baris`,
`MonitorService::snapshot`, `KoreksiService::antrean`, dan `KecuranganService::daftar`.

### A.23.2 Temuan dan perbaikannya

| ID | Inti temuan (dari `audit.md`) | Perbaikan |
|---|---|---|
| P-01 [T] | `MuridController::index` memakai `->get()` tanpa batas: satu sekolah dengan ribuan murid mengembalikan seluruh baris beserta relasi `user`/`kelas` dalam satu respons, memori dan payload tumbuh mengikuti jumlah murid | Daftar murid sekarang **berpaginasi** (`->paginate`) dengan **50 baris bawaan** dan batas atas **200** (`?per_page=1000` tetap dipangkas 200). Respons mengikuti bentuk paginator Laravel (`data[]`, `links`, `meta`), sama seperti Bank Soal yang sudah berpaginasi sejak slice 03 |

### A.23.3 Berkas yang dibuat/diubah

| Berkas | Perubahan |
|---|---|
| `backend/app/Sections/School/Http/Controllers/MuridController.php` | `index()` menerima `Request`, menghitung `per_page` (batas 1..200, bawaan 50) dan `page`, lalu `->paginate()` alih-alih `->get()` |
| `backend/tests/Feature/SekolahTest.php` | Test murid tunggal membaca `data[]`; ditambah test paginasi (5 murid, `per_page=2`, halaman 3 memuat sisa, `per_page=1000` dipangkas ke `meta.per_page=200`) |
| `frontend/src/sections/school/api.js` | `ambilMurid(classId, halaman)` mengembalikan `skemaHalamanMurid` (`data[]` + `meta`); skema baru menolak array telanjang |
| `frontend/src/sections/school/HalamanMurid.jsx` | Tabel membaca `data.data`; ditambah state halaman, tombol **Sebelumnya/Berikutnya**, penunjuk "Halaman X dari Y", dan ringkasan "Menampilkan N dari M murid"; filter kelas mereset ke halaman 1 |
| `frontend/src/__tests__/sections/school/paginasi.test.js` | 4 uji skema halaman (data+meta, halaman kosong, tolak array telanjang, tolak tanpa meta) |

Catatan: skrip smoke UI (`docs/smoke-ui-slice07.mjs`) sudah defensif (`Array.isArray(...) ? ... :
…data`), jadi tidak perlu diubah.

### A.23.4 Verifikasi (dijalankan, bukan klaim)

| Perintah / pengukuran | Hasil |
| --- | --- |
| `php artisan test --filter=SekolahTest` | **9 passed (50 assertions)** — termasuk test paginasi baru |
| `php artisan test` | **227 passed (1818 assertions)**, 13,39 detik |
| `./verify.sh` (root repo) | **SEMUA HIJAU** — Pest 227 passed (1818 assertions) · Pint PASS 318 files · checkJs OK · ESLint 0 error (2 warning lama) · Vitest **43 berkas / 342 test** · realtime 15 test, 0 gagal |
| `node docs/smoke-http-fitur.mjs` (backend :8000, realtime :4000, frontend :5173 hidup) | **242/242 lulus, 0 gagal** (26,0 detik) — termasuk `GET /api/v1/murid?per_page=200` (bagian C) dan `?per_page=5` (bagian O) yang sudah ditulis mengharapkan pembungkus `data` |

### A.23.5 Keputusan teknis
- **Bentuk paginator Laravel, bukan envelope buatan.** Bank Soal sudah memakai pola ini dan frontend
  punya `skemaHalamanSoal` sebagai contoh, jadi murid mengikuti hal yang sama (`data`+`meta`);
  `daftar()` di smoke HTTP juga sudah mengenali keduanya.
- **Batas atas 200.** Tanpa batas, `?per_page=1000` mengembalikan masalah yang sama seperti tanpa
  paginasi. Ekspor CSV tetap lewat endpoint ekspor tersendiri (stream, tidak terpengaruh).
- **Halaman di query key TanStack Query** (`['murid', kelasId, halaman]`), jadi berpindah halaman
  memakai cache terpisah dan filter kelas tidak menampilkan halaman basi.

### A.23.6 Batasan jujur (yang sengaja belum dikerjakan)
- **P-01 baru sebagian.** Endpoint lain yang disebut `audit.md` masih `->get()` tanpa batas
  (kuis, materi, koreksi, peringkat, ekspor nilai, monitor, kecurangan). Kalau mau dituntaskan,
  urutan berikutnya adalah kuis+materi (butuh jalur pemilih "ambil semua"), lalu agregat baca.
- **Belum ada uji beban** dengan ribuan murid sungguhan; yang dibuktikan adalah bentuk kontrak
  (batas per halaman + `meta`) dan bahwa `per_page` besar dipangkas — bukan latensi VPS.
- Perubahan ini menyentuh frontend (`HalamanMurid`), tetapi **smoke UI Chrome CDP tidak dijalankan
  ulang**; antarmuka nyata yang diuji adalah smoke HTTP (242/242) plus uji Vitest untuk skema.
- Berkas pra-sesi yang tidak dikomit tetap sama seperti catatan A.20.5/A.21.5.

---

## A.24 Putaran UI — Shell Navigasi Hamburger, Tombol Ber-Ikon, dan Editor Materi (10 Oktober 2026)

### A.24.1 Permintaan dan cakupan
Permintaan pengguna (kutipan): di bagian `/kuis` tombol **Ubah belum responsif**; ganti bentuk layout
yang kurang enak dipandang; **buat hamburger button** untuk tiap bagian; ubah UI ke arah yang lebih
fundamental; **utamakan ikon** untuk tombol/layout; dan **matangkan editor materi** karena
"saat di play video gak jalan" — pastikan sinkron memakai **media native dari HTML**.

Putaran ini mengerjakan tiga hal yang paling konkret dari daftar itu (dengan bukti browser),
dan sengaja **belum** merombak seluruh halaman:

1. **Shell navigasi**: navbar pil (ikon + label) di layar lebar; di layar sempit dipindah ke **laci
   yang dibuka tombol hamburger** (Escape/overlay/tombol tutup menutup laci, gulir latar dikunci).
2. **Baris aksi kartu kuis**: tombol Ubah/Susun soal/Terbitkan/Arsipkan/Hapus kini ber-ikon dan
   memakai `.kartu-aksi` — membungkus rapi, dan di layar sangat sempit tiap tombol selebar kartu.
3. **Editor materi**: pratinjau video/audio memakai elemen **native** (`<video>`/`<audio>` dengan
   `controls`) yang **disinkronkan ke jam timeline** — mulai dari offset klip saat timeline diputar,
   ikut scrub saat dijeda, dan tidak melampaui durasi klip.

### A.24.2 Temuan dan perbaikannya

| Inti keluhan | Penyebab yang ditemukan | Perbaikan |
|---|---|---|
| Tombol **Ubah** di `/kuis` tidak responsif | Deretan tombol teks tanpa aturan bungkus/lebar; di layar sempit berdesakan | `.kartu-aksi` + tombol ber-ikon (`IkonPensil`, dst.); tiap tombol ≥44 px dan selebar kartu di layar < 576 px |
| Navigasi "kurang rapih", perlu hamburger | Navbar hanya menggeser mendatar; tidak ada cara membuka menu di layar sempit | Shell baru: pil mendatar ≥ lg, laci hamburger < lg; tiap tautan ber-ikon |
| **Video di editor tidak jalan** | (a) klip **berdurasi 0** tidak pernah aktif di timeline; (b) pratinjau tidak terhubung ke jam timeline, jadi menekan putar tidak memutar media | `dariServer` memperlakukan durasi ≤ 0 sebagai `DURASI_BAWAAN`; komponen `MediaTersinkron` memakai `<video>`/`<audio>` native dan mengikuti playhead (`offsetMedia`) |

### A.24.3 Berkas yang dibuat/diubah

Baru: `docs/smoke-ui-nav.mjs` (smoke CDP: laci hamburger + responsivitas aksi di 390 px & 1280 px),
`frontend/src/__tests__/shared/layout/kerangkaUmum.test.jsx` (render jsdom: hamburger, laci, ikon).

| Berkas | Perubahan |
|---|---|
| `frontend/src/icons.jsx` | +13 ikon (menu, pensil, tongSampah, tambah, simpan, kisi, lapis, tanda, papan, gear, grafik, putar, jeda) + entri `daftarIkon` |
| `frontend/src/shared/layout/KerangkaUmum.jsx` | Shell baru: `TautBagian` (ikon+label), `MENU_GURU`/`MENU_MURID`, tombol hamburger, laci + overlay, kunci gulir, tutup lewat Escape/tautan |
| `frontend/src/theme/theme.css` | `.tombol-menu`, `.laci-overlay`, `.laci-nav*`, `.kartu-aksi`; `.papan-nav` membungkus (tidak menggeser) |
| `frontend/src/sections/quiz/HalamanKuis.jsx` | Baris aksi ber-ikon + `.kartu-aksi` |
| `frontend/src/sections/material/EditorMateri.jsx` | `MediaTersinkron` (media native) + `posisiTujuan`; pratinjau menerima `bermain`/`detik` |
| `frontend/src/sections/material/editorMateri.js` | `offsetMedia()` (murni, teruji) + `dariServer` menolak durasi ≤ 0 |
| `frontend/src/__tests__/…` | `icons.test.jsx` (+2), `editorMateri.test.js` (+5), `kerangkaUmum.test.jsx` (baru, 5) |

### A.24.4 Verifikasi (dijalankan, bukan klaim)

| Perintah / pengukuran | Hasil |
| --- | --- |
| `./verify.sh` (root repo) | **SEMUA HIJAU** — Pest **227 passed (1818 assertions)** · Pint PASS 318 files · checkJs OK · ESLint **0 error (2 warning lama)** · Vitest **44 berkas / 355 test** · realtime 15 test |
| `npm run build` (frontend) | **✓ built** (337 modul) — CSS/JSX baru lolos build produksi |
| `node docs/smoke-ui-nav.mjs` (Chrome headless CDP, frontend :5173 + backend :8000 hidup) | **13/13 lulus** — 390 px: hamburger (48 px) tampil, navbar pil tersembunyi, laci berisi 9 tautan ber-ikon, tombol aksi kartu kuis **tidak meluber** (0) dan **menumpuk selebar kartu**; 1280 px: navbar pil 9 ikon tampil, hamburger tersembunyi |
| Cek editor via CDP (Chrome, `--autoplay-policy=no-user-gesture-required`) | **7/7** — kanvas memuat `<video>` native, `controls=true`, `src` bertanda tangan, `preload=metadata`; **menekan putar membuat media berjalan** (`paused=false`, `currentTime≈1,13 s`) |

### A.24.5 Keputusan teknis
- **Ikon SVG sendiri, tanpa pustaka ikon.** Mengikuti `icons.jsx` yang sudah ada (viewBox 24, `currentColor`),
  jadi warna ikut tema terang/gelap tanpa pengecualian warna.
- **Laci di-render hanya saat terbuka** (bukan disembunyikan CSS) supaya tautannya tidak ikut
  dijangkau tombol Tab saat laci tertutup; laci ditutup saat tautan diklik (bukan lewat efek setState).
- **Media native + sinkron, bukan pemutar buatan sendiri.** `<video>`/`<audio>` native menjaga kontrol,
  subtitle, dan aksesibilitas browser; yang ditambahkan hanya penyesuaian waktu (`offsetMedia`).
- **Durasi ≤ 0 diperlakukan sebagai durasi bawaan** di klien; data lama (mis. materi 1 di dev) tetap
  bisa diputar tanpa migrasi data.

### A.24.6 Batasan jujur (yang sengaja belum dikerjakan)
- **Belum perombakan UI menyeluruh.** Putaran ini menyentuh shell, baris aksi kartu kuis, dan editor
  materi. Halaman lain (bank soal, murid, monitor, koreksi, laporan) masih memakai tata letak lama;
  "lebih mudah dipakai semuanya" belum selesai.
- **Editor belum diuji dengan banyak kodek.** Yang terbukti memutar adalah satu video MP4 di DB dev,
  bukan seluruh format yang mungkin diunggah guru.
- **Tidak ada uji render visual/regresi screenshot**; bukti layout berasal dari pemeriksaan geometri
  lewat CDP (lebar/posisi), bukan mata manusia.
- **Smoke UI lama (`docs/smoke-ui-slice03..07.mjs`) tidak dijalankan ulang** — sebagian membaca
  `/v1/kuis`/`/v1/murid` yang kini berpaginasi; `slice07` sudah defensif, yang lain belum diperiksa
  pada putaran ini.
- Berkas pra-sesi yang tidak dikomit tetap sama seperti catatan A.20.5/A.21.5.

---

## A.25 Putaran Desain Ulangan Sekolah — Fondasi Komponen, Palet Resmi, dan Panel Samping (10 Oktober 2026)

### A.25.1 Permintaan dan cakupan
Pengguna menyerahkan paket desain **"Audit UI Ulangan Sekolah"** (`desain-ulangan-sekolah.zip`, 12 papan:
audit + contoh "sesudah" + papan Standar) dan meminta melanjutkan pekerjaan UI memakai paket itu.
Dua keputusan diminta lebih dulu dan dijawab pengguna: (a) **palet diselaraskan ke palet resmi
spesifikasi** (bukan mempertahankan "Tinta & Kertas"); (b) **dikerjakan seluruh papan secara berurutan**,
dimulai dari fondasi. Salinan papan disimpan di `docs/desain/` sebagai rujukan.

Putaran ini mengerjakan **tahap fondasi (papan 6 "Standar", temuan 01, 02, 05, 06, 08, 09, 11, 12)
dan papan 3 "Kelola Kelas (sesudah)"**, lalu menerapkan pola yang sama ke halaman data induk lain.
Ukuran huruf khusus murid, layar ulangan, beranda, dan papan 7–12 belum dikerjakan (lihat A.25.6).

### A.25.2 Temuan yang ditutup dan caranya

| # | Temuan (papan 1) | Perbaikan yang dikerjakan |
| --- | --- | --- |
| 01 | Cincin fokus gagal kontras (2,65:1) | Token baru `--cincin-fokus` (#1A2F65 terang / #38BDF8 gelap) dipakai `:focus-visible` (3 px + lapisan putih 5 px). `--aksen` tidak lagi dipakai untuk indikator fokus. |
| 02 | `window.confirm` di aksi merusak | Komponen `DialogKonfirmasi` berbasis elemen `<dialog>` (fokus terkunci, Esc menutup, `role="alertdialog"`, menyebut dampak). **6 dari 7** pemakaian diganti; yang tersisa hanya di `HalamanKerjakan.jsx` (menyatu dengan layar ulangan, dikerjakan di tahap berikutnya). |
| 05 | Dua sistem tombol berjalan bersama | `Tombol` mendapat varian `bahaya` dan ukuran `sedang` (44 px); komponen baru `TombolIkon` (persegi 44 px, `label` wajib → `aria-label`). Halaman yang disentuh putaran ini tidak lagi memakai `btn-outline-*`/`btn-sm`. |
| 06 | Memuat hanya teks, kosong tanpa tindakan | Komponen `Skeleton`/`SkeletonKartu` (mati saat `prefers-reduced-motion`) dan `KosongData` (ikon + judul + penjelasan + satu tindakan). Dipakai di Kelas, Mapel, Murid, Tag, Bank Soal, Kuis. |
| 08 | Tabel memaksa geser di HP | Komponen `TabelData`: tabel di desktop, kartu bertumpuk di < 700 px dengan judul kolom dipindah ke `data-label`; kolom aksi tetap terlihat dan tombolnya ikon ber-label. Dipakai di Kelas, Mapel, Murid, Tag, Bank Soal. |
| 09 | Hierarki kepala halaman tidak seragam | Komponen `HeaderHalaman` (jejak, satu `h1`, deskripsi, slot tombol utama) dipakai Kelas, Mapel, Murid, Tag, Bank Soal, Kuis. |
| 11 | Palet kode menyimpang dari spesifikasi | `theme.css` diselaraskan ke palet resmi (#F8FAFC, #0EA5E9, #1A2F65, #0F172A, #0369A1, #0B1530; status #15803D/#B91C1C/#B45309). Nilai hex tetap hanya di dua blok variabel (dijaga tes tema). |
| 12 | Tombol utama "timbul" kurang cocok | `.btn-aksen` memakai bayangan halus `0 2px 6px` dan pergeseran 1 px saat ditekan (bukan 4 px). |
| 07 | Sembilan pil datar tanpa kelompok | `KerangkaUmum` sekarang panel samping indigo berkelompok (**Ringkasan, Ujian, Data induk, Belajar**) di ≥ 992 px, laci berkelompok yang sama di layar sempit. Menu **Beranda** ditambahkan dan ikon **Kuis** dibuat berbeda dari **Bank Soal** (`IkonLembarSoal` vs `IkonPapan`). |
| 10 | CSS satu berkas tanpa skala | Token baru `--sp-1..--sp-8` (4–64 px) dan `--fs-hero/h1/h2/soal/isi/meta`. Pemecahan berkas CSS **belum** dikerjakan (sengaja ditunda; lihat A.25.6). |

Papan 3 "Kelola Kelas (sesudah)" diterapkan penuh: kepala halaman + ringkasan jumlah kelas, saringan
tingkat (pil `aria-pressed`), tabel data → kartu di HP, aksi ikon ber-label, panel formulir samping
(`PanelForm`, `<dialog>` modal), dan dialog konfirmasi hapus yang menyebut berapa murid dilepas.

### A.25.3 Berkas yang dibuat/diubah
Dibuat:
- `frontend/src/shared/ui/DialogKonfirmasi.jsx`, `KosongData.jsx`, `Skeleton.jsx`, `HeaderHalaman.jsx`,
  `TabelData.jsx`, `PanelForm.jsx`
- `frontend/src/__tests__/shared/ui/komponenBaru.test.jsx`, `dialogKonfirmasi.test.jsx`
- `docs/desain/` (12 papan `.dc.html` + `canvas.json` — salinan paket desain pengguna)

Diubah:
- `frontend/src/theme/theme.css` (palet resmi, token fokus/jarak/huruf, komponen baru: dialog, skeleton,
  kosong-data, kepala halaman, tabel data, panel samping, pil saring, panel samping menu)
- `frontend/src/icons.jsx` (tambah `IkonRumah`, `IkonLembarSoal` + peta `daftarIkon`)
- `frontend/src/shared/ui/Tombol.jsx` (varian `bahaya`, ukuran `sedang`, `TombolIkon`)
- `frontend/src/shared/layout/KerangkaUmum.jsx` (panel samping berkelompok + laci berkelompok)
- `frontend/index.html` (Nunito + Nunito Sans via Google Fonts, tetap ada fallback sistem)
- `frontend/src/sections/school/HalamanKelas.jsx`, `HalamanMapel.jsx`, `HalamanMurid.jsx`
- `frontend/src/sections/question/HalamanTag.jsx`, `HalamanBankSoal.jsx`
- `frontend/src/sections/quiz/HalamanKuis.jsx`
- `frontend/src/__tests__/shared/layout/kerangkaUmum.test.jsx` (tes kelompok menu + ikon berbeda)

### A.25.4 Verifikasi (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `./verify.sh` (root) | **SEMUA HIJAU, exit 0** — Pest **227 passed (1818 assertions)** · Pint 318 berkas · checkJs OK · ESLint **0 error** (2 warning lama dari `react-hooks/incompatible-library`) · Vitest **46 berkas / 373 test** · realtime 15 test |
| `php artisan test` (backend) | **227 passed (1818 assertions)** |
| `npx vitest run` (frontend) | **46 berkas / 373 test lulus** (sebelum putaran ini 44/355 — bertambah 2 berkas, 18 test) |
| `npm run build` (frontend) | **✓ built** — CSS 266,07 kB (gzip 38,22 kB), JS 744,51 kB (gzip 215,41 kB); hanya peringatan ukuran chunk yang sudah ada sebelumnya |

Tes yang **tidak** dijalankan putaran ini: smoke UI/CDP dan smoke HTTP, karena layanan lokal
(backend :8000, realtime :4000, frontend :5173) sedang dimatikan. Jadi bukti tata letak putaran ini
adalah tes render + pembacaan CSS, bukan tangkapan layar — lihat A.25.6.

### A.25.5 Keputusan teknis
- **Palet dipilih pengguna**: diselaraskan ke spesifikasi karena penilai membandingkan hasil dengan
  spesifikasi, dan penyimpangan perlu alasan tertulis. Perubahan hanya nilai di dua blok variabel.
- **`<dialog>` bawaan, bukan pustaka**: fokus terkunci, Esc, dan `::backdrop` gratis; ada jalur
  cadangan `setAttribute('open')` untuk webview yang belum punya `showModal()`.
- **Judul kolom tabel di `data-label`**: satu markup melayani tabel desktop dan kartu HP tanpa
  menduplikasi baris di React.
- **Panel samping memakai grid `260px + 1fr`** dengan `position: sticky`, jadi tidak ada JS pengukur
  tinggi dan konten tetap `min-width: 0`.
- **Tes tema tetap menjaga hex**: token baru semuanya di dalam dua blok variabel `theme.css`.

### A.25.6 Batasan jujur (yang sengaja belum dikerjakan)
- **Papan 4 & 5 (layar ulangan + HP) belum**: `HalamanKerjakan.jsx` masih satu scroll panjang tanpa
  navigator soal, tanpa header lengket, dan masih memakai `window.confirm` (temuan 02 sisa 1, temuan 03).
- **Papan 2 (beranda guru/murid) belum**: beranda masih halaman status, bukan dashboard berbasis tugas (temuan 04).
- **Papan 7–12 belum**: Live Monitor, Koreksi manual, Progres tema, Kuis 3 langkah, EditorSoal dengan
  pratinjau, dan EditorMateri.
- **Ukuran huruf khusus murid** (18/26/20 px, tombol 52/68 px) belum diterapkan — menunggu papan 4/5.
- **CSS belum dipecah** per fitur (temuan 10); token jarak/huruf sudah ada, pemecahan berkas ditunda.
- Sisa kelas Bootstrap mentah di halaman yang belum disentuh: **52 `btn-sm`, 10 `btn-outline-primary`,
  9 `btn-outline-danger`, 4 `btn-outline-secondary`**; 4 halaman masih `table-responsive`
  (Monitor, Peringkat, Impor Murid, EditorMateri).
- **Belum ada regresi visual/screenshot**; bukti tata letak masih dari pembacaan CSS + tes render.
- Belum ada `git commit`/`push` untuk putaran ini.

---

## A.26 Putaran Desain — Layar Ulangan Murid (papan 4 & 5) dan Beranda Berbasis Tugas (papan 2) (10 Oktober 2026)

### A.26.1 Permintaan dan cakupan
Lanjutan A.25 dengan urutan papan desain: **papan 4 "Layar ulangan murid"**, **papan 5 "Ulangan di HP"**,
dan **papan 2 "Beranda guru"**. Ini menutup dua temuan bertingkat Tinggi yang tersisa (02 sisa dan 03)
serta temuan 04.

### A.26.2 Temuan yang ditutup dan caranya

| # | Temuan | Perbaikan |
| --- | --- | --- |
| 03 | Layar ulangan satu scroll panjang tanpa navigator; timer ikut tergulir | **Kepala lengket** (`.kepala-ulangan`) berisi judul, lencana pengaman, **progress bar** "x dari N terjawab", sisa waktu, dan tombol **Selesai**. Soal ditampilkan **satu per layar**; **navigator nomor** (`NavigatorSoal`) dengan empat keadaan (dijawab, ragu-ragu, belum dijawab, aktif) hadir di samping soal (≥ lg) dan dilipat dalam `<details>` di HP. |
| 02 (sisa) | `window.confirm` saat mengumpulkan | `DialogKonfirmasi` berisi **ringkasan hitungan** (terjawab / ragu-ragu / belum dijawab) dan pesan yang menyesuaikan, dengan tombol "Periksa lagi" dan "Kumpulkan". Tidak ada lagi `window.confirm` di seluruh `src/` (kecuali dokumentasi komponennya). |
| — | Penanda ragu belum ada | Tombol "Tandai ragu-ragu" / "Hapus tanda ragu" (`aria-pressed`), bendera ikut tampil di navigator. Status ragu menang atas "sudah dijawab", jadi soal yang perlu ditinjau tidak pernah tersembunyi. |
| — | Murid tidak tahu keadaan koneksi | Banner "Koneksi putus" (listener `online`/`offline`) yang menyebut jawaban aman dan akan terkirim sendiri; catatan "Jawabanmu tersimpan otomatis." |
| 04 | Beranda tidak membantu tugas apa pun | Beranda guru menjadi **dasbor berbasis tugas**: bagian **Perlu perhatian** (kuis berlangsung → Buka monitor; antrean koreksi → Mulai koreksi; laporan avatar → Tinjau), **4 angka ringkas**, dan **jadwal kuis** dengan tab Hari ini / Minggu ini. Beranda murid: ulangan yang sedang berlangsung/berikutnya + pintasan materi, progres tema, lencana. |
| — | Skala huruf murid | `.layar-murid`: teks 18 px, teks soal 26 px, pilihan jawaban 20 px dengan tinggi 68 px, kotak nomor navigator 52 px. |

Verifikasi khusus untuk layar ulangan: soal tetap dinilai server, timer tetap tampilan (dikoreksi
`server_now`), autosave/antrean/anti-cheat/deadline **tidak diubah** — yang berubah hanya cara
menampilkan. Setiap perpindahan soal memindahkan fokus ke kartu soal dan menggulir ke atas supaya
pembaca layar membacakan soal baru.

### A.26.3 Berkas yang dibuat/diubah
Dibuat:
- `frontend/src/sections/attempt/navigatorSoal.js` (status soal, ringkasan progres, pesan kumpul)
- `frontend/src/shared/ui/NavigatorSoal.jsx`
- `frontend/src/sections/home/dashboard.js` (bagiJadwal, angkaBeranda, perluPerhatian)
- `frontend/src/__tests__/sections/attempt/navigatorSoal.test.js`,
  `frontend/src/__tests__/shared/ui/navigatorSoal.test.jsx`,
  `frontend/src/__tests__/sections/home/dashboard.test.js`

Diubah:
- `frontend/src/sections/attempt/HalamanKerjakan.jsx` (kepala lengket, satu soal per layar, navigator,
  penanda ragu, dialog ringkasan kumpul, banner koneksi putus)
- `frontend/src/sections/home/Beranda.jsx` (dasbor guru + beranda murid)
- `frontend/src/theme/theme.css` (gaya kepala ulangan, kartu ulangan, navigator, skala murid,
  kartu "perlu perhatian", angka ringkas)
- `frontend/src/icons.jsx` (`IkonBendera`)

### A.26.4 Verifikasi (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `./verify.sh` (root) | **SEMUA HIJAU, exit 0** — Pest **227 passed (1818 assertions)** · Pint 318 berkas · checkJs OK · ESLint **0 error** (2 warning lama) · Vitest **49 berkas / 397 test** · realtime 15 test |
| `npx vitest run` (frontend) | **49 berkas / 397 test lulus** (A.25: 46/373 → bertambah 3 berkas, 24 test) |
| `npm run build` (frontend) | **✓ built** — CSS 270,31 kB (gzip 38,81 kB), JS 755,99 kB (gzip 218,64 kB) |

Tes yang **tidak** dijalankan: smoke UI/CDP dan smoke HTTP (layanan lokal dimatikan), jadi layar
ulangan belum dilihat mata manusia pada putaran ini.

### A.26.5 Keputusan teknis
- **Tampilan satu soal per layar, logika lama utuh.** Autosave, antrean ber-nomor, kunci idempotensi,
  koreksi `server_now`, dan proteksi anti-cheat tidak disentuh; perubahan terbatas pada render +
  state tampilan (soal aktif, penanda ragu, dialog).
- **Penanda ragu disimpan di memori, bukan localStorage.** Ragu adalah alat bantu sesi, bukan jawaban;
  menyimpannya di perangkat justru menambah data pribadi yang harus dibersihkan di komputer lab.
- **Perhitungan dipisah dari komponen** (`navigatorSoal.js`, `dashboard.js`) supaya bisa diuji dengan
  tanggal tetap dan tanpa DOM.
- **Antrean koreksi beranda hanya satu panggilan** (kuis terbit terbaru), karena endpoint koreksi
  memang per kuis; angka pada kartu menyebut asalnya secara jujur.

### A.26.6 Batasan jujur (yang sengaja belum dikerjakan)
- **Papan 7–12 belum**: Live Monitor, Koreksi manual, Progres tema, Kuis 3 langkah, EditorSoal dengan
  pratinjau, dan EditorMateri gaya video editor. Halaman-halaman itu sudah ada dan berfungsi, tetapi
  belum ditata ulang mengikuti papan.
- **Modul pengaman (ModalProteksi) belum ditata ulang** sesuai papan 4; hanya muncul seperti sebelumnya.
- **Beranda murid belum mengikuti papan khusus** (desain hanya menyediakan papan guru); isinya disusun
  dari pola yang sama.
- **Rata-rata nilai tidak ditampilkan** (papan 2 memakai "Rata-rata nilai 78"): nilai rata-rata butuh
  laporan per kuis, jadi kartu keempat memakai "Kuis tersimpan" agar tidak ada angka karangan.
- **Sisa kelas Bootstrap mentah** di halaman yang belum disentuh: 52 `btn-sm`, 23 `btn-outline-*`;
  4 halaman masih `table-responsive` (Monitor, Peringkat, Impor Murid, EditorMateri).
- **Belum ada regresi visual/screenshot**; bukti tata letak dari tes render + pembacaan CSS.
- Belum ada `git commit`/`push` untuk putaran ini.

---

## A.27 Putaran Desain — Live Monitor (papan 7), Koreksi (papan 8), dan Progres Tema (papan 9) (10 Oktober 2026)

### A.27.1 Permintaan dan cakupan
Lanjutan A.26 pada urutan papan desain. Ketiga halaman **sudah ada dan berfungsi**; putaran ini
menyeragamkan kepalanya, menghilangkan sisa kelas Bootstrap mentah, memakai tabel data responsif, dan
menambah keadaan memuat/kosong yang utuh — tanpa mengubah alur bisnisnya (polling+SSE, token koreksi
sekali pakai, perhitungan tingkat dari nilai asli).

### A.27.2 Yang dikerjakan

**Live Monitor (papan 7)**
- Kepala halaman bersama: judul `«judul kuis» · Live Monitor`, jejak, deskripsi kelas + jumlah murid
  aktif, lencana status SSE (Langsung/Polling/Menyambung), dan tombol "Detail kuis".
- **Strip angka ringkas** dari snapshot server: Mengerjakan, Selesai, Tidak aktif, Perlu ditinjau —
  dihitung helper murni `ringkasMonitor` (tanpa angka contoh).
- Tabel murid memakai `TabelData` (tabel di desktop, **kartu di HP** — sebelumnya `table-responsive`
  sehingga kolom Catatan terdorong keluar layar). Kolom: Murid (+percobaan ke-N), Kehadiran, Progres
  (batang + hitungan), **Terakhir aktif** (`formatDetikTerakhir`: "baru saja" / "12 dtk lalu" / …),
  Status, Catatan.
- Catatan kejadian: saringan pindah dari `<select>` ke **pil** (Semua / Belum ditinjau / Dinilai valid /
  Dinilai tidak valid), ditambah kalimat "Catatan adalah bahan tinjauan, bukan vonis", dan keadaan
  kosong `KosongData` per saringan. Tombol Valid/Tidak valid memakai ukuran 44 px.

**Koreksi manual (papan 8)**
- Kepala halaman bersama (judul + jejak + deskripsi yang menyebut token sekali pakai & audit).
- Memuat memakai `Skeleton`; antrean kosong memakai `KosongData` beraksi "Kembali ke detail kuis".
- Tombol `btn btn-sm btn-tepi` → `Tombol`/`btn-sedang` (44 px).

**Progres Tema (papan 9)**
- Kepala halaman bersama dengan penjelasan ambang dari server; ringkasan tingkat + lencana mapel
  dipindah ke baris lencana.
- **Saringan pil "Semua tema" / "Perlu dilatih"** (tema `mulai_paham` & `belum_paham`), sesuai papan.
- `Skeleton` saat memuat; dua keadaan kosong berbeda (belum ada tema, dan "tidak ada tema yang perlu
  dilatih"); kartu tema memakai `kartu-soft` dengan tingkat **ikon + teks**.

### A.27.3 Berkas yang dibuat/diubah
Dibuat:
- `frontend/src/sections/cheat/ringkasMonitor.js`
- `frontend/src/__tests__/sections/cheat/ringkasMonitor.test.js`

Diubah:
- `frontend/src/sections/cheat/HalamanMonitor.jsx` (kepala, angka ringkas, `TabelData`, terakhir aktif,
  pil saringan catatan, keadaan kosong)
- `frontend/src/sections/scoring/HalamanKoreksi.jsx` (kepala, skeleton, kosong-data, ukuran tombol)
- `frontend/src/sections/report/HalamanProgresTema.jsx` (kepala, saringan tema, skeleton, dua keadaan kosong)
- `frontend/src/theme/theme.css` (`.kolom-progres`)

### A.27.4 Verifikasi (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `./verify.sh` (root) | **SEMUA HIJAU, exit 0** — Pest **227 passed (1818 assertions)** · Pint 318 berkas · checkJs OK · ESLint **0 error** (2 warning lama) · Vitest **50 berkas / 401 test** · realtime 15 test |
| `npx vitest run` (frontend) | **50 berkas / 401 test lulus** (A.26: 49/397) |
| `npm run build` (frontend) | **✓ built** |

Tambahan sesudah tabel ketiga diubah: `./verify.sh` **SEMUA HIJAU (exit 0)** kembali, Vitest
**50 berkas/401 test**, dan `grep table-responsive` di `frontend/src` → **0 hasil**.

Tes yang **tidak** dijalankan: smoke UI/CDP dan smoke HTTP (layanan lokal dimatikan) — halaman-halaman
ini belum dilihat mata manusia pada putaran ini.

### A.27.5 Keputusan teknis
- **Angka ringkas dihitung dari snapshot, bukan contoh.** "Belum mulai" dari papan tidak ditampilkan
  karena monitor hanya memuat attempt yang sudah dibuka; menampilkannya berarti angka karangan.
  Sebagai gantinya muncul "Tidak aktif" (berjalan tetapi tidak ada denyut).
- **`TabelData` dipakai walau tabelnya bisa ratusan baris.** Kolom dan data tidak berubah, jadi
  perubahan ini murni presentasi; bila jumlah baris besar, virtualisasi tetap bisa ditambahkan tanpa
  mengubah struktur kolom.
- **Saringan catatan memakai pil, bukan `<select>`** supaya keadaannya terlihat langsung (dan
  `aria-pressed` bisa diuji).
- **Koreksi: tata letak antrean+detail dari papan belum diterapkan** (lihat batasan) karena alur token
  dua langkah yang sudah ada lebih penting untuk dijaga utuh pada putaran ini.

### A.27.6 Batasan jujur (yang sengaja belum dikerjakan)
- **Papan 10, 11, 12 belum**: Kuis 3 langkah, EditorSoal dengan pratinjau, dan EditorMateri gaya video
  editor. Ketiganya halaman besar dan belum ditata ulang.
- **Papan 8 hanya sebagian**: susunan "antrean kiri + detail kanan + stepper skor" belum; yang ada
  masih daftar bertumpuk dengan formulir per item (alur token & audit tidak berubah).
- **`table-responsive` sudah nol**: Peringkat, Impor Murid, dan laporan EditorMateri ikut memakai
  `TabelData` (kolom `kelasBaris` ditambahkan agar baris milik murid sendiri tetap disorot), jadi tidak
  ada lagi tabel yang memaksa geser mendatar di HP (temuan 08 tuntas di seluruh `src/`).
- **Sisa kelas Bootstrap mentah**: 45 `btn-sm`, 10 `btn-outline-primary`, 9 `btn-outline-danger`,
  6 `btn-outline-secondary` di halaman yang belum disentuh.
- **Persentase progres monitor** tetap dari server; tidak ada perhitungan baru di klien.
- Belum ada regresi visual/screenshot; belum ada `git commit`/`push` untuk putaran ini.

## A.28 Putaran Desain — Papan 10 & 11 (Susun Kuis Tiga Langkah, Editor Soal Berpratinjau) + Sistem Tombol (10 Oktober 2026)

Putaran ini menuntaskan dua papan terakhir dari audit desain (`docs/desain/`): **papan 10** (susun kuis
tiga langkah) dan **papan 11** (editor soal dengan pratinjau). Papan 12 (editor materi gaya video editor)
sudah dikerjakan lebih dulu di A.17, jadi tidak disentuh lagi di sini. Sekalian dituntaskan butir
*Definition of Done* yang selama ini tersisa: **"satu sistem tombol"** — tidak ada lagi kelas tombol
bawaan Bootstrap di JSX.

### A.28.1 Papan 10 — Susun kuis tiga langkah (`sections/quiz/HalamanKuis.jsx`)

- **Alur tiga langkah** memakai pil langkah bernomor baru (`LangkahPil` → `.pil-langkah`): langkah aktif
  ditandai `aria-current="step"` + teks pembaca layar "(sedang dibuka)", tiap langkah tombol asli (bisa
  diklik maupun dicapai dengan Tab + Enter).
- **Langkah 1 "Info dan jadwal"**: judul, mapel, kelas, durasi, jadwal mulai/selesai, deskripsi, saklar
  acak soal/opsi. Tombol **"Lanjut: susun soal"** menyimpan draf dulu (create/update) karena susunan soal
  baru bisa dikaitkan setelah kuis punya id di server.
- **Langkah 2 "Susun soal"**: bank soal sebagai **baris yang bisa dicentang** (`.pilih-soal` +
  `.kotak-centang`, `role="checkbox"` + `aria-checked`, sasaran sentuh satu baris ≥44 px) dengan lencana
  "nonaktif" untuk soal yang tidak aktif; panel susunan bernomor (`.baris-ringkas` + `.susunan-no`) dengan
  tombol naik/turun/keluarkan ber-`aria-label` yang menyebut nomor soal, plus total soal & poin.
  Tombol **"Lanjut: tinjau"** menyimpan susunan lewat `PUT /v1/kuis/{id}/soal` lalu membuka langkah 3.
- **Langkah 3 "Tinjau dan publikasi"**: daftar kelengkapan (lencana **Lengkap/Belum**), tiga petak
  ringkasan (kelas + jumlah murid, jadwal + durasi, jumlah soal + poin), pengingat "soal tidak bisa diubah
  lagi setelah kuis berjalan", dan tombol **"Publikasikan kuis"** yang mati selama masih ada butir "Belum".
- Kepala halaman memakai `HeaderHalaman` (jejak = tombol kembali) + lencana status kuis; daftar kuis
  memakai satu tombol ikon hapus (`TombolIkon`, `aria-label` menyebut judul kuis).

### A.28.2 Papan 11 — Editor soal berpratinjau (`sections/question/EditorSoal.jsx`)

- Tata letak baru: **tiga kartu bernomor** di kolom utama (1. Pilih jenis soal → 2. Tulis soalnya →
  3. Pengaturan soal) dan **sisi kanan lengket** (`.sisi-lengket`, jadi statis di bawah `lg`) berisi
  **Pratinjau (kunci ditandai)** dan **Kelengkapan**.
- **Jenis soal memakai pil** (`.pil-tipe`, `role="radiogroup"`/`role="radio"` + `aria-checked`) untuk
  delapan tipe, bukan lagi `<select>`; kunci benar/salah juga pil.
- **Kelengkapan** adalah daftar periksa turunan validator yang sudah ada: dari satu sumber aturan
  (`kelengkapanSoal()`) sehingga daftar tidak pernah berbeda pendapat dengan `validasiSoal()` — kesetaraan
  itu dijaga tes. Tombol simpan mati selama masih ada butir "Belum".
- Pratinjau **tetap memakai `RendererSoal`** yang sama dengan layar murid (bukan pratinjau khusus), jadi
  yang dilihat guru memang yang dilihat murid.
- `HalamanBankSoal.jsx` memakai `HeaderHalaman` (jejak = tombol kembali ke daftar); daftar soal tidak lagi
  menaruh `<h1>` di dalam kartu dan formulirnya benar-benar jadi halaman editor terpisah.

### A.28.3 Satu sistem tombol (sisa DoD)

- **Semua kelas tombol bawaan Bootstrap hilang dari JSX**: 46 `btn-sm`, 28 `btn-outline-*`, 1 `btn-primary`
  diganti `Tombol`/`TombolTaut`/`TombolIkon` (atau `btn btn-tepi btn-sedang` untuk tautan unduh CSV yang
  bukan navigasi internal).
- **Pemetaan `btn-outline-*`/`btn-primary`/`btn-sm` di `theme.css` dihapus** karena sudah tidak ada
  pemakaiannya; dibiarkan ada berarti menyembunyikan warna biru bawaan Bootstrap yang gagal kontras AA.
- **Penjaga baru**: `src/__tests__/sistemTombol.test.js` memindai seluruh JSX dan menolak
  `btn-outline-*`/`btn-primary`/`btn-secondary`/`btn-sm`, sekaligus memastikan `theme.css` tidak lagi
  menulis ulang kelas-kelas itu (grep ini yang diminta DoD, sekarang jadi tes).
- Tombol ikon di baris aksi kartu **tidak lagi direntangkan** selebar baris di layar sempit
  (`.kartu-aksi > .btn-ikon`) — sebelumnya ikon hapus jadi selebar kartu.

### A.28.4 Berkas yang dibuat/diubah

Dibuat:

- `frontend/src/shared/ui/LangkahPil.jsx` — pil langkah (navigasi) untuk alur bersusun.
- `frontend/src/sections/quiz/susunKuis.js` — aturan murni alur tiga langkah (daftar langkah, kelengkapan,
  ringkasan jadwal, total poin).
- `frontend/src/__tests__/shared/ui/langkahPil.test.jsx` (3 tes)
- `frontend/src/__tests__/sections/quiz/susunKuis.test.js` (11 tes)
- `frontend/src/__tests__/sistemTombol.test.js` (2 tes)
- `docs/smoke-ui-susun.mjs` — smoke UI papan 10 & 11 lewat CDP (40 pemeriksaan).

Diubah:

- `frontend/src/sections/quiz/HalamanKuis.jsx` — alur tiga langkah + kepala halaman + bank soal centang.
- `frontend/src/sections/quiz/HalamanKuisDetail.jsx`, `HalamanKuisMurid.jsx` — tautan jadi `TombolTaut`.
- `frontend/src/sections/question/EditorSoal.jsx` — tiga kartu + sisi pratinjau/kelengkapan.
- `frontend/src/sections/question/HalamanBankSoal.jsx` — `HeaderHalaman` + editor sebagai halaman.
- `frontend/src/sections/question/validasi.js` — `kelengkapanSoal()` + `siapSoal()` (dan `skorWajar()`).
- `frontend/src/__tests__/sections/question/validasi.test.js` — 4 tes kelengkapan + kesetaraan.
- `frontend/src/sections/{material,presence,attempt,school,settings}/*.jsx` — sisa kelas tombol Bootstrap.
- `frontend/src/theme/theme.css` — primitif baru (`.pil-langkah`, `.pilih-soal`, `.kotak-centang`,
  `.baris-ringkas`, `.kotak-kosong`, `.petak-ringkas`, `.bidang`, `.pil-tipe`, `.kotak-huruf`,
  `.label-kunci`, `.baris-pratinjau`, `.judul-kecil`, `.sisi-lengket`, `.putar-90/270`), aturan tombol ikon
  di baris aksi, pemetaan tombol Bootstrap dihapus.
- `docs/smoke-ui-nav.mjs` — tombol ikon tidak lagi dianggap harus selebar baris + pemeriksaan barunya.
- `docs/smoke-ui-slice03.mjs` — mengikuti alur tiga langkah (pilih soal → "Lanjut: tinjau" → publikasi),
  jadwal di depan dulu saat menyusun (server menolak ubah susunan saat kuis berjalan), lalu jadwal digeser
  ke jendela berjalan untuk smoke slice 04; pemeriksaan sisi murid disesuaikan K-02 (soal tidak lagi
  tampil sebelum attempt dimulai).
- `docs/smoke-ui-slice04.mjs` — memilih kuis yang benar-benar terlihat murid uji (kelas 5A).

### A.28.5 Verifikasi (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `./verify.sh` (root) | **SEMUA HIJAU, exit 0** — Pest **227 passed (1818 assertions)** · Pint OK · checkJs OK · ESLint **0 error** (2 warning lama `watch()` di halaman auth) · Vitest **53 berkas / 428 test** · realtime 15 test |
| `npm run build` (frontend) | **✓ built** (337 modul) |
| `node docs/smoke-ui-susun.mjs` (baru; Chrome CDP, backend :8000 + vite :5173 hidup) | **40/40 lulus** |
| `node docs/smoke-ui-nav.mjs` | **14/14 lulus** (naik dari 13: ditambah pemeriksaan tombol ikon tetap persegi) |
| `node docs/smoke-ui-slice03.mjs` | **9/9 lulus** (sebelumnya mentok di tombol "Simpan susunan" yang sudah tidak ada) |

Rincian yang dibuktikan smoke baru (bukan sekadar "halaman terbuka"): halaman kuis menyimpan draf lalu
berpindah ke langkah 2; baris bank soal menjadi `aria-checked="true"` saat dicentang; susunan menampilkan
`1,2` dengan tombol naik/turun ≥44 px ber-label objek; langkah 3 menampilkan 8 butir kelengkapan yang
semuanya "Lengkap" dan menyalakan tombol publikasi; di layar 390 px **luber mendatar 0 px** dan tidak ada
sasaran sentuh <44 px; di bank soal, `h1` berubah jadi "Tambah soal", 8 pil jenis soal berperan radio, sisi
kanan `position: sticky`, ganti jenis soal menampilkan bidang isian singkat, daftar kelengkapan berubah
"Belum" → "Lengkap", tombol simpan hidup kembali, lalu tersimpan ("Soal ditambahkan") dan muncul di daftar.
Kuis draf **dan** soal contoh yang dibuat smoke dihapus lagi lewat API di akhir (dijaga, jadi DB dev tidak
menumpuk data uji).

### A.28.6 Keputusan teknis

- **Langkah 2 menyimpan susunan sebelum langkah 3.** Publikasi di server menolak kuis tanpa soal, jadi
  "Lanjut: tinjau" memanggil `PUT /v1/kuis/{id}/soal` lebih dulu; kalau server menolak (mis. kuis sudah
  berjalan), guru tetap di langkah 2 dengan pesan galat — bukan diam-diam pindah halaman.
- **Menyimpan draf di langkah 1, bukan menahan semuanya di memori.** API yang ada memang butuh id kuis
  sebelum soal bisa dikaitkan; menahan berarti menambah endpoint baru tanpa manfaat.
- **Daftar kelengkapan adalah turunan validator, bukan daftar tulis tangan kedua.** Satu aturan dipakai
  untuk pesan galat dan untuk daftar periksa; tes menjaga keduanya tidak bercabang.
- **Pratinjau tetap `RendererSoal`** supaya pratinjau tidak pernah "lebih baik" dari layar murid.
- **Nama kelas CSS baru berbahasa Indonesia dan mengikuti token**; `.langkah` yang lama (stepper vertikal
  `Langkah.jsx`) tidak dipakai ulang supaya tidak ada dua arti untuk satu nama.

### A.28.7 Batasan jujur (yang belum selesai)

- **Papan 8 hanya sebagian** (susunan "antrean kiri + detail kanan + stepper skor" belum) — sama seperti
  A.27, tidak disentuh putaran ini.
- **Smoke slice 04 belum dibereskan sepenuhnya.** Setelah pemilihan kuis diperbaiki, enam pemeriksaan
  pertama lulus (timer, soal tanpa kunci, respons attempt tanpa kunci); sisa langkah masih gagal karena
  harness memakai teks UI versi lama (penghitung `1 / N` yang sekarang berbunyi `1 dari N terjawab`, tombol
  "Kumpulkan jawaban" yang sekarang "Selesai") **dan** karena attempt lama dari jalan sebelumnya sudah
  menyimpan susunan lama (server sengaja membekukan soal per attempt). Halaman pengerjaan sendiri
  diverifikasi manual lewat CDP pada putaran ini: 61 soal, timer berjalan, jawaban tidak memuat kunci.
- **Smoke slice 05–07 belum dijalankan ulang** (ketergantungan pada paginasi & teks UI lama belum
  dibereskan).
- **Tidak ada uji regresi visual/screenshot**; bukti tata letak dari geometri CDP (luber, tinggi sasaran
  sentuh, `position`).
- **Belum ada `git commit`/`push`** untuk putaran ini (tidak diminta).

---

## A.29 Putaran Verifikasi — Smoke Mandiri Slice 04–07 dan Bug Daftar Kolom Soal Letak Kata (10 Oktober 2026)

A.28.7 mencatat jujur bahwa smoke slice 04–07 belum dibereskan (harness memakai teks UI lama dan
bergantung pada sisa data uji). Putaran ini menutup utang itu: **setiap harness kini membuat ulangannya
sendiri, memeriksa lewat layar yang benar-benar dipakai murid dan guru, lalu membersihkan jejaknya**.
Harness baru itu langsung menemukan satu bug nyata di jalur murid yang tidak tertangkap uji backend.

### A.29.1 Bug nyata: soal letak kata sampai ke murid tanpa daftar kata & kolom (Q-19)

- `AttemptService::payloadSoal()` mengirim soal ke layar pengerjaan sebagai **daftar putih kolom** supaya
  kunci tidak pernah ikut. Daftar itu sempat hanya memuat `opsi`, `kiri`, `kanan`, `item`.
- Soal **letak kata** memakai `kata` + `posisi` (registry penilaian dan renderer memakai nama yang sama),
  jadi keduanya tidak ikut terkirim. Akibatnya di perangkat murid kartu soal tampil dengan teks soal saja —
  **tanpa kata yang harus ditempatkan dan tanpa pilihan kolom**: soal mustahil dijawab dari layar.
- Kenapa uji lama tidak menangkapnya: penilaian (`jawab` + `kumpulkan`) memakai snapshot lengkap di server,
  jadi jawaban yang dikirim lewat API tetap dinilai benar/salah. Yang rusak hanya jalur tampilan — dan
  jalur itulah yang dipakai anak.
- Perbaikan: daftar putih ditambah `kata` dan `posisi`, dengan komentar yang menjelaskan bahwa daftar ini
  harus sejalan dengan daftar yang dipakai renderer tiap tipe.
- Penjaga: tes baru `Slice06Test` — *"layar murid menerima daftar yang dibutuhkan tiap tipe soal baru"* —
  memastikan tiap tipe membawa daftar yang dipakai renderer-nya, id-nya utuh, dan tidak membawa `kunci`.
  Tes ini sudah dibuktikan **gagal** bila perbaikannya dibalik (1 failed / 6 assertions), jadi bukan tes
  hiasan.
- Harness smoke slice 06 juga memeriksa hal yang sama dari sisi layar: kata `kucing`, `berlari` dan kolom
  `Subjek`, `Predikat` harus benar-benar tampil di kartu soal murid.

### A.29.2 Smoke slice 04–07 kini mandiri (bisa dijalankan berulang)

Sebelumnya tiap harness mengambil kuis/soal sisa dari DB dev, menyalakan pengaturan global, dan menyisakan
jejak. Sekarang pola tiap harness: **siapkan punya sendiri → periksa → bersihkan** (di blok `finally`,
jadi tetap bersih walau pemeriksaan gagal).

| Harness | Pemeriksaan | Yang dibuat & dibersihkan |
| --- | --- | --- |
| `smoke-ui-slice04.mjs` | **18/18** | 2 soal + ulangan + penjadwalan; dihapus lagi |
| `smoke-ui-slice05.mjs` | **20/20** | tag + 2 soal + ulangan; pengaturan retry/batas/ranking dipulihkan |
| `smoke-ui-slice06.mjs` | **27/27** | 4 soal (isian, uraian, letak kata, hubung kata) + ulangan |
| `smoke-ui-slice07.mjs` | **20/20** | 1 soal + ulangan + saklar proteksi lapis kuis (dimatikan lagi) |

Isi pemeriksaannya (yang benar-benar dijalankan, bukan klaim):

- **slice 04** — layar pengerjaan satu soal per layar: timer dari server, navigator kisi membawa murid ke
  soal yang dicari (walau urutan dari server diacak), autosave benar-benar sampai ke server, penghitung
  "x dari N terjawab" bertambah, tombol **Selesai → dialog ringkasan → Kumpulkan**, halaman hasil memuat
  skor tanpa kunci/pembahasan, kumpul ulang idempoten, dan jawaban sesudah dikumpulkan ditolak (403).
- **slice 05** — percobaan pertama tersimpan sebagai **skor asli**, ulangan ulang berjalan dengan
  `attempt_no = 2` dan `asli = false`, skor ulang tercatat terpisah, peringkat murid **kosong** saat saklar
  ranking mati lalu menampilkan **attempt asli** (skor asli tetap utuh) saat saklar menyala, halaman
  laporan tema guru memuat tema uji, dan halaman progres tema/lencana murid tampil.
- **slice 06** — empat tipe baru dibuat dari bank soal lalu diterbitkan; di layar murid tiap tipe memakai
  kendali yang tepat (kotak teks isian, area uraian, dua pilihan posisi letak kata, dua pilihan pasangan
  hubung kata) dan **isinya benar-benar tampil**; jawaban uraian muncul kembali setelah halaman dimuat
  ulang; penilaian otomatis (sinonim isian, letak/ hubung kata) dan uraian yang belum cocok ditandai
  "perlu tinjau"; guru mengoreksi lewat layar koreksi (token konfirmasi lewat UI), lalu token sekali pakai,
  token palsu, dan alasan terlalu pendek ditolak server.
- **slice 07** — saklar proteksi lapis kuis (`sumber = kuis`), pemberitahuan proteksi muncul tapi **bukan
  gerbang** (ulangan tetap bisa dikerjakan), percobaan menempel jawaban tercatat di server, Live Monitor
  menampilkan baris murid dengan status "Hadir" dan panel "Catatan untuk ditinjau", tiket SSE dipakai
  sekali (penggunaan kedua 401) dengan header anti-buffer, dan tinjauan "tidak valid" lewat DOM mengubah
  status catatan di server.

### A.29.3 Perbaikan kerapuhan harness (temuan sampingan)

- **Throttle masuk (5 percobaan/menit per akun+IP)** membuat smoke yang dijalankan beruntun gagal 429.
  Server memang benar membatasi; harness yang salah kalau menuntut sebaliknya. Sekarang tiap harness
  menunggu 20 detik lalu mencoba lagi (maksimum 3 kali), dengan catatan di layar saat itu terjadi.
- **Tab Chrome menumpuk**: tiap harness membuat target baru dan tidak pernah menutupnya; setelah beberapa
  kali jalan ada 36 target tertinggal. Sekarang setiap harness menutup targetnya sendiri di akhir.
- **`/v1/murid` berpaginasi**, jadi mencari murid uji "di halaman pertama" tidak lagi sah — harness memakai
  `per_page=100`.
- **Teks UI yang sudah berubah** ikut disesuaikan: satu soal per layar, penghitung "x dari N terjawab",
  "Selesai" (bukan "Kumpulkan jawaban"), panel "Catatan untuk ditinjau".
- **Satu salah tulis di seeder** (`UserStatus` menjadi `Usa_erStatus` di `RolesAndAdminSeeder`) membuat
  **213 tes backend gagal** sekaligus saat `verify.sh` dijalankan; dipulihkan, lalu seluruh suite hijau
  kembali. Dicatat di sini karena gerbang verifikasi memang menangkapnya sebelum apa pun dirilis.

### A.29.4 Berkas yang dibuat/diubah

- `backend/app/Sections/Attempt/Services/AttemptService.php` — daftar putih kolom payload soal + `kata`,
  `posisi` (Q-19).
- `backend/tests/Feature/Slice06Test.php` — tes penjaga Q-19 (16 tes di berkas ini).
- `backend/database/seeders/RolesAndAdminSeeder.php` — pulihkan `UserStatus` (salah tulis).
- `docs/smoke-ui-slice04.mjs` — ditulis ulang: mandiri + alur satu-soal-per-layar + tutup tab + tahan 429.
- `docs/smoke-ui-slice05.mjs` — ditulis ulang: mandiri + pengaturan dipulihkan.
- `docs/smoke-ui-slice06.mjs` — ditulis ulang: mandiri + kendali per tipe lewat navigator.
- `docs/smoke-ui-slice07.mjs` — ditulis ulang: mandiri + proteksi lapis kuis.
- `docs/smoke-ui-slice03.mjs`, `docs/smoke-ui-nav.mjs`, `docs/smoke-ui-susun.mjs` — tutup tab + tahan 429.
- `docs/laporan-pengujian.md`, `docs/handoff-sesi.md` — laporan ini.

### A.29.5 Verifikasi (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `./verify.sh` (root) | **SEMUA HIJAU, exit 0** — Pest **228 passed (1833 assertions)** · Pint OK · checkJs OK · ESLint 0 error (2 warning lama) · Vitest 53 berkas · realtime 15 test |
| `php artisan test --filter=Slice06Test` | 16 passed (153 assertions), termasuk penjaga Q-19 |
| Penjaga Q-19 dibalik (kontrol negatif) | 1 failed / 6 assertions — tes memang menangkap bug itu |
| Seluruh smoke UI dalam satu tarikan: `nav` → `susun` → `03` → `04` → `05` → `06` → `07` | **semuanya exit 0**: 14/14 · 40/40 · 9/9 · 18/18 · 20/20 · 27/27 · 20/20 (**148 pemeriksaan**) |
| `node docs/smoke-ui-slice04.mjs` diulang dua kali berturut | 18/18 pada kedua jalan (kuis uji baru tiap jalan, jejak dibersihkan) |
| `node docs/smoke-ui-slice05.mjs` diulang dua kali berturut | 20/20 pada kedua jalan |
| `node docs/smoke-http-fitur.mjs` (242 pemeriksaan API, A–P) | **242/242 lulus, 0 gagal** (29,3 dtk) — termasuk 25 pemeriksaan presence/anti-cheat/layar/SSE |

### A.29.6 Keputusan teknis

- **Harness membuat datanya sendiri, bukan memakai sisa data dev.** Memperbaiki teks UI saja tidak cukup:
  pemeriksaan yang bergantung pada kuis sisa membuat hasilnya berubah-ubah, dan pernah gagal karena alasan
  yang salah (kuis milik kelas lain → murid ditolak server). Kuis uji dibuat untuk **kelas murid uji**, jadi
  izinnya pasti cocok.
- **Membersihkan di blok `finally`.** Hapus ulangan ikut menghapus attempt, jawaban, catatan kecurangan, dan
  tiket SSE (semua FK `cascadeOnDelete`), jadi satu langkah sudah cukup; soal uji Bank Soal dihapus
  terpisah, dan pengaturan yang diubah dipulihkan.
- **429 bukan diakali.** Throttle `auth` dipertahankan apa adanya (itu perlindungan nyata), dan harness yang
  menunggu. Menurunkan batas server demi kenyamanan smoke akan melemahkan fitur yang justru diuji.
- **Penjaga bug diletakkan di backend, bukan hanya di smoke.** Smoke butuh empat layanan hidup; tes Pest
  menjaga aturan ini tetap jalan di gerbang wajib (`verify.sh`).

### A.29.7 Batasan jujur (yang belum selesai)

- **Papan 8 (halaman Koreksi) masih sebagian**: susunan "antrean kiri + detail kanan + stepper skor" belum
  dikerjakan (sama seperti A.27/A.28); alur koreksinya sendiri sudah terbukti jalan di smoke slice 06.
- **Tidak ada uji regresi visual/screenshot**; bukti tata letak dari geometri DOM/CDP.
- **Smoke UI membutuhkan empat layanan hidup** (backend, vite, realtime, Chrome CDP), jadi tidak ikut
  `verify.sh`; nilainya dijaga oleh tes Vitest/Pest untuk aturan yang sama, dan harnessnya dijalankan
  manual lalu dicatat di sini.
- **Editor materi masih terbukti dengan satu berkas MP4 dev**, bukan semua kodek (batasan lama yang belum
  berubah).
- **Lima soal uji sisa versi harness lama masih ada di bank soal dev** (id 57–60 dan 150, bertanda
  `SMOKE-`). Bukan kelalaian yang disembunyikan: soal 57–60 sudah **dijawab murid** dan semuanya masih
  terpasang di kuis terbit, jadi server menolaknya dengan 422 — persis aturan yang menjaga riwayat nilai
  (Q-09). Soal 150 juga tertahan karena kuis pemakainya sedang berjalan. Harness versi baru (A.29.2)
  membuat dan menghapus soalnya sendiri, jadi tidak ada sisa baru yang ditambahkan lagi.
- **Belum ada `git commit`/`push`** untuk putaran ini (tidak diminta).

## A.30 Putaran 22 Tipe Soal — Objektif 1 Selesai (10 Oktober 2026)

Prompt eksternal (di luar repo) meminta dua objektif: (1) menambah tipe soal dari 8 menjadi 22 beserta
penilaian parsial, dan (2) deteksi extension. Putaran ini mengerjakan **objektif 1 sampai tuntas**
(dikerjakan tiga gelombang); objektif 2 belum disentuh.

### A.30.1 Penilaian parsial dulu (gelombang 0)

Kontrak `PenanganTipeSoal` kini punya `bobot(array $konten, array $kunci, mixed $jawaban): float` (0.0–1.0).
Delapan tipe lama memakai trait `BobotBiner` (`bobot() = nilai() ? 1.0 : 0.0`), jadi perilakunya tidak
berubah sama sekali; `PenilaianObjektif` menghitung `skor = bobot × skor_soal` dan menandai `benar` hanya
saat bobot 1.0 (skor sebagian memakai kolom `answers.skor` yang sudah ada). Pagar arsitektur menegakkan
dua hal: setiap tipe di enum punya penangan, dan setiap penangan punya metode kontrak lengkap
termasuk `bobot()`.

### A.30.2 Empat belas tipe baru

| Gelombang | Tipe | Catatan penilaian |
| --- | --- | --- |
| 1 | `pilihan_ganda_kompleks` | himpunan sama = 1.0, selain itu `max(0, (benar dipilih − salah dipilih) / jumlah benar)` |
| 1 | `benar_salah_majemuk` | baris cocok / total baris |
| 1 | `isian_angka` | masuk toleransi = 1.0 (koma dibaca sebagai pemisah desimal) |
| 1 | `pilihan_gambar` | 1.0 / 0.0 |
| 1 | `urut_gambar` | posisi tepat / total |
| 1 | `susun_huruf` | 1.0 bila susunan sama; huruf diacak server (seed attempt) |
| 2 | `isian_rumpang` | lubang cocok / total lubang |
| 2 | `klasifikasi` | item benar / total item |
| 2 | `tabel_isian` | sel kosong benar / total sel kosong |
| 2 | `garis_bilangan` | masuk toleransi = 1.0 |
| 3 | `hotspot_gambar` | titik jawab `{x,y}` (0–1) masuk salah satu area benar = 1.0 |
| 3 | `baca_jam` | jam 0–11 + menit 0–59 sama persis = 1.0 |
| 3 | `tugas_unggah` | **bukan objektif**: selalu `PerluTinjau`, masuk antrean koreksi guru lewat rubrik |
| 3 | `teka_silang_mini` | kata benar / total kata (mendatar + menurun) |

`TipeSoal::cases()` = **22** (diperiksa langsung: `php -r "… echo count(TipeSoal::cases());"` → `22`) dan
`RegistryTipeSoal::penangan()` mencakup semuanya (pagar arsitektur + label tiap tipe diuji).

### A.30.3 Janji keamanan yang diuji eksplisit

- Payload murid (`AttemptService::payloadSoal`) tidak pernah memuat kunci untuk tipe baru mana pun:
  hotspot hanya mengirim `media` + kotak area (tanpa `area_benar`), susun huruf hanya mengirim huruf
  teracak, isian rumpang/tabel isian/teka silang tidak pernah mengirim jawaban diterima atau huruf kunci.
- Uji Pest khusus (`it payload murid…`) menegaskan hal itu untuk gelombang 1, 2, dan 3.
- `baca_jam` sengaja tidak menyimpan waktu yang benar di `konten` — kalau ada, jawabannya ikut terkirim ke
  perangkat murid. Perintahnya ditulis sebagai kalimat, kunci `jam`/`menit` tetap di server.

### A.30.4 Dua bug nyata yang ditangkap tes baru

1. **Kotak klasifikasi tampil kosong.** Editor dan renderer membaca `teks` dari `konten.kotak`, padahal
   konten menyimpan `label`. Akibatnya soal tersimpan kehilangan label kotak saat dibuka lagi, dan pilihan
   kotak di layar murid tampil tanpa tulisan. Diperbaiki dengan helper `daftarLabel()` + loader `stateDariSoal`.
2. **Daftar jawaban diterima tidak muncul di pratinjau guru.** `rekamanTeks()` membuang nilai non-teks,
   sedangkan `kunci.lubang`/`kunci.sel` berisi array. Diperbaiki dengan `rekamanDaftarTeks()`.

### A.30.5 Berkas yang dibuat/diubah

Backend (dibuat): `PenanganPilihanGandaKompleks`, `PenanganBenarSalahMajemuk`, `PenanganIsianAngka`,
`PenanganPilihanGambar`, `PenanganUrutGambar`, `PenanganSusunHuruf`, `PenanganIsianRumpang`,
`PenanganKlasifikasi`, `PenanganTabelIsian`, `PenanganGarisBilangan`, `PenanganHotspotGambar`,
`PenanganBacaJam`, `PenanganTugasUnggah`, `PenanganTekaSilangMini` (semuanya di
`app/Sections/Question/Registry/`).
Backend (diubah): `Question/Registry/BobotBiner.php` (baru), `PenanganTipeSoal.php`,
`RegistryTipeSoal.php`, `Question/Enums/TipeSoal.php`, `Scoring/Services/PenilaianObjektif.php`,
`Scoring/Services/PenilaiSoal.php` (tugas unggah → `PerluTinjau`), `Attempt/Services/Pengacakan.php`
(`urutHuruf`), `Attempt/Services/AttemptService.php` (daftar putih payload), `database/seeders/BankSoalSeeder.php`,
`tests/Arch/ArchitectureTest.php`, `tests/Feature/Slice11TipeSoalTest.php`.
Frontend (dibuat): 14 renderer `render/SoalXxx.jsx` untuk tipe baru.
Frontend (diubah): `sections/question/tipeSoal.js`, `validasi.js`, `EditorSoal.jsx`,
`render/RendererSoal.jsx`, `theme/theme.css`, `__tests__/sections/question/tipeBaru.test.js`,
`__tests__/sections/question/render/renderer.test.jsx`.

### A.30.6 Verifikasi (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `./verify.sh` (root) | **SEMUA HIJAU, exit 0** — Pest · Pint · checkJs · ESLint (0 error, 2 warning lama React Hook Form) · Vitest · realtime |
| `php artisan test` | **251 passed (2215 assertions)** |
| `npx vitest run` | **54 berkas, 484 test, semuanya lulus** |
| `php artisan test --filter=Slice11` | 20 passed (264 assertions) |
| `php -r "count(TipeSoal::cases())"` | `22` |
| Contoh bank soal semua tipe (`it menyediakan contoh bank soal…`) | 14 soal contoh lolos `RegistryTipeSoal::validasi` |

### A.30.7 Keputusan teknis (satu kalimat per keputusan)

- `baca_jam` memakai format 12 jam dan waktunya **tidak** ada di konten; murid mengetik jam/menit dan jam
  analog di layar hanya menampilkan pilihannya.
- `teka_silang_mini`: `konten.grid` hanya bentuk kotak (`''` diisi murid, `'#'` kotak hitam), huruf
  jawaban hidup di `kunci.sel`; petunjuk menyimpan sel awal + panjang, dan server memeriksa kata wajib
  sebaris/sekolom serta berurutan.
- Editor hotspot memakai persen 0–100 (ramah guru), dikonversi ke 0–1 saat dikirim.
- Papan teka silang dan petunjuknya **tidak** diacak di payload; mengacak barisnya merusak teka-tekinya.
- `tugas_unggah` diberi jalur khusus di `PenilaiSoal` supaya jawaban berupa teks tidak jatuh ke
  pencocokan kata kunci `PenilaianTeks`.
- Berkas jawaban `tugas_unggah` memakai panel unggah yang sudah ada di layar pengerjaan; renderer hanya
  menyiapkan instruksi, jenis berkas, dan catatan anak.
- Renderer tipe baru memakai kelas CSS yang ditambahkan di `theme.css` (target sentuh ≥ 44 px), tanpa library baru.

### A.30.8 Batasan jujur (yang belum selesai)

- **Objektif 2 baru dikerjakan sebagian (2A).** Yang sudah jadi: `KategoriKecurangan` menaruh
  `tamper_suspected` di kelompok turunan server (`dariKlien() = false`), ditambah kategori klien
  `dom_injection` (skor 7) dan `extension_detected` (skor 6) beserta labelnya. Lihat A.30.9.
  Yang belum ada: MutationObserver + pemindai berkala di klien, pemeriksaan integritas fungsi
  proteksi, endpoint denyut ber-nonce, dan `SapuPresence` yang mengubah denyut berhenti menjadi
  `tamper_suspected`.
- `docs/word/` belum disegarkan karena `docs/export-log-sesi.py` + `docs/export-word.sh` belum dijalankan.
- `docs/export-log-sesi.py` + `docs/export-word.sh` **belum dijalankan** untuk putaran ini, jadi dokumen
  Word di `docs/word/` belum disegarkan.
- Smoke UI (`docs/smoke-ui-*.mjs`) belum dijalankan untuk tipe baru; bukti perilakunya masih dari
  Pest/Vitest.
- Editor hotspot hanya memakai kotak angka (tanpa tarik-lepas area di atas gambar), dan editor teka silang
  memakai konvensi teks (huruf + `#`) alih-alih klik per kotak.

### A.30.9 Objektif 2A — kategori kecurangan selaras (dijalankan)

- `KategoriKecurangan::TamperSuspected` pindah ke kelompok **turunan server** (`dariKlien() = false`),
  supaya murid tidak bisa menulis sendiri "dugaan gangguan proteksi" untuk mengaburkan catatan.
- Kategori klien baru: `dom_injection` (skor risiko 7, label “Elemen asing disisipkan ke halaman”) dan
  `extension_detected` (skor risiko 6, label “Extension peramban terdeteksi”). Label Live Monitor ikut
  otomatis karena UI memakai `kategori_label` dari `KejadianKecuranganResource`.
- Uji baru di `tests/Feature/Slice07Test.php`: tabel kebenaran `dariKlien()` untuk semua kasus enum,
  kiriman klien `dom_injection` + `extension_detected` diterima (201), dan `tamper_suspected` dari klien
  ditolak (422) tanpa menambah baris catatan.
- Uji lama yang mengirim `tamper_suspected` dari klien diganti memakai `dom_injection`; perilaku
  append-only-nya tetap diuji apa adanya.
- Hasil: `php artisan test --filter=Slice07` → **16 passed (163 assertions)**; `./verify.sh` **SEMUA HIJAU**;
  total setelah 2A: `php artisan test` **253 passed (2256 assertions)**, `npx vitest run` **54 berkas / 484 test**.
- Belum: pengirim sisi klien untuk dua kategori baru, denyut ber-nonce, `SapuPresence`, dan pemeriksaan
  integritas fungsi proteksi (bagian 2B–2D).

---

## A.31 Putaran Editor Materi Gaya Video Editor + Kuis Sisipan di Dalam Klip (10 Oktober 2026)

Permintaan pengguna: menerapkan paket perubahan eksternal (`files (67).zip` — dua patch
`editor-video-backend.patch` + `editor-video-frontend.patch`, plus `file-berubah.zip` berisi 17 berkas
utuh) ke repo ini, dengan izin "boleh langsung apply atau boleh modif".

### A.31.1 Cakupan paket dan cara penerapannya

- Kedua patch diterapkan dengan `git apply` dan **apply bersih** — 8 berkas backend, 9 berkas frontend.
- Hasil penerapan dicocokkan dengan isi `file-berubah.zip` memakai `diff -rq`: **identik**, kecuali
  `frontend/src/theme/theme.css`. Basis zip itu 438 baris lebih tua (belum memuat CSS "tipe soal baru"),
  jadi versi proyek yang memuat keduanya dipertahankan; patch melaporkan **offset 438 pada kelima hunk**
  `theme.css`, bukti bahwa yang ditambahkan memang blok fitur ini dan bukan CSS fitur lain.
- Isi fitur: kolom `materials.rasio` (`16:9`/`9:16`/`1:1`/`4:3`); pengaturan tampilan per klip di dalam
  kolom JSON `isi` (`tampilan`: media `fit`/`fokus_x`/`fokus_y`/`zoom`; kuis `mode`/`tata`);
  `MateriService::validasiTampilan()` menormalkan nilai dan menolak nilai di luar daftar;
  `ProgresMateriService` mengurutkan bagian menurut timeline, menghitung `host_id` (kuis yang titik
  mulainya jatuh di dalam jendela klip media berputar) dan `boleh_dibuka`, serta `pastikanSisipanSelesai()`
  yang menahan penutupan video selama kuis wajib di dalamnya belum selesai; di frontend ada
  `PemutarMateri.jsx` + `pemutarMateri.js` (kapan kuis muncul saat video berjalan) dan editor bergaya
  video editor dengan bingkai rasio terkunci.

### A.31.2 Modifikasi yang saya lakukan (dan alasannya)

Patch itu apa adanya **tidak lolos pagar mutu repo ini**. Yang saya ubah adalah penyebabnya, bukan
menurunkan pagar mutu:

| Temuan | Sifat | Perbaikan |
| --- | --- | --- |
| `z.record(z.union([z.string(), z.number()]))` ×3 di `sections/material/api.js` | **bug nyata**, bukan sekadar tipe | Di Zod 4, satu argumen di `z.record()` diperlakukan sebagai **tipe kunci** dan nilainya menjadi `unknown` — jadi skema `tampilan` tidak memvalidasi nilainya sama sekali. Ditulis `z.record(z.string(), z.union([z.string(), z.number()]))`, sama dengan konvensi berkas lain (`scoring/api.js`, `report/api.js`, `settings/api.js`, dst.) |
| `style={{ '--r': … }}` di `EditorMateri.jsx` + `PemutarMateri.jsx` | tipe | Custom property CSS tidak ada di tipe `CSSProperties` React; diberi cast `/** @type {import('react').CSSProperties} */` |
| `gayaMedia()` menerima `BarisBlok` penuh padahal hanya membaca `tipe` + `tampilan` | tipe | Param dilonggarkan ke bentuk yang benar-benar dipakai (`Pick<BarisBlok,'tipe'> & { tampilan? }`) alih-alih cast di pemanggil, supaya pemanggil yang mengirim objek ringkas tetap benar |
| `tertutupRef` dibaca **saat render** (`sisaWajib(sisipan, tertutupRef.current)`) | ESLint `react-hooks/refs` | Diganti state `tertutup`; penjagaan agar kuis yang sama tidak terpicu ulang tetap ada di `kuisJatuhTempo` |
| Efek "bersihkan keadaan saat blok berganti" memanggil `setState` sinkron di dalam `useEffect` | ESLint `react-hooks/set-state-in-effect` | Efek dihapus, perilakunya diganti `key={blokAktif.block_id}` di `HalamanMateriMurid.jsx`: pindah klip = komponen dipasang ulang, keadaan kuis bersih tanpa render berantai |
| Parameter implisit `any` di 2 berkas tes baru | tipe | Diberi anotasi JSDoc |

### A.31.3 Verifikasi (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `git apply --check` kedua patch | lolos (backend 8 berkas, frontend 9 berkas) |
| `diff -rq file-berubah.zip` vs proyek | hanya `theme.css` berbeda; selisihnya 438 baris CSS fitur lain yang memang sudah ada di proyek (lihat A.31.1) |
| `php artisan test --filter=Slice08Test` | **12 passed (172 assertions)** — termasuk 3 tes baru dari paket (`jumlah_blok` tanpa lazy loading, rasio + normalisasi tampilan, kuis di dalam video yang tidak mengunci dirinya) |
| `npx vitest run src/__tests__/sections/material` | **54 passed** (4 berkas) |
| `./verify.sh` (root) | **SEMUA HIJAU exit 0** — Pest **256 passed (2304 assertions)** · Pint **335 berkas** · checkJs **OK** · ESLint **0 error, 2 warning lama** (React Hook Form) · Vitest **56 berkas / 505 test** · realtime **15 test** |
| Migrasi `2026_10_10_000001_tambah_rasio_materi.php` | ikut terjalankan tiap suite (RefreshDatabase, sqlite `:memory:`); kolom `rasio` diuji lewat endpoint, bukan hanya dibaca |
| `docs/jalankan-smoke-materi.sh` → `docs/smoke-ui-materi.mjs` (backend :8000, vite :5173, Chrome CDP :9333) | **22/22 lulus, exit 0** — guru menyusun materi (rasio 9:16 + pengaturan tampilan klip + kuis sisipan di detik 20) lalu menerbitkannya; murid membuka materinya dan: urutan bagian mengikuti timeline (`[video, kuis, teks]`), kuis ber-`host_id` = klip videonya dan **tidak** mengunci dirinya, bagian setelah video masih terkunci (422 saat ditutup), bingkai memakai `--r = 0.5625` (9:16), gaya media `object-fit: cover` + `object-position: 20% 80%` + `scale(1.5)`, video termuat (`readyState ≥ 1`), dan **panel kuis muncul sendiri** (`.pm-kuis`) berisi soal latihan dari bank soal dengan video **paused** (mode _jeda_); server tetap menolak menutup video (422) sebelum kuis wajibnya selesai. Harness adalah baru dan **mandiri** — soal + kuis + materi ujinya dibuat dan dihapus lagi di blok `finally` (`materi 23 · kuis 114 · soal 212` → baca ulang 404) |

`verify.sh` **pertama** memang gagal (checkJs 12 error, ESLint 2 error) — semuanya berasal dari baris di
A.31.2. Sesudah penyebabnya diperbaiki, `verify.sh` berikutnya hijau, dan pemeriksaan itu **tidak** diulang
lagi setelah commit karena berkas ujinya tidak berubah.

### A.31.4 Keputusan teknis (satu kalimat per keputusan)

- `rasio` dikunci **per materi** (bukan per klip) supaya bingkai pratinjau dan pemutar tidak berubah di tengah materi.
- Nilai `tampilan` dinormalkan **server**; nilai di luar daftar ditolak 422 di request, bukan diam-diam diganti.
- Blok teks tidak punya pengaturan tampilan: kiriman `tampilan` untuk teks diabaikan (dan itu diuji).
- Kuis di dalam video **tidak** mensyaratkan videonya selesai (kalau tidak, deadlock); sebaliknya video menunggu kuis wajibnya.
- Jendela kuis dihitung dari klip media ber-`mime` video/audio saja; materi lama tanpa durasi tidak berubah perilakunya.
- Pindah klip di pemutar memakai `key` React (pasang ulang), bukan efek pembersih.
- Frontend tetap memakai pagar yang sama: kuis sisipan memakai attempt **latihan** dari jalur yang sudah ada (`bukaBlok`/`selesaikanBlok`), jadi tidak ada endpoint baru untuk menjawab latihan.

### A.31.5 Batasan jujur (yang belum selesai)

- **Smoke UI pemutar sudah dijalankan (22/22)** — jadi celah bukti terbesarnya sudah tertutup; yang masih
  terbatas: harness baru menguji satu jalur (kuis mode _jeda_ di dalam video), belum mode _berjalan_ dan
  belum tata panel horizontal lewat layar sungguhan (keduanya sudah diuji di Pest/Vitest), dan harness tidak
  menutup kasus video yang gagal dimuat.
- **`docs/export-word.sh` belum dijalankan utuh.** Yang dijalankan hanya langkah konversi Word
  (`python3 docs/export_docx.py`) untuk berkas yang berubah; langkah penyegaran log mentah
  (`docs/export-log-sesi.py`, butuh snapshot sesi chat) sengaja dilewati supaya transkrip byte-exact yang
  sudah tercatat (beserta angka md5 di kepalanya) tidak berubah tanpa alasan.
- Editor materi masih terbukti dengan **satu berkas MP4 dev** (5,4 MB), bukan semua kodek — batasan lama yang belum berubah.
- Paket eksternal tidak menyertakan dokumentasi, jadi bagian ini disusun dari pembacaan kode hasil penerapan,
  bukan dari catatan penulis paket.

### A.31.6 Berkas yang dibuat/diubah

Backend (diubah): `Material/Http/Controllers/MateriController.php`,
`Material/Http/Requests/SinkronBlokRequest.php`, `Material/Http/Resources/BlokResource.php`,
`Material/Http/Resources/MateriResource.php`, `Material/Services/MateriService.php`,
`Material/Services/ProgresMateriService.php`, `tests/Feature/Slice08Test.php`.
Backend (dibuat): `database/migrations/2026_10_10_000001_tambah_rasio_materi.php`.
Frontend (diubah): `sections/material/EditorMateri.jsx`, `sections/material/HalamanMateriMurid.jsx`,
`sections/material/api.js`, `sections/material/editorMateri.js`, `theme/theme.css`.
Frontend (dibuat): `sections/material/PemutarMateri.jsx`, `sections/material/pemutarMateri.js`,
`__tests__/sections/material/editorMateriBingkai.test.js`, `__tests__/sections/material/pemutarMateri.test.js`.
Dokumentasi (diubah): `laporan-pengujian.md` (bagian ini), `handoff-sesi.md`, `jurnal-prompt.md`,
`penjelasan-fitur.md` (bagian 6 + daftar batasan), `word/*.docx` (tiga berkas yang sumbernya berubah).
Dokumentasi (dibuat): `docs/smoke-ui-materi.mjs`, `docs/jalankan-smoke-materi.sh`.

Di-commit: backend + frontend + tes sebagai `a859f78`; dokumen & harness menyusul pada commit berikutnya.

---

## A.32 Papan 8 — Susunan Dua Kolom, Pemilihan Baris, dan Penunjuk Langkah Koreksi (10 Oktober 2026)

Lanjutan utang "papan 8 (Koreksi) masih sebagian" dari A.27.6/A.31.5. Putaran ini menuntaskan susunan
dua kolom, pemilihan baris antrean, dan penunjuk langkah, serta **memutuskan secara sadar** untuk tidak
meniru kolom "ketik token 6 angka" di papan desain (alasannya di A.32.1b).

### A.32.1 Yang dikerjakan

- **Susunan dua kolom (papan 8)**: kolom kiri `Antrean` — satu baris per jawaban yang menunggu tinjauan,
  teksnya `murid · tipe · attempt · skor sekarang/maksimal` plus lencana status; kolom kanan `detail` —
  hanya baris yang sedang dibuka, berisi soal, jawaban murid, kunci, saran AI, lalu form koreksi. Sebelum
  ini semua kartu baris dirender sekaligus dalam satu kolom.
- **Pemilihan baris memakai identitas, bukan nomor urut**: state menyimpan kunci `attempt_id-question_id`
  (`kunciKoreksi()`) dan baris aktif dicari dengan `pilihItemKoreksi()`. Penting karena satu koreksi yang
  tersimpan **hilang dari antrean** dan nomor urut baris lain bergeser — kalau pilihan disimpan sebagai
  indeks, guru akan mendadak berpindah ke baris yang salah. Bila kunci pilihannya sudah tidak ada,
  pilihan jatuh ke baris pertama (bukan kosong).
- **Baris aktif ditandai untuk pembaca layar**: `aria-current="true"` pada tombol baris, plus lencana
  "sedang dibuka", jadi bukan hanya warna. Tombol baris juga membawa `data-koreksi="<attempt>-<soal>"`
  sebagai pegangan stabil untuk harness smoke (tidak bergantung urutan atau teks).
- **Penunjuk langkah koreksi**: `1 Skor & alasan → 2 Token konfirmasi → 3 Tersimpan`, memakai komponen
  `Langkah` yang sudah ada (`aria-current="step"`). Nomor langkahnya dihitung pembantu murni
  `langkahKoreksi()`, jadi penunjuk tidak bisa berbeda pendapat dengan keadaan tombol.
- **Form diikat ke barisnya**: `FormKoreksi` diberi `key={kunciKoreksi(terpilih)}`, sehingga berpindah
  baris = form bersih; skor/alasan/token baris sebelumnya tidak terbawa ke baris berikutnya.
- **Sisa tombol Bootstrap dibersihkan**: dua `<button className="btn btn-tepi btn-sedang">` di
  `FormKoreksi` (tombol "Pakai saran AI"/"Minta saran AI") diganti `Tombol varian="tepi"`. Salah satu di
  antaranya bahkan menempel tanpa spasi (`type="button"className=…`) — ikut hilang.

### A.32.1b Keputusan: token konfirmasi **tidak** dibuat jadi kolom "ketik 6 angka"

Papan desain menggambar langkah kedua sebagai "Masukkan token konfirmasi — Token 6 angka", tetapi itu
**mock demo**, bukan protokol yang sebenarnya ada di server: `TokenKonfirmasiService` menerbitkan
`bin2hex(random_bytes(24))` — **48 karakter heksadesimal** — dan token itu terikat pada guru, tujuan,
 serta sasaran (attempt + soal), berlaku 300 detik, dan sekali pakai.

Memaksa guru mengetik 48 karakter acak bukan pengaman tambahan (token tetap kembali ke klien yang sama di
respons yang sama) melainkan sekadar menambah peluang salah ketik pada tindakan yang sensitif. Jadi yang
dipilih: **langkah konfirmasi tetap dua aksi klien** ("Minta token konfirmasi" → "Simpan koreksi") dengan
penunjuk langkah yang jujur, dan teks di layar menjelaskan token itu diterbitkan server untuk tindakan ini
saja lalu hangus — bukan pura-pura menyuruh mengetik kode. Perbedaan dari mock dicatat di sini supaya tidak
terlihat seperti kelalaian.

### A.32.2 Verifikasi (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `npx vitest run src/__tests__/sections/scoring` | **22 passed** (2 berkas) — 3 tes `langkahKoreksi` + 3 tes pemilihan baris (`kunciKoreksi`/`pilihItemKoreksi`) |
| `npx eslint src/sections/scoring src/__tests__/sections/scoring` | 0 masalah |
| `npm run check` (checkJs) | OK (pembantu pemilihan baris dibuat **generik** lewat `@template` supaya tipe baris antrean tidak terpotong jadi `{attempt_id, question_id}` saja) |
| `node --check docs/smoke-ui-slice06.mjs` | sintaks OK |
| `docs/jalankan-smoke-ui.sh slice06` (backend+vite+realtime+Chrome) | **28/28 lulus, exit 0** — termasuk satu pemeriksaan baru: baris antrean dibuka dari kolom kiri dan ditandai `aria-current`; lalu token terbit, koreksi tersimpan, dan nilai naik lewat UI |
| `./verify.sh` (root) | **SEMUA HIJAU exit 0** — Pest **256 passed (2304 assertions)** · Pint **335 berkas** · checkJs OK · ESLint 0 error (2 warning lama) · Vitest **56 berkas / 511 test** (A.31: 505) · realtime 15 test |

### A.32.3 Batasan jujur (yang belum selesai)

- **Harness smoke slice 06 ikut disesuaikan** (menambah satu langkah: membuka baris antrean lewat
  `data-koreksi`) — tanpa itu harness akan gagal, dan itu memang konsekuensi sah dari perubahan tata
  letak; harness lalu dijalankan ulang dan **28/28 lulus**.
- Halaman koreksi tetap **satu form hidup** (hanya baris terpilih yang dirender). Nilai per soal yang
  sudah dinilai mesin tetap bisa diubah bila barisnya muncul di antrean; di luar itu tidak ada jalur
  "telusuri attempt" di halaman ini.
- Uji regresi visual/screenshot tetap belum ada; bukti tata letak dari DOM/CDP (kolom kiri/kanan, baris
  aktif, lebar, dan posisi).

## A.33 Sistem Luring — Simpan Jawaban Saat Internet Putus, Riwayat Jawaban Lokal, dan Jam yang Tidak Bisa Ditambah (10 Oktober 2026)

Permintaan putaran ini: *"buatkan sistem offline-nya, dengan validasi waktu lalu simpan jawaban kalau
mereka offline; kalau sistem riwayat jawaban di kuis/form belum ada, buatkan — tapi kalau sudah
dikumpulkan hilang, dan nyalakan lokal."*

Sebelum putaran ini yang benar-benar ada hanyalah **cadangan jawaban** (tampilan tetap benar setelah muat
ulang) dan **antrean kirim di memori**. Belum ada deteksi jaringan sungguhan, belum ada riwayat yang bisa
dibaca murid, dan belum ada penjaga waktu saat server tidak bisa ditanyai. Selama pengujian putaran ini
ditemukan satu bug nyata yang membuat pekerjaan luring bisa hilang tanpa pesan — dijelaskan di A.33.2.

### A.33.1 Yang dikerjakan

- **`sections/attempt/luring.js` (baru) — keadaan jaringan yang jujur.** `statusJaringan()` menggabungkan
  kabar peramban (`navigator.onLine`) dengan jendela kegagalan kirim terakhir (10 detik). Wifi yang masih
  tersambung tetapi gerbangnya mati tidak terlihat `navigator.onLine`, sedangkan kegagalan kirim selalu
  terlihat — dua-duanya dipakai. Modul murni (tanpa DOM) supaya bisa diuji tanpa jaringan.
- **Pengiriman ditahan, bukan ditembakkan.** `ubahJawaban()` sekarang berurutan: **validasi → tulis ke
  perangkat (cadangan + riwayat) → baru jadwalkan kirim**. Saat luring, penjadwalan dilewati sama sekali
  dan penjadwalan ulang pun dimatikan (`tundaKirimMs()` mengembalikan `∞` bila peramban bilang putus);
  **event `online`** yang memborong antrean (`jalankanAntrean(true)` melewati gerbang luring sekali,
  karena state jaringan belum sempat diperbarui di render yang sama). Setelah satu kiriman berhasil,
  jendela kegagalan ditutup dari bukti nyata, bukan dari tebakan.
- **`sections/attempt/riwayatJawaban.js` (baru) — riwayat jawaban lokal.** Store Zustand+persist
  (`ulangan-riwayat-jawaban-v1`) menyimpan per attempt: nomor soal, tipe, ringkasan jawaban yang manusiawi
  (`ringkasNilai()`), jam perkiraan server, dan status `lokal`/`terkirim`. Nilai jawaban mentah **tidak**
  disimpan di sini (tetap di `simpananJawaban.js`) supaya tidak ada dua sumber kebenaran. Isi
  localStorage selalu lewat **Zod** (`merge` pada persist): satu entri rusak membuang riwayat, bukan
  dipakai setengah-setengah. Saklar "nyalakan lokal" (`aktif`, bawaan **nyala**) mematikan pencatatan
  riwayat tanpa mematikan cadangan jawaban.
- **Validasi sebelum menulis ke perangkat.** `amanDicatat()` menolak nilai yang tidak bisa dibaca kembali
  (fungsi/`NaN`/`Infinity`) dan yang melebihi kuota (`BATAS_PAYLOAD` 4.000 karakter JSON). Nilai yang
  ditolak **tidak ditulis setengah-setengah**, dan murid diberi tahu lewat toast.
- **`RiwayatJawaban.jsx` (baru).** Panel `<details>` di layar pengerjaan: "Riwayat jawaban", "n tercatat",
  lencana "n menunggu terkirim", daftar terbaru-di-atas (nomor soal, ringkasan, jam, status
  `di perangkat ini`/`tersimpan di server`), saklar "Simpan riwayat jawaban di perangkat ini", dan
  keterangan yang berubah saat luring.
- **Validasi waktu: jam monotonik (`hitungMundur.js`).** `jamKlien()` mengambil jam dinding **dan** jam
  monotonik; `sekarangTerkunci()` menaikkan waktu dari acuan respons server terakhir memakai selang
  monotonik, jadi memundurkan setelan jam Windows **tidak** menambah sisa waktu, dan `hitungSisaAman()`
  dipakai bersama oleh detak tiap detik dan perhitungan saat menggambar. Bila jam dinding berbeda dari jam
  monotonik lebih dari 5 detik, layar menampilkan banner "Jam perangkat berubah" dan mencatatnya.
- **`sections/attempt/snapshot.js` (baru) — salinan attempt untuk luring.** Payload attempt (soal tanpa
  kunci + jawaban yang sudah dikirim server) disimpan di perangkat saat `mulai` berhasil; saat luring,
  query attempt jatuh ke salinan itu (`networkMode: 'always'` supaya TanStack Query tidak menahan queryFn
  saat `navigator.onLine` false — tanpa ini layar macet di "Menyiapkan ulangan…"). Penolakan **4xx tetap
  tidak ditambal salinan** (kuis ditutup/batas percobaan habis harus tetap terasa). `server_now` digeser
  sesuai umur salinan supaya hitung mundur tidak membeku, `skemaSnapshot` memvalidasi tiap entri dengan
  Zod, dan di layar galat tersedia tombol "Lanjutkan dari salinan di perangkat" untuk kasus wifi yang
  "tersambung tetapi tidak sampai server".
- **Bersih saat dikumpulkan dan saat sesi berakhir.** Setelah hasil final: riwayat + salinan soal dihapus
  (cadangan jawaban hanya bila seluruh jawaban benar-benar tersimpan — aturan lama tetap). `bersihkanJejakSesi()`
  (keluar/401/419) kini membersihkan **lima** tempat: cache query, cadangan jawaban, riwayat jawaban,
  salinan soal, dan penanda status siaran.

### A.33.2 Bug nyata yang ditangkap smoke: jawaban luring hilang tanpa pesan

Smoke luring mula-mula gagal di langkah "jawaban luring terkirim ke server begitu koneksi kembali"
(`jawaban undefined · sisa antrean 1`), padahal jawaban itu **terlihat di layar** dan tersimpan di
perangkat.

Sebabnya: antrean kirim hidup di memori (`useRef`), sedangkan cadangan jawaban hidup di localStorage.
Saat layar pengerjaan digambar ulang (muat ulang, pindah halaman, atau luring lalu kembali), cadangan tetap
menampilkan jawaban murid — sementara antreannya **kosong**, jadi server tidak pernah menerimanya. Kalau
murid lalu menekan "Kumpulkan", server menilai apa yang ia punya saja: murid melihat jawabannya terisi,
tetapi nilainya hilang tanpa satu pun pesan galat. Aturan repo "jawaban DB dulu, cache belakangan" tidak
menolong di sini karena tidak ada yang pernah mencoba mengirim ulang.

Perbaikan: `pulihkan()` di `antreanJawaban.js` memasukkan kembali seluruh `belumTerkirim` ke antrean
(dengan nomor urut baru), dan `HalamanKerjakan` memanggilnya sekali per attempt (`dipulihkan` ref) lalu
langsung mengirim bila jaringan siap. Smoke dijalankan ulang: **22/22 lulus**, termasuk skor akhir 10/10
(dua jawaban; satu diketik daring, satu diketik saat luring dan baru terkirim setelah koneksi kembali).

### A.33.3 Verifikasi (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `npx vitest run` | **568 passed / 60 berkas** (sebelum putaran ini 513/56) — bertambah 55 tes: `luring` 9, `riwayatJawaban` 18, `snapshot` 10, `RiwayatJawaban` (komponen) 5, `hitungMundur` +9, `antreanJawaban` +3, authStore/sesi +1 |
| `npm run check` (checkJs) | OK |
| `npx eslint src` | 0 error (2 warning lama React Hook Form di `HalamanDaftar.jsx`/`HalamanAturUlangSandi.jsx`) |
| `php artisan test` | **258 passed (2.320 assertions)** — backend tidak disentuh putaran ini |
| `./verify.sh` (root) | **SEMUA HIJAU** — Pest 258 · Pint 335 berkas · checkJs OK · ESLint 0 error · Vitest 568 · realtime 15 |
| `node docs/smoke-ui-luring.mjs` (baru, CDP, backend+vite+Chrome) | **22/22 lulus, exit 0** (dijalankan dua kali dengan versi final; versi awalnya 20/20 lalu ditambah dua pemeriksaan jalur manual) |
| `node docs/smoke-ui-slice04.mjs` (regresi layar pengerjaan) | **18/18 lulus, exit 0** |
| `node docs/smoke-ui-slice07.mjs` (regresi anti-cheat, realtime hidup) | **20/20 lulus, exit 0** |

Isi smoke luring (koneksi diputus dari **DevTools CDP**, bukan dimock di aplikasi):
1. guru menyiapkan ulangan 2 soal + terbit; murid login dan membuka layar pengerjaan (panel riwayat kosong);
2. jawab soal 1 daring → tersimpan di server **dan** riwayat menuliskan "tersimpan di server";
3. `Network.setBlockedURLs` pada `*/api/v1/kuis/*/mulai` (internet tetap "hidup", `navigator.onLine` true)
   lalu muat ulang halaman → layar galat "Tidak bisa menghubungi server" **beserta tombol** "Lanjutkan dari
   salinan di perangkat"; tombol itu ditekan → ulangan terbuka dari salinan (timer hidup, riwayat utuh), dan
   URL diblokirnya dilepas kembali;
4. `Network.emulateNetworkConditions offline` → `navigator.onLine` false dan banner "Koneksi putus — mode
   luring" muncul;
5. jawab soal 2 saat luring → `belumTerkirim` berisi jawaban itu, riwayat `1:terkirim 2:lokal`, lencana
   "1 menunggu terkirim", dan panel menulis "di perangkat ini";
6. pindah halaman di dalam aplikasi (pushState, tanpa memuat ulang berkas dari Vite) lalu kembali ke soal →
   banner "Melanjutkan dari salinan di perangkat", timer hidup, dan jawaban luring **tetap tercentang**;
7. `Date.now` dimundurkan 1 jam → banner "Jam perangkat berubah" muncul dan sisa waktu **tidak bertambah**
   (1.188 → 1.186 detik pada jalannya pertama), lalu kembali normal setelah jam dipulihkan;
8. koneksi dihidupkan → jawaban masuk server (`sisa antrean 0`), kedua riwayat jadi `terkirim`, banner
   luring hilang;
9. "Selesai" → "Kumpulkan" → murid ke halaman hasil, **riwayat dan salinan soal hilang dari perangkat**,
   dan server menilai dua jawaban (10/10, benar 2).

### A.33.4 Keputusan teknis (satu kalimat per keputusan)

- **Riwayat menyimpan ringkasan, bukan nilai jawaban** — nilai mentah tetap di `simpananJawaban.js` supaya
  tidak ada dua sumber kebenaran dan kuota localStorage tidak dipakai dua kali.
- **Riwayat disimpan lewat Zod di `merge`** — aturan repo "data dari localStorage selalu lewat Zod";
  payload rusak mengosongkan riwayat, bukan membuat layar gagal.
- **Jam monotonik, bukan jam dinding, saat luring** — `Date.now()` bisa diubah murid, `performance.now()`
  tidak; `mulai_at`/`deadline_at` tetap dari server dan submit tetap divalidasi server.
- **Salinan attempt hanya ditambal untuk galat jaringan/5xx** — 4xx berarti aturan kuis menolak (kuis
  ditutup, batas percobaan habis), dan salinan lama tidak boleh membatalkan penolakan itu.
- **Salinan soal tidak memuat kunci** — isinya sama dengan yang sudah tampil di layar murid (K-02), dan
  dihapus setelah submit.
- **Penjadwalan ulang dimatikan saat `navigator.onLine` false** — lebih baik menunggu event `online`
  daripada menembak permintaan yang gagal tiap 5 detik.

### A.33.5 Batasan jujur (yang belum selesai)

- **Belum ada service worker / app shell**: mode luring bekerja selama aplikasi masih terbuka (atau murid
  berpindah halaman di dalamnya). Muat ulang halaman saat internet benar-benar mati masih menampilkan layar
  galat browser karena berkas aplikasi datang dari server. Menambahkan PWA berarti juga harus memutuskan
  penyimpanan sesi di perangkat — sengaja **tidak** dilakukan sekarang karena komputer lab dipakai
  bergantian (aturan S-14).
- **Waktu saat luring tetap perkiraan**: selang jam monotonik akurat untuk satu kali buka layar; salinan
  yang dibaca ulang sesudahnya memakai jam dinding perangkat (tidak ada cara lain tanpa server). Karena
  itu murid diberi tahu lewat banner saat jamnya terlihat diubah, dan **server tetap penentu akhir** untuk
  deadline.
- **Yang diuji baru satu jalur koneksi**: offline→online lewat CDP pada satu attempt; belum diuji dua tab
  bersamaan saat luring, mode tim saat luring, atau unggahan berkas jawaban saat luring (unggahan tetap
  butuh koneksi).
- **Internet terlihat hidup tetapi server mati = jalur manual.** Salinan perangkat hanya ditambal
  otomatis saat `navigator.onLine` bilang putus, supaya penolakan sungguhan dari server (4xx: kuis ditutup,
  batas percobaan habis) tidak pernah tertutup salinan lama. Untuk kasus itu murid sendiri yang menekan
  "Lanjutkan dari salinan di perangkat" — jalur ini diuji di smoke (langkah 3) dan lulus, tetapi tetap
  bergantung pada murid menyadari tombolnya ada.

### A.33.6 Berkas yang dibuat/diubah

Dibuat:
- `frontend/src/sections/attempt/luring.js`
- `frontend/src/sections/attempt/riwayatJawaban.js`
- `frontend/src/sections/attempt/snapshot.js`
- `frontend/src/sections/attempt/RiwayatJawaban.jsx`
- `frontend/src/__tests__/sections/attempt/luring.test.js`
- `frontend/src/__tests__/sections/attempt/riwayatJawaban.test.js`
- `frontend/src/__tests__/sections/attempt/snapshot.test.js`
- `frontend/src/__tests__/sections/attempt/RiwayatJawaban.test.jsx`
- `docs/smoke-ui-luring.mjs`

Diubah:
- `frontend/src/sections/attempt/HalamanKerjakan.jsx` (keadaan jaringan, gerbang luring, riwayat, salinan
  attempt + tombol lanjut, jam monotonik, pemulihan antrean, banner, panel riwayat)
- `frontend/src/sections/attempt/hitungMundur.js` (`jamKlien`, `sekarangTerkunci`, `hitungSisaAman`,
  `TOLERANSI_GESER_JAM_MS`)
- `frontend/src/sections/attempt/antreanJawaban.js` (`pulihkan`)
- `frontend/src/sections/auth/authStore.js` (bersihkan riwayat + salinan saat sesi berakhir)
- `frontend/src/__tests__/sections/attempt/hitungMundur.test.js`
- `frontend/src/__tests__/sections/attempt/antreanJawaban.test.js`
- `frontend/src/__tests__/sections/auth/authStore.test.js`
- `frontend/src/__tests__/sections/auth/authStore.sesi.test.js`
- `docs/penjelasan-fitur.md` (bagian 17 + batasan), `docs/laporan-pengujian.md` (A.33 ini),
  `docs/handoff-sesi.md`

---

## A.34 Materi Berjalan: Template Tema, Peta Beranimasi, dan Kenaikan Pos/Tingkat (10 Oktober 2026)

Permintaan putaran ini: *"sekarang buat sistem template yang materi, tampilannya seperti tema video —
guru impor medianya dan template-nya yang tentuin fase; misalnya template seperti mendaki gunung (pakai
animasi/video, bukan gambar manual); tiap materi punya tema tertentu (guru yang tentuin); saat maju atau
setelah quiz jadi satu langkah, naik, dst."*

Sebelum putaran ini materi sudah berblok dan bergaya video editor (A.31), tetapi tiap materi hanya berupa
urutan klip: tidak ada **tema** yang dipilih guru, tidak ada **adegan** yang bergerak, dan tidak ada
**langkah** yang bisa dibaca anak sebagai kemajuan. Putaran ini menambahkan lapis "perjalanan" di atas
blok yang sudah ada, tanpa mengubah cara blok disimpan atau dinilai.

### A.34.1 Yang dikerjakan

- **`Material/Registry/TemaPerjalanan.php` (baru, murni tanpa DB/config/container)** — katalog template
  tema. Satu template "Mendaki Gunung" (`kode: mendaki-gunung`) berisi identitas adegan (`adegan: gunung`),
  `satuan` ("pos"), **6 fase** (Basecamp → Jalur Pinus → Sungai Deras → Lereng Berbatu → Kabut Puncak →
  Puncak; masing-masing dengan ikon + warna), dan **4 tingkat** (Pendaki Pemula 0% → Pendaki Terlatih 25% →
  Penjelajah Lereng 60% → Penakluk Puncak 100%). Fungsi `normalkan()`/`konfigurasi()`/`langkah()`/
  `tingkat()` dipakai bersama oleh resource, progres, laporan, dan tes.
- **Kolom `materials.tema` (JSON, nullable) + migrasi `2026_10_10_000002_tambah_tema_materi.php`** —
  menyimpan **pilihan guru saja**: `{kode, nama, video_kode}`. Nama bawaan fase dan tingkat hidup di
  registry, bukan di DB, supaya tidak ada data tema yang bisa rusak. Baris lama (`NULL`) otomatis berarti
  tema bawaan — materi yang sudah ada sebelum fitur ini ikut punya perjalanan tanpa diisi apa pun.
- **`GET /api/v1/materi/tema`** (didaftarkan **sebelum** `/materi/{materi}` supaya "tema" tidak dibaca
  sebagai id) mengirim katalog ke klien. Penolakan kode tema tak dikenal ada di `TemaMateriService`
  (video latar juga hanya boleh milik materi itu sendiri).
- **Nama pos bisa diganti guru**: `SinkronBlokRequest` menerima `isi.fase` per blok; `TemaPerjalanan::langkah()`
  memakai nama bawaan tema bila kosong, memotong (`MAKS_LANGKAH` 40) bila kepanjangan, dan menlanjutkan
  "Pos n" bila blok lebih banyak daripada fase template — jadi **tidak pernah ada langkah tanpa nama**.
- **Peta perjalanan di muatan murid** (`ProgresMateriService` → `perjalanan`): daftar langkah (nama, ikon,
  warna, wajib/opsional, selesai), posisi kini, jumlah langkah, `persen`, `tingkat` (nomor/nama/berikut/sisa),
  satuan, `tuntas`, dan `video_url` bertanda tangan. **Laporan guru** (`LaporanMateriService`) memakai peta
  yang **sama persis** — nama pos yang dilihat guru dan murid tidak bisa berbeda.
- **`frontend/src/sections/material/perjalanan.js` (baru)** — skema Zod (langkah, tingkat, perjalanan,
  katalog tema), **katalog cadangan** `TEMA_CADANGAN` yang identik dengan registry server (dipakai editor
  sebelum katalog termuat, jadi panel template tidak pernah kosong), dan pembantu murni: `faseKe`,
  `terapkanTema`, `langkahLokal`, `tingkatKe`, `petaLokal`, `titikJalur`, `posisiAktif`, `kenaikanUntuk`,
  `labelPerjalanan`.
- **`PetaPerjalanan.jsx` (baru, dipakai guru & murid)** — adegan **digambar dan dianimasikan CSS/SVG**,
  bukan gambar tempelan: langit, matahari, **awan berjalan** (`@keyframes jelajah-awan`), tiga lapis gunung,
  jalur putus-putus/penuh per ruas, pos berikon, dan **pendaki yang melangkah** (`@keyframes jelajah-langkah`)
  di posisi kini. Bila guru menempelkan **video latar** untuk tema, video itu yang tampil (diputar senyap,
  `autoplay loop muted`) dan adegan SVG disembunyikan — jadi tidak pernah ada dua latar saling menimpa.
  Peta selalu disertai **daftar pos dalam teks** (selesai / sedang ditempuh / belum dibuka) plus ringkasan
  persen dan tingkat, sehingga pembaca layar dan layar sempit mendapat isi yang sama, bukan versi ringkas
  yang bisa berbeda.
- **Editor guru**: panel **Template** (pilih tema, ganti nama tema, ganti nama tiap pos) dengan pratinjau
  peta hidup, dan catatan tingkat yang akan diraih. `sinkronBlok()` ikut mengirim `tema`.
- **Layar murid**: `kenaikanUntuk()` membandingkan peta **sebelum** dan **sesudah** satu bagian ditutup,
  lalu menampilkan Banner jujur — `Naik ke pos 3: Sungai Deras`, `Naik tingkat: Pendaki Terlatih`, atau
  `… tuntas!`. Kenaikan diumumkan **hanya setelah server mengirim peta terbaru**, jadi pesannya tidak pernah
  mendahului keadaan yang benar-benar tersimpan.
- **Aturan yang tetap di server**: hanya langkah **wajib** yang menghitung persen dan kenaikan (langkah
  opsional tidak pernah menahan kenaikan), dan boleh-tidaknya membuka langkah tetap diputus
  `ProgresMateriService` — peta hanyalah tampilan.

### A.34.2 Verifikasi (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `php artisan test tests/Feature/Slice12TemaMateriTest.php` | **9 passed (123 assertions)** — katalog ditolak untuk tamu, tema + nama pos tersimpan, kode tak dikenal ditolak, video latar harus milik materi itu, posisi & tingkat naik satu per satu, langkah opsional diabaikan, laporan memakai nama pos yang sama, murid tak bisa mengganti tema, nama pos kepanjangan dipotong |
| `npx vitest run src/__tests__/sections/material src/__tests__/theme` | **90 passed (7 berkas)** — termasuk 24 tes `perjalanan` dan 9 tes komponen `PetaPerjalanan` |
| `./verify.sh` (root) | **SEMUA HIJAU (exit 0)** — Pest **267 passed (2443 assertions)** · Pint **340 berkas** · checkJs OK · ESLint **0 error** (2 warning lama) · Vitest **62 berkas / 601 test** · realtime 15 test |
| `docs/jalankan-smoke-perjalanan.sh` (CDP, backend :8000 + vite :5173 + Chrome :9333) | **34/34 lulus, exit 0** |

Isi smoke `docs/smoke-ui-perjalanan.mjs` (harness mandiri: membuat materi + video uji 2 detik sendiri, lalu
menghapusnya di akhir):
1. katalog tema datang dari server (`mendaki-gunung`, 6 fase, 4 tingkat); guru membuat materi uji;
2. guru mengunggah **video latar** lewat jalur berpotongan (hash SHA-256 per potongan) — video 2 detik dibuat
   ffmpeg oleh runner, **bukan** berkas dev;
3. guru menyusun 4 pos, mengganti nama tema ("Ekspedisi Smoke") dan dua nama pos; pos 3–4 tetap memakai nama
   bawaan tema; materi diterbitkan;
4. editor menampilkan peta 4 pos, nama tema ganti, daftar pos memakai nama ganti + bawaan, latar beranimasi
   (video `autoplay` + pendaki `jelajah-langkah`), dan video latar terpasang;
5. murid membuka materi: API mengirim peta lengkap (posisi 1, 4 langkah, tingkat "Pendaki Pemula"), nama pos
   sama dengan yang dilihat guru, video latar berupa URL bertanda tangan; peta + penanda posisi tampil;
6. murid menuntaskan pos 1 → **naik tingkat** diumumkan dan peta maju (pos 1 selesai, pos 2 jadi posisi kini);
7. murid menuntaskan pos 2 → **naik pos** diumumkan ("Naik ke pos 3") dan posisi peta jadi 3 dari 4;
8. laporan guru memuat peta kelas yang sama dan menunjukkan posisi 3 / selesai 2 / tingkat "Pendaki Terlatih"
   untuk murid uji;
9. data uji dihapus kembali (materi + unggahan), jadi harness bisa dijalankan berulang.

### A.34.3 Temuan nyata yang ditangkap smoke (dan diperbaiki di harness)

- **Harness membuka bagian yang salah.** Langkah ke-7 mula-mula memakai `klik('Buka')` yang mengklik tombol
  "Buka" **pertama** di halaman. Karena bagian yang sudah selesai **tetap bisa dibuka ulang**, tombol itu
  mengenai **bagian 1 lagi**, sehingga penutupan "bagian kedua" sebenarnya menutup bagian 1 — peta tidak
  maju (`selesai 1 · aktif 2`), dan tiga pemeriksaan gagal. Perbaikan: `klikBagian(n)` yang mencari baris
  `Bagian n` lalu mengklik tombolnya, plus penantian eksplisit sampai peta benar-benar maju sebelum langkah
  berikutnya. Sesudah perbaikan: **34/34**. Ujian ini menemukan bug **di harness**, bukan di produk.
- **Pemeriksaan animasi bertentangan dengan rancangan.** Assertion "adegan benar-benar beranimasi" mula-mula
  menuntut awan SVG bergerak (`animationName === 'jelajah-awan'`). Pada skenario yang diuji guru **menempelkan
  video latar**, dan video itu memang **menggantikan** adegan SVG — jadi awan tidak ada di DOM, wajar. Sudah
  sesuai maksud permintaan ("pakai animasi/video"): assertion diubah memeriksa latar **sesuai bentuk yang
  benar-benar dirender** — video `autoplay` bila ada video, atau awan SVG beranimasi bila tidak ada — sambil
  tetap menuntut pendaki (`jelajah-langkah`) beranimasi. Animasi SVG tanpa video tetap diuji unit
  (`petaPerjalanan.test.jsx` memastikan kelas `jelajah-awan` dirender).

### A.34.4 Keputusan teknis (satu kalimat per keputusan)

- **Yang disimpan hanya pilihan guru; bawaan hidup di registry** — materi lama gratis mendapat perjalanan,
  dan tidak ada baris DB yang bisa membuat nama fase/tingkat rusak.
- **Video latar menggantikan adegan SVG, bukan ditumpuk** — dua latar yang saling menimpa lebih buruk daripada
  latar tunggal yang jelas; karenanya pengujian pun membaca bentuk latar yang sebenarnya.
- **Kenaikan dibandingkan dari respons server, bukan dihitung di klien** — pesan "naik" tidak boleh mendahului
  keadaan tersimpan, dan murid tidak bisa "merayakan" kenaikan yang server tidak setujui.
- **Hanya langkah wajib yang menghitung kenaikan** — langkah opsional adalah jalan pintas, bukan syarat naik.
- **Peta selalu punya padanan teks** — informasi yang sama dibaca lewat daftar pos + ringkasan persen, bukan
  versi berbeda untuk pembaca layar.

### A.34.5 Batasan jujur (yang belum selesai)

- **Katalog baru satu tema** ("Mendaki Gunung"). Bentuk katalognya sudah siap menampung banyak tema, tetapi
  tema lain (mis. "Menjelajah Laut", "Ruang Angkasa") belum dibuat; smoke hanya menguji tema bawaan.
- **Bukti animasi dari DOM/CDP, bukan rekaman/rekaman layar**: yang dipastikan adalah `animationName`
  (`jelajah-awan`, `jelajah-langkah`), kelas yang dirender, dan latar `autoplay` — belum ada uji regresi
  visual/screenshot.
- **Video latar hanya diuji dengan satu MP4 kecil** (2 detik, dibuat ffmpeg) di jalur berpotongan; belum
  diuji semua kodek/rasio, dan belum ada jalur "tema punya video bawaan sendiri" (video bergantung pada yang
  guru unggah).
- **Nama pos hanya bisa diganti lewat editor guru** (per blok); belum ada pengaturan ulang nama pos massal,
  dan pos di luar 6 fase template memakai nama generik "Pos n".
- **Smoke perjalanan tidak ikut `verify.sh`** (butuh backend + vite + Chrome hidup).

### A.34.6 Berkas yang dibuat/diubah

Dibuat — backend:
- `backend/app/Sections/Material/Registry/TemaPerjalanan.php`
- `backend/app/Sections/Material/Services/TemaMateriService.php`
- `backend/database/migrations/2026_10_10_000002_tambah_tema_materi.php`
- `backend/tests/Feature/Slice12TemaMateriTest.php`

Dibuat — frontend:
- `frontend/src/sections/material/perjalanan.js`
- `frontend/src/sections/material/PetaPerjalanan.jsx`
- `frontend/src/__tests__/sections/material/perjalanan.test.js`
- `frontend/src/__tests__/sections/material/petaPerjalanan.test.jsx`

Dibuat — dokumentasi/harness:
- `docs/smoke-ui-perjalanan.mjs`
- `docs/jalankan-smoke-perjalanan.sh`

Diubah:
- `backend/app/Sections/Material/Http/Controllers/MateriController.php` (endpoint `tema`)
- `backend/app/Sections/Material/Http/Requests/SinkronBlokRequest.php` (`tema`, `isi.fase`)
- `backend/app/Sections/Material/Http/Resources/BlokResource.php`, `MateriResource.php`
- `backend/app/Sections/Material/Models/Materi.php` (kolom `tema`)
- `backend/app/Sections/Material/Services/MateriService.php`, `ProgresMateriService.php`,
  `LaporanMateriService.php`
- `backend/routes/api.php` (`GET /materi/tema`)
- `frontend/src/sections/material/EditorMateri.jsx` (panel Template + pratinjau peta)
- `frontend/src/sections/material/HalamanMateriMurid.jsx` (peta + banner kenaikan)
- `frontend/src/sections/material/api.js` (skema + `katalogTema()` + `tema` pada `sinkronBlok()`)
- `frontend/src/sections/material/editorMateri.js`
- `frontend/src/theme/theme.css` (adegan perjalanan, animasi awan & pendaki)
- `frontend/src/__tests__/sections/material/api.test.js`, `editorMateri.test.js`, `pemutarMateri.test.js`
- `docs/penjelasan-fitur.md` (bagian 6), `docs/laporan-pengujian.md` (A.34 ini), `docs/handoff-sesi.md`

## A.35 Editor Soal: Pemilih Jenis Ringkas Berikon di Paling Bawah (11 Oktober 2026)

Permintaan putaran ini: *"pertama buat soalnya, pilihan jenis soalnya bisa langsung tampil semua
(bulk) jadi lebih ringkas, dan pemilih jenis soal ditaruh di paling bawah sebagai kotak-kotak dengan
ikon yang mencocokkan; buat ikonnya, tetap form biasa, dan tetap bisa disimpan ke bank soal."*

Sebelum putaran ini pemilih jenis soal adalah **kartu pertama** berisi **22 pil teks** yang membungkus
beberapa baris — memakan ruang paling atas dan tidak memberi petunjuk bentuk soal selain teks. Putaran
ini memindahkannya ke **paling bawah** sebagai **petak berikon** yang bisa dilipat, tanpa mengubah alur
form (tetap satu soal per form, tetap tersimpan ke bank soal lewat `POST/PUT /api/v1/soal`).

### A.35.1 Yang dikerjakan

- **21 ikon jenis soal baru di `frontend/src/icons.jsx`** (satu per tipe; `baca_jam` sengaja memakai
  `IkonJam` yang sudah ada karena ikon jam memang cocok). Gaya tetap sama dengan ikon lain: `viewBox`
  24x24, garis 2px, warna `currentColor`. Contoh pemetaan bentuk: pilihan ganda → radio terpilih,
  benar/salah → centang + silang, isian singkat → kalimat + kotak jawaban, uraian → lembar berbaris,
  menjodohkan → dua kolom tersambung, mengurutkan → daftar + panah, letak kata → kata di celah kalimat,
  hubung kata → dua label berhubung, pilihan ganda kompleks → kotak centang, isian angka → papan angka,
  pilihan gambar → gambar + radio, urut gambar → dua gambar + panah, susun huruf → keping huruf,
  isian rumpang → kalimat berbagian kosong, klasifikasi → kotak kategori, tabel isian → tabel berpetak,
  garis bilangan → garis berpenanda, hotspot gambar → gambar + bidik sasaran, tugas unggah → berkas naik,
  teka silang mini → petak silang dengan kotak hitam.
- **`tipeSoal.js`: `IKON_TIPE` + pembantu `ikonTipe()`**, dan `DAFTAR_TIPE` (registry yang sudah ada)
  kini ikut membawa medan `ikon`. Peta ikon hidup di registry, bukan di komponen, supaya bisa diuji
  tanpa merender seluruh editor dan supaya pemakaian berikutnya (mis. daftar bank soal) tidak
  menggandakan pemetaan.
- **`EditorSoal.jsx` disusun ulang** menjadi tiga kartu bernomor dengan urutan baru:
  **1. Tulis soalnya → 2. Pengaturan soal → 3. Pilih jenis soal**. Kartu jenis soal di paling bawah
  memakai `<details>` (bisa dibuka-tutup) yang **terbuka secara bawaan**; ringkasannya selalu
  memperlihatkan **ikon + nama tipe yang sedang aktif**, jadi tipe tetap terbaca walau lipatan ditutup.
  Grid petaknya `role="radiogroup"` + tiap petak `role="radio"`/`aria-checked` — bukan `<select>`,
  karena semua 22 tipe tampil sekaligus (permintaan "bulk") dan tetap satu pilihan.
- **CSS `.pemilih-jenis` + `.petak-tipe`** di `theme.css`: petak **2 kolom di HP, 4 kolom di layar
  ≥768px**, tiap petak tinggi **≥84px** (jauh di atas target sentuh 44px anak SD), tipe yang aktif
  dibalik warnanya (bukan hanya warna — ada `aria-checked`), dan tipe bertingkat diberi label kecil
  "perlu tinjau".
- **Harness smoke disesuaikan**: `smoke-ui-susun.mjs` kini memeriksa judul kartu baru, bahwa kartu
  ke-3 adalah pemilih jenis, bahwa elemen lipatnya `DETAILS`, dan bahwa **22 petak** berperan `radio`
  **serta semuanya mengandung `<svg>`**; `smoke-ui-kuis-manual.mjs` memakai judul baru
  ("1. Tulis soalnya"). `smoke-ui-susun.mjs` sebelumnya masih menuntut `pil == 8` (sisa dari era 8 tipe,
  belum pernah dijalankan sesudah A.30) — pemeriksaan itu diperbarui ke jumlah 22.
- **Tes baru `frontend/src/__tests__/sections/question/ikonTipe.test.jsx`** — memastikan setiap nilai
  `TIPE` punya ikon, tipe tak dikenal mengembalikan `undefined` (tidak melempar), dan **setiap** ikon
  benar-benar ter-render sebagai `<svg>` `viewBox="0 0 24 24"` berwarna `currentColor`.

### A.35.2 Verifikasi (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `npm run check` (checkJs strict) | OK (tanpa galat) |
| `npm run lint` (ESLint) | **0 error** (2 warning lama React Hook Form yang sudah ada sebelumnya) |
| `npx vitest run src/__tests__/sections/question src/__tests__/icons.test.jsx` | **141 passed (6 berkas)** — termasuk 3 tes `ikonTipe` baru |
| `./verify.sh` (root) | **SEMUA HIJAU (exit 0)** — Pest **267 passed (2443 assertions)** · Pint **340 berkas** · checkJs OK · ESLint **0 error** · Vitest **63 berkas / 604 test** · realtime 15 test |
| `docs/jalankan-smoke-ui.sh susun` (CDP; backend :8000 + vite :5173 + realtime :4000 + Chrome :9333) | **42/42 lulus, exit 0** — memuat pemeriksaan baru: kartu bernomor baru, pemilih jenis di kartu ke-3, lipatan `DETAILS`, dan petak 22 radio berikon |
| `docs/jalankan-smoke-ui.sh kuis-manual` | **10/10 lulus, exit 0** — editor soal tetap terbuka dan tersimpan dari dalam alur kuis |

Verifikasi lewat antarmuka (bukan hanya unit): guru membuka **Bank soal → Tambah soal**, mengisi soal
isian singkat, menekan petak **Isian singkat** di kartu paling bawah, menyimpan, dan soal muncul di
daftar bank soal — persis alur yang diminta.

### A.35.3 Temuan nyata yang ditangkap gerbang mutu (dan diperbaiki)

- **ESLint (React Compiler) menolak ikon dinamis di dalam render.** Cara pertama membuat ikon tipe yang
  sedang aktif adalah `const IkonJenisAktif = ikonTipe(state.tipe) ?? …` lalu `<IkonJenisAktif />`.
  `eslint .` menandainya **1 error** `react-hooks/static-components`: *"Cannot create components during
  render"* — React Compiler menganggap komponen yang dipilih di dalam render sebagai komponen baru yang
  akan kehilangan state tiap render. Ketahuan lewat `./verify.sh` (bukan lewat pemeriksaan saya sendiri),
  dan memang `./verify.sh` sempat **GAGAL** sebelum diperbaiki. Perbaikan: pemilihan ikon dipindah ke
  pembantu tingkat modul `ikonJenis()` yang mengembalikan **elemen** (`createElement`), bukan komponen
  bernama besar; pemeriksaan yang sama lalu hijau. Ini temuan **di kode produk**, bukan di harness.

### A.35.4 Keputusan teknis (satu kalimat per keputusan)

- Petak memakai `<button role="radio">` di dalam `role="radiogroup"`, bukan `<select>` atau `<input>`,
  karena semua tipe harus terlihat sekaligus sambil tetap satu pilihan dan bisa dibaca pembaca layar.
- Peta ikon ditaruh di registry (`tipeSoal.js`), bukan di komponen, supaya bisa diuji murni dan
  dipakai ulang tanpa impor komponen dari komponen.
- Pemilih tetap **satu soal per form** (tidak ada bulk-create): yang "bulk" pada permintaan ini adalah
  **tampilan semua jenis sekaligus**, dan alur simpan ke bank soal tidak diubah sama sekali.
- Lipatan diberi `open` bawaan supaya guru baru langsung melihat pilihannya; ringkasan berikon
  menjaga tipe tetap terbaca saat guru melipatnya agar formulir lebih ringkas.

### A.35.5 Batasan jujur (yang belum selesai)

- Belum ada uji regresi visual/screenshot; bukti tampilan petak berasal dari DOM (`<svg>` + jumlah
  petak + `aria-checked`) dan pemeriksaan manual, bukan perbandingan gambar.
- Ikon dipetakan ke **bentuk** tiap tipe secara wajar, tetapi belum diuji dengan pengguna anak SD
  (belum ada uji keterbacaan ikon).
- `docs/desain/EditorSoal.dc.html` (papan desain lama) **tidak** diperbarui; ia tetap menggambarkan
  tata letak lama dan kini hanya menjadi arsip desain.

### A.35.6 Berkas yang dibuat/diubah

Dibuat:
- `frontend/src/__tests__/sections/question/ikonTipe.test.jsx`

Diubah:
- `frontend/src/icons.jsx` (21 ikon jenis soal)
- `frontend/src/sections/question/tipeSoal.js` (`IKON_TIPE`, `ikonTipe()`, medan `ikon` di `DAFTAR_TIPE`)
- `frontend/src/sections/question/EditorSoal.jsx` (urutan kartu + pemilih petak berikon yang bisa dilipat)
- `frontend/src/theme/theme.css` (`.pemilih-jenis`, `.petak-tipe`, dan variannya)
- `docs/smoke-ui-susun.mjs`, `docs/smoke-ui-kuis-manual.mjs` (judul & kelas baru)
- `docs/laporan-pengujian.md` (A.35 ini), `docs/penjelasan-fitur.md`, `docs/handoff-sesi.md`

## A.36 Editor Materi: Gagang Pangkas `|` di Kedua Sisi Klip (11 Oktober 2026)

Permintaan putaran ini: *"buat editor-nya, yang durasi media/kuis ada tanda `|` di kedua sisi untuk
menentukan durasinya."*

Sebelum putaran ini durasi klip hanya bisa diubah dari **inspector** (kotak angka "Durasi (detik)",
tombol −0,1/+0,1, dan geser mulai). Di timeline, klip hanya bisa dipindah lewat seret — titik
awal/akhirnya tidak bisa dipegang langsung. Putaran ini menambahkan **gagang pangkas `|`** di kedua
sisi klip yang sedang dipilih, seperti editor video pada umumnya.

### A.36.1 Yang dikerjakan

- **`editorMateri.js`: `pangkasKiri()` dan `pangkasKanan()` (helper murni, bisa diuji tanpa DOM).**
  `pangkasKiri()` menggeser titik mulai dan **menjaga ujung kanan tetap** (durasi ikut berubah);
  `pangkasKanan()` menggeser ujung kanan dan menjaga titik mulai. Keduanya membulatkan ke 0,1 detik dan
  menjepit ke `DURASI_MINIMUM` (0,1 detik) serta menolak titik mulai negatif. Dibuat terpisah dari
  `setMulai()` karena keduanya berbeda: `setMulai()` **memindahkan** klip (durasi tetap), sedangkan
  `pangkasKiri()` **memangkasnya** (ujung tetap).
- **Gagang di timeline (`EditorMateri.jsx`)**: klip terpilih mendapat satu tanda `|` di tiap sisinya,
  dibuat sebagai elemen **di dalam lane tetapi di luar tombol klip** — supaya tidak ada kontrol
  interaktif bersarang di dalam tombol, dan supaya seretan gagang tidak bertabrakan dengan seret-klip
  native (`draggable`). Grup gagang memakai `pointer-events: none`; hanya tandanya yang menerima
  pointer, jadi menekan badan klip tetap memilih/menggeser klip.
- **Seret tetikus**: `pointerdown` + `setPointerCapture` (pola yang sama dengan jarum merah/playhead).
  Panjang timeline **dibekukan saat seret mulai** (`pangkasTotalRef`) supaya penggaris tidak memanjang
  dan menarik gagangnya menjauh dari tangan saat ujung kanan digeser ke luar.
- **Papan tombol**: kedua gagang `role="slider"`, `tabIndex=0`, `aria-valuemin/max/now/valuetext`, dan
  bisa dipangkas dengan **panah kiri/kanan** per 0,1 detik — jadi tidak wajib memakai tetikus.
- **CSS `.nle-pangkas*`**: tanda `|` setinggi klip (3px, warna aksen), kursor `ew-resize`, area seret
  0,9rem, dan cincin fokus yang terlihat. Berlaku untuk **semua** tipe klip — media dan kuis sisipan
  termasuk, karena keduanya memakai `mulai_detik`/`durasi_detik` yang sama.
- **6 tes baru** di `__tests__/sections/material/editorMateri.test.js`: ujung tetap saat pangkas kiri,
  penjepitan minimum, penolakan titik mulai negatif, ujung tetap saat pangkas kanan, dan indeks tak
  dikenal yang tidak mengubah apa pun.
- **Harness `docs/smoke-ui-durasi-klip.mjs` diperluas** (11 pemeriksaan, dari 4) — lihat A.36.3.
  Putaran lanjutan menambah 4 pemeriksaan lagi (total **15**) supaya klip **kuis** dan klip **media**
  diuji sendiri-sendiri — lihat A.36.7.

### A.36.2 Verifikasi (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `npx vitest run src/__tests__/sections/material` | **95 passed (6 berkas)** — termasuk 6 tes pangkas baru |
| `./verify.sh` (root) | **SEMUA HIJAU (exit 0)** — Pest **267 passed (2443 assertions)** · Pint **340 berkas** · checkJs OK · ESLint **0 error** · Vitest **63 berkas / 610 test** · realtime 15 test |
| `docs/jalankan-smoke-ui.sh durasi-klip` (CDP; backend :8000 + vite :5173 + realtime :4000 + Chrome :9333) | **11/11 lulus, exit 0** (putaran A.36) |
| `node docs/smoke-ui-durasi-klip.mjs` (ulang 11 Okt 2026, putaran lanjutan — harness diperluas) | **15/15 lulus, exit 0** — termasuk klip **kuis** (materi #20) dan klip **media** (materi #1) |

Isi pemeriksaan baru di harness (dijalankan lewat **tetikus CDP sungguhan** dan papan tombol, bukan
memanggil fungsi internal):

1. klip terpilih punya **dua** tanda `|`, sebaris dengan klipnya;
2. keduanya berperan `slider` dan berkursor `ew-resize`;
3. titiknya **benar-benar terjangkau tetikus** (`document.elementFromPoint` = tanda `|`) — penjaga
   supaya seretan di bawah menguji hal yang benar;
4. seret tanda kanan ke kiri: durasi 29,9 → 22,8 detik, **titik mulai tetap 0**;
5. seret tanda kiri ke kanan: titik mulai 0 → 5 detik, **ujung kanan tetap 22,8 detik**;
6. panah kiri di papan tombol memangkas 17,8 → 17,7 detik.

### A.36.3 Temuan nyata saat verifikasi (dan apa yang salah)

- **Seret tetikus mula-mula "gagal" — ternyata harness-nya yang salah, bukan produk.** Tiga pemeriksaan
  pertama lulus, tetapi dua seretan tidak mengubah apa pun (`mulai 0→0 · durasi 29,9→29,9`). Saya
  diagnosis dulu alih-alih mengubah kode: (a) mengetes di halaman kosong membuktikan
  `Input.dispatchMouseEvent` **memang** menghasilkan `pointerdown/move/up`; (b) instrumentasi di halaman
  editor menunjukkan peristiwanya mendarat di `html/body` dengan `elementFromPoint` = `null`. Penyebabnya
  **timeline berada di y≈1852 px**, jauh di luar viewport headless 800x600 — event CDP memakai koordinat
  viewport, jadi tetikus "menekan" ruang kosong. Perbaikan: viewport ditinggikan
  (`Emulation.setDeviceMetricsOverride`, 1280x2200) sebelum menyeret, plus pemeriksaan penjaga
  keterjangkauan di atas. Sesudah itu seretan mengubah durasi seperti seharusnya (30 → 22,9 detik) dan
  harness menjadi 11/11. **Kode produk tidak diubah untuk ini.**
- **Pelajaran yang dicatat**: harness baru yang memakai input sungguhan harus memastikan elemennya
  berada di dalam viewport; kegagalan seperti ini tidak boleh diperbaiki dengan melonggarkan assertion.

### A.36.4 Keputusan teknis (satu kalimat per keputusan)

- Gagang ditaruh di lane (sibling tombol klip), bukan di dalam tombol, karena kontrol interaktif
  bersarang di dalam `<button>` menyulitkan pembaca layar dan bertabrakan dengan `draggable`.
- Panjang timeline dibekukan selama seret supaya memangkas tidak "mengejar" penggaris yang ikut memanjang.
-  `pangkasKiri/pangkasKanan` masuk `editorMateri.js` (helper murni) supaya aturannya diuji tanpa DOM
  dan bisa dipakai lagi oleh pemutar/alat lain.
- Gagang hanya tampil pada klip yang sedang dipilih — timeline tetap ringkas saat materi punya banyak klip.

### A.36.5 Batasan jujur (yang belum selesai)

- Area seret gagang 0,9rem (≈14 px) — **lebih kecil dari 44 px**; ini melekat pada kepadatan timeline
  (klip bisa sangat pendek), jadi jalur ini tidak ikut aturan sasaran-sentuh-44px. Karena itu papan
  tombol disediakan sebagai jalur alternatif, dan inspector (kotak angka + tombol ±0,1) tetap ada.
- Belum ada uji regresi visual/screenshot untuk posisi tanda `|`.
- Gagang tidak "magnet" ke tepi klip lain (tidak ada snapping).

### A.36.6 Berkas yang dibuat/diubah

Diubah:
- `frontend/src/sections/material/editorMateri.js` (`pangkasKiri`, `pangkasKanan`)
- `frontend/src/sections/material/EditorMateri.jsx` (gagang pangkas, seret, papan tombol)
- `frontend/src/theme/theme.css` (`.nle-pangkas-grup`, `.nle-pangkas`, `.nle-pangkas-kiri/kanan`)
- `frontend/src/__tests__/sections/material/editorMateri.test.js` (6 tes pangkas)
- `docs/smoke-ui-durasi-klip.mjs` (7 pemeriksaan gagang baru; putaran lanjutan menambah 4 lagi)
- `docs/laporan-pengujian.md` (A.36 ini), `docs/handoff-sesi.md`

### A.36.7 Putaran lanjutan (11 Oktober 2026): tanda `|` dipastikan berlaku untuk klip kuis & media

Permintaan itu datang lagi dengan kata yang hampir sama — *"buat bagian sebuah quiz/media ada `|` di kedua
sisinya untuk mengatur durasi daripada ketik manual"* — jadi yang pertama dikerjakan bukan menambah kode,
melainkan **memeriksa apakah permintaannya sudah terpenuhi** oleh A.36.

**Hasil pemeriksaan: sudah terpenuhi, tidak ada kode produk yang diubah.** Gagang `|` di render timeline
memang generik (`klipAktif && satu.track === klipAktif.track`), jadi berlaku untuk ketiga tipe klip — teks,
media, maupun kuis sisipan — dan `durasi_detik` kuis juga tersimpan server (`isi.durasi_detik`, dijaga
`SinkronBlokRequest` dan dibaca `BlokResource`/`ProgresMateriService`). Yang belum ada hanyalah **bukti di
harness**: bagian 3 harness lama hanya memangkas klip yang kebetulan terpilih (materi pertama yang punya
blok, kebetulan klip teks), sehingga tipe `kuis` dan `media` belum pernah benar-benar diuji lewat tetikus.

Yang ditambahkan: **bagian 4 di `docs/smoke-ui-durasi-klip.mjs`**. Materi dicari dari API berdasarkan tipe
bloknya (`/v1/materi` + detail tiap materi), lalu untuk tiap tipe (`kuis`, `media`) klip itu diklik,
dipastikan punya **dua** tanda `|` sebaris dengan klipnya, dicek pula keterjangkauan tetikusnya, lalu tanda
kanan diseret 40 px dan durasinya harus memendek tanpa memindahkan titik mulai. Bukti keluaran run
(`node docs/smoke-ui-durasi-klip.mjs`, exit 0):

```
LULUS · klip kuis terpilih punya tanda | di kedua sisinya · materi #20 · aktif=true tanda=2 sebaris=true
LULUS · seret tanda | kanan klip kuis memendekkan durasi tanpa memindahkan titik mulai · materi #20 · mulai 30→30 · durasi 60→53.6
LULUS · klip media terpilih punya tanda | di kedua sisinya · materi #1 · aktif=true tanda=2 sebaris=true
LULUS · seret tanda | kanan klip media memendekkan durasi tanpa memindahkan titik mulai · materi #1 · mulai 0→0 · durasi 10→9.3

15/15 pemeriksaan lulus.
```

Batasan putaran lanjutan: pemeriksaan ini bergantung pada **data dev** yang kebetulan punya materi berisi
klip `kuis` (#20) dan `media` (#1); pada basis data kosong, dua pemeriksaan itu akan gagal dengan pesan
"tidak ada materi yang punya klip tipe itu" — harness-nya belum membuat sendiri materi + berkas media uji
(seperti yang dilakukan `smoke-ui-perjalanan.mjs`). Tidak ada penyimpanan yang dilakukan, jadi susunan
materi tidak berubah.

## A.37 Peta Perjalanan Pakai Media Sungguhan, Template Jadi Opsional (11 Oktober 2026)

Permintaan putaran ini: *"dan tidak wajib memakai template, dan juga perbaiki template-nya, dan kau pakai
video/foto saja karena kurang menarik."*

Peta perjalanan A.34 sebelumnya menggambar adegannya sendiri lewat SVG: langit, matahari berdenyut, dua
awan berjalan, tiga lapis gunung (`AdeganGunung`), dan hanya **menumpuk** foto tema di bawahnya. Hasilnya
terasa seperti ilustrasi alih-alih panggung yang hidup. Putaran ini membuang gambar buatan itu: panggung
selalu memakai **media sungguhan** — video latar guru bila ada, kalau tidak **foto tema** — dan template
tema ditegaskan **opsional** di editor.

### A.37.1 Yang dikerjakan

- **`PetaPerjalanan.jsx`: `AdeganGunung` dihapus.** Tidak ada lagi adegan SVG, `data-lapisan`, matahari,
  awan, maupun poligon bukit. Urutan latar jadi **video → foto tema → gradien**: `data-latar="video"` bila
  guru menempelkan video, `data-latar="foto"` bila tema punya foto (`fotoAdegan()`), dan
  `data-latar="gradien"` bila keduanya tidak ada atau fotonya gagal dimuat (`onError`). Panggung tidak
  pernah kosong, tetapi juga tidak pernah memakai gambar buatan.
- **`theme.css`: gaya adegan SVG dibuang.** `.jelajah-adegan`, `.jelajah-matahari`, `.jelajah-awan*`,
  `.jelajah-bukit*`, `.jelajah-salju`, serta `@keyframes jelajah-awan`/`jelajah-denyut` hilang. Gradien
  cadangan diperbaiki jadi bujur-sangkar tenang (matahari `radial-gradient` + `linear-gradient` biru-hijau)
  yang tetap kontras dengan jalur putih dan titik pos. Lapisan gelap di atas media kini berlaku untuk
  **foto dan video** (`[data-latar='foto']`, `[data-latar='video']`), ditambah vignette radial, supaya
  titik pos dan penanda tetap terbaca di bagian media yang terang. Gerak zoom foto (`jelajah-zoom`) dan
  gerak penanda pos (`jelajah-langkah`) dipertahankan.
- **Editor menegaskan template opsional**: di bawah judul "Template tema" ada keterangan bahwa tema
  bersifat opsional dan "Tanpa tema" menghasilkan daftar bagian biasa (tanpa perubahan alur simpan).
- **Tes & harness dibaca ulang** mengikuti bentuk latar yang benar-benar dirender: tes peta sekarang
  memastikan **tidak ada** kelas `jelajah-adegan`/`jelajah-matahari`/`jelajah-awan`/`jelajah-bukit`, dan
  latar tanpa foto memakai `data-latar="gradien"`.

### A.37.2 Temuan nyata (dan apa yang diperbaiki)

- **Harness `smoke-ui-perjalanan.mjs` belum pernah menuntaskan paruh keduanya.** Materi kedua ("tanpa
  peta") dibuat **setelah** alur murid tanpa masuk ulang sebagai guru, jadi `POST /v1/materi` dijalankan
  dengan sesi **murid** dan ditolak — `idRingkas` = 0 dan 12 pemeriksaan sesudahnya runtuh. Diperbaiki dengan
  `keluar()` + `masuk(AKUN_GURU)` sebelum bagian 8, mengikuti pola yang sudah dipakai bagian 9/10 (bug
  **harness**, bukan produk).
- **Proses Node harness tidak pernah keluar.** WebSocket CDP dibiarkan terbuka, jadi `node` hidup terus,
  runner menggantung, dan `hasil smoke` tidak pernah tercetak — artinya kode keluar harness tidak pernah
  terbaca. Diperbaiki dengan `ws.close()` di akhir `main()` plus `.finally()` yang keluar paksa sesudah
  jeda singkat bila `main()` berhenti karena galat.

### A.37.3 Verifikasi (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `npx vitest run src/__tests__/sections/material` | **104 passed (6 berkas)** |
| `npx eslint` (PetaPerjalanan, EditorMateri, petaPerjalanan.test) | **0 error** |
| `./verify.sh` (root) | **SEMUA HIJAU (exit 0)** — Pest · Pint · checkJs · ESLint · Vitest · realtime |
| `docs/jalankan-smoke-perjalanan.sh` (backend :8000 + vite :5173 + Chrome :9333) | **51/51 lulus, exit 0** |

Pemeriksaan baru yang relevan di harness:

1. materi pertama: `peta memakai media bergerak, bukan gambar diam · latar video autoplay=true · pendaki jelajah-langkah`;
2. materi kedua: `peta memakai foto tema sebagai latar (berkasnya benar-benar termuat) · jenis foto · berkas /tema/gunung.jpg · termuat true`;
3. `peta memakai foto tema, tanpa adegan gambar buatan · adegan SVG 0 · zoom jelajah-zoom`.

### A.37.4 Keputusan teknis (satu kalimat per keputusan)

- Gambar buatan dibuang sepenuhnya, bukan dipercantik: panggung hanya memakai media yang diunggah guru
  atau foto berlisensi bebas — lebih mudah dipertanggungjawabkan daripada ilustrasi SVG yang menua.
- Gradien dipakai sebagai cadangan, bukan gambar statis: tidak ada berkas tambahan untuk dimuat dan tidak
  ada hak pakai yang perlu dilacak.
- Jalur `data-latar` dipertahankan (`video`/`foto`/`gradien`) supaya tes dan CSS tetap memilih bentuk latar
  dari satu sumber kebenaran.
- WebSocket CDP ditutup di akhir agar kode keluar harness bermakna; tanpa itu hijau/merah tidak bisa
  dipercaya.

### A.37.5 Batasan jujur (yang belum selesai)

- **Tema hanya punya satu foto** (`frontend/public/tema/gunung.jpg`). Adegan lain — termasuk tema kedua
  yang belum dibuat — akan tampil sebagai gradien sampai fotonya ditambahkan; katalog tema tetap baru satu.
- Video latar masih hanya diuji dengan satu MP4 2 detik di jalur berpotongan; belum semua kodek/rasio.
- Bukti "bergerak" dari DOM/CDP (`animationName` foto, `autoplay` video) — **belum ada** uji regresi
  visual/screenshot.
- Smoke perjalanan tidak ikut `verify.sh` (butuh backend + vite + Chrome hidup).

### A.37.6 Berkas yang dibuat/diubah

Diubah:
- `frontend/src/sections/material/PetaPerjalanan.jsx` (buang adegan SVG → video/foto/gradien)
- `frontend/src/sections/material/EditorMateri.jsx` (keterangan template opsional)
- `frontend/src/theme/theme.css` (buang gaya adegan, panggung foto/video + gradien cadangan)
- `frontend/src/__tests__/sections/material/petaPerjalanan.test.jsx`
- `frontend/public/tema/LISENSI.md`
- `docs/smoke-ui-perjalanan.mjs` (latar tanpa SVG, masuk ulang sebagai guru, tutup WebSocket)
- `docs/laporan-pengujian.md` (A.37 ini), `docs/penjelasan-fitur.md`, `docs/handoff-sesi.md`

## A.38 Editor Materi: Pemilih Kuis yang Lebih Baik + Penjelasan Opsional Setelah Kuis (11 Oktober 2026)

Permintaan putaran ini: *"quiz-nya buat UI-nya lebih baik … dan setelah quiz guru bisa berikan bagian
feedback (opsional)"*, lalu diperjelas: yang dimaksud **UI saat menyisipkan kuis** di editor materi, dan
umpan baliknya menempel **per kuis (seluruh kelas)**, tampil **hanya di `/materi` setelah kuis**, berupa
**penjelasan lengkap — teks atau media**.

Sebelum putaran ini penyisipan kuis memakai satu `<select>` telanjang berisi judul kuis saja: guru tidak
melihat jumlah soal, mapel, kelas, maupun status, dan tidak ada cara mengenali kuis tanpa soal. Setelah
kuis selesai, murid hanya melihat skor dan tombol lanjut — tidak ada tempat bagi guru untuk menjelaskan
kenapa jawabannya begitu.

### A.38.1 Yang dikerjakan

- **Editor: `PemilihKuis` menggantikan `<select>`.** Berisi kotak pencarian (judul, mapel, kelas, status)
  dan baris kuis yang bisa dipindai: `N soal · mapel · kelas · status`, kuis **tanpa soal** ditandai
  peringatan, dan baris terpilih diberi `aria-pressed`. Bila katalog kosong, editor menjelaskan bahwa kuis
  dibuat lebih dulu di menu Kuis.
- **Editor: editor penjelasan di panel klip kuis** (opsional) — `<textarea>` (batas 5.000 karakter) +
  pilihan **media** dari pustaka unggahan materi + tombol "Kosongkan penjelasan" yang mati saat memang
  kosong. Keterangannya menyebut bahwa penjelasan tampil untuk **seluruh kelas** tepat setelah kuis selesai.
- **Backend: penjelasan disimpan di dalam blok kuis** (`isi.penjelasan = {teks, unggahan_kode}`) dan
  divalidasi `MateriService::validasiPenjelasan()`: teks dipangkas & dibatasi 5.000 karakter, media wajib
  unggahan materi yang sama/sekolah yang sama/berstatus selesai (aturan yang sama dengan blok media).
  Blok tanpa penjelasan **tidak** menulis kunci `penjelasan` sama sekali, jadi materi lama tidak berubah
  saat disimpan ulang.
- **Backend: satu bentuk untuk guru & murid.** `BlokResource` mengirim `{teks, unggahan_kode}`;
  `ProgresMateriService::penjelasanBlok()` (dipakai daftar progres **dan** pembukaan satu blok) mengirim
  `{teks, media}` dengan URL **bertanda tangan** seperti blok media. Isinya bukan kunci jawaban — kunci
  tetap hanya ada di server — jadi aman dikirim ke klien.
- **Pemutar murid: `PenjelasanKuis`.** Tampil **hanya sesudah** latihan dikumpulkan (setelah banner skor,
  sebelum tombol "Lanjutkan video"), mempertahankan baris baru pada teks, dan merender media sesuai mime
  (gambar/video/audio/pdf), atau tautan unduh untuk kategori yang tidak boleh tampil langsung. Kuis tanpa
  penjelasan tidak berubah sama sekali.
- **9 tes baru**: 3 Vitest di `editorMateri.test.js` (penjelasan hanya dikirim bila diisi, dibaca kembali
  dari server, pemotongan teks) + 2 Vitest di `api.test.js` (skema `penjelasan` + media, dan opsional) + 1 Pest
  di `Slice08Test.php` (simpan/ditolak/dikirim ke murid).

### A.38.2 Temuan nyata saat verifikasi (dan apa yang diperbaiki)

- **Harness pemutar materi membaca halaman yang salah.** `docs/smoke-ui-materi.mjs` memakai pemilih
  `document.querySelectorAll('ol li')`, dan sejak tema perjalanan (A.34) halaman murid memuat **dua** `<ol>`:
  daftar pos peta (`.jelajah-daftar`) dan daftar bagian materi. Akibatnya harness menghitung pos peta sebagai
  "bagian", mengklik baris yang salah, lalu jatuh pada `Cannot set properties of null (setting 'currentTime')`
  — 6 pemeriksaan gagal tanpa ada yang salah di produk. Diperbaiki dengan pemilih yang mengecualikan daftar
  pos (`ol.list-unstyled:not(.jelajah-daftar) > li`); sesudah itu **22/22 lulus**.
- **Urutan verifikasi penting**: kegagalan itu muncul saat menjalankan harness lama pada kode baru, jadi
  diagnosis dimulai dengan menanyakan "apakah kode produk atau harness yang salah" — dan buktinya mengarah ke
  harness (halaman yang dibaca memang bukan halaman yang dimaksud).

### A.38.3 Verifikasi (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `php artisan test tests/Feature/Slice08Test.php` | **13 passed (193 assertions)** — termasuk tes penjelasan |
| `npx vitest run src/__tests__/sections/material` | **109 passed (6 berkas)** |
| `npm run check` + `npx eslint src` | **0 error** (2 peringatan lama dari `react-hooks`) |
| `./verify.sh` (root) | **SEMUA HIJAU (exit 0)** — Pest · Pint · checkJs · ESLint · Vitest · realtime |
| `docs/jalankan-smoke-materi.sh` (backend :8000 + vite :5173 + Chrome :9333) | **27/27 lulus, exit 0** |

Pemeriksaan BARU di harness itu (lewat browser sungguhan, bukan panggilan fungsi internal):

1. `penjelasan setelah kuis tersimpan di blok kuis` — teks yang disimpan guru kembali utuh dari server;
2. `penjelasan belum tampil sebelum kuis dikumpulkan` — DOM saat panel kuis terbuka **tidak** memuat
   `.pm-penjelasan`;
3. `penjelasan guru tampil setelah kuis selesai` — sesudah murid menjawab + mengumpulkan, kartu
   `Penjelasan` muncul dan isinya teks guru (`SMOKE-MATERI: 5 + 5 = 10 …`).

### A.38.4 Keputusan teknis (satu kalimat per keputusan)

- Penjelasan disimpan di **blok kuis**, bukan tabel kuis: guru menulisnya justru saat menyisipkan kuis, dan
  media bisa langsung memakai pustaka unggahan materi yang sedang diedit — jadi murid tetap melihat satu
  penjelasan yang sama untuk seluruh kelas.
- Media memakai jalur unggahan materi (berkas privat + tautan bertanda tangan), bukan URL luar: hak pakai dan
  pembersihan berkas tetap satu pintu.
- Satu helper `penjelasanBlok()` dipakai daftar progres dan pembukaan blok supaya bentuknya tidak pernah
  berbeda antara peta bagian dan pemutar.
- Kunci `penjelasan` tidak ditulis bila kosong, supaya menyimpan ulang materi lama tidak mengubah isinya.

### A.38.5 Batasan jujur (yang belum selesai)

- **Penjelasan menempel pada klip kuis, bukan pada kuis itu sendiri.** Bila satu kuis disisipkan di dua
  materi (atau dua klip), tiap klip punya penjelasannya sendiri; belum ada cara menulis sekali lalu dipakai
  ulang. Bila itu yang diinginkan, penjelasan perlu pindah ke tabel `quizzes` + jalur unggah khusus kuis.
- **Penjelasan bukan umpan balik per murid**: tidak bisa dibedakan per anak, dan tidak ada notifikasi
  "guru memberi penjelasan baru" — murid melihatnya saat melewati kuis itu lagi.
- Media penjelasan hanya dari **pustaka materi itu**; belum ada unggahan langsung dari panel penjelasan
  (guru mengunggah lewat klip media lalu memilihnya).
- Belum ada uji regresi visual/screenshot untuk tata pemilih kuis dan kartu penjelasan.
- Smoke membuktikan penjelasan **teks** di pemutar; jalur **media** penjelasan belum diuji lewat browser
  (hanya lewat Pest: media tersimpan, URL bertanda tangan dikirim, dan satu gambar berhasil diparse
  skemanya di Vitest).

### A.38.6 Berkas yang dibuat/diubah

Diubah — backend:
- `backend/app/Sections/Material/Services/MateriService.php` (`MAKS_PENJELASAN`, `validasiPenjelasan()`, gabung ke `isi` blok kuis)
- `backend/app/Sections/Material/Services/ProgresMateriService.php` (`penjelasanBlok()`, dipakai ringkasan & buka blok)
- `backend/app/Sections/Material/Http/Resources/BlokResource.php` (`penjelasan` untuk guru)
- `backend/tests/Feature/Slice08Test.php` (1 tes baru)

Diubah — frontend:
- `frontend/src/sections/material/EditorMateri.jsx` (`PemilihKuis`, panel penjelasan)
- `frontend/src/sections/material/editorMateri.js` (`MAKS_PENJELASAN`, `penjelasanTerisi()`, baca/kirim penjelasan)
- `frontend/src/sections/material/PemutarMateri.jsx` (`PenjelasanKuis`)
- `frontend/src/sections/material/api.js` (skema `penjelasan` untuk guru & murid)
- `frontend/src/theme/theme.css` (`.nle-pemilih-*`, `.nle-penjelasan`, `.pm-penjelasan*`)
- `frontend/src/__tests__/sections/material/editorMateri.test.js`, `api.test.js`

Diubah — dokumentasi/harness:
- `docs/smoke-ui-materi.mjs` (pemilih daftar bagian yang mengecualikan daftar pos)
- `docs/laporan-pengujian.md` (A.38 ini), `docs/penjelasan-fitur.md`, `docs/handoff-sesi.md`

## A.39 Sapuan Dasar: Setiap Tipe Soal, Reset Sandi Lewat Email, dan Penyebaran Materi (11 Oktober 2026)

Permintaan putaran ini: *"test dasar ... test setiap tipe soal apakah berjalan normal, penyebaran materi?
password reset email dll 1x token? dll cari"*. Jadi bukan menambah fitur, melainkan **sapuan dasar**: untuk
flow yang disebut, apa yang sudah ada tesnya, apa yang belum, dan apa yang ternyata **rusak**.

### A.39.1 Yang dikerjakan

- **Berkas uji baru `backend/tests/Feature/AlurTipeSoalTest.php`** — dataset **22 baris, satu per tipe soal**,
  menempuh jalur HTTP yang sama seperti guru dan murid sungguhan: `POST /soal` → pasang ke kuis →
  `POST /kuis/{id}/mulai` → periksa payload murid (tipe benar & **tanpa** kunci) → `POST /attempt/{id}/jawab`
  dengan jawaban BENAR berbentuk kiriman renderer frontend → `POST /attempt/{id}/kumpulkan` → periksa
  status & skor **baris jawaban** sekaligus skor attempt. Tipe non-objektif punya harapannya sendiri
  (`uraian` = dinilai lewat kata kunci, `tugas_unggah` = `perlu_tinjau`).
- **2 tes baru di `AuthTest.php`**: (1) token reset **kedaluwarsa** (>60 menit) ditolak, kata sandi tidak
  berubah, dan tautan yang diminta ulang tetap bisa dipakai; (2) `lupa-sandi` kena **429** setelah lima
  permintaan untuk email yang sama (IP sama) sementara email lain belum terkena batas per akun.
- **1 tes baru di `Slice08Test.php`**: **penyebaran materi** — materi belum terbit tidak muncul di
  `/materi-saya` dan `403` saat dibuka; setelah terbit hanya murid kelas yang dituju yang menerima;
  murid kelas lain `403`; guru lain `403` untuk progres, isi materi, dan laporan.

### A.39.2 Temuan nyata (3, semuanya sudah diperbaiki)

1. **`mengurutkan`: murid yang menjawab BENAR selalu mendapat skor 0.** Renderer `SoalMengurutkan`
   mengirim peta `{idItem: posisi}` (murid mengetik nomor urut tiap item), sedangkan
   `PenanganMengurutkan::nilai()` membaca jawaban sebagai **daftar id berurutan**
   (`array_values($jawaban)` dibandingkan `kunci.urutan`). Nilai peta adalah nomor posisi (mis. `3,1,2`)
   dan kuncinya daftar id, jadi perbandingannya **tidak pernah** cocok — dan karena hasilnya tetap
   `dinilai` (bukan `gagal`), guru tidak pernah melihatnya di antrean tinjauan. Diperbaiki: `nilai()`
   sekarang mengenali dua bentuk lewat pembantu `urutanJawaban()` — peta hanya sah bila kuncinya persis
   seluruh item, nomornya bulat 1..n, dan tidak ada nomor kembar; daftar id lama tetap diterima supaya
   jawaban yang sudah tersimpan tidak berubah nilainya. Bukti: sebelum perbaikan, run
   `AlurTipeSoalTest` berbunyi `Tipe mengurutkan mendapat skor 0, seharusnya 4`; sesudah perbaikan
   **22/22 lulus**.
2. **Soal `teka_silang_mini` tidak bisa disimpan lewat API (422) — jadi tidak bisa dibuat/diubah guru.**
   Middleware bawaan Laravel `ConvertEmptyStringsToNull` mengubah kotak grid yang kosong (`''`) menjadi
   `null`, sedangkan registry mensyaratkan tiap kotak berupa string `''` atau `'#'`; guru selalu menerima
   *"Kotak teka silang hanya boleh '' (diisi murid) atau '#' (kotak hitam)."*. Seeder dan contoh bank soal
   menulis langsung ke basis data, jadi bug ini **tidak terlihat** dari data demo. Diperbaiki di
   `SimpanSoalRequest::prepareForValidation()`: `null` pada `konten.grid` dikembalikan ke `''`, sehingga
   bentuk yang disimpan tetap seperti yang didokumentasikan registry.
3. **Laporan materi bisa dibaca guru mana pun (data murid bocor lintas pemilik).** `MateriPolicy::laporan()`
   hanya memeriksa `isGuru()`, tanpa memeriksa kepemilikan — padahal isinya nama, progres, dan skor
   **seluruh murid kelas** materi itu, dan `MateriPolicy::view()` sudah menolak materi bukan miliknya.
   Diperbaiki: `laporan()` memakai aturan `update()` (pemilik materi, atau admin). Ini **perubahan perilaku
   yang perlu konfirmasi**: guru sekolega tidak lagi bisa membuka `/v1/materi/{id}/laporan` materi bukan
   miliknya (admin tetap boleh). Alasannya: data anak dan pagar kepemilikan yang sudah dipakai di seluruh
   aplikasi (lihat `OtorisasiPemilikTest`). Kalau ternyata guru sekolega memang boleh membacanya, satu
   baris policy itu tinggal dikembalikan.

### A.39.3 Verifikasi (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `php artisan test --filter=AlurTipeSoalTest` | **22 passed (242 assertions)** — satu tes per tipe soal |
| `php artisan test` (seluruh suite) | **294 passed (2774 assertions)**, 16,5 s |
| `npx vitest run` | **63 berkas / 624 tes passed** |
| `./verify.sh` (root) | **SEMUA HIJAU (exit 0)** — Pest · Pint **341 berkas** · checkJs · ESLint · Vitest · realtime 15 tes |
| `php artisan test --filter="Slice12TemaMateri|OtorisasiPemilik"` (sesudah policy laporan diubah) | **19 passed (242 assertions)** |

### A.39.4 Yang sudah ada tesnya sebelum putaran ini (diperiksa, tidak diubah)

- **Reset sandi lewat email**: respons identik untuk email ada/tidak ada (anti-enumerasi), token tersimpan
  **ter-hash**, token **sekali pakai** (baris `password_reset_tokens` hilang sesudah dipakai), tautan yang
  sudah dipakai ditandai `tautan_dipakai`, mencabut sesi lama + `remember_token`, URL notifikasi menuju
  halaman frontend, callback provider terdaftar, dan fail-open saat layanan email mati.
- **Tipe soal**: kontrak registry per tipe (validasi + nilai + bobot) di `Slice06Test`/`Slice11TipeSoalTest`,
  plus pagar arch di `ArchitectureTest` (tiap tipe punya penangan unik & metode kontrak lengkap).
- **Materi**: urutan blok wajib, timeline/track/durasi, penjelasan setelah kuis, tema & kenaikan pos/tingkat,
  laporan guru vs peta murid. Yang **belum** ada sebelum A.39: sapuan HTTP per tipe soal, kedaluwarsa token
  reset, throttle `lupa-sandi`, dan sebaran materi kelas lain.

### A.39.5 Batasan jujur (yang belum selesai)

- Sapuan ini lewat **HTTP + bentuk kiriman renderer**, bukan browser sungguhan: tidak ada uji screenshot,
  dan tidak ada berkas media sungguhan yang diunggah.
- `tugas_unggah` diuji sampai status `perlu_tinjau`; jalur unggah berkas + penilaian rubrik guru tetap di
  `Slice09UploadTest`.
- `uraian` diuji dengan seluruh kata kunci muncul (skor penuh); ambang parsial, saran AI, dan koreksi manual
  tetap di `Slice06Test`/`Slice09AiTest`.
- Temuan #3 adalah **perubahan kebijakan**, bukan sekadar perbaikan bug: butuh keputusan pemilik produk.
- Alasan dua bug itu tidak tertangkap lebih awal: keduanya hanya diuji di **registry** (fungsi internal),
  bukan lewat jalur HTTP guru/murid — pagar jenis yang sama sudah ada untuk perilaku, belum untuk jalur.

### A.39.6 Berkas yang dibuat/diubah

Dibuat:
- `backend/tests/Feature/AlurTipeSoalTest.php`

Diubah — kode produk:
- `backend/app/Sections/Question/Registry/PenanganMengurutkan.php` (`urutanJawaban()`, terima peta & daftar)
- `backend/app/Sections/Question/Http/Requests/SimpanSoalRequest.php` (`null` → `''` pada `konten.grid`)
- `backend/app/Sections/Material/Policies/MateriPolicy.php` (`laporan()` = pemilik/admin)
- `frontend/src/sections/attempt/ringkasanJawaban.js` (komentar bentuk jawaban `mengurutkan` diperbaiki)

Diubah — tes:
- `backend/tests/Feature/AuthTest.php` (2 tes: kedaluwarsa token, throttle `lupa-sandi`)
- `backend/tests/Feature/Slice08Test.php` (1 tes: penyebaran materi)

Diubah — dokumentasi:
- `docs/laporan-pengujian.md` (A.39 ini), `docs/handoff-sesi.md`

---

## A.40 Siswa Tamu: Guru Mengizinkan Kuis Tanpa Akun, Tamu Cukup Mengetik Nama (11 Oktober 2026)

Permintaan putaran ini: *"tambahkan setting guru bisa mengizinkan siswa guest (gak perlu login) namun harus
diberikan nama"* — plus permintaan meng-commit & men-push pekerjaan yang menumpuk. Jadi putaran ini
menambah satu fitur utuh (bukan sapuan) sekaligus menutup utang commit.

### A.40.1 Yang dikerjakan

- **Saklar pengaturan baru `izinkan_tamu`** (`KunciPengaturan::IzinkanTamu`, boolean, bawaan **mati**,
  kelompok tampilan *"Siswa tamu"*). Karena pengaturan aplikasi ini tiga lapis, guru memakai saklarnya di
  **lapis kuis miliknya** (satu kuis dibuka untuk tamu, kuis lain tetap tertutup), sementara admin bisa
  menyalakannya untuk sekolah/kelas. Halaman pengaturan yang sudah ada langsung menampilkan saklar ini
  tanpa perubahan UI — nilainya memang dikirim server.
- **Section baru `Tamu`**: `TamuService` (menentukan ketersediaan tamu, izin per kuis, daftar kuis terbuka,
  dan masuk dengan nama), `MasukTamuRequest` (nama 2–60 karakter, dirapikan sebelum divalidasi),
  `TamuController` (info publik, masuk, dan panel hasil tamu untuk guru), serta `LaporanTamuService`.
- **Jalur publik**: `GET /v1/tamu` (apakah halaman masuk perlu menawarkan pintu tamu) dan
  `POST /v1/auth/tamu` (masuk dengan nama; kena `throttle:auth` seperti jalur auth lain).
- **Akun tamu tetap akun sungguhan**: baris `users` (peran `murid`, `is_tamu = true`, status aktif, email
  verifikasi dianggap beres karena tidak ada kotak surat) + baris `students` di kelas penampung
  **"Tamu (tanpa akun)"** yang dibuat sekali per sekolah. Karena itu policy IDOR, pengacakan, snapshot soal,
  penilaian mesin, koreksi guru, dan presence bekerja **tanpa cabang baru** — hanya satu aturan yang diganti.
- **Gerbang pengerjaan** (`AttemptService::mulai`): untuk tamu, pemeriksaan *"kuis ini harus kelasmu"*
  diganti dengan *"kuis ini memang dibuka gurunya untuk tamu"*; mode tim ditolak dengan pesan yang jelas
  (tim selalu disusun dari murid kelas). Murid dengan akun tetap melewati jalur lama yang sama ketatnya.
- **Pagar bacaan**: `KuisPolicy::view` menerima tamu hanya bila kuisnya terbit **dan** izin tamunya menyala;
  `KuisController::index` untuk tamu mengembalikan **hanya** kuis terbit yang dibuka untuk tamu (kuis draf
  tidak pernah terlihat); halaman peringkat **ditutup** untuk tamu (`RankingController` 403) dan baris
  mereka **tidak masuk** peringkat kelas (`RankingService` menyaring `users.is_tamu = false`).
- **Panel guru**: `GET /v1/kuis/{kuis}/tamu` (pemilik kuis saja, memakai policy `laporan` yang sama) berisi
  satu baris per attempt tamu (nama, skor, benar, percobaan ke-, waktu kumpul) + penanda apakah pintu
  tamunya masih terbuka. Di UI muncul sebagai bagian *"Siswa tamu"* di halaman laporan kuis.
- **UI murid**: formulir *"Atau ikut sebagai siswa tamu"* di halaman masuk (hanya muncul bila server
  mengizinkannya), navigasi khusus tamu di kerangka umum (Beranda + Ulangan Tamu), salinan halaman kuis &
  beranda yang menyebut mode tamu, dan tautan Peringkat disembunyikan untuk tamu.

### A.40.2 Temuan nyata saat verifikasi (2, dua-duanya diperbaiki)

1. **Kolom baru `users.is_tamu` membuat endpoint yang mengembalikan user BARU dibuat melempar 500.**
   Aplikasi menyalakan `Model::preventAccessingMissingAttributes()` di non-produksi, dan Eloquent hanya
   mengisi atribut yang benar-benar dikirim saat `create()` — jadi `$user->is_tamu` pada user yang baru
   dibuat melempar `MissingAttributeException`. Ketemu dari tes debug `/auth/saya` untuk murid biasa yang
   dijawab **500** (bukan karena tamu). Dampaknya bukan main-main: `POST /auth/daftar` membalas
   `UserResource($hasil['user'])` dari user yang baru dibuat, jadi pendaftaran murid akan 500 di produksi.
   Diperbaiki dengan nilai bawaan model (`protected $attributes = ['is_tamu' => false]`), bukan dengan
   menambal tiap pemanggil; tes debug mengonfirmasi kembali 200 sesudah perbaikan.
1b. **Catatan operasional dari smoke HTTP sungguhan:** kolom itu baru, jadi **`php artisan migrate` wajib dijalankan**
   sebelum backend lama dipakai lagi. Terbukti saat smoke: `POST /auth/masuk` pada basis data dev yang belum
   dimigrasi dijawab **500** (respons login membaca `is_tamu`), dan langsung **200** sesudah `migrate`.
   Di produksi (`preventAccessingMissingAttributes` tidak aktif) pembacaan kolom hilang hanya menghasilkan
   `false`, bukan 500 — jadi ini pagar keselamatan yang berbicara, bukan kerapuhan baru.
2. **Panel hasil tamu 500 karena enum di-cast ke string.** `LaporanTamuService` memakai select mentah
   (`'attempts.jenis'`), sedangkan model `Attempt` meng-cast kolom itu ke enum; `(string) $satu->jenis`
   melempar *"Object of class JenisAttempt could not be converted to string"*. Diperbaiki dengan membaca
   `->value` dari enum-nya; tes `TamuTest` menutup jalur ini dari sisi guru pemilik.

### A.40.3 Verifikasi (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `php artisan test --filter=TamuTest` | **15 passed (120 assertions)** — termasuk tamu mengerjakan sampai dikumpulkan (skor 10/10) |
| `php artisan test` (seluruh suite) | **309 passed (2894 assertions)**, 17,2 s |
| `npx vitest run` | **64 berkas / 627 tes passed** (+3 tes `masukTamu.test.jsx`) |
| `npm run check` (checkJs) | **bersih** (0 error) |
| `npm run lint` (ESLint) | **0 error** (2 warning lama di `HalamanDaftar.jsx`) |
| `./verify.sh` (root) | **SEMUA HIJAU (exit 0)** — Pest · Pint **347 berkas** · checkJs · ESLint · Vitest 64/627 · realtime 15 tes |
| `git push` | `d2c0dff..6e04be6 main -> main`, lalu `6e04be6..77dc2eb` (fitur tamu), lalu `77dc2eb..1239ebd` (catatan hash) — repo online memuat semuanya |
| Smoke HTTP **sungguhan** (`php artisan serve` :8011 + curl, sesi cookie + CSRF) | backend :8011 + basis data dev: `GET /v1/tamu` `{"diizinkan":false}` → sesudah admin menyimpan saklar lapis kuis → `true`; `POST /auth/tamu {"nama":"Tamu Smoke Rara"}` **201** (`role: murid`, `isTamu: true`); `GET /v1/kuis` **hanya 1 kuis** (yang dibuka); `GET /v1/kuis/108` **200**; `GET /v1/kuis/108/ranking` **403**; `POST /kuis/108/mulai` **422 "Waktu kuis sudah berakhir"** (pagar jadwal berlaku juga untuk tamu); `GET /kuis/108/tamu` sebagai tamu **403** dan sebagai admin **200** (`izin_tamu: true`); masuk lagi dengan nama yang sama → **id sama (153)**, nama dirapikan — sesudah itu akun tamu uji, baris pengaturannya, dan kelas penampungnya dibersihkan lagi (dev DB kembali ke keadaan semula) |

Yang dibuktikan tes itu penting untuk diringkas: default **mati** (tanpa izin guru, `POST /auth/tamu` ditolak
422 dan **tidak ada** akun tamu yang dibuat), pintu terbuka setelah guru menyimpan saklar lapis kuisnya,
tamu hanya melihat/mengerjakan kuis yang dibuka (kuis draf & kuis guru lain 403), murid berkelas lain tetap
ditolak walau izin tamu menyala, mode tim ditolak untuk tamu, akun tamu tidak bisa menyentuh jalur guru,
tamu tidak bisa membuka peringkat kelas, dan guru pemilik melihat hasil tamunya sementara guru lain 403.

### A.40.4 Keputusan teknis (satu kalimat per keputusan)

- **Saklar di lapis kuis** (bukan kolom baru di kuis): memakai sistem pengaturan tiga lapis yang sudah ada,
  jadi guru dapat mengizinkan tamu **per kuis** tanpa memberikan hak sekolah/kelas (yang tetap admin).
- **Nama = identitas**: nama yang sama masuk lagi memakai akun tamu yang sama (alamat emailnya diturunkan
  dari nama), sehingga batas percobaan, riwayat jawaban, dan hasil tetap satu orang — bukan akun baru tiap
  masuk; konsekuensinya jujur (dua anak bernama persis sama berbagi identitas) dan itu ditulis di formulir
  serta dokumen ini.
- **Email sintetis `tamu+<slug>@tamu.invalid`** (TLD `.invalid` dijamin RFC 2606) supaya akun tamu tidak
  mungkin bertabrakan dengan surat sungguhan maupun pendaftaran murid, sekaligus asalnya jelas.
- **Tamu tetap punya baris `users` + `students`** di kelas penampung "Tamu (tanpa akun)": policy, penilaian,
  dan koreksi guru bekerja apa adanya, dan tamu tidak tercampur dengan kelas sungguhan.
- **Verifikasi email dilewati** untuk tamu (tidak ada kotak surat) tetapi status tetap `aktif`, supaya
  middleware `akun-aktif` tidak menutup semua endpoint untuknya.
- **Mode tim ditolak** untuk tamu, bukan dibiarkan gagal dengan pesan "kamu belum masuk tim".
- **Tamu di luar ranking kelas** dan **tidak boleh membuka peringkat**: nama anak kelas bukan untuk orang
  tanpa akun, sementara nilainya tetap bisa dilihat guru lewat panel siswa tamu.
- **Laporan kelas tidak diubah bentuknya**; hasil tamu diberi jalur sendiri supaya skema laporan yang sudah
  ada (dan tesnya) tetap utuh.

### A.40.5 Batasan jujur (yang belum selesai)

- **Belum diuji di peramban sungguhan**: jalur tamu dibuktikan lewat HTTP (Pest) dan formulirnya lewat
  jsdom (Vitest); belum ada uji klik/screenshot di browser.
- **Dua anak dengan nama sama berbagi satu identitas tamu** — konsekuensi sadar dari "nama = identitas";
  mitigasinya hanya petunjuk di formulir (minta nama yang khas), belum ada mekanisme pembeda (mis. kode
  kelas) dan belum ada uji yang memaksa pilihan lain.
- **Akun tamu tidak dibersihkan otomatis**: belum ada jadwal hapus akun tamu lama, jadi sekolah yang sering
  memakai mode ini akan menumpuk akun tamu.
- **Fitur berakun tetap tertutup untuk tamu** (materi, lencana, progres tema, avatar): navigasi tamu memang
  dipersempit supaya tidak ada tautan yang menabrak 403, bukan karena jalurnya diberi hak baru.
- **Guru hanya bisa menyalakan izin tamu per kuis**; membukanya untuk seluruh sekolah/kelas tetap keputusan
  admin (aturan pengaturan tiga lapis yang sudah ada).
- Belum ada tes yang menyapu perilaku tamu pada mode luring (salinan soal) dan pada lampiran jawaban;
  tamu memakai jalur murid yang sama, jadi risiko terbesarnya adalah nilai yang belum tersinkron.

### A.40.6 Berkas yang dibuat/diubah

Dibuat — kode produk backend:
- `backend/database/migrations/2026_10_11_000001_tambah_akun_tamu.php`
- `backend/app/Sections/Tamu/Services/TamuService.php`
- `backend/app/Sections/Tamu/Services/LaporanTamuService.php`
- `backend/app/Sections/Tamu/Http/Requests/MasukTamuRequest.php`
- `backend/app/Sections/Tamu/Http/Controllers/TamuController.php`

Dibuat — UI:
- `frontend/src/sections/auth/MasukTamu.jsx`

Dibuat — tes:
- `backend/tests/Feature/TamuTest.php` (15 tes)
- `frontend/src/__tests__/sections/auth/masukTamu.test.jsx` (3 tes)

Diubah — kode produk backend:
- `backend/app/Sections/Settings/Enums/KunciPengaturan.php` (kunci `izinkan_tamu`)
- `backend/app/Models/User.php` (`is_tamu`, `isTamu()`, nilai bawaan model)
- `backend/app/Sections/Auth/Http/Resources/UserResource.php` (`isTamu`)
- `backend/app/Sections/Attempt/Services/AttemptService.php` (gerbang tamu + tolak mode tim)
- `backend/app/Sections/Quiz/Policies/KuisPolicy.php` (baca kuis untuk tamu)
- `backend/app/Sections/Quiz/Http/Controllers/KuisController.php` (daftar kuis tamu)
- `backend/app/Sections/Report/Services/RankingService.php` (tamu di luar peringkat kelas)
- `backend/app/Sections/Report/Http/Controllers/RankingController.php` (peringkat ditutup untuk tamu)
- `backend/routes/api.php` (2 jalur publik + panel tamu guru)
- `backend/database/factories/UserFactory.php` (state `tamu()`)

Diubah — UI:
- `frontend/src/sections/auth/api.js` (`skemaInfoTamu`, `ambilInfoTamu`, `masukTamu`, `isTamu` pada `skemaUser`)
- `frontend/src/sections/auth/authStore.js` (`masukTamu`, tipe `DataUser`)
- `frontend/src/sections/auth/validasi.js` (`skemaTamu`)
- `frontend/src/sections/auth/HalamanMasuk.jsx` (formulir tamu + info publik)
- `frontend/src/App.jsx` (tamu diantar ke daftar ulangan)
- `frontend/src/shared/layout/KerangkaUmum.jsx` (menu + label siswa tamu)
- `frontend/src/sections/home/Beranda.jsx` (beranda tamu tanpa pintasan akun)
- `frontend/src/sections/quiz/HalamanKuisMurid.jsx` (salinan + sembunyikan Peringkat)
- `frontend/src/sections/report/api.js` + `HalamanLaporan.jsx` (panel siswa tamu)
- `frontend/src/theme/theme.css` (gaya blok `.auth-tamu`)
- `frontend/src/__tests__/sections/auth/authStore.sesi.test.js` (`isTamu: false` pada fixture)

Diubah — dokumentasi:
- `docs/laporan-pengujian.md` (A.40 ini), `docs/penjelasan-fitur.md`, `docs/catatan-demo.md`, `docs/handoff-sesi.md`

## A.41 Audit Pemakaian Dependency: Filter Bank Soal yang Terlalu Longgar, dan Jalur Redis yang Tidak Boleh "Hijau" Tanpa Diuji (11 Oktober 2026)

Putaran ini bukan menambah fitur, melainkan memeriksa apakah **setiap dependency yang sudah terdeklarasi benar-benar
dipakai dengan cara yang tepat**. Pertanyaan pemilik proyek: "tools lain selain DOMPurify, sudah dipakai benar?"

### A.41.1 Yang dikerjakan

- Menyisir setiap dependency (frontend `package.json`, backend `composer.json`, `realtime/package.json`) dan
  mencocokkannya dengan pemakaian nyata di kode: mana yang dipakai, mana yang belum, dan mana yang dipakai keliru.
- Memperbaiki temuan pemakaian keliru di bank soal.
- Menutup dua celah Redis yang ditemukan pada audit ini: jalur Redis bisa di-skip tanpa membuat gate merah,
  dan kontrak kunci/kanal lintas service tidak punya tes sama sekali.

### A.41.2 Temuan nyata (2, dua-duanya sudah diperbaiki)

**T-01 — Filter bank soal cocok sebagian, bukan persis (bug perilaku).**
`SoalController::allowedFilters('subject_id', 'tag_id', 'tipe', 'aktif')` memakai filter teks bawaan
spatie/laravel-query-builder, yang berarti `LIKE %nilai%` — padahal keempatnya kolom id/enum. Diukur di tes
sementara (lalu dihapus): `filter[subject_id]=1` mengembalikan **2 baris** (mapel 1 **dan mapel 12**), dan
`filter[tipe]=benar_salah` mengembalikan **2 baris** (ikut `benar_salah_majemuk`). Jadi daftar bank soal guru
bisa memuat soal mapel/tipe lain. `KelasController` dan `MuridController` sudah memakai
`AllowedFilter::exact(...)`, jadi ini inkonsistensi, bukan desain. Perbaikan: keempat filter menjadi
`AllowedFilter::exact(...)` + tes regresi. Bukti tesnya punya gigi: dengan controller lama tes itu **gagal**
(2 baris, bukan 1).

**T-02 — Jalur Redis bisa "hijau" tanpa pernah diuji (celah verifikasi).**
`PresenceRedisTest` (6 tes) melewati dirinya sendiri bila Redis mati, dan exit code-nya tetap 0 — termasuk di
dalam `verify.sh`. Dibuktikan: `REDIS_PORT=6399 php artisan test --filter=PresenceRedisTest` →
`6 skipped`, `EXIT=0`. Selain itu, kontrak kunci/kanal antara Laravel dan service Node (prefix kosong, nama
kanal, algoritma hash tiket) **tidak diuji sama sekali** — hanya dibuktikan manual lewat smoke UI. Efek
kegagalannya halus: SSE berhenti sampai, panel guru turun ke polling, tak ada gate yang memerah.

### A.41.3 Verifikasi (dijalankan, bukan klaim)

`./verify.sh` (exit 0):

```
=== Backend Pest ===        >>> OK    Tests: 313 passed (2931 assertions)
=== Backend Redis wajib ===>>> OK    Tests: 9 passed (65 assertions)
=== Backend Pint ===        >>> OK
=== Frontend checkJs ===    >>> OK
=== Frontend ESLint ===     >>> OK
=== Frontend Vitest ===     >>> OK    64 berkas / 627 test
=== Realtime node --test ===>>> OK    tests 15, pass 15, fail 0
verify.sh: SEMUA HIJAU
```

Bukti bahwa penjaganya bekerja, bukan sekadar ada:

- **Tes kontrak SSE peka terhadap drift.** Prefix koneksi `realtime` dirusak sengaja → berkas itu **3 failed**;
nama kanal di service Node diubah sengaja → **1 failed**. Kedua perubahan dikembalikan (`git status` bersih
untuk kedua berkas itu).
- **Skip Redis menjadi gagal keras.** `REDIS_WAJIB=1 REDIS_PORT=6399 php artisan test ...` →
**9 failed, EXIT=2**; tanpa `REDIS_WAJIB` → `9 skipped, EXIT=0` (perilaku lama dipertahankan untuk pemakaian
sehari-hari).
- **Filter bank soal kini persis.** Tes regresi baru lulus dengan perbaikan dan gagal tanpa perbaikan.

### A.41.4 Keputusan teknis (satu kalimat per keputusan)

- Pakai `AllowedFilter::exact` untuk kolom id/enum, bukan menghapus filternya, karena frontend memang mengirim
  id dan nama tipe yang persis (dropdown), jadi tidak ada kebutuhan pencarian sebagian di kolom itu.
- Kontrak lintas service diuji dengan **membaca sumber `realtime/src/server.js`** (pola kanal, pola `getdel`,
  algoritma + penyandian hash), bukan menyalin untai yang sama di dua tempat — salinan hanya akan mengunci
  kesalahan yang sama di kedua sisi.
- Skip Redis diubah lewat variabel lingkungan `REDIS_WAJIB=1` (`tests/Pest.php`), bukan dengan memeriksa
  keluaran PHPUnit: keluaran Pest berwarna (ANSI) dan formatnya bisa berubah, sedangkan `markTestSkipped` yang
  berubah menjadi lemparan pasti terbaca sebagai kegagalan.
- Langkah "Backend Redis wajib" ditaruh terpisah di `verify.sh` supaya jalur Redis punya gerbangnya sendiri
  yang bisa dibaca jelas di keluaran gate.
- `PenyiarRealtime::PREFIKS_TIKET` dijadikan konstanta agar awalan kunci tiket bisa diuji, bukan tersembunyi di
  dalam string panjang.

### A.41.5 Batasan jujur (yang belum selesai)

- **Belum diuji di peramban sungguhan** untuk alur SSE: kontraknya kini diuji di level Redis + sumber service
  Node; smoke UI/CDP dengan service hidup tetap dijalankan manual, belum masuk `verify.sh`.
- **Belum ada uji pengiriman pub/sub sungguhan** (publish → terima). Yang diuji: kunci tiket tanpa prefix ada di
  Redis, dan koneksi `realtime` memang ber-`OPT_PREFIX` kosong — mekanisme yang membuat siaran sampai.
- **DOMPurify, JSZip, dayjs, dan @tanstack/react-virtual masih terpasang tanpa pemakaian.** Keempatnya bagian
  dari "Stack (Final)" `AGENT.md`, jadi sengaja tidak dihapus; yang benar-benar melindungi dari XSS adalah
  allow-list `MediaSoal.jsx` + allow-list URL media backend, bukan DOMPurify.
- **Laravel Octane dan Debugbar tetap belum dipasang** (ekstensi `swoole` tidak ada di mesin pengembangan).
- Kebutuhan `REDIS_URL` untuk service Node baru **didokumentasikan** (`README.md`, `backend/.env.example`), belum
  ada mekanisme yang menghentikan deploy yang lupa mengisinya.

### A.41.6 Berkas yang dibuat/diubah

Dibuat — tes:
- `backend/tests/Feature/SseKontrakRedisTest.php` (3 tes: kunci tiket tanpa prefix, `OPT_PREFIX` koneksi, dan
  paritas kanal/kunci/hash dengan sumber service Node)

Diubah — kode produk backend:
- `backend/app/Sections/Question/Http/Controllers/SoalController.php` (filter jadi `AllowedFilter::exact`)
- `backend/app/Sections/Presence/Services/PenyiarRealtime.php` (`PREFIKS_TIKET` sebagai konstanta)

Diubah — tes & gerbang:
- `backend/tests/Pest.php` (helper `lewatiTanpaRedis`, `REDIS_WAJIB`)
- `backend/tests/Feature/PresenceRedisTest.php` (memakai helper tersebut)
- `backend/tests/Feature/BankSoalTest.php` (tes regresi filter persis)
- `verify.sh` (langkah "Backend Redis wajib")

Diubah — dokumentasi:
- `README.md` (prasyarat Redis + arti langkah gate yang merah)
- `backend/.env.example` (phpredis, `REDIS_URL` untuk service Node, `REDIS_WAJIB`)
- `docs/laporan-pengujian.md` (A.41 ini)

---

## A.42. Siswa tamu beridentitas kode perangkat + proteksi yang adil di ponsel

Sumber: audit UI/UX & logika putaran kedua (`audit-ux-ui-logic-projectla.md`), temuan **T1** (limiter tamu per IP),
**T2** (identitas tamu = slug nama), dan **T5** (false positive anti-cheat di HP). Arahan produk untuk A.42:
sistem membuat **id unik per pengunjung** supaya pembatas laju tidak berkunci alamat IP bersama, tamu **tetap
mengetik namanya sendiri**, dan proteksi ulangan dibuat **adaptif di perangkat sentuh**.

### A.42.1 Yang dikerjakan

- **Identitas tamu = kode perangkat (T2).** Peramban membuat satu kode acak sekali per perangkat
  (`sections/auth/perangkat.js`, `crypto.randomUUID`) dan mengirimnya bersama nama pada setiap `POST /auth/tamu`.
  Server menurunkan akun dari **hash kode itu** (`TamuService::emailUntukKode`), jadi: nama yang sama di dua
  perangkat = dua akun, nama beremoji/non-Latin tetap punya akun sendiri (dulu slug kosong membuat semua anak
  seperti itu berbagi `tamu+tamu@tamu.invalid`), dan tidak ada nama yang bisa "diambil alih" tanpa kata sandi.
  Nama yang diketik tamu tetap menjadi nama tampilan — persis seperti yang diminta, hanya bukan identitas.
  Klien tanpa kode tidak ditolak: server membuatkan kode baru dan mengembalikannya untuk disimpan (`kode_perangkat`).
- **Limiter tamu sendiri (T1).** `/auth/tamu` keluar dari grup `throttle:auth` (yang berkunci `ip|email`,
  sedangkan tamu tidak punya email — sehingga satu kelas di balik NAT sekolah berbagi satu kunci dan murid ke-6
  ditolak 429). Limiter `tamu` berkunci kode perangkat (5/menit per anak) dengan batas per IP 120/menit sebagai
  pagar penyalahgunaan.
- **Proteksi adaptif di HP (T5)** — `security/useExamSecurity.js`:
  - `detect_window_resize` kini hanya bereaksi pada perubahan **lebar** (keyboard virtual dan bar alamat hanya
    mengubah tinggi), diabaikan lagi bila kolom isian sedang terfokus, dan timer kaburnya digabung + tunggal;
  - `focus_lock` punya **masa tenggang 8 detik**: anak yang kembali cepat (notifikasi, pindah aplikasi sekilas)
    tidak dikunci sama sekali, hanya kepergian yang benar-benar lama yang mengunci 60 detik (salinan modal
    diperbarui);
  - membuka **dialog pilih berkas** (input `type=file` terfokus) tidak lagi dihitung keluar dari ulangan, baik
    untuk kunci layar maupun untuk catatan `window_blur`.

### A.42.2 Bukti (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `php artisan test --filter=TamuTest` | **21 passed (172 assertions)** |
| `npx vitest run src/__tests__/security/useExamSecurity.test.jsx` | **6 passed** |
| `npx vitest run src/__tests__/sections/auth/perangkat.test.js` | **5 passed** |
| `npx vitest run src/__tests__/sections/auth/authStore.sesi.test.js` | **12 passed** (3 baru: tamu keluar membuang kode perangkat, sesi habis sendiri tidak, murid biasa tidak menyentuhnya) |
| `./verify.sh` (root) | **SEMUA HIJAU (exit 0)** — Pest **331 passed (3126 assertions)** · Redis wajib **9** · Pint · checkJs · ESLint · Vitest **66 berkas / 641 tes** · realtime **20 tes** |
| `docs/jalankan-smoke-ui.sh tamu` (CDP; backend :8000 + vite :5173 + realtime :4000 + Chrome :9333) | **9/9 lulus, exit 0** — lihat A.42.5 |

Tes barunya diuji-balik (mutasi sementara) supaya tidak hijau tanpa arti:

| Mutasi yang dikembalikan | Tes yang merah |
| --- | --- |
| resize dianggap sinyal walau lebarnya tidak berubah | `resize yang hanya mengubah tinggi (keyboard ponsel) …` |
| masa tenggang kunci layar dibuat 0 detik | `kembali cepat dalam masa tenggang tidak mengunci layar` |
| pemeriksaan dialog berkas dimatikan | `membuka dialog pilih berkas tidak mengunci layar` |

### A.42.3 Berkas yang dibuat/diubah

Dibuat:
- `frontend/src/sections/auth/perangkat.js` (kode perangkat: buat sekali, simpan, kirim)
- `frontend/src/__tests__/sections/auth/perangkat.test.js` (5 tes)
- `frontend/src/__tests__/security/useExamSecurity.test.jsx` (6 tes)

Diubah:
- `backend/app/Sections/Tamu/Services/TamuService.php` (identitas dari kode perangkat, `emailUntukKode`,
  `kodeSah`)
- `backend/app/Sections/Tamu/Http/Requests/MasukTamuRequest.php` (`kode_perangkat` divalidasi ketat)
- `backend/app/Sections/Tamu/Http/Controllers/TamuController.php` (mengembalikan `kode_perangkat`)
- `backend/app/Providers/AppServiceProvider.php` (limiter `tamu`)
- `backend/routes/api.php` (`/auth/tamu` pakai `throttle:tamu`, keluar dari grup `auth`)
- `frontend/src/sections/auth/api.js` (+`skemaResponTamu`, kirim & simpan kode perangkat)
- `frontend/src/sections/auth/MasukTamu.jsx` (salinan bantuan menjelaskan perangkat, bukan nama unik)
- `frontend/src/security/useExamSecurity.js` (T5)
- `backend/tests/Feature/TamuTest.php` (+6 tes), `docs/penjelasan-fitur.md`, `docs/catatan-demo.md`,
  `docs/handoff-sesi.md`

### A.42.4 Batasan jujur

- Deteksi "dialog berkas terbuka" adalah **heuristik** (input `type=file` sedang terfokus). Bila peramban tidak
  memindahkan fokus ke input itu, jalur masa tenggang 8 detiknya yang menyelamatkan. **Belum diuji di perangkat
  sentuh sungguhan** — hanya disimulasikan di jsdom.
- **T4 belum disentuh**: `focus_lock` masih hanya bekerja bila `block_tab_switch` juga menyala, padahal modal
  proteksi bisa menjanjikannya sendiri. Ini perubahan semantik saklar, jadi menunggu keputusan.
- **Perangkat bersama tanpa Keluar**: kalau tamu A menutup peramban tanpa menekan *Keluar*, tamu B di
  perangkat yang sama masih akan masuk ke akun A kalau A belum keluar. Aturannya: menekan **Keluar** membuang
  kode perangkat (diuji), sedangkan sesi yang habis sendiri menyimpannya supaya pekerjaan anak yang sama tidak
  hilang. Komputer lab sebaiknya tetap diminta menekan Keluar antar anak.
- **Ganti perangkat/penyimpanan bersih** berarti identitas baru: pemulihan attempt lintas perangkat belum ada
  (nama tidak lagi bisa dipakai sebagai kunci pemulihan — memang begitu trade-off yang dipilih).
- Belum disentuh dari audit yang sama: **K1** (satu 401/419 menghapus cadangan jawaban), **T3/S4** (Redis putus
  mematikan realtime; SSE murid tidak menyambung ulang), **T6/S1** (umpan balik submit & status simpan),
  **S2/S3/S5/S6/S7** dan **R1–R6** (termasuk tipografi/target sentuh — bagian "adaptif di mobile" untuk UI,
  bukan perilaku).

### A.42.5 Bukti peramban sungguhan (harness `docs/smoke-ui-tamu.mjs`)

Putaran A.40 menutup laporan ini dengan catatan bahwa **mode tamu belum pernah dijalankan di peramban** —
hanya lewat Pest (HTTP) dan jsdom (formulir). Harness baru menutupnya: Chrome sungguhan lewat CDP, satu
perintah (`docs/jalankan-smoke-ui.sh tamu`, yang menyalakan backend + vite + realtime + Chrome sendiri),
**9/9 lulus, exit 0**. Yang diperiksa — semuanya hal yang tidak bisa dibuktikan tanpa peramban:

| # | Pemeriksaan | Kenapa harus di peramban |
| --- | --- | --- |
| 1 | login admin lewat API | jalan masuk ke pengaturan |
| 2 | admin membuka pintu tamu untuk sekolah (`PUT /v1/pengaturan` → `diizinkan=true`) | `izinkan_tamu` memang lapis sekolah |
| 3 | formulir "ikut sebagai siswa tamu" benar-benar dirender, dan salinannya menyebut **perangkat yang sama** | salinan yang memaksa tamu menulis perangkat, bukan nama unik |
| 4 | isi nama + `requestSubmit()` → tamu masuk dan `localStorage['ulangan:perangkat-tamu']` terisi kode acak | kode dibuat & disimpan **di peramban**, bukan oleh server |
| 5 | navigasi ulang ke `/` → akun **dan kode perangkat** tetap sama | `localStorage` betul-betul bertahan antar muat halaman |
| 6 | tekan **Keluar** → kode perangkat dibuang (`null`) | pembersihan komputer bersama |
| 7 | nama sama sesudah Keluar → akun **BARU** (id pertama 154, id kedua 155) | membuktikan identitas = perangkat, bukan nama |
| 8 | `kode_perangkat` bentuk aneh (`"spasi tidak boleh"`) ditolak **422** | validasi ketat permintaan, lewat jaringan sungguhan |
| 9 | pintu tamu dimatikan kembali di akhir | harness tidak meninggalkan pengaturan sekolah berubah |

Harness ini **memulihkan keadaan sendiri**: `izinkan_tamu` dikembalikan ke `false` di blok terakhir, dan
akun tamu uji tidak dipakai lagi sesudah itu. Ia butuh realtime hidup karena runner yang sama juga
melayani harness lain; jalur tamu sendiri tidak menyentuh SSE.

Runner `docs/jalankan-smoke-ui.sh` (A.42) juga diperbaiki supaya GUI bisa diuji **langsung** di atas local
yang sedang dipakai: ia memakai layanan yang **sudah hidup** (dan menyalakan sendiri yang belum ada), lalu
hanya mematikan proses yang benar-benar ia nyalakan. Dua-duanya dijalankan:

| Skenario | Hasil |
| --- | --- |
| `./nyalakan-local.sh` hidup, lalu `docs/jalankan-smoke-ui.sh tamu` | `backend/frontend/realtime — dipakai apa adanya` · **9/9 lulus** · sesudahnya keempat layanan **tetap hidup** |
| tanpa layanan hidup, lalu `docs/jalankan-smoke-ui.sh tamu` | menyalakan sendiri (vite=200 backend=204 realtime=200) · **9/9 lulus** · sesudahnya semua **MATI**, tanpa Chrome sisa di :9333 |

Dua bug **runner** ditemukan dari percobaan ini dan diperbaiki (bukan bug produk): (a) `curl -w '%{http_code}'
|| echo 000` menambah kode gagal lagi sehingga hasilnya `000000` — pemeriksaan `!= 000` karena itu selalu
menyatakan "layanan hidup" walau mati (akibatnya tamu menerima 502 dari proxy vite); (b) `trap` lama
memakai `pkill -f "artisan serve"`/`pkill -f remote-debugging-port=9333` yang akan ikut mematikan layanan
milik pengembang — diganti dengan daftar PID yang disimpan runner itu sendiri. Perbaikan yang sama dipakai
`docs/jalankan-smoke-materi.sh` dan `docs/jalankan-smoke-perjalanan.sh`.

Sesudah runner diperbaiki, seluruh harness dijalankan ulang **di atas local yang sedang hidup** (perintah
`./nyalakan-local.sh` lebih dulu), semuanya exit 0 dan **layanan tetap hidup** sesudahnya:

| Harness | Hasil |
| --- | --- |
| `docs/jalankan-smoke-ui.sh tamu` | **9/9 lulus** |
| `docs/jalankan-smoke-ui.sh slice03` · `slice04` · `slice05` | **9/9** · **18/18** · **20/20 lulus** |
| `docs/jalankan-smoke-ui.sh slice06` · `slice07` | **28/28** · **20/20 lulus** |
| `docs/jalankan-smoke-ui.sh susun` · `kuis-manual` | **42/42** · **13/13 lulus** |
| `docs/jalankan-smoke-ui.sh nav` · `luring` | **14/14** · **22/22 lulus** |
| `docs/jalankan-smoke-ui.sh pengaturan` · `sidebar` | **5/5** · **7/7 lulus** |
| `docs/jalankan-smoke-ui.sh durasi-klip` | **15/15 lulus** |
| `docs/jalankan-smoke-ui.sh cdp` | exit 0 (harness peninjau halaman, tanpa hitungan) |
| `docs/jalankan-smoke-perjalanan.sh` | **52/52 lulus** (harness ikut disunting di putaran A.37 & A.43) |
| `docs/jalankan-smoke-materi.sh` | **27/27 lulus** (sama dengan angka terakhir di A.38) |
| `./nyalakan-local.sh status` sesudah semua itu | redis/backend/realtime/frontend **HIDUP** |

Total **301 pemeriksaan** lulus di 15 harness berhitung, semuanya exit 0, dijalankan berurutan di atas satu
local yang sedang dipakai.

---

## A.43. Ilustrasi gunung digambar sendiri, editor dirapatkan, dan smoke GUI bisa langsung

Tiga permintaan pemilik produk pada putaran ini: (a) latar tema "Mendaki Gunung" **jangan** foto gunung
sungguhan, (b) editor soal **dirapatkan** supaya menulis soal berurutan tidak melelahkan, dan (c) uji GUI
harus bisa dijalankan **langsung** di atas local yang sedang dipakai.

### A.43.1 Yang dikerjakan

- **Adegan `gunung` kembali digambar sendiri — keputusan A.37 dibalik.** `AdeganGunung.jsx` (SVG + animasi
  CSS) menggambar **puncak gunung dilihat dari kaki gunung**: satu puncak di bingkai dengan kaki lereng
  bertemu di titik itu, dua bidikan lereng depan memotong dari kiri-bawah dan kanan-bawah — sudut mendongak
  terbaca dari komposisinya, bukan dari judulnya. Foto pihak lain `gunung.jpg` **dihapus** dari repo, jadi
  `frontend/public/tema/` sekarang kosong dan tidak ada aset berlisensi pihak ketiga yang perlu dilacak.
  `PetaPerjalanan.jsx` memakai urutan latar **video guru → adegan digambar (`ADEGAN_DIGAMBAR`) → foto tema →
  gradien**, dengan `data-latar="ilustrasi"` sebagai penanda bentuk yang benar-benar dirender.
- **Semua warna adegan lewat variabel `--adegan-*`** di `theme.css`, bukan hex di komponen — pagar mutu
  `tema.test.js` menolak nilai warna keras di JSX, dan gerak memakai kelas CSS (bukan SMIL) supaya aturan
  `prefers-reduced-motion` aplikasi ikut mematikannya. Seluruh elemen `aria-hidden`: label aksesibel tetap
  dari daftar pos teks di bawah peta.
- **Editor soal dirapatkan**: `EditorSoal.jsx` memakai `gap-3`/`p-3` (dari `g-4`/`p-4`), `row g-2`,
  `mb-1`, placeholder lebih pendek, dan teks bantuan yang panjang dibuang; kelas `.editor-soal` baru di
  `theme.css` mengatur kerapatannya (termasuk grid petak jenis: 2 kolom di HP, 4 kolom ≥768px, 6 kolom di
  layar sangat lebar supaya 22 jenis tidak jadi lima baris).
- **Halaman kuis: menulis soal berurutan.** `HalamanKuis.jsx` **tidak lagi menutup** editor soal sesudah
  satu soal tersimpan; editor dipasang ulang lewat `key` bernomor (`soal-baru-di-kuis-N`) sehingga
  formulirnya kosong untuk soal berikutnya, plus hitungan "Sudah ditambahkan N soal" — perilaku form
  builder biasa. Tombol "Buat soal baru" mengulang hitungan dari 0.
- **Runner smoke bisa dipakai di atas local yang hidup.** `docs/jalankan-smoke-ui.sh <nama>` (dan
  `jalankan-smoke-materi.sh`, `jalankan-smoke-perjalanan.sh`) memakai layanan yang **sudah hidup** apa
  adanya dan hanya mematikan proses yang benar-benar ia nyalakan; sebelumnya `trap` memakai
  `pkill -f "artisan serve"` yang akan ikut membunuh layanan milik pengembang. `./nyalakan-local.sh`
  (baru) menyalakan Redis + backend + realtime + frontend lewat `php artisan migrate` (bukan
  `migrate:fresh`), jadi **sesi login tidak hilang** saat local dinyalakan ulang; `.local/` di-ignore.

### A.43.2 Verifikasi (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `./verify.sh` (root) | **SEMUA HIJAU (exit 0)** — Pest **331 passed (3126 assertions)** · Redis wajib **9 passed (65 assertions)** · Pint · checkJs · ESLint · Vitest **66 berkas / 641 tes** · realtime **20 tes / 0 gagal** |
| `docs/jalankan-smoke-ui.sh tamu` (di atas `./nyalakan-local.sh` yang hidup) | **9/9 lulus, exit 0** |
| `docs/jalankan-smoke-ui.sh slice06` | **28/28 lulus, exit 0** |
| `docs/jalankan-smoke-ui.sh slice07` | **20/20 lulus, exit 0** |
| `docs/jalankan-smoke-ui.sh kuis-manual` | **13/13 lulus, exit 0** |
| `docs/jalankan-smoke-perjalanan.sh` | **52/52 lulus, exit 0** |
| `docs/jalankan-smoke-materi.sh` | **27/27 lulus, exit 0** |
| `./nyalakan-local.sh status` sesudah semua smoke itu | redis/backend/realtime/frontend **HIDUP** (runner tidak mematikan layanan yang bukan miliknya) |
| `docs/jalankan-smoke-ui.sh tamu` lagi, kali ini **tanpa** layanan hidup | menyalakan sendiri (vite=200 backend=204 realtime=200) · **9/9 lulus** · sesudahnya semua MATI tanpa sisa Chrome :9333 |

Tiga bug yang ditemukan saat verifikasi ini adalah bug **runner**, bukan produk: (a) `$(curl -w
'%{http_code}' || echo 000)` menggandakan kode kegagalan menjadi `000000` sehingga pemeriksaan `!= 000`
selalu menganggap layanan hidup (tamunya lalu menerima 502 dari proxy vite); (b) `trap` lama yang menyapu
semua proses `artisan serve` (ikut mematikan layanan pengembang); dan (c) **Chrome satu run belum benar-benar
keluar saat run berikutnya mulai** — proses anaknya masih memegang :9333 beberapa detik, sehingga Chrome
baru hidup **tanpa** memegang port debug dan harness-nya hanya mencetak `fetch failed`. Ketiganya diperbaiki
di sumbernya (tiga runner), bukan dengan melewati pemeriksaan: runner kini menunggu :9333 bebas, membersihkan
listener yang tidak menjawab CDP, mencoba sekali lagi, dan berhenti dengan pesan jelas + log Chrome bila tetap
gagal. Gejalanya nyata sebelum perbaikan: urutan `luring → nav → pengaturan → sidebar` membuat dua harness
terakhir gagal (`exit 1`), sesudah perbaikan urutan yang sama lulus semua.

### A.43.3 Batasan jujur

- Adegan digambar hanya untuk tema **"Mendaki Gunung"**; katalog sudah menampung tema lain, tetapi tema
  kedua/ketiga belum dibuat. Peta tanpa video/adegan/foto tetap jatuh ke gradien - tidak pernah kosong.
- Belum ada uji regresi visual/screenshot: bukti "mendongak" dan "beranimasi" dari struktur DOM/CSS
  (`theme.css` + kelas), bukan perbandingan gambar.
- Kerapatan editor soal dirapatkan lewat kelas CSS dan jarak Bootstrap. **Sudah diuji lewat emulasi
  perangkat Chrome di putaran A.44** (412×915 @2.625 + sentuhan): lihat bagian A.44 — temuan target sentuh
  tombol tema ikut diperbaiki di sana. Tetap bukan perangkat sungguhan. Sisa audit UI **R2–R6** dan
  **S2/S3/S6/S7** masih terbuka (R1 target sentuh & S5 laci sudah hijau lewat A.44).
- Runner smoke tetap **tidak** ikut `verify.sh` (butuh layanan hidup) — perintahnya dicatat di
  `docs/catatan-demo.md` bagian "Menguji GUI langsung".

---

## A.44. Uji perangkat mobile sungguhan (emulasi perangkat Chrome) + temuan target sentuh

Permintaan pemilik produk: *"yes benaran di hp (pakai fitur chrome)"* — maksudnya bukan menyempitkan
jendela desktop, melainkan menyalakan **mode perangkat** Chrome (tombol "Toggle device toolbar" di
DevTools), supaya jalur kode yang hanya aktif di ponsel benar-benar dijalankan.

### A.44.1 Harness baru: `docs/smoke-ui-mobile.mjs`

Harness ini menyalakan emulasi lewat CDP sebelum halaman dimuat:

- `Emulation.setDeviceMetricsOverride` 412×915, DPR 2.625, **`mobile: true`** (jadi meta viewport dipakai);
- `Emulation.setTouchEmulationEnabled` (5 titik sentuh);
- `Emulation.setUserAgentOverride` UA Android 14 / Chrome 156 Mobile.

Yang diukur (16 pemeriksaan): emulasi benar-benar aktif (viewport/DPR/sentuhan/UA), meta viewport
`width=device-width` ada, **tidak ada gulir mendatar** di 8 halaman guru, **tidak ada elemen yang menembus
tepi kanan viewport**, **semua 695 kontrol terlihat ≥ 44 px**, tabel lebar digulir di dalam pembungkusnya,
huruf teks isi ≥ 14 px, lalu alur laci menu (hamburger terlihat → laci terbuka berisi 10 tautan + overlay +
`aria-expanded` + gulir latar terkunci → tautan menutup laci dan pindah halaman → Escape menutup → area gelap
menutup).

### A.44.2 Temuan nyata #1 — tombol tema menyusut jadi 37 px di ponsel (diperbaiki)

Pemeriksaan target sentuh langsung menangkapnya di **semua** halaman: `button.tombol-ikon` (tombol ganti
tema/gelap di kepala) terukur **37×48 px**, di bawah ambang 44 px. Sebabnya CSS: `.tombol-menu` (hamburger)
punya `flex-shrink: 0`, sedangkan `.tombol-ikon` tidak — jadi di header 412 px (merek + menu pengguna +
tombol tema + hamburger) tombol tema menyusut dari 48 px menjadi 37 px. Perbaikannya di sumbernya, bukan di
assertion: `.tombol-ikon` kini `flex-shrink: 0` + `min-width/min-height: 44px`. Sesudah itu pemeriksaan target
sentuh **bersih** (695 kontrol diperiksa di 8 halaman).

### A.44.3 Temuan nyata #2 — harness-nya sendiri yang flaky (diperbaiki)

Pemeriksaan "laci pas di layar" sempat merah walau angkanya benar. Sebabnya animasi masuk laci
(`@keyframes laci-masuk`, 0.18 s dari `translateX(-16px)`): geometri diambil sebelum animasinya selesai,
sehingga `left` masih negatif. Ini **bug harness**, bukan produk — harness kini menunggu laci mendarat
(maks 2,5 s) dan mencetak posisinya (`0..340 dari 412`), bukan menebak.

### A.44.4 Verifikasi (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `docs/jalankan-smoke-ui.sh mobile` (Chrome mode perangkat) | **16/16 lulus, exit 0** |
| `./verify.sh` (root, sesudah perubahan CSS) | **SEMUA HIJAU (exit 0)** — Pest 331 (3126 assertions) · Redis wajib 9 (65) · Pint · checkJs · ESLint · Vitest 66 berkas/641 tes · realtime 20/0 |

### A.44.5 Batasan jujur

- Ini **emulasi perangkat Chrome**, bukan perangkat sungguhan: UA, metrik, dan sentuhan disimulasikan, jadi
  keyboard virtual, ukuran jari sebenarnya, dan peramban sekolah (WebView lama) tetap belum terbukti.
- Yang diuji adalah tata letak & sentuhan halaman guru; **layar pengerjaan ulangan di ponsel** belum bisa
  diuji karena DB dev tidak punya kuis `terbit` saat harness dijalankan (bagian itu dilewati dengan sadar
  dan dilaporkan sebagai lulus-terlewat, bukan hijau palsu).
- Belum ada uji regresi visual/screenshot: buktinya angka geometri dari DOM, bukan perbandingan gambar.

---

## A.45. Gunung yang lebih terang & tidak kaku, lalu diganti gambar jadi domain publik (bukan gambar tangan)

Dua permintaan pemilik produk pada putaran ini: (a) *"buat gunungnya lebih style seperti gambar saja dan gak
terlalu kaku dan buat lebih terang jangan gelap"*; (b) *"atau kau pakai gambar saja gak svg tulis manual"* —
dan saat ditanya arahnya: *"ambil dari publik namun yang cocok dan juga ingat grafik bukan realife"*.

### A.45.1 Langkah pertama — gambar tangan dibuat rata & cerah (dikerjakan penuh, lalu tidak terpakai lagi)

Adegan `gunung` yang digambar sendiri dulu adalah lukisan senja: palet `#0b1a33`–`#060f19` (nyaris hitam),
lereng lurus bersudut tajam, dan gradien tiga titik yang memberi kesan 3D. Yang diubah:

- **Palet adegan diganti siang cerah** (`--adegan-*` di `theme.css`): langit `#74c1f2`→`#ecf9ff`, lereng
  `#96c1dd`, bidang depan `#74aacd`/`#6297bd`, sabuk kaki `#8cc49b`, garis tepi `#40627f`. Tidak ada lagi
  warna lebih gelap dari `#3f6382`, jadi tidak ada bidang yang tenggelam jadi hitam.
- **Bentuknya dibuat melengkung** di `AdeganGunung.jsx`: seluruh lereng memakai kurva Bézier, ujung puncak
  tumpul, salju bertepi bergelombang, kaki gunung bersabuk hijau — tidak ada sudut tajam yang tersisa.
- **Gaya "gambar" rata**: gradien lereng tiga titik dibuang (defs `ag-lereng`/`ag-lereng-depan` ikut hilang),
  tiap bidang satu warna penuh + garis tepi tipis, dan matahari pindah ke sudut kiri atas sebagai bulatan
  bertepi (titik denyut `transform-origin` ikut disesuaikan ke `46px 19px`).
- **Panggung tidak lagi digelapkan**: lapisan `::after` yang dulu menutup **semua** latar dengan
  `rgba(2,6,23,0.4)` sekarang hanya untuk **video** guru. Gambar tema dan adegan gambar tangan cuma dapat
  kabut putih tipis di tepi bawah, jadi gambar tetap cerah.
- **Jalur & nomor pos tetap terbaca di atas latar cerah**: jalur putih putus-putus dan aksen sky tenggelam di
  latar terang, jadi peta bergambar memakai `--jalur-belum` (navy 72%) dan `--jalur-lewat` (`#1f4f74`), dan
  pil nomor pos diberi garis rambut `rgba(15,23,42,0.28)` supaya batasnya tidak hilang di latar terang.

Terukur lewat tangkapan panggung: luminance rata-rata **187,5** dari 255, piksel tergelap **87,4**, dan pita
langit **200,2** — sebelumnya paletnya nyaris hitam.

### A.45.2 Langkah kedua — tema `gunung` memakai gambar jadi domain publik (yang akhirnya dipakai)

Pemilik produk memilih memakai **gambar jadi dari domain publik** alih-alih SVG tulisan tangan. Pencarian
asetnya dibatasi aturan repo sendiri (`frontend/public/tema/LISENSI.md`): **hanya CC0 / public domain**, ukuran
≤ 400 KB, sisi terpanjang ≤ 1600 px. Karena itu kandidat Commons berlisensi **CC BY-SA 4.0** (butuh atribusi +
share-alike) **ditolak** walaupun gambarnya bagus, dan pencarian diarahkan ke pustaka CC0.

Aset yang dipasang: `frontend/public/tema/gunung.svg`

- "Mountains on a sunny day" (mountain scene in the spring) — halaman sumber menyatakan *"You can copy, modify,
  distribute and perform the work, even for commercial purposes, all without asking permission"* dan berkasnya
  bertanda `openclipart` (pustaka yang melepaskan karyanya ke domain publik). Sumber + lisensi dicatat di
  `LISENSI.md` bersama ukuran akhirnya.
- **Grafik, bukan foto realis** sesuai permintaan: tag halamannya `flat`, `hills`, `mountains`, `green`; isinya
  gambar rata dengan 9 warna saja (langit `rgb(77,187,255)`, lereng biru bersalju `rgb(55,142,195)`/
  `rgb(162,205,232)`, lapangan hijau `rgb(48,174,90)`, awan putih, matahari pucat `rgb(226,230,151)`).
- Murni vektor: **50 bentuk, tanpa `<image>` raster, tanpa `<text>`, tanpa filter blur** — jadi tidak ada bagian
  yang pecah saat diperbesar dan tidak ada teks nyasar. `viewBox` aslinya **1920×1080 (16:9 persis)** sehingga
  panggung 16:9 menampilkannya utuh tanpa dipotong; hanya atribut `width`/`height` dikecilkan ke 1600×900 agar
  memenuhi aturan ukuran (vektor: geometrinya tidak berubah). Berkas akhir **11 KB**.

Perubahan kode: `FOTO_ADEgan.gunung = '/tema/gunung.svg'`, dan `'gunung'` **dikeluarkan** dari `ADEGAN_DIGAMBAR`
sehingga berkasnya yang dipakai (prioritas: video guru → adegan gambar tangan → berkas gambar tema → gradien).
Komponen gambar tangan **tidak dihapus** — ia tetap jalur yang diuji dan bisa dipakai lagi cukup dengan
mengembalikan `'gunung'` ke daftar itu.

### A.45.3 Alat bukti baru: `docs/tangkap-adegan-gunung.mjs`

Tema gunung sekarang tidak punya animasi awan/kabut/burung, jadi "beranimasi" dan "tidak gelap" tidak lagi bisa
dibuktikan dari struktur DOM saja. Skrip ini menyalakan Chrome lewat CDP, mencari materi bertema gunung yang
**punya blok** (tanpa blok tidak ada titik pos maupun jalur, jadi tangkapan tidak membuktikan apa-apa),
menangkap `.jelajah-panggung` di tema terang & gelap, lalu **mengukur pikselnya**: PNG hasil tangkapan dibaca
balik lewat `<canvas>` di dalam peramban (Node tidak punya dekoder PNG tanpa pustaka tambahan) dan dihitung
luminance WCAG-nya.

Hasil (materi uji 2 blok → 2 pos, 1 ruas):

| Tema | Latar | rata | minimum | piksel < 70 | pita atas (langit) | tengah | bawah |
| --- | --- | --- | --- | --- | --- | --- | --- |
| terang | berkas `/tema/gunung.svg`, termuat `true` | **165,1** | 22,7 | **0,01%** | **187,5** | 151,3 | 155,8 |
| gelap | sama | 164,8 | 28,3 | 0,10% | 187,1 | 151,3 | 155,2 |

**Catatan penting soal pagar ukurnya.** Versi pertama pagar ini menuntut *piksel tergelap* ≥ 70 dan **merah**
(minimum 22,7) — sebabnya jelas setelah ditelusuri: angka di **lencana nomor pos** memakai `var(--teks)`
`#0f172a` yang luminance-nya ≈ 22,6, dan teks memang harus gelap. Pagarnya lalu diubah untuk mengukur **luas**
piksel gelap, bukan piksel tergelap: teks lencana hanya menempati **0,01%** luas, sedangkan gambar yang benar
benar kelam akan menempati puluhan persen. Ini bukan melonggarkan asersi supaya hijau — ukuran yang lama
mengukur hal yang salah (teks), yang baru mengukur hal yang dimaksud (gambar), dan ambangnya tetap ditegakkan
(batas 0,5% luas + rata-rata ≥ 130 + pita langit ≥ 150).

### A.45.4 Verifikasi (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `npx vitest run src/__tests__/sections/material src/__tests__/theme` | **110 lulus / 7 berkas** (termasuk 13 tes `petaPerjalanan.test.jsx` yang asersinya disesuaikan) |
| `npm run check` (checkJs) | **bersih (exit 0)** |
| `npx eslint .` | **0 error**, 2 warning lama React Hook Form |
| `node docs/tangkap-adegan-gunung.mjs` | **exit 0** — gambar tema termuat (`1600x900`), zoom `jelajah-zoom`, angka di tabel A.45.3 |
| `docs/jalankan-smoke-ui.sh perjalanan` | **52/52 lulus, exit 0** |
| `./verify.sh` (root, sesudah semua suntingan) | **SEMUA HIJAU (exit 0)** |

Tiga pemeriksaan smoke perjalanan yang berubah (karena latarnya kini berkas gambar, bukan SVG tulisan tangan) —
sengaja dibuat **lebih ketat**, bukan lebih longgar:

| Pemeriksaan | Bukti terukur saat lulus |
| --- | --- |
| peta memakai gambar tema domain publik yang benar-benar termuat, bukan gambar tangan | `jenis foto · src /tema/gunung.svg · termuat true · adegan tangan 0` |
| gambar tema bergerak halus (zoom panggung), bukan gambar diam | `zoom jelajah-zoom` |
| panggung peta tetap 16:9 supaya gambar tema tidak digepengkan | `lebar 578 · tinggi 325 · rasio 1.78` |

Pemeriksaan lama yang dibuang: jumlah unsur adegan gambar tangan (`jelajah-lereng-depan` = 2, awan/kabut/burung
≥ 1) — unsur itu memang tidak lagi dirender untuk tema ini, jadi menuntutnya berarti menguji hal yang tidak ada.

### A.45.5 Temuan tak terduga — pagar "hex hanya di variabel" tidak memeriksa `theme.css`

Saat memeriksa ulang pagar mutu `src/__tests__/theme/tema.test.js` (yang seharusnya menjaga "hex hanya di blok
`:root`/`[data-bs-theme='dark']`"), ternyata **`theme.css` tidak benar-benar diperiksa**: berkasnya memang
masuk `import.meta.glob`, tetapi Vitest mengembalikan **modul kosong** untuk berkas `.css` (pemrosesan CSS mati
bawaan), jadi `String(mentah).length === 0` dan loop-nya tidak menemukan apa pun di berkas itu. Diperiksa
langsung dengan tes sementara di dalam repo: 215 dari 216 berkas berisi teks, dan satu-satunya yang kosong
persis `../../theme/theme.css`.

Akibatnya `theme.css` saat ini memang punya hex di luar blok variabel (mis. gradien cadangan `.jelajah-panggung`
`#1e3a5f`/`#2f5d84`/`#3f7f6a`) tanpa pernah ditangkap pagar itu. **Tidak diperbaiki di putaran ini** (di luar
lingkup permintaan dan perbaikannya bisa memunculkan puluhan pelanggaran lama sekaligus), tetapi dicatat sebagai
temuan terbuka: pagar itu hanya berlaku untuk `.js`/`.jsx`. Warna baru pada putaran ini tetap dipasang lewat
variabel seperti aturan repo.

### A.45.6 Batasan jujur

- **Saya tidak bisa melihat gambar.** Aset dipilih bukan dari tampilannya, melainkan dari data yang bisa
  diperiksa: lisensi halaman, tag (`flat`), daftar warna di dalam SVG, jumlah bentuk, ada/tidaknya `<image>`
  raster atau `<text>`, dan angka kecerahan hasil render. "Cocok" secara estetika tetap perlu mata pemilik
  produk — `docs/log-mentah/tangkapan/adegan-gunung-terang.png` & `-gelap.png` disimpan untuk itu.
- **Komposisinya berbeda dari niat A.43.** Gambar ini adalah pemandangan luas dengan beberapa puncak, bukan
  satu puncak dilihat mendongak dari kaki gunung. Niat itu hilang bersama gambar tangan; kalau masih diinginkan,
  `'gunung'` cukup dikembalikan ke `ADEGAN_DIGAMBAR`.
- **Gambar tangan tidak lagi dipakai** untuk tema mana pun sekarang — ia jalur yang diuji dan masih ada, tetapi
  tidak dirender. Berkasnya sengaja tidak dihapus supaya keputusan ini mudah dibalik.
- Katalog tetap **satu tema** ("Mendaki Gunung"); mekanisme berkas tema sudah siap untuk tema berikutnya.
- Bukti visual masih **angka + tangkapan manual**, bukan uji regresi screenshot yang membandingkan gambar antar
  versi; `docs/tangkap-adegan-gunung.mjs` butuh layanan hidup + Chrome, jadi **tidak** ikut `verify.sh`.
- Animasi latar tema sekarang hanya zoom halus (`.jelajah-foto`), bukan awan/kabut/burung yang bergerak.

---

## A.46. Pos jadi kemah, jalur jadi zigzag mendaki, dan gambar gunungnya diganti (tumpul + lebih detail)

Permintaan pemilik produk: *"buat post seperti kemah dan juga buat seperti memanjat gunung jadi zigzag dan ganti
gunungnya, seperti gunung bukan curan tapi tumpul dan lebih detail"*. Tiga hal, ketiganya dikerjakan dan diukur.

### A.46.1 Pos peta jadi **kemah** (tenda), bukan bulatan berikon

Penanda pos di peta (`KemahPos` di `PetaPerjalanan.jsx`) sekarang sebuah **tenda**: atap segitiga
(`.jelajah-pos-kemah-atap`) dengan **pintu lebih terang** (`.jelajah-pos-kemah-pintu`), digambar di dalam
`viewBox 0 0 24 20`. Warnanya tetap mengikuti warna pos itu (`--pos-warna` di `theme.css`), jadi identitas pos
tidak hilang. **Ikon fase (tenda/pohon/sungai/batu/kabut/bendera) dilepas** dari dalam penanda: di ukuran
penanda di peta ikon sekecil itu tidak terbaca dan membuat tendanya penuh — nama fase tetap tertulis di daftar
pos di bawah peta dan di `aria-label` panggung, jadi tidak ada informasi yang hilang.

### A.46.2 Jalur jadi **zigzag mendaki**: basecamp kiri bawah → puncak tengah atas

`titikJalur(jumlah)` di `perjalanan.js` tidak lagi menyebar titik secara lurus. Sekarang:

- pos bergantian di **jalur kiri** (12% → 20%) dan **jalur kanan** (88% → 80%) — lebar belokan **mengecil ke
  atas** supaya terbaca sebagai lereng gunung yang menyempit, bukan dua kolom sejajar;
- sumbu `y` **selalu naik** (86% → 12%), jadi arah mendaki tetap terbaca walau `x` bolak-belok;
- pos **terakhir berdiri di puncak** (`x = 50`), bukan di tepi jalur;
- materi **satu pos** tidak punya belokan (tidak ada yang perlu didaki) — satu titik di basecamp.

Tidak ada yang berubah di sisi server: jalur ini murni tampilan, dan boleh-tidaknya membuka langkah tetap
diputus `ProgresMateriService`.

### A.46.3 Gambar gunung diganti: dari *tebing* jadi *gunung tumpul*

Keluhan *"seperti curan"* ternyata bisa dibuktikan, bukan cuma selera. Berkas yang dipakai sebelumnya
(`publicdomainvectors` 78943) tersusun dari **baji bersisi tegak**: dua titik dengan `x` sama pada satu bentuk
(`M 533.5 389 L 533.5 833 L 159 832 ...`) dan bahkan ada path **tanpa luas** (`M 577.37 220 L 577.37 834.33`).
Sisi tegak itulah tebing; puncaknya juga ujung pisau (lebar punggung **0%**).

Empat kandidat CC0 sempat diunduh dan **diukur** lebih dulu (publicdomainvectors 79101, 75640, 51822, 38980):
tak satu pun lebih baik pada ukuran ini — 79101 malah **39%** sisinya berarah tegak (dan rasionya 4:3), 38980
luminance-nya 88 (gelap) dengan rasio 2,25, 51822 hanya 3 warna dengan rasio 3:1, dan 75640 memuat kapal.
Karena itu latarnya **dibuat ulang di repo** dengan kurva (karya sendiri, dilepas CC0 — dicatat di
`LISENSI.md`): dua puncak bersalju yang membulat, punggung jauh, tiga lapis bukit, danau, pepohonan berdaun
bulat, batu, awan, dan burung — 60 bentuk, 18 warna (berkas lama: 47 bentuk, 16 warna).

Bedanya diukur, bukan dikira:

| Ukuran bentuk | Berkas lama | Berkas sekarang | Ambang pagar mutu |
| --- | --- | --- | --- |
| Jumlah puncak di garis cakrawala | banyak (baji terpisah-pisah) | **1** | tepat 1 |
| Kemiringan sisi maksimum | **90°** (tegak = tebing) | **43,3°** | ≤ 45° |
| Putaran antarruas maksimum | **121,6°** (kunci tajam) | **12,6°** | ≤ 20° |
| Sisi nyaris tegak terpanjang | 614 px (tegak) | **27 px** | ≤ 36 px |
| Punggung puncak (20 px di bawah titik tertinggi) | **0%** (ujung pisau) | **13,2%** | ≥ 6% |
| Bidang tanpa luas | ada 1 | tidak ada | nol |
| Goresan panjang menggantung | tidak ada | tidak ada (burung 3,8% lebar) | ≤ 8% |
| Warna teredup · rata-rata luminance | 127 · 199 | 93,6 · 193 | ≥ 90 · ≥ 170 |
| Bentuk · warna | 47 · 16 | 60 · 18 | — ("lebih detail") |

### A.46.4 Pagar mutu baru — dan dibuktikan **tidak kosong**

`frontend/src/__tests__/theme/gunungLatar.test.js` (9 tes) mengunci sifat itu: kanvas 16:9 & ≤ 1600 px, murni
vektor (tanpa `<image>`/`<text>`/`<filter>`), hanya perintah path `M/L/C/Z`, tidak ada bidang tanpa luas, tidak
ada sisi nyaris tegak yang bersambung > 4% tinggi, bentuk besar tidak > 45° dan tidak berkunci > 20°, **tepat
satu** puncak yang menonjol di garis cakrawala, punggung puncak ≥ 6% lebar, tidak ada goresan panjang tanpa isi
(ujung lepas), dan semua warna cukup terang.

Pagar yang tidak pernah merah itu tidak membuktikan apa-apa, jadi pagarnya **diuji balik**: berkas lama dipasang
sementara ke `public/tema/gunung.svg`, lalu tes dijalankan. Hasilnya **6 dari 9 merah**, antara lain
`expected [ '577.37,220 → 577.37,834.33' ] to deeply equal []` (bidang tanpa luas) dan kegagalan di sisi 90°,
kunci 121,6°, serta puncak 0%. Sesudah itu berkas baru dikembalikan dan hash-nya dicocokkan
(`901ead89…` sama sebelum dan sesudah uji balik).

### A.46.5 Verifikasi (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `npx vitest run src/__tests__/theme src/__tests__/sections/material` | **122 lulus / 8 berkas** (9 tes pagar bentuk baru, 14 `petaPerjalanan`, 31 `perjalanan`) |
| `npm run test` (seluruh Vitest) | **67 berkas / 653 tes lulus** |
| `npm run check` (checkJs) | **bersih (exit 0)** |
| `npm run lint` (ESLint) | **0 error**, 2 warning lama React Hook Form |
| `docs/jalankan-smoke-ui.sh perjalanan` (Chrome + layanan hidup) | **52/52 lulus, exit 0** — termasuk `src /tema/gunung.svg · termuat true · adegan tangan 0`, zoom `jelajah-zoom`, panggung `rasio 1.78` |
| `node docs/tangkap-adegan-gunung.mjs` (tangkapan kecerahan) | **exit 0** — lihat tabel di bawah |

Tangkapan panggung (materi 2 blok → 2 pos, 1 ruas, berkas termuat `1600x900`):

| Tema | rata | minimum | piksel < 70 | pita atas (langit) | tengah | bawah |
| --- | --- | --- | --- | --- | --- | --- |
| terang | **200,8** | 22,7 | **0,01%** | **203,8** | 207,2 | 191,2 |
| gelap | **200,5** | 28,3 | 0,10% | 203,4 | 207,2 | 190,6 |

Sebagai pembanding A.45 (berkas lama): rata **165,1** · langit **187,5**. Latarnya kini lebih terang, dan pagar
"jangan gelap" (rata-rata ≥ 130, pita langit ≥ 150, luas gelap ≤ 0,5%) dilewati dengan margin lebar.

### A.46.6 Batasan jujur

- **Saya tidak bisa melihat gambarnya.** Karena itu keluhan "curan" diselesaikan dengan **mengukur bentuk**
  (kemiringan, putaran, lebar punggung, bidang tanpa luas), bukan dengan menebak selera. Penilaian "bagus"
  tetap milik pemilik produk — tangkapan `docs/log-mentah/tangkapan/adegan-gunung-terang.png` & `-gelap.png`
  diperbarui untuk itu.
- **Keputusan A.45 dibalik.** A.45 memilih memakai *berkas gambar jadi dari domain publik*; sekarang latarnya
  **karya proyek ini** (CC0, dicatat di `LISENSI.md`). Alasannya terukur: dari empat kandidat CC0 yang diunduh,
  tidak ada yang lebih baik pada ukuran di atas. Membalik keputusan ini kembali cukup menukar **satu berkas**
  (`public/tema/gunung.svg`); pagar mutu bentuknya akan menolak berkas yang bersisi tegak, jadi berkas
  pengganti harus lolos ukuran yang sama (ambangnya di `gunungLatar.test.js`).
- Pangkal lereng gunung sebagian tertutup lapis bukit depan, jadi kemiringan yang **terlihat** lebih landai
  daripada 43,3° (angka itu kemiringan paling tajam di seluruh siluet). Ini disengaja (kesan berlapis), bukan
  sisa tebing.
- **Salju dan batu memakai `<ellipse>`/`<circle>`**, bukan `<path>`, supaya tepinya pasti bulat (versi pertama
  punggung salju berbentuk path bertepi bergelombang dan terukur bersudut 64°/152° — itu cacat sungguhan, lalu
  diganti). Konsekuensinya pagar bentuk hanya memeriksa `<path>`; bentuk bulat tidak ikut diukur kecuramannya,
  dan itu memang bukan siluet gunung.
- Uji regresi **visual** (membandingkan gambar antar-versi) masih belum ada; buktinya angka geometri + angka
  kecerahan + tangkapan manual. `docs/tangkap-adegan-gunung.mjs` butuh layanan hidup + Chrome sehingga **tidak**
  ikut `verify.sh`.
- Katalog tema tetap **satu tema** ("Mendaki Gunung"), dan animasi latar tetap hanya zoom halus.

### A.46.7 Revisi atas permintaan lanjutan: **satu** gunung, batu tetap ada, puncak tetap di langit, tanpa ujung garis lepas

Permintaan berikutnya: *"gunungnya hanya 1 saja dan boleh ada batunya dan endpoint-nya masih di langit,
pastikan tidak ada endpoint yang lepas"*. Yang diubah:

- **Satu gunung.** Puncak kedua (dulu di x≈1180) dihapus; sisanya lapis bukit yang landai. Diukur dari **garis
  cakrawala** (titik teratas tiap kolom gabungan bentuk besar): puncak yang menonjol ≥ 8% tinggi kanvas =
  **1** — di x≈884, y≈279, menonjol 292 px. Bukit terjauh sengaja diturunkan (puncaknya y≈540–600) supaya tidak
  ikut terbaca sebagai gunung kedua.
- **Puncak tetap di langit.** Puncak berdiri di **31% dari atas**, jadi pos terakhir jalur mendaki (12% dari
  atas, lihat A.46.2) tetap di langit dan langit tetap bagian terbesar bingkai.
- **Batu tetap ada, dan kini benar-benar terlihat.** Dua batu membulat dipindah ke padang depan (y 848–896);
  sebelumnya tertutup tepi bawah bingkai (y 890–916) sehingga cuma tampak sebagai serpihan.
- **Tidak ada ujung garis yang lepas.** Tiga garis rusuk lereng — goresan `fill="none"` sepanjang ~620 px yang
  berhenti di tengah lereng — **dihapus**. Satu-satunya goresan yang tersisa adalah burung (3,8% lebar kanvas),
  dan itu dikunci tes: goresan tanpa isi tidak boleh lebih besar dari 8% kanvas.
- Salju juga diganti jadi bidang **bulat** (`<ellipse>`), bukan path bertepi bergelombang: versi pertamanya
  terukur bersudut 64° dengan putaran 152° (bergerigi) — cacat nyata yang ketahuan justru karena diukur.

Dua bug di **pagar tesnya sendiri** ketemu saat mengerjakan revisi ini, keduanya diperbaiki di sumbernya:

1. `runTegak` ikut menghitung **sisi pembuangan di tepi bingkai**. Bentuk besar sengaja dilebihkan melewati tepi
   (x = -40 dan 1640) supaya tidak ada celah saat dipotong, dan sisi potong itu tegak — dari dalam kanvas
   memang tidak terlihat, tetapi tes menghitungnya: semua bidang besar terukur "tegak 380–414 px" padahal itu
   palsu. Sekarang ruas di luar kanvas dikecualikan.
2. Garis cakrawala dihitung per kolom 16 px dari titik sampel kurva yang jaraknya ~64 px (16 titik per kurva),
   jadi tiap kolom bergantian jatuh ke bentuk lain dan cakrawalanya bergerigi ~100 px — terbaca sebagai **11
   puncak palsu** dan tes "satu gunung" merah walau gambarnya benar. Diperbaiki: **64 titik per kurva** +
   jendela 16 px (bukan kolom keras). Efek sampingnya angka kemiringan lebih jujur (16 titik: 39,2° vs 64
   titik: 43,3° untuk lereng yang sama).

Verifikasi sesudah revisi: Vitest **67 berkas / 653 tes lulus** · checkJs bersih · ESLint 0 error · uji balik
berkas lama **6 dari 9 merah** (termasuk "hanya SATU gunung") · tangkapan kecerahan **rata 200,8** · pita langit
**203,8** · piksel gelap **0,01%** (pagar "jangan gelap" dilewati dengan margin lebar).

## A.47 Tanda Pangkas `|`: Satu Goresan, Digeser ke Dalam (12 Oktober 2026)

Permintaan putaran ini: *"dan buat `||` pada [tanda pangkas] gak beneran cuman `|` dan juga buat lebih
kedalam (UI-nya perbaiki)"*. Kalimatnya bisa menunjuk beberapa penanda tegak di editor materi, jadi
elemennya dipastikan dulu lewat **pertanyaan pilihan**; jawabannya adalah **gagang pangkas klip** di
timeline (fitur A.36).

### A.47.1 Sebabnya diukur lebih dulu, bukan ditebak

Tanda itu terbaca `||` karena dua hal di CSS `.nle-pangkas::before` yang lama:

1. **Goresannya tinggal 1px.** Cincin `border: 1px solid var(--kartu)` + `box-sizing: border-box`
   (reboot Bootstrap juga berlaku untuk `::before`) menghabiskan `width: 3px`: warna aksen yang
   tersisa hanya **1px**, diapit dua garis selebar 1px berwarna `--kartu`.
2. **Tandanya duduk menempel di tepi klip.** Pada klip yang diikuti klip lain, tanda aksen 1px itu
   hanya dipisah **1px** `--kartu` dari garis tepi 3px klip sebelahnya — persis itulah yang terbaca
   `||`. Di sisi kiri, cincinnya bahkan menutupi garis tipe klip sehingga yang terlihat juga 1px.

Angka dari potret layar (baris tengah klip terpilih, `deviceScaleFactor: 2`, klip teks 375px):

| Yang diukur | Sebelum | Sesudah |
| --- | --- | --- |
| Lebar goresan (piksel aksen) | **1px** | **3px** |
| Jarak goresan dari tepi klip | kiri 1px · kanan 2px | kiri 7px · kanan 8px |
| Goresan aksen di tepi kanan klip terpilih (klip yang diikuti klip lain) | **2** (1px + 3px, dipisah 1px) | **1** di dalam klip; yang kedua adalah garis tepi klip sebelahnya, kini 8px lebih jauh |

Angka itu sama di tema **terang dan gelap** karena warnanya dibaca dari variabel tema, bukan hex tetap.

### A.47.2 Yang diubah

- **Satu goresan, bukan goresan bercincin.** `border` pada `::before` dibuang, diganti
  `outline: 1px solid var(--teks)`: `outline` **tidak** menyusutkan lebar, jadi goresannya utuh 3px
  sementara garis luarnya menjaga kontras di atas sorot hangat — aksen di atas `--sorot-hangat` hanya
  **2,3:1**, sedangkan `--teks` di atasnya **di atas 14:1** (batas WCAG 1.4.11 yang sudah dipakai di
  berkas ini untuk cincin fokus).
- **Digeser ke dalam** `padding-inline-start`/`padding-inline-end: 0.45rem` (7,2px) di kedua sisi.
  **Kotak seretnya tetap di tepi klip** — yang bergeser hanya goresannya — sehingga jalur seret dan
  penjaga geometri lama (`sebaris`, jangkau tetikus) tidak berubah artinya.
- **Goresan dipendekkan** dari setinggi klip (32px) menjadi 1,6rem (25,6px) supaya terbaca **pegangan**,
  bukan dinding pemisah antarklip.
- **`border-inline-start-width: 1px` pada `.nle-klip-aktif`.** Selama klip terpilih garis tepinya
  seragam 1px `--teks`, jadi sisi kirinya tidak lagi memuat garis tipe 3px berwarna tepat di sebelah
  tanda (garis tipe itulah goresan kedua di sisi kiri). **Konsekuensi sadar**: warna tipe
  (aksen/hijau/oranye) tidak tampak selama klip terpilih — jenis klip tetap terbaca dari ikon + label
  di dalam klip dan dari inspector, dan klip yang tidak terpilih tetap memakai garis tipe 3px berwarna.
- **Harness `docs/smoke-ui-durasi-klip.mjs` diperluas 15 → 19 pemeriksaan.** Empat pemeriksaan baru
  mengukur **bentuk** tanda: gaya terhitung `::before` (lebar, cincin, garis luar, tinggi, jarak geser)
  dan pembacaan **kolom piksel potret layar** (jumlah goresan aksen di dalam pita 11px dari tiap tepi,
  panjangnya, dan jaraknya dari tepi klip). Tanda digambar lewat `::before`, jadi bentuknya memang tidak
  bisa dinilai dari DOM.

### A.47.3 Verifikasi (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `bash docs/jalankan-smoke-ui.sh durasi-klip` | **19/19 lulus** (dari 15); 4 bentuk baru: `lebar=3px cincin=0px garis luar=solid 1px` · `tinggi 25.6px < klip 32px · masuk kiri=7.2px kanan=7.2px` · `tepi kiri=1 goresan · tepi kanan=1 goresan (klip 328px)` · `kiri 3px jarak 7px · kanan 3px jarak 8px` |
| **Uji balik** (CSS lama dikembalikan sementara, lalu SHA-nya dikembalikan persis) | **3 dari 4** pemeriksaan bentuk **GAGAL** (16/19): `cincin=1px` · `tinggi 32px < klip 32px, masuk kiri=0px kanan=0px` · `kiri 1px jarak 1px · kanan 1px jarak 2px` |
| `./verify.sh` | **SEMUA HIJAU** — Pest **331 tes / 3126 asersi**, Redis wajib **9/65**, Pint bersih, checkJs bersih, ESLint 0 masalah, Vitest **67 berkas / 653 tes**, Realtime hijau |

Potret bukti: `docs/log-mentah/tangkapan/gagang-pangkas-gelap.png` (potongan zoom tepi klip terpilih; berkas itu
tidak di-commit, sama seperti tangkapan gunung A.45/A.46).

### A.47.4 Berkas

- `frontend/src/theme/theme.css` (`.nle-pangkas::before`, `.nle-pangkas-kiri/kanan`, `.nle-klip-aktif`)
- `docs/smoke-ui-durasi-klip.mjs` (4 pemeriksaan bentuk baru)
- `docs/laporan-pengujian.md` (A.47 ini), `docs/penjelasan-fitur.md`, `docs/handoff-sesi.md`

### A.47.5 Batasan jujur

- **Saya tetap tidak bisa melihat gambarnya.** Karena itu keluhan "`||`" diselesaikan dengan **mengukur**
  (lebar goresan, jarak dari tepi, jumlah goresan per sisi), bukan menebak selera. Penilaian "enak
  dilihat" tetap milik pemilik produk, dan untuk itu potret zoom-nya disimpan.
- **Pagar ini sempat mau ditaruh di Vitest dan gagal karena alatnya.** Vitest men-stub berkas CSS
  menjadi modul kosong (bawaan `test.css: false`), sehingga `import.meta.glob('…theme.css',
  { query: '?raw' })` **selalu mengembalikan `''`** — pagar berbasis teks CSS tidak mungkin dibuat tanpa
  mengubah konfigurasi global (dan mengaktifkan pemrosesan CSS akan memerahkan pagar warna yang sudah
  ada, lihat poin berikut). Pagarnya karena itu ditaruh di harness browser, yang justru lebih kuat:
  yang diuji adalah **hasil render sungguhan**, bukan teks berkasnya.
- **Temuan sampingan yang jujur** (di luar permintaan putaran ini, jadi **tidak** diubah): karena
  stubbing CSS tadi, pagar warna `src/__tests__/theme/tema.test.js` **tidak pernah benar-benar membaca
  `theme.css`** — berkas CSS-nya kosong saat diuji. Kalau glob-nya diperbaiki, `theme.css` memang
  memuat sekitar **48 hex di luar blok variabel** (contoh: fallback `var(--garis, #cbd5e1)` dan warna
  khusus cetak). Jangan dikira jalur itu sudah terjaga; menutupnya butuh keputusan tersendiri
  (apakah fallback & warna cetak termasuk "nilai hex yang dilarang").
- **Yang tidak diukur**: apakah goresan 3px cukup besar untuk disentuh di ponsel. Sasaran seretnya tetap
  **0,9rem (14,4px)** seperti sebelumnya — pemeriksaan sasaran sentuh ≥ 44px ada di harness mobile
  (`docs/smoke-ui-mobile.mjs`), tetapi tanda pangkas belum masuk daftar pemeriksaannya.

## A.48 Gunung "Pendakian bertingkat": tiga puncak, dua di antaranya jadi jalur pos (12 Oktober 2026)

Putaran ini pemilik produk mengirim **gambar referensi** (`gunung-progres.svg`, puncak runcing dengan tutup
salju, jurang berbentuk irisan, pohon dan batu) dan menulis *"lihat ini referensi gunung … boleh
modifikasi"*, lalu menegaskan bentuk yang diinginkan: *"3 puncak namun yang di sebelah-sebelahnya itu
menjadi jalur pendakian"*.

Referensinya **tidak disalin** — bekasnya justru berkas yang dulu ditolak: punggung 0% (rata seperti meja),
sisi 90° (tegak seperti tebing), dan 11 puncak palsu. Yang diambil dari referensi hanya **komposisinya**
(tiga puncak bertingkat, langit besar, kaki berkabut), lalu digambar ulang dengan aturan repo.

### A.48.1 Yang dikerjakan

- **`frontend/public/tema/gunung.svg` diganti** (152 baris, 1600×900, murni vektor): langit gradien
  tiga tingkat, matahari radial, tiga puncak — **satu punggung utama** di tengah dan **dua puncak jalur**
  persis di jalur zigzag pos (sumbu x ≈ 14% dan ≈ 90%) — plus tutup salju, kabut kaki, tiga lapis bukit,
danau, pohon berdaun bulat, batu, dan tiga burung kecil di langit.
- **Siluet utama dibuat dari kurva Catmull-Rom** (di `buat-gunung.mjs`, lalu dibekukan ke berkas), bukan
dari rangkaian segitiga: puncaknya tumpul dan putaran antarruasnya kecil, jadi tidak ada lagi sudut yang
terbaca seperti tebing.
- **Aturan pagar berubah, bukan dilonggarkan**: dari *"tepat satu puncak"* menjadi **"tepat satu puncak
  utama + paling banyak dua puncak jalur"**, dan puncak jalur itu wajib memenuhi tiga syarat sekaligus:
  menonjol ≥ 8% tinggi bingkai, **lebih rendah ≥ 10% tinggi bingkai** dari puncak utama, dan **berada di
  tepi** (|x − 50%| ≥ 10%). Puncak kedua yang setara dengan puncak utama tetap merah — itu yang membuat
  "dua gunung berhadapan" tertangkap.
- Kepala berkas SVG memuat seluruh angka hasil pengukuran (bukan klaim): puncak utama menonjol 29,8%
  (268 px) di x≈52%, dua puncak jalur 158 px dan 160 px (9,0% dan 8,1%), punggung tumpul 9,0% lebar
  pada 2,2% tinggi di bawah titik tertinggi, kemiringan sisi maksimum 41,3°, putaran antarruas maksimum
  6,3°, sisi tegak terpanjang 27 px, 65 nilai warna (min 94, rata 177).

### A.48.2 Verifikasi (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `npx vitest run src/__tests__/theme/gunungLatar.test.js` | **9 tes lulus**, 124 ms (tanpa jaring: 1 berkas, `--no-file-parallelism --maxWorkers=1`) |
| `node /tmp/ukur-gunung.mjs` (loop pengukuran cepat, di luar repo) | seluruh metrik hijau **sebelum** berkas dipasang |

### A.48.3 Berkas

- `frontend/public/tema/gunung.svg` (aset baru + kepala berkas berisi angka terukurnya)
- `frontend/src/__tests__/theme/gunungLatar.test.js` (aturan puncak utama + puncak jalur)
- `docs/laporan-pengujian.md` (A.48 ini), `docs/rencana-desain-putaran3.md` (rencana UI putaran ini)

### A.48.4 Batasan jujur

- **Saya tetap tidak bisa melihat gambarnya.** Seluruh penilaian di atas adalah angka (menonjol, sudut,
  kemiringan, kecerahan), bukan selera. Putusan "enak dilihat" tetap milik pemilik produk.
- **Tidak ada tangkapan peramban baru untuk putaran ini.** Harness-nya sudah ada
  (`docs/tangkap-adegan-gunung.mjs`) dan belum dijalankan ulang setelah aset diganti, jadi belum ada bukti
  potret bahwa jalur serta pos **mendarat di puncaknya masing-masing**; yang baru terbukti adalah bentuk
  siluetnya (lewat pagar) dan geometrinya (lewat angka). Menjalankannya satu kali akan menutup celah ini.
- **Tiga puncak berarti dua puncak ekstra di jalur.** Itu kemauan pemilik produk, tetapi konsekuensinya
  nyata: satu penanda pos bisa berdiri nyaris sejajar dengan puncak jalur, jadi "puncak" di layar tidak
  lagi tunggal. Pagar lama sengaja tidak dihapus, hanya diperketat (tinggi + posisi), supaya kembalinya
  berkas bertipe "dua gunung berhadapan" tetap tertangkap.

## A.49 Ukuran tulisan Normal/Besar: satu variabel `--s` (12 Oktober 2026)

Papan desain putaran 3 (`desain-putaran3.zip`, dibaca dari salinan di `/tmp/desain3`, tidak di-commit)
memuat satu perubahan yang benar-benar baru dibanding aplikasi sekarang: **"Ukuran: dua pilihan saja. Satu
variabel, `--s`. Normal untuk semua, Besar untuk murid kecil atau layar jauh."** Aplikasi belum punya apa
pun untuk itu — hasil `grep` untuk `--s:calc`, `data-ukuran`, dan "Ukuran tulisan" di `frontend/src`
**kosong**. Pilihan "Rapat" yang ada di putaran 2 sengaja **tidak** ikut dibawa (papan sendiri yang
membuangnya karena selisihnya tak terasa).

Putaran ini memasang **hanya potongan itu beserta fondasinya**; sisa papan (perbandingan kata per layar,
panel "Tampilan" yang menyatukan warna + ukuran) masuk rencana di
`docs/rencana-desain-putaran3.md` dan dikerjakan pada putaran berikutnya.

### A.49.1 Yang dikerjakan

- **`theme.css`: satu variabel `--s`.** `:root { --s: 1; font-size: calc(100% * var(--s)) }` dan
  `:root[data-ukuran='besar'] { --s: 1.12 }`. Karena `font-size` di `<html>` sendiri ikut `--s`, seluruh
  ukuran berbasis **rem** (85 deklarasi `font-size` + utilitas Bootstrap) membesar bersama tanpa diubah
  satu per satu. Skala px yang termasuk janji papan ("jarak dasar", "tinggi kepala") dikalikan eksplisit:
  `--sp-1…8`, `--fs-hero/h1/h2/soal/isi/meta`, `--tinggi-kepala`.
- **Radius, garis, dan bayangan sengaja tetap** — sama seperti papan (di `tema.css` putaran 3 pun
  `--r-s/--r-m/--r-l` tidak ikut dikalikan): bingkai tidak boleh menggemuk, hanya isinya yang membesar.
- **Judul Bootstrap ikut diperbaiki.** Ukuran judul bawaan mencampur rem dengan vw
  (`.h2: calc(1.325rem + .9vw)`). Bagian rem ikut `--s`, bagian vw tidak, sehingga judul **hanya tumbuh
  ~9%** sementara teks lain 12% (terukur: 28,004 px → 30,548 px). Rumusnya ditulis ulang
  (`calc(1.325rem + 0.9vw * var(--s))`) di dalam `@media (max-width: 1199.98px)`; pada `--s = 1` nilainya
  **sama persis** dengan bawaan, dan di ≥ 1200px Bootstrap memakai rem tetap yang sudah ikut `--s`.
- **`shared/store/tema.js` jadi menyimpan dua preferensi tampilan**: `ukuran` (`normal|besar`, zod, kunci
  `ukuran-ulangan`), `ubahUkuran()`, `bacaUkuranAwal()`, `terapkanUkuran()`, dan `mulaiUkuran()`.
  Akses localStorage tetap dibungkus `try/catch` (mode privat) dan nilai rusak jatuh ke Normal.
- **`shared/layout/TombolUkuran.jsx`** (pola sama dengan tombol tema): satu tombol berbalik, dengan
  `aria-pressed` dan label yang **menuliskan keadaannya** ("Ukuran tulisan Besar — tekan untuk kembali
  Normal"), jadi tidak bergantung pada warna/ikon saja.
- **Ikon `IkonHuruf`** (dua huruf A berbeda tinggi) + masuk `daftarIkon`.
- **Dipasang di bilah atas** (`KerangkaUmum`) **dan di halaman auth** (`KerangkaAuth`: di HP sebaris dengan
  tombol tema, di layar lebar satu grup di kanan atas) — tepat sebelum render pertama lewat `main.jsx`,
  jadi tidak ada kedipan kecil → besar.

### A.49.2 Verifikasi (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `npx vitest run src/__tests__/theme/ukuran.test.jsx …` (4 berkas, `--no-file-parallelism --maxWorkers=1`) | **17 tes lulus** (ukuran 4 · tema 1 · ikon 5 · kerangka 7), 2,0 s |
| `npx eslint` (7 berkas berubah) + `npm run check` (tsc strict) | lulus, tanpa temuan |
| `docs/jalankan-smoke-ui.sh ukuran` (Chrome sungguhan, 1 berkas) | **11 pemeriksaan, SEMUA LOLOS** |

Angka dari harness peramban (bukan dari membaca CSS):

```
OK   normal: --s = 1 — --s=1
OK   normal: atribut data-ukuran — data-ukuran=normal
OK   tombol ukuran ada di bilah — button[aria-label^="Ukuran tulisan"]
OK   besar: --s = 1,12 — --s=1.12
OK   besar: huruf di layar ikut membesar — 28.004px → 31.3645px   (×1,12)
OK   besar: akar (rem) ikut membesar — 16px → 17.92px
OK   besar: sasaran ketuk tidak menyusut — 48px → 48px
OK   besar: halaman tidak melebar melewati layar — dokumen 741px ≤ layar 756px
OK   besar: pilihan diingat — localStorage=besar
OK   muat ulang: tetap Besar — --s=1.12 · data-ukuran=besar
OK   balik ke normal: ukuran kembali seperti semula — --s=1 · judul 28.004px (awal 28.004px)
```

### A.49.3 Berkas

- `frontend/src/theme/theme.css` (`--s`, `[data-ukuran='besar']`, token px dikalikan, tulis ulang ukuran
  judul Bootstrap)
- `frontend/src/shared/store/tema.js`, `frontend/src/shared/layout/TombolUkuran.jsx`,
  `frontend/src/shared/layout/KerangkaUmum.jsx`, `frontend/src/shared/layout/KerangkaAuth.jsx`,
  `frontend/src/icons.jsx`, `frontend/src/main.jsx`
- `frontend/src/__tests__/theme/ukuran.test.jsx` (4 tes), `docs/smoke-ui-ukuran.mjs` (11 pemeriksaan),
  `docs/rencana-desain-putaran3.md`
- `docs/laporan-pengujian.md` (A.49 ini), `docs/penjelasan-fitur.md`, `docs/handoff-sesi.md`

### A.49.4 Batasan jujur

- **Pagar CSS-nya ada di peramban, bukan di Vitest.** `import.meta.glob(…, { query: '?raw' })`
  mengembalikan `''` untuk berkas CSS di repo ini (temuan yang sama dengan A.47.5 — Vitest men-stub CSS),
  jadi pemeriksaan "seluruh token dikalikan `--s`" saya taruh di `docs/smoke-ui-ukuran.mjs` yang mengukur
  **hasil render**, bukan teks berkas. Harness itu yang menjadi bukti bahwa `--s` benar-benar sampai ke
  layar.
- **Tombolnya belum berupa panel "Tampilan".** Papan putaran 3 menggabungkan "Warna layar" dan "Ukuran
  tulisan" dalam satu panel; sekarang keduanya **dua tombol ikon berdampingan**. Menggabungkannya (panel
  buka-tutup + tombol Batal) dicatat di rencana, belum dikerjakan — dan papan tidak menyebut dua tombol
  terpisah sebagai larangan.
- **Ukuran diperiksa di satu halaman** (`/masuk`). Mekanismenya global (satu `--s` di `<html>`), tetapi
  halaman padat tabel (mis. daftar murid) belum diukur ulang: halaman itu belum diperiksa apakah masih
  muat tanpa gulir mendatar pada "Besar".
- **Basis hurufnya berbeda dari demo papan.** Papan memakai basis 18 px ("Besar · isi 20px"); aplikasi ini
  berbasis rem 17 px, jadi "Besar" menjadi ≈19 px. **Pengalinya sama** (1,12) — hanya basisnya yang beda,
  dan itu tidak diubah pada putaran ini.
- **Pilihan "Rapat" tidak dipasang.** Sengaja: papan sendiri yang membuangnya. Kalau ternyata masih
  dibutuhkan, ia harus dikembalikan sebagai pilihan ketiga di `skemaUkuran` **beserta** pemeriksaan baru
  di harness.

## A.50 Pos yang Berdiri di Langit + Dua Tema Perjalanan Baru (12 Oktober 2026)

Permintaan putaran ini: *"fix, saat di sisipkan quiz hasilnya masih di udara … dan buat template lain
sekarang seperti di pelayaran untuk mencari harta karun di pulau (boleh pakai grafis gratis publik) dan
luar angkasa"*.

### A.50.1 Penyebabnya diukur dulu, bukan ditebak

Jalur peta dihitung dari satu rumus: `y = 86 − maju × 74`, sehingga pos terakhir selalu berhenti di
**y = 12%** — sedangkan punggungan gambar `gunung.svg` ada di **y ≈ 39%**. Jadi pos terakhir, dan setiap
pos baru yang disisipkan (mis. kuis di ujung materi), berdiri **di langit di atas puncak**.

Setelah cakrawala berkas itu diukur (kurva Bézier ditelusuri, bukan hanya titik kontrolnya), ternyata
kerusakannya lebih luas dari dugaan: dua dari lima titik jalur lama berdiri di udara —
`(30%, 54%)` **143 px di atas** punggungan, dan `(61%, 46%)` **17 px di atas** punggungan.

### A.50.2 Yang dikerjakan

- **Jalur peta jadi rute per tema (`RUTE_TEMA` di `sections/material/perjalanan.js`).** Tiap titik
ditetapkan dari hasil ukur latarnya sendiri, dan `titikJalur(jumlah, adegan)` hanya **menyebar pos rata
di sepanjang rute** — jadi menambah/menyisipkan bagian tidak lagi melempar pos ke tempat lain, apalagi ke
langit. Tema tak dikenal (materi lama) tetap mendapat rute pendakian.
- **Titik gunung ditempatkan di bawah punggungannya** (26–40 px di bawah garis): puncak ada di y ≈ 39%,
pos terakhir sekarang di **y = 42%** — berdiri di puncak, bukan di langit.
- **Dua tema baru di katalog server** (`Registry\TemaPerjalanan`): **Harta Karun di Pulau** (adegan
`pulau`, 6 fase, tingkat Pelaut Pemula → Penemu Harta) dan **Luar Angkasa** (adegan `angkasa`, tingkat
Astronaut Pemula → Penakluk Galaksi).
- **Dua latar baru, karya proyek ini (CC0)** — tidak ada berkas unduhan, jadi tidak ada lisensi pihak
ketiga yang perlu ditelusuri dan tidak butuh jaringan: `public/tema/pulau.svg` (23,6 KB · 201 bentuk) dan
`public/tema/angkasa.svg` (18,4 KB · 200 bentuk). Tiap benda yang diinjak pos diberi `id`
(`dermaga`, `perahu`, `karang`, `pantai`, `hutan`, `goa`, `landasan`, `bumi`, `asteroid`, `saturnus`,
`bulan`) supaya bisa diperiksa mesin. Catatan kecil yang gampang menjebak: pada `pulau.svg` empat tempat pos
tandanya `<g id="…">`, sedangkan `pantai` dan `hutan` hanya bisa ditandai pada `<path id="…">` karena
bidangnya satu path — pagar bentuk membaca **kedua** bentuk penanda itu.
- **Latar gelap punya aturan jalurnya sendiri.** Jalur peta bawaan berwarna pekat (dirancang untuk latar
terang: gunung & pulau) dan tenggelam di langit malam, jadi `.jelajah[data-adegan='angkasa']` di
`theme.css` menimpa `--jalur-belum`/`--jalur-lewat` dengan versi terang, sekaligus meredam lapis putih di
kaki panggung.

### A.50.3 Verifikasi (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `npx vitest run … tema/latarTema · tema/gunungLatar · material/perjalanan · material/petaPerjalanan · material/api` | **86 tes lulus** (5 berkas) |
| `./vendor/bin/pest tests/Feature/Slice12TemaMateriTest.php` | **10 tes lulus, 172 asersi** (katalog: 4 tema, urutan & fase terbaru) |
| `npx eslint …` + `npm run check` (tsc strict) | bersih (dua galat tipe JSDoc ditemukan lalu diperbaiki, bukan di-suppress) |
| `docs/jalankan-smoke-perjalanan.sh` (Chrome sungguhan) | **69/69 lulus** |

Pemeriksaan baru di harness itu, apa adanya dari keluaran:

```
LULUS · tidak ada pos yang berdiri di langit (semuanya di bawah punggungan)
LULUS · tema luar angkasa tersimpan dengan nama & fase bawaannya · nama “Luar Angkasa” · adegan angkasa
LULUS · pos tema luar angkasa berdiri di benda rutenya (landasan → Bulan) · selisih maks 0.0%
LULUS · latar tema luar angkasa memakai berkas angkasa.svg yang benar-benar termuat · src /tema/angkasa.svg
LULUS · jalur peta dipakai versi terang di langit malam (aturannya berlaku) · stroke rgba(226, 240, 255, 0.78) · dash 6px, 6px
```

Perhatikan asersi **selisih maks 0,0%**: letak tanda pos di layar (diukur dari kotak panggung) sama persis
dengan titik rute tema di berkas latarnya — jalur dan gambarnya tidak bisa lagi saling menyimpang tanpa
ketahuan.

### A.50.4 Berkas

- `frontend/src/sections/material/perjalanan.js` (`RUTE_TEMA`, `ruteUntuk`, `titikJalur(jumlah, adegan)`)
- `frontend/src/sections/material/PetaPerjalanan.jsx` (titik jalur mengikuti adegan + dua berkas latar baru)
- `frontend/src/theme/theme.css` (aturan jalur terang untuk `[data-adegan='angkasa']`)
- `frontend/public/tema/pulau.svg`, `frontend/public/tema/angkasa.svg`, `frontend/public/tema/LISENSI.md`
- `backend/app/Sections/Material/Registry/TemaPerjalanan.php` (dua template baru)
- `frontend/src/__tests__/theme/latarTema.test.js` (baru), `frontend/src/__tests__/sections/material/perjalanan.test.js`,
  `frontend/src/__tests__/sections/material/petaPerjalanan.test.jsx`,
  `backend/tests/Feature/Slice12TemaMateriTest.php`, `docs/smoke-ui-perjalanan.mjs`
- `docs/laporan-pengujian.md` (A.50 ini), `docs/penjelasan-fitur.md`, `docs/handoff-sesi.md`

### A.50.5 Batasan jujur

- **Dua tema baru sudah dibuka di layar, tetapi hanya pada satu ukuran layar.** Harness `perjalanan`
sekarang memuat `pulau.svg` **dan** `angkasa.svg` sungguhan di Chrome dan mengukur enam/lima titik pos di
atasnya (`selisih maks 0,0%`), jadi tampilan bawaannya bukan klaim lagi. Yang belum diperiksa: layar
ponsel sempit untuk kedua tema ini (tema bawaan sudah punya harness perangkat terpisah).
- **Saya tetap tidak bisa menilai "enak dilihat".** Yang diukur: bentuk berkas, kecerahan berbobot luas
(terang vs gelap), dan tempat pos menginjak. Pilihan warna dan komposisi pulau/angkasa adalah usulan,
bukan putusan.
- **Tidak ada berkas gambar domain publik yang diunduh.** Pemilik produk mengizinkan, tetapi menambahkan
grafis pihak ketiga berarti menambah baris lisensi yang harus ditelusuri; dua latar ini karena itu
digambar di repo (CC0) dengan gaya yang sama seperti `gunung.svg`.
- **Zon gelap hanya diuji lewat tema luar angkasa.** Belum ada tema gelap kedua, jadi aturan
`.jelajah[data-adegan='angkasa']` belum dibuktikan bisa dipakai ulang tema gelap lain; kalau nanti ada,
atributnya perlu digeneralisasi (mis. `[data-latar-gelap]`) **beserta** pemeriksanya.
- **Jumlah pos yang diuji di peramban hanya 4 dan 5.** Rute untuk 2–12 pos diuji di Vitest, termasuk
pagar regresi "tidak pernah menaruh pos di langit".

---

## A.51 Pencarian Murid yang Menyaring di Server (12 Oktober 2026)

Daftar murid sudah berhalaman sejak P-01 (A.23): 50 baris per halaman, `meta.total` dikirim server. Yang
belum ada: cara menemukan **satu** murid selain menyaring kelas lalu menelusuri halaman satu per satu — di
sekolah dengan ratusan murid, anak yang kebetulan ada di halaman 4 praktis tidak ketemu. Kotak cari yang
menyaring di klien tidak menutup celah itu: yang disaring hanya 50 baris yang kebetulan sedang tampil,
sehingga murid ke-51 tetap terbaca "tidak ada" padahal ada.

### A.51.1 Yang dikerjakan

- **Server menyaring, bukan tabel yang tampil.** `MuridController@index` menerima filter baru `cari`
  (`AllowedFilter::callback`) yang mencari ke **satu** kotak: `nis`, `nisn`, nama, dan email
  (`orWhereHas('user')`) — tetap dibatasi satu sekolah seperti kueri sebelumnya.
- **Detail yang mudah jadi bug, ditutup di server**: kata kunci di-`trim` (kata kosong diabaikan, bukan
  mencari spasi), `%` dan `_` yang diketik guru di-escape supaya tidak berubah jadi wildcard (mencari
  "100%" harus menyaring), dan `nis`/`nisn` yang boleh NULL tidak membuat murid tanpa NIS hilang dari
  hasil pencarian nama.
- **Kotak cari di halaman Murid** (`sections/school/HalamanMurid.jsx`): jeda **300 ms** sebelum kata kunci
  dikirim (tanpa jeda, satu ketikan "rina" menembak empat permintaan dan hasil ketikan pertama bisa tiba
  sesudah yang terakhir), daftar kembali ke **halaman 1** setiap kata kunci berubah, hasil lama tetap
  tampil selama pencarian baru berjalan (`keepPreviousData`, jadi tabel tidak berkedip), keadaan kosong
  khusus pencarian berikut tombol **"Bersihkan pencarian"**, dan kepala halaman menyebut kata kuncinya
  (*"Menampilkan 3 dari 3 murid untuk “rina” — mencari…"*).
- **Aturan parameter dipisah supaya bisa diuji tanpa jaringan** (`paramMurid` di `sections/school/api.js`):
  kata kunci kosong **tidak** dikirim sebagai `filter[cari]`, dan spasi di ujung dipotong lebih dulu
  supaya " rina " dan "rina" memakai kueri yang sama.

### A.51.2 Verifikasi (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `./vendor/bin/pest tests/Feature/SekolahTest.php` | **10 passed (78 assertions)** — termasuk tes baru: nama sebagian & huruf besar-kecil, email, NIS, NISN, murid tanpa NIS, kata kunci tanpa hasil = kosong, gabungan dengan `filter[class_id]`, `%` di-escape, kata kunci berisi spasi diabaikan |
| `npx vitest run src/__tests__/sections/school/pencarian.test.jsx` | **8 tes lulus** (5 di antaranya di `HalamanMurid`: ketikan cepat digabung, menyaring di server, keadaan kosong + jalan keluar, tombol bersihkan) |
| `docs/jalankan-smoke-ui.sh murid` (Chrome sungguhan) | **18/18 pemeriksaan lulus, exit 0** |
| `./verify.sh` | **SEMUA HIJAU (exit 0)** — Pest **332 tes/3164 asersi**, Redis wajib 9 tes/65 asersi, Pint bersih, `npm run check`, ESLint 0 error, Vitest **70 berkas/681 tes**, realtime lulus |

Harness `murid` sengaja **menghitung permintaan** yang benar-benar ditembak ke `/v1/murid`, supaya "menyaring
di server" dan "satu permintaan per ketikan" dibuktikan, bukan diasumsikan:

```
LULUS · ketikan cepat digabung jadi satu permintaan ke server · 1 permintaan · /v1/murid?page=1&filter[cari]=Cari
LULUS · tiga murid uji muncul walau halaman 1 penuh murid lain (disaring server) · 3 baris
LULUS · kelas + kata kunci dikirim bersamaan ke satu permintaan · /v1/murid?page=1&filter[class_id]=30&filter[cari]=Cari
LULUS · kelas lain + kata kunci yang sama menghasilkan kosong (dua filter benar-benar bekerja) · kelas 26 → 0 baris
```

### A.51.3 Berkas

- `backend/app/Sections/School/Http/Controllers/MuridController.php` (filter `cari` + `saringPencarian`)
- `frontend/src/sections/school/HalamanMurid.jsx`, `frontend/src/sections/school/api.js` (`paramMurid`)
- `frontend/src/__tests__/sections/school/pencarian.test.jsx` (baru), `backend/tests/Feature/SekolahTest.php`
- `docs/smoke-ui-murid.mjs` (baru, dijalankan lewat `docs/jalankan-smoke-ui.sh murid`),
  `docs/penjelasan-fitur.md` (bagian 19), `docs/handoff-sesi.md`

### A.51.4 Batasan jujur

- **Pencariannya masih `LIKE %kata%`**, jadi indeks kolom tidak terpakai dan waktunya naik seiring jumlah
  murid. Untuk sekolah dengan ribuan murid, langkah berikutnya adalah pencarian penuh (full-text) atau
  kolom `nama_norm` yang diindeks — belum dikerjakan. (Sejak A.53 ada tes regresi pada **1.200 murid** yang
  membuktikan kebenaran pencarian + batas halaman pada skala itu, tetapi itu **bukan** uji beban waktu
  tanggap.)
- **Data ujinya kecil dan disengaja begitu**: harness memakai satu halaman penuh (50 murid lain) + 3 murid
  uji. Yang dibuktikan adalah kueri yang dikirim ke server dan baris yang tampil, **bukan** waktu tanggap
  pada ratusan ribu baris.
- **Penyorotan kata kunci** ditambahkan kemudian di A.53 (`<mark>` di nama/NIS/email); pencarian tetap
  hanya ada di halaman **Murid** — halaman Kelas, Mapel, dan Bank Soal belum punya kotak cari.
- **Pencarian ini bukan pengganti impor**: mencocokkan data massal tetap lewat halaman Impor, dan kotak cari
  tidak menandai murid yang datanya ganda.

---

## A.52 Temuan Sampingan: Pemeriksaan HTTP soal `tamper_suspected` Sudah Usang (12 Oktober 2026)

Dipicu bukan oleh pencarian murid: saat `node docs/smoke-http-fitur.mjs` dijalankan ulang sebagai regresi
untuk A.51 (harness API seluas ini memang tidak ikut `verify.sh`, jadi ia jarang dijalankan), hasilnya **merah
1 dari 242**:

```
Total: 241/242 lulus · 1 gagal
 - [K. Presence, anti-cheat, layar guru, SSE] kategori dari klien (tamper_suspected) diterima sesuai chunk anticheat → status=422
```

**Penyebabnya harness yang tertinggal, bukan kode backend.** Kategori `tamper_suspected` sudah dipindah ke
daftar **turunan server** (ia lahir saat denyut proteksi murid berhenti padahal attempt masih berjalan —
`SapuPresence`), sedangkan kategori deteksi sisi perangkat yang boleh dikirim klien sekarang adalah
`dom_injection` dan `extension_detected`. Kontrak itu **sudah** diuji di
`backend/tests/Feature/Slice07Test.php` — termasuk tes *"menerima kategori deteksi extension dari klien dan
menolak tamper_suspected"* — dan enumnya menyebut alasannya apa adanya (klien tidak boleh menulis kategori
turunan server supaya tidak bisa mengaburkan catatan). Pemeriksaan di smoke HTTP masih mengharapkan `201`, dan
karena harness itu terakhir dijalankan di A.29, salahnya baru kelihatan sekarang.

**Yang diperbaiki**: dua pemeriksaan di `docs/smoke-http-fitur.mjs` menggantikan yang lama, keduanya lewat
HTTP sungguhan — `tamper_suspected` dari klien harus **422**, dan `dom_injection` + `extension_detected` dari
klien harus **201**. Hasil ulang: **243/243 lulus, exit 0** (22,3 detik).

**Batasan jujur**: `dom_injection`/`extension_detected` sudah diterima API, tetapi **frontend belum
mengirimnya** (deteksi tamper sisi klien 2B–2D belum dikerjakan), jadi pemeriksaan ini membuktikan **kontrak
API**, bukan deteksi sungguhan di perangkat murid *(menyusul: pengirim sisi klien di A.53, sisi server di
A.54)*. Pelajaran yang dicatat: pemeriksaan yang tidak ikut `verify.sh` bisa tertinggal tanpa ada yang
merah — inilah contohnya.

---

## A.53 Deteksi Tamper Sisi Klien, Penyorotan Kata Kunci, dan Pencarian pada Ribuan Murid (12 Oktober 2026)

Menutup dua butir "belum" yang disebut apa adanya di A.51 dan A.52: deteksi tamper di perangkat murid
(2B–2C) yang selama ini hanya punya **kontraknya** di server, dan penyorotan kata kunci di hasil pencarian.

### A.53.1 Deteksi tamper halaman (2B–2C)

- **Modul baru** `frontend/src/security/deteksiTamper.js` memeriksa empat hal, semuanya **bukti untuk guru**:
  1. **sumber dari skema extension** — node (script/link/iframe/…) ber-`chrome-extension:`,
     `moz-extension:`, atau `safari-web-extension:` → `extension_detected`;
  2. **fungsi proteksi yang diganti** — `window.addEventListener`, `EventTarget.prototype.addEventListener`,
     `Event.prototype.preventDefault`/`stopPropagation` dibandingkan dengan **sidik jari yang diambil saat
     mulai** (`Function.prototype.toString.call`); yang berubah → `dom_injection`;
  3. **overlay asing** — elemen fixed/absolute/sticky ber-z-index ≥ 1000 yang menutupi area (≥ 200×200 px)
     **dihapus** (dinetralkan) sekaligus dicatat → `dom_injection`;
  4. **kanari yang hilang** — elemen kanari tersembunyi yang kita sisipkan; kalau dihapus/disembunyikan →
     `dom_injection`.
- **Jadwal**: sidik jari + kanari saat mount, pemindaian pertama +4 detik, lalu **tiap 15 detik**, ditambah
  `MutationObserver` dengan jeda gabung 250 ms. Tindakan hanya: hapus node asing, netralkan overlay,
  kaburkan layar **4 detik**.
- **Default MATI dan sengaja TIDAK ikut preset `exam_mode`**: pemindai ini merapikan DOM, jadi rawan salah
  tuduh — guru harus menyalakannya sendiri dengan sadar. Saklar `detect_tamper` ditambahkan ke
  `KunciPengaturan` (backend) dan ke `SAKLAR_RINCI` klien, tetapi **bukan** ke `SAKLAR_PRESET_UJIAN`.
- **Fail-open**: setiap pemeriksaan dibungkus try/catch; `MutationObserver` yang gagal, DOM yang tidak
  lengkap, atau kanari yang tidak bisa disisipkan tidak pernah melempar ke pohon React.

Baseline sidik jari **dibandingkan dengan dirinya sendiri**, bukan dengan anggapan `"[native code]"`:
memeriksa teks native akan salah tuduh di jsdom (dan di sebagian peramban) yang fungsi bawaannya bukan native.

### A.53.2 Penyorotan kata kunci pencarian murid

- Modul murni baru `frontend/src/sections/school/penyorotan.js` (`potongUntukSorot`) memecah teks jadi
  potongan cocok/tidak, dan `HalamanMurid.jsx` merender potongan yang cocok sebagai `<mark>` di **nama, NIS,
  dan email** — tanpa `dangerouslySetInnerHTML`.
- Metakarakter regex (mis. `%`) diperlakukan sebagai huruf biasa, pencocokan tidak peduli huruf besar/kecil,
  dan kata kunci kosong tidak menyorot apa pun.

### A.53.3 Pencarian pada ribuan murid (regresi skala + penyorotan)

- **Tes server skala besar** (`backend/tests/Feature/SekolahTest.php`): satu kelas diisi **1.200 murid**, lalu
  dibuktikan `meta.total = 1201`, halaman pertama tetap dibatasi 50, pencarian nama mengembalikan tepat satu
  baris, pencarian lewat NIS (`ZUL-01`) juga, dan halaman terakhir memuat sisa. Waktunya **±1,24 dtk** — jadi
  masuk gerbang mutu tanpa memperlambat `verify.sh` berarti.
- **Tes unit penyorotan** (`frontend/src/__tests__/sections/school/penyorotan.test.js`) dan **assertion `<mark>`**
  di `pencarian.test.jsx`.

### A.53.4 Verifikasi (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `npx vitest run src/__tests__/security` | **33 lulus** — `deteksiTamper` 12, `useExamSecurity` 8 (termasuk default-mati & overlay dinetralkan), `pengaturanProteksi` 6 (termasuk `detect_tamper` di luar preset), `pengirimKejadian` 7 |
| `php artisan test --filter='pencarian tetap menemukan satu murid di antara ribuan'` | **1 passed (14 assertions)**, ±1,24 dtk untuk 1.200 murid |
| `docs/jalankan-smoke-ui.sh murid` (Chrome sungguhan) | **18/18 lulus, exit 0** — penyorotan tidak merusak pemeriksaan teks |
| `docs/jalankan-smoke-ui.sh slice07` (Chrome sungguhan) | **20/20 lulus, exit 0** — payload proteksi sungguhan memuat `"detect_tamper":false` (default mati) |
| `node docs/smoke-http-fitur.mjs` (backend + realtime hidup) | **243/243 lulus, exit 0** (21,5 dtk) |
| `./verify.sh` | **SEMUA HIJAU (exit 0)** — Pest **333 tes/3178 asersi**, Redis wajib 9 tes/65 asersi, Pint bersih, `npm run check` bersih, ESLint 0 error, Vitest **72 berkas/702 tes**, realtime lulus |

### A.53.5 Berkas

- Baru: `frontend/src/security/deteksiTamper.js`, `frontend/src/sections/school/penyorotan.js`,
  `frontend/src/__tests__/security/deteksiTamper.test.js`,
  `frontend/src/__tests__/sections/school/penyorotan.test.js`
- Diubah: `frontend/src/security/pengaturanProteksi.js` (saklar `detect_tamper`),
  `frontend/src/security/useExamSecurity.js` (wiring pemindai + label), `frontend/src/sections/school/HalamanMurid.jsx`
  (komponen `Sorot`), `frontend/src/__tests__/security/{pengaturanProteksi,useExamSecurity}.test.*`,
  `frontend/src/__tests__/sections/school/pencarian.test.jsx`, `backend/tests/Feature/SekolahTest.php`,
  `backend/app/Sections/Settings/Enums/KunciPengaturan.php` (saklar `DetectTamper`)

### A.53.6 Batasan jujur

- **Deteksi tamper sisi server belum ada** *pada putaran A.53*: endpoint denyut ber-nonce dan sapuan
  (`SapuPresence`) yang mengubah denyut berhenti menjadi `tamper_suspected` menyusul di **A.54**. Yang
  selesai di A.53 adalah sisi **klien** (2B–2C) — pemindai + pengirim untuk `dom_injection` dan
  `extension_detected`; kategori `tamper_suspected` tetap **hanya** milik server.
- **Rawan salah tuduh memang disengaja ditangani dengan default mati**, bukan dengan membuat deteksi jadi
  sempurna: overlay sungguhan buatan extension tetap bisa lolos (mis. yang tidak memakai z-index tinggi
  atau lebih kecil dari 200×200 px), dan sebaliknya overlay guru yang sah ber-z-index tinggi bisa ikut
  dihapus. Karena itu catatannya tetap bahan tinjauan, bukan vonis.
- **Uji tamper berjalan di jsdom**, bukan di peramban sungguhan: yang dibuktikan adalah logika deteksi pada
  DOM yang dikendalikan uji, bukan deteksi terhadap extension Chrome asli.
- **Pencarian tetap `LIKE %kata%`**: uji 1.200 murid membuktikan **kebenaran pada skala itu** dan batas
  halaman, **bukan** waktu tanggap pada puluhan ribu baris; indeks kolom belum terpakai dan full-text belum
  dikerjakan.
- **Penyorotan hanya di halaman Murid**; kotak cari di Kelas, Mapel, dan Bank Soal belum ada.

---

## A.54 Denyut Proteksi Ber-Nonce: Sisi Server Deteksi Tamper (2D) (12 Oktober 2026)

A.53 menutup sisi **klien** deteksi tamper (2B–2C); yang tertinggal adalah **2D**: membuktikan dari sisi
server bahwa sensor di perangkat murid masih hidup. Tanpa itu, murid cukup mematikan protection (menutup
tab, memblokir skrip, melepas pendengar) dan tidak ada yang tahu — catatan `tamper_suspected` sudah ada di
enum dan skornya (9), tetapi belum ada yang menurunkannya.

### A.54.1 Yang dikerjakan

- **Service baru** `backend/app/Sections/Presence/Services/DenyutProteksiService.php`. Bedanya dengan
  kehadiran: kehadiran menjawab "murid masih ada", denyut menjawab "**proteksinya masih hidup**". Keduanya
  dipisah supaya tab yang disembunyikan tetap dianggap online.
- **Nonce + rotasi**: saat kuis disajikan dengan proteksi menyala, server menerbitkan nonce dan menandai
  denyut ditunggu (`aktifkan()`); `terakhir` disetel ke sekarang sebagai **masa tenggang** — murid yang
  berhenti sejak awal tetap terdeteksi, bukan lolos. Klien mengirim denyut tiap 30 detik **membawa nonce
  terakhir**; nonce yang cocok dirotasi (`denyut()`), nonce lama/diulang **ditolak 409 dan tidak
  menyegarkan liveness** — jadi liveness tidak bisa dipalsukan dengan memutar ulang kiriman lama.
- **Endpoint** `POST /api/v1/attempt/{attempt}/denyut` (`KehadiranController@denyut`, `DenyutRequest`,
  `throttle:denyut` 12/menit per akun). Policy `jawab` menjaga: hanya pemilik attempt yang masih berjalan.
- **Payload attempt** kini memuat `denyut: { nonce, interval_detik }` (null bila proteksi tidak menyala,
  dan tidak pernah diterbitkan untuk guru yang meninjau attempt yang sama). `kumpulkan()` memanggil
  `matikan()`.
- **Turunan `tamper_suspected`** di `sapu()`: hanya untuk attempt yang **masih berjalan** dan **belum lewat
  deadline**, hanya **sekali** per attempt (penanda di cache), dan hanya bila denyut berhenti lebih dari
  100 detik. Dipanggil `SapuPresence` (job per menit) **dan** `MonitorService::snapshot()` — supaya guru
  melihat catatannya saat membuka Live Monitor, bukan menit depan.
- **Fail-open**: setiap sentuhan cache di service dibungkus try/catch; Redis mati hanya mematikan denyut,
  bukan ulangannya. `sudahDicetat()` yang gagal membaca mengembalikan `true` supaya sapuan **tidak**
  menumpuk baris baru saat cache bermasalah.

### A.54.2 Perbaikan sampingan: harness HTTP yang rapuh terhadap jumlah murid

Dijalankan ulang untuk regresi, `node docs/smoke-http-fitur.mjs` justru merah **2 dari 235**: *"murid hasil
daftar mandiri muncul di daftar murid guru"* dan *"anggota kelas cukup untuk membuat tim"*. Penyebabnya
**bukan** fitur baru: basis data dev kini menyimpan **211 murid** dari putaran smoke sebelumnya, sedangkan
kedua pemeriksaan itu mengambil `?per_page=200` lalu mencari di halaman pertama. Melewati 200 baris berarti
pemeriksaan gagal walau datanya ada — jadi harness-nya rapuh pada skala, bukan kodenya rusak.

**Yang diperbaiki** (memanfaatkan A.51, bukan menurunkan pemeriksaan): pencarian murid mandiri kini memakai
`filter[cari]` ke emailnya (eksak, sekaligus membuktikan pencarian server bekerja), dan daftar anggota kelas
memakai `filter[class_id]` supaya kelasnya disaring **di server**. Hasil ulang: **247/247 lulus, exit 0**
(22,4 dtk; bertambah 4 pemeriksaan denyut).

### A.54.3 Verifikasi (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `php artisan test --filter=DenyutProteksiTest` | **6 passed (53 assertions)** — rotasi nonce, nonce salah/diulang ditolak tanpa menyegarkan, sapu mencatat sekali, tidak menuduh saat segar/lewat deadline, payload + endpoint, hanya pemilik & hanya saat berjalan |
| `npx vitest run src/__tests__/sections/presence` | **14 lulus / 2 berkas** — termasuk 5 tes hook denyut (tanpa denyut bila proteksi mati, rotasi nonce, 409 → muat ulang, fail-open) |
| `node docs/smoke-http-fitur.mjs` (backend + realtime hidup) | **247/247 lulus, exit 0** (22,4 dtk) — termasuk 4 pemeriksaan baru di bagian K: payload menerbitkan nonce, denyut diterima & nonce dirotasi, nonce lama ditolak 409, nonce palsu ditolak 409 |
| `docs/jalankan-smoke-ui.sh slice07` (Chrome sungguhan) | **20/20 lulus, exit 0** — payload proteksi sungguhan tetap membawa `"detect_tamper":false` |
| `./verify.sh` | **SEMUA HIJAU (exit 0)** — Pest **339 passed (3231 assertions)**, Redis wajib 9/65, Pint bersih, checkJs, ESLint 0 error, Vitest **73 berkas / 707 tes**, realtime 20 |

### A.54.4 Berkas

- Baru: `backend/app/Sections/Presence/Services/DenyutProteksiService.php`,
  `backend/app/Sections/Presence/Http/Requests/DenyutRequest.php`, `backend/tests/Feature/DenyutProteksiTest.php`,
  `frontend/src/sections/presence/useDenyutProteksi.js`,
  `frontend/src/__tests__/sections/presence/denyutProteksi.test.jsx`
- Diubah: `backend/app/Sections/Presence/Http/Controllers/KehadiranController.php`,
  `backend/app/Sections/Presence/Jobs/SapuPresence.php`, `backend/app/Sections/Presence/Services/MonitorService.php`,
  `backend/app/Sections/Attempt/Http/Controllers/AttemptController.php`,
  `backend/app/Sections/Attempt/Http/Resources/AttemptResource.php`,
  `backend/app/Providers/AppServiceProvider.php` (limiter `denyut`), `backend/routes/api.php`,
  `frontend/src/sections/attempt/api.js` (`denyutProteksi` + skema `denyut`),
  `frontend/src/sections/attempt/HalamanKerjakan.jsx` (wiring), `docs/smoke-http-fitur.mjs`

### A.54.5 Batasan jujur

- **Ambang dan jeda adalah nilai tetap**, belum bisa diatur guru: 30 detik per denyut dan 100 detik sebelum
  dicurigai. Jaringan yang putus-putus lebih lama dari itu bisa membuat murid **jujur** tercatat
  `tamper_suspected`; karena itu catatannya tetap bahan tinjauan (skor 9), bukan vonis, dan dedupe-nya satu
  baris per attempt supaya tidak menumpuk.
- **Belum ada uji browser sungguhan untuk denyut**: yang dibuktikan adalah unit hook (jsdom) + kontrak HTTP
  + unit service. Sapuan berkala berjalan lewat penjadwal (`Schedule::job`) yang di mesin dev tidak selalu
  hidup, jadi bukti "guru melihat catatannya otomatis di Live Monitor" bersandar pada `MonitorService` yang
  memanggil `sapu()` saat snapshot, bukan pada cron.
- **Nonce bukan autentikasi**: ia menutup liveness palsu (pemutaran ulang), bukan menggantikan sesi/policy.
  Klien yang benar-benar berhenti mengirim tetap hanya bisa dicurigai setelah ambang — dan murid yang
  menyadari hal itu bisa memutar ulang skrip denyutnya (deteksi browser memang menyimpan batasan ini).

## A.55 Panel Kuis Materi Pindah ke Luar Bingkai Video, dan Bilah Atas yang Tak Lagi Menerobos Tepi (12 Oktober 2026)

Harness GUI baru `docs/smoke-ui-kuis-materi.mjs` (dijalankan lewat `docs/jalankan-smoke-ui.sh kuis-materi`)
mengukur halaman materi **sebagai murid** di dua viewport (390×844 ponsel, 1366×900 laptop) dan menemukan dua
cacat nyata yang selama ini luput karena `smoke-ui-materi` hanya memeriksa *munculnya* panel kuis, bukan
tata letaknya:

1. **Panel kuis sisipan adalah jendela gulir sempit di atas gambar video.** `.pm-kuis` dulu `position:
   absolute` di dalam `.pm-bingkai` dengan `max-height: 80%`, jadi tingginya terikat tinggi bingkai: di
   ponsel bingkai 16:9 selebar 274 px hanya **154 px** tinggi → panel **274×123 px** untuk isi **565 px**
   (dua soal + tombol kumpulkan). Satu soal terpotong, tombol "Simpan jawaban & kumpulkan" berada 425 px di
   bawah tepi panel (harus digulir di dalam jendela sempit), dan panelnya **menutupi gambar video** yang
   sedang diputar di mode "berjalan". Di laptop pun terukur **512×230 px** untuk isi 463 px.
2. **Bilah atas menerobos tepi kanan di ponsel.** Deret merek + akun + dua tombol preferensi + hamburger
   berjumlah ±433 px di dalam `container` ±366 px, dan karena merek tidak boleh menyusut (teks `nowrap`
   tanpa `min-width: 0`) tombol hamburger keluar **55 px** dari layar sehingga **seluruh halaman materi
   bergeser mendatar** — murid harus menggulir ke samping untuk membaca soal.

### A.55.1 Yang dikerjakan

- **Panel kuis keluar dari bingkai video** (`frontend/src/sections/material/PemutarMateri.jsx` +
  `frontend/src/theme/theme.css`): bingkai video dan panel kuis kini bersaudara di dalam satu panggung
  (`.pm-panggung`), sehingga panel tumbuh setinggi isinya dan tidak pernah menutupi gambar. Aturan
  `.pm-kuis-vertikal`, `.pm-kuis-horizontal`, dan `@container` yang lama dihapus; `container-type:
  inline-size` pada `.pm-bingkai` tidak lagi diperlukan.
- **Tata "horizontal" tetap berarti**: `@media (min-width: 1200px)` menaruh panel **di samping** video
  (kolom 1fr + 280 px) saat layar cukup lebar; di bawah itu kedua tata menumpuk ke bawah. Ambang 1200 px
  dipilih karena kolom materi murid hanya ±640 px di layar 1366 px (sebelumnya `horizontal` memeras video
  jadi 220 px lebar).
- **Fokus + pandangan**: saat panel muncul, fokus tetap dipindah ke panel (`preventScroll`) lalu panelnya
  dibawa ke layar dengan `scrollIntoView({ block: 'nearest' })` — dipanggil dengan `?.` karena jsdom tidak
  punya `scrollIntoView`. Panel juga diberi `scroll-margin-block`.
- **Bilah atas bisa menyusut** (`theme.css`): `.kepala-app-isi > .me-auto`, `.merek`, dan `.merek-teks`
  diberi `min-width: 0` + elipsis, dan jarak antar-elemen dirapatkan (`gap: 0.5rem`) di bawah 576 px.
  Elemen akun, preferensi, dan hamburger tetap utuh; hanya nama sekolah yang boleh terpotong elipsis.
- **Garis sisi berwarna di kartu "Perlu perhatian" dihapus** (permintaan pemilik produk): `.perhatian-item` dulu
  `border-left-width: 6px` dengan warna per jenis (monitor hijau / koreksi kuning / avatar biru). Kini bingkainya
  seragam `1.5px solid var(--garis)`; jenisnya tetap terbaca dari **ikon yang berbeda per jenis** (jam/centang/
  bendera) plus judul dan teks ajakan, jadi tidak ada informasi yang hilang. Diperiksa sekali lewat skrip
  sementara di `/tmp` (bukan harness repo): 1 kartu nyata + probe kelas yang sama di halaman beranda sungguhan —
  `LULUS · sisi kiri tidak lagi berwarna (sama dengan sisi lain)`.
- **Klip uji ber-suara tidak lagi berbunyi** (`docs/jalankan-bukti-editor.sh`, `docs/jalankan-smoke-materi.sh`,
  `docs/jalankan-smoke-perjalanan.sh`, `docs/jalankan-smoke-ui.sh`, `docs/jalankan-tangkap-halaman.sh`,
  `docs/smoke-ui-kuis-materi.mjs`): semua Chrome headless dijalankan dengan `--mute-audio`, dan harness kuis
  materi (video uji 5,4 MB berisi audio drum) juga menyetel `video.muted = true` sebelum `play()` — runner
  memakai Chrome :9333 yang **sudah hidup apa adanya**, jadi kalau Chrome itu dinyalakan tanpa flag bisu,
  klipnya bisa berbunyi keluar speaker saat smoke berjalan. Penjaganya kini juga **diukur**: setiap titik
  pengukuran (`__ukurHalaman`) melaporkan media yang sedang diputar tanpa bisu, dan harnessnya menuntut
  daftar itu **kosong** — 6 pemeriksaan baru (48 dari 42 sebelumnya).

### A.55.2 Verifikasi (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `docs/jalankan-smoke-ui.sh kuis-materi` **sebelum** perbaikan tata letak (kontrol negatif, CSS lama) | **27/42 lulus, exit 1** — terukur: panel `274×123` di bingkai `274×154` (isi 565 px, 1 soal terpotong, tombol 425 px di bawah), `posisi: tumpang` (menutupi gambar) di hp **dan** laptop (panel `512×230` di bingkai `512×288`), plus `+55 px` gulir mendatar di hp |
| `docs/jalankan-smoke-ui.sh kuis-materi` **sesudah** perbaikan | **48/48 lulus, exit 0** — hp: panel `274×567` (isi 565 px terbaca penuh, 0 soal terpotong, gulir dalam panel 0, tombol terlihat tanpa gulir), `posisi: bawah`; laptop: tata vertikal panel `512×465` (`posisi: bawah`), tata horizontal panel `280×567` **di samping** bingkai `220×124`; gulir mendatar halaman **0 px** di kedua viewport; tak ada teks keluar panel; semua target sentuh ≥ 44 px |
| `docs/jalankan-smoke-ui.sh mobile` (Chrome beremulasi ponsel, 412×915) | **16/16 lulus, exit 0** — 8 halaman guru bersih dari gulir mendatar setelah perubahan bilah atas, laci + hamburger tetap normal |
| `docs/jalankan-smoke-ui.sh materi` (regresi pemutar video, sengaja dijalankan ulang) | **27/27 lulus, exit 0** — kuis sisipan muncul sendiri, mode "jeda" menahan video, penjelasan tampil setelah dikumpulkan, server tetap menolak menutup video (422) |
| `npx vitest run` (frontend) | **75 berkas / 717 tes lulus** |
| `npx eslint src` (frontend) | 0 error (2 peringatan `react-hooks/incompatible-library` di formulir auth — sudah ada sebelum putaran ini, bukan dari berkas yang diubah) |
| `./verify.sh` (root, sesudah semua suntingan putaran ini) | **SEMUA HIJAU (exit 0)** — Pest, Pint, `npm run check`, ESLint, Vitest, dan realtime (20 tes) semuanya lulus |

### A.55.3 Berkas

- Baru: `docs/smoke-ui-kuis-materi.mjs` (harness GUI kuis di halaman materi; mandiri — soal, kuis, dan
  materi ujinya dibuat di awal dan dihapus lagi di blok `finally`).
- Diubah: `frontend/src/theme/theme.css` (`.pm-panggung`, `.pm-kuis` jadi kartu di luar bingkai, aturan
  `horizontal` ≥1200 px, bilah atas bisa menyusut), `frontend/src/sections/material/PemutarMateri.jsx`
  (panggung + panel + fokus/gulir), `docs/jalankan-bukti-editor.sh`, `docs/jalankan-smoke-materi.sh`,
  `docs/jalankan-smoke-perjalanan.sh`, `docs/jalankan-smoke-ui.sh`, `docs/jalankan-tangkap-halaman.sh`
  (`--mute-audio`), `docs/penjelasan-fitur.md` (tata letak panel kuis diperjelas).

### A.55.4 Batasan jujur

- **Pratinjau editor guru masih menggambar panel kuis di ATAS bingkai** (`.nle-kuis` di `EditorMateri.jsx`).
  Kanvas editor memang kanvas bingkai video, jadi pratinjaunya adalah pratinjau **saat** kuis masuk, bukan
  tata letak akhir di sisi murid — panel murid kini di bawah/samping bingkai. Label di editor ("Vertikal
  (panel di bawah)" / "Horizontal (panel di samping)") sudah cocok dengan perilaku baru, tetapi kanvasnya
  belum menampilkan posisi itu.
- **Tata "horizontal" baru berlaku di viewport ≥ 1200 px.** Di laptop 1366 px kolom materi murid hanya
  ±640 px lebar, sehingga kedua tata tampil menumpuk ke bawah; ini disengaja supaya video tidak diperas.
- **Angka yang diukur berasal dari dua ukuran viewport** (390×844 ponsel, 1366×900 laptop) dengan berkas
  video uji di DB dev; lebar layar lain tidak diperiksa.
- Emulasi ponsel tetap emulasi: bukti ini dari Chrome headless + CDP, bukan dari perangkat fisik.

---

## A.58 Tombol Ukuran Tulisan Dibuang (12 Oktober 2026)

Permintaan pemilik produk, singkat: **"buang button resize teks"** — setelah ditanya, yang dimaksud adalah
tombol **Ukuran tulisan: Normal/Besar** di **bilah atas** (fitur A.49). Saya tidak langsung menghapus satu
tombol saja: karena tombol itu **satu-satunya** jalan masuk ke fiturnya, membuangnya saja akan meninggalkan
mesin mati — atribut `data-ukuran` di `<html>`, kunci `localStorage: ukuran-ulangan`, skala `--s: 1,12`,
ikon huruf, dan satu berkas tes yang menguji tombol yang sudah tidak ada. Jadi seluruh fiturnya dibuang,
dan yang tinggal di `theme.css` hanya token skala tunggal `--s: 1` (tempat tunggal bila suatu saat skala lain
dibutuhkan lagi), dengan komentar yang menyebut riwayatnya apa adanya.

### A.58.1 Apa yang berubah

| Bagian | Sebelum (A.49) | Sesudah (A.58) |
| --- | --- | --- |
| Bilah atas halaman guru | tombol tema + **tombol ukuran** | tombol tema saja |
| Halaman masuk | tombol tema + **tombol ukuran** (panel + pojok kanan atas) | tombol tema saja di keduanya |
| `<html>` | `data-ukuran="normal\|besar"` | atribut itu tidak pernah dipasang |
| `localStorage` | `ukuran-ulangan` dibaca & ditulis | kunci itu tidak dibaca lagi (kalau masih ada, tidak berefek) |
| `theme.css` | `--s: 1` + `:root[data-ukuran='besar'] { --s: 1.12 }` | `--s: 1` saja |
| `icons.jsx` | `IkonHuruf` + `daftarIkon.huruf` | keduanya dibuang (tidak ada pemakai lain) |

### A.58.2 Bukti

| Yang dijalankan | Hasil |
| --- | --- |
| `docs/jalankan-smoke-ui.sh bilah-atas` (**baru**, Chrome + layanan hidup) | **10/10 lulus, exit 0** — di `/masuk` dan `/kelas`: 0 tombol berlabel "Ukuran tulisan", `data-ukuran` **null**, tombol tema masih ada di panel **dan** pojok kanan atas, isi halaman tetap ter-render; menu di bilah atas tersisa `Keluar · Ganti ke mode terang · Buka menu`; kunci lama `ukuran-ulangan=besar` ditulis lalu halaman dimuat ulang → atribut tetap null dan ukuran huruf `<html>` **16px → 16px** |
| `./verify.sh` (root, sesudah semua suntingan putaran ini) | **SEMUA HIJAU (exit 0)** — Pest **340 lulus (3242 asersi)**, Redis wajib **9 lulus (65 asersi)**, Pint **PASS 354 berkas**, `npm run check`, ESLint **0 error** (2 peringatan lama `react-hooks/incompatible-library`), Vitest **74 berkas / 713 tes**, realtime **20/20** |
| `docs/jalankan-smoke-ui.sh mobile` (**A.58**, regresi bilah atas di 8 halaman guru beremulasi ponsel) | **16/16 lulus, exit 0** |
| `docs/jalankan-smoke-ui.sh nav` (**A.58**, regresi navbar 390 px & 1280 px) | **14/14 lulus, exit 0** |
| `npx vitest run` (frontend) | **74 berkas / 713 tes lulus** — turun tepat 4 tes & 1 berkas dari A.55 (**75/717**) karena `theme/ukuran.test.jsx` pensiun bersama fiturnya; tidak ada tes lain yang merah |

Pemeriksaan pertama dijalankan sebagai skrip sekali pakai, lalu **diangkat jadi harness tetap**
`docs/smoke-ui-bilah-atas.mjs` supaya klaim "tombolnya hilang" bisa dijalankan ulang siapa pun — dan baris
kedua tabel di atas adalah hasil menjalankannya lewat runner resmi, bukan hasil skrip sementara.

### A.58.3 Berkas

- **Dihapus:** `frontend/src/shared/layout/TombolUkuran.jsx`,
  `frontend/src/__tests__/theme/ukuran.test.jsx`, `docs/smoke-ui-ukuran.mjs`.
- **Baru:** `docs/smoke-ui-bilah-atas.mjs`.
- **Diubah:** `frontend/src/shared/layout/KerangkaUmum.jsx` (impor + pemakaian + docstring bilah atas),
  `frontend/src/shared/layout/KerangkaAuth.jsx` (dua pemakaian), `frontend/src/shared/store/tema.js`
  (kunci/`skemaUkuran`/`bacaUkuranAwal`/`terapkanUkuran`/`ubahUkuran`/`mulaiUkuran` dibuang),
  `frontend/src/main.jsx` (`mulaiUkuran()` tidak dipanggil lagi), `frontend/src/icons.jsx`,
  `frontend/src/theme/theme.css`, `docs/penjelasan-fitur.md` (bagian 13 ditulis ulang),
  `docs/catatan-demo.md` & `docs/handoff-sesi.md` (perintah `ukuran` dibuang, A.49 ditandai dibatalkan),
  `docs/rencana-desain-putaran3.md` (baris A.49 jadi "dibatalkan"), `docs/laporan-pengujian.md` (entri ini),
  dan dua ekspor Word yang ikut disegarkan (`docs/word/penjelasan-fitur.docx`,
  `docs/word/laporan-pengujian.docx`).

### A.58.4 Batasan jujur

- **Pemeriksaan A.49 ikut pensiun.** `docs/smoke-ui-ukuran.mjs` (11 pemeriksaan) dan 4 tes
  `theme/ukuran.test.jsx` dihapus karena menguji UI yang sudah tidak ada; yang menggantikannya adalah
  `smoke-ui-bilah-atas.mjs` — ia menjaga **ketiadaan** fitur itu, bukan menguji ulang ukuran tulisan.
- **Kunci `ukuran-ulangan` di perangkat lama tidak dibersihkan.** Kode tidak lagi membacanya, jadi tidak ada
  efek apa pun (dibuktikan harness: tetap 16px). Saya sengaja **tidak** menambah kode pembersih hanya untuk
  satu kunci mati.
- **Dokumen Word disegarkan sebagian, dengan sadar.** `docs/word/penjelasan-fitur.docx` dan
  `docs/word/laporan-pengujian.docx` dikonversi ulang dengan `python3 docs/export_docx.py` (pandoc tidak ada
  di mesin ini). **`docs/export-word.sh` utuh tidak dijalankan** karena langkah pertamanya mengekspor log
  mentah sesi (±54 MB ter-gzip, di atas ambang peringatan GitHub 50 MB) — dan memasukkan log mentah masih
  ditahan atas keputusan pemilik produk; `docs/word/log-mentah.docx` karena itu tertinggal di 10 Okt.
- **Angka bilah atas diukur di Chrome headless + CDP** pada `localhost:5173` (proxy Vite ke backend 8000),
  bukan di perangkat fisik; dua viewport yang dipakai adalah bawaan harness (ponsel 390×844, laptop
  1366×900).

---

## A.59 Ringkasan Setelan Sesi + Tautan Siswa di Langkah 3 Editor Kuis (12 Oktober 2026)

Permintaan pemilik produk, apa adanya (salah ketik dibiarkan, supaya jelas apa yang diminta): *"ingat pada
/kusi pengaturan nya ada ya buat berskala form yang di nyalakan anti cheat apa saja di session itu, mode
ofline di pakai? dll baut dalam skala form itu dan buat lebih ringkas dan juga tombol tobmol nya dan baut aagr
spawn link nya untuk di abgikan siswa"*.

Tiga hal saya tanyakan lebih dulu daripada menebak, dan jawabannya yang menentukan arah kerja:

1. **tempatnya** — bukan di daftar `/kuis`, bukan di `/pengaturan`, melainkan **langkah 3 editor kuis**
   (“Tinjau dan publikasi”), tepat sebelum guru menekan Publikasikan;
2. **tautan siswa** — tautan **di dalam aplikasi**, dan harus **kompatibel bila guru mengaktifkan izin siswa
   tamu** (mode tamu tanpa akun);
3. **mode luring** — **tidak perlu ada keterangannya** di form itu: *"biarkan bekerja saja"*.

### A.59.1 Apa yang dibuat

**Panel “Setelan sesi ini” (ringkas, tiga baris)** di langkah 3, diisi dari `GET /v1/pengaturan?kuis_id=`
(resolusi tiga lapis yang sudah ada, hanya guru/admin):

| Baris | Isi |
| --- | --- |
| Proteksi | jumlah saklar anti-cheat yang menyala + namanya; **kalau saklar induk mati, dikatakan terus terang “tidak ada proteksi yang dipasang”** walaupun saklar rinci menyala |
| Siswa tamu | boleh ikut tanpa akun atau tidak, beserta lapis penentunya (kuis ini / kelas / sekolah, dari kolom `sumber`) |
| Aturan lain | ulangan ulang, peringkat, mode tim, layar guru, rekam diri — nyala/mati dalam satu baris teks |

**Tombol “Buat tautan siswa”** (ikon tautan baru) menghasilkan kotak tautan `…/kuis/<id>` + tombol
**Salin tautan** (papan klip, dengan jatuh-baik yang jujur bila peramban menolak) + catatan jujur yang
muncul sesuai keadaan: kuis masih draf (tautan baru hidup setelah diterbitkan) dan/atau pintu tamu terbuka.

**Tautan itu kompatibel dengan mode tamu — dan itu diuji, bukan diklaim.** Dua hal yang dibuat untuk itu:

- `/kuis/<id>` memang halaman yang boleh dibuka akun tamu: `KuisPolicy::view` memakai `izinkan_tamu`
  ketimbang “kelasmu” untuk akun tamu (`TamuService::izinkanKuis`), sudah ada sejak slice tamu;
- **jalur pulang setelah masuk (`state.lanjut`)**: router mengantar pengunjung tanpa sesi ke halaman masuk
  sambil membawa tujuan asalnya, lalu mengembalikannya ke sana setelah masuk — lewat akun **maupun** lewat
  pintu tamu. Nilai itu divalidasi `tujuanLanjut()` (hanya jalur internal, menolak `//host`, `\`, dan skema
  lain) supaya tidak jadi redirect terbuka.

Aturan ringkasannya ditaruh sebagai logika murni di `frontend/src/sections/quiz/setelanSesi.js` (tanpa DOM)
supaya bisa diuji tanpa peramban: **17 tes** menutup saklar induk mati, payload API yang rusak, kelompok
pengaturan yang bukan proteksi, ambang bilangan bulat yang bukan saklar, dan pagar `tujuanLanjut`.

### A.59.2 Bukti

| Yang dijalankan | Hasil |
| --- | --- |
| `docs/jalankan-smoke-ui.sh setelan-sesi` (**baru**, Chrome + layanan hidup) | **23/23 lulus, exit 0** — lihat rincian di bawah |
| `./verify.sh` (root, sesudah semua suntingan) | **SEMUA HIJAU (exit 0)** — Pest **340 lulus (3242 asersi)**, Redis wajib **9 lulus (65 asersi)**, Pint **PASS 354 berkas**, `npm run check`, ESLint **0 error** (2 peringatan lama), Vitest **75 berkas / 730 tes**, realtime **20/20** |
| `docs/jalankan-smoke-ui.sh mobile` (**A.59**, regresi layar ponsel) | **16/16 lulus, exit 0** |
| `docs/jalankan-smoke-ui.sh kuis-manual` (**A.59**, regresi alur kuis manual) | **13/13 lulus, exit 0** |
| `npx vitest run` (frontend) | **75 berkas / 730 tes lulus** — naik 1 berkas & 17 tes dari A.58 (74/713), semuanya dari `setelanSesi.test.js` |

Rincian harness baru — semuanya diukur di peramban, bukan dibaca dari berkas sumber:

```
✅ tanpa sesi: diarahkan ke halaman masuk — path=/masuk
✅ tanpa sesi: tujuan asal dibawa (state.lanjut) — lanjut=/kuis
✅ setelah masuk (formulir sungguhan): kembali ke halaman asal (/kuis)
✅ pintu tamu lapis sekolah dibuka untuk uji — status=200 · semula=false
✅ tamu: formulir "ikut sebagai siswa tamu" tampil
✅ tamu: mendarat di tujuan tautan (/avatar), bukan tujuan bawaan tamu (/kuis)
✅ langkah 3: panel "Setelan sesi ini" tampil (3 baris ringkas + tombol "Buat tautan siswa")
✅ tautan = alamat aplikasi + /kuis/220
✅ panel: 2 proteksi aktif sama dengan resolusi server (setelan uji: anti_cheat + block_paste + block_tab_switch)
✅ panel: baris siswa tamu sama dengan resolusi server (tamu=true · sumber=kuis)
✅ panel: catatan draf + catatan pintu tamu muncul apa adanya
✅ tombol "Salin tautan" mengisi klip papan (dibaca kembali = tautan)
✅ kuis uji dihapus kembali — status=200
✅ pintu tamu lapis sekolah dimatikan lagi sesudah uji — semula=false · sekarang=false
```

Yang membuat pemeriksaan panel kuat: angka di layar dibandingkan dengan **resolusi server dihitung ulang
oleh modul aplikasi yang sama** (`ringkasSetelan` diimpor harness dari `sections/quiz/setelanSesi.js`),
bukan dengan angka yang ditulis di harness. Jadi bila ringkasan di layar menyimpang dari aturan produk,
harness-nya merah.

### A.59.3 Berkas

- **Baru:** `frontend/src/sections/quiz/setelanSesi.js` (logika murni),
  `frontend/src/__tests__/sections/quiz/setelanSesi.test.js` (17 tes), `docs/smoke-ui-setelan-sesi.mjs`.
- **Diubah:** `frontend/src/sections/quiz/HalamanKuis.jsx` (panel + tombol + kueri resolusi + catatan),
  `frontend/src/App.jsx` (`KeMasuk` + jalur pulang `state.lanjut` divalidasi `tujuanLanjut`),
  `frontend/src/icons.jsx` (ikon `IkonTautan` + entri `daftarIkon`), `docs/penjelasan-fitur.md` (bagian 5
  ditambah “Melihat akibatnya sebelum kuis diterbitkan”), `docs/catatan-demo.md`,
  `docs/handoff-sesi.md`, `docs/laporan-pengujian.md` (entri ini), dua ekspor Word.

### A.59.4 Batasan jujur

- **Panel itu hanya membaca.** Mengubah saklar tetap di halaman Pengaturan (tautan ke sana disediakan bila
  resolusinya gagal dimuat) — halaman editor tidak menambah jalur tulis baru, jadi tidak ada risiko guru
  mengubah pengaturan kelas/sekolah tanpa sadar dari tempat yang salah.
- **Mode luring tidak ditampilkan** karena itu keputusan pemilik produk (*"biarkan bekerja saja"*). Jadi
  panel ini **tidak** memberi tahu bahwa jawaban ditahan lokal saat jaringan putus — perilaku luring sendiri
  tidak berubah (lihat `sections/attempt/luring.js`).
- **Saklar induk anti-cheat tetap ditampilkan sebagai mati walau saklar rinci menyala** — itu memang perilaku
  sistemnya (tanpa induk, tidak ada sensor yang dipasang), dan panel menyebutnya apa adanya.
- **Baris `settings` sisa dari kuis uji tidak bisa dihapus lewat API** (tidak ada endpoint hapus pengaturan).
  Harness mengembalikan nilainya ke bawaan sebelum menghapus kuisnya, sehingga baris sisa itu tidak bisa
  terpakai lagi — sama seperti peninggalan putaran-putaran sebelumnya (mis. kuis 158–194). Pintu tamu lapis
  **sekolah** selalu dimatikan lagi di akhir uji karena satu saklar itu membuka semua kuis terbit untuk tamu.
- **Perubahan perilaku kecil yang disengaja:** halaman yang butuh sesi kini **kembali ke halaman asal**
  setelah masuk, bukan selalu ke beranda. Untuk siswa tamu, bila tidak ada tujuan asal, tetap ke daftar
  ulangan tamu (perilaku lama).
- **Angka diukur di Chrome headless + CDP** pada `localhost:5173` (proxy Vite ke backend 8000). Tautan yang
  diuji memakai alamat pengembangan; di produksi tautannya mengikuti alamat yang sedang dibuka
  (`window.location.origin`), bukan alamat dev.

---

## A.60 Aksi Beranda Jadi Tombol Ikon, Monitor Ulangan, Pengaturan per Ulangan, dan Sisa Temuan Audit (12 Oktober 2026)

Empat permintaan pemilik produk dikerjakan dalam satu putaran, masing-masing dengan perubahan
sekecil yang bisa menjelaskan dirinya sendiri, lalu ditutup dengan membereskan **tiga temuan audit
tampilan yang masih terbuka sejak A.55** (bagian 0.5 handoff). Satu utang lama ikut dibayar di
putaran yang sama: impor murid yang menolak berkas guru hanya karena **judul kolomnya** berbeda.

### A.60.1 Impor murid menerima judul kolom yang lazim di berkas guru

Berkas buatan guru hampir tidak pernah memakai judul persis template: Excel menulis **„Nama Lengkap”**,
Google Sheets „Nama Murid”, dan email sering ditulis **„E-mail”**. Dulu semuanya berhenti di `422`
*„Kolom wajib tidak ditemukan: nama”* padahal isi berkasnya sudah benar — guru disalahkan atas nama
kolom, bukan atas isinya.

`ImporMuridService` kini mengenali kolom wajib (`nama`, `email`, `kelas`), kolom opsional (`nis`,
`nisn`, `kata_sandi`), dan peta alias (`nama lengkap`/`nama murid`/`nama siswa` → `nama`;
`e-mail`/`email murid`/`email siswa` → `email`; `nama kelas` → `kelas`; `nomor induk siswa` → `nis`;
`nomor induk siswa nasional` → `nisn`; `password`/`sandi` → `kata_sandi`).

Aturan pemetaannya sengaja **dua tahap**: nama resmi diperiksa lebih dulu untuk semua kolom, baru
alias dipakai — dan hanya untuk kolom yang belum ketemu. Berkas yang memuat „Nama Lengkap” *dan*
„nama” sekaligus karena itu memakai kolom **`nama`**, bukan kolom terakhir yang kebetulan dibaca.
Dua tes baru menutup keduanya (berkas ber-alias penuh, dan tabrakan resmi-vs-alias).

### A.60.2 Beranda: aksi jadwal jadi tombol ikon 44 px

Tombol „Pantau / Lanjutkan / Lihat detail” di daftar jadwal beranda dulu tombol bertulisan yang
memakan satu baris penuh per kartu. Sekarang satu tombol ikon persegi 44 px (`TombolTautIkon` baru
di `shared/ui/Tombol.jsx`, pasangan tautan dari `TombolIkon` yang sudah ada): **mata** untuk
„Pantau” (kuis sedang berjalan), **pensil** untuk „Lanjutkan menyusun”, **lembar soal** untuk
„Lihat detail”.

Ikon saja tidak boleh jadi teka-teki: `label` wajib dan berisi objeknya — `aria-label` **sekaligus**
tooltip berbunyi „Pantau: Ulangan Operasi Hitung”, dan teks yang sama disimpan sebagai
`<span class="sr-saja">` supaya pembaca layar tetap membacanya utuh.

### A.60.3 „Live Monitor” menjadi „Monitor Ulangan”, lencana jalur data dibuang

Halaman **Monitor Ulangan** tidak lagi memajang jargon teknis. Empat tempat diganti nama (judul
halaman, jejak kepala halaman, tombol di detail kuis, tombol di halaman layar kelas) dan **lencana
„Langsung (SSE)” / „Polling 5 detik” di kepala halaman Monitor dibuang** — yang penting bagi guru
adalah papan pantauannya, bukan cara datanya datang; kanal SSE-nya sendiri tetap bekerja seperti
semula (dibuktikan smoke slice 07, termasuk pemeriksaan yang menuntut jargon itu **tidak** kembali).
Komentar kode di `sections/cheat`, `sections/presence`, `shared/api/realtime.js`, dan `routes.js` ikut
memakai nama baru supaya kode dan layar tidak menyebut dua nama untuk satu halaman.

**Yang sengaja TIDAK diubah:** lencana „Langsung (SSE)” / „Polling 5 detik” di halaman **layar kelas**
(`HalamanLayar.jsx`) tetap ada — di sana lencana itu menjawab pertanyaan yang memang milik halaman itu
(„apakah siaran saya sedang hidup?”), bukan jargon yang bocor. Permintaan pemilik produk juga spesifik
menyebut papan pantau guru.

Kartu ringkas Monitor (`px-3 py-2`) juga berganti ke `p-3` supaya isinya tidak lagi mepet garis tepi.

### A.60.4 Halaman Pengaturan diskalakan **per ulangan**, bukan per akun

Permintaan pemilik produk apa adanya: *„pidnahkan /pengaturan ke scale nay per ulangan/form bukan
perakun”*. Karena satu instalasi = satu sekolah, lapis „sekolah” dulu terasa seperti setelan akun.

Sekarang `lingkup.js` hanya menyusun **satu daftar: ulangan milik guru** (`kuis:<id>`), dan
`HalamanPengaturan.jsx` hanya punya satu pemilih („Ulangan yang diatur”). Lapis sekolah dan kelas
**tetap berlaku di server** dan tetap bisa mengunci sebuah nilai; halaman ini menampilkan akibatnya
(„dikunci sekolah”) tanpa lagi menjadi tempat menyetelnya — saklar yang dikunci tampil mati, dan
tombol massal melewatinya sambil melaporkan berapa yang dilewati. Keputusan siapa yang boleh
menyentuh lapis mana tetap di server (K-05), jadi guru lain tidak bisa membuka ulangan bukan miliknya.
Uji logika murninya ikut dipersempit: 9 tes tiga-lapis → **6 tes satu-lapis** (`kuis:<id>` sah,
`sekolah`/`kelas:7`/`kuis:0`/`kuis:abc` ditolak alih-alih ditebak).

### A.60.5 Tiga temuan audit tampilan ditutup (dan dua di antaranya cacat alat, bukan cacat layar)

Audit A.55 menyisakan tiga baris: (1) *KONTRAS 2.77* pada `span.sr-saja`, (2) satu tautan setinggi
**19 px** di *Koreksi kuis*, (3) `422` di konsol saat membuka *Kerjakan kuis*. Semuanya selesai,
dengan pemisahan jujur antara cacat layar dan cacat alat ukur:

| Temuan | Sifatnya | Yang dikerjakan |
| --- | --- | --- |
| KONTRAS 2.77 pada `span.sr-saja` (±600 hitungan di 12 halaman) | **cacat alat**: teks hanya-pembaca-layar dipotong 1×1 px, jadi kontrasnya tak pernah dilihat manusia | `audit-ui.mjs` melewati elemen di dalam `.sr-saja` pada pemeriksaan kontras — sama seperti yang sudah dilakukan pemeriksaan target-sentuh dan nama-aksesibel |
| tautan jejak **19 px** di Koreksi kuis | **cacat layar (nyata)**: pautan sebaris di kepala halaman jadi sasaran terkecil di halaman guru | `.kepala-halaman-jejak a` di `theme.css`: kotak sentuh dinaikkan ke **44 px** dengan `min-height`, kelebihan tingginya ditarik kembali `margin-block` negatif — jadi **tata letak tidak bergeser** (dibuktikan A/B di bawah) |
| `422` di konsol saat membuka Kerjakan kuis | **bukan cacat**: server memang menolak memulai kuis yang jadwalnya sudah lewat, dan halaman menampilkannya sebagai banner rapi | `audit-ui.mjs` kini memprioritaskan ulangan yang `sedang_berjalan`, dan bila tidak ada, halaman tetap diperiksa dalam keadaan banner dengan galat `/mulai` yang disengaja **disaring** (cacat lain tetap dilaporkan) + satu baris `CATATAN` dicetak terang-terangan |

Bukti tata letak tidak bergeser (diukur lewat CDP di 390×844, halaman Koreksi vs Monitor sebagai acuan):

```
/kuis/191/koreksi SESUDAH {kotakTarget: 94×44 · kotakJejak: 22 · h1Atas: 152}
/kuis/191/koreksi SEBELUM  h1Atas 152      ← aturan 44 px dimatikan sementara lewat <style>
/kuis/191/monitor SESUDAH {kotakTarget: 366×22 · kotakJejak: 22 · h1Atas: 127}   (jejak teks, acuan)
```

Tinggi baris jejak tetap **22 px** di kedua halaman dan posisi judul (`h1Atas`) **identik** dengan
keadaan sebelum aturan dinyalakan — yang berubah hanya kotak sentuhnya.

### A.60.6 Bukti (dijalankan, bukan klaim)

| Yang dijalankan | Hasil |
| --- | --- |
| `./verify.sh` (root, sesudah semua suntingan) | **SEMUA HIJAU (exit 0)** — Pest **342 lulus (3251 asersi)**, Redis wajib **9 lulus (65 asersi)**, Pint **PASS 354 berkas**, `npm run check`, ESLint **0 error** (2 peringatan lama), Vitest **75 berkas / 727 tes**, realtime **20/20** |
| `node docs/audit-ui.mjs` (guru+murid × hp 390 px + laptop 1366 px, 34 halaman) | **seluruh halaman BERSIH; ringkasan cacat `{}`** (sebelumnya `{kontras: 606, targetKecil: 2, galatKonsol: 2}`) |
| `docs/jalankan-smoke-ui.sh pengaturan` (**A.60**, skala per ulangan) | **6/6 lulus, exit 0** — termasuk „lingkup pengaturan hanya per ulangan (tanpa lapis sekolah/kelas)” dengan **120 opsi ulangan** |
| `docs/jalankan-smoke-ui.sh slice07` (**A.60**, nama + jargon monitor) | **21/21 lulus, exit 0** — termasuk „halaman Monitor Ulangan tampil dengan baris murid” dan „monitor tidak memakai jargon jalur data di layar guru” |
| `docs/jalankan-smoke-ui.sh slice06` (**A.60**, halaman Koreksi setelah aturan 44 px) | **28/28 lulus, exit 0** |
| `docs/jalankan-smoke-ui.sh slice04` (**A.60**, jalur soal penuh di halaman pengerjaan) | **18/18 lulus, exit 0** |
| `docs/jalankan-smoke-ui.sh mobile` (**A.60**, regresi layar ponsel 390 px) | **16/16 lulus, exit 0** |
| `docs/jalankan-smoke-ui.sh nav` (**A.60**, regresi navbar 390 px & 1280 px) | **14/14 lulus, exit 0** |
| `npx vitest run` (frontend) | **75 berkas / 727 tes lulus** — turun 3 tes dari A.59 (730) karena uji lingkup sekolah/kelas pensiun bersama lapisnya (9 → 6 tes) |

### A.60.7 Berkas

- **Diubah (backend):** `backend/app/Sections/School/Services/ImporMuridService.php`,
  `backend/tests/Feature/ImporMuridTest.php` (+2 tes).
- **Diubah (frontend):** `frontend/src/shared/ui/Tombol.jsx` (`TombolTautIkon`),
  `frontend/src/sections/home/Beranda.jsx` (aksi jadwal jadi ikon + label objek),
  `frontend/src/sections/cheat/HalamanMonitor.jsx` (nama, lencana dibuang, `p-3`),
  `frontend/src/sections/quiz/HalamanKuisDetail.jsx` & `frontend/src/sections/presence/HalamanLayar.jsx`
  (label tombol „Monitor Ulangan”), `frontend/src/sections/settings/HalamanPengaturan.jsx` +
  `frontend/src/sections/settings/lingkup.js` (satu lingkup: ulangan),
  `frontend/src/__tests__/sections/settings/lingkup.test.js` (6 tes),
  `frontend/src/theme/theme.css` (`.kepala-halaman-jejak a`).
- **Diubah (harness/docs):** `docs/audit-ui.mjs` (lewati `.sr-saja`, pilih ulangan yang sedang
  berjalan, saring 422 `/mulai`, label „Monitor Ulangan”), `docs/smoke-ui-pengaturan.mjs`,
  `docs/smoke-ui-slice07.mjs`, `docs/penjelasan-fitur.md`, `docs/catatan-demo.md`,
  `docs/handoff-sesi.md`, `docs/laporan-pengujian.md` (entri ini).

### A.60.8 Batasan jujur

- **Halaman pengerjaan tidak diperiksa penuh oleh `audit-ui.mjs` di mesin ini.** Akun murid uji
  (`smoke.murid@sekolah.test`) tidak punya ulangan yang jadwalnya sedang berjalan, jadi yang diaudit
  adalah **keadaan banner** „belum bisa dibuka” (bukan layar soal). Jalur soal penuh tetap dijaga
  smoke lain: `docs/jalankan-smoke-ui.sh slice04` **18/18** dan `… kuis-materi` dijalankan di
  putaran-putaran sebelumnya. Audit tidak mengubah jadwal kuis untuk memaksa halaman terbuka karena
  janjinya adalah „tidak mengubah data”.
- **Galat `/mulai` disaring, bukan dibuang diam-diam.** Penyaringan berlaku **hanya** untuk URL
  `/api/v1/kuis/<id>/mulai` pada halaman pengerjaan, dan hanya saat tidak ada ulangan yang sedang
  berjalan; baris `CATATAN` mencetak alasannya, dan cacat konsol lain di halaman itu tetap merah.
- **Keluarkan `1lh` punya cadangan, bukan jaminan.** `margin-block: calc((44px - 1lh) / -2)` didahului
  `margin-block: -11px` untuk peramban yang belum mengenal satuan `lh`; angka 11 px dihitung dari
  tinggi baris jejak **22 px** pada satu-satunya skala tulisan sekarang (`--s: 1`, A.58). Kalau skala
  itu dihidupkan kembali, cadangannya perlu ikut ditinjau.
- **Kotak sentuh 44 px itu menjulur ke atas dan ke bawah baris teksnya** (±11 px). Bagian bawah
  menumpuk tepi atas area `<h1>` yang tidak bisa diklik, jadi tidak ada aksi yang salah terpicu —
  tetapi letaknya memang lebih tinggi daripada teks yang terlihat, dan itu disengaja demi
  mempertahankan tata letak.
- **Angka diukur di Chrome headless + CDP**, bukan perangkat fisik; dua viewport yang dipakai adalah
  bawaan harness (ponsel 390×844, laptop 1366×900).

## A.61 — Soal boleh diperbaiki di tengah ulangan (13 Oktober 2026)

### A.61.1 Kebijakan yang berubah

Permintaan pemilik produk: *"soal boleh diubah di tengah-tengah quiz namun langsung ada informasi dan di
refresh (pastikan sistem backup jawaban sudah ada) … sidebar harap flex agar tidak ada scrollbar … saat
proses pembuatan susun soal buat spesifik per soalnya, jangan dipaksa semua dalam isian."*

| Dulu | Sekarang |
| --- | --- |
| Soal yang dipakai kuis **sedang berjalan** tidak bisa diubah sama sekali (server menolak 422). | **Isi soal boleh diperbaiki** (teks, opsi, media) walau ulangannya sedang jalan. |
| — | **Kunci jawaban, skor, dan jenis soal tetap ditolak** selama kuis berjalan: penilaian attempt yang sedang berjalan memakai ketiganya. |
| Murid yang sedang mengerjakan tetap membaca soal versi lama sampai gurunya mengumpulkan. | Murid **diberi tahu** ("Guru memperbarui soal") lalu payload soal **dimuat ulang** tanpa reload halaman; **jawaban yang sudah diketik tetap utuh**. |
| Editor soal: pemilih jenis soal ada di **bawah** formulir, di dalam kartu lipat. | Jenis soal dipilih **pertama (langkah 1)** — isian di bawahnya hanya yang khusus tipe itu. |
| Kunci jawaban hanya terbaca dari radio tiap opsi. | Ada **ringkasan "Kunci jawaban soal ini" di bawah soal** (satu kalimat untuk seluruh soal). |
| Panel "Susunan kuis" menaruh total di kepala panel. | Total ("X soal · Y poin") ada di **bawah daftar** susunan sebagai hasil akhir. |

### A.61.2 Cara kerjanya (tanpa mengubah aturan "do not trust client")

- **Cap versi isi soal** dihitung server dari daftar soal attempt (`AttemptService::versiSoal()`): satu hash
  kecil berisi *id soal + skor + isi + kunci*, dan id yang sudah hilang ditulis `hilang` supaya penghapusan
  pun terdeteksi. Cap ini ikut di payload attempt (`versi_soal`, `soal_diubah_at`) dan tersedia lewat
  `GET /v1/attempt/{attempt}/versi-soal` sehingga klien tidak perlu memuat seluruh soal berkali-kali.
- **Layar pengerjaan** memeriksa cap tiap **20 detik** (dan begitu murid kembali ke tab — `focus` /
  `visibilitychange`); tab yang sedang tersembunyi tidak ditanyai. Kalau capnya berubah: spanduk
  "Guru memperbarui soal" muncul **dan** payload dimuat ulang lewat jalur yang sama dengan tombol
  lanjut attempt (`POST /kuis/{kuis}/mulai` — server mengembalikan attempt yang sama, bukan attempt baru).
- **Jawaban tidak hilang** karena jawaban tidak pernah bergantung pada payload soal: jawaban hidup di state
  `perubahan` + cadangan perangkat (`simpananJawaban`, Zustand persist). Inilah "sistem backup jawaban"
  yang diminta — dan ia sudah ada sejak slice 04, jadi kebijakan baru tidak menambah risiko baru.
- **Fail-open**: pemeriksaan versi yang gagal (jaringan/5xx/401) hanya didiamkan; ulangan tidak terganggu.
- Server tetap penentu: kunci/skor/tipe ditolak 422 di `SoalService::perbarui()` lewat
  `pastikanPerubahanAmanSaatBerjalan()`, dan kunci lama wajib tetap "masuk" ke isi baru (dijaga registry
  tipe soal) supaya penilaian attempt berjalan tidak kehilangan acuannya.

### A.61.3 Bukti (dijalankan, bukan klaim)

| Yang dijalankan | Hasil |
| --- | --- |
| `./verify.sh` (root, seluruh pagar mutu) | **SEMUA HIJAU (exit 0)** — Pest **344 lulus (3290 asersi)**, Redis wajib **9 lulus (65 asersi)**, Pint **354 berkas bersih**, checkJs, ESLint **0 error** (2 peringatan lama), Vitest **75 berkas / 727 tes**, realtime **20/20** |
| `./vendor/bin/pest tests/Feature/AttemptTest.php tests/Feature/BankSoalTest.php` | **39 lulus (334 asersi)** — termasuk "saat kuis berjalan, isi soal boleh diperbaiki tetapi kunci, skor, dan jenis soal tidak" |
| `npm run check` (tsc, checkJs strict) | **exit 0** |
| `npx eslint` (berkas yang disunting) | **0 error** |
| `npx vitest run` (frontend) | **75 berkas / 727 tes lulus** |
| `docs/jalankan-smoke-ui.sh soal-berubah` (**harness baru**, browser sungguhan) | **19/19 lulus, exit 0** — guru memperbaiki isi soal saat ulangan jalan; cap versi berubah; murid melihat spanduk "Guru memperbarui soal", teks baru, **dan radio jawabannya tetap tercentang**; editor mengunci skor + menjelaskan aturan; server menolak skor & kunci (422) |
| `docs/jalankan-smoke-ui.sh kuis-manual` (**diperbarui** ke kebijakan baru) | **15/15 lulus, exit 0** — termasuk "pemilih jenis soal ada di ATAS formulir", "kunci jawaban dirangkum di bawah soal", dan "total susunan (soal · poin) ada di bawah daftar soal" |
| `docs/jalankan-smoke-ui.sh sidebar` (regresi permintaan "tanpa scrollbar") | **9/9 lulus, exit 0** — `overflowY: visible`, `isi == muat` di 1440×900 dan 1280×640 |

### A.61.4 Berkas

- **Diubah (frontend):** `sections/attempt/HalamanKerjakan.jsx` (penjaga versi + spanduk),
  `sections/attempt/api.js` (`versi_soal`, `soal_diubah_at`, `ambilVersiSoal`),
  `sections/question/api.js` (`terkunci`), `sections/question/EditorSoal.jsx` (spanduk aturan, skor/tipe/aktif
  terkunci saat kuis berjalan, pemilih jenis jadi langkah 1, ringkasan kunci di bawah soal),
  `sections/quiz/HalamanKuis.jsx` (pengingat kebijakan baru + total susunan di bawah),
  `theme/theme.css` (`.ringkas-kunci-soal`, `.ringkas-susunan-akhir`).
- **Diubah (harness/docs):** `docs/smoke-ui-kuis-manual.mjs` (tiga pemeriksaan baru + urutan langkah),
  `docs/catatan-demo.md`, `docs/laporan-pengujian.md` (entri ini).
- **Baru (harness):** `docs/smoke-ui-soal-berubah.mjs`.

### A.61.5 Batasan jujur

- **Penundaan sampai ~20 detik adalah disengaja.** Bukti murid "langsung" melihat versi baru diuji dengan
  mensimulasikan murid kembali ke tab (`focus`), yang memang jalur cepatnya. Kalau murid membiarkan tabnya
  terbuka terus, spanduknya muncul paling lama 20 detik setelah guru menekan Simpan — itu harga dari tidak
  memuat ulang payload tiap beberapa detik di jaringan sekolah.
- **Kunci jawaban masih diisi lewat radio/tombol per opsi.** Yang ditambahkan adalah **kesimpulannya** di
  bawah soal; isian kuncinya tidak dipindah karena tiap tipe soal punya bentuk kunci yang berbeda (pasangan,
  urutan, peta sel). A.61.1 memuat tafsir ini secara terbuka — kalau pemilik produk memaksudkan hal lain,
  yang perlu diganti hanya letak ringkasannya, bukan mekanisme versi.
- **Tabrakan dua proses** (guru menyimpan tepat saat murid mengirim jawaban) tidak diuji di browser:
  yang dibuktikan adalah versioning, sandi jawaban, dan penolakan kunci/skor. Penolakan 422 pada kunci/skor
  sudah dijaga uji backend, bukan uji balapan waktu.

---

## A.62 — Kartu pertanyaan: pilihan PG di editor, di bawah pertanyaan (13 Oktober 2026)

### A.62.1 Permintaan

Pemilik produk: pilihan jawaban PG ditaruh **langsung di dalam editor di bawah pertanyaannya** —
"buat seperti ini cuman beda style nya saja" (rujukan: tangkapan layar kartu pertanyaan ala Google Forms).
Boleh dirombak asal pembuatan soal lebih mudah.

### A.62.2 Yang diubah

- Kartu **2. Tulis soalnya** kini dibuka oleh **pertanyaan di paling atas**, dengan **Poin** di kanan
  atasnya; isian **Skor** pindah dari kartu pengaturan ke sini (jadi "Poin").
- **Pilihan ganda & pilihan ganda kompleks**: tiap pilihan menjadi **baris penuh** (`.baris-opsi`) dengan
  **lingkaran kunci (radio/centang) di kiri** (`.pilih-opsi`) — sekali klik menandai jawaban benar.
  Pilihan yang menjadi kunci ditandai garis aksen + latar hangat, bukan warna saja.
- **Mapel & tag** pindah ke kartu **3. Pengaturan soal** supaya alur menulis soal (pertanyaan → pilihan →
  kunci) tidak terputus.
- **Pemilih jenis soal dilipat jadi satu chip** (`<details class="pemilih-jenis">`, tertutup secara
  bawaan). 22 petak berikon tidak lagi mendorong pertanyaan & pilihannya ke bawah; menekan chip membuka
  petaknya, dan memilih satu petak menutupnya lagi. Selama kuis berjalan (jenis terkunci) chip tetap
  tampil tanpa tombol ganti.
- Ringkasan kunci tetap di **bawah soal** (`.ringkas-kunci-soal`), dengan petunjuk singkat khusus tipe PG.

### A.62.3 Bukti (dijalankan, bukan klaim)

| Yang dijalankan | Hasil |
| --- | --- |
| `./verify.sh` (root, seluruh pagar mutu) | **SEMUA HIJAU (exit 0)** — Pest **344 lulus (3290 asersi)**, Redis wajib hijau, Pint bersih, checkJs, ESLint **0 error**, Vitest **76 berkas / 730 tes**, realtime **20/20** |
| `php artisan test` (backend) | **344 lulus (3290 asersi)** |
| `npm run check` (tsc, checkJs strict) | **exit 0** |
| `npx eslint` (berkas yang disunting) | **0 error** |
| `npx vitest run src/__tests__/sections/question/editorSoal.test.jsx` (baru) | **4 lulus** — pertanyaan mendahului baris pilihan; radio kunci `#kunci-A`/`#kunci-B` ada; Poin mendahului pilihan; mapel berada **setelah** pilihan (kartu pengaturan); pemilih jenis berupa `<details>` tertutup (chip) dan jenis tetap di atas formulir; ringkasan kunci berada di bawah pilihan |

### A.62.4 Berkas

- **Diubah (frontend):** `sections/question/EditorSoal.jsx` (kartu pertanyaan: pertanyaan + poin di atas,
  baris opsi berlingkaran kiri, mapel/tag pindah ke pengaturan, pemilih jenis dilipat jadi chip),
  `theme/theme.css` (`.baris-opsi`, `.pilih-opsi`, `.poin-soal`, `.soal-teks-utama`, penanda `<details>`
  pemilih jenis, varian padat ≥992px).
- **Baru (uji):** `src/__tests__/sections/question/editorSoal.test.jsx`.
- **Diubah (docs):** `docs/penjelasan-fitur.md`, `docs/laporan-pengujian.md` (entri ini).

### A.62.5 Batasan jujur

- **Bukan salinan mentah papan Google Forms.** Menurut instruksi "beda style", bentuknya memakai bahasa
  visual aplikasi (kartu `.kartu-soft`, ikon `.petak-tipe`, warna token tema) — bukan warna/huruf papan.
- **Fitur papan yang sengaja tidak diambil:** pegangan geser antar-soal, tombol lampiran (paperclip) per
  opsi, dan deret tombol aksi di kaki kartu (Insert/Save/Duplicate/Delete). Aksi Simpan/Batal tetap di
  sisi kanan (`.sisi-lengket`) supaya tidak ada dua tombol simpan.
- **Jenis soal tetap dipilih lebih dulu** (kartu 1), sesuai keputusan 12 Oktober 2026 — bukan dipindah ke
  bawah pertanyaan seperti di papan.

### A.62.6 Sapu GUI penuh 24 harness, dan harness `susun` yang tertinggal (13 Oktober 2026)

Sesudah seluruh putaran A.58–A.62 dikomit, seluruh harness GUI yang ada dijalankan ulang di atas satu
local yang hidup (backend :8000, vite :5173, realtime :4000, Chrome :9333 milik runner) untuk memastikan
"SEMUA HIJAU" di laporan ini masih benar pada kode yang baru dikomit — bukan hanya pada saat putarannya
ditulis.

| Harness | Hasil |
| --- | --- |
| `bilah-atas` · `setelan-sesi` · `soal-berubah` (harness baru A.58/A.59/A.61) | **10/10 · 23/23 · 19/19**, exit 0 |
| `susun` · `kuis-manual` · `sidebar` (harness yang berubah) | **44/44 · 15/15 · 9/9**, exit 0 |
| `pengaturan` · `slice07` · `slice06` · `slice04` | **6/6 · 21/21 · 28/28 · 18/18**, exit 0 |
| `mobile` · `nav` · `kelas` · `murid` | **16/16 · 14/14 · 17/17 · 18/18**, exit 0 |
| `tamu` · `luring` · `slice03` · `slice05` | **9/9 · 22/22 · 9/9 · 20/20**, exit 0 |
| `materi` · `editor` · `kuis-materi` · `durasi-klip` · `perjalanan` | **27/27 · 32/32 · 48/48 · 19/19 · 69/69**, exit 0 |
| `cdp` (peninjau, bukan penghitung) | exit 0 |

Jumlahnya **513 pemeriksaan lulus, 0 gagal** di 23 harness berhitung, semuanya exit 0.

**Tiga pemeriksaan `susun` MERAH pada jalan pertama (39/42) — dan penyebabnya bukan kode produk.**
Semuanya harapan yang tertinggal dari kebijakan lama:

1. `editor: kartu bernomor baru tampil` dan 2. `editor: pemilih jenis soal di paling bawah (kartu ke-3)` —
   harness masih menuntut susunan `1. Tulis soalnya · 3. Pilih jenis soal`, padahal sejak 12 Oktober 2026
   (dan dikunci lagi di A.61/A.62) **jenis soal dipilih lebih dulu**: kartu 1 = pemilih jenis, kartu 2 =
   penulisan soal, kartu 3 = pengaturan. Yang benar sekarang adalah `editor.urutan[0]`.
3. `langkah 3: semua butir lengkap setelah formulir diisi` — butir kelengkapan dibaca dengan selektor
   `.baris-ringkas .badge-status`, dan sejak A.59 langkah 3 juga memuat panel "Setelan sesi ini" yang
   memakai kelas baris yang sama dengan label yang memang bukan Lengkap/Belum ("Proteksi mati", "Siswa
   tamu tidak boleh", "Aturan lain"). Kelas bersama, bukan kelengkapan yang kurang: 8 butir pertama tetap
   semua `Lengkap`. Selectornya disempitkan ke daftar milik `section[aria-labelledby="langkah-3"]`.

Sekalian, pemeriksaan chip diperkuat supaya menguji **perilaku** A.62 dan bukan hanya nama tag: chip
`<details>` harus **tertutup bawaan**, **terbuka saat ringkasannya ditekan**, dan **menutup lagi setelah
satu petak dipilih** (perilaku `jenisRef.current.open = false` di `EditorSoal.jsx`). Harness naik dari 42
ke **44 pemeriksaan**; dijalankan ulang **44/44 lulus, exit 0**.

| Yang dijalankan | Hasil |
| --- | --- |
| `docs/jalankan-smoke-ui.sh susun` (sebelum perbaikan) | **39/42 · 3 gagal**, exit 1 — tiga harapan lama di atas |
| `docs/jalankan-smoke-ui.sh susun` (sesudah perbaikan) | **44/44 lulus**, exit 0 |

Batasan jujur: angka diukur di Chrome headless + CDP, bukan perangkat fisik; sapu ini **tidak**
mengulang `./verify.sh` karena tidak ada kode produk yang berubah (hanya harness). Satu anomali yang tidak
bisa direproduksi: pada satu kali dijalankan berantai, runner melaporkan exit 1 untuk `cdp` padahal barisnya
sendiri berbunyi "hasil smoke cdp: 0" dan tidak ada satu pun baris `GAGAL`; tiga kali dijalankan ulang
(sendiri dan berantai sesudah `perjalanan`) exit 0. `cdp` memang peninjau (menuangkan isi halaman), bukan
harness berhitung.

---

## A.63 — Layar kelas, mode tim, dan impor murid diuji di peramban sungguhan (13 Oktober 2026)

Tiga jalur yang cakupan GUI-nya masih kosong: **layar kelas** (slice 10), **mode tim** (slice 09), dan
**impor murid CSV** (slice 07). Semuanya sudah lama punya uji backend (`Slice10LayarTest`, `Slice09TimTest`,
`ImporMuridTest`), tetapi belum pernah dijalankan dari peramban — dan sapu A.62.6 (23 harness berhitung)
memang tidak memuat ketiganya. Layar kelas yang paling telanjang: halaman `/kuis/:id/layar` **belum pernah
dibuka di peramban sama sekali**, padahal inti fiturnya justru pasangan dua perangkat (guru mengubah,
perangkat murid menyusul tanpa memuat ulang).

### A.63.1 Harness baru `layar` — satu guru + satu murid, dua peramban (34 pemeriksaan)

Dua konteks peramban (dua profil cookie terpisah) dipakai sekaligus, seperti `soal-berubah`: guru
mengendalikan, murid mengerjakan. Harness membuat sendiri soal + kuis kelas murid uji, lalu menghapusnya di
`finally`.

| Bagian | Yang dibuktikan |
| --- | --- |
| Saklar `layar_guru` mati | Halaman mengatakannya terus terang ("Layar guru sedang dimatikan … murid tidak menerima apa pun") **dan** pemilih mode + tombol simpan benar-benar terkunci |
| Saklar dinyalakan | Peringatan hilang, pemilih mode hidup — lewat halaman yang dimuat ulang setelah kunci diubah |
| Mode yang butuh bahan | "Sorot satu soal" tanpa soal terpilih: tombol simpan mati **dan** sebabnya di layar ("Pilih dulu soal yang mau disorot.") — ditolak lebih awal oleh halaman, bukan oleh server |
| Pengumuman | Guru menyiarkan; toast melaporkan mode yang tayang; pratinjau "Yang dilihat murid" memuat judul + isi |
| Pengumuman → murid | Murid menerimanya di layar ulangannya **tanpa memuat ulang**, lengkap dengan "Dari gurumu · pembaruan N" |
| Sorot soal → murid | Panel `Soal yang disorot guru` muncul, menyebut "Guru menyorot soal nomor 1", **dan isi soalnya benar-benar sampai**; soal ulangan milik murid tetap di layar (tidak terkunci) |
| Kosongkan layar | Form kembali ke kosong & tetap bisa disiarkan; panel di perangkat murid **hilang** — kembali ke tampilan ulangan biasa |
| Pagar murid | `PUT /v1/kuis/{id}/layar` dari murid **403**; `GET`-nya 200 tetapi **tanpa** `daftar_soal`/`daftar_mode` (bahan pengendali tidak ikut ke perangkat murid) |
| Tanpa kunci | Panel sorotan tidak memuat "Kunci jawaban" |

### A.63.2 Harness `tim` dan `impor-murid` (sudah dikomit tanpa entri laporan)

Keduanya ditulis pada putaran sebelumnya (**commit `4d0292c`**) dan ikut diverifikasi ulang di sini:

- `tim` (**31 pemeriksaan**): halaman menyebut jumlah murid kelas apa adanya, keadaan kosong dan "mode tim
  belum dinyalakan" dikatakan terus terang, "Bagi otomatis" menyarankan jumlah tim yang masuk akal lalu
  **membagi seluruh murid** (tidak ada yang tertinggal), murid benar-benar melihat nama tim & anggotanya,
  susunan tetap sama setelah halaman dimuat ulang, hapus/buat tim melaporkan hasilnya, murid dari tim yang
  dihapus dilaporkan belum bertim, dan kunci `mode_tim` bisa dinyalakan untuk kuis itu (peringatan hilang).
- `impor-murid` (**29 pemeriksaan**): kolom wajib/opsional disebut apa adanya, tombol Impor mati sebelum ada
  berkas, **judul kolom lazim guru diterima** ("Nama Lengkap", "Nama Kelas", "Nomor Induk Siswa") tanpa 422,
  tabel galat menyebut **nomor baris** + sebabnya (kelas tidak ada, email milik akun non-murid, NIS ganda di
  dalam berkas) sebagai `role=alert`, baris yang ditolak **tidak** meninggalkan murid di server, impor bersih
  dilaporkan sebagai status, dan berkas Excel (BOM + pemisah `;`) jalan lewat API.

### A.63.3 Bukti (dijalankan, bukan klaim)

| Yang dijalankan | Hasil |
| --- | --- |
| `docs/jalankan-smoke-ui.sh layar` (**harness baru**) | **34/34 lulus, exit 0** |
| `docs/jalankan-smoke-ui.sh tim` (verifikasi ulang) | **31/31 lulus, exit 0** |
| `docs/jalankan-smoke-ui.sh impor-murid` (verifikasi ulang) | **29/29 lulus, exit 0** |
| `node --check docs/smoke-ui-layar.mjs` | exit 0 |

Ketiganya dijalankan lewat runner yang sama (`docs/jalankan-smoke-ui.sh`) di atas satu local yang hidup:
backend :8000, vite :5173, realtime :4000, Chrome :9333 milik runner. Jumlahnya **94 pemeriksaan lulus,
0 gagal**, semuanya exit 0.

### A.63.4 Berkas

- **Baru (harness):** `docs/smoke-ui-layar.mjs`.
- **Diubah (docs):** `docs/laporan-pengujian.md` (entri ini).
- **Sudah ada sejak `4d0292c`:** `docs/smoke-ui-tim.mjs`, `docs/smoke-ui-impor-murid.mjs`.

### A.63.5 Batasan jujur

- **Yang dibuktikan adalah "murid menyusul", bukan "lewat SSE".** Harness menunggu panel berubah dalam
  batas 40 detik — itu cukup untuk jalur polling (5 detik saat SSE gagal, 20 detik saat SSE hidup sebagai
  jaring pengaman). Jadi pemberitahuan realtime yang gagal lalu diselamatkan polling tetap dinyatakan lulus;
  yang gagal adalah bila perangkat murid **tidak pernah** menyusul. Kontrak SSE-nya sendiri sudah dijaga uji
  backend `Slice10LayarTest` (kanal `ulangan:kuis:{id}:murid`).
- **Mode "Instruksi setelah ulangan" (`hasil`) tidak dijalankan** di harness ini. Yang diuji tiga mode:
  `pengumuman`, `soal`, dan `kosong`. Mode `hasil` memakai komponen `Banner` yang sama dengan `pengumuman`
  jadi risikonya kecil, tetapi tetap belum dibuka di peramban.
- **Satu murid saja.** "Kelas lain tidak boleh mengikuti" dibuktikan uji backend (403 pada `GET`/`sse-tiket-murid`
  dari kelas lain), bukan di browser.
- **Chrome headless + CDP**, bukan perangkat fisik; kedipan/animasi tidak dinilai, hanya keadaan DOM yang
  dibaca ulang.

---

## A.64 — Tiga celah cakupan GUI ditutup: Mapel, Avatar/Moderasi, dan Alur Akun Murid (13 Oktober 2026)

Setelah A.63, seluruh harness dijalankan ulang atas pertanyaan "apakah SEMUA fitur sudah terbukti di
peramban?" — jawabannya belum. Audit peta rute (`frontend/src/routes.js`) melawan 27 berkas
`docs/smoke-ui-*.mjs` menemukan tiga jalur yang tidak punya bukti peramban sama sekali:

| Jalur | Bukti yang ada sebelum putaran ini |
| --- | --- |
| `/daftar` · `/perlu-verifikasi` · `/verifikasi-email` · `/lupa-sandi` · `/atur-ulang-sandi` | **Nol harness.** Hanya `AuthTest.php` (backend) + unit `authStore`/`validasi` (Vitest) |
| `/mapel` | **Nol harness.** Hanya `SekolahTest.php` (backend) + `cdp` yang menuangkan isi halaman tanpa memeriksa |
| `/avatar` (perilaku) | Hanya **tata letak** oleh `mobile`; tak ada asersi unggah/lapor/tinjau. Ada `Slice08AvatarTest` di backend |

Ketiganya ditutup berurutan dari yang paling murah.

### A.64.1 `mapel` — 32 pemeriksaan, dan satu cacat nyata yang ketahuan

Halaman `/mapel` adalah kembaran `/kelas` ("pola yang sama"), dan justru itu yang membuat harness ini
berharga: **jalan pertama 29/32** — tiga pemeriksaan merah, semuanya pada satu kasus yang paling sering
terjadi (guru mengetik nama mapel yang memang sudah ada, mis. "Matematika"):

| Sebelum | Sesudah |
| --- | --- |
| Sebabnya hanya muncul sebagai toast, dan berbunyi **"The nama has already been taken."** (pesan bawaan framework) | Sebabnya tampil **di bawah isian nama** dan berbunyi "Nama mapel ini sudah dipakai di sekolah ini. Pakai nama lain, misalnya Matematika Lanjutan." |

Perbaikannya meniru halaman Kelas yang sudah lebih dulu memakai pola itu: `SimpanMapelRequest::messages()`
(pesan Indonesia) + `HalamanMapel` memetakan `errors` per kolom ke isiannya lewat `galatKolom` + `setError`.
Harness dijalankan ulang: **32/32 lulus**.

**Temuan sampingan yang ikut diperbaiki:** halaman **Murid** punya cacat yang sama persis (`SimpanMuridRequest`
tanpa `messages()`, `onError` hanya toast), padahal `galatKolom` sudah lama ada. Keduanya kini memakai pola yang
sama seperti Kelas/Mapel, dan harness `murid` dijalankan ulang sebagai regresi (**18/18**). Ketiga halaman data
induk sekarang konsisten: sebab galat per kolom terbaca tepat di bawah isiannya.

### A.64.2 `avatar` — 44 pemeriksaan, tiga peran, satu berkas yang ditolak server

Tiga konteks peramban dipakai sekaligus: murid pemilik avatar, murid pelapor, dan guru moderator. Yang
dibuktikan: berkas bukan gambar ditolak **di klien** dari magic bytes (sebelum dikirim) dan berkas >2 MiB
ditolak lebih awal lagi; unggahan yang sah tampil sebagai hasil **encode ulang server (256×256)**; "Kembalikan
ke bawaan" benar-benar menghapus; satu laporan **belum** menyembunyikan apa pun dan laporan berulang dari anak
yang sama tidak menambah hitungan; setelah beberapa anak berbeda melapor, avatar berhenti tampil bagi murid lain
**tetapi pemiliknya masih melihat fotonya**; guru memulihkan (hitungan laporan direset) dan bisa menghapusnya;
serta pagar peran (murid 403 pada `pulihkan`, `moderasi`, dan saat melaporkan avatarnya sendiri).

Dua kali jalan pertama gagal, dan **keduanya cacat harness, bukan cacat produk**:

1. **18/43** — berkas PNG uji (1×1 dari base64) ditolak server dengan "Gambar tidak bisa dibaca". Harness
   sekarang **membuat sendiri** PNG 64×64 yang sah (`zlib.deflateSync` + `crc32`) dan memverifikasinya dulu
   dengan GD sebelum dipakai.
2. **35/43** — laporan "berhenti tampil setelah 3 pelapor" tidak tercapai karena harness hanya membuat 2 murid
   pendamping (pemilik avatar tidak bisa melaporkan avatarnya sendiri). Dengan 3 pendamping: **44/44 lulus**.

Ambang laporan dibiarkan apa adanya (bawaan 3, dari `config/avatar.php`) — harness menyesuaikan diri, bukan
menurunkan ambangnya supaya lulus.

### A.64.3 `auth` — 36 pemeriksaan, termasuk membuka tautan dari email

Jalur akun murid dari nol: validasi formulir yang benar-benar menahan pengiriman (nama, email, sandi <10,
sandi tidak sama), pendaftaran sungguhan → langsung masuk → mendarat di `/perlu-verifikasi`, **gerbang akun
pending** yang menahan `/` dan `/kuis`, anti-enumerasi `/lupa-sandi` (jawaban identik untuk email terdaftar &
tidak terdaftar), lalu — yang paling penting — **tautan dari email benar-benar dibuka**: verifikasi email, dan
atur ulang kata sandi. Kata sandinya betul-betul berganti: masuk dengan sandi **baru** berhasil, dengan sandi
**lama** 422; tautan yang sama sekali lagi dijawab halaman "Tautan sudah pernah dipakai"; token palsu ditolak
tanpa pernah menampilkan "kata sandi sudah diganti".

Dua keputusan yang membuat ini mungkin:

- **Runner menyalakan backend dengan `MAIL_MAILER=log`** khusus harness `auth`
  (`docs/jalankan-smoke-ui.sh`). Tanpa itu, tiap jalan smoke akan **mengirim email asli** lewat SMTP Gmail di
  `backend/.env` dev, dan tautannya tetap tidak bisa dibaca harness. Backend yang sudah hidup di :8000 tidak
  pernah disentuh; harness lalu mencetak **DILEWATI** untuk langkah email, bukan lulus diam-diam.
- **Harness membaca `backend/storage/logs/laravel.log`** (hanya baris baru sejak ia mulai) dan mengambil
  tautannya dari isi surat, termasuk membuka pembungkusan quoted-printable (`=\n`, `=3D`) yang bisa memotong
  URL panjang.

Jalan pertama 22/27 & 34/35; penyebabnya dua, keduanya di harness: (a) halaman auth memantulkan pemakai yang
**sudah masuk** ke beranda, jadi langkah lupa-sandi harus dijalankan sesudah keluar; (b) halaman "tautan sudah
pernah dipakai" baru bisa diketahui dari **jawaban server**, jadi formulirnya harus benar-benar dikirim sekali
lagi. Sesudah perbaikan: **36/36 lulus, 0 langkah dilewati**.

### A.64.4 Bukti (dijalankan, bukan klaim)

| Yang dijalankan | Hasil |
| --- | --- |
| `docs/jalankan-smoke-ui.sh mapel` (**harness baru**) | **29/32 → 32/32 lulus**, exit 0 (sesudah perbaikan produk) |
| `docs/jalankan-smoke-ui.sh avatar` (**harness baru**) | **18/43 → 35/43 → 44/44 lulus**, exit 0 |
| `docs/jalankan-smoke-ui.sh auth` (**harness baru**) | **22/27 → 34/35 → 36/36 lulus, 0 dilewati**, exit 0 |
| `docs/jalankan-smoke-ui.sh murid` (regresi perbaikan Murid) | **18/18 lulus**, exit 0 |
| `docs/jalankan-smoke-ui.sh layar` · `tim` · `impor-murid` (A.63, regresi) | **34/34 · 31/31 · 29/29 lulus**, exit 0 |
| `./verify.sh` (seluruh pagar mutu) | **SEMUA HIJAU (exit 0)** — Pest **344 lulus (3290 asersi)**, Redis wajib **9 lulus (65 asersi)**, Pint bersih, checkJs exit 0, ESLint **0 error** (2 peringatan lama), Vitest **76 berkas**, realtime hijau |
| `php artisan test --filter='SekolahTest\|ImporMuridTest'` | **23 lulus (155 asersi)** sesudah pesan galat Indonesia ditambahkan |
| `npx eslint` + `npm run check` (berkas yang disunting) | **0 error**, checkJs exit 0 |

Catatan throttle jujur: sesi `auth` sesekali menabrak batas masuk per menit saat memeriksa "sandi lama gagal"
(dua kali menunggu 20 detik di satu jalan). Harness menunggu dan melanjutkan, bukan melewati pemeriksaannya.

### A.64.5 Berkas

- **Baru (harness):** `docs/smoke-ui-mapel.mjs`, `docs/smoke-ui-avatar.mjs`, `docs/smoke-ui-auth.mjs`.
- **Diubah (produk):** `backend/app/Sections/School/Http/Requests/SimpanMapelRequest.php` (+`messages()`),
  `backend/app/Sections/School/Http/Requests/SimpanMuridRequest.php` (+`messages()`),
  `frontend/src/sections/school/HalamanMapel.jsx` (galat per kolom),
  `frontend/src/sections/school/HalamanMurid.jsx` (galat per kolom).
- **Diubah (runner):** `docs/jalankan-smoke-ui.sh` — `MAIL_MAILER=log` untuk harness `auth` saja, dengan
  peringatan tercetak bila backend-nya kebetulan sudah hidup.
- **Diubah (docs):** `docs/laporan-pengujian.md` (entri ini), `docs/handoff-sesi.md` (bagian 8).

### A.64.6 Batasan jujur

- **Langkah email hanya terbukti pada mailer `log`.** Kalau `auth` dijalankan di atas backend yang sudah hidup
  dengan SMTP, dua langkah (buka tautan verifikasi & buka tautan reset) dilaporkan **DILEWATI** dengan
  alasannya — bukan lulus. Sisa 34 pemeriksaan tetap berjalan.
- **Email sungguhan tidak diuji.** Harness tidak pernah mengirim surat ke Gmail dan tidak memeriksa kotak masuk;
  yang dibuktikan adalah isi surat yang dihasilkan aplikasi + tautannya benar-benar bisa diklik dan bekerja.
- **Alur guru/admin tidak disentuh.** `AuthTest` backend tetap satu-satunya bukti untuk pendaftaran guru
  (memang tidak ada jalur self-register), reset sandi guru, dan halaman verifikasi untuk akun non-murid.
- **Harness `avatar` membuat tiga akun murid sementara** (dibersihkan di `finally`, dan keberadaannya tidak
  sengaja diandalkan harness lain). Ambang laporan & ukuran gambar tetap sesuai `config/avatar.php`; tidak ada
  saklar produksi yang dilonggarkan untuk lulus.
- **Halaman moderasi tidak diuji pada antrean yang panjang** (puluhan avatar terlapor sekaligus); yang
  dibuktikan adalah satu avatar per keputusan (pulihkan & hapus).

## A.65 — Pita palet panel samping tidak putus lagi (13 Oktober 2026)

Permintaan pemilik produk: *"panjangkan warna palet yang sidebar, jangan putus."*

Keadaannya memang rusak, dan ini pertama kalinya terukur: panel samping selebar 260 px hanya berwarna
sepanjang **isi menunya** (736 px), lalu berhenti. Di `/murid` tepi kiri berwarna sampai y=805, sedangkan
kolom konten berakhir di y=4391 — **3.586 px tepi kiri kosong**, dan `document.elementFromPoint(8, 898)`
mengembalikan `DIV.kerangka-badan`, bukan panelnya. Setelah halaman digulir 600 px, hanya irisan atas jendela
yang masih berwarna. Di halaman pendek pun ada sisa: `/beranda` panel berhenti di y=805 sedangkan halamannya
900 px — **95 px tepi kiri kosong di dasar layar**.

Sebabnya dua baris: pada ≥992 px `.kerangka-badan-menu` memakai `align-items: flex-start` dan `.papan-nav`
`align-self: flex-start` — panel sengaja tidak diregangkan (sisa kebijakan 12 Okt "tingginya mengikuti isi
menu"), padahal yang diminta adalah sebaliknya: latarnya yang memanjang, bukan isinya.

### A.65.1 Yang diubah (3 suntingan di satu berkas CSS)

| Sebelum | Sesudah |
| --- | --- |
| `.kerangka-badan-menu { align-items: flex-start; }` | `align-items: stretch` + `min-height: calc(100vh - var(--tinggi-kepala))` — lantai tinggi baris = jendela − kepala |
| `.papan-nav { align-self: flex-start; }` | `align-self: stretch` — panel ikut setinggi barisnya |
| Komentar bagian masih menyebut panel "terkunci di layar setinggi jendela" (sisa kebijakan lama) | Komentar ditulis ulang: ikut tergulir, tanpa gulir sendiri, tingginya diregangkan mengikuti baris |

Yang **tidak** berubah: tetap tanpa gulir sendiri, tetap ikut tergulir bersama halaman, tetap menempel rata ke
tepi kiri (radius 0, tanpa bayangan), lebar tetap 260 px, dan **isi menu tetap menempel di atas** — yang
memanjang hanya latarnya (di `/murid` jarak tautan terakhir → dasar panel 3.610 px).

### A.65.2 Bukti (dijalankan, bukan klaim)

Harness baru `docs/smoke-ui-palet-sidebar.mjs`, **58/58 lulus**, dijalankan lewat
`docs/jalankan-smoke-ui.sh palet-sidebar`. Lima halaman guru (panjang isi berbeda, termasuk yang lebih pendek
dari jendela) × dua tema, jendela 1440×900:

| Pemeriksaan | Hasil |
| --- | --- |
| Pita menutupi sampai dasar kolom kiri | selisih **0 px** di kesepuluh pengukuran (mis. `/murid` nav 4.322 px bawah 4.391 ; `/kuis` 19.231/19.300 ; `/beranda` 832/901) — sebelumnya −95 s/d −18.495 px |
| Tepi kiri berwarna panel di lima titik jendela | sepuluh pengukuran × lima titik, semuanya `panel` (sebelumnya titik terbawah = `DIV.kerangka-badan`) |
| Sama setelah digulir 600 px | lima titik tetap `panel` (sebelumnya hanya irisan teratas) |
| Warnanya benar-benar `var(--panel)` | `#1a2f65 → rgb(26, 47, 101)` (terang) dan `#14214a → rgb(20, 33, 74)` (gelap), sama di elemen maupun di kelima titik piksel |
| Tetap tanpa gulir sendiri | `isi == muat`, `overflowY: visible` di semua pengukuran |

Regresi sesudah perubahan CSS: `sidebar` **9/9** (termasuk "panel tidak bergulir sendiri" di 1440×900 dan
1280×640, serta "panel ikut tergulir bersama halaman": top 69 → −431 pada gulirY 500) · `nav` **14/14** ·
`mobile` **16/16** (1 dilewati dengan sadar: tidak ada kuis terbit di DB dev).

`./verify.sh`: **SEMUA HIJAU** — Pest 344/3290, Redis wajib 9/65, Pint, checkJs, ESLint 0 error,
Vitest 76 berkas/731 tes, realtime.

**Cacat harness yang ketahuan dan diperbaiki sendiri** (dicatat supaya tidak terbaca sebagai kegagalan produk):
(1) fungsi pengukur tidak dipanggil (`ukur` alih-alih `ukur()`) sehingga semua angka `undefined`; (2) titik ukur
teratas `y=4` ternyata mengukur **kepala lengket** yang menutupi panel setelah digulir — kini titik pertama
dimulai di bawah kepala. Dua kesalahan lain saat menulis ulang harness (emulasi jendela 1440×900 hilang, dan
tema awal peramban headless ternyata gelap) sempat memunculkan 46 merah palsu; keduanya diperbaiki dengan
memasang ulang `setDeviceMetricsOverride` dan menetapkan `data-bs-theme` eksplisit per lintasan.

### A.65.3 Berkas

- **Diubah (produk):** `frontend/src/theme/theme.css` — komentar bagian kerangka badan, `.kerangka-badan-menu`,
  `.papan-nav`.
- **Baru (harness):** `docs/smoke-ui-palet-sidebar.mjs` (58 pemeriksaan, dua tema).
- **Diubah (docs):** `docs/laporan-pengujian.md` (entri ini), `docs/handoff-sesi.md` (bagian 9),
  `docs/catatan-demo.md` (daftar perintah harness).

### A.65.4 Batasan jujur

- **Hanya peran guru yang diukur di sini.** Panel 260 px itu memang milik guru/admin; menu murid dan tamu
  memakai CSS yang sama tetapi tidak diukur ulang pada putaran ini (harness ini masuk sebagai
  `admin@sekolah.test`).
- **Regangan hanya berlaku ≥992 px.** Di bawah itu panelnya digantikan laci; lebar ponsel diuji `mobile`
  (16/16), bukan harness ini.
- **Tingginya "ikut kolom konten", bukan "selalu setinggi jendela".** Di halaman pendek barisnya diberi lantai
  setinggi jendela dikurangi kepala, jadi pitanya sampai dasar layar — itu keputusan desain yang diukur, bukan
  kebetulan.
- **Tidak ada pengukuran kontras baru.** Yang dibuktikan adalah nilai warnanya sama dengan `var(--panel)`
  tema yang berlaku; kontras teks di atas panel tetap dijaga tes tema yang sudah ada.

## A.66 — Sapuan GUI: semua harness fitur rawan dijalankan, dua pemeriksaan mati di `mobile` dihidupkan (13 Oktober 2026)

Permintaan: *"tes gui fitur fitur yang rawan rusak"*. Yang dimaksud rawan di sini = **berkas yang baru saja
disentuh + jalur yang saling bergantung banyak lapis** (ulangan yang sedang berjalan, realtime/SSE, unggahan,
impor berkas, mode tim, regangan pita panel, editor materi gaya video). Semuanya dijalankan di **peramban
sungguhan** (Chrome headless + CDP), bukan lewat unit test.

Layanan: `./nyalakan-local.sh` (redis + backend :8000 + realtime :4000 + frontend :5173) hidup di seluruh
sapuan; tiap harness dijalankan lewat `docs/jalankan-smoke-ui.sh <nama>` (runner itu memakai layanan yang sudah
hidup dan menyalakan Chrome-nya sendiri, dengan profil terpisah per harness).

### A.66.1 Hasil — 30 harness, 777 pemeriksaan, semuanya lulus (exit 0)

| Harness | Hasil | Harness | Hasil |
| --- | --- | --- | --- |
| `palet-sidebar` | 58/58 | `slice06` (koreksi manual) | 28/28 |
| `perjalanan` | 69/69 | `materi` (pemutar) | 27/27 |
| `kuis-materi` | 48/48 | `setelan-sesi` | 23/23 |
| `avatar` | 44/44 | `luring` (luring/offline) | 22/22 |
| `susun` (susun kuis) | 44/44 | `slice07` (monitor + SSE) | 21/21 |
| `auth` (mailer log) | 36/36 | `slice05` (skor/ranking) | 20/20 |
| `layar` (layar kelas) | 34/34 | `soal-berubah` | 19/19 |
| `editor` (390/768/1366) | 32/32 | `durasi-klip` | 19/19 |
| `mapel` | 32/32 | `slice04` (kerjakan ulangan) | 18/18 |
| `tim` (mode tim) | 31/31 | `murid` (pencarian server) | 18/18 |
| `impor-murid` | 29/29 | `kelas` | 17/17 |
| `kuis-manual` | 15/15 | `mobile` (perangkat 412×915) | 16/16 |
| `nav` | 14/14 | `tamu` (siswa tamu) | 9/9 |
| `bilah-atas` | 10/10 | `sidebar` | 9/9 |
| `slice03` (bank soal) | 9/9 | `pengaturan` (per lingkup) | 6/6 |

Audit seluruh halaman (`node docs/audit-ui.mjs`, guru + murid × hp 390 + laptop 1366, terang **dan** `--gelap`):
**44/44 halaman BERSIH di kedua tema**, ringkasan cacat `{}` di keduanya.

`./verify.sh` sesudah sapuan: **SEMUA HIJAU (exit 0)** — Pest **344 passed (3290 assertions)** · Redis wajib
**9 (65)** · Pint · checkJs · ESLint **0 error** (2 warning lama React Hook Form) · Vitest **76 berkas / 731
tes** · realtime lulus.

### A.66.2 Dua pemeriksaan yang ternyata MATI di `docs/smoke-ui-mobile.mjs` (diperbaiki)

Bagian 4 harness `mobile` ("layar kuis di ponsel") **selalu** melaporkan `LULUS · … (tidak ada kuis terbit di
DB dev — bagian ini dilewati dengan sadar)` — pemeriksaan yang tidak pernah benar-benar mengukur apa pun.
Dua cacat alat ukur yang berdiri sendiri-sendiri menyebabkannya:

1. **Status usang.** Penyaringnya `satu.status === 'terbit'`. Nilai itu tidak pernah ada di API: enum
   `StatusKuis` memakai `publikasi` dan `KuisResource` mengirim `status: $this->status->value`
   (`'terbit'` hanya label manusianya).
2. **Amplop salah.** `d.data ?? []` selalu kosong karena `KuisController@index` mengembalikan larik
   **telanjang**, bukan `{ data: [...] }`.

Dibuktikan dengan sonde CDP sekali pakai (`/tmp`, dihapus lagi): sebagai `admin@sekolah.test`, `/api/v1/kuis`
menjawab **HTTP 200 · 122 kuis · publikasi 84 · draf 19 · arsip 19**, `bentuk: array`. Jadi bukan "tidak ada
kuis terbit" — memang alat ukurnya yang salah membaca.

Sesudah diperbaiki, pemeriksaan itu benar-benar berjalan dan lulus dengan angka nyata:
`LULUS · halaman detail kuis tidak menggulir mendatar di ponsel · +0px · elemen menembus 0 · kuis #248`
(mobile tetap **16/16**, exit 0).

### A.66.3 Berkas

- **Diubah (nol berkas produk):** `docs/smoke-ui-mobile.mjs` — dua perbaikan penyaring + catatan mengapa;
  tidak ada kode aplikasi yang disentuh (sapuan ini memang hanya pengukuran).
- **Diubah (docs):** `docs/laporan-pengujian.md` (entri ini), `docs/handoff-sesi.md` (bagian 10 + tabel status).

### A.66.4 Batasan jujur

- **Chrome headless, bukan perangkat fisik.** Ukuran sentuh, DPR, dan UA Android diemulasikan; tidak ada uji
  di ponsel/tablet sungguhan pada putaran ini.
- **Satu jalur `auth` bergantung `MAIL_MAILER=log`.** Runner menyalakan backend sendiri untuk harness `auth`
  supaya isi surat bisa dibaca; kalau backend sudah hidup dengan `.env` biasa, langkah lewat email
  **dilewati** dan harness mencetaknya sebagai `DILEWATI` (putaran ini 0 langkah dilewati karena backend
  dimatikan dulu).
- **Tidak ada harness GUI untuk jalur penjelasan *media* di pemutar materi** dan **endpoint HTTP murni**
  (`docs/smoke-http-fitur.mjs`, 243 pemeriksaan) **tidak dijalankan** pada sapuan ini — keduanya di luar
  cakupan "GUI".
- **Yang tidak diukur ulang:** peran murid/tamu pada halaman guru (hanya sebagian harness yang masuk sebagai
  murid), dan perangkat sentuh nyata.

## A.67 — Audit pemeriksaan mati di seluruh harness GUI (13 Oktober 2026)

Lanjutan A.66: setelah ditemukan dua cacat alat ukur di `smoke-ui-mobile.mjs` (status `'terbit'` yang tidak
ada di API + amplop `d.data` pada larik telanjang), pola kerusakan yang sama dicari ke **seluruh** harness GUI
(`docs/*.mjs`, 33 berkas + `audit-ui.mjs`).

### A.67.1 Empat pola yang dicari

| # | Pola | Mengapa berbahaya |
| --- | --- | --- |
| 1 | String status dibandingkan dengan nilai yang tidak ada di enum backend | penyaring selalu kosong → pemeriksaan dilewati |
| 2 | Amplop jawaban ditebak salah (larik telanjang vs `{ data: [...] }` vs paginasi) | pembacaan kosong → "tidak ada data" palsu |
| 3 | Pemeriksaan **negatif** ("tidak ada X") dengan cadangan `?? []` | bukti hilang ⇒ `every`/`length === 0` bernilai benar ⇒ **lulus tanpa bukti** |
| 4 | Objek penjaga yang bisa `null` (`m?.x ?? []`) pada pemeriksaan negatif | sama seperti #3: panel/halaman tidak ada ⇒ justru lulus |

Untuk pola #2, seluruh `paginate(` di `backend/app` dihitung: **hanya dua** endpoint yang berpaginasi —
`/v1/soal` (`SoalController`) dan `/v1/murid` (`MuridController`). Jadi setiap pembacaan `.isi?.data` hanya sah
pada dua jalur itu; dipakai di `/v1/kuis` (larik telanjang), `.data` **selalu** kosong.

### A.67.2 Hasil pemeriksaan berkas per berkas

| Berkas | Temuan | Tindakan |
| --- | --- | --- |
| `smoke-ui-mobile.mjs` | #1 + #2 (status `'terbit'`, `d.data`) — bagian "layar kuis di ponsel" **mati** | sudah diperbaiki di A.66 |
| `smoke-ui-slice07.mjs` | #3 — `(audit.isi ?? []).every(...)` lulus pada jawaban tak terpakai (isi `null`) atau larik kosong | **diperkuat**: wajib `status === 200`, benar-benar larik, dan jumlah "menunggu" **turun tepat satu** |
| `smoke-ui-kuis-materi.mjs` | #4 — tiga negasi `(m?.… ?? []).length === 0` lulus saat `__ukur()` mengembalikan `null`; dua negasi lain memakai `nilai.x ?? []` (kunci ukur bisa hilang) | **ditutup**: `m` yang tidak terukur = GAGAL, daftar ukur wajib ada (`Array.isArray`) |
| `audit-ui.mjs` | jatuh ke `idKuis = 1` bila daftar kuis kosong — terlihat "BERSIH" tanpa jejak halaman mana yang diaudit | **diperjelas**: mencetak `kuis uji: #248 (“Smoke layar 130244”)` |
| `smoke-ui-luring.mjs` | status `'terkirim'`/`'lokal'` | **sah** — konstanta antrean luring di `frontend/src/sections/attempt/riwayatJawaban.js` |
| `smoke-ui-slice06.mjs` | status `'perlu_tinjau'`, `'dinilai'` | **sah** — ada di enum backend |
| `smoke-ui-slice05.mjs` | negasi `(mati.isi?.peringkat ?? []).length === 0` | **aman** — dijaga `status === 200` + `tampil === false` + `total === 1` pada objek yang sama |
| `smoke-ui-kelas.mjs` | negasi "0 permintaan" (`permintaan.length === 0`) | **aman** — ada kontrol positif di berkas yang sama (`hitung('/v1/sesi')`/`hitung('/v1/auth/saya')` harus tepat 1, sehingga perekamnya terbukti hidup) |
| `smoke-ui-auth.mjs`, `slice04/05/06/07`, `layar`, `luring`, `impor-murid`, `kuis-materi`, `materi`, `perjalanan`, `avatar` | 10 pembacaan daftar murid | **benar** — semuanya membaca `?? .data` pada `/v1/murid` (paginasi) atau dijaga `Array.isArray` |
| `slice03` | `d.meta?.total` pada `/v1/soal` | **benar** — `/v1/soal` memang berpaginasi |

### A.67.3 Kontrol negatif (A/B) — membuktikan pemeriksaan yang diperkuat benar-benar bergigi

Dua salinan `smoke-ui-slice07.mjs` di `/tmp` diberi **respons tak terpakai yang sama** untuk
`kejadian?status=menunggu` (isi `null`, seperti saat badan jawaban bukan JSON); satu memakai klaim lama, satu
klaim baru:

| Varian | Hasil | Artinya |
| --- | --- | --- |
| klaim lama `(audit.isi ?? []).every(...)` | **21/21 lulus · exit 0** | 21/21 saat buktinya **tidak ada** — buta |
| klaim baru (200 + larik + jumlah turun 1) | **20/21 · exit 1** · `GAGAL · catatan yang ditinjau keluar dari antrean menunggu · status 200 · menunggu 1 → bukan larik` | menangkap jawaban yang tidak terpakai |

(Proses kontrol sempat gagal dua kali karena `${jalur}` disisipkan **tanpa** `JSON.stringify` sehingga menjadi
literal regex di halaman — kesalahan alat kontrol, bukan produk; varian final memakai `JSON.stringify(jalur)`.)

### A.67.4 Bukti sesudah perbaikan (dijalankan ulang)

| Perintah | Hasil |
| --- | --- |
| `docs/jalankan-smoke-ui.sh slice07` | **21/21 lulus · exit 0** — baris baru berbunyi `LULUS · catatan yang ditinjau keluar dari antrean menunggu · status 200 · menunggu 1 → 0` |
| `docs/jalankan-smoke-ui.sh kuis-materi` | **48/48 lulus · exit 0** — lima negasi kini mencetak buktinya (`[]`, `bisu (muted)`) dan akan GAGAL bila panel tidak terukur |
| `node docs/audit-ui.mjs kuis` (saringan, Chrome + layanan hidup) | **exit 0 · semua halaman `kuis` BERSIH · ringkasan `{}`**, plus baris baru `kuis uji: #248 (“Smoke layar 130244”)` |

### A.67.5 Berkas

- **Diubah (nol berkas produk):** `docs/smoke-ui-slice07.mjs`, `docs/smoke-ui-kuis-materi.mjs`, `docs/audit-ui.mjs`.
- **Diubah (docs):** `docs/laporan-pengujian.md` (entri ini), `docs/handoff-sesi.md` (bagian 11 + tabel status).

### A.67.6 Batasan jujur

- **Audit ini berpola, bukan bedah baris-per-baris seluruh 33 harness.** Yang dicari adalah empat pola yang
  sudah terbukti mematikan pemeriksaan; klaim "harness lain bersih" berlaku untuk pola-pola itu.
- **`audit-ui.mjs` tidak dijalankan penuh lagi** sesudah perubahan (yang berubah hanya satu baris `console.log`
  di luar loop halaman); yang dijalankan adalah saringan `kuis` sebagai bukti jalur itu dieksekusi. Hasil audit
  penuh 44 halaman (`{}` di terang & gelap) berasal dari berkas sebelum perubahan itu.
- **Tiga negasi `kuis-materi` tetap tidak bisa mendeteksi "panel ada tapi salah panel"** — yang dijamin
  sekarang hanyalah: panel tidak terukur = GAGAL, dan daftar ukurnya benar-benar ada.
- **`./verify.sh` tidak dijalankan ulang di putaran ini** karena tidak ada berkas produk yang tersentuh
  (hanya harness/dokumentasi, yang tidak masuk cakupan `verify.sh`).

## A.68 — Bank soal dimuat bertahap + /pengaturan kembali menjadi halaman akun (13 Oktober 2026)

### A.68.1 Dua permintaan yang dikerjakan putaran ini

1. **“Bank soal jangan load semuanya.”** Daftar soal (dan daftar pilih-soal saat menyusun kuis) sebelumnya
   meminta seluruh bank dengan `GET /v1/soal` tanpa `per_page`, jadi sekolah dengan ratusan soal mengirim
   semuanya hanya untuk menampilkan baris pertama. Untuk menemukan soal ke-51 pun tidak ada jalan selain
   membuka halaman satu per satu (kotak cari belum ada).
2. **“Setelan ulangan ada di tiap kuis, bukan di halaman pengaturan — halaman itu untuk akun saja.”**
   Halaman `/pengaturan` (sejak 12 Oktober 2026) memang sudah per ulangan, tetapi masih berupa **pemilih
   ulangan**: guru harus memilih ulangannya dulu padahal ia sudah membuka kuis itu. Sekarang panelnya
   menyatu dengan halaman detail/kelola kuis, dan `/pengaturan` benar-benar berisi setelan akun.

### A.68.2 Bank soal: 20 baris per permintaan + pencarian di server

- `paramSoal()` baru di `sections/question/api.js` mengirim `page`, `per_page`, filter mapel/tag/tipe, dan
  `q` (kata kunci) — dipisah dari pemanggilan HTTP-nya supaya bisa diuji tanpa jaringan.
- Halaman Bank Soal memakai `useInfiniteQuery` dengan `getNextPageParam` dari `meta.current_page/last_page`:
  baris baru **ditambahkan** ke bawah daftar, bukan menggantikan. Tombol “Muat 20 soal berikutnya” hanya
  muncul bila masih ada halaman, dan keterangan berubah jadi “Menampilkan 20 dari 25 soal (dimuat bertahap)”.
- Kotak **Cari soal** mengirim kata kunci ke server setelah 300 ms (pola yang sama dengan halaman Murid),
  kembali ke halaman 1 tiap kata kunci berubah, dan keadaan kosongnya menyebut kata kuncinya +
  tombol *Bersihkan pencarian*.
- Panel **pilih soal** di langkah 2 editor kuis memakai mekanisme yang sama (20 baris + cari + muat berikutnya),
  sehingga soal ke-51 tetap terjangkau tanpa memuat seluruh bank.
- **Cacat yang ikut ditutup:** soal yang sudah dipilih tetapi tidak ada di halaman yang sedang tampil dulu
  terhitung **0 poin** dan lolos dari pemeriksaan “semua soal yang dipilih aktif” (`totalPoin()` memang
  mendokumentasikan “dihitung 0”, yang aman untuk tampilan tetapi salah untuk kelengkapan publikasi).
  Sekarang skor + status aktif soal yang pernah dilihat (dicentang, ikut termuat saat kuis dibuka, atau baru
  dibuat di sesi itu) dicatat di klien (`catatanSoal`) dan dipakai menghitung ringkasan langkah 3.

### A.68.3 Setelan ulangan pindah ke kuis; `/pengaturan` jadi halaman akun

**Frontend**

- `sections/quiz/PanelSetelanUlangan.jsx` (baru) = panel setelan **satu kuis**, tanpa pemilih lingkup:
  selalu menyimpan `lingkup: 'kuis'`, `lingkup_id: kuisId`. Nilai yang dikunci sekolah tetap ditandai
  “dikunci sekolah”, saklarnya mati, dan tombol massal melewatinya sambil melaporkan berapa yang dilewati.
- Panel itu dipasang di `HalamanKuisDetail` (halaman `/kuis/:slug`) untuk guru/admin; murid tidak melihatnya.
- `sections/settings/HalamanAkun.jsx` (baru) menggantikan `HalamanPengaturan.jsx`: nama tampilan + email
  (hanya dibaca), ganti kata sandi (sandi lama wajib), tema terang/gelap, pintasan avatar untuk murid, dan
  penunjuk bahwa setelan ulangan ada di tiap kuis. Akun siswa tamu mendapat penjelasan, bukan formulir yang
  pasti ditolak.
- Rute `/pengaturan` dipindah keluar dari gerbang guru (sekarang di grup `HanyaMasuk`) dan menunya bernama
  **Akun** — untuk guru **dan** murid. `sections/settings/lingkup.js` beserta tesnya dihapus (pemilihnya
  memang tidak ada lagi); tautan lama yang menunjuk “pengaturan lingkup Kuis” di editor kuis, Layar kelas,
  dan Kelola tim kini menunjuk halaman kuisnya.
- Aturan form akun ada di `sections/settings/validasiAkun.js` (cermin aturan server: nama 2–60 huruf, sandi
  baru ≥10 karakter dan dua kali sama; bentuk sandi **lama** tidak dinilai di klien karena hanya server yang
  bisa mencocokkannya).

**Backend**

- `PUT /v1/akun` (`AkunController@perbarui`) + `PUT /v1/akun/sandi` (`gantiSandi`), keduanya di dalam grup
  `auth:sanctum` + `akun-aktif`. Ganti sandi memakai throttle baru **`sandi`** (6/menit per akun).
- `AkunService` memegang aturannya: `perbaruiNama()`, `gantiSandi()` (sandi lama wajib benar, `remember_token`
  diacak ulang, **sesi lain diakhiri** sedangkan sesi yang sedang dipakai dibiarkan hidup), dan penolakan akun
  siswa tamu (mereka masuk lewat kode perangkat, tidak punya sandi). Controller tetap tipis dan tidak menyentuh
  fasade DB (pagar arch test).
- Email sengaja **tidak** bisa diubah dari sana: ia alamat verifikasi/pemulihan akun, jadi perubahannya butuh
  alur verifikasi tersendiri yang belum ada. Ini diuji (menyelipkan `email` di muatan tidak mengubah apa pun).

### A.68.4 Bukti (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `./verify.sh` (seluruh pagar mutu) | **SEMUA HIJAU (exit 0)** — Pest **357 lulus (3356 asersi)**, Redis wajib **9 lulus (65 asersi)**, Pint bersih (361 berkas), checkJs exit 0, ESLint **0 error** (2 peringatan lama), Vitest **79 berkas / 752 tes**, realtime 20 tes |
| `php artisan test --filter=AkunTest` | **10 lulus (41 asersi)** — nama, email tidak berubah, sandi lama salah ditolak, hash tersimpan, sandi baru benar-benar bisa masuk (lewat `POST /auth/masuk`), sesi lain diakhiri & sesi aktif hidup, tamu 422, tanpa sesi 401 |
| `npx vitest run src/__tests__/sections/question/bankSoalLazy.test.jsx` | **7 lulus** — `paramSoal`; permintaan pertama benar-benar `per_page: 20`; “muat berikutnya” meminta halaman 2 dan **menambahkan** baris (soal ke-25 muncul, 20 baris pertama tetap ada, tombolnya hilang saat habis); cari soal membawa `q` + kembali ke halaman 1; keadaan kosong pencarian |
| `npx vitest run src/__tests__/sections/quiz/setelanUlangan.test.jsx` | **4 lulus** — panel terikat pada kuis yang dibuka (tanpa `<select>` pemilih), “2/3 aktif” + “dikunci sekolah”, simpan memakai lingkup `kuis` + id kuisnya, tombol massal melewati yang dikunci dan melaporkannya |
| `npx vitest run src/__tests__/sections/settings/halamanAkun.test.jsx` | **6 lulus** — halaman akun tanpa satu pun saklar ulangan + penunjuk “per ulangan”; nama terisi dari sesi & email read-only; simpan nama memperbarui sesi; konfirmasi beda ditahan di klien; sandi terkirim lalu formulir dikosongkan; tampilan akun tamu |
| `npx vitest run src/__tests__/sections/settings/validasiAkun.test.js` | **7 lulus** — cermin aturan server, termasuk “sandi lama tidak dinilai bentuknya di klien” |
| `src/__tests__/shared/layout/kerangkaUmum.test.jsx` | **diperbarui** (menu “Pengaturan” → “Akun” + tautan `a[href="/pengaturan"]` ada di menu guru dan murid), lulus |
| `docs/jalankan-smoke-ui.sh pengaturan` (**harness ditulis ulang**, Chrome sungguhan) | **12/12 lulus · exit 0** — `/pengaturan` benar-benar halaman akun (judul “Akun”, nama “Admin Sekolah”, email terbaca, dua isian sandi, **0 saklar ulangan**, tanpa pemilih lingkup); alamat kuis memakai **slug** (`/kuis/gitbvewc`) dan membuka kuis yang benar; panel “Setelan ulangan” tampil di halaman itu (20 saklar + tombol massal); saklar diubah **lewat klik sungguhan** lalu dikembalikan (`false → true → false`) |
| `php artisan test --filter=SlugKuisTest` (alamat slug + pemiliknya) | **2 lulus (13 asersi)** — slug acak 8 huruf, `/v1/kuis/{slug}` = alamat resmi, dan **seluruh jalur (baca/ubah/hapus) kuis guru lain tetap 403 walau slug-nya diketahui** |
| `php artisan test --filter='OtorisasiPemilikTest\|BankSoalTest'` | **21 lulus (202 asersi)** — termasuk “guru lain tidak bisa membaca kuis, nilai, monitor, dan catatan kecurangan” serta “bank soal dikirim 20 baris per halaman dan bisa dicari” |
| `docs/jalankan-smoke-ui.sh slice03` (regresi bank soal + kuis) | **9/9 lulus · exit 0** — bank soal/editor kuis tetap jalan; keluaran menu membuktikan nama baru: guru `… Moderasi Avatar | Akun`, murid `… Progres Tema | Lencana | Akun` |
| `docs/jalankan-smoke-ui.sh susun` (regresi penyusunan kuis) | **44/44 lulus · exit 0** |
| `docs/jalankan-smoke-ui.sh kuis-manual` (regresi kuis manual, termasuk panel pilih-soal) | **15/15 lulus · exit 0** |

### A.68.5 Berkas

- **Baru (produk):** `backend/app/Sections/Auth/Services/AkunService.php`,
  `backend/app/Sections/Auth/Http/Controllers/AkunController.php`,
  `backend/app/Sections/Auth/Http/Requests/{PerbaruiAkunRequest,GantiSandiRequest}.php`,
  `frontend/src/sections/settings/HalamanAkun.jsx`, `frontend/src/sections/settings/validasiAkun.js`,
  `frontend/src/sections/quiz/PanelSetelanUlangan.jsx`.
- **Baru (uji):** `backend/tests/Feature/AkunTest.php`,
  `frontend/src/__tests__/sections/question/bankSoalLazy.test.jsx`,
  `frontend/src/__tests__/sections/quiz/setelanUlangan.test.jsx`,
  `frontend/src/__tests__/sections/settings/halamanAkun.test.jsx`,
  `frontend/src/__tests__/sections/settings/validasiAkun.test.js`.
- **Diubah (produk):** `backend/routes/api.php`, `backend/app/Providers/AppServiceProvider.php` (limiter `sandi`),
  `frontend/src/App.jsx`, `frontend/src/routes.js`, `frontend/src/shared/layout/KerangkaUmum.jsx`,
  `frontend/src/sections/question/api.js`, `frontend/src/sections/question/HalamanBankSoal.jsx`,
  `frontend/src/sections/quiz/HalamanKuis.jsx`, `frontend/src/sections/quiz/HalamanKuisDetail.jsx`,
  `frontend/src/sections/settings/api.js`, `frontend/src/sections/presence/HalamanLayar.jsx`,
  `frontend/src/sections/attempt/HalamanTim.jsx`.
- **Dihapus:** `frontend/src/sections/settings/HalamanPengaturan.jsx`,
  `frontend/src/sections/settings/lingkup.js`, `frontend/src/__tests__/sections/settings/lingkup.test.js`.
- **Diubah (harness):** `docs/smoke-ui-pengaturan.mjs` (ditulis ulang: halaman akun + panel per kuis),
  `docs/audit-ui.mjs` (label halaman “Akun”).
- **Diubah (docs):** `docs/penjelasan-fitur.md` (bagian 5 diperbarui, bagian 13 & 19 diselaraskan,
  bagian **20** dan **21** baru), `docs/laporan-pengujian.md` (entri ini).

### A.68.6 Batasan jujur

- **Bank soal yang “dimuat bertahap” belum punya pemeriksaan peramban khusus.** Yang membuktikannya di
  peramban adalah tes komponen (`bankSoalLazy`, 7 lulus) ditambah regresi `slice03`/`susun`/`kuis-manual`
  yang jalan di halaman dan panel yang sama — bukan harness yang benar-benar menekan “Muat 20 soal berikutnya”
  di Chrome. Jadi angka 20 dan perilaku “menambah baris” terbukti di uji komponen, belum di peramban.
- **Harness `pengaturan` hanya memakai satu kuis** (#248, yang pertama di daftar guru) untuk memeriksa panel
  setelan; panel pada kuis lain tidak diuji terpisah.
- **Kontrol negatif tidak dibuat** untuk kedua tes baru (tidak ada salinan tes yang dijalankan di atas kode
  lama untuk membuktikan tesnya bergigi). Tes peramban dulu yang memakai pola itu; di sini tidak diulang.
- **Halaman Akun belum menampilkan daftar sesi/perangkat** yang sedang masuk — hanya mengakhirinya.
- **`PUT /v1/akun` tidak menerima perubahan email**; bila nanti dibutuhkan, ia butuh alur verifikasi ulang
  tersendiri (belum dikerjakan).
- **Batas 20 baris ditentukan klien** (`PER_HALAMAN` di halaman Bank Soal dan `SOAL_PER_HALAMAN` di editor
  kuis); server tetap membatasinya di 100 baris per permintaan, jadi angka klien boleh berbeda tanpa membuka
  celah.

---

## A.69 — Bundel frontend dipotong per halaman dengan `React.lazy` + `Suspense` (13 Oktober 2026)

### A.69.1 Permintaan

**“Potong bundel frontend per halaman dengan React.lazy + Suspense supaya aplikasi tidak memuat semua kode
sekaligus.”** Keluhan yang benar: `App.jsx` mengimpor **semua** halaman secara statis, dan `npm run build`
memang mengeluarkan **satu** berkas JS **923,63 kB** (262,06 kB gzip) yang harus lewat jaringan sebelum apa pun
terlihat — termasuk editor materi, monitor ulangan, dan antrean koreksi guru di perangkat murid, serta layar
ulangan anak di perangkat guru.

### A.69.2 Yang diubah

- **`frontend/src/halaman.js` (baru)** = satu daftar pemuat halaman. 27 halaman dibungkus `React.lazy`,
  dan hanya di sini jalur impornya ditulis, sehingga `lazy` dan pramuat menu tidak mungkin menunjuk modul yang
  berbeda. Berisi juga `pemuatHalaman(jalur)` (murni, bisa diperiksa tes tanpa mengunduh modul) dan
  `pramuatHalaman(jalur)` (memulai unduhan; kegagalannya sengaja didiamkan karena pramuat hanyalah percepatan
  dan navigasi itu sendiri yang akan menampilkan galatnya).
- **`frontend/src/shared/ui/MemuatHalaman.jsx` (baru)** = penanda tunggu `Suspense` dengan `role="status"`.
- **`frontend/src/shared/layout/KerangkaUmum.jsx`** — `<Outlet />` dibungkus `Suspense`, dan tiap tautan menu
  memanggil `pramuatHalaman(to)` saat **disorot/difokus**. Boundary-nya sengaja di **dalam** kerangka, bukan
  membungkus seluruh aplikasi: dengan begitu menu, bilah atas, dan kaki halaman tetap di tempatnya selama modul
  diunduh (tidak ada layar kosong).
- **`frontend/src/shared/layout/KerangkaAuth.jsx`** — sama untuk halaman auth: panel merek sudah tampil lebih
  dulu, formulirnya menyusul.
- **`frontend/src/theme/theme.css`** — `.memuat-halaman`: muncul dengan jeda **150 ms** lalu memudar masuk, dan
  tingginya diisi (`min-height: 45vh`) supaya kaki halaman tidak melompat. Gerak dihentikan bila pengguna
  meminta `prefers-reduced-motion`. Tanpa warna hex baru (pagar `tema.test.js`).
- **`frontend/src/App.jsx`** — yang tetap diimpor statis hanya kerangka ulangan, `Beranda`, `HalamanMasuk`, dan
  `HalamanTidakDitemukan` (alasannya di dalam berkasnya); sisanya lewat `./halaman.js`.

### A.69.3 Hasil `npm run build` (angka, bukan kesan)

| | Sebelum | Sesudah |
| --- | --- | --- |
| JS sebelum halaman tampil | satu berkas **923,63 kB** / **262,06 kB gzip** | berkas utama **328,98 kB** (103,94 gzip) + 5 berkas `modulepreload` dari `index.html` (`client` 209,84/66,51 · `query` 7,74/2,68 · `mutation` 3,44/1,15 · `api` 3,75/1,46 · `api` 1,51/0,61) = **555,26 kB** / **176,35 kB gzip** |
| Berkas JS di `dist/assets` | 1 | 54 |

Selisih bundel awal: **−39,9% mentah**, **−32,7% gzip**. Yang tidak lagi ikut ke setiap pengguna antara lain
`HalamanKerjakan` 41,57 kB (14,27 gzip), `EditorSoal` 46,52 kB, `RendererSoal` 31,94 kB, `EditorMateri`
30,84 kB, `HalamanMonitor` 8,44 kB, `HalamanKoreksi` 8,24 kB.

Dicek ulang **di peramban sungguhan** (bangun produksi + `vite preview` + Chrome ber-CDP,
`docs/ukur-bundel-peramban.mjs`): membuka aplikasi hanya meminta **6 berkas JS = 555,30 kB** (sama dengan
keenam berkas di `index.html`), lalu berpindah ke `/daftar` cukup **2 berkas kecil** (2,35 kB + 1,17 kB) tanpa
muat ulang, dan `/lupa-sandi` 2 berkas kecil (2,27 kB + 0,41 kB). Jadi yang terkirim di awal benar-benar hanya
kerangka + halaman pertama, bukan seluruh aplikasi.

### A.69.4 Bukti (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `npm run build` (sebelum) | 1 berkas JS, **923,63 kB / 262,06 kB gzip** |
| `npm run build` (sesudah) | 54 berkas; peta ukuran di A.69.3 (keluaran membuktikan halaman-halaman berat keluar sebagai potongan sendiri) |
| `node docs/ukur-bundel-peramban.mjs` (bangun produksi di `vite preview` + Chrome ber-CDP; **harness baru**) | **exit 0** — Fase 1 membuka `/`: **6 berkas, 555,30 kB** (`index` 328,98 + `client` 209,85 + `query` 7,75 + `api` 3,76 + `mutation` 3,44 + `api` 1,52) dan beranda **benar-benar tampil** (bukan “Menyiapkan…”); Fase 2 menekan tautan “Daftar” di bilah atas (**navigasi dalam aplikasi, tanpa muat ulang**): hanya `HalamanDaftar` 2,35 kB + `MeterSandi` 1,17 kB menyusul, dan `#konten` berisi “Buat akun murid…”; Fase 3 membuka `/lupa-sandi` dari alamat: `HalamanLupaSandi` 2,27 kB + `useHitungMundur` 0,41 kB |
| `npm run check` (checkJs/tsc) | **exit 0** (tanpa galat) |
| `npm run lint` (ESLint) | **0 error** (2 peringatan lama di `HalamanDaftar.jsx`, `react-hooks/incompatible-library`, bukan dari perubahan ini) |
| `npm run test` (Vitest seluruhnya) | **80 berkas / 760 tes lulus** (sebelumnya 79/752) |
| `npx vitest run src/__tests__/halaman.test.js` | **6 lulus** — 27 halaman non-kerangka benar-benar bertanda `Symbol.for('react.lazy')` (impor statis tidak bertanda itu); peta pramuat menutup tiap jalur menu; rute berparameter (`/kuis/:slug`, `/kerjakan/12`, `/hasil/3`) & jalur asing **null**; beranda/auth sengaja null; **empat impor statis di `App.jsx` dikunci tes** (satu baris `import` statis baru sudah cukup mengembalikan seluruh kode ke bundel awal) |
| `npx vitest run src/__tests__/shared/layout/kerangkaUmum.test.jsx` | **9 lulus** (2 baru) — (a) tiap tautan menu hasil render punya pemuat, kecuali beranda; (b) halaman malas: penanda `.memuat-halaman` (`role=status`) menempati **area konten** sementara kepala, menu, dan kaki halaman tetap ada, lalu digantikan isi halaman setelah modulnya siap (janji lazy dikendalikan tes, bukan bergantung timing) |
| `docs/jalankan-smoke-ui.sh pengaturan` (Chrome sungguhan) | **12/12 lulus · exit 0** |
| `docs/jalankan-smoke-ui.sh susun` (editor kuis, semua halaman malas) | **44/44 lulus · exit 0** |
| `docs/jalankan-smoke-ui.sh slice04` (layar pengerjaan `/kerjakan` + hasil `/hasil`, keduanya kini malas) | **18/18 lulus · exit 0** — timer, autosave, kumpul, skor, tolak jawaban sesudah kumpul semuanya tetap benar |
| `docs/jalankan-smoke-ui.sh nav` (responsif 390 px & 1280 px, menu → halaman malas) | **14/14 lulus · exit 0** |
| `docs/jalankan-smoke-ui.sh kuis-materi` (editor materi + pemutar materi, dua halaman malas terberat: 30,84 kB & 16,28 kB) | **48/48 lulus · exit 0** |
| `docs/jalankan-smoke-ui.sh slice07` (Monitor Ulangan + presence/SSE) | **21/21 lulus · exit 0** |

Backend, realtime, dan basis data **tidak disentuh** putaran ini, jadi Pest/Pint/Redis tidak dijalankan ulang.

### A.69.5 Berkas

- **Baru (produk):** `frontend/src/halaman.js`, `frontend/src/shared/ui/MemuatHalaman.jsx`.
- **Diubah (produk):** `frontend/src/App.jsx`, `frontend/src/shared/layout/KerangkaUmum.jsx`,
  `frontend/src/shared/layout/KerangkaAuth.jsx`, `frontend/src/theme/theme.css`.
- **Baru (uji):** `frontend/src/__tests__/halaman.test.js`.
- **Diubah (uji):** `frontend/src/__tests__/shared/layout/kerangkaUmum.test.jsx`.
- **Baru (harness):** `docs/ukur-bundel-peramban.mjs` — mengukur di peramban sungguhan berkas JS mana yang
  benar-benar diminta (`Network` CDP), beserta resep menjalankannya di kepala berkas. Butuh
  `npm run build` + `vite preview` + Chrome ber-CDP; backend tidak perlu karena halaman yang diukur
  (beranda tamu dan halaman auth) tampil tanpa sesi.
- **Diubah (docs):** `docs/penjelasan-fitur.md` (bagian **22** baru), `docs/laporan-pengujian.md` (entri ini),
  `docs/handoff-sesi.md` (bagian 13).

### A.69.6 Batasan jujur

- **Angka bundel awal terbukti dua kali, tetapi tetap ada batasnya.** Keluaran `npm run build` dan pengukuran
  `Network` CDP di Chrome cocok (6 berkas / 555,30 kB), tetapi pengukuran peramban itu dilakukan pada rute
  **tanpa sesi** (beranda tamu, `/daftar`, `/lupa-sandi`) dan **tanpa backend** — jadi ia membuktikan
  “awalnya hanya 6 berkas dan sisanya menyusul per halaman”, bukan menyebut waktu muat atau byte terkompresi
  (angka gzip 176,35 kB tetap dari Vite). Jalur ber-sesi (panel samping guru, halaman kuis) tidak diukur
  byte-nya, hanya dibuktikan tetap berfungsi oleh empat harness smoke di A.69.4.
- **Belum ada harness peramban khusus rute malas.** Yang membuktikan di peramban adalah empat harness yang sudah
  ada (`pengaturan`, `susun`, `slice04`, `nav`) — jadi terbukti halaman malas tetap terbuka dan berfungsi, tetapi
  tidak ada satu pun yang mengukur “potongan mana yang diunduh kapan” atau kegagalan unduhan satu potongan.
- **Jeda 150 ms penanda tunggu tidak diperiksa secara visual** (tidak ada pembanding tangkapan layar), hanya
  ditetapkan lewat CSS dan alasannya.
- **Belum ada kontrol negatif** untuk tes baru (tidak ada salinan tes yang dijalankan di atas kode lama untuk
  membuktikan tesnya bergigit).
- **Dua potongan vendor tetap besar dan tetap ikut di awal** karena memang selalu dipakai: `react-dom` + react +
  zustand (328,98 kB) dan `axios` + `react-router` (209,84 kB). Itu batas teknis tumpukan yang dipilih, bukan sisa
  kode halaman.
- **Pramuat hanya untuk tautan menu panel samping.** Halaman auth (selain “Masuk”) dan rute berparameter
  (`/kuis/:slug`, `/kerjakan/:id`) tidak dipramuat karena jalurnya baru diketahui saat diklik — halaman ini muncul
  dengan penanda tunggu sejenak, bukan seketika.

## A.70 — Patch kinerja & rekam diri dari luar repo (13 Oktober 2026)

### A.70.1 Permintaan & asal berkas

**“Cek file patch ini apakah relevan, jika ya apply.”** Berkasnya dua: `backend.patch` (8 berkas) dan
`frontend.patch` (1 berkas), datang dari luar repo sebagai `files (68).zip`. Sesuai aturan AGENT.md
(“pekerjaan luar repo wajib dicatat tempatnya dan tidak boleh dijadikan bukti tanpa diverifikasi ulang di repo
ini”), isinya **diperiksa satu per satu lebih dulu**, lalu diterapkan dan diverifikasi ulang di sini — bukan
dipercaya apa adanya.

Relevan, karena:

- kesembilan berkas tujuannya ada di repo ini dan cocok konteksnya (`git apply --check` bersih, tanpa konflik);
- tiap hunk menunjuk masalah yang bisa dibaca di kode: soal hidup dimuat dua kali per permintaan, empat kueri
  hitung soal di jalur mulai, satu `SELECT` + satu `argon2id` per baris CSV, dan `snapshot_soal` (JSON berisi
  seluruh soal **beserta kunci**) ikut ditarik monitor/ekspor walau tidak pernah dibaca;
- klaim di komentar patch diperiksa terhadap kenyataan kode, termasuk daftar kolom `KOLOM_RINGAN` yang
  dibandingkan dengan seluruh kolom tabel `attempts` di migrasi (lengkap, hanya `snapshot_soal` yang dibuang)
  dan satu-satunya pembaca kolom itu di seluruh `backend/app` (hanya `AttemptService`).

### A.70.2 Yang diubah

**Backend — kueri berulang (5 berkas produk):**

- **`AttemptService` + `AttemptController`** — `soalHidup()` yang dulu `private` kini dipakai ulang: controller
  memuatnya **sekali** lalu memberikannya ke `payloadSoal()` + `versiSoal()` (dulu dua kueri identik per
  permintaan, di jalur yang ditekan serempak sekelas saat ulangan mulai). Kolom yang diambil juga dipersempit ke
  yang benar-benar dibaca pemanggil (`id`, `konten`, `updated_at`).
- **`AttemptService::mulai()`** — soal kuis dimuat sekali untuk hitungan, `skor_maksimal`, dan snapshot (dulu
  empat kueri terpisah).
- **`ImporMuridService`** — email akun non-murid dimuat **sekali per berkas** (dulu satu `SELECT` per baris CSV),
  dan murid tanpa `kata_sandi` berbagi **satu** hash acak per impor (dulu `argon2id` dihitung per baris; ratusan
  murid = lambat/timeout). Plaintext tetap dibuang — tak ada yang tahu kata sandi hasilnya.

**Backend — kueri berat yang tak perlu (2 berkas) + 2 pengetatan:**

- **`Attempt::scopeTanpaSnapshot()` (baru)** + dipakai di **`MonitorService`** dan **`EksporNilaiService`**: dua
  jalur itu berhenti menarik `snapshot_soal`. Daftar kolomnya eksplisit, jadi **setiap migrasi yang menambah
  kolom `attempts` wajib menambahkan kolomnya ke `KOLOM_RINGAN`** (dijaga komentar di model).
- **`PenilaiAiService::antre()`** memakai `->afterCommit()`: `antre()` dipanggil dari dalam transaksi `tutup()`,
  dan tanpa ini worker bisa membaca attempt **sebelum** commit sehingga `kandidat()` kosong dan saran AI hilang
  diam-diam.
- **`config/queue.php`** — `retry_after` koneksi `database` 90 → **180** detik (memakai `env()` yang sama, jadi
  `.env` bisa menimpanya).

**Frontend — dua cacat rekam diri (`UnggahLampiran.jsx`):**

1. **Durasi selalu salah.** `onstop` disusun sekali saat tombol ditekan, jadi membaca `detikRekam` dari state di
   dalamnya memberikan nilai basi — rekaman 3 atau 60 detik terkirim sebagai **0 detik**. Nilainya kini dibaca
   dari ref (`durasiRekam`) yang diperbarui timer tiap detik.
2. **Keluar dari soal saat merekam tidak dibersihkan.** Dulu perekam dan kamera/mikrofon tetap hidup dan
   potongan rekaman yang ditinggalkan ikut terunggah. Kini `useEffect` pembersih menandai batal, menghentikan
   perekam, mematikan tiap jalur media, dan `onstop` membuang potongannya tanpa mengunggah.

### A.70.3 Angka (diukur, bukan kesan)

| Yang diukur | Sebelum | Sesudah | Cara |
| --- | --- | --- | --- |
| Kueri untuk `payloadSoal` + `versiSoal` (attempt berjalan, 10 soal) | **2 kueri** | **1 kueri** | tes Pest sementara dengan `DB::listen`, dijalankan lalu **dihapus** lagi |
| Durasi rekaman yang dikirim | **0 detik** (3 dtk maupun 60 dtk) | **3** dan **60** detik | tes baru `unggahLampiranRekam.test.jsx` |

Tidak diukur (dan tidak diklaim) putaran ini: pengurangan kueri impor CSV, monitor, dan ekspor — ketiganya
terbukti **benar** lewat suite yang hijau, bukan lewat hitungan kueri pada data besar.

### A.70.4 Bukti (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `git apply --check -p1` (kedua patch) | **bersih**, tanpa konflik; diterapkan dengan `git apply` dan hanya satu berkas yang perlu ditata ulang Pint |
| `./vendor/bin/pint app/Sections/Attempt/Services/AttemptService.php` | **1 gaya diperbaiki** — `?\Illuminate\Support\Collection` ditulis penuh di tanda tangan; Pint menambahkan `use Illuminate\Support\Collection;` |
| `./verify.sh` (**akhir putaran**) | **SEMUA HIJAU (exit 0)** — Pest **357 lulus (3356 asersi)** · Redis wajib **9/65** · Pint bersih · checkJs exit 0 · ESLint 0 error · Vitest **81 berkas / 763 tes** · realtime lulus |
| `npx vitest run src/__tests__/sections/attempt/unggahLampiranRekam.test.jsx` (sesudah) | **3 lulus** — durasi 3 detik terkirim apa adanya, keluar soal = jalur video & audio dihentikan dan **tidak ada unggahan**, batas 60 detik mengirim **60** |
| **Kontrol negatif**: tes yang sama dijalankan atas kode **sebelum** patch | **3/3 MERAH** — `expected +0 to be 3` · jalur kamera `not called` · `expected +0 to be 60`; sesudah dipulihkan 3/3 hijau |
| Tes Pest sementara pengukur kueri (lalu dihapus) | **`tanpa-ulang=2 q · dengan-ulang=1 q`**, 1 lulus |

Backend dan frontend **disentuh** putaran ini, jadi seluruh isi `./verify.sh` dijalankan (bukan hanya sisi yang
berubah). Harness GUI tidak dijalankan ulang: tidak ada berkas tampilan/harness yang berubah, dan rekam diri
butuh kamera sungguhan (lihat batasan di bawah).

### A.70.5 Berkas

- **Diubah (backend):** `app/Sections/Attempt/Services/AttemptService.php`,
  `app/Sections/Attempt/Http/Controllers/AttemptController.php`, `app/Sections/Attempt/Models/Attempt.php`,
  `app/Sections/Presence/Services/MonitorService.php`, `app/Sections/Report/Services/EksporNilaiService.php`,
  `app/Sections/School/Services/ImporMuridService.php`, `app/Sections/Scoring/Services/PenilaiAiService.php`,
  `config/queue.php`.
- **Diubah (frontend):** `frontend/src/sections/attempt/UnggahLampiran.jsx`.
- **Baru (uji):** `frontend/src/__tests__/sections/attempt/unggahLampiranRekam.test.jsx` (205 baris, 3 tes).
- **Diubah (docs):** `docs/laporan-pengujian.md` (entri ini), `docs/handoff-sesi.md` (bagian 14).
- **Commit:** `b1025b4` (rekam diri + tes), `90512a2` (kueri backend), dan satu commit dokumentasi
  (laporan ini + handoff). Belum di-push.

### A.70.6 Batasan jujur

- **Patch ini datang dari luar repo.** Tempat asalnya dicatat di sini; seluruh isinya diperiksa baris per baris
  sebelum diterapkan dan diverifikasi ulang di repo ini, jadi klaim di dalamnya tidak berdiri sebagai bukti.
- **Perbaikan N+1 impor/monitor/ekspor hanya terbukti benar, bukan terbukti hemat** — tidak ada pengukuran
  jumlah kueri atau waktu pada berkas CSV besar / kelas besar. Yang diukur hanya jalur query payload+versi.
- **Rekam diri diuji di jsdom dengan `MediaRecorder` palsu**, bukan di peramban sungguhan dengan kamera: yang
  dibuktikan adalah logika durasi dan pembersihan, bukan kualitas berkas rekaman. Tidak ada harness GUI untuk
  kamera (perlu izin perangkat) dan itu memang belum dibuat.
- **`KOLOM_RINGAN` harus disiplin dirawat:** migrasi baru yang menambah kolom `attempts` wajib memperbarui daftar
  itu, atau akses kolom baru di monitor/ekspor akan melempar `MissingAttributeException` (di non-produksi).
- **`retry_after` hanya naik untuk koneksi `database`** (yang dipakai `.env`); opsi Redis/beanstalk tetap 90 detik.
  Kenaikannya juga menunda percobaan ulang pekerjaan yang benar-benar gagal, jadi ini tukar-menukar yang sadar.
- **Belum di-push.** `origin/main` masih tertinggal seluruh commit sesi ini (`git rev-list --count
  origin/main..HEAD`); pekerjaan besar A.61–A.69 (65 entri) juga masih menumpuk di working tree dan belum ikut
  dikomit putaran ini.

## A.71 — Log mentah diganti dari sesi asli (412 MB, 539 pesan) + folder `docs/` dirapikan (13 Oktober 2026)

### A.71.1 Permintaan

**“`sesi-2026-10-05-transkrip.md` kau ganti dengan ini sebagai log penuh, buatkan log benar-benar [benar],
ringkas, dan rapihin folder docs (ingat sesi-mu juga ditambahkan).”** Lampirannya `chat-messages.json.zip`
berisi berkas sesi asli proyek ini sebesar **412.229.403 byte**. Jawaban atas pertanyaan pilihan: struktur
folder dirapikan **secara aman** (tanpa memindahkan harness/skrip/laporan yang dirujuk banyak berkas) dan
log ditulis **utuh** dengan tambahan **indeks ringkas**.

### A.71.2 Yang ditemukan sebelum mengerjakan

- Sesi `2026-10-05T07-39-24.876Z` kini **412 MB / 539 pesan** (log yang tersimpan di repo sebelumnya adalah
  snapshot 10 Okt: 76 MB / 207 pesan), tetapi sekitar 400 MB isinya `metadata.runState` yang berulang tiap
  pesan.
- Ekspor lama memakai `json.load` — artinya berkas 412 MB harus dimuat **utuh** ke memori. Di mesin ini
  (RAM 8 GB, sisa bebas di bawah 1 GB saat dikerjakan) itu bukan sekadar lambat, melainkan berisiko OOM.
- Ada **tiga** sesi yang benar-benar berisi percakapan di folder chat proyek ini: sesi besar itu,
  `2026-10-12T13-01-29.434Z` (543.490 byte · 2 pesan), dan `2026-10-13T12-30-29.489Z` = sesi putaran ini
  (5,8 MB · 6 pesan). Tujuh puluh satu folder lain tidak memuat `chat-messages.json`.

### A.71.3 Yang diubah

- **`docs/export-log-sesi.py` (ditulis ulang).** Berkas sesi dibaca **per pesan** memakai
  `json.JSONDecoder.raw_decode` dengan buffer 1 MB yang dipangkas setelah tiap pesan, jadi puncak memori tetap
  ratusan MB (terukur **270 MB** untuk berkas 412 MB). Tanpa argumen ia mengekspor **semua** sesi yang ada;
  satu folder per sesi berisi `chat-messages.json.gz` (byte-exact), `transkrip.md` (utuh), dan `info.json`
  (jumlah pesan, ukuran, md5, waktu ekspor). `docs/log-mentah/README.md` — indeks ringkas semua sesi —
  **dibuat ulang tiap ekspor**, jadi angkanya tidak mungkin basi.
- **Struktur `docs/log-mentah/` dirapikan** menjadi `2026-10-05T07-39-24.876Z/`, `2026-10-12T13-01-29.434Z/`,
  `2026-10-13T12-30-29.489Z/`, plus `tangkapan/` (7 potret bukti), `eksternal/` (prompt & log AI luar repo),
  dan `README.md`. Dua berkas lama (`sesi-2026-10-05-chat-messages.json.gz`, `sesi-2026-10-05-transkrip.md`)
  dihapus karena sudah digantikan versi yang lebih lengkap — bukan dibiarkan sebagai salinan ketinggalan.
- **Rujukan ikut diperbarui** (tanpa memindahkan berkas yang dirujuk): `AGENT.md`, `00-index.json`,
  `docs/word/AGENT.md`, `docs/jurnal-prompt.md`, `docs/laporan-pengujian.md`, `docs/handoff-sesi.md`,
  dan `docs/export-word.sh` (sumber `log-mentah.docx` kini **gabungan transkrip semua sesi**, bukan satu
  berkas bertanggal tetap).
- **`docs/README.md` (baru)** = daftar isi folder `docs/`: dokumen untuk dikumpulkan, laporan, log mentah,
  runner + daftar harness, alat ekspor, dan aturan singkatnya.
- **`docs/export_word_sesi.py`** disesuaikan (berkas `.md` di `log-mentah/` kini dicari rekursif).

### A.71.4 Angka (diukur)

| | Log yang tersimpan sebelumnya (snapshot 10 Okt) | Setelah A.71 (13 Okt) |
| --- | --- | --- |
| `chat-messages.json` (sumber) | ≈76 MB · 207 pesan | **412.229.403 B · 539 pesan** |
| `chat-messages.json.gz` (byte-exact) | 28.352.816 B | **68.581.188 B** |
| `transkrip.md` (utuh) | 13.052.539 B | **26.819.105 B** |
| Puncak memori ekspor | memuat JSON utuh (tidak terukur; 412 MB butuh GB) | **270 MB** · 3 sesi dalam **15,6 detik** |

### A.71.5 Bukti (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `python3 docs/export-log-sesi.py` | **3 sesi** diekspor; `2026-10-05…`: 539 pesan · 412.229.403 B (md5 `ccc58e6bc00045be22af061f89e10f3b`) · gz 68.581.188 B · transkrip 26.819.105 B |
| `gzip -dc <sesi>/chat-messages.json.gz \| md5` (dua sesi, independen dari skrip) | **sama** dengan `chat_messages_md5` di `info.json` sesi itu — byte-exact terbukti untuk sesi 412 MB dan sesi putaran ini |
| `bash -n docs/export-word.sh` + uji logika penggabungan | sintaks OK; dua folder uji → dua transkrip **digabung**, kasus tanpa transkrip **dilewati** tanpa keluar dengan galat |
| `grep -rn` rujukan path lama di luar `log-mentah/` | **0 sisa** (isi log mentah sendiri sengaja tidak disentuh) |
| `python3 -c "ast.parse(...)"` untuk `export-log-sesi.py` & `export_word_sesi.py` | sintaks OK |

Berkas aplikasi (backend/frontend/realtime) **tidak disentuh** putaran ini, jadi `./verify.sh` tidak dijalankan
ulang — tidak ada satu baris pun kode produk yang berubah.

### A.71.6 Batasan jujur

- **Transkrip sesi putaran ini adalah snapshot saat ekspor.** Sesi `2026-10-13T12-30-29.489Z` masih berjalan,
  jadi `transkrip.md` + `.gz`-nya berhenti pada pesan terakhir yang sudah tertulis ke berkas sesi; jalankan
  ulang `python3 docs/export-log-sesi.py` sebelum mengumpulkan.
- **`docs/word/log-mentah.docx` belum diekspor ulang.** Sumbernya kini gabungan transkrip ~27 MB, jadi pandoc/
  python-docx butuh waktu dan berkasnya besar; ini masuk langkah penyegaran dokumen (papan pending 0.6 butir 3),
  bukan dikerjakan di sini.
- **Repo bertambah ≈95 MB** (68,6 MB `.gz` + 26,8 MB transkrip). Masih di bawah batas berkas GitHub (100 MB),
  tetapi sesi besar yang terus berjalan bisa mendekati batas itu — kalau terjadi, yang dipotong adalah
  *transkrip* (diringkas sebagai berkas tambahan), **bukan** salinan byte-exact-nya.
- **Perapian hanya menyentuh `docs/log-mentah/` + indeks baru.** Harness (`.mjs`), runner (`.sh`), dan laporan
  tetap di tempatnya karena dirujuk puluhan berkas; memindahkannya ditawarkan sebagai opsi penuh dan
  **belum** dikerjakan.
- **51 folder sesi lain** di folder chat proyek tidak memuat `chat-messages.json` (hanya berkas runtime),
  jadi tidak ada isi percakapan yang bisa diekspor dari sana.

### A.71.7 Berkas

- **Ditulis ulang:** `docs/export-log-sesi.py`; **disesuaikan:** `docs/export-word.sh`, `docs/export_word_sesi.py`.
- **Baru:** `docs/README.md`, `docs/log-mentah/README.md` (dibuat skrip), tiga folder
  `docs/log-mentah/<sesi>/` (`chat-messages.json.gz`, `transkrip.md`, `info.json`) di dalamnya.
- **Dipindah:** delapan berkas ke `docs/log-mentah/tangkapan/` dan `docs/log-mentah/eksternal/` (isi tidak diubah).
- **Dihapus:** `docs/log-mentah/sesi-2026-10-05-chat-messages.json.gz`, `docs/log-mentah/sesi-2026-10-05-transkrip.md`.
- **Diubah (rujukan):** `AGENT.md`, `00-index.json`, `docs/word/AGENT.md`, `docs/jurnal-prompt.md`,
  `docs/handoff-sesi.md`, dan entri A.18/A.33 di laporan ini.

## A.72 — Pekerjaan A.61–A.69 yang menumpuk dikomit (13 Oktober 2026)

### A.72.1 Permintaan

**“Commit 63 entri working tree (A.61–A.69) kecil-kecil mengikuti gaya riwayat yang ada.”** Tumpukan ini sudah
terverifikasi hijau (lihat A.68/A.69/A.70), tetapi belum pernah dikomit — bahaya nyatanya bukan sekadar repo
online tertinggal, melainkan kehilangan seluruh putaran itu kalau berkas kerja terhapus.

### A.72.2 Enam commit (satu tema satu commit)

| Commit | Judul | Isi pokok |
| --- | --- | --- |
| `1a2db5f` | Pakai slug acak sebagai alamat kuis supaya id tidak bisa disisir | migrasi slug, `Kuis` (route key + `slugBaru`), `KuisService`, `KuisFactory`, dua resource, `SlugKuisTest` |
| `9192eaf` | Buka tiap layar kuis lewat slug dan rapikan pil saring yang menggantung | `routes.js` (+`kunciKuisSah`), tujuh halaman berparameter, lapisan api, dan perbaikan pil saring Beranda/Monitor + CSS-nya |
| `7e2001c` | Muat bank soal 20 baris sekali jalan dan cari di seluruh bank | `SoalController` (`per_page`, `q` lewat `konten->teks`), `paramSoal`, `HalamanBankSoal`, panel pilih soal di `HalamanKuis` (+`catatanSoal`), tes `bankSoalLazy` |
| `7fc4f57` | Jadikan /pengaturan halaman akun dan pindahkan setelan ulangan ke kuisnya | `AkunController` + `AkunService` + dua request + limiter `sandi`, `HalamanAkun`/`validasiAkun`, `PanelSetelanUlangan`, penghapusan `HalamanPengaturan`/`lingkup` + tesnya, harness `pengaturan` & audit UI |
| `d60cc1e` | Potong bundel per halaman dengan React.lazy dan Suspense di dalam kerangka | `halaman.js`, `MemuatHalaman`, `App.jsx`, dua kerangka, `halaman.test.js`, `kerangkaUmum.test.jsx`, `ukur-bundel-peramban.mjs` |
| `95a1a88` | Catat bank soal bertahap, halaman akun, dan bundel per halaman untuk juri | tiga bagian baru di `penjelasan-fitur.md` |

### A.72.3 Bukti

| Pemeriksaan | Hasil |
| --- | --- |
| `git status --short` sesudah commit terakhir | **kosong** (63 entri → 0) |
| `git show --name-only` keenam commit, dicari sampah | tidak ada `*.zip`, `DS_Store`, `.agents/`, `.claude/`, `node_modules` |
| `./verify.sh` (dijalankan pada pohon **sesudah** semua commit) | **SEMUA HIJAU (exit 0)** — Pest **357/3356** · Redis wajib **9/65** · Pint bersih · checkJs exit 0 · ESLint 0 error · Vitest **81 berkas/763 tes** · realtime lulus |

### A.72.4 Batasan jujur

- **Tidak setiap commit bisa dijalankan sendiri.** `App.jsx` membawa dua putaran sekaligus (rute akun dari A.68
dan impor malas dari A.69), jadi commit `7fc4f57` (yang menghapus `HalamanPengaturan.jsx`) meninggalkan
`App.jsx` versi commit itu masih mengimpornya; commit `d60cc1e` menutupnya. Berkas `theme.css` juga membawa
perbaikan pil saring dan blok `.memuat-halaman` sekaligus. Yang **diverifikasi hijau adalah pohon terakhir**
(`./verify.sh`), bukan tiap titik tengah — memecahnya lagi hanya bisa dengan staging per-hunk dan risikonya tidak
sepadan.
- **Ini rekonstruksi riwayat, bukan commit seperti aslinya.** Isi berkasnya sama dengan pohon yang sudah
diverifikasi di A.68/A.69 (tidak ada baris kode yang diubah putaran ini); yang dilakukan hanya memecahnya jadi
enam commit bertema mengikuti gaya judul yang ada.
- **Harness GUI tidak dijalankan ulang** karena tidak ada isi berkas aplikasi yang berubah sejak A.69 (yang
sudah membuktikan `pengaturan` 12/12, `susun` 44/44, `slice04` 18/18, `nav` 14/14, `kuis-materi` 48/48, dan
`slice07` 21/21).
- **Belum di-push.** `origin/main` masih tertinggal seluruh commit A.65–A.72 (`git rev-list --count
origin/main..HEAD`; **17** saat entri ini ditulis, sebelum commit dokumentasi ini). Push adalah langkah yang
diminta terpisah dan belum dilakukan.

### A.72.5 Berkas

Tidak ada berkas baru/diubah. Yang berubah hanyalah **riwayat git**: 63 entri working tree (44 diubah · 3
dihapus · 18 baru) masuk ke enam commit di A.72.2, dan working tree kini bersih.

## A.73 — Latar tema Luar Angkasa & Harta Karun dirombak total (13 Oktober 2026)

### A.73.1 Permintaan & pembagian putaran

Permintaan pemilik produk datang dalam satu pesan panjang (ejaan aslinya): *"pertama kau rombak yang angkasa
dan pantai kau rombak sangat jauh rombak boleh apke grfis gratis atau svg elbih amtang namun baung dulu yang
sekarang lalu yang aspek rasio di baung saja dan ketika ingrin scrool pakai laptop dalam device nya pastiakn
yang di tuju kuros maka di scroll duluan bukna yang mentok duluan agar labih nyaman di pakai"*, lalu disusul
satu pesan lagi tentang **admin sekolah** (monitor skala sekolah + wewenang mengubah email/sandi murid-guru) dan
**fitur guru** (unggah media + tanda sendiri tiap langkah). Empat hal itu dipisah menjadi empat putaran:

| Putaran | Isi |
| --- | --- |
| **A.73** (entri ini) | Latar `angkasa.svg` + `pulau.svg` dirombak total, aset CC0 dari internet boleh dipakai, rasio 16:9 dilanjutkan |
| A.74 | Perilaku gulir: yang ditunjuk kursor digulir lebih dulu, bukan wadah yang sudah mentok |
| A.75 | Beranda admin jadi monitor sekolah + wewenang admin atas email/sandi murid & guru |
| A.76 | Guru mengunggah media per langkah materi dan memilih tanda/langkahnya sendiri |

Jawaban pemilik produk atas pertanyaan pilihan sebelum kerja dimulai: **langsung ganti** (tanpa menyimpan
versi lama berdampingan — riwayat git sudah menyimpannya), **pakai aset CC0 dari internet**, dan monitor admin
**menempel di beranda admin** (bukan rute baru).

### A.73.2 Yang dirombak

Kedua berkas diganti **seluruhnya**, bukan disetel: komposisi lamanya dibuang dan digambar ulang dari nol.

- **`pulau.svg`** — langit siang bergradien + matahari bersinar (8 berkas sinar), tiga gugus awan, pulau jauh dan
  perahu kecil di cakrawala, **laut berlapis tiga** (jauh, tengah, ombak) berikut kilau dan pantulan matahari,
  **pantai berpasir diagonal** dengan kerang/kerang bintang/footprint, bukit rimba bertingkat, **enam pohon
  kelapa** yang digambar di koordinat absolut (tanpa `transform`), tanjung batu ber-goa dengan **peti harta
  karun** di mulutnya, **dermaga kayu** (dek berpapan, tiang, tali, peti, tong, lentera), **perahu layar**
  (lambung, tiang, dua layar, bendera, pantulan), dan **karang berwarna** berikut ikan serta gelembung.
- **`angkasa.svg`** — langit malam tiga tingkat, pita galaksi menyilang, tiga nebula berwarna, ~60 bintang
  (sebagian berkilau empat sudut), dua bintang jatuh, satelit kecil, komet, Bumi berawan berikut bayangan
  malam, sabuk asteroid (10 batu + debu), Saturnus bercincin (**cincin depan digambar terpisah** di atas bola
  planet, bukan satu elips), Bulan berkawah dengan halo, dan kompleks peluncuran (dermaga, menara, tangki,
  roket, asap, lampu).

Aturan yang **tidak** berubah — justru inilah yang mengikat gambar baru:

- **Rasio tetap 16:9** (`viewBox="0 0 1600 900"`, `width="1600"`, `height="900"`), seperti diminta; panggung peta
  dipotong `object-fit: cover`, jadi rasio lain akan memotong puncak/tanjung.
- **Rute pos tidak digeser.** `RUTE_TEMA.pulau` dan `RUTE_TEMA.angkasa` tetap seperti sebelumnya; yang digambar
  ulang adalah **benda yang diinjak pos**, dan tiap benda tetap ber-`id` (`dermaga`, `perahu`, `karang`,
  `pantai`, `hutan`, `goa` / `landasan`, `bumi`, `asteroid`, `saturnus`, `bulan`) sehingga pagar mutu bisa
  membuktikan pos benar-benar berdiri di atas gambar, bukan di ruang kosong.
- **Sisi miring dijaga < 55°.** Pagar `latarTema.test.js` menolak "dinding nyaris tegak" yang panjang (bekas
  keluhan *"tebing"*). Pada percobaan pertama, lereng rimba melanggar aturan ini (132 px ruas nyaris tegak pada
  bentuk selebar 820 px); lerengnya dibuat ulang lebih landai dan sekarang nol pelanggaran.

### A.73.3 Cara aset CC0 dipakai (bukan sekadar diklaim)

Lima ikon CC0 dari Wikimedia Commons benar-benar disisipkan: **roket**, **bintang**, dan **Mars** di
`angkasa.svg`; **peti harta karun** dan **karang** di `pulau.svg`. Sumber, pembuat, dan lisensinya ditulis di
`frontend/public/tema/LISENSI.md` (bagian "Aset CC0 yang dipakai (putaran A.73)").

Alur kerjanya (bisa diulang, bukan langkah rahasia):

1. **Cari & unduh** — kandidat diambil dari Wikimedia Commons (CC0) lewat API `commons.wikimedia.org/w/api.php`,
   lalu berkasnya diunduh dari `upload.wikimedia.org`.
2. **Datar-kan koordinat** — skrip kecil (`datar.py`, di luar repo) mengubah `H`/`V`/`S` menjadi `L`/`C` dan
   **membakar `transform` grup** ke koordinat absolut, lalu memindahkannya ke tempat + ukuran yang diminta.
   Alasannya teknis: pagar mutu membaca koordinat **mentah** dan hanya mengerti `M`/`L`/`C`/`Z`. Karena itu
   berkas akhir tidak memuat satu pun `transform` (diperiksa: **0**).
3. **Timpa warna** ke palet tema masing-masing — tidak ada ikon hitam nyasar di latar siang.

Yang dicari tetapi **tidak dipakai**, supaya tidak diulang tanpa hasil:

- **Adegan utuh dari situs vektor bebas** (publicdomainvectors, freesvg): kandidatnya hanya tersedia sebagai
  **AI/EPS**, dan unduhan `.svg`-nya gagal dari lingkungan ini (TLS/429). Yang tersedia dari situs-situs itu
  berupa ikon satu warna, bukan adegan.
- **Ikon siluet untuk benda utama** (palem, ikan, Venus): hanya siluet satu warna, akan terbaca seperti stempel
  kalau dipakai sebagai pohon/perahu. Pohon kelapa karena itu digambar di repo; ikon siluet hanya dipakai untuk
  benda yang memang wajar jadi siluet (roket, peti, karang, bintang, Mars).

### A.73.4 Bukti (dijalankan, bukan klaim)

| Perintah | Hasil |
| --- | --- |
| `npx vitest run src/__tests__/theme` | **23 lulus (3 berkas)** — pagar bentuk + kecerahan + pos mendarat untuk gunung/pulau/angkasa |
| `bash docs/jalankan-smoke-perjalanan.sh` (peramban sungguhan, Chrome headless CDP) | **69/69 LULUS** |

Angka dari harness peramban itu yang membuat putaran ini bukan sekadar "sudah diganti":

| Pemeriksaan harness | angkasa (baru) | pulau (baru) |
| --- | --- | --- |
| Berkas yang termuat | `/tema/angkasa.svg` termuat **true** | `/tema/pulau.svg` termuat **true** |
| Kecerahan latar sesudah dirender | rata **63** · piksel terang 10,2% (gelap, sesuai tema malam) | rata **176** · piksel terang 34,1% (terang, jalur pekat & tenda terbaca) |
| "Berisi detail, bukan bidang polos" | **1158 warna berbeda** · petak polos **0/40** | **1432 warna berbeda** · petak polos **0/40** |
| Pos berdiri di benda, bukan ruang kosong | selisih terkecil **79** vs ruang kosong 7/12/34 | selisih terkecil **50** vs langit 127/200/241 |
| Jalur peta | versi terang berlaku di langit malam | tetap versi pekat (aturan gelap tidak bocor) |

Pemeriksaan bentuk atas berkas akhir (dijalankan di repo ini, bukan di luar):

| Periksa | `pulau.svg` | `angkasa.svg` |
| --- | --- | --- |
| Bentuk (path/circle/ellipse/rect/polygon) | **196** | **164** |
| Warna hex unik | **83** | **78** |
| `transform=` · `<image>` · `<text>` · `<filter>` | **0 · 0 · 0 · 0** | **0 · 0 · 0 · 0** |
| Ukuran · rasio | 21,2 KB · 1600×900 (16:9) | 17,0 KB · 1600×900 (16:9) |
| Ruas nyaris tegak > 36 px pada bentuk selebar ≥ 800 px | **tidak ada** (diperiksa ulang dengan skrip diagnostik) | **tidak ada** |

### A.73.5 Batasan jujur

- **Saya tidak bisa melihat gambarnya.** Tidak ada mata manusia di putaran ini: yang memutuskan bentuk adalah
  geometri (kotak batas, kemiringan, kecerahan, warna) dan angka harness peramban (jumlah warna, petak polos,
  kecerahan, jarak pos ke benda). Karena itu **penilaian "lebih bagus" tetap milik pemilik produk** — yang
  saya buktikan adalah: bukan bidang polos, cerah/gelapnya sesuai tema, dan tiap pos benar-benar berdiri di
  benda yang digambar.
- **Ikon CC0 tetap siluet satu warna** (sifat aslinya). Benda itu saya timpa warna tema, tetapi tetap terbaca
  sebagai bentuk rata — bukan ilustrasi bercahaya. Sisanya digambar di repo.
- **Tidak ada versi lama yang disimpan** berdampingan (sesuai pilihan "langsung ganti"): pembanding hanya bisa
  diambil dari riwayat git.
- **Rasio 16:9 dipertahankan**, jadi komposisi yang lebih "lebar"-nya (mis. siluet panorama) sengaja tidak
  dipakai walau mungkin lebih dramatis.

### A.73.6 Berkas

- **Ditulis ulang total:** `frontend/public/tema/pulau.svg`, `frontend/public/tema/angkasa.svg`.
- **Diubah:** `frontend/public/tema/LISENSI.md` (tabel sumber CC0 baru + angka bentuk terbaru + catatan yang
  sudah usang diperbarui), `docs/laporan-pengujian.md` (entri ini), `docs/handoff-sesi.md`.
- **Tidak disentuh:** `gunung.svg` dan penggambarnya (`AdeganGunung.jsx`) — di luar permintaan, dan
  `RUTE_TEMA`/`perjalanan.js` juga tidak diubah (rute pos tetap, yang digambar ulang adalah bendanya).
