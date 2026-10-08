#!/usr/bin/env bash
#
# export-word.sh — segarkan log mentah + ekspor dokumen Word untuk dikumpulkan.
#
# Kebijakan dokumentasi (revisi):
#   - Dokumen internal/agent tetap Markdown: AGENT.md (root), chunks/*.json, docs/*.md.
#   - docs/word/ = dokumen untuk dikumpulkan, dalam .docx:
#       * AGENT.md + AGENT.docx  -> RINGKASAN prompt (isi identik; teks prompt asli ada di log mentah)
#       * jurnal-prompt.docx     -> jurnal prompt (dari docs/jurnal-prompt.md)
#       * log-mentah.docx        -> log mentah sesi (transkrip utuh tanpa potong)
#       * penjelasan-fitur.docx  -> penjelasan fitur untuk juri & guru
#       * catatan-demo.docx      -> cara mendemokan aplikasi
#       * laporan-pengujian.docx -> apa yang dijalankan dan hasilnya
#   - docs/log-mentah/ = log mentah sesi apa adanya:
#       * sesi-<tanggal>-chat-messages.json.gz (BYTE-EXACT, tidak disunting)
#       * sesi-<tanggal>-transkrip.md          (transkrip mentah utuh, tidak dipotong)
#       * prompt-/log-claude-eksternal.md      (pekerjaan AI lain di luar repo, apa adanya)
#
# Sumber berkas sesi diatur lewat env SESI_DIR (bawaan: direktori sesi chat Freebuff).
# Jalankan ulang setiap akhir slice / tiap commit, lalu komit hasilnya.
#
set -euo pipefail

DOCS="$(cd "$(dirname "$0")" && pwd)"
WORD="$DOCS/word"
LOGDIR="$DOCS/log-mentah"

SESI_DIR="${SESI_DIR:-/Users/marcel.sgmail.com/.config/manicode/projects/Desktop/chats/2026-10-05T07-39-24.876Z}"

mkdir -p "$WORD" "$LOGDIR"

if command -v pandoc >/dev/null 2>&1; then
  echo "Alat: pandoc"
else
  echo "pandoc tidak ada — memakai python-docx"
  python3 -c 'import docx' >/dev/null 2>&1 || pip3 install --quiet python-docx
fi

# ---------- 1. segarkan log mentah (gzip byte-exact + transkrip) ----------
python3 "$DOCS/export-log-sesi.py" "$SESI_DIR"

# ---------- 2. dokumen Word untuk dikumpulkan ----------
konversi() { # konversi <sumber.md> <tujuan.docx>
  if command -v pandoc >/dev/null 2>&1; then pandoc "$1" -o "$2"; else python3 "$DOCS/export_docx.py" "$1" "$2"; fi
}

# Ringkasan prompt: docs/word/AGENT.md adalah sumbernya, docx mengikutinya.
konversi "$WORD/AGENT.md"                     "$WORD/AGENT.docx"
konversi "$DOCS/jurnal-prompt.md"             "$WORD/jurnal-prompt.docx"
konversi "$DOCS/log-mentah/sesi-2026-10-05-transkrip.md" "$WORD/log-mentah.docx"
konversi "$DOCS/penjelasan-fitur.md"          "$WORD/penjelasan-fitur.docx"
konversi "$DOCS/catatan-demo.md"              "$WORD/catatan-demo.docx"
konversi "$DOCS/laporan-pengujian.md"         "$WORD/laporan-pengujian.docx"

echo "Selesai."
echo "docs/word/ (dokumen untuk dikumpulkan):"
ls -la "$WORD"
echo "docs/log-mentah/ (log mentah apa adanya):"
ls -la "$LOGDIR"
