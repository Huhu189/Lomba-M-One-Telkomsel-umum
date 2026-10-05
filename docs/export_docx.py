#!/usr/bin/env python3
"""Konverter markdown sederhana -> .docx (fallback bila pandoc tidak ada).

Isi teks dipertahankan apa adanya (tanpa dirapikan/dipersingkat):
baris kode ditampilkan monospace, heading diberi gaya judul, sisanya paragraf.
Pemakaian: python3 export_docx.py <sumber.md> <tujuan.docx>
"""

import sys

from docx import Document
from docx.shared import Pt


def tambah_paragraf(doc: "Document", teks: str, gaya: str | None = None) -> None:
    p = doc.add_paragraph(style=gaya)
    run = p.add_run(teks)
    if gaya is None and teks.startswith("    "):
        run.font.name = "Courier New"
        run.font.size = Pt(9)


def utama() -> None:
    if len(sys.argv) != 3:
        print("Pemakaian: export_docx.py <sumber.md> <tujuan.docx>", file=sys.stderr)
        sys.exit(1)

    sumber, tujuan = sys.argv[1], sys.argv[2]
    doc = Document()
    dalam_kode = False

    with open(sumber, encoding="utf-8") as f:
        for baris in f.read().splitlines():
            if baris.strip().startswith("```"):
                dalam_kode = not dalam_kode
                continue
            if dalam_kode:
                tambah_paragraf(doc, baris)
            elif baris.startswith("# "):
                doc.add_heading(baris[2:].strip(), level=1)
            elif baris.startswith("## "):
                doc.add_heading(baris[3:].strip(), level=2)
            elif baris.startswith("### "):
                doc.add_heading(baris[4:].strip(), level=3)
            elif baris.strip().startswith("- "):
                tambah_paragraf(doc, baris.strip()[2:], gaya="List Bullet")
            elif baris.strip().startswith("* "):
                tambah_paragraf(doc, baris.strip()[2:], gaya="List Bullet")
            elif baris.strip() == "---":
                doc.add_paragraph("─" * 40)
            else:
                tambah_paragraf(doc, baris)

    doc.save(tujuan)
    print(f"OK: {tujuan}")


if __name__ == "__main__":
    utama()
