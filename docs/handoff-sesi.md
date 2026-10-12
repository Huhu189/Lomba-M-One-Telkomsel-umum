# Handoff sesi (ringkas)

Catatan ini untuk melanjutkan pekerjaan **setelah context di-compact**. Isinya sengaja
padat: status terakhir, apa yang sudah/belum, dan cara mengulang verifikasi.

## 0. MULAI DI SINI (sesi baru — tanpa riwayat)

Bagian ini **berdiri sendiri**: cukup baca sampai selesai untuk melanjutkan. Berkas ini dibuat agar sesi
baru **tidak memuat riwayat chat lama** (riwayat sesi sebelumnya 333 MB dan membuat memori proses agen
membengkak ke 3,3 GB). Rincian tiap putaran ada di bagian 1–5 dan `docs/laporan-pengujian.md`.

### 0.1 Proyek ini apa (30 detik)

`lomba_m` = aplikasi ulangan & materi sekolah: **Laravel 11** (`backend/`) + **React 18 / Vite**
(`frontend/`) + **Node SSE** (`realtime/`), semuanya di satu repo. "Materi berjalan" menampilkan tiap blok
materi sebagai satu **pos** di peta perjalanan bertema. Tiga tempat yang mengatur tema:

- katalog tema: `backend/app/Sections/Material/Registry/TemaPerjalanan.php`
- rute pos per tema: `frontend/src/sections/material/perjalanan.js` (`RUTE_TEMA`)
- latar gambar tiap tema: `frontend/public/tema/*.svg` (kini `gunung.svg`, `pulau.svg`, `angkasa.svg`)

Tema **tidak** boleh menaruh pos di ruang kosong — dijaga `frontend/src/__tests__/theme/latarTema.test.js`
(tiap benda yang diinjak pos punya `id` di berkas SVG-nya).

### 0.2 Kondisi repo persis (verifikasi sendiri)

`git status --short && git diff --stat && git rev-parse --short HEAD origin/main && git rev-list --count origin/main..HEAD`

Saat handoff ini dibuat (12 Okt 2026): `HEAD = 7154875`, `origin/main = 1f7a2de`, **9 commit belum di-push**.
Working tree yang belum dikomit = putaran **A.55 (13 berkas)**:
`frontend/src/sections/material/PemutarMateri.jsx`, `frontend/src/theme/theme.css`, lima runner
`docs/jalankan-*.sh` (`--mute-audio`), `docs/{penjelasan-fitur,laporan-pengujian,handoff-sesi}.md`,
`docs/word/{laporan-pengujian,penjelasan-fitur}.docx`, dan berkas **baru** `docs/smoke-ui-kuis-materi.mjs`.
Jangan ikut dikomit: arsip/zip, `.agents/`, `.claude/`, `.DS_Store`.

### 0.3 Nyalakan layanan & gerbang mutu

```bash
cd "folder tanpa judul 2/lomba_m"
./nyalakan-local.sh            # redis+backend+realtime+frontend, TANPA hapus data
./verify.sh                    # gerbang wajib (tanpa layanan): Pest+Pint+checkJs+ESLint+Vitest+realtime
docs/jalankan-smoke-ui.sh kuis-materi     # 48/48 (runner menyalakan & mematikan layanan sendiri)
```

Penting untuk sesi agen: **jangan** `nohup … &` di dalam perintah SYNC (anaknya ikut mati saat shell selesai).
Pakai runner `docs/jalankan-*.sh`, atau jalankan nyala+harnes **di dalam satu perintah**.
Akun demo: `admin@sekolah.test` (guru) & `smoke.murid@sekolah.test` (murid), sandi `Passw0rd!Aman`.

### 0.4 Sudah terverifikasi di A.55 (jangan diulang tanpa perubahan kode)

`./verify.sh` **SEMUA HIJAU** (Pest 339 · Pint · checkJs · ESLint · Vitest 75 berkas/717 tes · realtime 20),
`docs/jalankan-smoke-ui.sh kuis-materi` **48/48**, `… mobile` **16/16**, `… materi` **27/27**,
`… perjalanan` **69/69**. Perubahan sesudahnya hanya berkas dokumentasi/Word.

### 0.5 HASIL AUDIT TAMPILAN — 12 Okt 2026 (baru; sudah dijalankan, jangan ulang)

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

Angka di atas dari Chrome headless/CDP (bukan perangkat fisik). Untuk menjalankan ulang audit:
`node docs/audit-ui.mjs [filter] [--gelap]` dengan backend+vite+Chrome :9333 hidup.

### 0.6 PAPAN PENDING (kerjakan berurutan)

1. **Commit + push putaran A.55** sebelum menumpuk pekerjaan baru (pisahkan per langkah kecil: tata letak
   panel kuis, bilah atas, bunyi bisu, kartu perhatian, dokumentasi). 13 berkas, 9 commit tertinggal.
2. **A.56 — Rombak tampilan yang patah: editor materi di lebar ponsel.** Sasaran: `/materi/:id/editor`
   **tidak** bergulir mendatar di 390 px (kini +151 px). Titik rawan dari audit: baris `.nle-tool`
   (lebar tetap 324 px → buat bisa membungkus/menyusut), panel inspector kanan (+138 px → tumpuk ke bawah
   di < 768 px atau beri `min-width: 0` + gulir internal), `.nle-klip` & pita timeline. Bukti yang diminta:
   harness baru (mis. `docs/smoke-ui-editor.mjs`) yang menuntut overflow **0 px** di 390/768/1366 px +
   `./verify.sh` hijau. Sekalian pertimbangkan target sentuh < 44 px di editor.
3. **A.57 — Rombak tema "Harta Karun di Pulau" jadi sudut pandang dari ATAS** (permintaan pemilik produk,
   12 Okt 2026: *"pantai dari POV di atas, murid seperti berlayar"*). Artinya: ganti
   `frontend/public/tema/pulau.svg` (kini terbaca mendatar) dengan latar laut **mata burung / dari atas**
   (seperti peta), pos berdiri di atas benda (perahu, dermaga, karang, …), dan **penanda pos murid bergerak
   seperti berlayar** antar pos. Rute tetap `RUTE_TEMA.pulau` di `perjalanan.js`; berkas baru WAJIB mengikuti
   bentuk penanda `id` yang lama dan **lolos** `frontend/src/__tests__/theme/latarTema.test.js` (jalankan
   merah-dulu sebagai kontrol sebelum menyentuh berkas). Bukti: pagar latar hijau + `docs/jalankan-smoke-ui.sh
   perjalanan`. **Catatan:** pemilik produk juga menyebut "ruang angkasa", tetapi belum dipastikan apakah
   tema `angkasa` ikut dirombak — **tanyakan dulu**, jangan sentuh tanpa konfirmasi.
4. Sudah terdaftar sebelumnya: (a) selaraskan pratinjau kanvas editor guru dengan posisi panel kuis A.55
   (di bawah/samping bingkai, bukan menimpa gambar) — **di-merge dengan A.56** karena sama-sama editor;
   (b) jadikan asersi "kartu Perlu perhatian tanpa garis sisi berwarna" permanen di `docs/smoke-ui-mobile.mjs`;
   (c) audit tata letak 360/768/1024/1440 px.

### 0.7 Kebiasaan hemat memory (WAJIB dipertahankan)

Keluaran alat selalu kecil — pakai `tail`/`grep`/`wc`; tulis hasil panjang ke `/tmp` lalu baca ringkasannya;
jangan mencetak berkas besar utuh; nyalakan layanan/Chrome hanya di dalam **satu skrip sekali pakai yang
mematikan dirinya sendiri**. Layanan yang berdiri sendiri saat idle ikut memakan RAM mesin.

### 0.8 Prompt kickoff siap salin (untuk chat baru)

```
Lanjutkan proyek lomba_m di "folder tanpa judul 2/lomba_m".
Baca docs/handoff-sesi.md bagian "## 0. MULAI DI SINI" saja — jangan memuat riwayat lain.
Kerjakan PAPAN PENDING bagian 0.6 secara berurutan:
1) commit + push putaran A.55,
2) A.56 rombak editor materi yang melebar +151 px di ponsel,
3) A.57 rombak tema "Harta Karun di Pulau" jadi POV dari atas (murid seperti berlayar).
Patuhi kebiasaan hemat memory di bagian 0.7 dan jalankan ./verify.sh + harnes smoke terkait sebagai bukti.
```

### 0.9 Jangan salin riwayat lama

Log mentah sesi sebelumnya tersimpan di luar repo
(`~/.config/manicode/projects/Desktop/chats/2026-10-05T07-39-24.876Z/`); bukti yang dikumpulkan ada di
`docs/log-mentah/` (`sesi-2026-10-05-chat-messages.json.gz` + transkrip).

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
`docs/smoke-ui-ukuran.mjs` (11/11) plus `theme/ukuran.test.jsx`. · **A.50 — "pos di udara" ditutup + dua
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
Terakhir diperbarui lagi 12 Okt 2026 dengan **hasil audit tampilan** (bagian 0.5) dan **papan pending A.56/A.57**
(bagian 0.6): editor materi melebar +151 px di ponsel, dan permintaan merombak tema "Harta Karun di Pulau"
jadi sudut pandang dari atas (murid seperti berlayar).

## 1. Status verifikasi terakhir

| Perintah | Hasil |
| --- | --- |
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

- `HEAD` = **`7154875`** — "Buktikan di browser sungguhan: kelas bertabrakan terbaca sebabnya, fokus jendela
  tidak menembak ulang" (putaran A.51–A.54). `origin/main` masih di **`1f7a2de`**, jadi **9 commit lokal
  belum di-push** (`1f7a2de..7154875`) — repo online baru memuat pekerjaan sampai A.40. **Push dulu sebelum
  menutup sesi.**
- **Riwayat putaran A.33–A.54 sudah semuanya dikomit** (`fe68410`, `f8ed168`, `1ddf042`, `ef12a82`, `5f4b3ec`,
  `7e6c24c`, `ed03aec`, `1eb7acb`, `7154875`). Daftar berkas per putaran tidak lagi didaftar ulang di sini
  supaya dokumen ini tetap ringkas: pakai `laporan-pengujian.md` (bagian A.33–A.54) atau `git show --stat <commit>`.
- **Belum dikomit di working tree = putaran A.55 saja (13 berkas)**: `frontend/src/sections/material/PemutarMateri.jsx`,
  `frontend/src/theme/theme.css`, lima runner `docs/jalankan-*.sh` (`--mute-audio`), dokumentasi
  (`docs/penjelasan-fitur.md`, `docs/laporan-pengujian.md` bagian A.55, `docs/handoff-sesi.md`), dua ekspor Word
  yang ikut disegarkan (`docs/word/laporan-pengujian.docx`, `docs/word/penjelasan-fitur.docx`), dan berkas
  **baru** `docs/smoke-ui-kuis-materi.mjs`.
- `docs/log-mentah/log-claude-eksternal.md` dan `prompt-claude-eksternal.md` sudah ikut commit A.33–A.39
  (catatan mentah eksternal; isinya tidak diubah).
- Untracked yang **bukan** bagian pekerjaan: arsip/zip, `.agents/`, `.claude/`, `.DS_Store` — jangan ikut dikomit.

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
- **Editor materi patah di lebar ponsel (temuan audit 12 Okt 2026, belum diperbaiki).** Di 390 px halaman
  editor `/materi/:id/editor` bergulir mendatar **+151 px** (baris `.nle-tool` tetap 324 px, panel inspector
  kanan +138 px); di laptop banyak kontrol < 44 px. Editor **tidak pernah** masuk daftar audit mana pun
  (`smoke-ui-mobile.mjs` menyapu 8 halaman non-editor; `audit-ui.mjs` tidak memuat editor). Bukan regresi
  A.55. Dijadwalkan sebagai **A.56** dan butuh harness editor baru (overflow 0 px di 390/768/1366 px).
- **Tata "horizontal" hanya aktif di viewport ≥1200 px** (di 1366 px kolom materi murid hanya ±640 px lebar);
  di bawah itu kedua tata menumpuk ke bawah supaya video tidak diperas. Angka tata letak A.55 diukur di dua
  viewport saja (390×844, 1366×900) lewat Chrome headless/CDP, bukan perangkat fisik.
- **P-01 paginasi baru sebagian**: hanya `SoalController` dan `MuridController` memakai `paginate()`;
  kuis, materi, koreksi, peringkat, ekspor, monitor, dan kecurangan masih memuat semua baris.
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
docs/jalankan-smoke-ui.sh tamu                # mode tamu + kode perangkat (9/9)
docs/jalankan-smoke-ui.sh ukuran              # ukuran tulisan Normal↔Besar di Chrome (11/11)
docs/jalankan-smoke-ui.sh murid               # pencarian murid yang menyaring di server (18/18)
docs/jalankan-smoke-ui.sh kuis-materi        # kuis di halaman materi: tata panel, keterbacaan, bunyi bisu (48/48)
docs/jalankan-smoke-ui.sh slice06             # harness lama: backend+vite+realtime+Chrome sendiri
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

Langkah berikutnya yang masuk akal: **commit + push putaran A.55** (13 berkas: panel kuis pindah ke luar
bingkai video, bilah atas bisa menyusut, `--mute-audio`, harness `smoke-ui-kuis-materi.mjs`), lalu
**A.56 — rombak editor materi yang melebar +151 px di ponsel** (temuan audit 12 Okt, lihat bagian 0.5/0.6),
**A.57 — rombak tema "Harta Karun di Pulau" jadi POV dari atas (murid seperti berlayar)**,
**menyelaraskan pratinjau kanvas editor** dengan posisi panel yang baru, **tahap 1 rencana desain putaran 3** — menggabungkan tombol tema dan
tombol ukuran menjadi satu panel "Tampilan" (rencananya di `docs/rencana-desain-putaran3.md`, termasuk
daftar kata papan yang masih perlu keputusan pemilik produk), **menyambung alur tamu sampai
mengerjakan ulangan lewat smoke browser** (harness `tamu` baru membuktikan identitas/kode perangkat, belum
mengerjakan soal), **memperluas pencarian (A.51/A.53)** ke halaman Kelas/Mapel/Bank Soal atau menggantinya
pencarian penuh begitu jumlah muridnya besar, lalu **membuat ambang denyut (A.54) bisa diatur guru** —
kini nilai tetap 30 detik / ~100 detik — dan **uji denyut di browser sungguhan** (yang ada sekarang: unit
hook + kontrak HTTP + unit service). Deteksi tamper 2B–2D sendiri sudah tuntas.
