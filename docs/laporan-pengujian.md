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
