# Laporan Pengujian

Diperbarui: 9 Oktober 2026 (sesi pematangan + pengujian ulang menyeluruh — lihat A.19).
Bagian A.1–A.18 adalah catatan apa adanya dari sesi-sesinya masing-masing; status terkini ada di A.19.

> **Catatan revisi dokumentasi (7 Oktober 2026):** tata letak dokumen dirapikan atas permintaan
> pengguna. Ringkasan prompt kini ada di `docs/word/AGENT.md` + `AGENT.docx` (bukan lagi dump prompt
> verbatim), `docs/word/` memuat seluruh dokumen `.docx` yang dikumpulkan, arsip `docs/word-arsip/`
> beserta berkas log bertanggal di `docs/log-mentah/` dihapus, dan log mentah sesi diganti oleh
> `docs/log-mentah/sesi-2026-10-05-chat-messages.json.gz` (byte-exact) + transkrip bacanya.
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
  belum ditulis. Kategori `tamper_suspected` sudah ada di enum beserta skor risikonya, tetapi **belum ada yang
  mengirimnya** — jadi jangan dianggap aktif.
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
- **Bukti visual**: `docs/log-mentah/editor-materi-terang.png` (74,8% kertas krem,
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
dan log pekerjaan audit itu disimpan apa adanya di `docs/log-mentah/prompt-claude-eksternal.md`
dan `docs/log-mentah/log-claude-eksternal.md` supaya asal setiap temuan bisa ditelusuri.

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
- **Log mentah**: `sesi-2026-10-05-chat-messages.json.gz` disegarkan dari sesi asli (207 pesan,
  salinan byte-exact) dan transkripnya kini **utuh tanpa potong** — sebelumnya setiap argumen
  panggilan alat dipotong di 400 karakter. Transkrip juga dibaca dari berkas `.gz` yang ikut
  dikumpulkan, sehingga angka byte + md5 di kepalanya benar-benar sepadan dengan salinan mentahnya
  (sebelumnya dihitung dari berkas sesi yang masih hidup dan bisa berbeda).
- **Ringkasan di Word**: `docs/word/` diekspor ulang (`AGENT.docx`, `jurnal-prompt.docx`,
  `log-mentah.docx`, `penjelasan-fitur.docx`, `catatan-demo.docx`, `laporan-pengujian.docx`).

### A.18.7 Rujukan log mentah
`docs/log-mentah/sesi-2026-10-05-transkrip.md` (dan salinan byte-exact
`sesi-2026-10-05-chat-messages.json.gz`): `2026-10-08 ±15.30–19.45 WIB` (audit satu per ID sampai
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
  (pukul ±15.08 WIB): `sesi-2026-10-05-chat-messages.json.gz` (≈24,2 MB, salinan byte-exact) dan
  `sesi-2026-10-05-transkrip.md` (≈10,7 MB, transkrip utuh tanpa potong). Kedua berkas disegarkan
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
- Hasil: `php artisan test --filter=Slice07` → **16 passed (163 assertions)**; `./verify.sh` **SEMUA HIJAU**.
- Belum: pengirim sisi klien untuk dua kategori baru, denyut ber-nonce, `SapuPresence`, dan pemeriksaan
  integritas fungsi proteksi (bagian 2B–2D).
