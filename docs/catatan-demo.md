# Catatan Demo

Cara menjalankan dan mendemokan aplikasi pada setiap akhir slice.
Semua perintah dijalankan dari root repo `lomba_m`.

## Menjalankan ketiga layanan (slice 00)

```bash
# 1. Backend (Laravel, http://localhost:8000)
cd backend && php artisan serve

# 2. Frontend (Vite, http://localhost:5173)
cd frontend && npm run dev

# 3. Realtime (Fastify + SSE, http://localhost:4000)
cd realtime && npm run dev
```

Pemeriksaan kesehatan:
- Backend: `curl http://localhost:8000/api/health` → JSON `{"ok":true,...}`
- Frontend: buka http://localhost:5173 → halaman demo tema + toast + ikon
- Realtime: `curl http://localhost:4000/health` → JSON `{"ok":true,...}`

## Pagar mutu

```bash
./verify.sh   # dari root repo; wajib hijau tiap akhir slice
```

## Demo per slice (rencana)

- **Slice 00**: ketiga layanan hidup; halaman demo tema (palet guru/murid, mode terang), toast, ikon SVG; hasil verify hijau.
- **Slice 01**: daftar + verifikasi email + login murid; guru dari seeder; proteksi throttle dan enumerasi.
- **Slice 02**: kelola kelas/mapel/murid; impor CSV contoh; ubah pengaturan tiga lapis.
- **Slice 03**: buat bank soal + kuis; editor soal objektif dengan preview MathML.
- **Slice 04**: kerjakan kuis penuh sampai hasil (pengacakan, autosave, submit idempoten, deadline).
- **Slice 05**: retry, ranking, badge, remedial, laporan per tag.
- **Slice 06**: koreksi manual isian/uraian dengan token konfirmasi.
- **Slice 07**: Live Monitor SSE + presence + proteksi anti-cheat aktif.
- **Slice 08**: unggah materi, layar guru ke murid, avatar + laporan.
- **Slice 09**: upload jawaban (gambar/rekam/file), saran penilaian AI, mode tim.
- **Slice 10**: cache L1, mode gelap, Octane Swoole, demo dari link deploy VPS.

---

## Demo Slice 02 — Sekolah, Kelas, Mapel, Murid, Impor/Ekspor CSV, Pengaturan Tiga Lapis

Prasyarat: backend `php artisan serve` (port 8000) dan frontend `npm run dev` (port 5173) hidup; database sudah di-seed:

```bash
cd backend && php artisan migrate:fresh --seed
```

Seeder membuat sekolah contoh, 3 kelas (6A/6B/5A), 3 mapel, dan akun admin `admin@sekolah.test` / `Passw0rd!Aman`.

### Langkah demo (antarmuka http://localhost:5173)

1. Masuk sebagai guru/admin (`admin@sekolah.test`). Menu **Kelas · Mapel · Murid · Pengaturan** muncul (hanya guru/admin).
2. **Kelas**: tambah "4A" tingkat 4 → muncul di tabel; ubah/hapus berfungsi.
3. **Mapel**: tambah "Seni Budaya" kode SBD.
4. **Murid → Impor CSV**: unggah `backend/database/data/contoh-murid.csv` → laporan "4 baris berhasil diimpor, 0 baris gagal". Coba berkas dengan email salah / kelas tidak ada → muncul laporan galat per baris (maks 100 baris).
5. **Murid → Ekspor CSV**: tautan Ekspor mengunduh CSV (kolom `nis,nisn,nama,email,kelas`).
6. **Pengaturan**: nonaktifkan "Izinkan ulangan ulang (retry)" di lapis **Sekolah**; pilih lapis **Kelas** → nilai kelas menimpa sekolah; centang **"Kunci di sekolah"** → nilai sekolah menang.
7. Masuk sebagai murid hasil impor (impor dengan kolom `kata_sandi`) → murid melihat pengaturan yang berlaku, tetapi tidak bisa mengubahnya.

### Bukti lewat API (curl)

Lihat `docs/laporan-pengujian.md` bagian A.4.3 — smoke nyata: csrf → login admin → impor 4 murid → daftar → ekspor CSV → set pengaturan → login murid → murid melihat `retry=false` → murid ubah = 403.

---

## Demo Slice 03 — Bank Soal, Tag, dan Kuis (Soal Objektif)

Prasyarat: backend `php artisan serve` (8000), frontend `npm run dev` (5173), database sudah dimigrasi dan di-seed:

```bash
cd backend && php artisan migrate --force && php artisan db:seed
```

`BankSoalSeeder` (idempoten) menyiapkan: tag **Operasi Hitung**, 4 soal (satu per tipe objektif),
kuis draf **Latihan Operasi Hitung (draf)**, dan kuis terbit **Ulangan Operasi Hitung** untuk kelas 5A.

### Langkah demo (antarmuka http://localhost:5173, masuk sebagai guru `admin@sekolah.test`)

1. **Menu**: setelah masuk, menu guru bertambah menjadi **Kelas · Mapel · Murid · Bank Soal · Tag · Kuis · Pengaturan**.
2. **Tag**: buka **Tag** → tambah "Pecahan" (deskripsi bebas) → muncul di tabel bersama jumlah soal yang memakainya. Tag ini juga dipakai sebagai tema pemahaman di laporan (slice 05).
3. **Bank Soal**: buka **Bank Soal** → saring per mapel/tag/tipe → **Tambah soal**:
   - pilih mapel Matematika, tipe **Pilihan ganda**, tulis soal, isi opsi A–D, tandai satu radio sebagai **kunci**, isi skor → **Simpan soal**;
   - coba juga tipe **Benar/salah**, **Menjodohkan** (isi kiri + kanan + pasangan), dan **Mengurutkan** (isi nomor urut benar tiap item);
   - pratinjau di bawah formulir memakai renderer yang sama dengan layar murid, kunci ditandai lencana kuning;
   - opsi **Media & MathML** menerima alamat gambar dan template MathML (dirender native, bukan gambar);
   - mengosongkan isi soal lalu menekan Simpan menampilkan daftar galat berbahasa Indonesia (bukan 422 mentah).
4. **Kuis**: buka **Kuis** → isi formulir (judul, mapel, kelas, durasi, jadwal mulai/selesai, acak soal/opsi) → **Buat kuis** (status **Draf**).
   - **Susun soal** → centang soal dari bank soal, atur urutan dengan ↑/↓ → **Simpan susunan**;
   - **Terbitkan** → bila soal/jadwal belum lengkap, muncul pesan galat yang jelas; bila lengkap, lencana berubah menjadi **Sedang berjalan / Belum dimulai / Selesai** sesuai jadwal;
   - soal yang dipakai kuis yang sedang berjalan tidak bisa diubah/dihapus (server menolak dengan pesan "soal terkunci") — tunjukkan lewat Bank Soal.
5. **Sisi murid**: masuk sebagai murid kelas tersebut → menu **Ulangan Saya** → kuis terbit muncul dengan status dan jumlah soal → **Lihat soal** menampilkan soal **tanpa kunci jawaban dan tanpa pembahasan** (server tidak pernah mengirimkannya). Kuis draf dan kuis kelas lain tidak muncul.

### Bukti lewat browser sungguhan

`docs/smoke-ui-slice03.mjs` (Chrome CDP, port 9333) menjalankan alur ini sendiri: guru membuat tag + satu soal lewat formulir, mengubah jadwal, menyusun 2 soal, menerbitkan kuis; lalu murid uji membuka kuisnya. Hasil terakhir **8/8 lulus** — rincian di `docs/laporan-pengujian.md` bagian A.5.
