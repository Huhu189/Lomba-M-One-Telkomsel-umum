# Rencana: desain putaran 3 (`desain-putaran3.zip`)

**Sumber**: 14 papan HTML di `Desain/putaran3/` (salinan kerja di `/tmp/desain3/project`, tidak di-commit)
plus `tema.css` putaran 3. Papan-papan itu adalah **gambar kerja**, bukan kode: yang diambil adalah aturan
dan komposisinya, bukan HTML-nya. Papan tidak pernah dipakai langsung sebagai komponen.

**Cara membaca rencana ini**: tiap baris adalah satu perbedaan antara papan dan aplikasi. Perbedaannya
**diperiksa dulu** (grep, bukan dikira), lalu diberi status *sudah* / *perlu diselaraskan* / *belum ada*.
Satu putaran kerja = satu tahap di bawah, dengan bukti yang dijalankan.

---

## 1. Papan mana untuk layar mana

| Papan (`.dc.html` + `-HP`) | Layar di aplikasi | Berkas kunci |
| --- | --- | --- |
| `Masuk` | masuk & daftar murid | `sections/auth/halaman/HalamanMasuk.jsx`, `shared/layout/KerangkaAuth.jsx` |
| `Ulangan` | daftar ulangan murid | `sections/quiz/halaman/PilihHalamanKuis.jsx`, `HalamanKuisMurid.jsx`, `HalamanKuisDetail.jsx` |
| `Ujian` | kerjakan ulangan | `sections/attempt/halaman/HalamanKerjakan.jsx`, `sections/attempt/navigatorSoal.js` |
| `Materi` | baca materi murid | `sections/material/halaman/HalamanMateriMurid.jsx`, `PemutarMateri.jsx` |
| `Materi-Editor` | editor materi guru | `sections/material/editor/EditorMateri.jsx` |
| `Kelas` | data induk (kelas) | `sections/school/halaman/HalamanKelas.jsx` |
| `Main` | **bukan layar**: papan aturan, token, dan pratinjau | acuan untuk semua layar |

`Main` memuat hal yang paling berguna dari putaran ini: **Lima aturan**, daftar **yang saya pangkas**, dan
tabel token (Normal vs Besar). Keduanya disalin apa adanya sebagai daftar periksa penerimaan.

---

## 2. Sudah selesai pada putaran ini (A.49) — lalu dibatalkan pada A.58

| Perubahan | Status | Bukti |
| --- | --- | --- |
| Ukuran tulisan Normal/Besar lewat **satu variabel `--s`** | **dibuang (A.58)** | dulu `docs/smoke-ui-ukuran.mjs` 11/11; sekarang tanpa tombol, tanpa `data-ukuran` |
| Tombol ukuran tersimpan di browser, terpasang sebelum render pertama | **dibuang (A.58)** | dulu `frontend/src/__tests__/theme/ukuran.test.jsx` |
| Judul Bootstrap ikut membesar 12% (bukan 9%) | **tidak berlaku lagi** | tak ada lagi skala kedua; `--s` tetap 1 |

Sisa papan belum dikerjakan. Daftarnya di bawah, berurut dari yang paling terasa.

---

## 3. Perbedaan yang tersisa

### 3.1 Belum ada

| # | Papan meminta | Keadaan sekarang | Catatan |
| --- | --- | --- | --- |
| 1 | **Panel "Tampilan"**: satu tombol membuka panel berisi *Warna layar* (terang/gelap) **dan** *Ukuran tulisan* (Normal/Besar), dengan tombol batal | hanya tombol tema; **tombol ukuran sudah dibuang (A.58)** atas permintaan pemilik produk | Kalau panel ini nanti dikerjakan, isinya tinggal warna terang/gelap — atau ukuran tulisan harus ditambahkan ulang lebih dulu |
| 2 | Kata-kata papan per layar (mis. *"Keluar sementara"*, *"Periksa dan kumpulkan"*, *"Ini contoh"*, *"Sisa waktumu"*, *"Nilai kamu"*) | **tidak ada satu pun** string itu di `frontend/src` (grep) | Aplikasi memakai istilahnya sendiri, dan di beberapa tempat itu **sengaja** (A.47 memilih kata "keluar" alih-alih kalimat panjang). Jadi ini keputusan pemilik produk, bukan penggantian otomatis |
| 3 | Panel token (tabel Normal vs Besar, pratinjau soal, palet) | tidak ada di aplikasi | Menurut `Main` papan ini sendiri menggantikan "papan dokumentasi panjang"; di aplikasi padanannya halaman pengaturan gaya, bukan layar murid |

### 3.2 Perlu diselaraskan (sudah ada, tetapi berbeda bentuk)

| # | Papan | Keadaan sekarang | Yang perlu diperiksa |
| --- | --- | --- | --- |
| 4 | Papan mengutip **"Belum punya akun? Daftar sebagai murid"** | ada di `HalamanMasuk.jsx` | hanya kata-katanya, bukan komponennya |
| 5 | Papan editor: **"Tambah elemen"** (+ Media/Teks/Kuis), "Tema materi", "Pratinjau murid" | ada di `EditorMateri.jsx` | urutan & gaya kartu elemen |
| 6 | Papan ujian: penanda **"ragu"**, tombol **"Keluar"**, dialog kumpul dengan hitungan | ada (`navigatorSoal.js`, `HalamanKerjakan.jsx`) | hitungan di dialog, kata di tombol |
| 7 | Papan induk: tabel + saringan + modal hapus | ada (`HalamanKelas.jsx`) | jumlah kolom & cara menghitung saringan |
| 8 | Label **"Besar"/"Normal"** ditulis "Besar · isi 20px" | sekarang label hanya "Besar"/"Normal" (tanpa angka) | kalau angkanya ditulis, **harus angka aplikasi (≈19 px)**, bukan 20 px milik demo papan |

### 3.3 "Yang saya pangkas" dari papan — **jangan** dihidupkan lagi

Papan `Main` sendiri membuang hal-hal putaran 2 berikut. Tidak perlu dikerjakan, dan sebaiknya tidak
diusulkan lagi tanpa alasan baru:

- ukuran **"Rapat"** (selisih terlalu kecil) — dibuang, tinggal Normal & Besar;
- catatan demo di dalam layar (pindah ke sticky note/panel Tweaks);
- **halaman bernomor**, saringan berhitung, **pintasan papan ketik** di daftar;
- papan dokumentasi panjang.

### 3.4 Lima aturan (daftar periksa penerimaan setiap layar)

1. Satu tombol biru (aksen) per layar; hapus memakai **teks merah**, tombol merah hanya di dalam dialog.
2. Status selalu **bertulisan** (tidak hanya warna).
3. Warna hanya penegas.
4. Di HP dialog menjadi **lembar dari bawah**, tombol utama di atas tombol batal.
5. Sasaran ketuk ≥ 44 px; seluruh kartu pilihan bisa diketuk; ikon selalu bersama teks (kecuali menu).

---

## 4. Tahapan kerja yang diusulkan

| Tahap | Isi | Ukuran | Bukti yang dijalankan |
| --- | --- | --- | --- |
| ~~0~~ | ~~fondasi `--s` + tombol ukuran~~ | **dibatalkan (A.58)** | tombol ukuran dibuang; `--s: 1` tetap ada sebagai token skala |
| 1 | Panel **"Tampilan"** menyatukan warna + ukuran; dua tombol lama dilebur | sedang | 1 berkas Vitest (jsdom, buka/tutup/Escape) + 1 harness (klik sungguhan) — **ukurannya harus dibuat dulu** |
| 2 | Audit kata layar-per-layar terhadap 7 papan, lalu **satu daftar usulan kata** untuk disetujui pemilik produk (tidak mengubah apa pun tanpa persetujuan) | kecil | cukup grep + dokumen; tanpa menjalankan Chrome |
| ~~3~~ | ~~Periksa **tata letak pada mode Besar** di halaman padat~~ | **tidak berlaku (A.58)** | mode Besar tidak ada lagi |
| 4 | Sisa bentuk papan yang belum dicocokkan (kartu elemen editor, dialog kumpul, tabel induk) | besar | 1 harness per layar, dijalankan **hanya** setelah tahap 1–3 hijau |

**Aturan menjalankan uji (permintaan pemilik produk, 12 Oktober 2026): jangan banyak-banyak.** Satu putaran
= **paling banyak 2 kali menjalankan Chrome**, dan Vitest hanya pada berkas yang tersentuh
(`--no-file-parallelism --maxWorkers=1`). Pengukuran bentuk yang butuh banyak percobaan dikerjakan di luar
repo (mis. `/tmp/ukur-*.mjs`), bukan dengan mengulang harness.

---

## 5. Yang perlu keputusan pemilik produk sebelum tahap 2 & 4

1. **Kata**: papan memakai istilah yang lebih panjang daripada aplikasi ("Keluar sementara", "Periksa dan
   kumpulkan"). Ambil kata papan, atau pertahankan kata aplikasi? (A.47 sudah pernah memilih yang pendek.)
2. **Panel "Tampilan"**: cukup warna + ukuran, atau sekalian tempat untuk pilihan lain nanti?
3. **Angka pada label ukuran**: tulis "Besar · isi 19px" (jujur untuk aplikasi ini), atau cukup "Besar"?
4. **Papan `Main`**: di aplikasi, halaman pratinjau token/peraturan perlu dibuat atau cukup jadi dokumen?
