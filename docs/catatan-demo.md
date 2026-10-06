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

## Demo Slice 04 — Mengerjakan Ulangan, Penilaian Otomatis, dan Hasil

Prasyarat sama seperti demo slice 03 (backend 8000, frontend 5173, migrasi + seed). Tambahan: jalankan
`php artisan migrate --force` untuk dua migrasi slice 04 (`attempts`, `answers`).

### Langkah demo (murid dan guru)

1. **Guru menyiapkan jadwal** (masuk `admin@sekolah.test`): buka **Kuis** → ubah jadwal kuis terbit agar
   mulai beberapa menit yang lalu dan selesai satu jam ke depan → simpan. Status berubah menjadi
   **Sedang berjalan** pada jam yang benar (lihat A.6.4: kiriman jadwal kini dikonversi ke UTC).
2. **Murid mengerjakan** (masuk `smoke.murid@sekolah.test`, kelas yang sama): menu **Ulangan Saya** →
   tekan **Kerjakan sekarang**.
   - timer berjalan (contoh 20:00) dan berubah warna saat sisa ≤5 menit / ≤1 menit;
   - soal ditampilkan tanpa kunci; setiap jawaban tersimpan otomatis (indikator "Terjawab" bertambah);
   - tutup lalu buka kembali halaman: jawaban tetap ada (dipulihkan dari server + cadangan lokal).
3. **Kumpulkan**: tekan **Kumpulkan jawaban** → konfirmasi → diarahkan ke **halaman hasil**.
   - Uji idempoten: klik/ubah dua kali, atau muat ulang — hasil tidak berubah.
   - Bila waktu habis, jawaban dikumpulkan otomatis oleh klien; server tetap penentu akhir (toleransi
     keterlambatan 120 detik).
4. **Halaman hasil**: menampilkan skor, jumlah benar, nilai (persen), ringkasan penilaian
   (dinilai / perlu tinjau / gagal / belum dijawab), dan rincian per soal — **tanpa kunci jawaban maupun
   pembahasan** (server memang tidak mengirimkannya).

### Bukti lewat browser sungguhan

`docs/smoke-ui-slice04.mjs` (Chrome CDP, port 9333) menjalankan alur ini sendiri: guru menjadwalkan ulang
kuis, murid memilih opsi kunci, autosave diverifikasi lewat API, lalu mengumpulkan dan membuka hasil.
Hasil terakhir **13/13 lulus** — rincian di `docs/laporan-pengujian.md` bagian A.6.

---

## Demo Slice 05 — Skor Asli, Retry, Peringkat, Lencana, Remedial, dan Laporan Tema

Prasyarat sama seperti demo slice 04 (backend 8000, frontend 5173). Tambahan satu migrasi slice 05:

```bash
cd backend && php artisan migrate --force   # 2026_10_06_000012_add_retry_columns_to_attempts_table
```

### Langkah demo (guru)

1. Masuk `admin@sekolah.test`. Menu guru tetap **Kelas · Mapel · Murid · Bank Soal · Tag · Kuis · Pengaturan**;
   laporan dibuka dari **Kuis → detail kuis**.
2. **Pengaturan** (grup **Aturan ulangan / Tampilan & laporan / Laporan & pemahaman**):
   - nyalakan **Izinkan ulangan ulang (retry)** dan atur **Batas percobaan** (mis. 3);
   - biarkan **Tampilkan ranking** mati dulu (memang bawaan mati) — tunjukkan bahwa murid belum melihat peringkat;
   - atur **Ambang paham (%)**, **Ambang mulai paham (%)**, dan **Data minimum per tema**;
   - centang **Kunci di sekolah** bila ingin nilai sekolah mengalahkan pengaturan kelas/kuis.
3. **Kuis → detail kuis → Laporan per tema**: setiap murid kelas ditampilkan dengan lencana **paham / mulai
   paham / belum paham** per tema, plus catatan ambang yang sedang berlaku. Tombol **Lihat peringkat** membuka
   peringkat; tombol **Peringkat** juga tersedia di halaman detail kuis.

### Langkah demo (murid)

4. Masuk `smoke.murid@sekolah.test`. Menu murid: **Ulangan Saya · Progres Tema · Lencana**.
5. **Kerjakan ulang**: buka **Ulangan Saya → Kerjakan sekarang** pada kuis yang sudah pernah dikumpulkan (retry
   menyala) → jawab → **Kumpulkan jawaban**. Halaman hasil menampilkan **skor ulang**; nilai asli tidak berubah.
6. **Progres Tema**: bar per tema + lencana tingkat + bagian **Latihan remedial** berisi soal dari tema lemah
   (tanpa kunci). Jelaskan: remedial hanya menyusun latihan, nilai asli tidak tersentuh.
7. **Lencana**: lencana per mapel (emas ≥ 90, perak ≥ 75, perunggu ≥ 60) dari rata-rata **nilai asli**.
8. **Peringkat** (`/peringkat/:kuisId`, dari halaman hasil atau daftar ulangan):
   - saat saklar ranking masih mati → pesan "Gurumu mematikan tampilan peringkat untuk kelas ini";
   - guru menyalakan **Tampilkan ranking** → murid memuat ulang halaman → tabel tampil, baris sendiri disorot
     (sorot hangat) dengan tanda "(kamu)".
9. **Bukti aturan inti**: setelah beberapa kali retry dengan nilai bagus, peringkat tetap memakai nilai percobaan
   pertama — guru bisa membandingkan di **Laporan per tema** vs **Peringkat**.

### Bukti lewat browser sungguhan

`docs/smoke-ui-slice05.mjs` (Chrome CDP, port 9333) menjalankan alur di atas sendiri: guru mengatur saklar,
murid mengerjakan ulang, halaman peringkat/progres/lencana/laporan dibuka sungguhan, dan peringkat diverifikasi
memakai `attempt_id` asli. Hasil terakhir **17/17 lulus** — rincian di `docs/laporan-pengujian.md` bagian A.7.

---

## Demo Slice 06 — Delapan Tipe Soal + Koreksi Manual Ber-token

Prasyarat sama seperti demo slice 05 (backend 8000, frontend 5173). Tambahan dua migrasi slice 06:

```bash
cd backend && php artisan migrate --force
# 2026_10_06_000013_create_confirmation_tokens_and_manual_grading_columns
# 2026_10_06_100035_create_activity_log_table
```

> Catatan data dev: kuis **"Latihan Operasi Hitung"** sudah memuat empat soal `SMOKE-06 …` (isian singkat,
> uraian, letak kata, hubung kata) hasil smoke otomatis, jadi demo bisa langsung memakai kuis itu.

### Langkah demo (guru) — menyusun empat tipe soal

1. Masuk `admin@sekolah.test` → menu **Bank Soal → Soal baru**.
2. Pada pilihan **Tipe soal**, tunjukkan bahwa kini ada delapan tipe. Pilih **Isian singkat**:
   - isi **Jawaban baku** (mis. `9`) dan kolom **Sinonim** (mis. `sembilan`) — sinonim diterima sebagai
     jawaban benar; centang **Angka harus persis** agar `12` tidak dianggap sama dengan `120`.
   - kolom **Negasi** (opsional) menolak jawaban yang menyanggah, mis. `bukan`.
3. Pilih **Uraian**: isi **Kata kunci** beserta **bobot**-nya (mis. `jumlah` = 1, `hasil` = 1) dan
   **Ambang lulus** (bawaan 0,6). Jelaskan: uraian dinilai dari rasio bobot kata kunci yang muncul.
4. Pilih **Letak kata**: isi daftar **Kata** + daftar **Posisi** (mis. Subjek/Predikat) lalu tentukan
   kunci penempatan tiap kata. Pilih **Hubung kata**: isi daftar **Kiri** + **Kanan** lalu tentukan
   sambungannya. Keduanya dinilai otomatis seperti soal objektif.
5. **Kuis → detail kuis → Susun soal**: gabungkan soal-soal itu ke kuis, atur jadwal agar sedang berjalan,
   lalu **Publikasi**.

### Langkah demo (murid) — mengerjakan semua tipe

6. Masuk `smoke.murid@sekolah.test` → **Ulangan Saya → Kerjakan sekarang**.
7. Tunjukkan kendali yang berbeda per tipe: kotak teks pendek (isian), kotak teks panjang (uraian),
   daftar pilih per kata (letak kata), daftar pilih per kata kiri (hubung kata). Jawaban tersimpan otomatis.
8. Jawab isian dengan **sinonim** (mis. `sembilan` untuk kunci `9`) → dinilai benar.
   Jawab uraian dengan kalimat yang belum memuat kata kuncinya → soal itu ditandai **perlu ditinjau**,
   bukan dihukum nol.
9. **Kumpulkan jawaban** → halaman hasil menampilkan ringkasan penilaian (dinilai / perlu tinjau / belum).

### Langkah demo (guru) — koreksi manual ber-token

10. Dari **detail kuis**, tekan **Koreksi manual** (atau langsung `/kuis/:id/koreksi`).
11. Antrean menampilkan murid, nomor attempt, tipe, status **Perlu ditinjau guru**, teks soal, **jawaban
    murid**, dan **kunci** (khusus guru).
12. Isi **Skor baru** dan **Alasan koreksi** (minimal 10 karakter) → tekan **Minta token konfirmasi**.
    Muncul keterangan "Token konfirmasi aktif sampai …" (berlaku 300 detik, sekali pakai).
13. Tekan **Simpan koreksi** → baris itu keluar dari antrean dan nilai attempt dihitung ulang. Jelaskan:
    setiap koreksi tercatat di activity log berisi skor sebelum/sesudah + alasan, sehingga nilai tidak bisa
    diubah diam-diam.
14. **Bukti penjaga**: coba "Simpan koreksi" tanpa token / dengan alasan < 10 karakter → ditolak; pakai
    token yang sama dua kali → ditolak (422).

### Bukti lewat browser sungguhan

`docs/smoke-ui-slice06.mjs` (Chrome CDP, port 9333) menjalankan alur ini sendiri, termasuk mengisi form
koreksi dan menekan kedua tombolnya di DOM sungguhan. Hasil terakhir **27/27 lulus** — rincian di
`docs/laporan-pengujian.md` bagian A.9.
