# AGENT.md — Dokumen Acuan AI Agent

Platform ulangan/form online untuk sekolah — M-ONE Telkomsel Coding Competition, kategori Umum, subtema Web Education for Kids (SD). Dokumen ini adalah acuan wajib bagi AI agent yang mengerjakan repo ini.

## Peran
AI agent bekerja sebagai senior full-stack engineer sekaligus security engineer. Prinsip utama: **do not trust client** — role, user_id, waktu, urutan soal, dan skor selalu ditentukan server.

## Aturan Lomba
- Individu. Repo GitHub **public sejak commit pertama**, dimulai dari nol (tanpa project lama, fork, atau template; scaffold resmi hanya untuk inisialisasi).
- Mulai 5 Okt 2026 09.30 WIB; batas kumpul 15 Okt 2026 15.30 WIB; pengumuman 25 Okt 2026.
- Yang dikumpulkan: link repo public, dokumen acuan AI agent (folder ini), jurnal prompt (maksimal 5 entri) beserta log mentah utuh, link deploy.
- Commit kecil dan sering dengan tanggal asli. Dilarang force push, rebase, amend commit yang sudah di-push, atau mengubah tanggal commit.
- Sanksi: project lama −35%; terlambat dengan konfirmasi −10%; diskualifikasi untuk plagiarisme, repo private, manipulasi prompt, tidak terbukti dari nol, telat tanpa konfirmasi.
- Bobot nilai: proses vibe coding 25%, fungsionalitas & tema 25%, UI/UX & responsif 20%, kualitas teknis 15%, inovasi & kreativitas 15%.
- Aplikasi wajib ter-deploy sejak awal; deploy tidak boleh ditunda. Jika spesifikasi resmi lomba bertentangan dengan dokumen ini, **spesifikasi lomba menang** — sebutkan konfliknya, lalu ikuti lomba.
- Setiap akhir slice aplikasi harus tetap bisa dijalankan dan didemokan.

## Stack (Final — jangan diganti)
- **Backend**: Laravel + Octane (Swoole di akhir, dev pakai `php artisan serve`), MySQL, Redis, Sanctum mode SPA (cookie sesi, tanpa token di localStorage), spatie/laravel-permission, spatie/laravel-query-builder, spatie/laravel-activitylog, league/csv, Pest + Pint + Debugbar (dev).
- **Frontend**: React + Vite (JavaScript/JSX, tanpa TypeScript), React Router, Zustand, TanStack Query, React Hook Form + Zod + @hookform/resolvers, Axios, dayjs, JSZip (dynamic import), DOMPurify, @tanstack/react-virtual, Bootstrap 5.3 (CSS saja, kustom via variabel CSS), react-error-boundary, Vitest. Toast dan ikon SVG dibuat sendiri (`icons.jsx`).
- **Realtime**: service Node.js terpisah, ESM, Fastify, ioredis, SSE (tanpa WebSocket). Dev: `node --watch`.
- Dilarang ditambahkan: TypeScript, Laravel Excel, zip.js, Lucide, Sonner, clsx, KaTeX, Larastan, Socket.IO, NestJS, RoadRunner. Dependency lain hanya dengan justifikasi satu kalimat.

## Prinsip Keamanan
1. Laravel = otoritas bisnis; database = sumber kebenaran; Redis = cache/state realtime; file fisik di luar folder publik.
2. Jawaban DB dulu lalu cache; penghapusan bertahap (DB → Redis → L1 → job fisik).
3. Pengacakan soal/opsi di server per attempt (seed tersimpan); kunci jawaban tidak pernah dikirim ke klien.
4. `deadline_at = started_at + durasi` dihitung server; timer klien hanya tampilan dikoreksi `server_now`; submit setelah deadline ditolak/ditandai.
5. Submit idempoten (idempotency key); Policy di setiap endpoint (anti-IDOR).
6. Mutasi sensitif = autentikasi + permission + alasan + token konfirmasi sekali pakai + audit append-only.
7. Penilaian gagal per soal tidak menjatuhkan ulangan; tiap soal: dinilai / perlu ditinjau / gagal; tidak ada 500 mentah ke klien.
8. Sinyal kecurangan = bahan tinjauan guru, bukan vonis (fail-open).
9. Anti user-enumeration + throttle di jalur auth; cookie HttpOnly/Secure/SameSite=Lax; CSRF via `/sanctum/csrf-cookie`; CSP kompatibel Vite; password minimal 10 karakter, Argon2id bila tersedia.
10. Akun suspended/belum verifikasi/terhapus ditolak di semua jalur termasuk sesi berjalan.
11. Tidak ada rahasia/token/password di log atau respons API.

## Pagar Mutu
- Frontend: JSDoc + `checkJs` strict (`jsconfig.json`, `npm run check`), semua data eksternal (API/SSE/localStorage) lewat Zod, ESLint (react-hooks, react/no-danger), Vitest.
- **Lokasi berkas uji terpusat** (jangan ditaruh di samping berkas sumber): frontend di `frontend/src/__tests__/`
  mengikuti struktur `src/`, backend di `backend/tests/`, realtime di `realtime/test/`.
- Backend: `declare(strict_types=1)` di setiap file PHP, enum untuk status, Form Request, Policy, API Resource, `Model::shouldBeStrict` + `preventLazyLoading` di non-produksi.
- Database: foreign key, NOT NULL, unique (satu attempt aktif per murid per kuis; satu jawaban per soal per attempt), transaksi + `lockForUpdate` pada submit/penilaian.
- Pest arch tests: controller tidak memanggil `DB::` langsung, tidak ada dd/dump. Factory + Seeder untuk data uji.
- Satu perintah `./verify.sh` di root: `php artisan test`, `pint --test`, `npm run check`, `eslint`, `vitest`. Wajib hijau tiap akhir slice.

## Cara Kerja (slice berurutan; berhenti & lapor tiap akhir slice)
00 scaffold/tooling/tema/icons/toast · 01 auth & identitas · 02 sekolah/kelas/mapel/murid/CSV/pengaturan tiga lapis · 03 bank soal/kuis/tag/soal objektif · 04 attempt/pengacakan/jawaban/submit idempoten/deadline/penilaian objektif · 05 skor asli vs ulang/retry/ranking/badge/remedial · 06 isian/uraian/letak kata/hubung kata/koreksi manual · 07 anti-cheat/presence/SSE/Live Monitor · 08 materi/layar guru/avatar · 09 upload jawaban/penilaian AI/mode tim · 10 cache L1/xlsx/mode gelap/Octane/deploy.
Batas jurnal maksimal 5 berlaku untuk ENTRI JURNAL, bukan jumlah prompt ke AI; jumlah prompt tidak dibatasi dan seluruh prompt/jawaban tetap utuh di docs/log-mentah/ (tidak boleh disunting). Rencana entri jurnal: (1) struktur, scaffold slice 00, penjelasan fitur; (2) slice 01–03; (3) slice 04–06; (4) slice 07–09; (5) slice 10 + deploy + perbaikan akhir.
Urutan potong bila waktu mepet: cache L1, xlsx, mode gelap, mode tim, penilaian AI, rekam diri, avatar, layar guru. **Tidak boleh dipotong**: deploy dengan link yang bisa dibuka, Octane Swoole (atau catatan jujur), keamanan inti (auth, policy IDOR, kunci jawaban, deadline server), jurnal + log mentah jujur.

## Format Dokumentasi (revisi)
- Dokumen internal/agent tetap **Markdown (.md)**: `AGENT.md`, `chunks/*.json`, dan berkas `docs/*.md`.
- **`docs/word/`** = dokumen untuk dikumpulkan, berbentuk `.docx`: `AGENT.docx` (RINGKASAN prompt;
  `AGENT.md` isinya identik), `jurnal-prompt.docx`, `log-mentah.docx`, `penjelasan-fitur.docx`,
  `catatan-demo.docx`, dan `laporan-pengujian.docx`. Teks prompt **asli** tidak lagi ditaruh di sini,
  melainkan di log mentah.
- **`docs/log-mentah/`** = log mentah apa adanya: `sesi-2026-10-05-chat-messages.json.gz` (salinan
  **byte-exact** dari berkas chat sesi asli — tidak disunting) + `sesi-2026-10-05-transkrip.md`
  (bantuan baca), plus prompt/log pekerjaan AI lain di luar repo (`prompt-claude-eksternal.md`,
  `log-claude-eksternal.md`). Pekerjaan luar repo wajib dicatat tempatnya di log dan tidak boleh
  dijadikan bukti tanpa diverifikasi ulang di repo ini.
- `docs/export-log-sesi.py` menyegarkan log mentah (gzip byte-exact + transkrip);
  `docs/export-word.sh` memanggilnya lalu mengekspor dokumen Word. Jalankan keduanya setiap akhir slice
  supaya log mentah selalu mutakhir, lalu komit hasilnya.
- **Log mentah tidak boleh disunting** (isi berkas `.gz` apa adanya, tanpa potong/ringkas).

## Format Laporan (tiap akhir slice)
(a) daftar file dibuat/diubah (lengkap, bukan potongan); (b) migration + test (Pest/Vitest) yang dijalankan beserta perintah dan hasilnya; (c) hasil `verify.sh` (wajib hijau); (d) commit kecil per langkah dengan tanggal asli. Bedakan jujur "sudah dijalankan" vs "ditulis tapi belum dijalankan".

## Larangan
Menyimpan token/data sensitif di localStorage/sessionStorage (kecuali cadangan jawaban tanpa kunci); mempercayai role/user_id/waktu/skor dari klien; mengirim kunci jawaban atau alasan mentah AI ke murid; placeholder atau TODO; enkripsi/hash buatan sendiri; dependency di luar daftar tanpa justifikasi; mengubah riwayat git atau tanggal commit.
