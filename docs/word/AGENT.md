# AGENT — Prompt Mentah (v1 + v2 + prompt Claude)

Dokumentasi untuk AI. Isi berkas ini identik dengan `AGENT.docx`.

Ringkasan prompt: `docs/log-mentah/ringkasan-prompt.docx`.
Log mentah utuh: `docs/log-mentah/log-mentah.docx`.


===== 2026-10-05-prompt-1-v1.md =====

# Prompt Pertama (v1) — Struktur + Slice 00

Teks prompt pertama yang diberikan pengguna pada 5 Oktober 2026 ±14.30 WIB.
Disimpan di sini sebagai arsip bukti (pelaporan prompt menjadi utuh sejak revisi dokumen acuan prompt 2).

---

## PERAN

Kamu senior full-stack engineer sekaligus security engineer. Bangun, dari nol dan bertahap, platform ulangan/form online untuk sekolah dengan prinsip "do not trust client". Prioritas: aman, stabil, bisa didemokan di setiap tahap, sesuai stack di bawah. Jangan memaksakan library atau arsitektur baru kalau tidak perlu.

TUGAS PROMPT INI (hanya ini, lalu berhenti dan lapor)

Buat STRUKTUR PROJECT dan dokumen acuannya dulu. Belum ada fitur yang dikerjakan.

Tahap A, dokumen acuan AI agent (ringkas, tulis sendiri dari isi prompt ini):

1. AGENT.md: peran, aturan lomba, stack, prinsip keamanan, pagar mutu, cara kerja, format laporan, larangan. Maksimal sekitar 100 baris.
2. 00-index.json: peta dokumen (entrypoints, daftar chunk, chunk yang selalu dimuat).
3. chunk_map.json: urutan slice, dependensi, chunk pendukung yang dimuat tiap slice, rencana anggaran prompt (lihat bawah), urutan pemotongan bila waktu mepet, dan hal yang tidak boleh dipotong.
4. chunks/*.json, satu berkas per topik dan per slice. Skema tiap chunk: id, title, depends_on, loads, goal, scope[], constraints[], tests[], done_when[]. Chunk topik: rules-lomba, stack, security, quality-gates, structure, theme, anticheat. Chunk slice: slice-00 sampai slice-10 (daftar slice ada di bagian CARA KERJA).
5. docs/: jurnal-prompt.md (maks 5 entri), log-mentah/, bukti-konfirmasi-panitia/, catatan-demo.md.
6. Ekspor Word: dokumen dan log untuk dikumpulkan dikeluarkan sebagai .docx di docs/word/: AGENT.docx, jurnal-prompt.docx, log-mentah.docx (gabungan semua berkas di log-mentah/), catatan-demo.docx. Berkas kerja tetap .md dan .json karena dibaca agent; prompt ini sendiri tetap .md dan tidak diekspor. Buat satu skrip docs/export-word.sh yang bisa dijalankan ulang (pakai pandoc bila tersedia, bila tidak python-docx; keduanya alat dev di luar aplikasi). log-mentah.docx harus isi apa adanya tanpa disunting, dirapikan, atau dipersingkat. Sertakan tanggal dan jam asli tiap entri. Jalankan ulang ekspor setiap akhir slice dan komit hasilnya.

Semua JSON harus valid, tiap loads dan depends_on merujuk id yang ada, dan isinya meringkas prompt ini tanpa menambah aturan baru.

Tahap B, scaffold struktur (slice 00):

1. Monorepo backend/, frontend/, realtime/ memakai scaffold resmi (composer create-project laravel/laravel backend, npm create vite@latest frontend -- --template react, npm init untuk realtime). Dilarang menyalin kode dari proyek lain.
2. Folder per bagian logika. Backend app/Sections/<Nama>/{Http,Models,Services,Policies,Enums} untuk Auth, School, Question, Quiz, Attempt, Scoring, Cheat, Presence, Material, Avatar, Settings, Cache. Frontend src/sections/<nama>/, src/shared/{api,ui,theme,store}, src/security/, src/icons.jsx.
3. Pasang dependensi sesuai STACK, aktifkan pagar mutu (strict_types, Pest + arch tests, Pint, jsconfig checkJs strict, ESLint, Vitest, verify.sh di root).
4. Variabel tema CSS (palet di bagian UI/UX), icons.jsx, toast buatan sendiri, kerangka Fastify dengan endpoint kesehatan.
5. README singkat cara menjalankan. Jalankan verify.sh sampai hijau.

(Konteks lomba, asumsi, STACK, pagar mutu, prinsip keamanan, fitur A-H, anti-cheat, UI/UX, cara kerja slice 00-10, anggaran prompt, urutan potong, test yang diharapkan, aturan kerja, dilarang, format output: sebagaimana aslinya — prompt asli utuh tersimpan pada pesan percakapan dan dirangkum jujur di jurnal; bagian yang diulang persis oleh prompt v2 tidak dikutip dua kali di sini.)



===== 2026-10-05-prompt-2-dokumen-acuan-v2.md =====

PERAN
Kamu tetap senior full-stack engineer sekaligus security engineer pada project yang sama: platform ulangan dan belajar online untuk sekolah dasar dengan prinsip "do not trust client". Ini PROMPT LANJUTAN dari prompt pertama (struktur project + slice 00). Prompt ini hanya MENULIS DOKUMEN dan MEMPERBARUI dokumen acuan. Tidak ada kode aplikasi baru, tidak ada instalasi dependency aplikasi, dan slice 01 ke atas belum dikerjakan di sini.

KEADAAN YANG DIASUMSIKAN (verifikasi di Tahap 1, jangan dianggap pasti)
Prompt pertama sudah dijalankan: `AGENT.md`, `00-index.json`, `chunk_map.json`, `chunks/*.json`, folder `docs/` (jurnal-prompt.md, log-mentah/, bukti-konfirmasi-panitia/, catatan-demo.md, export-word.sh, word/), dan scaffold slice 00 (monorepo backend/frontend/realtime, dependensi sesuai STACK, pagar mutu, verify.sh, tema, icons.jsx, toast, kerangka Fastify). Kalau ada yang belum ada atau belum hijau, laporkan sebagai temuan dan jangan memperbaikinya di prompt ini.

KONTEKS PRODUK (untuk isi dan gaya tulisan, bukan aturan baru)
- Lomba M-ONE Telkomsel Coding Competition, kategori Umum, subtema Web Education for Kids (SD). Bobot nilai: proses vibe coding 25%, fungsionalitas dan tema 25%, UI/UX dan responsif 20%, kualitas teknis 15%, inovasi dan kreativitas 15%.
- Pengguna murid: anak SD (kelas 1-6), sebagian belum lancar membaca. Pengguna guru: guru kelas yang waktunya terbatas dan butuh melihat hasil dengan cepat.
- Kondisi lapangan: perangkat terbatas dan sering dipakai bergantian, sinyal tidak stabil. Dokumen harus jujur soal ini, tanpa menjanjikan lebih dari yang dikerjakan.
- Pembaca `docs/penjelasan-fitur.md`: juri dan guru, bukan programmer. Pakai contoh kelas yang nyata (misalnya kuis pecahan kelas 4), bukan istilah teknis.
- Nilai utama produk: murid yang tertinggal terlihat dan terbantu, guru langsung tahu tema mana yang lemah, dan nilai tetap jujur karena server tidak percaya klien.

TUGAS PROMPT INI (hanya ini, lalu berhenti dan lapor)
Tahap 1. Baca `AGENT.md`, `00-index.json`, `chunk_map.json`, dan semua chunk yang ada. Laporkan satu daftar singkat: apa yang sudah sesuai dan apa yang berbeda dengan perubahan di Tahap 2. Tambahkan dua pemeriksaan baca-saja:
- Status slice 00: ada di riwayat git, dan hasil `verify.sh` (boleh dijalankan sekali untuk melapor, tanpa memperbaiki).
- Apakah chunk `slice-04` memuat batasan unik "satu attempt aktif per murid per kuis" dan apakah itu bentrok dengan attempt latihan dari blok kuis sisipan (F2). Laporkan saja; jangan mengubah aturan sendiri.

Tahap 2. Perbarui dokumen acuan dengan TIGA perubahan berikut (hanya ini yang boleh ditambah; selain itu tidak ada aturan baru):
1. Jurnal prompt: batas MAKS 5 berlaku untuk ENTRI JURNAL, bukan jumlah prompt ke AI. Jumlah prompt tidak dibatasi; semua prompt dan jawaban, termasuk prompt ini, tetap utuh di `docs/log-mentah/` dengan tanggal dan jam asli. Terapkan di semua tempat yang menyebut batas 5 (`AGENT.md`, chunk `rules-lomba`, `chunk_map.json`) dan jaga `AGENT.md` tetap sekitar 100 baris. Ganti "rencana anggaran prompt" di `chunk_map.json` menjadi "rencana prompt per slice + pemilihan 5 entri jurnal": (1) struktur, scaffold slice 00, dan penjelasan fitur (prompt pertama dan prompt ini), (2) auth, sekolah dan kelas, bank soal (slice 01-03), (3) engine kuis dan penilaian (slice 04-06), (4) anti-cheat, realtime, materi, upload dan AI (slice 07-09), (5) cache, Swoole, deploy, dan perbaikan akhir (slice 10). Tiap entri jurnal berisi tujuan, prompt inti (ringkas), hasil, dan rujukan tanggal-jam ke log mentah. Log mentah tidak boleh disunting.
2. Fitur baru F2, materi berblok dengan kuis sisipan: materi = urutan blok (teks, media, kuis). Blok kuis hanya menunjuk kuis atau kumpulan soal yang sudah ada di bank soal (tanpa tipe soal atau penilai baru); saat murid mencapai blok, server membuat attempt lewat mesin kuis yang sama. Hanya soal objektif dan isian (upload jawaban tetap hanya di halaman ulangan). Kuis sisipan bertipe latihan: skor masuk laporan tema (tag), tidak masuk ranking, bukan skor asli ulangan; retry dan batas percobaan lewat pengaturan tiga lapis. Guru menandai blok wajib atau opsional; server yang menegakkan urutan. Dengan layar guru aktif, nomor blok ikut disinkronkan lewat SSE yang sama. Tidak ada kuis di detik tertentu dalam video. Anti-cheat mati kecuali dinyalakan guru. Masukkan ke chunk `slice-08` (dan `slice-04` sebagai dependensi), bukan chunk baru, dengan mengisi `scope`, `constraints`, `tests`, dan `done_when` sesuai skema chunk yang ada.
3. Penjelasan fitur utama (Tahap 3 di bawah) disimpan sebagai dokumen baru dan didaftarkan di `00-index.json`.

Tahap 3. Tulis `docs/penjelasan-fitur.md`, dokumen penjelasan fitur utama untuk juri dan guru (bukan untuk agent). Bahasa Indonesia sederhana, maksimal sekitar 2 halaman per fitur, tanpa kode. Untuk SETIAP fitur utama di bawah, gunakan empat subjudul tetap: "Apa ini", "Cara kerjanya", "Mengapa aman" (hubungkan ke prinsip do not trust client), dan "Manfaat untuk anak SD dan guru" (sebutkan situasi kelas yang nyata, bukan klaim umum). Tutup tiap fitur dengan satu baris "Status": belum dikerjakan (diisi ulang di tiap akhir slice).

Fitur utama yang dijelaskan:
1. Mesin ulangan yang tidak percaya klien: acak soal dan opsi di server, deadline dihitung server, submit idempoten, kunci jawaban tidak pernah dikirim ke klien, cadangan jawaban di perangkat.
2. Delapan jenis soal dan penilaian otomatis: pilihan ganda, benar/salah, isian singkat, uraian, menjodohkan, mengurutkan, letak kata, hubung kata; toleransi typo, kata kunci; penilaian AI hanya di backend sebagai saran; koreksi manual guru dengan jejak audit.
3. Pemahaman per tema: guru memberi tag/tema pada soal; laporan per murid (belum paham / mulai paham / paham) sebagai acuan guru, bukan vonis.
4. Skor asli, skor ulang, ranking, badge, remedial otomatis.
5. Pengaturan tiga lapis (sekolah, kelas, kuis) dengan kunci dari sekolah.
6. Materi berblok dengan kuis sisipan, plus layar guru yang tampil di perangkat murid (sinkron konten, bukan share layar).
7. Anti-kecurangan, presence tanpa heartbeat terus-menerus, dan Live Monitor guru lewat SSE: sinyal sebagai bahan tinjauan, bukan vonis; jujur bahwa deteksi di browser bisa diakali.
8. Avatar murid dengan tombol lapor dan moderasi otomatis.
9. Mode tim.

Di akhir dokumen, tambahkan bagian "Batasan jujur": hal yang sengaja tidak dilakukan (tanpa share layar WebRTC, tanpa kuis di detik tertentu dalam video, tanpa multi-tenant, anti-cheat tidak menjamin 100%) dan fitur yang masuk daftar potong bila waktu mepet (ambil dari urutan potong di `chunk_map.json`).

Tahap 4. Ekspor dan validasi:
- Tambahkan `penjelasan-fitur.docx` ke `docs/word/` lewat `docs/export-word.sh` yang sudah ada, lalu jalankan ulang ekspor. Kalau alat ekspor (pandoc atau python-docx) belum ada, laporkan; jangan menambah dependency aplikasi.
- Pastikan semua JSON valid dan setiap `loads` dan `depends_on` merujuk id yang ada.
- Tulis perintah yang dijalankan dan hasilnya. Bedakan jujur "sudah dijalankan" dan "ditulis tapi belum dijalankan".

KONTEKS LOMBA (PATUHI)
- Lomba berjalan: mulai 5 Okt 2026 09.30 WIB, batas kumpul 15 Okt 2026 15.30 WIB, pengumuman 25 Okt. Kumpul: link GitHub public, docs acuan AI agent, jurnal prompt beserta log mentah, link deploy.
- Repo public dan dimulai dari kosong. Commit kecil dan sering dengan tanggal asli. Dilarang force push, rebase, amend commit yang sudah di-push, atau mengubah tanggal commit. Perubahan pada dokumen acuan dilakukan sebagai commit BARU; jangan menulis ulang riwayat.
- Dilarang menyalin konten dari proyek lain. Log mentah tidak boleh disunting.
- Sanksi: project lama -35%; terlambat dengan konfirmasi -10%; diskualifikasi untuk plagiarisme, repo private, manipulasi prompt, tidak terbukti dari nol, telat tanpa konfirmasi.
- Kalau spesifikasi resmi lomba bertentangan dengan prompt ini (termasuk tafsir "jurnal maks 5" di Tahap 2 butir 1), spesifikasi lomba menang: sebutkan konfliknya, lalu ikuti lomba.

DILARANG
Menulis kode aplikasi, menginstal dependency aplikasi, atau mengerjakan slice 01 ke atas di prompt ini; menambah aturan di luar tiga perubahan Tahap 2; mengklaim fitur sudah selesai (semua status "belum dikerjakan"); membesar-besarkan keamanan ("tahan 100%"); mengubah riwayat git; menyunting log mentah.

FORMAT OUTPUT
Bahasa Indonesia, ringkas dan terstruktur. Di akhir tulis: (a) berkas yang dibuat/diubah, (b) yang dijalankan dan hasilnya, (c) perbedaan yang ditemukan di Tahap 1 dan bagaimana diselesaikan, (d) hal yang perlu keputusan saya, (e) langkah berikutnya (slice 01, lalu slice 02-03 sebagai entri jurnal 2).



===== 2026-10-06-prompt-claude-ui-baru.md =====

# Prompt Claude — rombak UI/UX slice 00–02 (dikerjakan di luar repo, disalin masuk)

Asal berkas: `docs/log-mentah/promt_claude.txt` — prompt yang dikirim pengguna ke AI lain untuk merombak UI/UX.
Isi di bawah ini **apa adanya** (tidak disunting). Disalin ke dokumentasi utama sebagai bagian log mentah utuh.

---

Perhatikan, saat ini masih mvp dalam logic nay dan ui nya belum matang, kau boleh bua tui nya rombak ui nya dan ux nya matangkan dan boleh komfirm jika ada yang gak yakin
(di upload file backend dan frontend dan juga docs)








