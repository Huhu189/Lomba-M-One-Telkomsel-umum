#!/usr/bin/env python3
"""Ekspor log mentah sesi prompt (bisa dijalankan ulang).

Menghasilkan dua berkas di `docs/log-mentah/`:

1. `sesi-<tanggal>-chat-messages.json.gz` — salinan **BYTE-EXACT** (gzip) dari
   berkas `chat-messages.json` sesi asli. Tidak disunting, tidak dipotong.
   Sengaja digzip: berkas aslinya ~76 MB, tetapi ~67 MB di antaranya hanyalah
   `metadata.runState` (snapshot state berulang tiap pesan) sehingga setelah
   digzip menjadi ~13 MB — tetap di bawah batas peringatan GitHub 50 MB.
2. `sesi-<tanggal>-transkrip.md` — **bantuan baca**: berisi setiap prompt
   pengguna, lampiran promptnya, dan setiap balasan AI apa adanya. Panggilan
   alat diringkas jadi satu baris supaya tetap terbaca; berkas `.gz` di atas
   tetap menjadi salinan mentah yang sah.

Jalankan ulang setiap akhir slice (dan tiap kali log diperbarui), lalu komit
hasilnya — supaya log mentah selalu mutakhir tanpa membengkakkan riwayat git.

Pemakaian:
    python3 docs/export-log-sesi.py [dir_sesi] [tanggal]
"""

import gzip
import hashlib
import json
import os
import shutil
import sys

DIR_SESI_DEFAULT = (
    "/Users/marcel.sgmail.com/.config/manicode/projects/Desktop/chats/2026-10-05T07-39-24.876Z"
)
TANGGAL_DEFAULT = "2026-10-05"
POTONG_ALAT = 400  # karakter maksimal untuk satu panggilan alat di transkrip


def md5(berkas: str) -> str:
    h = hashlib.md5()
    with open(berkas, "rb") as f:
        for potong in iter(lambda: f.read(1024 * 1024), b""):
            h.update(potong)
    return h.hexdigest()


def gzip_byte_exact(sumber: str, tujuan: str) -> None:
    """Gzip isi berkas apa adanya (byte-exact setelah didekompresi)."""
    with open(sumber, "rb") as masuk, gzip.open(tujuan, "wb", compresslevel=9) as keluar:
        shutil.copyfileobj(masuk, keluar, length=1024 * 1024)


def ringkas(nilai, batas: int = POTONG_ALAT) -> str:
    teks = nilai if isinstance(nilai, str) else json.dumps(nilai, ensure_ascii=False)
    teks = " ".join(teks.split())
    return teks if len(teks) <= batas else teks[:batas] + " …"


def blok_ke_markdown(baris: list, blok: dict) -> None:
    jenis = blok.get("type")
    if jenis == "text":
        label = "Thinking (mentah)" if blok.get("textType") == "reasoning" else "Balasan"
        baris.append(f"**{label}:**\n")
        baris.append((blok.get("content") or "") + "\n")
    elif jenis == "tool":
        baris.append(f"- 🔧 `{blok.get('toolName')}` — {ringkas(blok.get('input'))}")
    elif jenis == "ask-user":
        baris.append(f"- ❓ `ask_user` — {ringkas(blok.get('input'))}")
    elif jenis == "mode-divider":
        baris.append(f"- ⌁ mode: {blok.get('mode')}")
    else:
        baris.append(f"- ▪ blok `{jenis}` — {ringkas(blok)}")


def tulis_transkrip(sesi: str, berkas_chat: str, tujuan: str) -> int:
    pesan = json.load(open(berkas_chat, encoding="utf-8"))
    baris: list = [
        "# Log Mentah — Transkrip Sesi",
        "",
        "Bantuan baca. Seluruh isi di bawah diambil apa adanya dari berkas sesi asli",
        f"(`{os.path.basename(berkas_chat)}`, {os.path.getsize(berkas_chat)} byte, "
        f"md5 `{md5(berkas_chat)}`).",
        "",
        "Salinan **byte-exact** dari berkas aslinya ada di berkas `*.json.gz` di folder yang sama.",
        "Panggilan alat di sini diringkas jadi satu baris agar tetap terbaca; isi lengkapnya ada",
        "di berkas `.gz`. Berkas runtime sesi (`log.jsonl`, `run-state.json`) bukan isi percakapan",
        "sehingga tidak disalin.",
        "",
    ]

    meta = os.path.join(sesi, "chat-meta.json")
    if os.path.exists(meta):
        baris += ["**chat-meta.json:**", "", "```json", open(meta, encoding="utf-8").read().strip(), "```", ""]

    baris += [f"Jumlah pesan: {len(pesan)}", "", "---", ""]

    for i, m in enumerate(pesan, start=1):
        siapa = "USER" if m.get("variant") == "user" else "AI"
        baris.append(f"## [{i:03d}] {siapa} · {m.get('timestamp')}")
        baris.append("")

        for lampiran in m.get("textAttachments") or []:
            baris.append(f"**Lampiran prompt (utuh, {lampiran.get('charCount')} karakter):**")
            baris.append("")
            baris.append("```")
            baris.append((lampiran.get("content") or "").rstrip("\n"))
            baris.append("```")
            baris.append("")

        for lampiran in m.get("fileAttachments") or []:
            baris.append(f"- 📎 berkas: {ringkas(lampiran, 200)}")

        if isinstance(m.get("content"), str) and m["content"].strip():
            baris.append(m["content"].strip())
            baris.append("")

        for blok in m.get("blocks") or []:
            blok_ke_markdown(baris, blok)

        if m.get("userError"):
            baris.append(f"> ⚠ userError: {ringkas(m['userError'])}")

        baris.append("")

    with open(tujuan, "w", encoding="utf-8") as f:
        f.write("\n".join(baris))

    return len(pesan)


def utama() -> None:
    sesi = sys.argv[1] if len(sys.argv) > 1 else DIR_SESI_DEFAULT
    tanggal = sys.argv[2] if len(sys.argv) > 2 else TANGGAL_DEFAULT
    docs = os.path.dirname(os.path.abspath(__file__))
    logdir = os.path.join(docs, "log-mentah")
    os.makedirs(logdir, exist_ok=True)

    asal = os.path.join(sesi, "chat-messages.json")
    if not os.path.exists(asal):
        print(f"LEWAT: berkas sesi tidak ditemukan ({asal})", file=sys.stderr)
        return

    tujuan_gz = os.path.join(logdir, f"sesi-{tanggal}-chat-messages.json.gz")
    tujuan_md = os.path.join(logdir, f"sesi-{tanggal}-transkrip.md")

    gzip_byte_exact(asal, tujuan_gz)
    jumlah = tulis_transkrip(sesi, asal, tujuan_md)

    print(f"OK: {tujuan_gz} ({os.path.getsize(tujuan_gz)} byte)")
    print(f"OK: {tujuan_md} ({os.path.getsize(tujuan_md)} byte) · pesan={jumlah}")


if __name__ == "__main__":
    utama()
