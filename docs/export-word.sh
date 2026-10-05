#!/usr/bin/env bash
#
# export-word.sh — ekspor dokumen pengumpulan ke docs/word/ (chunk rules-lomba butir 6).
# Jalankan ulang setiap akhir slice lalu komit hasilnya.
#   AGENT.docx            <- AGENT.md
#   jurnal-prompt.docx    <- docs/jurnal-prompt.md
#   log-mentah.docx       <- gabungan seluruh berkas docs/log-mentah/ (isi apa adanya,
#                            dengan tanggal dan jam asli tiap entri di dalam berkasnya)
#   catatan-demo.docx     <- docs/catatan-demo.md
# Menggunakan pandoc bila tersedia; bila tidak, python-docx (alat dev di luar aplikasi).
#
set -euo pipefail

DOCS="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DOCS/.." && pwd)"
OUT="$DOCS/word"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

mkdir -p "$OUT"

# Gabungkan log mentah apa adanya (tanpa menyunting isi; hanya label nama berkas sebagai pemisah).
: > "$TMP"
for berkas in "$DOCS"/log-mentah/*.md; do
  [ -e "$berkas" ] || continue
  printf '\n\n===== BERKAS: %s =====\n\n' "$(basename "$berkas")" >> "$TMP"
  cat "$berkas" >> "$TMP"
  printf '\n' >> "$TMP"
done

if command -v pandoc >/dev/null 2>&1; then
  echo "Menggunakan pandoc…"
  pandoc "$ROOT/AGENT.md"            -o "$OUT/AGENT.docx"
  pandoc "$DOCS/jurnal-prompt.md"    -o "$OUT/jurnal-prompt.docx"
  pandoc "$TMP"                      -o "$OUT/log-mentah.docx"
  pandoc "$DOCS/catatan-demo.md"     -o "$OUT/catatan-demo.docx"
  echo "Selesai (pandoc):"
else
  echo "pandoc tidak ada — memakai python-docx…"
  if ! python3 -c 'import docx' >/dev/null 2>&1; then
    pip3 install --quiet python-docx
  fi
  python3 "$DOCS/export_docx.py" "$ROOT/AGENT.md"         "$OUT/AGENT.docx"
  python3 "$DOCS/export_docx.py" "$DOCS/jurnal-prompt.md" "$OUT/jurnal-prompt.docx"
  python3 "$DOCS/export_docx.py" "$TMP"                   "$OUT/log-mentah.docx"
  python3 "$DOCS/export_docx.py" "$DOCS/catatan-demo.md"  "$OUT/catatan-demo.docx"
  echo "Selesai (python-docx):"
fi

ls -la "$OUT"
