#!/usr/bin/env python3
"""Ekspor dokumen Word BONUS: log mentah UTUH dari berkas sesi asli.

Seluruh isi dimasukkan APA ADANYA — tidak dipotong, tidak diringkas:
  1. Log kerja repo docs/log-mentah/*.md (apa adanya)
  2. chat-meta.json
  3. chat-messages.json — transkrip lengkap (lampiran prompt, thinking,
     narasi, tool input+output, ask-user, mode-divider, userError, metadata)
  4. log.jsonl — setiap baris apa adanya
  5. run-state.json — isi mentah apa adanya

Ditulis memakai penulis DOCX ringan (XML mentah + zip) agar sanggup memuat
belasan MB teks tanpa lambat.

Pemakaian:
    python3 export_word_sesi.py <dir_sesi> <tujuan.docx> [dir_log_md]
"""

import hashlib
import html
import json
import os
import sys
import xml.sax.saxutils as saxutils
import zipfile

TT = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
OFFICE_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


def sha256(berkas: str) -> str:
    h = hashlib.sha256()
    with open(berkas, "rb") as f:
        for potong in iter(lambda: f.read(1024 * 1024), b""):
            h.update(potong)
    return h.hexdigest()


def bersih(teks: str) -> str:
    """Bersihkan karakter yang tidak valid di XML, lalu escape."""
    teks = str(teks)
    teks = "".join(c for c in teks if c in "\t\n\r" or ord(c) >= 0x20)
    return saxutils.escape(teks)


UKURAN_JUDUL = {"Judul1": 32, "Judul2": 26, "Judul3": 22}
LEVEL_JUDUL = {"Judul1": 0, "Judul2": 1, "Judul3": 2}


def paragraf(teks, gaya=None):
    """Satu paragraf Word; gaya 'Judul1'/'Judul2'/'Judul3' atau None."""
    isi = bersih(teks)
    if gaya:
        rpr = '<w:rPr><w:b/><w:sz w:val="%d"/></w:rPr>' % UKURAN_JUDUL[gaya]
        ppr = '<w:pPr><w:outlineLvl w:val="%d"/></w:pPr>' % LEVEL_JUDUL[gaya]
        return '<w:p>%s<w:r>%s<w:t xml:space="preserve">%s</w:t></w:r></w:p>' % (ppr, rpr, isi)
    return '<w:p><w:r><w:t xml:space="preserve">%s</w:t></w:r></w:p>' % isi


def tambah_teks(bagian: list, teks) -> None:
    """Tambah teks apa adanya (baris dipertahankan lewat <w:br/>).

    Dikelompokkan ~4000 baris per paragraf agar jumlah paragraf tetap wajar
    sehingga Word tidak berat saat dibuka — isi teks tetap utuh apa adanya.
    """
    if teks is None:
        return
    baris = str(teks).split("\n")
    for i in range(0, len(baris), 4000):
        grup = baris[i : i + 4000]
        runs = "<w:br/>".join(
            '<w:r><w:t xml:space="preserve">%s</w:t></w:r>' % bersih(b) for b in grup
        )
        bagian.append("<w:p>%s</w:p>" % runs)


def tambah_json(bagian: list, nilai) -> None:
    if nilai is None:
        return
    tambah_teks(bagian, json.dumps(nilai, ensure_ascii=False, indent=2))


def tulis_transkrip(bagian: list, berkas: str) -> int:
    pesan = json.load(open(berkas, encoding="utf-8"))
    bagian.append(paragraf("3. chat-messages.json — transkrip lengkap (apa adanya)", "Judul1"))
    tambah_teks(bagian, f"Jumlah pesan: {len(pesan)}")

    for i, m in enumerate(pesan, start=1):
        bagian.append(paragraf(
            f"PESAN {i} · id={m.get('id')} · {m.get('timestamp')} · variant={m.get('variant')}",
            "Judul2",
        ))
        tambah_teks(bagian, f"isComplete={m.get('isComplete')} completionTime={m.get('completionTime')} credits={m.get('credits')}")

        for a in (m.get("textAttachments") or []):
            bagian.append(paragraf("Lampiran teks (utuh)", "Judul3"))
            tambah_teks(bagian, f"id={a.get('id')} charCount={a.get('charCount')}")
            tambah_teks(bagian, a.get("content") or "")

        if m.get("fileAttachments"):
            bagian.append(paragraf("Lampiran berkas", "Judul3"))
            tambah_json(bagian, m.get("fileAttachments"))

        if isinstance(m.get("content"), str) and m["content"].strip() != "":
            bagian.append(paragraf("content", "Judul3"))
            tambah_teks(bagian, m["content"])

        for b in (m.get("blocks") or []):
            jenis = b.get("type")
            if jenis == "text":
                label = "THINKING ASLI" if b.get("textType") == "reasoning" else "NARASI"
                bagian.append(paragraf(f"[TEXT {label}]", "Judul3"))
                tambah_teks(bagian, b.get("text") or "")
            elif jenis == "tool":
                bagian.append(paragraf(f"[TOOL: {b.get('toolName')}]", "Judul3"))
                tambah_teks(bagian, f"toolCallId={b.get('toolCallId')}")
                bagian.append(paragraf("input", "Judul3"))
                tambah_json(bagian, b.get("input"))
                bagian.append(paragraf("output", "Judul3"))
                tambah_teks(bagian, b.get("output"))
            else:
                bagian.append(paragraf(f"[BLOK: {jenis}]", "Judul3"))
                tambah_json(bagian, b)

        if m.get("userError"):
            bagian.append(paragraf("userError", "Judul3"))
            tambah_json(bagian, m.get("userError"))

        if m.get("metadata"):
            bagian.append(paragraf("metadata", "Judul3"))
            tambah_json(bagian, m.get("metadata"))

    return len(pesan)


def tulis_docx(tujuan: str, bagian: list) -> None:
    dokumen = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<w:document xmlns:w="{TT}"><w:body>' + "".join(bagian) + '</w:body></w:document>'
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        "</Types>"
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<Relationships xmlns="{PKG_REL}">'
        f'<Relationship Id="rId1" Type="{OFFICE_REL}/officeDocument" Target="word/document.xml"/>'
        "</Relationships>"
    )
    with zipfile.ZipFile(tujuan, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types)
        z.writestr("_rels/.rels", rels)
        z.writestr("word/document.xml", dokumen)


def utama() -> None:
    if len(sys.argv) < 3:
        print("Pemakaian: export_word_sesi.py <dir_sesi> <tujuan.docx> [dir_log_md]", file=sys.stderr)
        sys.exit(1)

    dir_sesi, tujuan = sys.argv[1], sys.argv[2]
    dir_log_md = sys.argv[3] if len(sys.argv) > 3 else None

    bagian: list = [
        paragraf("Log Mentah Utuh — Berkas Sesi Asli (bonus, tanpa potong/ringkas)", "Judul1"),
    ]

    berkas_sesi = ["chat-meta.json", "chat-messages.json", "log.jsonl", "run-state.json"]
    tambah_teks(bagian, f"Sumber: {dir_sesi}")
    for nama in berkas_sesi:
        jalur = os.path.join(dir_sesi, nama)
        if os.path.exists(jalur):
            tambah_teks(bagian, f"- {nama}: {os.path.getsize(jalur)} byte · sha256 {sha256(jalur)}")
        else:
            tambah_teks(bagian, f"- {nama}: TIDAK DITEMUKAN")

    if dir_log_md and os.path.isdir(dir_log_md):
        bagian.append(paragraf("1. Log kerja repo (docs/log-mentah) — apa adanya", "Judul1"))
        for nama in sorted(os.listdir(dir_log_md)):
            sub = os.path.join(dir_log_md, nama)
            if os.path.isfile(sub) and nama.endswith(".md"):
                bagian.append(paragraf(f"BERKAS: {nama}", "Judul2"))
                tambah_teks(bagian, open(sub, encoding="utf-8").read())

    bagian.append(paragraf("2. chat-meta.json", "Judul1"))
    tambah_teks(bagian, open(os.path.join(dir_sesi, "chat-meta.json"), encoding="utf-8").read())

    jumlah_pesan = tulis_transkrip(bagian, os.path.join(dir_sesi, "chat-messages.json"))

    bagian.append(paragraf("4. log.jsonl — setiap baris apa adanya", "Judul1"))
    jumlah_baris = 0
    with open(os.path.join(dir_sesi, "log.jsonl"), encoding="utf-8") as f:
        for baris in f:
            tambah_teks(bagian, baris.rstrip("\n"))
            jumlah_baris += 1

    bagian.append(paragraf("5. run-state.json — isi mentah apa adanya", "Judul1"))
    tambah_teks(bagian, open(os.path.join(dir_sesi, "run-state.json"), encoding="utf-8").read())

    tulis_docx(tujuan, bagian)
    print(f"OK: {tujuan} · pesan={jumlah_pesan} · baris log.jsonl={jumlah_baris}")


if __name__ == "__main__":
    utama()
