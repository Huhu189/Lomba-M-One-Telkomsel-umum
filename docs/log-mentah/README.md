# Log mentah — indeks sesi

Seluruh berkas di folder ini **apa adanya** (tidak disunting, tidak diringkas). Satu folder per sesi:

- `chat-messages.json.gz` — salinan **byte-exact** berkas sesi asli (gzip -9). Periksa dengan
  `gzip -dc <folder>/chat-messages.json.gz | md5`; hasilnya harus sama dengan `chat_messages_md5`
  di `info.json` folder itu.
- `transkrip.md` — transkrip mentah **utuh tanpa potong** (setiap prompt, lampiran prompt, balasan,
  dan seluruh argumen panggilan alat).
- `info.json` — angka sesi (jumlah pesan, ukuran, md5) beserta waktu ekspor.

Untuk sesi **eksternal** (pekerjaan AI lain di luar repo, mis. Claude), folder sesinya tidak berisi
berkas chat asli — yang ada `prompt.md` (prompt aslinya, apa adanya) + `transkrip.md` (catatannya,
apa adanya) + `info.json`. Folder itu diberi akhiran `-eksternal-…` supaya tetap terbaca sebagai
pekerjaan luar repo: isinya bukan bukti sampai diverifikasi ulang di repo ini.

Berkas bukti lain:

- `tangkapan/` — potret layar bukti visual dari putaran-putaran pengujian.

## Daftar sesi

| Sesi | Tanggal | Sumber | Pesan | `chat-messages.json` | md5 isi | `.json.gz` | `transkrip.md` |
| --- | --- | --- | --- | --- | --- | --- |
| `2026-10-05T07-39-24.876Z` | 2026-10-05 | Freebuff | 539 | 412.229.403 B | `ccc58e6bc00045be22af061f89e10f3b` | 68.581.188 B | 26.819.105 B |
| `2026-10-10T06-22-04.000Z-eksternal-claude` | 2026-10-10 | Claude (di luar repo) | — | — | — | — | 97.740 B |
| `2026-10-12T13-01-29.434Z` | 2026-10-12 | Freebuff | 2 | 543.490 B | `95fd0cf34bc893b13ef57b0903777b55` | 160.367 B | 212.377 B |
| `2026-10-13T12-30-29.489Z` | 2026-10-13 | Freebuff | 182 | 146.464.248 B | `592b0ee32a08dcc9ab65d6b034e9ca22` | 24.151.449 B | 10.310.777 B |

Baris bersumber **Claude (di luar repo)** adalah pekerjaan AI lain yang disalin masuk pengguna:
kolom chat-nya bertanda `—` karena tidak ada berkas chat asli. Urutan baris = urut nama folder = urut waktu.

Indeks ini **dibuat ulang** setiap kali ekspor dijalankan, jadi angkanya mengikuti berkas yang ada.

## Menyegarkan

```bash
python3 docs/export-log-sesi.py            # semua sesi di folder chat proyek ini
python3 docs/export-log-sesi.py <dir_sesi> # hanya satu sesi tertentu
```

Skrip membaca berkas sesi **per pesan** (bukan sekaligus), jadi sesi 412 MB pun hanya memakai
ratusan MB memori. `.gz` dan `transkrip.md` ditulis ulang dari sumber, `info.json` + indeks ini
ikut diperbarui.
