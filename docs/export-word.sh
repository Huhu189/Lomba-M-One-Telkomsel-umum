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
#   - docs/log-mentah/ = log mentah sesi apa adanya, satu folder per sesi:
#       * <sesi>/chat-messages.json.gz (BYTE-EXACT, tidak disunting)
#       * <sesi>/transkrip.md          (transkrip mentah utuh, tidak dipotong)
#       * <sesi>/info.json             (jumlah pesan, ukuran, md5 untuk memeriksa)
#       * README.md                    (indeks ringkas semua sesi)
#       * tangkapan/                   (bukti visual dari putaran pengujian)
#       * <sesi>-eksternal-<alat>/     (sesi AI lain di luar repo: prompt.md + transkrip.md, apa adanya —
#                                       ikut tergabung ke log-mentah.docx karena punya transkrip.md)
#
# Sumber berkas sesi diatur lewat env CHATS_DIR (bawaan: folder chat proyek Freebuff).
# Jalankan ulang setiap akhir slice / tiap commit, lalu komit hasilnya.
#
set -euo pipefail

DOCS="$(cd "$(dirname "$0")" && pwd)"
WORD="$DOCS/word"
LOGDIR="$DOCS/log-mentah"

# Folder chat proyek (semua sesi ada di bawahnya); SESI_DIR opsional untuk membatasi.
CHATS_DIR="${CHATS_DIR:-/Users/marcel.sgmail.com/.config/manicode/projects/Desktop/chats}"
export CHATS_DIR

mkdir -p "$WORD" "$LOGDIR"

if command -v pandoc >/dev/null 2>&1; then
  echo "Alat: pandoc"
else
  echo "pandoc tidak ada — memakai python-docx"
  python3 -c 'import docx' >/dev/null 2>&1 || pip3 install --quiet python-docx
fi

# ---------- 1. segarkan log mentah (gzip byte-exact + transkrip + indeks) ----------
# Tanpa argumen: mengekspor SEMUA sesi yang ada (satu folder per sesi). SESI_DIR masih
# dihormati untuk membatasi ke sesi tertentu.
python3 "$DOCS/export-log-sesi.py"

# ---------- 2. dokumen Word untuk dikumpulkan ----------
konversi() { # konversi <sumber.md> <tujuan.docx>
  if command -v pandoc >/dev/null 2>&1; then pandoc "$1" -o "$2"; else python3 "$DOCS/export_docx.py" "$1" "$2"; fi
}

# Ringkasan prompt: docs/word/AGENT.md adalah sumbernya, docx mengikutinya.
konversi "$WORD/AGENT.md"                     "$WORD/AGENT.docx"
konversi "$DOCS/jurnal-prompt.md"             "$WORD/jurnal-prompt.docx"
# Log mentah: gabungan transkrip SELURUH sesi (urut nama folder = urut waktu), apa adanya.
# Termasuk sesi eksternal (`*-eksternal-<alat>/`): namanya terbaca di berkas gabungan ini, jadi
# pembaca bisa melihat bahwa bagian itu dikerjakan AI lain di luar repo.
TRANSCRIPT=()
for folder in "$LOGDIR"/*/; do
  if [ -f "${folder}transkrip.md" ]; then
    TRANSCRIPT+=("${folder}transkrip.md")
  fi
done

if [ ${#TRANSCRIPT[@]} -gt 0 ]; then
  GABUNG_LOG="$(mktemp)"
  cat "${TRANSCRIPT[@]}" > "$GABUNG_LOG"
  konversi "$GABUNG_LOG" "$WORD/log-mentah.docx"
  rm -f "$GABUNG_LOG"
else
  echo "PERINGATAN: tidak ada transkrip di $LOGDIR — log-mentah.docx dilewati"
fi
konversi "$DOCS/penjelasan-fitur.md"          "$WORD/penjelasan-fitur.docx"
konversi "$DOCS/catatan-demo.md"              "$WORD/catatan-demo.docx"
konversi "$DOCS/laporan-pengujian.md"         "$WORD/laporan-pengujian.docx"

echo "Selesai."
echo "docs/word/ (dokumen untuk dikumpulkan):"
ls -la "$WORD"
echo "docs/log-mentah/ (log mentah apa adanya):"
ls -la "$LOGDIR"
