#!/usr/bin/env bash
#
# export-word.sh — ekspor dokumen Word BONUS (revisi kebijakan dokumentasi).
#
# Kebijakan (revisi dari pengguna):
#   - Dokumen internal/agent (AGENT.md, chunks/, docs/*.md) TETAP .md.
#   - Word adalah dokumentasi BONUS untuk dibaca manusia:
#       * prompt (mentah)              -> docs/word/AGENT.docx (prompt v1 + v2 apa adanya)
#       * ringkasan prompt (jurnal)    -> docs/word/ringkasan-prompt.docx
#       * log mentah UTUH              -> docs/word/log-mentah.docx
#         (diambil dari berkas sesi asli; TIDAK dipotong/diringkas)
#
# Sumber log mentah utuh (bila tersedia): chat-meta.json, chat-messages.json,
# log.jsonl, run-state.json dari direktori sesi. Atur lewat env SESI_DIR.
# Bila SESI_DIR tidak ada, log-mentah.docx diisi dari docs/log-mentah/*.md.
#
# Jalankan ulang setiap akhir slice / tiap commit, lalu komit hasilnya.
#
set -euo pipefail

DOCS="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DOCS/.." && pwd)"
WORD="$DOCS/word"
ARSIP="$DOCS/word-arsip"
SESI_DIR="${SESI_DIR:-/Users/marcel.sgmail.com/.config/manicode/projects/Desktop/chats/2026-10-05T07-39-24.876Z}"

mkdir -p "$WORD" "$ARSIP"

PROMPT_V1="$DOCS/log-mentah/arsip-prompt/2026-10-05-prompt-1-v1.md"
PROMPT_V2="$DOCS/log-mentah/arsip-prompt/2026-10-05-prompt-2-dokumen-acuan-v2.md"

if command -v pandoc >/dev/null 2>&1; then
  echo "Alat: pandoc"
else
  echo "pandoc tidak ada — memakai python-docx / penulis DOCX ringan"
  python3 -c 'import docx' >/dev/null 2>&1 || pip3 install --quiet python-docx
fi

# ---------- prompt mentah (v1 + v2 apa adanya) -> AGENT.docx ----------
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
: > "$TMP"
for berkas in "$PROMPT_V1" "$PROMPT_V2"; do
  printf '\n\n===== %s =====\n\n' "$(basename "$berkas")" >> "$TMP"
  cat "$berkas" >> "$TMP"
  printf '\n' >> "$TMP"
done
python3 "$DOCS/export_docx.py" "$TMP" "$WORD/AGENT.docx"

# ---------- ringkasan prompt (jurnal) -> ringkasan-prompt.docx ----------
python3 "$DOCS/export_docx.py" "$DOCS/jurnal-prompt.md" "$WORD/ringkasan-prompt.docx"

# ---------- log mentah UTUH -> log-mentah.docx ----------
if [ -f "$SESI_DIR/chat-messages.json" ]; then
  python3 "$DOCS/export_word_sesi.py" "$SESI_DIR" "$WORD/log-mentah.docx" "$DOCS/log-mentah"
else
  echo "PERINGATAN: SESI_DIR tidak ada ($SESI_DIR) — memakai docs/log-mentah/*.md"
  TMP_LOG="$(mktemp)"
  trap 'rm -f "$TMP" "$TMP_LOG"' EXIT
  : > "$TMP_LOG"
  while IFS= read -r -d '' berkas; do
    printf '\n\n===== BERKAS: %s =====\n\n' "${berkas#"$DOCS"/}" >> "$TMP_LOG"
    cat "$berkas" >> "$TMP_LOG"
    printf '\n' >> "$TMP_LOG"
  done < <(find "$DOCS/log-mentah" -type f -name '*.md' -print0 | sort -z)
  python3 "$DOCS/export_docx.py" "$TMP_LOG" "$WORD/log-mentah.docx"
fi

# ---------- arsip bukti revisi (awalan "(ARSIP) ") ----------
konversi() { # konversi <sumber> <tujuan>
  if command -v pandoc >/dev/null 2>&1; then pandoc "$1" -o "$2"; else python3 "$DOCS/export_docx.py" "$1" "$2"; fi
}
konversi "$PROMPT_V1"                        "$ARSIP/(ARSIP) prompt-v1.docx"
konversi "$PROMPT_V2"                        "$ARSIP/(ARSIP) prompt-v2.docx"
konversi "$DOCS/log-mentah/2026-10-05-prompt-1.md" "$ARSIP/(ARSIP) laporan-kerja-prompt-1.docx"
konversi "$DOCS/log-mentah/2026-10-05-prompt-2.md" "$ARSIP/(ARSIP) laporan-kerja-prompt-2.docx"
konversi "$DOCS/laporan-pengujian.md"        "$ARSIP/(ARSIP) laporan-pengujian.docx"
konversi "$DOCS/penjelasan-fitur.md"         "$ARSIP/(ARSIP) penjelasan-fitur.docx"
konversi "$DOCS/jurnal-prompt.md"            "$ARSIP/(ARSIP) jurnal-prompt.docx"
konversi "$DOCS/catatan-demo.md"             "$ARSIP/(ARSIP) catatan-demo.docx"

echo "Selesai. docs/word/ (bonus):"
ls -la "$WORD"
echo "docs/word-arsip/ (arsip bukti revisi):"
ls -la "$ARSIP"
