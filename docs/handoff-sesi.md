# Handoff sesi (ringkas)

Catatan ini untuk melanjutkan pekerjaan **setelah context di-compact**. Isinya sengaja
padat: status terakhir, apa yang sudah/belum, dan cara mengulang verifikasi.

Terakhir diperbarui: 2026-10-10 (putaran A.30 — 22 tipe soal + 2A kategori kecurangan,
A.31 — editor materi gaya video editor + kuis sisipan di dalam klip, dan A.32 — penunjuk langkah
koreksi manual).

## 1. Status verifikasi terakhir

| Perintah | Hasil |
| --- | --- |
| `./verify.sh` (root) | HIJAU (exit 0) — Pest **256 passed (2304 assertions)** · Pint **335 berkas** · checkJs OK · ESLint **0 error** (2 warning lama React Hook Form) · Vitest **56 berkas / 511 test** · realtime 15 test |
| `php artisan test --filter=Slice08Test` | 12 passed (172 assertions) — termasuk 3 tes rasio/tampilan/kuis-sisipan |
| `npx vitest run src/__tests__/sections/material` | 54 passed (4 berkas) |
| Seluruh smoke UI satu tarikan (`nav`→`susun`→`03`→`04`→`05`→`06`→`07`) | **148 pemeriksaan lulus**: 14/14 · 40/40 · 9/9 · 18/18 · 20/20 · 27/27 · 20/20 (semua exit 0) — **terakhir dijalankan putaran A.29**, belum diulang sesudah A.30/A.31 |
| `docs/jalankan-smoke-materi.sh` (pemutar materi + kuis sisipan, putaran A.31) | **22/22 lulus, exit 0** — backend :8000 + vite :5173 + Chrome CDP :9333 (realtime tidak perlu) |
| `docs/jalankan-smoke-ui.sh slice06` (ulang sesudah papan 8 dua kolom, putaran A.32) | **28/28 lulus, exit 0** — backend+vite+realtime+Chrome; termasuk pemeriksaan baru “baris antrean dibuka dari kolom kiri + `aria-current`” |
| `node docs/smoke-http-fitur.mjs` | **242/242 lulus** (butuh backend + realtime hidup) — juga dari putaran A.29 |

Layanan yang dibutuhkan smoke UI: backend `:8000`, realtime `:4000`, frontend `:5173`, Chrome CDP `:9333`:

```bash
( cd backend  && php artisan serve --host=127.0.0.1 --port=8000 )
( cd realtime && node src/server.js )
( cd frontend && npm run dev )
( "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
    --remote-debugging-port=9333 --user-data-dir=/tmp/chrome-smoke2 --no-first-run \
    --autoplay-policy=no-user-gesture-required about:blank )
```

**Penting:** jalankan tiap layanan sebagai proses latar milik alat (bukan `nohup ... &` di dalam perintah
SYNC) — shell perintah dibersihkan setelah selesai dan anak prosesnya ikut mati.

Akun demo: `admin@sekolah.test` / `smoke.murid@sekolah.test`, sandi `Passw0rd!Aman` (lihat
`RolesAndAdminSeeder`). Throttle masuk 5 percobaan/menit per akun — harness sudah menunggu + mencoba lagi.

## 2. Yang selesai di putaran A.30 dan A.31

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

## 3. Kondisi git (`git status`)

- `HEAD` = **`a859f78`** — "Jadikan materi bergaya video editor dengan kuis sisipan di dalam klip"
  (17 berkas: 13 modifikasi + `PemutarMateri.jsx`, `pemutarMateri.js`, migrasi `rasio`, 2 tes baru).
- Belum dikomit dan **sengaja ditinggalkan**: `docs/log-mentah/log-claude-eksternal.md` dan
  `docs/log-mentah/prompt-claude-eksternal.md` (catatan mentah eksternal, bukan bagian kode fitur).
- Tidak ada berkas lain yang kotor. **Tidak** ada `git push` untuk commit ini.
- Untracked yang **bukan** bagian pekerjaan: arsip/zip, `.agents/`, `.claude/`, `.DS_Store` — jangan ikut dikomit.

## 4. Batasan jujur (yang belum selesai)

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
- Lima soal sisa `SMOKE-` (id 57–60, 150) masih tertahan di bank soal dev karena sudah dipakai/dijawab.

## 5. Cara melanjutkan

```bash
cd "folder tanpa judul 2/lomba_m"
./verify.sh                                  # gerbang wajib: semua cek tanpa layanan
npm --prefix frontend run build              # build produksi
# hidupkan 4 layanan (lihat bagian 1), lalu:
for s in nav susun slice03 slice04 slice05 slice06 slice07; do node docs/smoke-ui-$s.mjs; done
docs/jalankan-smoke-materi.sh                 # pemutar materi + kuis sisipan (backend+vite+Chrome sendiri)
docs/jalankan-smoke-ui.sh slice06             # harness lama: backend+vite+realtime+Chrome sendiri
node docs/smoke-http-fitur.mjs               # butuh backend + realtime
./docs/export-word.sh                        # segarkan 6 .docx + log mentah
python3 docs/export_docx.py docs/<berkas>.md docs/word/<berkas>.docx   # konversi Word saja (tanpa log mentah)
```

Langkah berikutnya yang masuk akal: **smoke UI pemutar materi** (menutup celah bukti A.31), lalu tata ulang
**papan 8** (halaman Koreksi), lalu **deteksi tamper sisi klien (2B–2D)**.
