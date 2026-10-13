# Log mentah — indeks sesi

Seluruh berkas di folder ini **apa adanya** (tidak disunting, tidak diringkas). Satu folder per sesi:

- `chat-messages.json.gz` — salinan **byte-exact** berkas sesi asli (gzip -9). Periksa dengan
  `gzip -dc <folder>/chat-messages.json.gz | md5`; hasilnya harus sama dengan `chat_messages_md5`
  di `info.json` folder itu.
- `transkrip.md` — transkrip mentah **utuh tanpa potong** (setiap prompt, lampiran prompt, balasan,
  dan seluruh argumen panggilan alat).
- `info.json` — angka sesi (jumlah pesan, ukuran, md5) beserta waktu ekspor.

Berkas bukti lain:

- `tangkapan/` — potret layar bukti visual dari putaran-putaran pengujian.
- `eksternal/` — prompt & log pekerjaan AI lain di luar repo ini, apa adanya.

## Daftar sesi

| Sesi | Tanggal | Pesan | `chat-messages.json` | md5 isi | `.json.gz` | `transkrip.md` |
| --- | --- | --- | --- | --- | --- | --- |
| `2026-10-05T07-39-24.876Z` | 2026-10-05 | 539 | 412.229.403 B | `ccc58e6bc00045be22af061f89e10f3b` | 68.581.188 B | 26.819.105 B |
| `2026-10-12T13-01-29.434Z` | 2026-10-12 | 2 | 543.490 B | `95fd0cf34bc893b13ef57b0903777b55` | 160.367 B | 212.377 B |
| `2026-10-13T12-30-29.489Z` | 2026-10-13 | 6 | 5.915.447 B | `0e42cbd85a30234902cd6922d0ae26e7` | 947.745 B | 306.721 B |

Indeks ini **dibuat ulang** setiap kali ekspor dijalankan, jadi angkanya mengikuti berkas yang ada.

## Menyegarkan

```bash
python3 docs/export-log-sesi.py            # semua sesi di folder chat proyek ini
python3 docs/export-log-sesi.py <dir_sesi> # hanya satu sesi tertentu
```

Skrip membaca berkas sesi **per pesan** (bukan sekaligus), jadi sesi 412 MB pun hanya memakai
ratusan MB memori. `.gz` dan `transkrip.md` ditulis ulang dari sumber, `info.json` + indeks ini
ikut diperbarui.
