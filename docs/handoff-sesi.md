# Handoff sesi (ringkas)

Catatan ini untuk melanjutkan pekerjaan **setelah context di-compact**. Isinya sengaja
padat: status terakhir, apa yang sudah/belum, dan cara mengulang verifikasi.

## 0. MULAI DI SINI (sesi baru — tanpa riwayat)

Bagian ini **berdiri sendiri**: cukup baca sampai selesai untuk melanjutkan. Berkas ini dibuat agar sesi
baru **tidak memuat riwayat chat lama** (riwayat sesi sebelumnya 333 MB dan membuat memori proses agen
membengkak ke 3,3 GB). Rincian tiap putaran ada di bagian 1–5 dan `docs/laporan-pengujian.md`.

### 0.1 Proyek ini apa (30 detik)

`lomba_m` = aplikasi ulangan & materi sekolah: **Laravel 11** (`backend/`) + **React 19 / Vite**
(`frontend/`) + **Node SSE** (`realtime/`), semuanya di satu repo. "Materi berjalan" menampilkan tiap blok
materi sebagai satu **pos** di peta perjalanan bertema. Dua berkas kunci yang paling sering dicari orang baru:

- pemotongan bundel per halaman: `frontend/src/halaman.js` (`React.lazy` + peta pramuat) dengan `Suspense`
  di `shared/layout/KerangkaUmum.jsx` & `KerangkaAuth.jsx` — lihat bagian 0.1a di bawah.
- peta rute: `frontend/src/routes.js`; kerangka + router: `frontend/src/App.jsx`.

Tiga tempat yang mengatur tema:

- katalog tema: `backend/app/Sections/Material/Registry/TemaPerjalanan.php`
- rute pos per tema: `frontend/src/sections/material/perjalanan.js` (`RUTE_TEMA`)
- latar gambar tiap tema: `frontend/public/tema/*.svg` (kini `gunung.svg`, `pulau.svg`, `angkasa.svg`)

Tema **tidak** boleh menaruh pos di ruang kosong — dijaga `frontend/src/__tests__/theme/latarTema.test.js`
(tiap benda yang diinjak pos punya `id` di berkas SVG-nya).

### 0.1a Bundel frontend dipotong per halaman (A.69 — cara kerjanya)

`frontend/src/App.jsx` **tidak** mengimpor halaman secara statis lagi: yang statis hanya kerangka ulangan,
Beranda, halaman masuk, dan 404. Semua halaman lain lewat `frontend/src/halaman.js` (`React.lazy`), dan
`Suspense`-nya dipasang **di dalam** kerangka (bukan membungkus seluruh aplikasi) supaya menu/bilah atas/kaki
halaman tetap tampil selama modul diunduh. Tautan panel samping memanggil `pramuatHalaman(jalur)` saat
disorot/difokus.

Kalau menambah halaman baru: **(1)** tambahkan pemuatnya di `muat` (`frontend/src/halaman.js`), **(2)** ekspor
komponen malasnya di berkas yang sama, **(3)** impor dari `./halaman.js` di `App.jsx` (jangan lewat jalur
`sections/...`), **(4)** tambahkan jalur menu ke peta `pramuat` bila tautannya ada di sidebar. Tes
`__tests__/halaman.test.js` akan merah kalau urutan ini dilanggar (ia juga mengunci daftar impor statis
`App.jsx`, jadi satu baris `import` statis baru sudah cukup membuatnya gagal — itu memang disengaja).

### 0.1b Peta berkas (ke mana harus menoleh)

| Kalau menyentuh… | Buka |
| --- | --- |
| aturan proyek (wajib dibaca agen baru) | `AGENT.md` (akar repo) — stack final, prinsip keamanan, pagar mutu, larangan |
| rute & gerbang peran | `frontend/src/routes.js`, `frontend/src/App.jsx` |
| bundel per halaman | `frontend/src/halaman.js` + `Suspense` di `frontend/src/shared/layout/{KerangkaUmum,KerangkaAuth}.jsx` |
| backend | `backend/app/Sections/<Nama>/` (Controller · Service · Policy · Http/Requests · Http/Resources) + `backend/routes/api.php` |
| realtime (SSE) | `realtime/src/server.js`; kontraknya di `backend/app/Sections/Presence/` |
| uji | backend `backend/tests/` · frontend `frontend/src/__tests__/` (mengikuti struktur `src/`) · realtime `realtime/test/` |
| pagar mutu | `./verify.sh` (Pest · Redis wajib · Pint · checkJs · ESLint · Vitest · realtime) |
| menyalakan lokal | `./nyalakan-local.sh` (+ `status`/`stop`) |
| harness GUI | `docs/smoke-ui-*.mjs` dijalankan lewat `docs/jalankan-smoke-ui.sh <nama>`; audit tata letak `docs/audit-ui.mjs`; HTTP murni `docs/smoke-http-fitur.mjs` |
| dokumen untuk dikumpulkan | `docs/penjelasan-fitur.md` · `docs/laporan-pengujian.md` · `docs/catatan-demo.md` · `docs/jurnal-prompt.md` · `docs/log-mentah/` · `docs/word/*.docx` |
| rencana/permintaan pemilik produk yang belum dikerjakan | bagian 0.6 di bawah + `docs/rencana-desain-putaran3.md` |

### 0.2 Kondisi repo persis (verifikasi sendiri)

```bash
git status --short && git diff --stat
git rev-parse --short HEAD origin/main && git rev-list --count origin/main..HEAD
```

Keadaan saat handoff ini diperbarui (**13 Okt 2026, sesudah putaran A.73**):

- **`HEAD`** = commit terakhir (pakai `git log --oneline -1`). Sesi ini berisi **A.70** (patch kinerja + rekam
  diri), **A.71** (log mentah + perapian `docs/`), **A.72** (A.61–A.69 dikomit), dan **A.73** (latar tema
  Luar Angkasa & Harta Karun dirombak total) — `git log --oneline 6811c2c..HEAD` untuk daftarnya.
- **Push sesi ini SUDAH dilakukan:** 18 commit (A.65–A.72) terkirim ke `origin/main` → `fea68b8`, diperiksa
  terhadap server lewat `git ls-remote origin refs/heads/main` (cocok dengan `git rev-parse HEAD` saat itu).
  Yang **belum** di-push sekarang hanyalah commit A.73 ke atasnya (`git rev-list --count origin/main..HEAD`
  — angka pastinya ambil dari perintah itu, jangan ditulis tetap di sini).
- **Working tree BERSIH sejak A.72** (`git status --short` kosong). Seluruh pekerjaan A.61–A.69 sudah dikomit
  dalam enam commit bertema: slug kuis (backend), slug di seluruh layar + pil saring, bank soal bertahap,
  halaman akun + setelan per kuis, bundel per halaman, dan penjelasan fitur. Daftar lengkap ada di
  `laporan-pengujian.md` **A.72**.
  - **Catatan urutan commit:** `App.jsx` memuat dua putaran sekaligus (rute akun dari A.68 dan impor malas dari
    A.69), jadi commit "halaman akun" belum bisa dijalankan sendiri (ia menghapus `HalamanPengaturan.jsx`
    sementara `App.jsx` masih mengimpornya) — commit berikutnya yang menutupinya. Pohon terakhir yang sudah
    diverifikasi hijau adalah yang sekarang: `./verify.sh` **SEMUA HIJAU**.
- **Jangan ikut dikomit:** arsip/zip, `.agents/`, `.claude/`, `.DS_Store`. `frontend/dist/` memang sudah
  diabaikan (`.gitignore`), jadi hasil `npm run build` aman untuk pengukuran.
- **`docs/word/*.docx` belum disegarkan** untuk A.68–A.71 (termasuk `log-mentah.docx` yang sumbernya kini
  gabungan transkrip semua sesi) — lihat papan pending 0.6 butir 3.

### 0.3 Nyalakan layanan & gerbang mutu

```bash
cd "folder tanpa judul 2/lomba_m"
./nyalakan-local.sh            # redis+backend+realtime+frontend, TANPA hapus data
./verify.sh                    # gerbang wajib (tanpa layanan): Pest+Pint+checkJs+ESLint+Vitest+realtime
docs/jalankan-smoke-ui.sh kuis-materi     # 48/48 (runner menyalakan & mematikan layanan sendiri)
```

Penting untuk sesi agen: **jangan** `nohup … &` di dalam perintah SYNC (anaknya ikut mati saat shell selesai),
dan `setsid` **tidak ada di macOS**. Kalau layanan memang harus hidup di antara dua perintah, luncurkan
skripnya lewat sesi baru Python — `python3 -c "import subprocess;
subprocess.Popen(['./nyalakan-local.sh'], start_new_session=True)"` (terbukti bertahan di putaran A.60)
— atau, lebih sederhana lagi, pakai runner `docs/jalankan-*.sh` yang menyalakan dan mematikan sendiri, atau
jalankan nyala+harnes **di dalam satu perintah**.
Akun demo: `admin@sekolah.test` (guru) & `smoke.murid@sekolah.test` (murid), sandi `Passw0rd!Aman`.

### 0.4 Sudah terverifikasi (jangan diulang tanpa perubahan kode)

**A.74** (13 Okt 2026, gulir bersarang tidak bocor) — `theme.css` menambahkan `overscroll-behavior: contain` untuk
  `.laci-nav`, `.dialog-samping`, `.nle-pemilih-daftar`, `.nle-kuis`, `.nle-canvas-isi`, dan
  `overscroll-behavior-x: contain` untuk `.tabel-isian-bungkus`; `.papan-nav` sengaja tidak dikunci. Bukti roda
  sungguhan di peramban: daftar pemilih kuis bergulir **0 → 240 px** sementara halaman **1653 → 1653** (diam),
  dan saat daftar sudah mentok (8278 px) halaman tetap **1653**. `docs/jalankan-smoke-ui.sh editor` **44/44** ·
  `mobile` **17/17** · `./verify.sh` **SEMUA HIJAU**. Rincian + satu temuan sampingan (pagar warna CSS di
  `tema.test.js` ternyata tidak pernah membaca `theme.css`): A.74.

**A.73** (13 Okt 2026, latar tema dirombak total + aset CC0) — `pulau.svg` dan `angkasa.svg` **diganti seluruhnya**
  (bukan disetel): 196 bentuk/83 warna dan 164 bentuk/78 warna, rasio tetap 16:9, rute pos tidak digeser, id
  pendaratan tetap lengkap. Lima ikon CC0 Wikimedia Commons (roket, bintang, Mars, peti harta karun, karang)
  disisipkan dengan koordinat yang didatar-kan — berkas akhir **nol `transform`**. `npx vitest run
  src/__tests__/theme` **23/23 lulus**; harness peramban `docs/jalankan-smoke-perjalanan.sh` **69/69 lulus**,
  termasuk "gambar berisi detail, bukan bidang polos" (angkasa **1158 warna** · pulau **1432 warna** · petak
  polos **0/40**), kecerahan sesudah dirender (angkasa rata **63** · pulau rata **176**), dan tiap pos berdiri di
  benda (selisih 79 dan 50). Rincian: A.73.

**A.72** (13 Okt 2026, pekerjaan yang menumpuk dikomit) — working tree **BERSIH** sesudah enam commit bertema
  (slug backend `1a2db5f` · slug di layar + pil saring `9192eaf` · bank soal bertahap `7e2001c` · halaman akun +
  setelan per kuis `7fc4f57` · bundel per halaman `d60cc1e` · penjelasan fitur `95a1a88`), lalu `./verify.sh`
  **SEMUA HIJAU** (Pest 357/3356 · Redis wajib 9/65 · Pint · checkJs · ESLint 0 error · Vitest 81/763 ·
  realtime). Yang tersisa dari butir 1 papan pending hanyalah **push**. Rincian + catatan keterikatan urutan
  commit: A.72.

**A.71** (13 Okt 2026, log mentah dari sesi asli 412 MB + perapian `docs/`) — **sudah dikomit, belum di-push**:
  tiga sesi diekspor dalam bentuk satu folder per sesi (`.gz` byte-exact 68,6 MB + `transkrip.md` utuh 26,8 MB +
  `info.json`), indeks di `docs/log-mentah/README.md`, `docs/README.md` baru; byte-exactness diperiksa lewat
  `gzip -dc … | md5` untuk ketiga sesi. Rincian: A.71.

**A.70** (13 Okt 2026, patch kinerja + rekam diri dari luar repo) — **sudah dikomit (`b1025b4`, `90512a2`), belum di-push**: `./verify.sh` **SEMUA HIJAU** — Pest **357 lulus** (3356 asersi) · Redis wajib 9 · Pint bersih · checkJs exit 0 · ESLint 0 error · Vitest **81 berkas / 763 tes** · realtime. Kueri `payloadSoal`+`versiSoal` **2 → 1** (diukur, attempt 10 soal); soal kuis di jalur mulai 4 kueri → 1; impor CSV tak lagi `SELECT` per baris / `argon2id` per baris; `snapshot_soal` tak lagi ditarik monitor & ekspor; job saran AI `afterCommit`; `retry_after` queue database 90 → 180 dtk. Bug rekam diri lampiran (durasi basi 0 detik + perekam tak dimatikan saat keluar soal) diperbaiki; tes baru `unggahLampiranRekam` **3/3 lulus** dengan kontrol negatif **3/3 MERAH** atas kode lama. Rincian: A.70.

**A.69** (13 Okt 2026, bundel dipotong per halaman) — **belum dikomit**:
  `npm run build` → bundel awal **555,26 kB / 176,35 kB gzip** (dari **923,63 kB / 262,06 kB gzip** satu berkas),
  54 berkas JS; diukur juga **di peramban** (`node docs/ukur-bundel-peramban.mjs`, harness baru): membuka app
  **6 berkas / 555,30 kB**, tekan “Daftar” **2 berkas kecil** tanpa muat ulang. `npm run check` exit 0 · ESLint
  0 error (2 peringatan lama) · Vitest **80 berkas / 760 tes**; smoke `pengaturan` **12/12** · `susun` **44/44** ·
  `slice04` **18/18** · `nav` **14/14** · `kuis-materi` **48/48** · `slice07` **21/21**, semuanya exit 0.
  Backend tidak disentuh → Pest/Pint/Redis **belum** dijalankan ulang untuk putaran ini. Rincian: A.69.

**A.68** (13 Okt 2026, bank soal bertahap + `/pengaturan` jadi halaman akun) — belum dikomit: `./verify.sh`
  **SEMUA HIJAU** — Pest **357 lulus** (3356 asersi) · Redis wajib 9 · Pint bersih (361 berkas) · checkJs exit 0 ·
  ESLint 0 error · Vitest **79 berkas / 752 tes** · realtime 20; smoke `pengaturan` **12/12** (harness ditulis
  ulang) · `slice03` **9/9** · `susun` **44/44** · `kuis-manual` **15/15**. Rincian: A.68.

**A.66 + A.67** (13 Okt 2026, sudah dikomit): sapuan GUI **30 harness / 777 pemeriksaan lulus** + audit
  **44 halaman bersih di terang & gelap**; lalu audit pemeriksaan mati (`slice07` 21/21 · `kuis-materi` 48/48 ·
  `audit-ui kuis` bersih, dengan kontrol negatif A/B di A.67.3). Jangan diulang tanpa perubahan kode.

Putaran **A.55–A.64** (masing-masing sudah `./verify.sh` SEMUA HIJAU + smoke terkait): **A.55** panel kuis
keluar bingkai video · **A.56** editor materi berhenti melebar di ponsel (commit `5c36b49` — **tidak punya
entri laporan tersendiri**, buktinya harness `docs/smoke-ui-editor.mjs`) · **A.57 belum dikerjakan** (tema
“Harta Karun di Pulau” POV dari atas — masih di papan pending) · **A.58** tombol ukuran tulisan dibuang ·
**A.59** ringkasan setelan sesi + tautan siswa · **A.60** beranda berikon + Monitor Ulangan + pengaturan per
ulangan + impor ber-alias · **A.61** soal boleh diperbaiki di tengah ulangan · **A.62** kartu pertanyaan
(pilihan PG dipindah ke bawah pertanyaan) · **A.63** layar+tim+impor-murid di peramban · **A.64** mapel+
avatar+auth (tiga celah cakupan GUI). Angka lengkapnya di `docs/laporan-pengujian.md` A.55–A.64; bagian 1 di
bawah hanya tabel hasil terakhir.

Catatan angka Vitest (naik terus, jadi jangan bingung bila menemukan angka lama di riwayat): 717 (A.55) →
727 (A.61) → 752 (A.68) → **760 (A.69, 80 berkas)**.

### 0.5 HASIL AUDIT TAMPILAN — 12 Okt 2026 (historis; temuan B sudah ditutup di A.56)

Saya jalankan `docs/audit-ui.mjs` (guru+murid × hp 390 px + laptop 1366 px) **plus satu probe terarah**
untuk halaman yang tidak ada di daftar audit itu (materi guru, editor materi, avatar, progres tema).

**A. Halaman umum — bersih.** Kelas, Mapel, Murid, Impor, Bank soal, Tag, Kuis, Pengaturan, Detail/Laporan/
Koreksi/Monitor/Peringkat, Ulangan saya, Progres tema, Lencana, Kerjakan kuis, Beranda, Masuk, Daftar,
Lupa sandi, 404, Avatar: **tidak ada gulir mendatar, tidak ada elemen menembus tepi** di kedua viewport.
Sisa laporan alat = noise/tebakan, bukan bug: (1) KONTRAS 2.77 pada `span.sr-saja` (teks hanya-pembaca-layar,
terlihat oleh alat padahal sengaja disembunyikan); (2) satu tautan `a(236×19)` di **Koreksi kuis**
(tinggi 19 px < 44 px) — kandidat nyata, layak dicek; (3) satu `422` di konsol saat membuka Kerjakan kuis.

**B. Editor materi (`/materi/:id/editor`) — INI YANG PATAH.**

- Di **hp 390 px: OVERFLOW +151 px** → seluruh halaman bergeser mendatar. Yang menembus tepi:
  baris tombol `.nle-tool` (324×40 px, tidak menyusut), `.nle-segmen` (+42/+125),
  `.nle-tool-kecil.nle-tool-kuis` (+151), **dan panel inspector kanan** — `input#nle-fase`,
  `textarea`, `h2.h6`, `.progress.jelajah-bilah` semuanya **+138 px**.
- Di laptop 1366 px: tidak ada overflow, tetapi banyak kontrol editor **< 44 px** (`.nle-segmen` 28 px,
  `.nle-tool-kecil` 25×28, `.nle-plus` 38×38) — wajar untuk alat gaya editor, tetapi melanggar aturan
  "sasaran ketuk ≥ 44 px" bila editor dipakai di sentuh.
- **Bukan regresi A.55**: `git diff` A.55 hanya menyentuh `.pm-*` (pemutar materi) + bilah atas, **bukan**
  `.nle`. Penyebab sebenarnya: editor materi **belum pernah masuk daftar audit** — `smoke-ui-mobile.mjs`
  hanya menyapu 8 halaman non-editor, dan `audit-ui.mjs` tidak memuat `/materi/:id/editor`.
- Peta perjalanan (editor & murid): panggung rasio **1.78** benar, pos mendarat di latar — tidak ada temuan.

**C. Ketiga sisa itu sudah ditutup di A.60 (12 Okt 2026) — audit kini bersih.** `docs/audit-ui.mjs`
dijalankan ulang: **34 halaman (guru+murid × hp/laptop) BERSIH**, ringkasan cacat `{}` (sebelumnya
`{kontras: 606, targetKecil: 2, galatKonsol: 2}`). Dua di antaranya ternyata **cacat alat, bukan cacat layar**
(kontras pada `span.sr-saja` yang dipotong 1×1 px, dan `422` dari `/mulai` yang memang disengaja server) —
keduanya kini dilewati/disaring harness dengan alasan tertulis; satu benar-benar cacat layar dan diperbaiki:
tautan jejak 19 px di Koreksi kuis naik ke **44 px** tanpa menggeser tata letak (dibuktikan A/B: `h1Atas`
152 → tetap 152 dengan aturan dimatikan). Rincian: entri **A.60.5** di `laporan-pengujian.md`.

Angka di atas dari Chrome headless/CDP (bukan perangkat fisik). Untuk menjalankan ulang audit:
`node docs/audit-ui.mjs [filter] [--gelap]` dengan backend+vite+Chrome :9333 hidup.

**Status 13 Okt 2026:** temuan B (editor materi melebar di ponsel) **sudah diperbaiki di A.56** (commit
`5c36b49`, diuji harness `docs/smoke-ui-editor.mjs`), dan tiga sisa temuan A.60 **sudah ditutup**. Yang masih
terbuka dari audit itu hanya satu: **target sentuh < 44 px di kontrol editor** (`.nle-segmen` 28 px,
`.nle-tool-kecil` 25×28, `.nle-plus` 38×38) bila editor dipakai di layar sentuh — belum ada keputusan produk
apakah itu perlu diubah (editor memang alat desktop).

### 0.6 PAPAN PENDING (kerjakan berurutan)

**0. Deadline lomba: 15 Okt 2026 15.30 WIB** (pengumuman 25 Okt). Yang **wajib** menurut `AGENT.md` dan masih
kurang: **deploy publik dengan link yang bisa dibuka**, **Octane Swoole** (atau catatan jujur bila gagal),
**jurnal prompt maksimal 5 entri + log mentah utuh**, dan repo **public sejak commit pertama**. Empat hal itu
mengalahkan semua pekerjaan rapi-rapi di bawah.

1. ~~**Commit + push pekerjaan yang menumpuk**~~ — **commit SELESAI di A.72** (enam commit bertema, working tree
   bersih). **Yang masih kurang: `git push`** (`origin/main` tertinggal 16 commit: A.65–A.67 + A.70–A.72).
2. **Deploy** (belum ada sama sekali). Rencana yang paling murah: frontend `npm run build` → hosting statis,
   backend Laravel + MySQL + Redis → satu VPS/container, realtime Node → proses kecil terpisah; URL backend
   disuntik lewat env `VITE_*`/`APP_URL`, cookie Sanctum `SameSite=Lax` + HTTPS, dan `frontend/vite.config.js`
   proxy tidak dipakai di produksi (perlu base URL API eksplisit). Sesudah hidup: catat linknya di
   `docs/catatan-demo.md` + `README.md`, lalu jalankan ulang `docs/jalankan-smoke-ui.sh pengaturan` terhadap
   deploy bila memungkinkan.
3. **Segarkan dokumen untuk dikumpulkan**: `./docs/export-word.sh` (menyegarkan `docs/word/*.docx` +
   log mentah) atau `python3 docs/export_docx.py docs/<berkas>.md docs/word/<berkas>.docx` bila snapshot sesi
   tidak mau disentuh. Per 13 Okt 2026 `docs/word/*.docx` **belum** memuat A.68/A.69.
4. **Jurnal prompt**: cek `docs/jurnal-prompt.md` masih ≤ 5 entri dan log mentah di `docs/log-mentah/` utuh
   (`.gz` byte-exact, tidak disunting).
5. Pekerjaan rapi-rapi yang sudah terdaftar (boleh ditunda kalau waktu mepet):
   (a) **selaraskan pratinjau kanvas editor guru** dengan posisi panel kuis A.55 (panel di bawah/samping
   bingkai, bukan menimpa gambar);
   (b) **A.57 — rombak tema “Harta Karun di Pulau” jadi POV dari ATAS** (*"pantai dari POV di atas, murid
   seperti berlayar"* — permintaan pemilik produk 12 Okt 2026): ganti `frontend/public/tema/pulau.svg`
   dengan latar laut mata burung, pos berdiri di atas benda, penanda pos bergerak seperti berlayar; rute tetap
   `RUTE_TEMA.pulau` dan berkas baru **wajib lolos** `__tests__/theme/latarTema.test.js` (jalankan
   merah-dulu sebagai kontrol). **Tanyakan dulu** apakah tema `angkasa` ikut dirombak — jangan sentuh tanpa
   konfirmasi;
   (c) jadikan asersi "kartu Perlu perhatian tanpa garis sisi berwarna" permanen di `docs/smoke-ui-mobile.mjs`;
   (d) audit tata letak 360/768/1024/1440 px; (e) target sentuh < 44 px di kontrol editor materi;
   (f) perluas pencarian ke Kelas/Mapel/Bank Soal; (g) ambang denyut proteksi (A.54) bisa diatur guru +
   uji denyut di peramban sungguhan; (h) mode `hasil` pada Layar kelas dan moderasi avatar pada antrean
   panjang (dua jalur yang masih gelap di GUI).

### 0.7 Kebiasaan hemat memory (WAJIB dipertahankan)

Keluaran alat selalu kecil — pakai `tail`/`grep`/`wc`; tulis hasil panjang ke `/tmp` lalu baca ringkasannya;
jangan mencetak berkas besar utuh; nyalakan layanan/Chrome hanya di dalam **satu skrip sekali pakai yang
mematikan dirinya sendiri**. Layanan yang berdiri sendiri saat idle ikut memakan RAM mesin.

### 0.8 Prompt kickoff siap salin (untuk chat baru)

```
Lanjutkan proyek lomba_m di "folder tanpa judul 2/lomba_m".
Baca docs/handoff-sesi.md bagian "## 0. MULAI DI SINI" saja — jangan memuat riwayat lain.
Status: putaran A.68 (bank soal bertahap + /pengaturan jadi halaman akun) dan A.69 (bundel dipotong per halaman)
SUDAH SELESAI dan terverifikasi, tetapi BELUM DIKOMIT. A.70 (patch kinerja + perbaikan rekam diri lampiran)
SUDAH dikomit (`b1025b4`, `90512a2`) tetapi belum di-push; total 5 commit lokal belum di-push.
Kerjakan PAPAN PENDING bagian 0.6 secara berurutan:
1) commit kecil-kecil + push pekerjaan yang menumpuk (A.61-A.69),
2) deploy publik dengan link yang bisa dibuka (deadline 15 Okt 2026 15.30 WIB),
3) segarkan docs/word + jurnal prompt + log mentah sebelum dikumpulkan.
Patuhi kebiasaan hemat memory di bagian 0.7; jalankan ./verify.sh + harness smoke terkait sebagai bukti
(jangan mengulang pemeriksaan yang sudah hijau tanpa perubahan kode — daftarnya di bagian 0.4).
```

### 0.9 Jangan salin riwayat lama

Log mentah sesi sebelumnya tersimpan di luar repo
(`~/.config/manicode/projects/Desktop/chats/2026-10-05T07-39-24.876Z/`); bukti yang dikumpulkan ada di
`docs/log-mentah/` (satu folder per sesi: `chat-messages.json.gz` byte-exact + `transkrip.md` utuh +
`info.json`; indeks di `docs/log-mentah/README.md`).

Terakhir diperbarui: 2026-10-12 (putaran A.30 — 22 tipe soal + 2A kategori kecurangan,
A.31 — editor materi gaya video editor + kuis sisipan di dalam klip, A.32 — penunjuk langkah
koreksi manual, A.33 — sistem luring: simpan jawaban saat internet putus + riwayat jawaban lokal
+ validasi jam monotonik, A.34 — materi berjalan: template tema + peta beranimasi + kenaikan
pos/tingkat, A.35 — editor soal: pemilih jenis ringkas berikon di paling bawah, dan
**A.36 — editor materi: gagang pangkas `|` di kedua sisi klip**, termasuk putaran lanjutan A.36.7 yang
membuktikan tanda itu juga berlaku untuk klip **kuis** dan **media**, **A.39 — sapuan dasar:** 22 tipe soal
lewat HTTP, token reset sandi kedaluwarsa & throttle, sebaran materi, plus 3 temuan nyata yang sudah diperbaiki,
**A.40 — siswa tamu:** guru membuka kuis untuk anak tanpa akun lewat pengaturan `izinkan_tamu` dan tamu cukup
mengetik nama, plus commit & push pekerjaan yang menumpuk (A.33–A.39), **A.42 — audit UI/UX & logika putaran 2:
tamu beridentitas kode perangkat (bukan nama), limiter tamu per pengunjung, dan proteksi ulangan yang adil di
ponsel.** · **A.43 — ilustrasi gunung digambar sendiri (foto pihak lain dibuang dari repo), editor soal
dirapatkan + tulis soal berurutan tanpa keluar dari editor, dan uji GUI bisa dijalankan langsung di atas local
yang sedang hidup.** · **A.44 — uji perangkat mobile sungguhan lewat emulasi perangkat Chrome
(`docs/smoke-ui-mobile.mjs`, 16/16), yang menemukan & memperbaiki tombol tema menyusut ke 37 px (di bawah
target sentuh 44 px).** · **A.45 — latar peta tema gunung: dulu digambar tangan, kini berkas gambar jadi
domain publik bergaya grafik (`frontend/public/tema/gunung.svg`, Public Domain, 16:9, 11 KB) + panggung tidak
lagi digelapkan; ada alat ukur kecerahan `docs/tangkap-adegan-gunung.mjs`.** · **A.46 — pos peta jadi
**kemah** (tenda, bukan bulatan berikon), jalur jadi **zigzag mendaki** (basecamp kiri bawah → puncak tengah
atas, belokan mengecil ke atas), dan gambar latarnya **diganti**: karya proyek sendiri (CC0) dengan **satu**
puncak saja, puncak **tumpul**, tanpa sisi tegak, dan lebih detail (60 bentuk/18 warna vs 47/16 lama). Puncaknya
berdiri di 31% dari atas sehingga pos terakhir jalur (12%) tetap di langit; batu tetap ada; tidak ada goresan
panjang yang ujungnya lepas (rusuk lereng yang menggantung dihapus). Dikunci pagar mutu bentuk
`frontend/src/__tests__/theme/gunungLatar.test.js` (9 tes) yang sudah dibuktikan menangkap berkas lama (6/9
merah).** · **A.47 — tanda pangkas `|` jadi **satu** goresan dan lebih ke dalam:** cincin `border` 1px +
`box-sizing: border-box` menyisakan goresan **1px**, dan tanda itu duduk menempel di tepi klip sehingga
berdempetan dengan garis tepi 3px klip sebelahnya — terbaca `||`. Kini goresan utuh 3px dengan garis luar
(`outline`, tidak menyusutkan lebar), digeser **7,2px** ke dalam di kedua sisi (kotak seretnya tetap di
tepi), dipendekkan jadi pegangan 25,6px, dan klip terpilih memakai garis tepi seragam 1px supaya tidak ada
garis tipe 3px di sebelah tanda. Dikunci 4 pemeriksaan bentuk baru di `docs/smoke-ui-durasi-klip.mjs`
(15 → **19**) yang membaca gaya terhitung `::before` + kolom piksel potret layar; uji balik CSS lama
**3 dari 4 merah**.) · **A.48 — gunung "Pendakian bertingkat":** permintaan *"3 puncak namun yang di
sebelah-sebelahnya itu menjadi jalur pendakian"*; bentuknya digambar ulang (66 bentuk/24 warna; satu punggung
utama + dua puncak jalur yang lebih rendah dan di tepi) dan dikunci `theme/gunungLatar.test.js` (9 tes).
· **A.49 — ukuran tulisan Normal/Besar lewat satu variabel `--s`:** tombol di header, pilihan diingat per
perangkat dan dipasang sebelum render pertama, judul Bootstrap ikut membesar 12%; dibuktikan
`docs/smoke-ui-ukuran.mjs` (11/11) plus `theme/ukuran.test.jsx`. **DIBATALKAN di A.58** (tombol, atribut
`data-ukuran`, kunci `ukuran-ulangan`, ikon `IkonHuruf`, dan harness-nya dibuang atas permintaan pemilik
produk) — `--s: 1` tetap ada sebagai token skala tunggal. · **A.50 — "pos di udara" ditutup + dua
tema perjalanan baru:** jalur peta jadi **rute per tema** (`RUTE_TEMA`), pos terakhir tema gunung kembali
berdiri di **puncak** (y=42%, punggungan 39%), katalog jadi **empat** pilihan (Harta Karun di Pulau, Luar
Angkasa), latar baru `pulau.svg`/`angkasa.svg` **karya proyek ini (CC0, 201/200 bentuk)** dengan `id` pada
tiap benda yang diinjak pos, dan aturan jalur terang untuk latar malam; smoke perjalanan **69/69**. ·
**A.51 — pencarian murid yang menyaring di server:** satu kotak untuk nama/NIS/NISN/email (`filter[cari]`,
`%` di-escape, jeda 300 ms, kembali ke halaman 1) sehingga yang dicari **seluruh daftar**, bukan 50 baris
yang kebetulan tampil; smoke `murid` **18/18**. · **A.52 — temuan sampingan dari mengulang `smoke-http-fitur`:**
satu pemeriksaan lama masih mengharapkan `tamper_suspected` boleh dikirim klien, padahal kategori itu sudah jadi
**turunan server** (klien kini memakai `dom_injection`/`extension_detected`); pemeriksaannya diperbaiki di
harness lalu dijalankan ulang **243/243**. · **A.53 — deteksi tamper sisi klien (2B–2C), penyorotan kata
kunci pencarian, dan regresi 1.200 murid:** modul `deteksiTamper.js` memeriksa sumber extension, fungsi
proteksi yang diganti, overlay asing (dihapus), dan kanari yang hilang, lalu mengirim `dom_injection`/
`extension_detected` — saklar `detect_tamper` **default MATI** dan **tidak ikut preset `exam_mode`**;
pencarian murid kini **menyorot** bagian nama/NIS/email yang cocok; dan pencarian diuji pada **1.200 murid**.
· **A.54 — sisi server deteksi tamper (2D):** denyut proteksi ber-nonce (`POST /attempt/{id}/denyut`, nonce
dirotasi tiap kiriman, nonce lama → 409) + sapuan yang menurunkan `tamper_suspected` sekali saja saat denyut
berhenti padahal attempt masih berjalan; sekaligus memperbaiki dua pemeriksaan harness HTTP yang rapuh
terhadap jumlah murid (kini pakai `filter[cari]`/`filter[class_id]`). · **A.55 — panel kuis di halaman materi
pindah ke LUAR bingkai video:** harness GUI baru `docs/smoke-ui-kuis-materi.mjs` mengukur halaman materi
sebagai murid di 390 px & 1366 px dan menangkap dua cacat nyata — panel kuis sisipan dulu menumpuk di atas
gambar dengan `max-height: 80%` bingkai sehingga di ponsel hanya jadi jendela **274×123 px** untuk isi 565 px
(1 soal terpotong, tombol kumpulkan 425 px di bawah), dan bilah atas menembus tepi kanan **+55 px** karena
merek tidak boleh menyusut (seluruh halaman bergeser mendatar). Kini panel duduk di panggung `.pm-panggung`
di bawah video (atau di sampingnya saat tata "horizontal" di viewport ≥1200 px), dan bilah atas memakai
`min-width: 0` + elipsis. Semua Chrome headless smoke juga dibisukan (`--mute-audio`) dan harnessnya menyetel
`video.muted = true` sebelum `play()` supaya klip uji berisi audio drum tidak berbunyi dari speaker — dijaga
6 pemeriksaan baru yang menuntut daftar media-bersuara kosong di setiap titik pengukuran (harness naik ke **48/48**). Rincian A.48–A.55 di `laporan-pengujian.md`.
Terakhir diperbarui lagi 12 Okt 2026 dengan **hasil audit tampilan** (bagian 0.5, kini bersih setelah A.60) dan
**papan pending** (bagian 0.6): editor materi melebar +151 px di ponsel (selesai, `5c36b49`) dan permintaan
merombak tema "Harta Karun di Pulau" jadi sudut pandang dari atas (murid seperti berlayar).

Diperbarui sekali lagi di putaran **A.60**: aksi jadwal beranda jadi tombol ikon 44 px ber-label objek,
"Live Monitor" menjadi **Monitor Ulangan** (lencana jalur data dibuang), halaman **Pengaturan diskalakan per
ulangan** (bukan per akun), impor murid menerima judul kolom lazim ("Nama Lengkap", "E-mail", "Nama Kelas"),
dan tiga sisa temuan audit ditutup — dua di antaranya ternyata cacat alat ukur, satu cacat layar nyata
(tautan jejak 19 px → 44 px tanpa menggeser tata letak).

**Riwayat sesudah itu (13 Okt 2026) — dua paragraf panjang di atas sengaja dibiarkan apa adanya sebagai
riwayat A.30–A.60:**

| Putaran | Isi singkat | Di mana |
| --- | --- | --- |
| A.61 | soal boleh diperbaiki di tengah ulangan (cap versi soal, spanduk “Guru memperbarui soal”, sidebar tanpa scrollbar, susun soal spesifik per soal) | bagian 6 · laporan A.61 |
| A.62 | kartu pertanyaan: pilihan PG di editor dipindah **di bawah** pertanyaan | laporan A.62 |
| A.63–A.64 | sapuan GUI + tiga celah cakupan GUI ditutup: harness baru **`layar`** (34/34), **`tim`** (31/31), **`impor-murid`** (29/29), **`mapel`** (32/32), **`avatar`** (44/44), **`auth`** (36/36 — butuh `MAIL_MAILER=log`) | bagian 7–8 · laporan A.63/A.64 |
| A.65 | pita palet panel samping memanjang sampai dasar kolom konten (harness `palet-sidebar` 58/58) | bagian 9 · laporan A.65 |
| A.66 | sapuan GUI 30 harness: **777 pemeriksaan lulus**, audit 44 halaman bersih di dua tema; dua pemeriksaan **mati** di `smoke-ui-mobile.mjs` dihidupkan | bagian 10 · laporan A.66 |
| A.67 | audit pemeriksaan mati di seluruh harness (kontrol negatif A/B) | bagian 11 · laporan A.67 |
| A.68 | bank soal dimuat bertahap + pencarian server; `/pengaturan` kembali jadi **halaman akun**; setelan ulangan pindah ke tiap kuis; slug kuis | bagian 12 · laporan A.68 |
| A.69 | **bundel frontend dipotong per halaman** (`React.lazy` + `Suspense`, pramuat tautan menu) — 923,63 kB → 555,26 kB bundel awal | bagian 0.1a & 13 · laporan A.69 |
| A.70 | **patch kinerja dari luar repo diterapkan** (kueri berulang ulangan/impor/laporan, `snapshot_soal`, `afterCommit`, `retry_after`) + dua bug **rekam diri lampiran** (durasi 0 detik, perekam tak dimatikan) | bagian 14 · laporan A.70 |
| A.71 | **log mentah diganti dari sesi asli** (412 MB / 539 pesan) lewat eksportir streaming, **satu folder per sesi** + indeks, `docs/README.md` baru, rujukan path diperbarui | bagian 15 · laporan A.71 |
| A.72 | **A.61–A.69 dikomit** dalam enam commit bertema (slug · bank soal bertahap · halaman akun · bundel per halaman · penjelasan fitur); working tree bersih, tinggal push | bagian 16 · laporan A.72 |

## 1. Status verifikasi terakhir

| Perintah | Hasil |
| --- | --- |
| **Bundel per halaman (**A.69**, 13 Okt 2026 — putaran terakhir, belum dikomit)** — `npm run build` sebelum/sesudah, `node docs/ukur-bundel-peramban.mjs` (Chrome + `vite preview`), `npm run check`, `npm run lint`, `npm run test`, enam harness smoke | Bundel awal **923,63 kB → 555,26 kB** (262,06 → **176,35 kB gzip**), 54 berkas JS; di peramban: buka app **6 berkas / 555,30 kB** lalu tekan “Daftar” **2 berkas kecil** tanpa muat ulang; checkJs exit 0 · ESLint 0 error · Vitest **80 berkas / 760 tes**; smoke `pengaturan` 12/12 · `susun` 44/44 · `slice04` 18/18 · `nav` 14/14 · `kuis-materi` 48/48 · `slice07` 21/21 — semua exit 0. Rincian: **A.69** |
| **Bank soal bertahap + `/pengaturan` jadi halaman akun (**A.68**, 13 Okt 2026 — belum dikomit)** — `./verify.sh` + `docs/jalankan-smoke-ui.sh pengaturan/slice03/susun/kuis-manual` | `./verify.sh` **SEMUA HIJAU** — Pest **357 lulus** (3356 asersi) · Redis wajib 9 · Pint bersih (361 berkas) · checkJs · ESLint 0 error · Vitest **79 berkas/752 tes** · realtime 20; smoke `pengaturan` **12/12** (harness ditulis ulang) · `slice03` **9/9** · `susun` **44/44** · `kuis-manual` **15/15**. Rincian: **A.68** |
| **Audit pemeriksaan mati harness GUI (**A.67**, 13 Okt 2026)** — `slice07`, `kuis-materi`, `audit-ui` | `slice07` **21/21** · `kuis-materi` **48/48** · `audit-ui kuis` **BERSIH (`{}`)** — semuanya exit 0. Kontrol negatif A/B: klaim lama **21/21 lulus** atas respons tak terpakai (buta) vs klaim baru **20/21 · exit 1**. Rincian: `laporan-pengujian.md` **A.67** |
| **Sapuan GUI fitur rawan (**A.66**, 13 Okt 2026)** — 30 harness lewat `docs/jalankan-smoke-ui.sh` + `node docs/audit-ui.mjs` (terang & `--gelap`) | **777 pemeriksaan LULUS, semuanya exit 0**; audit **44/44 halaman bersih di kedua tema** (cacat `{}`); sesudahnya `./verify.sh` **SEMUA HIJAU** (Pest 344/3290 · Redis wajib 9/65 · Pint · checkJs · ESLint 0 error · Vitest 76/731 · realtime). Dua pemeriksaan mati di `docs/smoke-ui-mobile.mjs` ditemukan & dihidupkan. Rincian: `laporan-pengujian.md` **A.66** |
| `./verify.sh` (root) (**A.55**, sesudah semua suntingan putaran ini) | **SEMUA HIJAU (exit 0)** — Pest, Pint, `npm run check`, ESLint, Vitest, dan realtime (20 tes) semuanya lulus |
| `docs/jalankan-smoke-ui.sh kuis-materi` (**A.55**, Chrome + layanan hidup) | **48/48 lulus, exit 0** — panel kuis tampil di bawah video (hp, `posisi: bawah`, panel 274×567 untuk isi 565 px, gulir dalam panel 0) dan di sampingnya di laptop tata horizontal (panel 280×567 vs bingkai 220×124); gulir mendatar halaman 0 px; kontrol negatif: CSS lama **27/42** (panel `274×123` menumpuk bingkai `274×154`, +55 px mendatar) |
| `docs/jalankan-smoke-ui.sh mobile` + `docs/jalankan-smoke-ui.sh materi` (**A.55**, regresi) | **16/16** dan **27/27 lulus, exit 0** — bilah atas masih bersih di 8 halaman guru beremulasi ponsel, dan alur kuis sisipan di pemutar video tidak berubah |
| `npx vitest run` (frontend) (**A.55**) | **75 berkas / 717 tes lulus** |
| `npx vitest run src/__tests__/sections/material src/__tests__/theme` (**A.45**) | **110 lulus / 7 berkas** |
| `node docs/tangkap-adegan-gunung.mjs` (**A.45**, Chrome + layanan hidup) | **exit 0** — berkas tema termuat (`/tema/gunung.svg`, 1600x900), zoom `jelajah-zoom`, luminance rata-rata **165,1** · piksel gelap **0,01%** · langit 187,5 |
| `docs/jalankan-smoke-ui.sh perjalanan` (**A.45**) | **52/52 lulus, exit 0** — termasuk asersi baru: `src /tema/gunung.svg · termuat true · adegan tangan 0`, `zoom jelajah-zoom`, `rasio 1.78` |
| `npm run test` (Vitest) (**A.46**) | **67 berkas / 653 tes lulus** |
| `npx vitest run src/__tests__/theme src/__tests__/sections/material` (**A.46**) | **122 lulus / 8 berkas** (9 tes pagar bentuk latar, 14 peta, 31 perjalanan) |
| `node docs/tangkap-adegan-gunung.mjs` (**A.46**, Chrome + layanan hidup) | **exit 0** — berkas tema termuat (`/tema/gunung.svg`, 1600x900), luminance rata-rata **200,8** (A.45: 165,1) · piksel gelap **0,01%** · langit **203,8** (A.45: 187,5) |
| `docs/jalankan-smoke-ui.sh perjalanan` (**A.46**) | **52/52 lulus, exit 0** — latar & panggung sama seperti A.45, kini dengan penanda kemah + jalur zigzag |
| `./verify.sh` (root) — ulang di putaran A.36 | HIJAU (exit 0) — Pest **267 passed (2443 assertions)** · Pint **340 berkas** · checkJs OK · ESLint **0 error** (2 warning lama React Hook Form) · Vitest **63 berkas / 610 test** · realtime 15 test |
| `php artisan test` (ulang di A.39, sesudah perbaikan) | **294 passed (2774 assertions)**, 16,5 s |
| `php artisan test --filter=AlurTipeSoalTest` (A.39) | **22 passed (242 assertions)** — satu tes per tipe soal, lewat HTTP |
| `php artisan test --filter=TamuTest` (**A.40**) | **15 passed (120 assertions)** — default mati, masuk dengan nama, tamu menyelesaikan ulangan (skor 10/10), kuis draf/kuis guru lain 403, murid berkelas lain tetap ditolak, mode tim ditolak, akun tamu tidak masuk jalur guru, tamu di luar peringkat kelas, panel guru pemilik vs guru lain |
| `php artisan test` (**A.40**, seluruh suite) | **309 passed (2894 assertions)**, 17,2 s |
| `npm run check` + `npm run lint` (**A.40**) | checkJs **bersih**; ESLint **0 error** (2 warning lama) |
| `npx vitest run src/__tests__/sections/auth/masukTamu.test.jsx` (**A.40**) | **3 passed** — nama dirapikan & sesi terbuka, nama terlalu pendek tidak menembak server, pesan penolakan server ditampilkan apa adanya |
| `./verify.sh` (**A.40**, sesudah semua suntingan) | **SEMUA HIJAU (exit 0)** — Pest 309 · Pint **347 berkas** · checkJs · ESLint · Vitest **64 berkas / 627 tes** · realtime 15 tes |
| `git push` (**A.40**) | `d2c0dff..6e04be6 main -> main` (dua commit: materi luring/tema/editor + perbaikan 3 temuan A.39), lalu commit A.40 |
| `./verify.sh` (ulang di A.39) | **SEMUA HIJAU (exit 0)** — Pest 294 · Pint **341 berkas** · checkJs · ESLint · Vitest **63 berkas / 624 tes** · realtime 15 tes |
| `docs/jalankan-smoke-ui.sh durasi-klip` (ulang di A.36) | **11/11 lulus, exit 0** — termasuk seret tetikus sungguhan pada tanda `|` kiri/kanan |
| `node docs/smoke-ui-durasi-klip.mjs` (putaran lanjutan A.36.7) | **15/15 lulus, exit 0** — bagian 4 baru: klip **kuis** (materi #20) dan klip **media** (materi #1) juga punya tanda `|` yang bisa diseret |
| `docs/jalankan-smoke-ui.sh susun` (ulang di A.35) | **42/42 lulus, exit 0** — mencakup pemeriksaan baru pemilih jenis (kartu ke-3, lipatan `DETAILS`, 22 petak radio berikon) |
| `docs/jalankan-smoke-ui.sh kuis-manual` (ulang di A.35) | **10/10 lulus, exit 0** |
| `php artisan test tests/Feature/Slice12TemaMateriTest.php` (A.34) | **9 passed (123 assertions)** — tema + nama pos, katalog, video latar milik materi, kenaikan pos & tingkat, langkah opsional, laporan |
| `npx vitest run src/__tests__/sections/material src/__tests__/theme` (A.34) | **90 passed (7 berkas)** — termasuk 24 tes `perjalanan` + 9 tes komponen `PetaPerjalanan` |
| `docs/jalankan-smoke-perjalanan.sh` (A.34) | **34/34 lulus, exit 0** — backend :8000 + vite :5173 + Chrome CDP :9333 (realtime tidak perlu); harness mandiri (membuat materi + video uji 2 detik sendiri, menghapusnya di akhir) |
| `docs/jalankan-smoke-perjalanan.sh` (ulang di A.51, sesudah bagian tema pulau masuk) | **69/69 lulus, exit 0** — termasuk pemeriksaan baru: `tidak ada pos yang berdiri di langit (semuanya di bawah punggungan)`, `pos tema luar angkasa berdiri di benda rutenya (landasan → Bulan) · selisih maks 0.0%`, `latar tema luar angkasa memakai berkas angkasa.svg yang benar-benar termuat`, `jalur peta dipakai versi terang di langit malam · stroke rgba(226, 240, 255, 0.78)`, `pos tema harta karun berdiri di benda rutenya (dermaga → goa) · selisih maks 0.0%`, `latar tema harta karun memakai berkas pulau.svg yang benar-benar termuat`, `tiap pos tema harta karun berdiri di benda, bukan di langit · selisih terkecil 35 vs langit 157,219,244` |
| `npx vitest run src/__tests__/theme src/__tests__/sections/material` (A.50) | **86 tes lulus (5 berkas)** — termasuk pagar baru `theme/latarTema.test.js`: bentuk tiga latar + tiap pos harus mendarat di gambar temanya |
| `./vendor/bin/pest tests/Feature/Slice12TemaMateriTest.php` (ulang di A.50) | **10 passed (172 assertions)** — katalog kini empat tema, dengan urutan & fase terbaru diperiksa |
| `./vendor/bin/pest tests/Feature/SekolahTest.php` (**A.51**) | **10 passed (78 assertions)** — termasuk tes baru pencarian: nama sebagian & huruf besar-kecil, email, NIS, NISN, murid tanpa NIS, kata kunci tanpa hasil = kosong, gabungan dengan `filter[class_id]`, `%` di-escape, kata kunci berisi spasi diabaikan |
| `npx vitest run src/__tests__/sections/school/pencarian.test.jsx` (**A.51**) | **8 tes lulus** — ketikan cepat digabung jadi satu permintaan, menyaring di server, keadaan kosong + jalan keluar, tombol bersihkan |
| `docs/jalankan-smoke-ui.sh murid` (**A.51**, harness baru, browser sungguhan) | **18/18 lulus, exit 0** — permintaan ke `/v1/murid` dihitung: tanpa kata kunci tidak ada `filter[cari]`, tiga ketikan jadi **satu** permintaan, tiga murid uji ketemu walau halaman 1 penuh 50 murid lain, NIS/email sama-sama menemukan, gabungan kelas + kata kunci bekerja, murid & kelas uji dihapus kembali |
| `./verify.sh` (**A.51**, sesudah semua suntingan) | **SEMUA HIJAU (exit 0)** — Pest **332 passed (3164 assertions)** · Redis wajib 9 tes/65 asersi · Pint bersih · checkJs · ESLint · Vitest **70 berkas / 681 tes** · realtime lulus |
| `php artisan test --filter=Slice08Test` | 12 passed (172 assertions) — termasuk 3 tes rasio/tampilan/kuis-sisipan |
| `npx vitest run src/__tests__/sections/material` | 54 passed (4 berkas) |
| Seluruh smoke UI satu tarikan (`nav`→`susun`→`03`→`04`→`05`→`06`→`07`) | **148 pemeriksaan lulus**: 14/14 · 40/40 · 9/9 · 18/18 · 20/20 · 27/27 · 20/20 (semua exit 0) — **terakhir dijalankan putaran A.29**, belum diulang sesudah A.30/A.31 |
| `docs/jalankan-smoke-materi.sh` (pemutar materi + kuis sisipan, putaran A.31) | **22/22 lulus, exit 0** — backend :8000 + vite :5173 + Chrome CDP :9333 (realtime tidak perlu) |
| `docs/jalankan-smoke-ui.sh slice06` (ulang sesudah papan 8 dua kolom, putaran A.32) | **28/28 lulus, exit 0** — backend+vite+realtime+Chrome; termasuk pemeriksaan baru “baris antrean dibuka dari kolom kiri + `aria-current`” |
| `node docs/smoke-http-fitur.mjs` (**A.52**, diulang sesudah pemeriksaan usangnya diperbaiki) | **243/243 lulus, exit 0** (22,3 dtk) — butuh backend + realtime hidup. Dulu **241/242**: pemeriksaan lama masih mengharapkan `tamper_suspected` diterima dari klien (`201`), padahal kategori itu sudah jadi **turunan server** — pemeriksaan diganti dua yang sesuai kontrak berjalan (`tamper_suspected` → 422; `dom_injection` + `extension_detected` → 201). Sebelumnya terakhir dijalankan di A.29 |
| `node docs/smoke-ui-luring.mjs` (baru, putaran A.33) | **22/22 lulus, exit 0** (dua kali dengan versi final) — backend :8000 + vite :5173 + Chrome :9333 (realtime tidak perlu) |
| `node docs/smoke-ui-slice04.mjs` + `slice07.mjs` (regresi sesudah A.33) | **18/18 dan 20/20 lulus, exit 0** (slice 07 butuh realtime hidup) |
| `./verify.sh` (**A.42**, sesudah tamu per perangkat + proteksi mobile) | **SEMUA HIJAU (exit 0)** — Pest **331 passed (3126 assertions)** · Redis wajib 9 · Pint bersih · checkJs · ESLint · Vitest **66 berkas / 641 tes** · realtime **20 tes** |
| `php artisan test --filter=TamuTest` (**A.42**) | **21 passed (172 assertions)** — termasuk perangkat sama = akun sama, nama sama dua perangkat = dua akun, nama emoji/non-Latin punya akun sendiri, 6 anak satu IP tanpa 429, dan per perangkat tetap 5/menit |
| `npx vitest run src/__tests__/security/useExamSecurity.test.jsx` (**A.42**) | **6 passed** — resize tinggi (keyboard HP) tidak mengaburkan, masa tenggang kunci, dialog berkas tidak mengunci; dibuktikan bergigi lewat mutasi (4 dari 6 merah saat pagarnya dilepas) |
| `npx vitest run src/__tests__/sections/auth/perangkat.test.js` (**A.42**) | **5 passed** — kode dibuat sekali per perangkat, tetap ada walau penyimpanan diblokir, kode server yang disimpan |
| `npx vitest run src/__tests__/sections/auth/authStore.sesi.test.js` (**A.42**) | **12 passed** — termasuk tamu yang menekan Keluar membuang kode perangkatnya (komputer bersama), sedangkan sesi yang habis sendiri tidak |
| `docs/jalankan-smoke-ui.sh tamu` (**A.42**, harness baru, browser sungguhan) | **9/9 lulus, exit 0** — tamu lewat formulir dapat kode perangkat, muat ulang tidak berubah, Keluar membuang kode, nama sama sesudah Keluar = akun baru, kode ngawur 422; pintu tamu dimatikan kembali di akhir |
| `./nyalakan-local.sh status` (**A.42**) | redis/backend/realtime/frontend **HIDUP** — satu perintah menyalakan semua tanpa menghapus data (tanpa `migrate:fresh`) |
| `npx vitest run src/__tests__/security` (**A.53**) | **33 lulus** — `deteksiTamper` 12, `useExamSecurity` 8 (default-mati + overlay dinetralkan + fail-open), `pengaturanProteksi` 6 (termasuk `detect_tamper` di luar preset), `pengirimKejadian` 7 |
| `php artisan test --filter='pencarian tetap menemukan satu murid di antara ribuan'` (**A.53**) | **1 passed (14 assertions)**, ±1,24 dtk — 1.200 murid: `meta.total=1201`, halaman dibatasi 50, cari nama/NIS mengembalikan tepat 1, halaman terakhir memuat sisa |
| `npx vitest run src/__tests__/sections/school` (**A.53**) | **63 lulus / 9 berkas** — termasuk 5 tes penyorotan + assertion `<mark>` di `pencarian.test.jsx` |
| `docs/jalankan-smoke-ui.sh murid` (**A.53**, ulang sesudah penyorotan) | **18/18 lulus, exit 0** — penyorotan `<mark>` tidak mengubah perilaku yang diperiksa |
| `docs/jalankan-smoke-ui.sh slice07` (**A.53**) | **20/20 lulus, exit 0** — payload proteksi sungguhan memuat `"detect_tamper":false` (default mati) |
| `node docs/smoke-http-fitur.mjs` (**A.53**, backend + realtime hidup) | **243/243 lulus, exit 0** (21,5 dtk) |
| `./verify.sh` (**A.53**, sesudah semua suntingan) | **SEMUA HIJAU (exit 0)** — Pest **333 passed (3178 assertions)** · Redis wajib 9 tes/65 asersi · Pint bersih · checkJs bersih · ESLint 0 error · Vitest **72 berkas / 702 tes** · realtime 20 tes |
| `php artisan test --filter=DenyutProteksiTest` (**A.54**) | **6 passed (53 assertions)** — rotasi nonce, nonce salah/diulang ditolak tanpa menyegarkan liveness, sapu mencatat `tamper_suspected` sekali saja, tidak menuduh saat segar/lewat deadline, payload + endpoint, hanya pemilik & hanya saat berjalan |
| `npx vitest run src/__tests__/sections/presence` (**A.54**) | **14 lulus / 2 berkas** — termasuk 5 tes hook `useDenyutProteksi` (default mati, rotasi nonce, 409 → muat ulang, fail-open) |
| `node docs/smoke-http-fitur.mjs` (**A.54**, backend + realtime hidup) | **247/247 lulus, exit 0** (22,4 dtk) — 4 pemeriksaan baru di bagian K (payload menerbitkan nonce, denyut diterima & nonce dirotasi, nonce lama 409, nonce palsu 409) + 2 pemeriksaan harness yang kini memakai `filter[cari]`/`filter[class_id]` |
| `docs/jalankan-smoke-ui.sh slice07` (**A.54**) | **20/20 lulus, exit 0** |
| `./verify.sh` (**A.54**, sesudah semua suntingan) | **SEMUA HIJAU (exit 0)** — Pest **339 passed (3231 assertions)** · Redis wajib 9/65 · Pint bersih · checkJs · ESLint 0 error · Vitest **73 berkas / 707 tes** · realtime 20 |
| Seluruh smoke UI dijalankan ULANG di atas local yang hidup (**A.42**, sesudah runner diperbaiki) | `tamu` **9/9** · `slice06` **28/28** · `slice07` **20/20** · `kuis-manual` **13/13** · `perjalanan` **52/52** · `materi` **27/27** — semua exit 0, keempat layanan tetap HIDUP sesudahnya |
| **Uji perangkat mobile sungguhan (A.44, emulasi perangkat Chrome 412×915 @2.625 + sentuhan + UA Android)** | `docs/jalankan-smoke-ui.sh mobile` **16/16 lulus, exit 0** — temuan nyata: tombol tema (`.tombol-ikon`) menyusut 48→**37 px** di header ponsel (tanpa `flex-shrink: 0`) sehingga di bawah target sentuh 44 px → **diperbaiki**; sesudahnya 695 kontrol di 8 halaman semua ≥44 px, tanpa gulir mendatar, laci/hamburger lulus (tautan, Escape, overlay) |
| **Sapu penuh 15 harness berhitung (A.43, sesudah runner Chrome diperbaiki)** | **301 pemeriksaan lulus, semua exit 0** — `tamu` 9/9 · `slice03` 9/9 · `slice04` 18/18 · `slice05` 20/20 · `slice06` 28/28 · `slice07` 20/20 · `susun` 42/42 · `kuis-manual` 13/13 · `nav` 14/14 · `luring` 22/22 · `pengaturan` 5/5 · `sidebar` 7/7 · `durasi-klip` 15/15 · `perjalanan` 52/52 · `materi` 27/27, plus `cdp` (peninjau) exit 0 — dijalankan berurutan di atas satu local yang hidup, keempat layanan tetap HIDUP |

Layanan yang dibutuhkan smoke UI: backend `:8000`, realtime `:4000`, frontend `:5173`, Chrome CDP `:9333`:

```bash
( cd backend  && php artisan serve --host=127.0.0.1 --port=8000 )
( cd realtime && node src/server.js )
( cd frontend && npm run dev )
( "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
    --remote-debugging-port=9333 --user-data-dir=/tmp/chrome-smoke2 --no-first-run \
    --autoplay-policy=no-user-gesture-required about:blank )
```

**Penting:** untuk sesi agen, jangan menyalakan layanan dengan `nohup ... &` di dalam perintah SYNC — shell
perintah dibersihkan setelah selesai dan anak prosesnya ikut mati. Pakai runner `docs/jalankan-smoke-ui.sh
<nama>` (menyalakan sendiri yang belum ada lalu mematikannya), atau nyalakan `./nyalakan-local.sh` dan
jalankan harness **di dalam satu perintah yang sama**. Di terminal pengguna, `./nyalakan-local.sh` bertahan
normal dan runner memakai layanan itu apa adanya.

Akun demo: `admin@sekolah.test` / `smoke.murid@sekolah.test`, sandi `Passw0rd!Aman` (lihat
`RolesAndAdminSeeder`). Throttle masuk 5 percobaan/menit per akun — harness sudah menunggu + mencoba lagi.

## 2. Yang selesai di putaran A.30 dan A.31

- **A.47 — tanda pangkas `|`: satu goresan, digeser ke dalam (12 Oktober 2026)**: permintaan *"buat `||`
  … gak beneran cuman `|` dan juga buat lebih kedalam"*; elemennya dipastikan lebih dulu lewat pertanyaan
  pilihan (jawabannya gagang pangkas klip, bukan penanda tegak lain). Sebabnya diukur sebelum diperbaiki:
  potret baris klip menunjukkan goresan hanya **1px** (cincin `border: 1px` habis dipakai `width: 3px`
  karena `box-sizing: border-box` — reboot Bootstrap juga berlaku untuk `::before`), dan di tepi kanan klip
  terpilih ada **dua** goresan aksen: tanda (1px, x922) dan garis tepi klip sebelahnya (3px, x924–926),
  dipisah 1px `--kartu`. Perbaikan: `border` → `outline: 1px solid var(--teks)` (outline tidak menyusutkan
  lebar; kontras `--aksen` di atas `--sorot-hangat` hanya 2,3:1 sedangkan `--teks` di atasnya >14:1 —
  WCAG 1.4.11), goresan digeser **0,45rem (7,2px)** ke dalam di dua sisi lewat `padding-inline`, dipendekkan
  ke 1,6rem, dan `.nle-klip-aktif` memakai `border-inline-start-width: 1px` (warna tipe tidak tampak selama
  terpilih — konsekuensi sadar, jenis tetap terbaca dari ikon/label + inspector). **Kotak seret tetap di
  tepi klip**, jadi jalur seret & penjaga geometri lama tidak berubah. Verifikasi: harness
  `docs/jalankan-smoke-ui.sh durasi-klip` **19/19** (kiri 3px jarak 7px · kanan 3px jarak 8px · satu goresan
  per sisi), **uji balik** CSS lama **16/19** (3 dari 4 pemeriksaan bentuk merah), dan `./verify.sh`
  **SEMUA HIJAU** (Pest 331/3126 · Vitest 67 berkas/653 tes). Pagar berbasis teks CSS **tidak bisa** dipakai:
  Vitest men-stub `theme.css` jadi modul kosong (`test.css: false`) sehingga `?raw` selalu `''` — pagarnya
  ditaruh di harness browser (bukti render sungguhan). Temuan sampingan dicatat di laporan A.47.5: karena
  stubbing itu, pagar warna `tema.test.js` selama ini tidak pernah membaca `theme.css`.
- **A.46 — kemah, jalur zigzag, gambar gunung baru (11 Oktober 2026)**: pemilik produk minta *"buat post
  seperti kemah dan juga buat seperti memanjat gunung jadi zigzag dan ganti gunungnya, seperti gunung bukan
  curan tapi tumpul dan lebih detail"*. Tiga hal: (a) penanda pos jadi **tenda** (`KemahPos` di
  `PetaPerjalanan.jsx`: atap + pintu, warna tetap dari `--pos-warna`) dan ikon fase dilepas dari penanda karena
  tidak terbaca di ukuran itu; (b) `titikJalur()` di `perjalanan.js` berganti jadi **zigzag mendaki** — pos
  bergantian jalur kiri (12%→20%)/kanan (88%→80%) yang **mengecil ke atas**, `y` selalu naik 86%→12%, pos
  terakhir di **puncak** (`x=50`), dan satu pos tidak punya belokan; (c) gambar latar diganti karena berkas
  lama tersusun dari **baji bersisi tegak** (90°, plus path tanpa luas `M 577.37 220 L 577.37 834.33`) sehingga
  terbaca seperti tebing. Empat kandidat CC0 diunduh & diukur lebih dulu, tak satu pun lebih baik, jadi
  latarnya **dibuat sendiri di repo** (CC0, dicatat `LISENSI.md`). Permintaan lanjutan (A.46.7) menetapkan
  **satu gunung saja** (dari garis cakrawala terhitung tepat 1 puncak, menonjol 292 px), puncak tetap di langit
  (31% dari atas), batu tetap ada dan kini terlihat, dan **tidak ada goresan panjang yang ujungnya lepas**
  (rusuk lereng yang berhenti di tengah lereng dihapus; yang tersisa hanya burung 3,8% lebar). Angka bentuk:
  kemiringan sisi maks **43,3°**, putaran maks **12,6°**, sisi tegak terpanjang **27 px**, punggung puncak
  **13,2%**, 60 bentuk/18 warna. Pagar `gunungLatar.test.js` (9 tes) **diuji balik** dengan berkas lama →
  **6/9 merah**. Bukti: Vitest **653 tes** · checkJs bersih · ESLint 0 error · smoke perjalanan **52/52** ·
  tangkapan kecerahan **200,8** (langit 203,8). Rincian: `laporan-pengujian.md` A.46.

- **A.45 — latar gunung: gambar jadi domain publik (11 Oktober 2026, menggantikan gambar tangan)**: pemilik
  produk minta latarnya lebih terang, tidak kaku, dan **memakai gambar jadi dari domain publik yang bergaya
  grafik (bukan foto realis)**. Langkah pertama (palet siang cerah + lereng melengkung + gaya gambar rata +
  panggung tak lagi digelapkan) dikerjakan penuh di `AdeganGunung.jsx`/`theme.css`, lalu langkah kedua memakai
  `frontend/public/tema/gunung.svg` (Public Domain via publicdomainvectors/Openclipart, gambar rata 9 warna,
  50 bentuk, tanpa raster/teks/filter, viewBox 16:9, 11 KB) — `FOTO_ADEgan.gunung` diisi dan `'gunung'`
  dikeluarkan dari `ADEGAN_DIGAMBAR`, jadi berkasnya yang dipakai (`data-latar="foto"`). Komponen gambar tangan
  **tidak dihapus**: kembalikan `'gunung'` ke `ADEGAN_DIGAMBAR` untuk memakainya lagi. Panggung kini hanya
  digelapkan untuk **video** guru; gambar tema/adegan dapat kabut putih tipis. Jalur peta di atas latar terang
  memakai warna pekat (`--jalur-belum`, `--jalur-lewat`) dan pil nomor pos diberi garis rambut. Bukti:
  `docs/tangkap-adegan-gunung.mjs` (luminance rata-rata **165/255**, piksel gelap **0,01%** luas, langit 187)
  + `verify.sh` SEMUA HIJAU + smoke perjalanan **52/52** dengan tiga asersi baru yang lebih ketat.
  Rinciannya di `laporan-pengujian.md` A.45.

- **A.43 — rapikan + GUI langsung diuji (11 Oktober 2026)**: adegan `gunung` kembali **digambar sendiri**
  (`sections/material/AdeganGunung.jsx`, SVG beranimasi CSS, sudut pandang mendongak dari kaki gunung) dan
  foto pihak lain `gunung.jpg` **dihapus** dari repo — keputusan A.37 dibalik atas permintaan pemilik
  produk; `PetaPerjalanan.jsx` kini memilih latar berurutan **video → adegan digambar → foto → gradien**
  (`data-latar="ilustrasi"`), `LISENSI.md` mencatat folder itu kosong. `EditorSoal.jsx` dirapatkan
  (`gap-3`/`p-3`/`row g-2`, teks bantuan panjang dibuang, kelas `.editor-soal` termasuk petak jenis 2/4/6
  kolom), dan `HalamanKuis.jsx` **tidak lagi menutup** editor soal sesudah satu soal tersimpan (editor
  di-`key` ulang + hitungan "Sudah ditambahkan N soal"). Tiga runner smoke kini **memakai layanan yang
  sudah hidup** dan hanya mematikan proses miliknya sendiri (tiga bug runner diperbaiki: `000000` dari
  `curl || echo 000`, `pkill -f "artisan serve"`, dan **Chrome run sebelumnya yang masih memegang :9333**
  sehingga Chrome baru hidup tanpa port debug → harness cuma bilang `fetch failed`), dan
  `./nyalakan-local.sh` menyatukan penyalaan local tanpa menghapus sesi. Bukti: `verify.sh` SEMUA HIJAU dan
  **sapu penuh 301 pemeriksaan lulus** (15 harness, semua exit 0, keempat layanan tetap hidup). Rinciannya
  di `laporan-pengujian.md` A.42.5 & A.43.

- **A.30 — 22 tipe soal (objektif 1) tuntas**: kontrak `PenanganTipeSoal::bobot()` untuk penilaian
  parsial (8 tipe lama tetap biner lewat trait `BobotBiner`), 14 tipe baru (`pilihan_ganda_kompleks`,
  `benar_salah_majemuk`, `isian_angka`, `pilihan_gambar`, `urut_gambar`, `susun_huruf`, `isian_rumpang`,
  `klasifikasi`, `tabel_isian`, `garis_bilangan`, `hotspot_gambar`, `baca_jam`, `tugas_unggah`,
  `teka_silang_mini`), payload murid dijaga tidak pernah memuat kunci. Objektif 2 baru sebagian (**2A**):
  `tamper_suspected` jadi kategori turunan server, klien hanya boleh `dom_injection` + `extension_detected`.
- **A.31 — editor materi gaya video editor**: kolom `materials.rasio` dikunci per materi, pengaturan
  tampilan per klip (`fit`/fokus/zoom untuk media; `mode`/`tata` untuk kuis), urutan bagian murid
  mengikuti **timeline**, `host_id` + `boleh_dibuka` dihitung server, dan pemutar murid baru yang
  memunculkan kuis saat video mencapai detiknya (video wajib menunggu kuis wajib di dalamnya).
  Dokumentasi putaran ini ada di `laporan-pengujian.md` A.31 (termasuk daftar modifikasi yang saya
  lakukan terhadap paket eksternal dan alasan tiap modifikasi).
- **A.32 — papan 8 tuntas**: halaman koreksi jadi **dua kolom** (antrean kiri, detail kanan), baris aktif
  dipilih lewat identitas `attempt-soal` (`kunciKoreksi`/`pilihItemKoreksi`, 3 tes) bukan nomor urut,
  ditandai `aria-current="true"` + `data-koreksi`, form diikat `key` ke barisnya, penunjuk langkah
  "Skor & alasan → Token konfirmasi → Tersimpan" (`langkahKoreksi`, 3 tes), dan dua sisa tombol Bootstrap
  diganti `Tombol`. Verifikasi: Vitest scoring 22 passed, checkJs OK, ESLint 0 masalah, smoke slice 06
  **28/28** (harness disesuaikan: membuka baris antrean dulu), `./verify.sh` SEMUA HIJAU (Vitest 511).
- **Runner smoke generik (A.32): `docs/jalankan-smoke-ui.sh <nama-harness>`** — menyalakan backend + vite +
  realtime + queue worker + Chrome dalam satu proses shell lalu mematikannya lagi, supaya harness lama
  (slice06/slice07, dsb.) bisa dijalankan sebagai satu perintah tanpa meninggalkan proses latar.
- **Harness smoke baru (A.31): `docs/smoke-ui-materi.mjs` + `docs/jalankan-smoke-materi.sh`** — mandiri
  (membuat soal + kuis + materi uji, lalu menghapusnya di blok `finally`), memakai berkas video yang
  sudah ada di DB dev (`XZhNi…`, 5,4 MB) dan **tidak** mengunggah apa pun. Runner-nya menyalakan backend +
  vite + Chrome dalam satu proses shell (migrasi dijalankan lebih dulu) dan mematikannya lagi saat selesai.
- **A.33 — sistem luring (10 Oktober 2026)**: empat modul baru di `frontend/src/sections/attempt/`
  (`luring.js` = keadaan jaringan, `riwayatJawaban.js` = riwayat jawaban lokal + validasi payload,
  `snapshot.js` = salinan attempt, `RiwayatJawaban.jsx` = panel riwayat) plus `hitungMundur.js`
  (`jamKlien`/`sekarangTerkunci`/`hitungSisaAman`) dan `antreanJawaban.js` (`pulihkan`).
  Saat luring jawaban ditulis ke perangkat dulu dan pengiriman DITAHAN sampai event `online`; jam memakai
  jam monotonik sehingga jam Windows yang dimundurkan tidak menambah waktu; soal masih bisa dibuka dari
  salinan perangkat. Riwayat + salinan **hilang setelah dikumpulkan** dan saat sesi berakhir (S-14).
  Smoke baru `docs/smoke-ui-luring.mjs` (**22/22**) memutus koneksi dari **DevTools CDP** (mode luring) dan
  memblokir `*/api/v1/kuis/*/mulai` (kasus "internet hidup, server mati" + tombol "Lanjutkan dari salinan"),
  bukan dari aplikasi.
  Temuan nyata: `pulihkan()` (A.33.2) — sebelum ini jawaban yang hanya ada di cadangan lokal tampil di
  layar tetapi **tidak pernah dikirim ulang**, jadi hilang saat dikumpulkan.
- **A.34 — materi berjalan / template tema (10 Oktober 2026)**: registry murni
  `Material/Registry/TemaPerjalanan.php` (tema "Mendaki Gunung": 6 fase + 4 tingkat) + kolom JSON
  `materials.tema` (menyimpan pilihan guru saja) + `TemaMateriService` (validasi kode tema & video latar) +
  `GET /v1/materi/tema`. Tiap blok jadi satu **pos** (nama bisa diganti guru lewat `isi.fase`); muatan murid
  dan laporan guru mengirim peta yang sama (`perjalanan`). Frontend: `sections/material/perjalanan.js`
  (skema Zod + katalog cadangan + pembantu murni `tingkatKe`/`petaLokal`/`kenaikanUntuk`) dan
  `PetaPerjalanan.jsx` — adegan digambar & **dianimasikan CSS/SVG** (awan `jelajah-awan`, pendaki
  `jelajah-langkah`), dan bila guru menempelkan **video latar** maka video itu yang tampil. Editor materi
  dapat panel Template + pratinjau peta; layar murid mengumumkan "Naik ke pos N" / "Naik tingkat" **hanya
  setelah server mengirim peta terbaru**. Hanya langkah wajib yang menghitung kenaikan.
  Smoke baru `docs/smoke-ui-perjalanan.mjs` + runner `docs/jalankan-smoke-perjalanan.sh` (**34/34**).
  Dua temuan saat smoke: (a) harness `klik('Buka')` mengklik tombol "Buka" pertama — karena bagian selesai
  tetap bisa dibuka ulang, itu mengenai bagian yang salah → diganti `klikBagian(n)`; (b) assertion animasi
  awan bertentangan dengan rancangan (video latar memang menggantikan adegan SVG) → assertion dibaca sesuai
  bentuk latar yang benar-benar dirender. Dua-duanya bug **harness**, bukan produk.
- **A.35 — editor soal: pemilih jenis ringkas berikon (11 Oktober 2026)**: pemilih 22 jenis soal tidak lagi
  berupa **pil teks di kartu pertama**, melainkan **petak berikon di kartu paling bawah** yang bisa
  dibuka-tutup (`<details>`, terbuka bawaan; ringkasannya memperlihatkan ikon + nama tipe aktif). Urutan
  kartu jadi **1. Tulis soalnya → 2. Pengaturan soal → 3. Pilih jenis soal**. Ada 21 ikon baru di
  `icons.jsx` (satu per tipe, `baca_jam` memakai `IkonJam`), peta ikon hidup di registry
  `sections/question/tipeSoal.js` (`IKON_TIPE`, `ikonTipe()`, medan `ikon` di `DAFTAR_TIPE`) supaya bisa
  diuji murni, dan CSS `.pemilih-jenis`/`.petak-tipe` (2 kolom di HP, 4 kolom ≥768px, petak ≥84px). Alur
  simpan ke bank soal **tidak berubah** (tetap satu soal per form — "bulk" di sini maksudnya semua jenis
  tampil sekaligus). Tes baru `__tests__/sections/question/ikonTipe.test.jsx` (3 tes).
  Temuan nyata dari `./verify.sh`: ESLint menolak `const Ikon = ikonTipe(...)` di dalam render
  (`react-hooks/static-components`, 1 error) — `./verify.sh` sempat GAGAL; diperbaiki dengan pembantu
  tingkat modul `ikonJenis()` yang mengembalikan elemen `createElement`, lalu hijau kembali.
  Harness `smoke-ui-susun.mjs` (42/42) & `smoke-ui-kuis-manual.mjs` (10/10) disesuaikan ke judul/kelas baru;
  `smoke-ui-susun.mjs` juga masih menuntut `pil == 8` dari era 8 tipe (belum pernah dijalankan sesudah A.30)
  — sekarang 22 petak.
- **A.36 — gagang pangkas `|` di kedua sisi klip (11 Oktober 2026)**: klip terpilih di timeline materi
  punya satu tanda `|` di tiap sisi. Menyeret tanda kanan menggeser ujung (durasi ikut), tanda kiri
  menggeser awal tanpa memindahkan ujung kanan; keduanya juga bisa dipakai dengan panah kiri/kanan
  (`role="slider"`). Helper murni `pangkasKiri()`/`pangkasKanan()` di `sections/material/editorMateri.js`
  (berbeda dari `setMulai()` yang MEMINDAHKAN klip). Gagang ditaruh di lane, di luar tombol klip, supaya
  tidak ada kontrol bersarang dan tidak bertabrakan dengan seret-klip native. Panjang timeline dibekukan
  selama seret (`pangkasTotalRef`). 6 tes baru di `__tests__/sections/material/editorMateri.test.js`;
  harness `docs/smoke-ui-durasi-klip.mjs` diperluas jadi **11/11** (seret tetikus CDP + papan tombol).
  **A.36.7 (putaran lanjutan)**: permintaan yang sama datang lagi, jadi yang dikerjakan adalah pemeriksaan —
  ternyata gagangnya memang generik dan `durasi_detik` kuis tersimpan server, **tidak ada kode produk yang
  diubah**; yang ditambahkan adalah **bagian 4** harness (materi dicari dari API per tipe blok, klip `kuis`
  dan `media` diklik lalu dipangkas) sehingga hasil run menjadi **15/15**.
  Temuan: dua seretan mula-mula gagal **karena harness** — timeline ada di y≈1852 px, di luar viewport
  headless, sehingga tetikus CDP menekan ruang kosong; diperbaiki dengan viewport tinggi
  (`Emulation.setDeviceMetricsOverride`) + pemeriksaan keterjangkauan, **bukan** dengan mengubah kode
  produk.
- **A.38 — pemilih kuis yang lebih baik + penjelasan opsional setelah kuis (11 Oktober 2026)**: di editor
  materi, `<select>` telanjang diganti **`PemilihKuis`** (pencarian judul/mapel/kelas/status + baris
  `N soal · mapel · kelas · status` + tanda "Belum ada soal"). Panel klip kuis kini punya **editor
  penjelasan opsional**: `<textarea>` (≤ 5.000 karakter) + media dari pustaka unggahan materi + tombol
  kosongkan. Penjelasan disimpan di blok kuis (`isi.penjelasan = {teks, unggahan_kode}`) lewat
  `MateriService::validasiPenjelasan()` (media wajib unggahan sekolah yang sama & sudah selesai), dikirim
  satu bentuk oleh `ProgresMateriService::penjelasanBlok()` (teks + media bertanda tangan) ke daftar progres
  **dan** pembukaan blok, dan tampil di pemutar murid lewat `PenjelasanKuis` **hanya sesudah** latihan
  dikumpulkan. Isinya bukan kunci jawaban. 6 tes baru (3 Vitest editor, 2 Vitest skema, 1 Pest).
  Temuan: harness `docs/smoke-ui-materi.mjs` memakai `ol li` longgar sehingga sejak A.34 ikut menghitung pos
  peta dan membaca halaman yang salah (6 gagal, produk tidak salah) → diperbaiki jadi
  `ol.list-unstyled:not(.jelajah-daftar) > li`. Harness itu juga diperluas: guru menulis penjelasan, murid
  mengerjakan kuisnya, dan kartu `Penjelasan` dipastikan muncul **hanya sesudah** kuis dikumpulkan
  → **27/27 lulus**.
- **A.37 — peta perjalanan pakai media sungguhan, template jadi opsional (11 Oktober 2026)**: peta
  **tidak lagi menggambar adegan SVG buatan**. Latar panggung selalu media sungguhan: video latar guru
  bila ada, kalau tidak foto tema (`frontend/public/tema/`, lisensi CC0) dengan gerak zoom halus; bila
  tema tidak punya foto atau fotonya gagal dimuat, panggung memakai **gradien** tenang. Jadi tidak ada
  lagi matahari/awan/gunung SVG maupun `data-lapisan`; tes & harness membaca "bergerak" sesuai bentuk
  latar yang benar-benar dirender (foto → `jelajah-zoom`, video → `autoplay`). Di editor, panel Template
  diberi keterangan bahwa tema bersifat **opsional** (pilih "Tanpa tema" untuk daftar bagian biasa).

## 3. Kondisi git (`git status`)

Ini salinan **13 Okt 2026, sesudah A.69**; selengkapnya di bagian 0.2.

- `HEAD` = **`6811c2c`** (*"Perkuat pemeriksaan negatif yang bisa lulus tanpa bukti"* = A.67).
- `origin/main` = **`93f66ed`** → **3 commit lokal belum di-push** (A.65, A.66, A.67). Push dulu sebelum
  menutup sesi.
- **Belum dikomit: 65 entri** — 44 diubah, 3 dihapus, 18 baru, isinya putaran **A.68 + A.69** (plus dokumentasi
  A.61–A.64). Daftar per berkas ada di bagian 0.2; daftar pasti: `git status --short`.
- Putaran **A.33–A.64 sudah dikomit**; daftar berkas per putaran tidak didaftar ulang di sini supaya dokumen
  tetap ringkas — pakai `docs/laporan-pengujian.md` (bagian A.33–A.67) atau `git show --stat <commit>`.
- `docs/log-mentah/eksternal/log-claude-eksternal.md` dan `prompt-claude-eksternal.md` sudah ikut commit A.33–A.39
  (catatan mentah eksternal; isinya tidak diubah).
- Untracked yang **bukan** bagian pekerjaan: arsip/zip, `.agents/`, `.claude/`, `.DS_Store` — jangan ikut dikomit.
  `frontend/dist/` memang diabaikan, jadi hasil build untuk pengukuran tidak ikut masuk.

## 4. Batasan jujur (yang belum selesai)

- **Katalog tema perjalanan (A.34) kini empat pilihan** — "Mendaki Gunung", "Harta Karun di Pulau", dan
  "Luar Angkasa" (A.50), plus "tanpa peta". Yang masih terbatas: tiap tema bawaan memakai **berkas gambar**
  sebagai latar (video latar tetap diunggah guru sendiri), dan tiga tema baru dibuktikan pada satu ukuran
  layar (layar ponsel sempit belum diperiksa). **Keputusan soal adegan gunung
  sudah bolak-balik empat kali dan terakhir begini (A.46):** tema `gunung` memakai **berkas gambar tema di
  `frontend/public/tema/gunung.svg`**, kini **karya proyek ini** yang dilepas CC0 (8 KB, 16:9, 1600×900, 18
  warna, **satu** puncak tumpul — lihat `LISENSI.md`), dipilih setelah empat kandidat CC0 unduhan **diukur** dan
  tak ada yang lebih baik. Komponen gambar tangan `AdeganGunung.jsx` tetap ada tetapi **tidak dipakai** untuk tema mana
  pun (masukkan `'gunung'` ke `ADEGAN_DIGAMBAR` untuk memakainya lagi). Konsekuensinya: latar tema bergerak
  hanya lewat zoom halus, **tidak ada lagi awan/kabut/burung beranimasi**, dan komposisi "mendongak dari kaki
  gunung" ikut hilang bersama gambar tangan. Mengganti berkas latar cukup menukar **satu berkas**, tetapi
  berkas pengganti harus lolos pagar bentuk `gunungLatar.test.js` (tidak boleh bersisi tegak/ujung pisau). Tema/adegan lain tetap tampil sebagai gradien sampai
  medianya ditambahkan. Video latar hanya diuji dengan satu MP4 2 detik di jalur berpotongan,
  dan bukti "bergerak" dari DOM/CDP (`animationName` foto / `autoplay` video) — belum ada uji regresi
  visual/screenshot. Nama pos diganti per blok di editor (belum ada pengaturan massal), dan pos di  luar 6 fase template memakai nama generik "Pos n".
- **Penjelasan setelah kuis (A.38) menempel pada KLIP kuis, bukan kuisnya.** Bila satu kuis disisipkan di dua
  materi, tiap klip punya penjelasannya sendiri (belum ada tulis-sekali-pakai-ulang); penjelasan juga bukan
  umpan balik per murid dan tak ada notifikasi ke murid. Media penjelasan hanya dari pustaka materi itu
  (unggah lewat klip media dulu), dan belum ada uji screenshot untuk tata pemilih kuis/penjelasan. Smoke
  membuktikan penjelasan **teks** di pemutar; jalur **media** penjelasan belum diuji lewat browser.
- **Mode luring (A.33) belum PWA/service worker**: jawaban aman selama aplikasi terbuka dan murid boleh
  berpindah halaman di dalamnya, tetapi **muat ulang halaman saat internet benar-benar mati** masih gagal
  (berkas aplikasi dari server). Waktu saat luring juga perkiraan (jam monotonik hanya akurat untuk satu
  kali buka layar; sesudah itu jam dinding) — karena itu ada banner "Jam perangkat berubah" dan deadline
  tetap diputus server. Belum diuji: dua tab bersamaan saat luring, mode tim saat luring, unggah berkas
  jawaban saat luring.
- **Objektif 2B–2C (deteksi tamper/extension sisi klien) SUDAH** (A.53): `deteksiTamper.js` (MutationObserver
  + pemindai berkala + kanari + overlay dinetralkan + integritas fungsi proteksi) menyala lewat saklar
  `detect_tamper` (default mati, di luar preset `exam_mode`) dan mengirim `dom_injection`/`extension_detected`.
  **2D (sisi server) SUDAH juga** (A.54): `POST /attempt/{id}/denyut` ber-nonce (nonce dirotasi tiap kiriman,
  nonce lama → 409), dan `DenyutProteksiService::sapu()` (dipanggil `SapuPresence` tiap menit **dan**
  `MonitorService`) menurunkan `tamper_suspected` sekali saja saat denyut berhenti padahal attempt masih
  berjalan dan belum lewat deadline. Jadi 2B–2D tuntas; yang tetap belum adalah ambang yang bisa diatur guru
  (kini tetap: 30 dtk / ~100 dtk) dan uji browser sungguhan untuk denyut.
- **Papan 8 (halaman Koreksi) sudah tuntas menurut keputusan A.32**: dua kolom (antrean kiri + detail
  kanan), pemilihan baris berbasis identitas (`kunciKoreksi`/`pilihItemKoreksi`), penunjuk langkah, dan
  sisa tombol Bootstrap beres. Yang **sengaja tidak** ditiru dari mock: kolom "ketik token 6 angka" —
  token server sebenarnya `bin2hex(random_bytes(24))` (48 karakter), jadi memaksa guru mengetiknya hanya
  menambah peluang salah ketik tanpa tambahan pengaman (alasan lengkap di `laporan-pengujian.md` A.32.1b).
  Bukti layar: smoke slice 06 **28/28**.
- **Papan 12 sudah jadi**: `smoke-ui-materi` **27/27** + harness baru `smoke-ui-kuis-materi` **48/48**
  (dua viewport: 390 px & 1366 px) membuktikan kuis sisipan mode _jeda_ untuk tata **vertikal** dan
  **horizontal** — yang horizontal kini benar-benar di sisi video pada viewport ≥1200 px. Sisa batasan:
  mode _berjalan_ masih hanya diuji Pest/Vitest, dan pemutaran terbukti dengan **satu MP4 dev** (5,4 MB),
  bukan semua kodek.
- **Pratinjau editor guru belum mengikuti A.55**: kanvas `EditorMateri.jsx` masih menggambar panel kuis di
  **atas** bingkai (`.nle-kuis` — pratinjau "saat kuis masuk"), sedangkan murid sekarang melihatnya di
  bawah/samping bingkai. Label "Vertikal (panel di bawah)" / "Horizontal (panel di samping)" sudah cocok,
  kanvasnya belum.
- **Editor materi di lebar ponsel: SUDAH DIPERBAIKI di A.56** (commit `5c36b49`, harness `docs/smoke-ui-editor.mjs`
  menuntut overflow 0 px di 390/768/1366 px). Yang **belum**: kontrol editor < 44 px di layar sentuh
  (`.nle-segmen` 28 px, `.nle-tool-kecil` 25×28, `.nle-plus` 38×38) — belum diputuskan apakah itu perlu
  diubah, karena editor memang alat desktop.
- **Tata "horizontal" hanya aktif di viewport ≥1200 px** (di 1366 px kolom materi murid hanya ±640 px lebar);
  di bawah itu kedua tata menumpuk ke bawah supaya video tidak diperas. Angka tata letak A.55 diukur di dua
  viewport saja (390×844, 1366×900) lewat Chrome headless/CDP, bukan perangkat fisik.
- **P-01 paginasi baru sebagian**: hanya `SoalController` dan `MuridController` memakai `paginate()`;
  kuis, materi, koreksi, peringkat, ekspor, monitor, dan kecurangan masih memuat semua baris. Bank soal
  (A.68) memakai `paginate()` **lewat `SoalController`**, jadi batas 20 baris itu tetap dijaga server (maks 100).
- **Bank soal yang dimuat bertahap (A.68) belum punya pemeriksaan peramban khusus**: tombol “Muat 20 soal
  berikutnya” baru dibuktikan lewat tes komponen (`bankSoalLazy`, 7 lulus) + regresi `slice03`/`susun`/
  `kuis-manual`; belum ada harness yang benar-benar menekan tombol itu di Chrome.
- **Halaman Akun (A.68) belum menampilkan daftar perangkat/sesi** yang sedang masuk; ganti kata sandi
  memang mengakhiri sesi lain, tetapi tidak ada daftar yang bisa dilihat guru. Email sengaja tidak bisa
  diubah dari sana (butuh alur verifikasi tersendiri).
- **Bundel per halaman (A.69) — batas pengukurannya**: angka “6 berkas / 555,30 kB” diukur di peramban pada
  rute **tanpa sesi** (beranda tamu, `/daftar`, `/lupa-sandi`) tanpa backend, jadi ia membuktikan
  “awalnya hanya 6 berkas, sisanya menyusul per halaman”, **bukan** waktu muat atau byte terkompresi
  (angka gzip tetap dari Vite). Jalur guru ber-sesi (panel samping, halaman kuis) tidak diukur byte-nya,
  hanya dibuktikan tetap berfungsi oleh enam harness smoke. Jeda 150 ms penanda tunggu belum diperiksa
  secara visual, dan pramuat hanya berlaku untuk tautan menu (rute berparameter & halaman auth tidak).
- **Pencarian murid (A.51 + A.53) masih `LIKE %kata%`**: kata kunci tidak memakai indeks kolom, jadi
  waktunya naik seiring jumlah murid — untuk puluhan ribu murid perlu pencarian penuh atau kolom nama
  ternormalisasi yang diindeks (belum dikerjakan). Sejak A.53 ada **penyorotan kata kunci** dan tes regresi
  pada **1.200 murid** (kebenaran + batas halaman, bukan uji beban waktu tanggap). Kotak cari tetap baru ada
  di halaman **Murid** (Kelas, Mapel, Bank Soal belum), dan pencarian belum menandai data ganda.
- Tidak ada uji regresi visual/screenshot; bukti tata letak dari geometri DOM/CDP.
- **Uji beban** (waktu tanggap pada puluhan ribu baris) tetap belum ada; yang ada sejak A.53 adalah tes
  regresi **kebenaran** pada 1.200 murid + pemangkasan `per_page` — bukan pengukuran performa.
- **Smoke UI tidak ikut `verify.sh`** (butuh empat layanan hidup).
- **`docs/word/` disegarkan sebagian**: tiga berkas yang sumbernya berubah (laporan-pengujian, penjelasan-fitur, jurnal-prompt) sudah diekspor ulang lewat `python3 docs/export_docx.py`. Langkah penyegaran log mentah di dalam `export-word.sh` (`docs/export-log-sesi.py`, butuh snapshot sesi chat) **belum** dijalankan supaya transkrip byte-exact tidak berubah tanpa alasan; `log-mentah.docx` dan `catatan-demo.docx` karenanya masih dari ekspor sebelumnya (sumbernya memang tidak berubah).
- **Belum ada deploy publik dan Octane Swoole** (ekstensi `swoole` tidak ada di mesin pengembangan).
- **Mode tamu sudah diuji di peramban sungguhan (A.42)**: `docs/jalankan-smoke-ui.sh tamu` **9/9 lulus**
  (browser + CDP). Sisa batasan mode tamu: belum ada pembersihan akun tamu lama (sekolah yang sering memakai
  mode ini akan menumpuk akun tamu), pemulihan attempt **lintas perangkat** belum ada (identitas = kode
  perangkat, jadi ganti peramban/simpanan = anak baru), dan **perangkat bersama yang tidak menekan Keluar**
  masih melanjutkan akun tamu sebelumnya (komputer lab sebaiknya tetap diminta menekan Keluar antar anak).
- Lima soal sisa `SMOKE-` (id 57–60, 150) masih tertahan di bank soal dev karena sudah dipakai/dijawab.

## 5. Cara melanjutkan

```bash
cd "folder tanpa judul 2/lomba_m"
./nyalakan-local.sh                          # nyalakan Redis+backend+realtime+frontend (TANPA hapus data)
./nyalakan-local.sh status                   # cek kesehatan keempatnya · ./nyalakan-local.sh stop saat selesai
./verify.sh                                  # gerbang wajib: semua cek tanpa layanan
npm --prefix frontend run build              # build produksi
# Cara menguji GUI langsung: satu perintah per harness. Runner memakai layanan yang
# sudah hidup dari nyalakan-local.sh (dan menyalakan/mematikan sendiri yang belum ada),
# jadi urutannya bebas dan tidak ada port yang diperebutkan:
docs/jalankan-smoke-ui.sh pengaturan        # halaman akun + setelan ulangan di tiap kuis (12/12)
docs/jalankan-smoke-ui.sh slice03           # bank soal + editor kuis (9/9)
docs/jalankan-smoke-ui.sh slice04           # kerjakan + hasil, dua halaman yang kini dimuat malas (18/18)
docs/jalankan-smoke-ui.sh susun             # editor kuis (44/44)
docs/jalankan-smoke-ui.sh nav / mobile / sidebar / palet-sidebar   # tata letak & menu (14/14 · 16/16 · 9/9 · 58/58)
docs/jalankan-smoke-ui.sh layar / tim / impor-murid               # 34/34 · 31/31 · 29/29
docs/jalankan-smoke-ui.sh mapel / avatar / auth                   # 32/32 · 44/44 · 36/36 (auth butuh MAIL_MAILER=log)
docs/jalankan-smoke-ui.sh soal-berubah / setelan-sesi / kuis-materi # 19/19 · 23/23 · 48/48
docs/jalankan-smoke-ui.sh tamu / murid / kuis-manual / slice06     # 9/9 · 18/18 · 15/15 · 28/28
docs/jalankan-smoke-ui.sh editor            # editor materi: tidak melebar di 390/768/1366 px
# Daftar lengkap 30 harness berhitung + hasilnya: docs/laporan-pengujian.md A.66.1
docs/jalankan-smoke-materi.sh                 # pemutar materi + kuis sisipan (backend+vite+Chrome sendiri)
docs/jalankan-smoke-perjalanan.sh             # peta perjalanan bertema + kenaikan pos/tingkat + pendaratan pos di 3 latar (sendiri)
for s in nav susun slice03 slice04 slice05 slice06 slice07 luring; do node docs/smoke-ui-$s.mjs; done
node docs/smoke-http-fitur.mjs               # butuh backend + realtime
./docs/export-word.sh                        # segarkan 6 .docx + log mentah
python3 docs/export_docx.py docs/<berkas>.md docs/word/<berkas>.docx   # konversi Word saja (tanpa log mentah)
```

**Catatan penting untuk sesi agen (bukan untuk pengguna):** layanan yang dinyalakan `./nyalakan-local.sh`
tidak bertahan antar-perintah SYNC milik alat — shell perintah dibersihkan setelah selesai, jadi daemon
nohup-nya ikut mati. Karena itu jalankan penyalaan layanan dan harness **di dalam satu perintah**
(`./nyalakan-local.sh && docs/jalankan-smoke-ui.sh tamu`). Di terminal pengguna sendiri, `nyalakan-local.sh`
bertahan normal dan runner smoke memakai layanan itu apa adanya tanpa mematikannya.

Tema perjalanan sekarang **tiga** (Mendaki Gunung, Harta Karun di Pulau, Luar Angkasa) dan bebas dari
"pos di udara": rutenya per tema (`RUTE_TEMA` di `sections/material/perjalanan.js`) dan dijaga
`__tests__/theme/latarTema.test.js`. Menambah tema keempat cukup: satu entri katalog di backend, satu berkas
latar `public/tema/*.svg` **dengan `id` pada tiap benda yang diinjak pos**, satu entri `RUTE_TEMA`, satu baris
di `FOTO_ADEgan` — lalu jalankan pagar latar (merah kalau rute dan gambarnya tidak cocok).

Langkah berikutnya — urutannya ada di **papan pending 0.6**, ringkasnya: **(1) commit kecil-kecil + push**
pekerjaan yang menumpuk (A.61–A.69), **(2) deploy publik** dengan link yang bisa dibuka (deadline 15 Okt 2026
15.30 WIB), **(3) segarkan `docs/word` + jurnal prompt + log mentah** sebelum dikumpulkan, lalu **(4)**
pekerjaan rapi-rapi: menyelaraskan pratinjau kanvas editor dengan posisi panel A.55, **A.57** (tema “Harta
Karun di Pulau” jadi POV dari atas — tanyakan dulu soal tema angkasa), target sentuh editor, perluasan
pencarian ke Kelas/Mapel/Bank Soal, ambang denyut proteksi yang bisa diatur guru + uji denyut di peramban,
serta dua jalur GUI yang masih gelap (mode `hasil` Layar kelas, moderasi avatar pada antrean panjang).
Deteksi tamper 2B–2D sudah tuntas; jangan dikerjakan lagi.

## 6. A.61 — kebijakan "soal boleh diperbaiki di tengah ulangan" (13 Oktober 2026)

Satu perubahan kebijakan yang menyentuh tiga hal yang diminta pemilik produk sekaligus. Ringkasnya:

1. **Soal boleh diubah saat kuis sedang berjalan**, tetapi hanya **isinya** (teks/opsi/media). Kunci
   jawaban, skor, dan jenis soal tetap ditolak 422 selama kuis berjalan. Murid yang sedang mengerjakan:
   layar pengerjaan memeriksa **cap versi soal** tiap 20 detik (dan saat kembali ke tab) →
   `GET /v1/attempt/{attempt}/versi-soal`; kalau berubah, spanduk **"Guru memperbarui soal"** muncul dan
   payload soal dimuat ulang lewat `POST /kuis/{kuis}/mulai` yang sama. **Jawaban tidak hilang** karena
   jawaban hidup di state `perubahan` + cadangan perangkat (Zustand persist) — bukan di payload soal.
2. **Sidebar tanpa scrollbar** — sudah ada sejak 12 Okt (`.papan-nav` `overflow: visible` +
   `align-self: flex-start`); diverifikasi ulang oleh `docs/jalankan-smoke-ui.sh sidebar` (**9/9**).
3. **Susun soal dibuat spesifik per soal** — di editor, pemilih **jenis soal jadi langkah 1** (isian di
   bawahnya hanya milik tipe itu), **ringkasan "Kunci jawaban soal ini" ada di bawah soal**, dan total
   susunan ("X soal · Y poin") pindah ke **bawah daftar** di panel Susunan kuis.

Cara mengulang verifikasi: `docs/jalankan-smoke-ui.sh soal-berubah` (harness **baru**, 19/19),
`docs/jalankan-smoke-ui.sh kuis-manual` (15/15), `… sidebar` (9/9), lalu
`./vendor/bin/pest tests/Feature/AttemptTest.php tests/Feature/BankSoalTest.php` (39 lulus) dan
`npm run check` + `npx vitest run` (727 tes). Rincian: `docs/laporan-pengujian.md` bagian **A.61**.

**Tafsir yang perlu dikonfirmasi pemilik produk:** "hasil akhir jawaban di bawah, bukan di bawah tiap
soal" diterapkan sebagai (a) ringkasan kunci di bawah soal pada editor dan (b) total susunan di bawah
daftar. Kalau yang dimaksud layar lain (mis. halaman hasil murid atau tabel bank soal), yang dipindah
hanya letak ringkasannya — mekanisme versi & penolakan kunci/skor tidak terpengaruh.

## 7. A.63 — layar kelas, mode tim, dan impor murid diuji di peramban (13 Oktober 2026)

Tiga jalur yang sudah punya uji backend tetapi **belum pernah dibuka dari peramban**, kini punya harness GUI
sendiri lewat runner yang sama (`docs/jalankan-smoke-ui.sh`). Sapu A.62.6 memuat 23 harness berhitung dan
ketiganya memang tidak ada di daftar itu.

| Harness | Pemeriksaan | Inti yang dibuktikan |
| --- | --- | --- |
| `layar` (**baru**) | **34/34** | Dua peramban sekaligus: guru menyiarkan **pengumuman**, lalu **sorot satu soal** (isi soalnya ikut sampai), lalu **mengosongkan layar** — perangkat murid menyusul tanpa memuat ulang. Saklar `layar_guru` mati diucapkan terus terang dan benar-benar mengunci pemilih mode + tombol simpan; mode yang butuh bahan menolak disimpan tanpa bahannya; murid `PUT` layar **403**, `GET`-nya tanpa bahan pengendali; panel sorotan tanpa kunci jawaban. |
| `tim` | **31/31** | "Bagi otomatis" membagi **seluruh** murid kelas, murid benar-benar melihat nama tim & anggotanya, susunan tetap sama setelah halaman dimuat ulang, hapus/buat tim melaporkan hasilnya, murid dari tim yang dihapus dilaporkan belum bertim, kunci `mode_tim` bisa dinyalakan untuk kuis itu. |
| `impor-murid` | **29/29** | Judul kolom lazim guru diterima ("Nama Lengkap", "Nama Kelas", "Nomor Induk Siswa") tanpa 422, tabel galat menyebut **nomor baris** + sebabnya sebagai `role=alert`, baris yang ditolak **tidak** meninggalkan murid di server, impor bersih dilaporkan sebagai status, berkas Excel (BOM + pemisah `;`) jalan lewat API. |

Cara mengulang: `docs/jalankan-smoke-ui.sh layar` · `… tim` · `… impor-murid` (backend :8000, vite :5173,
realtime :4000, Chrome :9333 — runner menyalakan sendiri layanan yang belum hidup). Jumlahnya **94
pemeriksaan lulus, 0 gagal**, semuanya exit 0. Rincian + batasan jujur: `docs/laporan-pengujian.md` **A.63**.

Catatan untuk sesi berikutnya: `layar` mengubah kunci `layar_guru` di tengah jalan dan **mengembalikannya di
`finally`** bersama kuis + soal ujinya, jadi aman dijalankan berulang di DB dev. Yang masih gelap:
**mode `hasil`** ("Instruksi setelah ulangan") belum pernah dibuka di peramban, dan sorotan baru diuji dengan
**satu murid**. Yang dibuktikan juga "murid menyusul", bukan "lewat SSE" — kontrak SSE-nya dijaga uji backend
`Slice10LayarTest`.

## 8. A.64 — tiga celah cakupan GUI ditutup (13 Oktober 2026)

Audit `frontend/src/routes.js` melawan seluruh `docs/smoke-ui-*.mjs` menemukan tiga jalur yang belum punya bukti
peramban, dan ketiganya kini punya harness sendiri (berurutan dari yang paling murah):

| Harness | Pemeriksaan | Inti yang dibuktikan |
| --- | --- | --- |
| `mapel` (**baru**) | **32/32** | Halaman terjangkau dari sidebar; nama kosong/pendek & kode berspasi ditolak di klien dengan pesan di bawah isiannya; **nama mapel yang sudah dipakai** menjelaskan sebabnya di bawah isian nama (bahasa Indonesia); kode dinormalkan server jadi huruf besar; ubah & hapus lewat dialog konfirmasi yang menyebut dampaknya dan bisa dibatalkan; satu muat halaman memeriksa sesi sekali; fokus jendela tidak menembak permintaan baru |
| `avatar` (**baru**) | **44/44** | Tiga peran (pemilik, pelapor, guru): berkas bukan gambar & >2 MiB ditolak di klien; unggahan sah tampil sebagai hasil encode ulang **256×256**; "kembalikan ke bawaan" benar-benar menghapus; satu laporan belum menyembunyikan, laporan berulang anak yang sama tidak menambah hitungan, dan setelah beberapa anak berbeda melapor avatarnya berhenti tampil bagi murid lain **sementara pemiliknya masih melihatnya**; guru memulihkan (hitungan direset) & menghapus; murid 403 pada jalur guru |
| `auth` (**baru**) | **36/36**, 0 dilewati | Validasi formulir yang benar-benar menahan pengiriman; daftar → langsung masuk → `/perlu-verifikasi`; **gerbang akun pending** menahan `/` dan `/kuis`; anti-enumerasi `/lupa-sandi` (jawaban identik untuk email terdaftar & tidak); **tautan verifikasi & reset dari "email" benar-benar dibuka**; sandi baru berlaku, sandi lama 422; tautan sekali pakai; token palsu **tidak** mengaku berhasil |

**Perbaikan produk yang ketahuan harness `mapel`** (dan cacat yang sama di halaman Murid): nama/kode yang
ditolak server dulu hanya muncul sebagai toast berbahasa Inggris. Kini `SimpanMapelRequest` dan
`SimpanMuridRequest` punya `messages()` berbahasa Indonesia, dan `HalamanMapel`/`HalamanMurid` memetakan galat
per kolom ke isiannya — sama seperti halaman Kelas. Harness `murid` dijalankan ulang sebagai regresi
(**18/18**).

**Penting untuk sesi berikutnya — cara menjalankan `auth`:** tautan email hanya bisa dibaca harness kalau
backend-nya memakai mailer `log`. Itu sebabnya `docs/jalankan-smoke-ui.sh` menyalakan backend-nya sendiri dengan
`MAIL_MAILER=log` **khusus harness `auth`** (tanpa itu, tiap jalan smoke mengirim email asli lewat SMTP Gmail di
`backend/.env`, dan tautannya tetap tidak terbaca). Kalau backend :8000 sudah hidup lebih dulu, runner
mencetak peringatan dan harness melaporkan **DILEWATI** untuk dua langkah email — matikan backend itu dulu
kalau ingin alur penuhnya.

Cara mengulang: `docs/jalankan-smoke-ui.sh mapel` · `… avatar` · `… auth` · `… murid` (regresi), lalu
`./verify.sh`. Rincian + batasan jujur: `docs/laporan-pengujian.md` **A.64**. Sisa yang masih gelap: mode
`hasil` pada `layar`, dan moderasi avatar pada antrean panjang.

## 9. A.65 — pita palet panel samping tidak putus (13 Oktober 2026)

Permintaan: *"panjangkan warna palet yang sidebar, jangan putus."* Terukur dan memang nyata: panel 260 px
hanya berwarna sepanjang isi menunya (736 px). Di `/murid` tepi kiri berwarna sampai y=805 sementara kolom
konten berakhir di y=4391 — **3.586 px tepi kiri kosong**, dan `elementFromPoint(8, 898)` mengembalikan
`DIV.kerangka-badan`. Halaman pendek pun bersisa 95 px (`/beranda`).

Perbaikan: satu berkas CSS, tiga suntingan di `frontend/src/theme/theme.css` — `.kerangka-badan-menu` jadi
`align-items: stretch` + `min-height: calc(100vh - var(--tinggi-kepala))`, dan `.papan-nav` jadi
`align-self: stretch`. Kebijakan 12 Okt (tanpa gulir sendiri, panel ikut tergulir) **tidak** diubah; yang
memanjang hanya latarnya, dan isi menu tetap menempel di atas.

Bukti: harness baru `docs/smoke-ui-palet-sidebar.mjs` **58/58** (5 halaman guru × terang & gelap, 1440×900),
selisih pita vs kolom **0 px** di semua pengukuran, warna piksel sama dengan `var(--panel)` di kedua tema.
Regresi: `sidebar` 9/9 · `nav` 14/14 · `mobile` 16/16 (1 dilewati dengan sadar) · `./verify.sh`
**SEMUA HIJAU**. Rincian + batasan jujur: `docs/laporan-pengujian.md` **A.65**.

Cara mengulang: `docs/jalankan-smoke-ui.sh palet-sidebar`. Belum diukur: peran murid/tamu (harness masuk
sebagai guru) dan lebar < 992 px (panelnya memang digantikan laci, diuji oleh `mobile`).

## 10. A.66 — sapuan GUI seluruh fitur rawan (13 Oktober 2026)

Permintaan: *"tes gui fitur fitur yang rawan rusak"*. Dijalankan **30 harness GUI** (semua berkas
`docs/smoke-ui-*.mjs` kecuali sonde `cdp` dan berkas HTTP murni) lewat `docs/jalankan-smoke-ui.sh <nama>` di
peramban sungguhan, saat `./nyalakan-local.sh` hidup: **777 pemeriksaan, semuanya lulus, exit 0**. Plus
`node docs/audit-ui.mjs` pada 44 halaman (guru+murid × hp/laptop) dalam **terang dan gelap**: keduanya
**BERSIH** (`{}`). `./verify.sh` sesudahnya **SEMUA HIJAU**.

**Temuan nyata: dua pemeriksaan mati di `docs/smoke-ui-mobile.mjs`** (bagian "layar kuis di ponsel") yang
selalu melaporkan LULUS tanpa mengukur apa pun — dulu bahkan beralasan "tidak ada kuis terbit di DB dev":
(1) penyaring status memakai `'terbit'`, padahal API (`StatusKuis`/`KuisResource`) memakai **`publikasi`**;
(2) `d.data ?? []` selalu kosong karena `/api/v1/kuis` mengembalikan **larik telanjang** (sonde: 200 · 122
kuis · publikasi 84 · draf 19 · arsip 19). Sesudah diperbaiki pemeriksaan itu benar-benar mengukur dan lulus:
`+0px · elemen menembus 0 · kuis #248`.

Cara mengulang: `./nyalakan-local.sh` lalu `for h in …; do docs/jalankan-smoke-ui.sh "$h"; done` (daftar lengkap
ada di `docs/laporan-pengujian.md` A.66.1). Untuk `auth`, matikan backend dulu supaya runner menyalakannya
dengan `MAIL_MAILER=log` — kalau tidak, langkah lewat email dicetak `DILEWATI`.

Belum diukur pada putaran ini: perangkat sentuh fisik, jalur penjelasan *media* di pemutar materi, dan
`docs/smoke-http-fitur.mjs` (243 pemeriksaan HTTP, bukan GUI).

## 11. A.67 — audit pemeriksaan mati di seluruh harness GUI (13 Oktober 2026)

Lanjutan A.66. Empat pola kerusakan dicari ke semua harness: (1) string status yang tidak ada di enum backend,
(2) amplop jawaban salah (larik telanjang vs `{data}` vs paginasi), (3) pemeriksaan negatif ber-cadangan
`?? []`, (4) objek penjaga yang bisa `null` pada pemeriksaan negatif. Fakta kunci untuk pola (2): **hanya dua**
endpoint berpaginasi di seluruh `backend/app` — `/v1/soal` dan `/v1/murid` (`grep -rn "paginate(" backend/app`).

Temuan & tindakan: `smoke-ui-slice07.mjs` negasi "catatan keluar dari antrean menunggu" kini wajib
`status === 200` + larik sungguhan + jumlah menunggu **turun tepat satu**; `smoke-ui-kuis-materi.mjs` lima
negasi (`m?.… ?? []`, `nilai.… ?? []`) kini GAGAL bila panel tak terukur / daftar ukur hilang;
`audit-ui.mjs` mencetak kuis yang diaudit (`kuis uji: #248 (“Smoke layar 130244”)`) supaya jaring pengaman
`?? 1` tidak lagi tak terlihat. Yang diperiksa dan dinyatakan **sah**: `'lokal'/'terkirim'` (`luring`,
konstanta di `riwayatJawaban.js`), `'perlu_tinjau'/'dinilai'` (`slice06`), negasi `slice05` (dijaga field lain),
negasi "0 permintaan" `kelas` (ada kontrol positif), dan 10 pembacaan `/v1/murid` di seluruh harness.

Bukti sesudah perbaikan: `docs/jalankan-smoke-ui.sh slice07` **21/21** · `… kuis-materi` **48/48** ·
`node docs/audit-ui.mjs kuis` **BERSIH `{}`** — semuanya exit 0. Kontrol negatif A/B (dua salinan di `/tmp`
dengan respons tak terpakai yang sama): klaim lama **21/21 lulus** (buta) vs klaim baru **20/21 · exit 1**.
Rincian + batasan jujur: `docs/laporan-pengujian.md` **A.67**.
## 12. A.68 — bank soal dimuat bertahap, `/pengaturan` jadi halaman akun (13 Oktober 2026)

Dua permintaan pemilik produk dikerjakan bersamaan.

**(1) Bank soal tidak lagi memuat semua.** Daftar soal (Bank Soal **dan** panel pilih-soal di langkah 2 editor
kuis) sekarang 20 baris per permintaan (`useInfiniteQuery`) dengan tombol “Muat 20 soal berikutnya” yang
**menambahkan** baris, plus kotak **Cari soal** yang menyaring di server (`q`, jeda 300 ms). Yang ikut
diperbaiki: soal yang sudah dicentang tetapi tidak ada di halaman yang sedang tampil dulu terhitung 0 poin dan
lolos dari pemeriksaan “semua soal yang dipilih aktif”; sekarang info soal yang pernah dilihat dicatat di klien
(`catatanSoal`) dan dipakai menghitung ringkasan langkah 3.

**(2) Setelan ulangan pindah ke kuisnya; `/pengaturan` kembali jadi akun.** Panel setelan (anti-cheat, batas
percobaan, peringkat, layar guru, siswa tamu, …) kini ada di **halaman detail kuis** (`/kuis/:slug`) sebagai
`sections/quiz/PanelSetelanUlangan.jsx` — tanpa pemilih ulangan, jadi tidak ada cara salah memilih. Halaman
`/pengaturan` berisi **akun**: nama tampilan, ganti kata sandi (sandi lama wajib; sesi lain diakhiri, sesi yang
dipakai tetap hidup), tema, dan pintasan avatar. Rutenya pindah keluar dari gerbang guru (kini milik semua
peran) dan menunya bernama **Akun**. `HalamanPengaturan.jsx` + `lingkup.js` + tesnya dihapus; tautan lama di
editor kuis, Layar kelas, dan Kelola tim menunjuk halaman kuisnya. Backend baru: `PUT /v1/akun` dan
`PUT /v1/akun/sandi` (+ limiter `sandi` 6/menit per akun, `AkunService`, `backend/tests/Feature/AkunTest.php`).
Email sengaja tidak bisa diubah dari sana (butuh alur verifikasi tersendiri).

Bukti: `./verify.sh` **SEMUA HIJAU** (Pest 357 + Redis 9, Pint bersih, checkJs 0, ESLint 0 error/2 peringatan
lama, Vitest **79 berkas / 752 tes**, realtime 20). Tes baru: `AkunTest` (10), `bankSoalLazy` (7),
`setelanUlangan` (4), `halamanAkun` (6), `validasiAkun` (7).

Bukti peramban (Chrome sungguhan, layanan sudah hidup): `docs/jalankan-smoke-ui.sh pengaturan` **12/12** (halaman
akun + alamat **slug** `/kuis/gitbvewc` membuka kuis yang benar + panel setelan di halaman itu, saklar diubah
lalu dikembalikan), `slice03` **9/9**, `susun` **44/44**, `kuis-manual` **15/15**. Otorisasi slug:
`SlugKuisTest` **2 lulus** (kuis guru lain tetap 403 di jalur baca/ubah/hapus).

**Yang belum:** harness peramban khusus untuk tombol “Muat 20 soal berikutnya” (baru dibuktikan tes komponen);
halaman akun belum menampilkan daftar sesi; belum ada kontrol negatif untuk tes baru. Rincian:
`docs/laporan-pengujian.md` **A.68**.

## 13. A.69 — bundel frontend dipotong per halaman (13 Oktober 2026)

**Permintaan:** “potong bundel frontend per halaman dengan React.lazy + Suspense supaya aplikasi tidak memuat
semua kode sekaligus.” Sebelumnya `App.jsx` mengimpor semua halaman secara statis → `npm run build` mengeluarkan
satu berkas **923,63 kB (262,06 kB gzip)**.

**Yang diubah:** `frontend/src/halaman.js` (baru) = satu daftar pemuat halaman (`React.lazy` untuk 27 halaman +
peta pramuat jalur menu), `shared/ui/MemuatHalaman.jsx` (baru) = penanda tunggu `Suspense`, `App.jsx` hanya
mengimpor statis kerangka ulangan + Beranda + halaman masuk + 404, dan `Suspense` dipasang **di dalam**
`KerangkaUmum`/`KerangkaAuth` (area konten) sehingga menu, bilah atas, dan kaki halaman tidak ikut hilang selama
modul diunduh. Tautan panel samping memulai unduhan saat disorot/difokus (`pramuatHalaman`), dan penanda tunggu
baru muncul setelah 150 ms lalu memudar masuk (tanpa kedip pada perpindahan normal; gerak dihentikan bila
`prefers-reduced-motion`).

**Bukti:** `npm run build` → bundel awal **555,26 kB / 176,35 kB gzip** menurut `index.html` (skrip utama + lima
`modulepreload`) = **−39,9% mentah / −32,7% gzip**; 54 berkas JS, mis. `HalamanKerjakan` 41,57 kB (14,27 gzip)
baru diunduh saat ulangan dibuka. Diukur ulang di peramban sungguhan (bangun produksi + `vite preview` + Chrome
ber-CDP, harness baru `docs/ukur-bundel-peramban.mjs`): membuka app **6 berkas / 555,30 kB** lalu beranda tampil;
tekan “Daftar” **2 berkas kecil** menyusul tanpa muat ulang; `/lupa-sandi` 2 berkas kecil. `npm run check` exit 0,
ESLint 0 error (2 peringatan lama), Vitest **80 berkas / 760 tes**. Peramban sungguhan: `pengaturan` **12/12**,
`susun` **44/44**, `slice04` **18/18**, `nav` **14/14**, `kuis-materi` **48/48**, `slice07` **21/21** — semuanya
exit 0 (dua yang terakhir menyentuh halaman malas terberat: editor materi dan Monitor Ulangan).
Backend/realtime tidak disentuh, jadi Pest/Pint/Redis tidak dijalankan ulang.

**Yang belum:** pengukuran peramban hanya pada rute tanpa sesi (beranda tamu, `/daftar`, `/lupa-sandi`) dan
melaporkan ukuran mentah, bukan waktu muat atau byte terkompresi; jeda 150 ms penanda tunggu tidak diperiksa
secara visual; belum ada kontrol negatif untuk tes baru. Rincian: `docs/laporan-pengujian.md` **A.69**.

## 14. A.70 — patch kinerja & rekam diri dari luar repo (13 Oktober 2026)

**Permintaan:** *“cek file patch ini apakah relevan jika ya apply”* — dua berkas `backend.patch` (8 berkas) +
`frontend.patch` (1 berkas), datang sebagai `files (68).zip` dari luar repo. Isinya diperiksa baris per baris
dulu (kecocokan konteks `git apply --check`, daftar kolom `KOLOM_RINGAN` dibandingkan dengan seluruh kolom tabel
`attempts` di migrasi, dan siapa saja pembaca `snapshot_soal` di `backend/app`), baru diterapkan — sesuai aturan
AGENT.md bahwa pekerjaan luar repo tidak boleh dijadikan bukti tanpa diverifikasi ulang di sini.

**Yang dikerjakan (10 berkas):**

- **Kueri berulang** — `AttemptService`/`AttemptController`: soal hidup dimuat **sekali** lalu dibagi ke
  `payloadSoal()` + `versiSoal()` (dulu 2 kueri identik per permintaan; diukur 2 → 1 untuk attempt 10 soal);
  kolom yang diambil dipersempit ke `id, konten, updated_at`. Jalur mulai: soal kuis dimuat sekali (dulu 4 kueri).
- **Impor murid** — email akun non-murid dimuat sekali per berkas (dulu satu `SELECT` per baris CSV) dan hash
  acak dihitung **sekali per impor** (dulu `argon2id` per baris → impor ratusan murid rawan timeout).
- **`Attempt::scopeTanpaSnapshot()`** dipakai `MonitorService` + `EksporNilaiService`: berhenti menarik
  `snapshot_soal` (JSON seluruh soal **+ kunci**) di dua jalur yang tidak membacanya. **Migrasi baru yang
  menambah kolom `attempts` wajib memperbarui `KOLOM_RINGAN`.**
- **`PenilaiAiService`** memakai `->afterCommit()` (worker tidak lagi bisa membaca attempt sebelum transaksi
  `tutup()` commit → saran AI tidak hilang diam-diam).
- **`config/queue.php`** — `retry_after` koneksi `database` 90 → 180 detik (masih bisa ditimpa `env`).
- **Rekam diri lampiran (`UnggahLampiran.jsx`)** — dua bug: durasi selalu terkirim **0 detik** (state basi di
  dalam `onstop`, kini lewat ref) dan keluar dari soal saat merekam tidak membersihkan apa pun (kini perekam +
  jalur kamera/mikrofon dimatikan dan rekaman yang ditinggalkan **tidak** diunggah).

**Bukti:** `./verify.sh` **SEMUA HIJAU** (Pest 357/3356 · Redis wajib 9/65 · Pint bersih · checkJs · ESLint 0
error · Vitest **81 berkas / 763 tes** · realtime). Tes baru `unggahLampiranRekam.test.jsx` **3/3 lulus**, dan
**kontrol negatifnya 3/3 MERAH** saat dijalankan atas kode sebelum perbaikan (`expected +0 to be 3`, jalur
kamera `not called`, `expected +0 to be 60`). Satu perbaikan ikutan: Pint menambahkan
`use Illuminate\Support\Collection;` di `AttemptService`. Commit: `b1025b4` + `90512a2` (belum di-push).

**Cara mengulang:** `./verify.sh`; `npx vitest run src/__tests__/sections/attempt/unggahLampiranRekam.test.jsx`.
Rincian + batasan jujur: `docs/laporan-pengujian.md` **A.70**.

## 15. A.71 — log mentah diganti dari sesi asli + folder `docs/` dirapikan (13 Oktober 2026)

**Permintaan:** *“`sesi-2026-10-05-transkrip.md` kau ganti dengan ini sebagai log penuh, buatkan log benar-benar
[benar], ringkas, dan rapihin folder docs (ingat sesi-mu juga ditambahkan).”* Lampirannya salinan sesi asli
proyek ini: **412 MB / 539 pesan** (log yang tersimpan di repo sebelumnya masih snapshot 10 Okt: 76 MB / 207
pesan). Jawaban pilihan pengguna: perapian **aman** (tidak memindahkan harness/skrip/laporan) dan log ditulis
**utuh** + **indeks ringkas**.

**Yang dikerjakan:**

- **`docs/export-log-sesi.py` ditulis ulang** — berkas sesi dibaca **per pesan** (`JSONDecoder.raw_decode`,
buffer 1 MB), jadi sesi 412 MB aman di mesin 8 GB (puncak terukur **270 MB**, 3 sesi dalam 15,6 detik).
  Tanpa argumen ia mengekspor **semua** sesi; satu folder per sesi berisi `chat-messages.json.gz` (byte-exact),
  `transkrip.md` (utuh), `info.json` (angka + md5), dan `docs/log-mentah/README.md` sebagai indeks yang
  dibuat ulang tiap ekspor.
- **Struktur `log-mentah/`:** tiga folder sesi (`2026-10-05T07-39-24.876Z`, `2026-10-12T13-01-29.434Z`,
  `2026-10-13T12-30-29.489Z`) + `tangkapan/` (7 potret bukti) + `eksternal/` (prompt/log AI luar repo) +
  `README.md`. Dua berkas lama dihapus karena digantikan versi lebih lengkap.
- **`docs/README.md` baru** = daftar isi folder docs (dokumen panitia, laporan, log mentah, runner + daftar
  harness, alat ekspor, aturan).
- **Rujukan path diperbarui** di `AGENT.md`, `00-index.json`, `docs/word/AGENT.md`, `docs/jurnal-prompt.md`,
  `docs/laporan-pengujian.md`, handoff ini, dan `docs/export-word.sh` (`log-mentah.docx` = gabungan transkrip
  **semua** sesi).

**Bukti:** `gzip -dc <sesi>/chat-messages.json.gz | md5` **sama** dengan `info.json` untuk dua sesi (byte-exact,
termasuk sesi 412 MB) · `bash -n docs/export-word.sh` OK + uji logika penggabungan (2 folder digabung, kasus
kosong dilewati) · `grep` path lama di luar `log-mentah/` = **0 sisa** · sintaks dua skrip Python diperiksa.
Angka: `chat-messages.json` 412.229.403 B · `.gz` 68.581.188 B · `transkrip.md` 26.819.105 B. Berkas aplikasi
**tidak disentuh**, jadi `./verify.sh` tidak dijalankan ulang.

**Cara mengulang:** `python3 docs/export-log-sesi.py` (lalu periksa md5 dari `info.json`).
Rincian + batasan jujur: `docs/laporan-pengujian.md` **A.71** (transkrip sesi ini masih snapshot, `log-mentah.docx`
belum diekspor ulang, repo bertambah ≈95 MB).

## 16. A.72 — pekerjaan A.61–A.69 dikomit (13 Oktober 2026)

**Permintaan:** *“Commit 63 entri working tree (A.61–A.69) kecil-kecil mengikuti gaya riwayat yang ada.”* Enam
commit, satu tema satu commit, urut dari backend ke frontend ke dokumen:

| Commit | Tema |
| --- | --- |
| `1a2db5f` | slug acak sebagai alamat kuis (backend: migrasi · `Kuis` · `KuisService` · factory · dua resource · `SlugKuisTest`) |
| `9192eaf` | slug dipakai seluruh layar kuis + `kunciKuisSah` + perbaikan pil saring Beranda/Monitor dan CSS-nya |
| `7e2001c` | bank soal bertahap (`per_page`/`q` di `SoalController`, `paramSoal`, `useInfiniteQuery`, `catatanSoal`) |
| `7fc4f57` | `/pengaturan` jadi halaman akun + setelan ulangan pindah ke kuisnya (`AkunService`, `PanelSetelanUlangan`, penghapusan `HalamanPengaturan`/`lingkup`) |
| `d60cc1e` | bundel per halaman (`halaman.js`, `MemuatHalaman`, `App.jsx`, dua kerangka, tes + harness ukur bundel) |
| `95a1a88` | tiga bagian baru di `penjelasan-fitur.md` |

**Bukti:** `git status --short` **kosong** sesudah commit terakhir; keenam commit diperiksa tidak memuat
`*.zip`/`DS_Store`/`.agents/`/`.claude/`/`node_modules`; `./verify.sh` dijalankan pada pohon **sesudah** semua
commit dan **SEMUA HIJAU (exit 0)** — Pest 357/3356 · Redis wajib 9/65 · Pint · checkJs · ESLint 0 error ·
Vitest 81 berkas/763 tes · realtime.

**Keterikatan yang perlu diketahui sesi berikutnya:** `App.jsx` membawa dua putaran (rute akun A.68 + impor
malas A.69) dan `theme.css` membawa perbaikan pil saring + blok `.memuat-halaman`, jadi commit `7fc4f57`
sendirian belum bisa dijalankan (ia menghapus `HalamanPengaturan.jsx` yang masih diimpor `App.jsx` versi commit
itu) dan `d60cc1e` yang menutupnya. Yang diverifikasi hijau adalah pohon terakhir, bukan tiap titik tengah.

**Sisa:** `git push` (16 commit tertinggal). Rincian: `docs/laporan-pengujian.md` **A.72**.

## 17. A.75 — beranda admin jadi monitor sekolah + wewenang admin atas akun guru/murid (14 Oktober 2026)

**Permintaan:** bagian kedua pesan panjang pemilik produk (lihat A.73): admin sekolah butuh **monitor skala
sekolah** dan **wewenang mengubah email/sandi murid & guru**. Keputusan yang sudah dikunci di A.73: monitor
**menempel di beranda admin** (bukan rute baru) dan guru **tidak** ikut mendapat wewenang itu — mengganti
email/menyetel sandi akun orang lain adalah cara mengambil alih akun, sedangkan guru tetap boleh mengelola
**data** murid (`MuridPolicy`), bukan kredensialnya.

**Yang dikerjakan:**

- **Section backend baru `App\Sections\Admin`** — `MonitorSekolahService` (satu panggilan `GET
  /v1/admin/monitor` mengisi seluruh beranda: 8 kartu angka, keadaan kelas, kuis berjalan, 8 baris audit;
  semuanya kueri agregat, bukan per baris) dan `AkunSekolahService` (daftar akun berpaginasi + tiga mutasi:
  ubah email · setel sandi · ubah status).
- **Pagar mutasi sensitif (AGENT.md #6) dipakai utuh**: policy `AkunSekolahPolicy` (admin saja; tidak bisa
  akun sendiri, tidak bisa admin lain, akun tamu ditolak) + alasan tertulis min 10 karakter + token konfirmasi
  sekali pakai bertujuan baru `kelola_akun` (token koreksi nilai tidak bisa dipakai di sini, dan sebaliknya) +
  audit append-only. Email baru **langsung terverifikasi**; setel sandi & penangguhan **mengakhiri seluruh sesi
  akun itu**; sandi baru tidak pernah muncul di respons maupun audit; status hanya `aktif`/`suspended`.
- **Frontend baru `src/sections/admin/`** — `api.js` (Zod + `paramAkun()` yang tidak mengirim saringan kosong),
  dua modul hitungan murni (`dasborAdmin.js`, `akunSekolah.js`), `BerandaAdmin.jsx`, `HalamanAkunSekolah.jsx`
  (panel dua langkah: minta token → simpan).
- **Penyambungan**: rute `/admin/akun` + penjaga `HanyaAdmin` di `App.jsx`, halaman malas + masuk peta pramuat,
  grup menu **Admin sekolah** di `KerangkaUmum.jsx`, dan beranda `Beranda.jsx` me-render `BerandaAdmin` untuk
  peran `admin` (dimuat malas — bundel awal tidak tumbuh; dibuktikan lewat `npm run build`).

**Bukti:** `./verify.sh` **SEMUA HIJAU** (Pest **372 lulus / 3459 asersi** · Redis wajib · Pint bersih ·
checkJs · ESLint 0 error · Vitest **86 berkas / 814 tes** · realtime 20 lulus). Tes baru:
`AdminSekolahTest.php` 15 tes (termasuk token sekali pakai dipakai ulang/untuk sasaran lain → 422, token tujuan
lain ditolak, sesi akun lain tidak tersentuh, sandi tidak bocor ke audit) dan lima berkas Vitest
(`dasborAdmin` 19 · `akunSekolah` 17 · `api` 6 · `halamanAkunSekolah` 4 jsdom · `berandaAdmin` 4 jsdom — dua
terakhir membuktikan tombol Simpan mati tanpa token dan hidup setelah token terbit, serta dasbor menampilkan
angka server apa adanya). `halaman.test.js` diperluas untuk halaman admin.

**Keterikatan yang perlu diketahui sesi berikutnya:** `AkunSekolahService::TUJUAN_TOKEN` (`kelola_akun`) harus
berbeda dari tujuan koreksi nilai — kalau disamakan, token koreksi bisa mengubah kredensial akun. Angka
"online" di dasbor **perkiraan** (jendela 10 menit dari tabel `sessions`, bukan bukti kehadiran) dan dasbor
menyegarkan diri tiap 30 detik, bukan real-time.

**Sisa:** belum dikomit; belum ada harness peramban (`docs/smoke-ui-*.mjs`) untuk panel admin, jadi bukti
tampilannya baru sebatas komponen (Vitest jsdom) + potongan bundel (`npm run build`) — bukan layar 390 px/
1280 px. Rincian lengkap: `docs/laporan-pengujian.md` **A.75**.

## 18. A.76 — kepala sekolah hanya melihat (14 Oktober 2026)

**Permintaan:** kepala sekolah (peran `admin`) berhenti setara guru. Dasbor sekolah + kelola akun
guru/murid tetap miliknya (A.75), tetapi **data akademik tidak lagi ia ubah** — kuis, soal, materi,
data induk, nilai, dan tinjauan kecurangan milik guru yang mengerjakan ulangan itu. Tambahan lisan
pada kesempatan yang sama: tiga pil tindakan di panel kelola akun diganti satu menu "…" berteks.

**Yang dikerjakan:**

- **Satu tempat memutuskan (`App\Models\User`)** — `hanyaMelihat()` (peran `admin`) dan
  `bolehMengubahAkademik()` (guru **dan** bukan kepala sekolah). Seluruh policy **tulis** memakainya
  (Attempt, Avatar, KejadianKecurangan `tinjau`, Materi, Soal, Tag, Kuis `create/update/delete/
  publikasi/koreksi`, Kelas, Mapel, Murid, Sekolah, Pengaturan); seluruh policy **baca** tetap
  `isGuru()` supaya kepala sekolah tidak buta. `TinjauKejadianRequest` ikut memakai policy itu, jadi
  penolakannya 403 izin, bukan 422 validasi.
- **Frontend** — `shared/akses.js` (+ `useHanyaMelihat`) sebagai cermin keputusan server,
  `CatatanHanyaMelihat` supaya halaman tanpa tombol tidak terbaca sebagai aplikasi rusak, penjaga rute
  dipisah di `App.jsx` (`HanyaGuru` baca · `HanyaGuruMengajar` tulis · `BukanKepalaSekolah` avatar ·
  `HanyaAdmin` panel akun), dan tombol yang pasti ditolak disembunyikan di Kelas, Mapel, Murid
  (ekspor CSV tetap ada — itu membaca), Bank Soal, Tag, Kuis + detail kuis (setelan/koreksi/tim/layar
  hilang; laporan, monitor, ekspor nilai tetap ada), Materi, Monitor Ulangan, dan `BerandaAdmin`.
- **Panel kelola akun** — tiga pil tindakan jadi menu "…" berteks (Esc / klik di luar menutup,
  tindakan aktif ditandai), gaya baru `.menu-aksi-item-aktif`.

**Bukti:** seluruh langkah `./verify.sh` dijalankan pada pohon sebelum commit — Pest **377/3561** ·
Redis wajib **9/65** tanpa skip · Pint **PASS 374** · checkJs bersih · ESLint **0 error** · Vitest
**87 berkas/821 tes** · realtime **20** · `npm run build` sukses. Uji barunya
`KepalaSekolahHanyaMelihatTest.php` (5), `hanyaMelihat.test.jsx` (5 jsdom),
`halamanAkunSekolah.test.jsx` (+1), plus `OtorisasiPemilikTest`/`PengaturanTest` yang diperluas.

**Keterikatan yang perlu diketahui sesi berikutnya:** penyembunyian tombol di klien hanya kenyamanan —
pagar sebenarnya tetap policy server. Kalau suatu saat kepala sekolah perlu ikut menyusun ulangan,
yang diubah hanya `bolehMengubahAkademik()` + policy tulisnya, bukan setiap halaman. Perubahan "tiga
pil jadi menu …" adalah tafsir atas permintaan lisan; kalau yang dimaksud tiga tombol lain di kaki
panel (Batal · Minta token · Simpan), perubahan itu tinggal dibalik tanpa menyentuh izinnya.

**Sisa:** belum ada harness peramban untuk jalur kepala sekolah (`docs/smoke-ui-*.mjs`), jadi bukti
tampilannya baru Vitest jsdom + bundel. Rincian lengkap: `docs/laporan-pengujian.md` **A.76**.

**Komit:** `a66a06b` (61 berkas, di atas `12b29cf`) sudah di-push ke `origin/main`.
