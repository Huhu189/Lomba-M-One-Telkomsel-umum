#!/usr/bin/env python3
"""Ekspor log mentah sesi prompt (bisa dijalankan ulang).

Menghasilkan dua berkas di `docs/log-mentah/`:

1. `sesi-<tanggal>-chat-messages.json.gz` — salinan **BYTE-EXACT** (gzip) dari
   berkas `chat-messages.json` sesi asli. Tidak disunting, tidak dipotong.
   Sengaja digzip: berkas aslinya ~76 MB, tetapi ~67 MB di antaranya hanyalah
   `metadata.runState` (snapshot state berulang tiap pesan) sehingga setelah
   digzip menjadi ~13 MB — tetap di bawah batas peringatan GitHub 50 MB.
2. `sesi-<tanggal>-transkrip.md` — transkrip mentah yang enak dibaca: berisi
   setiap prompt pengguna, lampiran promptnya, setiap balasan/thinking AI, dan
   setiap panggilan alat **utuh apa adanya tanpa dipotong**. Berkas `.gz` di
   atas tetap menjadi salinan byte-exact dari berkas sesi aslinya.

Jalankan ulang setiap akhir slice (dan tiap kali log diperbarui), lalu komit
hasilnya — supaya log mentah selalu mutakhir tanpa membengkakkan riwayat git.

Pemakaian:
    python3 docs/export-log-sesi.py [dir_sesi] [tanggal]
"""

import gzip
import hashlib
import json
import os
import sys

DIR_SESI_DEFAULT = (
    "/Users/marcel.sgmail.com/.config/manicode/projects/Desktop/chats/2026-10-05T07-39-24.876Z"
)
TANGGAL_DEFAULT = "2026-10-05"
POTONG_ALAT = None  # None = tanpa potong: transkrip memuat isi mentah utuh apa adanya


def gzip_byte_exact(sumber: str, tujuan: str) -> tuple:
    """Gzip isi berkas apa adanya (byte-exact setelah didekompresi).

    Mengembalikan `(ukuran_asli, md5_isi)` dari salinan yang ditulis, supaya
    transkrip bisa menyebut angka yang benar-benar ada di berkas `.gz` ini.
    """
    h = hashlib.md5()
    ukuran = 0
    with open(sumber, "rb") as masuk, gzip.open(tujuan, "wb", compresslevel=9) as keluar:
        while True:
            potong = masuk.read(1024 * 1024)
            if not potong:
                break
            ukuran += len(potong)
            h.update(potong)
            keluar.write(potong)
    return ukuran, h.hexdigest()


def ringkas(nilai, batas: int | None = POTONG_ALAT) -> str:
    teks = nilai if isinstance(nilai, str) else json.dumps(nilai, ensure_ascii=False)
    if batas is None:
        return teks
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


def tulis_transkrip(sesi: str, berkas_gz: str, tujuan: str, ukuran: int, md5_isi: str) -> int:
    # Dibaca dari berkas .gz (salinan byte-exact), bukan dari berkas sesi hidup,
    # supaya transkrip selalu sepadan dengan berkas mentah yang ikut dikumpulkan.
    with gzip.open(berkas_gz, "rt", encoding="utf-8") as f:
        pesan = json.load(f)
    baris: list = [
        "# Log Mentah — Transkrip Sesi",
        "",
        "Transkrip mentah isi sesi. Seluruh isi di bawah diambil apa adanya dari berkas",
        f"sesi asli (`chat-messages.json`, {ukuran} byte, md5 `{md5_isi}`).",
        "",
        "Salinan **byte-exact** dari berkas aslinya ada di berkas `*.json.gz` di folder yang sama.",
        "Isi di bawah ini **utuh tanpa dipotong** — termasuk seluruh argumen panggilan alat.",
        "Berkas runtime sesi (`log.jsonl`, `run-state.json`) bukan isi percakapan",
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
            baris.append(f"- 📎 berkas: {ringkas(lampiran)}")

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

    ukuran, md5_isi = gzip_byte_exact(asal, tujuan_gz)
    jumlah = tulis_transkrip(sesi, tujuan_gz, tujuan_md, ukuran, md5_isi)

    print(f"OK: {tujuan_gz} ({os.path.getsize(tujuan_gz)} byte) · asli={ukuran} byte · md5={md5_isi}")
    print(f"OK: {tujuan_md} ({os.path.getsize(tujuan_md)} byte) · pesan={jumlah}")


if __name__ == "__main__":
    utama()
