# Handoff sesi (ringkas)

Catatan ini untuk melanjutkan pekerjaan **setelah context di-compact**. Isinya sengaja
padat: status terakhir, apa yang sudah/belum, dan cara mengulang verifikasi.

Terakhir diperbarui: 2026-10-11 (putaran A.30 — 22 tipe soal + 2A kategori kecurangan,
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
yang sedang hidup.**)

## 1. Status verifikasi terakhir

| Perintah | Hasil |
| --- | --- |
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
| `php artisan test --filter=Slice08Test` | 12 passed (172 assertions) — termasuk 3 tes rasio/tampilan/kuis-sisipan |
| `npx vitest run src/__tests__/sections/material` | 54 passed (4 berkas) |
| Seluruh smoke UI satu tarikan (`nav`→`susun`→`03`→`04`→`05`→`06`→`07`) | **148 pemeriksaan lulus**: 14/14 · 40/40 · 9/9 · 18/18 · 20/20 · 27/27 · 20/20 (semua exit 0) — **terakhir dijalankan putaran A.29**, belum diulang sesudah A.30/A.31 |
| `docs/jalankan-smoke-materi.sh` (pemutar materi + kuis sisipan, putaran A.31) | **22/22 lulus, exit 0** — backend :8000 + vite :5173 + Chrome CDP :9333 (realtime tidak perlu) |
| `docs/jalankan-smoke-ui.sh slice06` (ulang sesudah papan 8 dua kolom, putaran A.32) | **28/28 lulus, exit 0** — backend+vite+realtime+Chrome; termasuk pemeriksaan baru “baris antrean dibuka dari kolom kiri + `aria-current`” |
| `node docs/smoke-http-fitur.mjs` | **242/242 lulus** (butuh backend + realtime hidup) — juga dari putaran A.29 |
| `node docs/smoke-ui-luring.mjs` (baru, putaran A.33) | **22/22 lulus, exit 0** (dua kali dengan versi final) — backend :8000 + vite :5173 + Chrome :9333 (realtime tidak perlu) |
| `node docs/smoke-ui-slice04.mjs` + `slice07.mjs` (regresi sesudah A.33) | **18/18 dan 20/20 lulus, exit 0** (slice 07 butuh realtime hidup) |
| `./verify.sh` (**A.42**, sesudah tamu per perangkat + proteksi mobile) | **SEMUA HIJAU (exit 0)** — Pest **331 passed (3126 assertions)** · Redis wajib 9 · Pint bersih · checkJs · ESLint · Vitest **66 berkas / 641 tes** · realtime **20 tes** |
| `php artisan test --filter=TamuTest` (**A.42**) | **21 passed (172 assertions)** — termasuk perangkat sama = akun sama, nama sama dua perangkat = dua akun, nama emoji/non-Latin punya akun sendiri, 6 anak satu IP tanpa 429, dan per perangkat tetap 5/menit |
| `npx vitest run src/__tests__/security/useExamSecurity.test.jsx` (**A.42**) | **6 passed** — resize tinggi (keyboard HP) tidak mengaburkan, masa tenggang kunci, dialog berkas tidak mengunci; dibuktikan bergigi lewat mutasi (4 dari 6 merah saat pagarnya dilepas) |
| `npx vitest run src/__tests__/sections/auth/perangkat.test.js` (**A.42**) | **5 passed** — kode dibuat sekali per perangkat, tetap ada walau penyimpanan diblokir, kode server yang disimpan |
| `npx vitest run src/__tests__/sections/auth/authStore.sesi.test.js` (**A.42**) | **12 passed** — termasuk tamu yang menekan Keluar membuang kode perangkatnya (komputer bersama), sedangkan sesi yang habis sendiri tidak |
| `docs/jalankan-smoke-ui.sh tamu` (**A.42**, harness baru, browser sungguhan) | **9/9 lulus, exit 0** — tamu lewat formulir dapat kode perangkat, muat ulang tidak berubah, Keluar membuang kode, nama sama sesudah Keluar = akun baru, kode ngawur 422; pintu tamu dimatikan kembali di akhir |
| `./nyalakan-local.sh status` (**A.42**) | redis/backend/realtime/frontend **HIDUP** — satu perintah menyalakan semua tanpa menghapus data (tanpa `migrate:fresh`) |
| Seluruh smoke UI dijalankan ULANG di atas local yang hidup (**A.42**, sesudah runner diperbaiki) | `tamu` **9/9** · `slice06` **28/28** · `slice07` **20/20** · `kuis-manual` **13/13** · `perjalanan` **52/52** · `materi` **27/27** — semua exit 0, keempat layanan tetap HIDUP sesudahnya |
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

- `HEAD` = **`77dc2eb`** — "Buka kuis untuk siswa tamu: guru mengizinkan, tamu cukup mengetik nama"
  (putaran A.40). Sebelumnya `6e04be6` — "Perbaiki tiga temuan tipe soal dan rapikan kontrol kepemilikan
  laporan materi" (A.39) dan `534e506` — "Lengkapi materi bergaya video editor: luring, peta perjalanan,
  gagang pangkas, penjelasan setelah kuis" (A.33–A.38, 68 berkas). **Ketiganya sudah di-push** ke
  `origin/main` (`d2c0dff..6e04be6`, lalu `6e04be6..77dc2eb`), jadi repo online sudah memuat seluruh
  pekerjaan sampai A.40.
- **A.40 (commit `77dc2eb`, sudah di-push)**: saklar `izinkan_tamu`, section `Tamu`
  (service + controller + request + laporan tamu), gerbang tamu di `AttemptService`/`KuisPolicy`/
  `RankingService`, panel siswa tamu di laporan, formulir `MasukTamu.jsx`, navigasi & salinan tamu,
  tes `TamuTest.php` + `masukTamu.test.jsx`, dan pembaruan dokumentasi — semuanya **sudah dikomit & di-push**
  bila `git status` bersih; kalau tidak, lihat pesan commit terbaru untuk daftar tepatnya.
- **Belum dikomit di working tree** (urutan putaran: A.33 dan putaran-putaran sebelumnya): modifikasi
  backend (kuis/materi) + frontend (kuis, soal, materi, pengaturan, tema) dari putaran sebelum A.33, plus
  berkas baru A.33 (9 berkas: 4 modul + 4 tes di `frontend/src/sections/attempt/` & `__tests__`, dan
  `docs/smoke-ui-luring.mjs`) serta perubahan dokumentasi (`penjelasan-fitur.md`, `laporan-pengujian.md`,
  `handoff-sesi.md`, `docs/word/penjelasan-fitur.docx`, `docs/word/laporan-pengujian.docx`).
- **A.34 (belum dikomit)**: `Material/Registry/TemaPerjalanan.php`, `Material/Services/TemaMateriService.php`,
  migrasi `2026_10_10_000002_tambah_tema_materi.php`, `tests/Feature/Slice12TemaMateriTest.php`,
  `sections/material/perjalanan.js`, `sections/material/PetaPerjalanan.jsx`, dua tes
  `__tests__/sections/material/perjalanan.test.js` + `petaPerjalanan.test.jsx`, dan
  `docs/smoke-ui-perjalanan.mjs` + `docs/jalankan-smoke-perjalanan.sh` (plus perubahan materi/editor/api/CSS).
- **A.36 (belum dikomit)**: `sections/material/EditorMateri.jsx`, `sections/material/editorMateri.js`,
  `theme/theme.css`, `__tests__/sections/material/editorMateri.test.js`, `docs/smoke-ui-durasi-klip.mjs`
  (putaran lanjutan A.36.7 hanya mengubah harness itu: bagian 4 untuk klip `kuis`/`media` — tanpa perubahan kode produk).
- **A.35 (belum dikomit)**: `sections/question/EditorSoal.jsx`, `sections/question/tipeSoal.js`,
  `icons.jsx`, `theme/theme.css`, tes baru `__tests__/sections/question/ikonTipe.test.jsx`,
  `docs/smoke-ui-susun.mjs`, `docs/smoke-ui-kuis-manual.mjs` (plus dokumentasi A.35).
- **A.37 (belum dikomit)**: `sections/material/PetaPerjalanan.jsx` (buang adegan SVG),
  `sections/material/EditorMateri.jsx` (keterangan template opsional), `theme/theme.css`,
  `__tests__/sections/material/petaPerjalanan.test.jsx`,  `frontend/public/tema/LISENSI.md`, dan
  `docs/smoke-ui-perjalanan.mjs` (latar tanpa SVG, masuk ulang sebagai guru, tutup WebSocket) — plus
  dokumentasi A.37.
- **A.39 (belum dikomit) — sapuan dasar & 3 perbaikan**: berkas uji baru
  `backend/tests/Feature/AlurTipeSoalTest.php` (dataset 22 tipe soal lewat HTTP: buat → kuis → mulai →
  payload tanpa kunci → jawab benar → kumpulkan → periksa status & skor), 2 tes baru di `AuthTest.php`
  (token reset kedaluwarsa, `lupa-sandi` 429), dan 1 tes baru di `Slice08Test.php` (penyebaran materi).
  Temuan yang diperbaiki: (1) `PenanganMengurutkan::nilai()` membaca peta `{idItem: posisi}` kiriman
  renderer sebagai daftar id sehingga **jawaban benar selalu bernilai 0** → ditambah `urutanJawaban()`;
  (2) `SimpanSoalRequest` mengembalikan `null` (efek `ConvertEmptyStringsToNull`) ke `''` pada
  `konten.grid` supaya soal **teka silang mini bisa disimpan** lewat API; (3)
  `MateriPolicy::laporan()` diperketat jadi pemilik/admin (sebelumnya **guru mana pun** bisa membaca
  laporan kelas orang lain) — ini perubahan kebijakan yang masih perlu konfirmasi pemilik produk.
- **A.38 (belum dikomit)**: `Material/Services/MateriService.php`, `ProgresMateriService.php`,
  `Http/Resources/BlokResource.php`, `tests/Feature/Slice08Test.php`, `sections/material/EditorMateri.jsx`,
  `editorMateri.js`, `PemutarMateri.jsx`, `api.js`, `theme/theme.css`, tes `editorMateri.test.js` +
  `api.test.js`, `docs/smoke-ui-materi.mjs` (pemilih daftar bagian) — plus dokumentasi A.38.
- `docs/log-mentah/log-claude-eksternal.md` dan `docs/log-mentah/prompt-claude-eksternal.md` ikut
  tersapu commit A.33–A.39 (catatan mentah eksternal; sudah ada di repo, isinya tidak diubah).
- Untracked yang **bukan** bagian pekerjaan: arsip/zip, `.agents/`, `.claude/`, `.DS_Store` — jangan ikut dikomit.

## 4. Batasan jujur (yang belum selesai)

- **Katalog tema perjalanan (A.34) baru satu tema** ("Mendaki Gunung"). Bentuk katalog sudah siap menampung
  banyak tema, tetapi tema lain belum dibuat; smoke hanya menguji tema bawaan. **A.37 membuat adegan gambar
  buatan dibuang; keputusan itu DIBALIK atas permintaan pemilik produk:** adegan `gunung` kini ilustrasi
  beranimasi yang digambar sendiri (`AdeganGunung.jsx`, sudut pandang mendongak dari kaki gunung) dan foto
  `gunung.jpg` dihapus dari repo — jadi `frontend/public/tema/` sekarang kosong. Tema/adegan lain tetap tampil
  sebagai gradien sampai medianya ditambahkan. Video latar hanya diuji dengan satu MP4 2 detik di jalur berpotongan,
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
- **Objektif 2B–2D (deteksi tamper/extension sisi klien) belum**: MutationObserver + pemindai berkala,
  pemeriksaan integritas fungsi proteksi, endpoint denyut ber-nonce, `SapuPresence` yang mengubah denyut
  berhenti menjadi `tamper_suspected`, dan pengirim sisi klien untuk dua kategori baru.
- **Papan 8 (halaman Koreksi) sudah tuntas menurut keputusan A.32**: dua kolom (antrean kiri + detail
  kanan), pemilihan baris berbasis identitas (`kunciKoreksi`/`pilihItemKoreksi`), penunjuk langkah, dan
  sisa tombol Bootstrap beres. Yang **sengaja tidak** ditiru dari mock: kolom "ketik token 6 angka" —
  token server sebenarnya `bin2hex(random_bytes(24))` (48 karakter), jadi memaksa guru mengetiknya hanya
  menambah peluang salah ketik tanpa tambahan pengaman (alasan lengkap di `laporan-pengujian.md` A.32.1b).
  Bukti layar: smoke slice 06 **28/28**.
- **Papan 12 sudah jadi dan smoke UI-nya sudah lulus 22/22**, tetapi harness itu masih satu jalur:
  kuis mode _jeda_ di dalam video (mode _berjalan_ dan tata panel horizontal baru diuji Pest/Vitest), dan
  pemutaran masih terbukti dengan **satu MP4 dev** (5,4 MB), bukan semua kodek.
- **P-01 paginasi baru sebagian**: hanya `SoalController` dan `MuridController` memakai `paginate()`;
  kuis, materi, koreksi, peringkat, ekspor, monitor, dan kecurangan masih memuat semua baris.
- Tidak ada uji regresi visual/screenshot; bukti tata letak dari geometri DOM/CDP.
- Tidak ada uji beban dengan ribuan murid; yang dibuktikan bentuk kontrak + pemangkasan `per_page`.
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
docs/jalankan-smoke-ui.sh slice06             # harness lama: backend+vite+realtime+Chrome sendiri
docs/jalankan-smoke-materi.sh                 # pemutar materi + kuis sisipan (backend+vite+Chrome sendiri)
docs/jalankan-smoke-perjalanan.sh             # peta perjalanan bertema + kenaikan pos/tingkat (sendiri)
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

Langkah berikutnya yang masuk akal: **menambah tema perjalanan kedua/ketiga** (mis. "Menjelajah Laut",
"Ruang Angkasa") memakai katalog yang sudah ada, **menyambung alur tamu sampai mengerjakan ulangan lewat
smoke browser** (harness `tamu` baru membuktikan identitas/kode perangkat, belum mengerjakan soal), lalu
**deteksi tamper sisi klien (2B–2D)**.
