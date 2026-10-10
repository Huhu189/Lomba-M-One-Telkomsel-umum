# Handoff sesi (ringkas)

Catatan ini untuk melanjutkan pekerjaan **setelah context di-compact**. Isinya sengaja
padat: status terakhir, apa yang sudah/belum, dan cara mengulang verifikasi.

Terakhir diperbarui: 2026-10-10 (putaran A.29 — smoke UI mandiri slice 04–07 + bug payload soal letak kata).

## 1. Status verifikasi terakhir

| Perintah | Hasil |
| --- | --- |
| `./verify.sh` (root) | HIJAU — Pest **228 passed (1833 assertions)** · Pint OK · checkJs OK · ESLint 0 error (2 warning lama) · Vitest **53 berkas / 428 test** · realtime 15 test |
| Seluruh smoke UI satu tarikan (`nav`→`susun`→`03`→`04`→`05`→`06`→`07`) | **148 pemeriksaan lulus**: 14/14 · 40/40 · 9/9 · 18/18 · 20/20 · 27/27 · 20/20 (semua exit 0) |
| `node docs/smoke-http-fitur.mjs` | dijalankan lewat backend+realtime hidup (hasil pada laporan A.29) |

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

## 2. Yang selesai di putaran A.29

- **Smoke slice 04–07 kini mandiri**: tiap harness membuat soal + ulangan (+ tag untuk slice 05) di kelas
  murid uji sendiri, memeriksa lewat layar sungguhan, lalu menghapus semuanya di blok `finally` dan
  memulihkan pengaturan yang diubah.
- **Bug nyata diperbaiki (Q-19)**: `AttemptService::payloadSoal()` hanya menyalin `opsi/kiri/kanan/item`,
  sehingga soal **letak kata** sampai ke murid **tanpa `kata` dan `posisi`** — soal tampil kosong dan
  mustahil dijawab dari layar. Ditambah `kata` + `posisi`, plus tes penjaga di `Slice06Test` yang sudah
  dibuktikan gagal bila perbaikannya dibalik.
- **Harness tidak lagi rapuh**: tahan 429 (tunggu 20 detik lalu coba lagi), menutup tab Chrome sendiri,
  `/v1/murid?per_page=100`, dan mengikuti teks UI baru (satu soal per layar, "x dari N terjawab",
  "Selesai" → "Kumpulkan", panel "Catatan untuk ditinjau").
- **Salah tulis seeder dipulihkan** (`UserStatus` → sempat `Usa_erStatus`) yang membuat 213 tes backend
  gagal; `verify.sh` menangkapnya.
- Papan 10 & 11 + sistem tombol (putaran A.28) tidak disentuh lagi.

## 3. Perubahan yang belum dikomit (kondisi `git status`)

Modifikasi tracked (di luar berkas putaran sebelumnya yang juga belum dikomit):

- Backend: `app/Sections/Attempt/Services/AttemptService.php` (daftar putih kolom),
  `tests/Feature/Slice06Test.php` (+1 tes), `database/seeders/RolesAndAdminSeeder.php` (pulihkan `UserStatus`).
- Docs: `laporan-pengujian.md` (A.29), `handoff-sesi.md`, `smoke-ui-slice03/04/05/06/07.mjs`,
  `smoke-ui-nav.mjs`, `smoke-ui-susun.mjs`.
- Frontend dari putaran A.28 (bank soal, kuis tiga langkah, editor soal, tombol) masih belum dikomit juga.

Untracked baru dari putaran sebelumnya: `src/shared/ui/LangkahPil.jsx`, `src/sections/quiz/susunKuis.js`,
`src/__tests__/sistemTombol.test.js`, `docs/smoke-ui-susun.mjs`, `docs/handoff-sesi.md`, `docs/desain/`.
Untracked yang **bukan** bagian pekerjaan: arsip/zip, `.agents/`, `.claude/` — jangan ikut dikomit.

## 4. Batasan jujur (yang belum selesai)

- **Papan 8 (halaman Koreksi) masih sebagian**: susunan "antrean kiri + detail kanan + stepper skor" belum;
  alur koreksinya sendiri sudah terbukti jalan (smoke slice 06).
- Tidak ada uji regresi visual/screenshot; bukti tata letak dari geometri DOM/CDP.
- Smoke UI butuh empat layanan hidup, jadi tidak ikut `verify.sh`; aturan yang sama juga dijaga Pest/Vitest.
- Editor materi terbukti dengan satu MP4 dev, bukan semua kodek.
- Belum ada `git commit` / `git push` / deploy (tidak diminta).

## 5. Cara melanjutkan

```bash
cd "folder tanpa judul 2/lomba_m"
./verify.sh                                  # gerbang wajib: semua cek tanpa layanan
npm --prefix frontend run build              # build produksi
# hidupkan 4 layanan (lihat bagian 1), lalu:
for s in nav susun slice03 slice04 slice05 slice06 slice07; do node docs/smoke-ui-$s.mjs; done
node docs/smoke-http-fitur.mjs               # butuh backend + realtime
./docs/export-word.sh                        # segarkan 6 .docx + log mentah
```

Langkah berikutnya yang masuk akal: tata ulang **papan 8** (halaman Koreksi: antrean kiri + detail kanan +
stepper skor), lalu sisa halaman yang belum sepenuhnya ikut sistem komponen.
