# Daftar isi folder `docs/`

Seluruh dokumen proyek ada di sini. Ringkasnya: **apa yang dikumpulkan** ada di `word/`, **apa yang
dijalankan dan hasilnya** ada di `laporan-pengujian.md`, dan **apa adanya (mentah)** ada di `log-mentah/`.

## Dokumen yang dikumpulkan (`.docx`)

Dokumen panitia berbentuk Word, semuanya **dihasilkan** dari sumber Markdown di bawah — jangan menyunting
`.docx` langsung, ubah sumbernya lalu jalankan ulang ekspor.

| Berkas | Sumber |
| --- | --- |
| `word/AGENT.docx` | `word/AGENT.md` (ringkasan prompt) |
| `word/jurnal-prompt.docx` | `jurnal-prompt.md` |
| `word/log-mentah.docx` | gabungan `log-mentah/<sesi>/transkrip.md` seluruh sesi |
| `word/penjelasan-fitur.docx` | `penjelasan-fitur.md` |
| `word/catatan-demo.docx` | `catatan-demo.md` |
| `word/laporan-pengujian.docx` | `laporan-pengujian.md` |

Segarkan semuanya: `./docs/export-word.sh`. Kalau hanya perlu Word tanpa log mentah:
`python3 docs/export_docx.py docs/<berkas>.md docs/word/<berkas>.docx`.

## Laporan, catatan, dan rencana

| Berkas | Isi |
| --- | --- |
| `laporan-pengujian.md` | Laporan tiap putaran (A.n): apa yang diubah, apa yang **dijalankan** dan hasilnya, batasan jujurnya. Daftar lengkap harness + hasil terakhir ada di **A.66.1** |
| `penjelasan-fitur.md` | Penjelasan fitur untuk juri & guru (bagian per tema) |
| `catatan-demo.md` | Cara mendemokan aplikasi, termasuk akun demo dan alamat tiap layanan |
| `jurnal-prompt.md` | Jurnal prompt (maksimal 5 entri) — rujukan tanggal-jam menunjuk ke log mentah |
| `rencana-desain-putaran3.md` | Rencana desain yang belum seluruhnya dikerjakan |
| `handoff-sesi.md` | **Internal, bukan untuk panitia**: keadaan repo, papan pending, dan cara melanjutkan sesi berikutnya |

## Log mentah (`log-mentah/`)

Satu folder per sesi, isinya apa adanya dan tidak boleh disunting:

- `<sesi>/chat-messages.json.gz` — salinan **byte-exact** berkas chat asli. Periksa dengan
  `gzip -dc <folder>/chat-messages.json.gz | md5`; harus sama dengan `chat_messages_md5` di `info.json`.
- `<sesi>/transkrip.md` — transkrip utuh tanpa potong (prompt, lampiran prompt, balasan, seluruh argumen alat).
- `<sesi>/info.json` — jumlah pesan, ukuran, md5, dan waktu ekspor.
- `tangkapan/` — potret layar bukti visual (mis. `palet-terang.png`, `adegan-gunung-gelap.png`).
- `eksternal/` — prompt & log pekerjaan AI lain di luar repo ini, apa adanya.
- `README.md` — **indeks ringkas semua sesi** (jumlah pesan, ukuran, md5), dibuat ulang tiap ekspor.

Segarkan log: `python3 docs/export-log-sesi.py` (semua sesi) atau
`python3 docs/export-log-sesi.py <dir_sesi>` (satu sesi). Skrip membaca berkas sesi **per pesan** sehingga
sesi ratusan MB tidak perlu dimuat utuh ke memori.

## Alat & harness

Runner menyalakan dan mematikan sendiri layanan yang belum hidup, jadi cukup satu perintah:

```bash
docs/jalankan-smoke-ui.sh <nama>     # harness browser biasa, mis. susun / kuis-materi / slice07 / nav
docs/jalankan-smoke-materi.sh        # pemutar materi + kuis sisipan (layanan sendiri)
docs/jalankan-smoke-perjalanan.sh    # peta perjalanan bertema (layanan sendiri)
docs/jalankan-tangkap-halaman.sh     # tangkapan layar tiap halaman
docs/jalankan-bukti-editor.sh        # bukti editor materi di beberapa lebar
```

Harness yang dipanggil runner dan/atau dijalankan langsung:

| Berkas | Jenis |
| --- | --- |
| `smoke-ui-*.mjs` | Harness GUI Chrome/CDP per fitur (daftar 30 harness + hasilnya: `laporan-pengujian.md` A.66.1) |
| `smoke-http-fitur.mjs` | Pemeriksaan HTTP murni (~247 pemeriksaan); butuh backend + realtime hidup |
| `audit-ui.mjs` | Audit tata letak & kontras semua halaman (`[filter] [--gelap]`) |
| `ukur-bundel-peramban.mjs` | Mengukur berkas JS yang benar-benar diminta di peramban (butuh `npm run build` + `vite preview`) |
| `tangkap-*.mjs` | Alat potret layar: adegan gunung, palet, editor materi, semua halaman |

Alat ekspor: `export-word.sh` (Word + log mentah), `export-log-sesi.py` (log mentah), `export_docx.py`
(Markdown → docx), `export_word_sesi.py` (bonus: docx log mentah super-lengkap dari berkas sesi asli).

## Desain & bukti lain

- `desain/` — mockup HTML (`*.dc.html`) + `canvas.json`, acuan visual saat membangun layar.
- `bukti-konfirmasi-panitia/` — bukti/konfirmasi terkait lomba (lihat `README.md` di dalamnya).

## Aturan singkat

1. Log mentah **tidak disunting, tidak diringkas, tidak dipotong** — perbaiki skripnya, bukan isinya.
2. Setiap putaran dicatat di `laporan-pengujian.md`, dengan pemisahan jujur antara “sudah dijalankan” dan
   “ditulis tapi belum dijalankan”.
3. Bukti tata letak/perilaku datang dari harness di peramban sungguhan, bukan dari klaim; jalankan
   `./verify.sh` (di akar repo) untuk pagar mutu tanpa layanan.
