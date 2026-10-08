# AGENT — Ringkasan Prompt

Dokumen ini **meringkas** prompt yang dipakai membangun repo ini (M-ONE Telkomsel Coding
Competition, kategori Umum, subtema Web Education for Kids / SD). Teks prompt **asli apa adanya**
tidak ditaruh di sini, melainkan di log mentah: `docs/log-mentah/`.

Isi berkas ini identik dengan `docs/word/AGENT.docx`.

## Daftar prompt

| # | Tanggal & jam (WIB) | Tujuan | Hasil |
|---|---|---|---|
| v1 | 5 Okt 2026 ± 14.30 | Buat struktur project + dokumen acuan + scaffold slice 00 | Dokumen acuan (`AGENT.md`, `00-index.json`, `chunk_map.json`, 18 chunk, `docs/`), monorepo 3 layanan, pagar mutu, `verify.sh` hijau |
| v2 | 5 Okt 2026 ± 18.00 | Perbarui dokumen acuan (3 perubahan) + tulis penjelasan fitur | Batas 5 = entri jurnal, fitur F2 materi berblok, `docs/penjelasan-fitur.md` |
| v3 | 6 Okt 2026 | Rombak UI/UX slice 00–02 (oleh AI lain, di luar repo) | Tema, 6 halaman auth, beranda, kerangka, toast; disalin masuk repo dan diverifikasi ulang di sini |

## Rincian ringkas

### v1 — Struktur project + scaffold slice 00
- **Peran**: senior full-stack engineer sekaligus security engineer, prinsip **"do not trust client"**.
- **Tugas (tanpa fitur apa pun)**:
  1. Dokumen acuan AI agent: `AGENT.md` (peran, aturan lomba, stack, keamanan, pagar mutu, cara kerja,
     format laporan, larangan; ± 100 baris), `00-index.json`, `chunk_map.json`, `chunks/*.json`
     (skema tetap: `id`, `title`, `depends_on`, `loads`, `goal`, `scope[]`, `constraints[]`, `tests[]`,
     `done_when[]`; satu berkas per topik dan per slice 00–10), `docs/`.
  2. Scaffold monorepo `backend/` (Laravel), `frontend/` (React + Vite), `realtime/` (Fastify) dari
     scaffold resmi saja; folder per bagian logika (`app/Sections/<Nama>/`, `src/sections/<nama>/`);
     pagar mutu (`declare(strict_types=1)`, Pest + arch test, Pint, JSDoc `checkJs` strict, ESLint,
     Vitest, `verify.sh` di root); tema CSS, `icons.jsx`, toast buatan sendiri.
  3. Ekspor Word untuk dokumen yang dikumpulkan + `README` cara menjalankan.
- **Larangan**: menyalin kode dari proyek lain; menambah aturan di luar prompt.

### v2 — Revisi dokumen acuan (hanya 3 perubahan)
1. **Batas 5 = entri jurnal**, bukan jumlah prompt ke AI. Semua prompt dan jawaban tetap utuh di
   `docs/log-mentah/` dengan tanggal-jam asli; log mentah tidak boleh disunting.
2. **Fitur F2 — materi berblok + kuis sisipan** masuk chunk `slice-08` (bergantung `slice-04`):
   materi = urutan blok (teks, media, kuis); blok kuis menunjuk kuis/soal yang sudah ada di bank soal
   (tanpa tipe soal atau penilai baru) dan dipakai lewat mesin kuis yang sama; kuis sisipan bertipe
   **latihan** (masuk laporan tema, bukan ranking); urutan ditegakkan server; halaman guru ke perangkat
   murid = sinkron konten, bukan share layar.
3. **`docs/penjelasan-fitur.md`** untuk juri dan guru: bahasa Indonesia sederhana, tiap fitur memakai
   empat subjudul tetap (Apa ini / Cara kerjanya / Mengapa aman / Manfaat), ditutup bagian "Batasan jujur".
- Ditambah dua pemeriksaan baca-saja: status slice 00 di riwayat git, dan potensi bentrok aturan
  "satu attempt aktif per murid per kuis" dengan attempt latihan dari blok kuis sisipan.

### v3 — Rombak UI/UX (dikerjakan AI lain di luar repo)
- **Permintaan**: UI/UX masih MVP, boleh dirombak dan dimatangkan, boleh bertanya bila ragu; lampiran
  backend + frontend + docs.
- **Catatan keterbukaan**: pekerjaan ini berjalan **di luar repository** memakai salinan zip lalu
  disalin masuk. Backend tidak diubah, tanpa dependency baru, dan tidak ada satu pun klaim di dalamnya
  yang dianggap bukti — semuanya diverifikasi ulang di repo ini. Prompt dan lognya disimpan apa adanya:
  `docs/log-mentah/prompt-claude-eksternal.md` dan `docs/log-mentah/log-claude-eksternal.md`.

## Aturan dari prompt yang wajib dipatuhi
- Repo **public sejak commit pertama**, dibangun dari kosong (tanpa project lama, fork, atau template).
- Commit kecil dan sering dengan tanggal asli; **dilarang** force push, rebase, amend commit yang sudah
  di-push, atau mengubah tanggal commit.
- Log mentah tidak boleh disunting; klaim "sudah dijalankan" dan "ditulis tapi belum dijalankan" wajib
  dibedakan jujur.
- Kalau spesifikasi resmi lomba bertentangan dengan prompt, **spesifikasi lomba menang** — sebutkan
  konfliknya, lalu ikuti lomba.

## Log mentah (cara berkas ini dijaga tetap mutakhir)
- `docs/log-mentah/sesi-2026-10-05-chat-messages.json.gz` — salinan **byte-exact** (gzip) dari berkas
  chat sesi asli, tanpa disunting.
- `docs/log-mentah/sesi-2026-10-05-transkrip.md` — transkrip mentah yang enak dibaca: isinya utuh
  apa adanya, argumen panggilan alat **tidak dipotong**.
- Keduanya **disegarkan ulang setiap akhir slice** dengan `docs/export-log-sesi.py` supaya log selalu
  mutakhir; `docs/export-word.sh` memanggilnya sekaligus mengekspor dokumen Word.
