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
- **Slice 08**: unggah materi, avatar + laporan (layar guru ke murid belum).
- **Slice 09**: upload jawaban (gambar/rekam/file), saran penilaian AI, mode tim.
- **Slice 10**: ekspor nilai CSV; cache L1, Octane Swoole, dan demo dari link deploy VPS masih terbuka.

**Catatan status (7 Oktober 2026):** mode gelap, mode tim, penilaian AI, rekam diri, avatar + moderasi, ekspor
nilai, dan cache berlapis L1 sudah bisa dipakai. Yang belum: layar guru ke perangkat murid (SSE), Octane
Swoole, dan deploy (menunggu keputusan host).

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

---

## Perbaikan Audit Slice 01 (putaran 6 Oktober 2026)

Audit statis atas snapshot zip lama diperiksa ulang terhadap kode yang berjalan, lalu sebagian besar
temuannya diperbaiki. Ringkasan lengkap ada di `docs/laporan-pengujian.md` bagian **A.10**.

Yang bisa ditunjukkan saat demo:

1. **Lupa sandi benar-benar berfungsi.** Kirim "lupa sandi" dari halaman depan → tautan di email menuju
   halaman **frontend** `/atur-ulang-sandi?token=…&email=…` (sebelumnya tautan tidak pernah dibangun sama
   sekali). Setelah sandi diganti, sesi lama di perangkat lain ikut berakhir.
2. **Akun yang ditangguhkan sekolah tidak hidup lagi** hanya karena tautan verifikasi lama dibuka.
3. **Root backend mengalihkan ke aplikasi.** Buka `http://localhost:8000/` → langsung diarahkan ke
   `http://localhost:5173/`, bukan halaman selamat datang bawaan Laravel.
4. **Pagar mutu**: `./verify.sh` hijau — Pest **95 passed (629 assertions)**, Pint 183 berkas,
   Vitest **27 berkas / 197 test**, realtime 2 test.

---

## Demo Slice 07 — Anti-cheat, Presence, dan Live Monitor

Prinsip yang ditunjukkan: **bukti, bukan vonis**, dan **fail-open** — proteksi yang rusak tidak boleh
menggagalkan ulangan. Semua proteksi **mati secara bawaan**.

### Langkah demo (guru) — menyalakan pengaman

1. Buka `/pengaturan`, lihat kelompok **Anti-cheat**: saklar induk beserta saklar rincinya (blokir tempel,
   blokir seleksi teks, catat pindah tab, kunci layar, deteksi alat pengembang, sembunyikan saat dicetak,
   dan **preset ujian** yang menyalakan sekelompok sekaligus).
2. Nyalakan **Aktifkan anti-cheat**, lalu **Blokir tempel (paste) jawaban** dan **Catat pindah tab /
jendela**. Bisa diatur per sekolah, per kelas, atau per kuis (kuis menang).

### Langkah demo (murid) — pengaman yang terbuka, bukan jebakan

3. Murid membuka `/kerjakan/:kuisId`. Muncul **pemberitahuan** "Ulangan ini memakai pengaman" berisi daftar
   pengaman yang aktif, dan murid menutupnya lalu **tetap bisa mengerjakan**. Jelaskan: ini pemberitahuan,
   bukan gerbang — menyembunyikan aturan membuat anak merasa dijebak.
4. Tunjukkan lencana **Pengaman aktif** di kepala layar; angka catatannya ikut bertambah saat kejadian
   tercatat.
5. Coba tempel teks dari luar -> tertolak, dan kejadiannya tercatat (bukan muncul peringatan menghukum).

### Langkah demo (guru) — Live Monitor

6. Dari detail kuis tekan **Live Monitor** (`/kuis/:id/monitor`). Tampak siapa yang sedang mengerjakan,
   **progres** per murid, dan status kehadiran: **Hadir** dihitung dari aktivitas normal murid (memuat
   ulangan, menyimpan jawaban) sehingga tidak ada detak jantung terus-menerus dan hemat kuota.
7. Perhatikan lencana koneksi di kanan atas: **Langsung (SSE)** bila service realtime hidup, atau
   **Polling 5 detik** bila tidak. Keduanya menampilkan data yang sama — itulah fail-open yang bisa
   ditunjukkan dengan mematikan service Node di tengah demo (layar tetap berisi).
8. Panel **Catatan kejadian** menampilkan kategori, **skor risiko**, waktu server vs waktu perangkat, dan
   keterangan "dihitung server" untuk kejadian yang tidak datang dari perangkat murid.
9. Tekan **Valid** / **Tidak valid** pada satu catatan -> status berubah, catatan keluar dari antrean, dan
   tinjauannya masuk audit. Jelaskan: guru yang memutuskan, sistem hanya mengumpulkan bahan.
10. **Bukti jujur yang bisa disebut**: deteksi di browser bisa diakali, jadi catatan ini tidak pernah
    dinyatakan sebagai bukti pelanggaran — hanya bahan bertanya baik-baik ke murid.

### Bukti lewat browser sungguhan

`docs/smoke-ui-slice07.mjs` (Chrome CDP, port 9333) menjalankan seluruh alur di atas pada DOM sungguhan,
termasuk menekan tombol tinjauan dan menyambung aliran SSE dengan tiket sekali pakai. Hasil terakhir
**21/21 lulus** — rincian di `docs/laporan-pengujian.md` bagian A.11.

### Satu hal yang **sengaja tidak** diperbaiki (jujur)

**Pendaftaran membalas 422 bila email sudah terdaftar**, sehingga email yang terdaftar bisa ditebak.
Ini bertentangan dengan aturan anti-enumerasi di `AGENT.md`. Alasannya: alur pendaftaran yang disetujui
adalah **langsung masuk setelah daftar**, jadi bila email terdaftar dibalas "sukses" tanpa akun baru,
pemilik email itu justru tidak bisa masuk. Keputusan yang diambil: **pertahankan 422 dan catat jujur**.
Perbaikan penuh menunggu keputusan produk (pola "kami sudah kirim email ke alamat itu" tanpa auto-login).

## Demo Slice 08 — Materi Berblok, Berkas Aman, dan Avatar Termoderasi

### Langkah demo (guru) — menyusun materi berblok
1. Masuk sebagai guru (`http://localhost:5173`, `admin@sekolah.test`), buka **Materi** → buat materi
   kelas 3A dengan tema yang sudah ada.
2. Susun blok: **teks** → **media** (unggah sebuah gambar; sebutkan bahwa berkas yang tidak dikenali akan
   dipaksa unduh sebagai `.upload`) → **kuis** (pilih kuis bersoal objektif) → **teks** penutup.
   Tandai blok penting sebagai **wajib**.
3. Terbitkan materi, lalu tunjukkan **laporan tema** materi itu setelah murid mengerjakan latihannya.
4. Ajukan satu blok kuis bersoal uraian untuk menunjukkan server **menolaknya** (latihan anak harus dinilai pasti).

### Langkah demo (murid) — menempuh materi
1. Masuk sebagai murid kelas 3A, buka **Materi** → pilih materi tadi.
2. Tunjukkan urutan ditegakkan **server**: mencoba membuka blok kuis sebelum blok wajib selesai ditolak.
3. Buka blok teks → tandai selesai → blok kuis membuka latihan; soal memakai renderer yang sama seperti
   ulangan, dan **tidak ada kunci jawaban** di respons mana pun.
4. Kumpulkan latihan, tandai blok selesai. Tekankan: nilainya masuk laporan tema, **bukan** ranking.

### Langkah demo (murid) — avatar dan lapor
1. Buka **Avatar** → unggah sebuah foto. Tunjukkan gambar otomatis dikecilkan (256×256) dan avatar bawaan
   memakai **inisial nama** sebelum ada foto.
2. Coba unggah berkas SVG yang dinamai `.png` → ditolak dengan pesan jelas (SVG bisa memuat skrip).
3. Dari akun murid lain, tekan **Lapor** pada avatar teman. Ulangi dari murid yang sama → hitungan laporan
   **tidak** bertambah (satu laporan per murid per avatar).
4. Setelah **tiga murid berbeda** melapor, avatar hilang dari daftar teman, tetapi **pemiliknya masih
   melihatnya sendiri**; sedangkan guru melihatnya di **Moderasi Avatar** beserta alasan tiap pelapor.
5. Guru menekan **Pulihkan** (dengan catatan alasan) → avatar kembali tampil dan laporan lama jadi tidak valid;
   lalu tunjukkan **Hapus avatar** pada kasus lain beserta catatan jejaknya di audit.

### Bukti lewat API (curl)

```
# Unggah avatar (jalur uji non-browser: base64) — server tetap mengencode ulang ke JPEG 256x256
curl -s -X POST http://localhost:8000/api/v1/avatar \
  -H 'Accept: application/json' -b cookie.txt \
  -d 'isi_base64=<base64 gambar>' | jq '{id, status, mime, lebar, tinggi, url}'
```

### Bukti otomatis

`Slice08AvatarTest` (10 test / 104 assertion) dan `Slice08Test` (8 test / 108 assertion) lulus, termasuk
penolakan SVG, ambang 3 laporan unik, dan jejak audit pulihkan/hapus. **Catatan jujur:** smoke UI Chrome
(CDP) untuk slice 08 **belum** dijalankan, jadi bukti slice ini masih sebatas test otomatis — rinciannya di
`docs/laporan-pengujian.md` bagian A.12.

## Demo Slice 09 — Lampiran Jawaban dan Saran AI

Siapkan dulu satu kuis berisi satu soal **uraian** dengan kata kunci, sudah diterbitkan untuk kelas 3A.

### Langkah demo (murid) — menjawab tanpa banyak mengetik
1. Masuk sebagai murid, buka kuis, buka soal uraiannya. Di bawah soal muncul panel **Lampiran jawaban**.
2. **Gambar kanvas**: menulis atau menggambar sesuatu dengan mouse/jari, lalu simpan. Sebutkan bahwa server
   menerima potongan 1 MiB per kiriman, jadi jaringan lambat pun tidak menggagalkan jawaban.
3. **Rekam diri**: tunjukkan bahwa bagian ini muncul hanya bila sekolah menyalakan `rekam_diri`
   (bawaan **mati**), lalu rekam beberapa detik dengan centang izin. Lewat dari 60 detik → ditolak.
4. Unggah satu **berkas** (mis. foto pekerjaan di buku) → muncul di daftar lampiran, bisa dibuang lagi.
5. Kumpulkan ulangan **sebelum** waktunya habis; setelah waktu habis, server menolak lampiran baru.

### Langkah demo (guru) — saran AI lalu keputusan guru
1. Nyalakan AI di server (sekali saja, di `.env`): `AI_PENILAIAN_AKTIF=true` dan `AI_PENILAIAN_KUNCI=...`.
2. Buka **Koreksi** untuk kuis tadi. Tunjukkan catatan "Saran AI tersedia sebagai bahan pertimbangan" dan
   tombol **Minta saran AI** pada baris jawaban.
3. Tekan **Minta saran AI** → muncul usulan angka + **Catatan AI** (alasan singkat). Tekankan: nilai
   `skor_sekarang` **tidak** ikut berubah walau ada saran.
4. Tekan **Pakai saran AI** (mengisi kolom skor), lalu tetap isi **alasan koreksi**, minta **token
   konfirmasi**, dan simpan. Barulah nilai resmi berubah, dan jejaknya masuk audit.
5. Tunjukkan tombol **Minta saran AI** sekali lagi setelah dikoreksi: nilainya tidak lagi tertimpa saran baru.

### Bukti lewat API (curl)

```
# Guru meminta saran AI untuk satu attempt (di server, lewat queue)
curl -s -X POST http://localhost:8000/api/v1/attempt/<attempt_id>/nilai-ai \
  -H 'Accept: application/json' -H 'X-XSRF-TOKEN: ...' -b cookie.txt \
  | jq    # { aktif: true, terantre: 1, message: "Saran AI diminta untuk 1 jawaban." }

# Kunci API tidak pernah muncul di respons murid maupun di log server
grep -R "AI_PENILAIAN_KUNCI" backend/storage/logs 2>/dev/null || echo 'aman: kunci tidak ada di log'
```

### Bukti otomatis

`Slice09UploadTest` (10 test / 98 assertion), `Slice09AiTest` (8 test / 83 assertion), dan `Slice09TimTest`
(6 test / 92 assertion) lulus, termasuk: skor AI dipotong ke rentang soal, gagal/timeout AI tetap "perlu
ditinjau", satu permintaan per ulangan, murid tidak bisa memicu AI, hasil murid tidak pernah memuat alasan
mentah AI, dan satu nilai tim dibagi rata ke anggotanya. Rincian di `docs/laporan-pengujian.md` bagian A.13.

### Langkah demo (guru) — menyusun tim
1. Pada detail kuis, buka **Kelola tim**. Tunjukkan bahwa mode tim masih **mati** (ada peringatan di halaman).
2. Isi jumlah tim (mis. 3) lalu tekan **Bagi otomatis** → murid kelas dibagi bergiliran, jadi anak yang
   berdekatan di daftar tidak menumpuk di satu tim. Tunjukkan juga bisa **Buat tim baru** dan memilih anggota
   sendiri, serta bahwa murid yang sudah masuk tim lain tidak bisa dipilih dua kali.
3. Nyalakan kunci **mode tim** untuk kuis ini di **Pengaturan** (lingkup: kuis).

### Langkah demo (murid) — satu lembar untuk satu tim
1. Dua murid dari tim yang sama membuka kuis. Sebutkan: keduanya masuk ke **lembar yang sama** (bukan dua
   ulangan), dan panel biru di atas menyebutkan nama tim + rekan setimnya.
2. Murid A menjawab soal, lalu murid B membuka layar yang sama → jawabannya sudah terisi, lalu B mengubahnya.
   Jelaskan: setiap perubahan tersimpan sebagai **versi baru**, jadi kalau ada sengketa "siapa yang mengganti
   jawaban kami", guru bisa melihat riwayatnya.
3. Salah satu anggota menekan **Kumpulkan**; anggota lain membuka **Hasil** dan melihat nilai yang sama.
4. Tunjukkan **Badge** keduanya sudah memuat nilai itu (nilai tim dibagi rata), sedangkan anggota tim lain
   yang belum mengerjakan masih kosong.
5. Buka **Peringkat**: kolomnya bernama **Tim**, satu baris per tim, beserta daftar anggotanya.
6. Kembali ke **Kelola tim** sebagai guru → tombol ubah/hapus sekarang **nonaktif** dengan penjelasan bahwa
   susunan tim dibekukan setelah kuis dikerjakan.

### Langkah demo (guru) — mengunduh nilai untuk buku nilai
1. Dari detail kuis, tekan **Unduh nilai (CSV)**: berkasnya langsung terunduh.
2. Buka di Excel/Google Sheets. Sebutkan tiga hal: hanya skor **asli** yang masuk, ada kolom nilai **per soal**,
   dan pada kuis mode tim semua anggota dapat baris dengan skor tim yang sama.
3. Untuk menunjukkan pengaman: ganti nama seorang murid menjadi `=SUM(1+1)` lewat menu **Data Murid**, unduh
   ulang, dan tunjukkan selnya diawali kutip tunggal (tidak dieksekusi sebagai rumus).

### Mode gelap
Tombol bulan/matahari di bilah atas mengganti terang ↔ gelap untuk seluruh halaman. Tunjukkan bahwa pilihan
bertahan setelah halaman dimuat ulang, dan bahwa penanda benar/salah tetap punya ikon di mode gelap.

### Cache berlapis (bagian teknis, tidak ada tombol di layar)
Bawaannya mati. Untuk mendemokannya dengan jujur: nyalakan `CACHE_L1_AKTIF=true` di `.env`, buka ulangan
bersamaan dari beberapa tab/perangkat sampai pengaturan kuis dibaca lebih dari 10 kali per detik, lalu
sebutkan tiga hal: berkas salinan muncul di `/dev/shm/ulangan-l1.sqlite`, salinan itu **dibuang lagi** setelah
lalu lintas reda, dan saat guru mengubah pengaturan di tengah ulangan, kelas langsung memakai aturan baru
(versi naik, salinan lama ditolak). Kalau tidak ada waktu mendemokan beban, cukup tunjukkan test-nya:
`php artisan test --filter=Slice10CacheTest`.

## Demo Slice 10 — Layar Kelas (guru → perangkat murid)

Fitur: guru menampilkan satu keadaan konten di seluruh perangkat murid kelas — pengumuman, satu soal yang
disorot, atau instruksi setelah ulangan — tanpa salinan layar, tanpa kunci jawaban, dan tanpa memuat ulang
halaman di perangkat murid.

### Langkah demo (guru) — mengendalikan layar kelas

1. Masuk sebagai guru, buka detail kuis yang sedang berjalan, tekan tombol **Layar kelas**.
2. Pilih mode **Sorot satu soal**, pilih salah satu soal dari daftar (ada cuplikan teksnya), tekan
   **Tampilkan di perangkat murid**. Lencana "Keadaan sekarang" bertambah `versi`-nya.
3. Ganti ke **Pengumuman singkat**, tulis "Sisa waktu 10 menit" (boleh dua baris), simpan lagi — murid melihat
   banner pengumuman tanpa kehilangan jawaban yang sedang ditulis.
4. Tekan **Kosongkan layar** — semua perangkat kembali ke tampilan ulangan biasa.

### Langkah demo (murid) — mengikuti guru

1. Masuk sebagai murid kelas yang sama di tab/perangkat lain, buka kuis yang sama lewat **Kerjakan sekarang**.
2. Saat guru menekan tombol, panel "Guru menyorot soal nomor N" muncul di atas daftar soal dalam hitungan
   detik (SSE). Matikan service realtime untuk menunjukkan jalur cadangan: panel tetap menyusul lewat
   pembaruan berkala 5 detik — ulangan tidak pernah berhenti karena layar kelas.
3. Tunjukkan bahwa soal yang disorot **tidak membawa kunci jawaban** dan jawaban murid tidak berubah oleh
   panel (panel hanya menampilkan, bukan menimpa lembar jawaban).

### Bukti lewat API (curl)

```bash
# Guru mengubah layar; respons membawa versi + keadaan terbaru
curl -b cookie-guru.txt -X PUT http://localhost:8000/api/v1/kuis/1/layar \
  -H 'Accept: application/json' -d '{"mode":"pengumuman","judul":"Sisa waktu 10 menit"}'

# Murid kelas itu membaca keadaan yang sama (tanpa daftar soal/bahan pengendali)
curl -b cookie-murid.txt http://localhost:8000/api/v1/kuis/1/layar

# Murid kelas lain ditolak 403; begitu pula saat saklar layar_guru dimatikan
curl -b cookie-murid-lain.txt http://localhost:8000/api/v1/kuis/1/layar   # 403
```

### Bukti otomatis

`php artisan test --filter=Slice10LayarTest` (6 test / 70 assertion) dan
`npx vitest run src/__tests__/sections/presence/layar.test.js src/__tests__/shared/api/realtime.test.js`
(11 test). Yang diuji lewat test, bukan hanya dijelaskan: kunci jawaban tidak pernah ikut terkirim, murid
kelas lain 403, saklar `layar_guru` mematikan jalur guru dan menyembunyikan layar dari murid, tiket SSE murid
sekali pakai, dan setiap perubahan naik versi + disiarkan ke kanal kuis.
