#!/usr/bin/env python3
"""Ekspor log mentah sesi prompt (streaming, bisa dijalankan ulang).

Berkas sesi aslinya bisa sangat besar (sesi utama 5 Okt 2026 = **412 MB**, 539
pesan; sebagian besar isinya `metadata.runState` yang berulang tiap pesan).
Karena itu berkasnya **tidak pernah dimuat utuh ke memori**: array JSON dibaca
pesan-per-pesan lewat `json.JSONDecoder.raw_decode`, jadi puncak pemakaian
memori tetap ratusan MB (terukur 262 MB untuk berkas 412 MB) dan aman di mesin
8 GB.

Yang dihasilkan, satu folder per sesi:

    docs/log-mentah/<id-sesi>/chat-messages.json.gz  salinan BYTE-EXACT (gzip -9)
    docs/log-mentah/<id-sesi>/transkrip.md           transkrip utuh tanpa potong
    docs/log-mentah/<id-sesi>/info.json              angka + md5 untuk diperiksa

plus `docs/log-mentah/README.md` = indeks ringkas semua sesi (dibuat ulang tiap
kali skrip ini dijalankan, jadi angkanya tidak pernah basi).

Pemakaian:

    python3 docs/export-log-sesi.py                 # semua sesi yang ada di folder chat
    python3 docs/export-log-sesi.py <dir_sesi> ...  # hanya sesi tertentu
    CHATS_DIR=/path/lain python3 docs/export-log-sesi.py

Berkas `.gz` tetap menjadi salinan byte-exact dari berkas sesi aslinya — jangan
disunting. Jalankan ulang setiap akhir putaran, lalu komit hasilnya.
"""

import gzip
import hashlib
import json
import os
import sys
import time
from datetime import datetime

# Folder chat proyek ini (satu folder per sesi, masing-masing berisi chat-messages.json).
CHATS_DEFAULT = "/Users/marcel.sgmail.com/.config/manicode/projects/Desktop/chats"

POTONG_ALAT = None  # None = tanpa potong: transkrip memuat isi mentah utuh apa adanya


def id_sesi(dir_sesi: str) -> str:
    return os.path.basename(os.path.normpath(dir_sesi))


def berkas_sesi(dir_sesi: str) -> str:
    return os.path.join(dir_sesi, "chat-messages.json")


def sesi_terdaftar(chats: str) -> list:
    """Semua sesi yang punya `chat-messages.json` tidak kosong, urut nama (= urut waktu)."""
    if not os.path.isdir(chats):
        return []

    daftar = []

    for nama in sorted(os.listdir(chats)):
        jalur = os.path.join(chats, nama)
        berkas = berkas_sesi(jalur)

        if os.path.isfile(berkas) and os.path.getsize(berkas) > 0:
            daftar.append(jalur)

    return daftar


def md5_berkas(berkas: str) -> tuple:
    """(ukuran, md5) isi berkas — dipakai untuk membuktikan salinan byte-exact."""
    h = hashlib.md5()
    ukuran = 0

    with open(berkas, "rb") as f:
        while True:
            potong = f.read(1024 * 1024)

            if not potong:
                break

            ukuran += len(potong)
            h.update(potong)

    return ukuran, h.hexdigest()


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


def ringkas(nilai, batas=POTONG_ALAT) -> str:
    teks = nilai if isinstance(nilai, str) else json.dumps(nilai, ensure_ascii=False)

    if batas is None:
        return teks

    teks = " ".join(teks.split())

    return teks if len(teks) <= batas else teks[:batas] + " …"


def tulis_blok(keluar, blok: dict) -> None:
    jenis = blok.get("type")

    if jenis == "text":
        label = "Thinking (mentah)" if blok.get("textType") == "reasoning" else "Balasan"
        keluar.write(f"**{label}:**\n\n{(blok.get('content') or '').rstrip()}\n\n")
    elif jenis == "tool":
        keluar.write(f"- 🔧 `{blok.get('toolName')}` — {ringkas(blok.get('input'))}\n")
    elif jenis == "ask-user":
        keluar.write(f"- ❓ `ask_user` — {ringkas(blok.get('input'))}\n")
    elif jenis == "mode-divider":
        keluar.write(f"- ⌁ mode: {blok.get('mode')}\n")
    else:
        keluar.write(f"- ▪ blok `{jenis}` — {ringkas(blok)}\n")


def tulis_pesan(keluar, nomor: int, pesan: dict) -> None:
    siapa = "USER" if pesan.get("variant") == "user" else "AI"
    keluar.write(f"## [{nomor:03d}] {siapa} · {pesan.get('timestamp')}\n\n")

    for lampiran in pesan.get("textAttachments") or []:
        keluar.write(f"**Lampiran prompt (utuh, {lampiran.get('charCount')} karakter):**\n\n```\n")
        keluar.write((lampiran.get("content") or "").rstrip("\n") + "\n```\n\n")

    for lampiran in pesan.get("fileAttachments") or []:
        keluar.write(f"- 📎 berkas: {ringkas(lampiran)}\n")

    if isinstance(pesan.get("content"), str) and pesan["content"].strip():
        keluar.write(pesan["content"].strip() + "\n\n")

    for blok in pesan.get("blocks") or []:
        tulis_blok(keluar, blok)

    if pesan.get("userError"):
        keluar.write(f"> ⚠ userError: {ringkas(pesan['userError'])}\n")

    keluar.write("\n")


def tulis_transkrip(dir_sesi: str, berkas_gz: str, tujuan: str, ukuran: int, md5_isi: str) -> int:
    """Tulis transkrip utuh: badan dulu ke berkas sementara, lalu disatukan dengan kepala."""
    sementara = tujuan + ".tmp"
    jumlah = 0

    with open(sementara, "w", encoding="utf-8") as keluar:
        # Dibaca dari berkas .gz (salinan byte-exact), bukan dari berkas sesi hidup,
        # supaya transkrip selalu sepadan dengan berkas mentah yang ikut dikumpulkan.
        with gzip.open(berkas_gz, "rt", encoding="utf-8") as masuk:
            for pesan in pesan_berurutan(masuk):
                jumlah += 1
                tulis_pesan(keluar, jumlah, pesan)

    with open(tujuan, "w", encoding="utf-8") as keluar:
        keluar.write("# Log Mentah — Transkrip Sesi\n\n")
        keluar.write(f"Sesi: `{id_sesi(dir_sesi)}`\n\n")
        keluar.write("Transkrip mentah isi sesi. Seluruh isi di bawah diambil apa adanya dari berkas\n")
        keluar.write(f"sesi asli (`chat-messages.json`, {ukuran} byte, md5 `{md5_isi}`).\n\n")
        keluar.write("Salinan **byte-exact** dari berkas aslinya ada di `chat-messages.json.gz` di folder yang sama\n")
        keluar.write("(periksa: `gzip -dc chat-messages.json.gz | md5` harus sama dengan md5 di atas).\n")
        keluar.write("Isi di bawah ini **utuh tanpa dipotong** — termasuk seluruh argumen panggilan alat.\n")
        keluar.write("Berkas runtime sesi (`log.jsonl`, `run-state.json`) bukan isi percakapan sehingga tidak disalin.\n\n")
        keluar.write(f"Diekspor: {datetime.now().astimezone().isoformat(timespec='seconds')}\n\n")

        meta = os.path.join(dir_sesi, "chat-meta.json")

        if os.path.exists(meta):
            with open(meta, encoding="utf-8") as f:
                keluar.write("**chat-meta.json:**\n\n```json\n" + f.read().strip() + "\n```\n\n")

        keluar.write(f"Jumlah pesan: {jumlah}\n\n---\n\n")

        with open(sementara, encoding="utf-8") as badan:
            while True:
                potong = badan.read(1 << 20)

                if not potong:
                    break

                keluar.write(potong)

    os.remove(sementara)

    return jumlah


def pesan_berurutan(masuk):
    """Iterasi pesan dari array JSON besar tanpa memuat seluruh berkas ke memori.

    Buffer diisi per 1 MB dan dipangkas tiap pesan selesai dibaca, jadi yang
    tertinggal di memori hanya satu pesan (termasuk `metadata`-nya) + sisa buffer.
    """
    dekoder = json.JSONDecoder()
    buf = ""

    while "[" not in buf:
        potong = masuk.read(1 << 20)

        if not potong:
            return

        buf += potong

    buf = buf[buf.index("[") + 1:]

    while True:
        buf = buf.lstrip()

        if buf.startswith(","):
            buf = buf[1:].lstrip()

        if buf.startswith("]"):
            return

        if not buf:
            potong = masuk.read(1 << 20)

            if not potong:
                return

            buf += potong
            continue

        try:
            nilai, akhir = dekoder.raw_decode(buf)
        except ValueError:
            potong = masuk.read(1 << 20)

            if not potong:
                raise

            buf += potong
            continue

        buf = buf[akhir:]
        yield nilai


def ekspor_satu(dir_sesi: str, logdir: str) -> dict:
    asal = berkas_sesi(dir_sesi)

    if not os.path.exists(asal):
        print(f"LEWAT: berkas sesi tidak ditemukan ({asal})", file=sys.stderr)
        return {}

    sid = id_sesi(dir_sesi)
    tujuan_dir = os.path.join(logdir, sid)
    os.makedirs(tujuan_dir, exist_ok=True)

    tujuan_gz = os.path.join(tujuan_dir, "chat-messages.json.gz")
    tujuan_md = os.path.join(tujuan_dir, "transkrip.md")

    ukuran, md5_isi = gzip_byte_exact(asal, tujuan_gz)
    jumlah = tulis_transkrip(dir_sesi, tujuan_gz, tujuan_md, ukuran, md5_isi)

    info = {
        "sesi": sid,
        "tanggal": sid[:10],
        "pesan": jumlah,
        "chat_messages_json_byte": ukuran,
        "chat_messages_md5": md5_isi,
        "chat_messages_json_gz_byte": os.path.getsize(tujuan_gz),
        "transkrip_md_byte": os.path.getsize(tujuan_md),
        "diekspor": datetime.now().astimezone().isoformat(timespec="seconds"),
        "sumber": dir_sesi,
    }

    with open(os.path.join(tujuan_dir, "info.json"), "w", encoding="utf-8") as f:
        json.dump(info, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"OK: {tujuan_dir} · pesan={jumlah} · json={ukuran} byte (md5 {md5_isi}) · "
          f"gz={info['chat_messages_json_gz_byte']} byte · transkrip={info['transkrip_md_byte']} byte")

    return info


def tulis_indeks(logdir: str, daftar: list) -> None:
    baris = [
        "# Log mentah — indeks sesi",
        "",
        "Seluruh berkas di folder ini **apa adanya** (tidak disunting, tidak diringkas). Satu folder per sesi:",
        "",
        "- `chat-messages.json.gz` — salinan **byte-exact** berkas sesi asli (gzip -9). Periksa dengan",
        "  `gzip -dc <folder>/chat-messages.json.gz | md5`; hasilnya harus sama dengan `chat_messages_md5`",
        "  di `info.json` folder itu.",
        "- `transkrip.md` — transkrip mentah **utuh tanpa potong** (setiap prompt, lampiran prompt, balasan,",
        "  dan seluruh argumen panggilan alat).",
        "- `info.json` — angka sesi (jumlah pesan, ukuran, md5) beserta waktu ekspor.",
        "",
        "Berkas bukti lain:",
        "",
        "- `tangkapan/` — potret layar bukti visual dari putaran-putaran pengujian.",
        "- `eksternal/` — prompt & log pekerjaan AI lain di luar repo ini, apa adanya.",
        "",
        "## Daftar sesi",
        "",
        "| Sesi | Tanggal | Pesan | `chat-messages.json` | md5 isi | `.json.gz` | `transkrip.md` |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]

    for info in daftar:
        ukuran = lambda angka: f"{angka:,}".replace(",", ".")
        baris.append(
            f"| `{info['sesi']}` | {info['tanggal']} | {info['pesan']} | {ukuran(info['chat_messages_json_byte'])} B | "
            f"`{info['chat_messages_md5']}` | {ukuran(info['chat_messages_json_gz_byte'])} B | "
            f"{ukuran(info['transkrip_md_byte'])} B |"
        )

    baris += [
        "",
        "Indeks ini **dibuat ulang** setiap kali ekspor dijalankan, jadi angkanya mengikuti berkas yang ada.",
        "",
        "## Menyegarkan",
        "",
        "```bash",
        "python3 docs/export-log-sesi.py            # semua sesi di folder chat proyek ini",
        "python3 docs/export-log-sesi.py <dir_sesi> # hanya satu sesi tertentu",
        "```",
        "",
        "Skrip membaca berkas sesi **per pesan** (bukan sekaligus), jadi sesi 412 MB pun hanya memakai",
        "ratusan MB memori. `.gz` dan `transkrip.md` ditulis ulang dari sumber, `info.json` + indeks ini",
        "ikut diperbarui.",
        "",
    ]

    with open(os.path.join(logdir, "README.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(baris))


def utama() -> None:
    docs = os.path.dirname(os.path.abspath(__file__))
    logdir = os.path.join(docs, "log-mentah")
    os.makedirs(logdir, exist_ok=True)

    argumen = sys.argv[1:]

    if argumen:
        daftar_sesi = [os.path.abspath(satu) for satu in argumen]
    elif os.environ.get("SESI_DIR"):
        daftar_sesi = [os.path.abspath(satu) for satu in os.environ["SESI_DIR"].split()]
    else:
        daftar_sesi = sesi_terdaftar(os.environ.get("CHATS_DIR", CHATS_DEFAULT))

    if not daftar_sesi:
        print("LEWAT: tidak ada sesi yang ditemukan", file=sys.stderr)
        return

    mulai = time.time()
    hasil = []

    for dir_sesi in daftar_sesi:
        info = ekspor_satu(dir_sesi, logdir)

        if info:
            hasil.append(info)

    tulis_indeks(logdir, sorted(hasil, key=lambda satu: satu["sesi"]))

    print(f"Selesai: {len(hasil)} sesi · {os.path.join(logdir, 'README.md')} · {time.time() - mulai:.1f} dtk")


if __name__ == "__main__":
    utama()
