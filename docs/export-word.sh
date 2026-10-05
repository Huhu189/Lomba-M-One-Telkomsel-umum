#!/usr/bin/env bash
#
# export-word.sh — ekspor dokumen Word (revisi tata kelola dari pengguna, prompt 2).
#
# docs/word/      — HANYA 2 dokumen pengumpulan:
#   AGENT.docx        = teks mentah prompt v1 + prompt v2 (dokumen acuan + revisi penting)
#   log-mentah.docx   = gabungan seluruh berkas docs/log-mentah/ ISI APA ADANYA
#                       (dengan tanggal dan jam asli tiap entri di dalam berkasnya;
#                        arsip-prompt ikut karena bagian dari log mentah)
#
# docs/word-arsip/ — arsip bukti revisi, berawalan "(ARSIP) ":
#   (ARSIP) prompt-v1.docx, (ARSIP) prompt-v2.docx  — prompt mentah per berkas
#   (ARSIP) laporan-kerja-prompt-1.docx, (ARSIP) laporan-kerja-prompt-2.docx
#   (ARSIP) laporan-pengujian.docx
#   (ARSIP) jurnal-prompt.docx, (ARSIP) catatan-demo.docx  — docs lama (pra-revisi Word)
#
# Alat: pandoc bila tersedia, bila tidak python-docx (alat dev di luar aplikasi).
# Jalankan ulang setiap akhir slice lalu komit hasilnya.
#
set -euo pipefail

DOCS="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DOCS/.." && pwd)"
WORD="$DOCS/word"
ARSIP="$DOCS/word-arsip"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

mkdir -p "$WORD" "$ARSIP"

# ---------- sumber ----------
PROMPT_V1="$DOCS/log-mentah/arsip-prompt/2026-10-05-prompt-1-v1.md"
PROMPT_V2="$DOCS/log-mentah/arsip-prompt/2026-10-05-prompt-2-dokumen-acuan-v2.md"

# AGENT.docx = prompt mentah v1 + v2 (dokumen acuan dan revisinya, apa adanya)
: > "$TMP"
for berkas in "$PROMPT_V1" "$PROMPT_V2"; do
  printf '\n\n===== %s =====\n\n' "$(basename "$berkas")" >> "$TMP"
  cat "$berkas" >> "$TMP"
  printf '\n' >> "$TMP"
done
SRC_AGENT="$TMP"

# log-mentah.docx = gabungan seluruh docs/log-mentah/ apa adanya (termasuk arsip-prompt)
TMP_LOG="$(mktemp)"
trap 'rm -f "$TMP" "$TMP_LOG"' EXIT
: > "$TMP_LOG"
while IFS= read -r -d '' berkas; do
  printf '\n\n===== BERKAS: %s =====\n\n' "${berkas#"$DOCS"/}" >> "$TMP_LOG"
  cat "$berkas" >> "$TMP_LOG"
  printf '\n' >> "$TMP_LOG"
done < <(find "$DOCS/log-mentah" -type f -name '*.md' -print0 | sort -z)
SRC_LOG="$TMP_LOG"

# ---------- konversi ----------
konversi() { # konversi <sumber.md> <tujuan.docx>
  if command -v pandoc >/dev/null 2>&1; then
    pandoc "$1" -o "$2"
  else
    python3 "$DOCS/export_docx.py" "$1" "$2"
  fi
}

if command -v pandoc >/dev/null 2>&1; then
  echo "Alat: pandoc"
else
  echo "pandoc tidak ada — memakai python-docx"
  python3 -c 'import docx' >/dev/null 2>&1 || pip3 install --quiet python-docx
fi

# docs/word/ — 2 dokumen
konversi "$SRC_AGENT" "$WORD/AGENT.docx"
konversi "$SRC_LOG"   "$WORD/log-mentah.docx"

# docs/word-arsip/ — bukti revisi, awalan (ARSIP)
konversi "$PROMPT_V1"                       "$ARSIP/(ARSIP) prompt-v1.docx"
konversi "$PROMPT_V2"                       "$ARSIP/(ARSIP) prompt-v2.docx"
konversi "$DOCS/log-mentah/2026-10-05-prompt-1.md"       "$ARSIP/(ARSIP) laporan-kerja-prompt-1.docx"
konversi "$DOCS/log-mentah/2026-10-05-prompt-2.md"       "$ARSIP/(ARSIP) laporan-kerja-prompt-2.docx"
konversi "$DOCS/laporan-pengujian.md"        "$ARSIP/(ARSIP) laporan-pengujian.docx"
konversi "$DOCS/penjelasan-fitur.md"          "$ARSIP/(ARSIP) penjelasan-fitur.docx"
konversi "$DOCS/jurnal-prompt.md"            "$ARSIP/(ARSIP) jurnal-prompt.docx"
konversi "$DOCS/catatan-demo.md"             "$ARSIP/(ARSIP) catatan-demo.docx"

echo "Selesai. docs/word/ (2 dokumen):"
ls -la "$WORD"
echo "docs/word-arsip/ (arsip bukti revisi):"
ls -la "$ARSIP"
