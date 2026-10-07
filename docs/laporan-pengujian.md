# Laporan Pengujian

Diperbarui: 5 Oktober 2026 (sesi prompt 2 — revisi dokumen acuan).

> **Catatan revisi dokumentasi (7 Oktober 2026):** tata letak dokumen dirapikan atas permintaan
> pengguna. Ringkasan prompt kini ada di `docs/word/AGENT.md` + `AGENT.docx` (bukan lagi dump prompt
> verbatim), `docs/word/` memuat seluruh dokumen `.docx` yang dikumpulkan, arsip `docs/word-arsip/`
> beserta berkas log bertanggal di `docs/log-mentah/` dihapus, dan log mentah sesi diganti oleh
> `docs/log-mentah/sesi-2026-10-05-chat-messages.json.gz` (byte-exact) + transkrip bacanya.
> Penyebutan nama berkas lama di bawah ini adalah catatan apa adanya dari sesi saat itu.

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
- **Mode tim belum diuji di browser sungguhan** dan **belum ada batas jumlah anggota per tim** selain minimal 2;
  yang diuji baru perilaku server (attempt bersama, versi, skor dibagi, peringkat tim).
