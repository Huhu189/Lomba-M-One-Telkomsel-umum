# Quizfy

**Materi dan ulangan untuk anak SD, dalam satu platform.**

Distribusi materi dan ulangan adalah dua fondasi belajar anak sekolah dasar. Guru menjelaskan lewat materi, lalu mengecek dan menguatkan pemahaman lewat kuis dan ulangan. Quizfy dirancang untuk keduanya: materi dikemas sebagai perjalanan bergambar yang ditempuh anak langkah demi langkah, kuis terasa seperti permainan, dan guru melihat konsep mana yang belum dikuasai tiap murid.

Dibuat untuk **M-ONE Telkomsel Coding Competition** (Kategori Umum), tema *Innovating Education Through Technology*, subtema *Web Education for Kids*.

- Demo: quizly.projectla.biz.id
- Akun demo guru:
Admin	admin@sekolah.test	Passw0rd!Aman
Guru	guru1@sekolah.test	password12
Murid 1	murid1@sekolah.test	password12
Murid 2	murid2@sekolah.test	password12

contoh materi 
https://quizly.projectla.biz.id/materi/190/editor
https://quizly.projectla.biz.id/kuis/hnpssf6a
jalankan dari akun siswa untuk mengerjakan

## Masalah yang dijawab

- Guru SD menghabiskan banyak waktu menyusun materi dan soal, lalu memeriksanya satu per satu.
- Satu ulangan hanya memberi angka, bukan gambaran konsep mana yang lemah pada tiap anak.
- Anak SD mudah kehilangan minat bila belajar dan ulangan terasa kaku atau menegangkan.

## Fitur

### Untuk murid

- **Peta perjalanan belajar**: setiap blok materi menjadi satu pos di peta beranimasi dengan pilihan tema (mendaki gunung, pulau, angkasa). Anak naik tingkat seiring menyelesaikan pos wajib, sementara pos opsional menjadi jalan pintas.
- **Materi interaktif**: video, dokumen, dan gambar, dengan kuis yang disisipkan di titik tertentu pada video lewat editor bergaya video editor.
- **22 tipe soal** yang ramah anak: pilihan ganda, menjodohkan, mengurutkan, susun huruf, isian rumpang, garis bilangan, baca jam, hotspot gambar, teka silang mini, tugas unggah, dan lainnya.
- **Kuis yang bisa diulang**: skor percobaan pertama tetap tersimpan sebagai skor asli, terpisah dari skor setelah mengulang.
- **Ranking dan penghargaan**: peringkat per kuis, badge, dan progres per tema, dengan bantuan bagi yang tertinggal, bukan hanya penghargaan untuk juara.
- **Avatar sendiri**: murid dapat mengunggah gambar, dan teman dapat melaporkan gambar yang tidak pantas untuk ditinjau guru.
- **Tetap jalan saat sinyal buruk**: jawaban disimpan di perangkat dan dikirim ulang saat koneksi kembali.
- **Mode tamu**: murid dapat ikut kuis hanya dengan mengetik nama, bila guru membukanya.
- Layar kelas: guru mengendalikan, dan perangkat murid mengikuti.

### Untuk guru

- **Bank soal bertag** dan editor soal dengan pemilih tipe berbentuk petak berikon.
- **Penilaian**: soal objektif dinilai otomatis, isian dinilai dengan kata kunci, dan uraian atau tugas unggah masuk antrean **koreksi manual**.
- **Laporan per murid dan per tema**: konsep mana yang benar atau salah, supaya guru tahu apa yang perlu diajarkan ulang.
- **Pengaturan tiga lapis** (sekolah, kelas, kuis) untuk menyalakan atau mematikan kesempatan ulang, peringkat, mode tim, layar guru, rekam diri, dan pengawasan. Guru melihat ringkasan apa yang menyala sebelum menerbitkan kuis.
- **Mode tim** dengan penyusunan tim oleh guru.
- **Monitor ulangan** secara langsung saat murid mengerjakan.
- **Kelola data induk**: kelas, mata pelajaran, murid, dan impor murid lewat berkas, serta panel admin sekolah untuk akun guru dan murid.
- **Pengawasan ulangan formal yang bisa diatur**: deteksi keluar tab, salin-tempel, dan gangguan halaman sebagai bahan tinjauan guru, bukan vonis otomatis. Semua proteksi dapat dimatikan untuk kuis latihan anak kecil.
- Alamat kuis memakai kode acak, bukan nomor berurutan, sehingga tidak bisa ditebak.

## Prinsip keamanan

Server adalah otoritas; klien tidak dipercaya.

- Peran, identitas, waktu, urutan soal, dan skor ditentukan server.
- Kunci jawaban tidak pernah dikirim ke klien.
- Tenggat dihitung server, dan pengiriman jawaban bersifat idempoten.
- Setiap endpoint dilindungi kebijakan akses (anti-IDOR) dan pembatasan laju pada jalur login.
- Pengacakan soal dan opsi dilakukan server untuk tiap percobaan.
- Semua data dari luar (API, SSE, penyimpanan lokal) divalidasi dengan Zod di frontend.

## Teknologi

| Lapisan | Teknologi |
| --- | --- |
| Backend | Laravel, Octane, MySQL, Redis, Sanctum (mode SPA), spatie/laravel-permission, spatie/laravel-query-builder, spatie/laravel-activitylog, league/csv, Pest |
| Frontend | React, Vite, React Router, Zustand, TanStack Query, React Hook Form, Zod, Axios, Bootstrap 5.3, Vitest |
| Realtime | Node.js, Fastify, ioredis, Server-Sent Events |

Aset latar tema perjalanan dibuat sendiri untuk proyek ini dan dilepas ke domain publik (CC0); rinciannya ada di `frontend/public/tema/LISENSI.md`.

## Struktur repositori

```
backend/    API Laravel (logika bisnis, otorisasi, penilaian)
frontend/   Aplikasi React + Vite
realtime/   Layanan Node.js untuk SSE dan pemantauan langsung
docs/       Dokumen pengumpulan dan log mentah proses pengembangan
chunks/     Spesifikasi pekerjaan per tahap
AGENT.md    Dokumen acuan AI Agent
verify.sh   Menjalankan seluruh pengecekan mutu
```

=
## Proses pengembangan

Proyek ini dibuat dari nol sejak garis start lomba, dengan bantuan AI Agent.

- `AGENT.md` memuat peran, aturan kerja, stack, prinsip keamanan, dan urutan tahap kerja.
- Pekerjaan dibagi menjadi tahap berurutan, dengan commit kecil dan tanggal asli.
- Log prompt mentah dari awal sampai akhir ada di `docs/log-mentah/`, dan dokumen pengumpulan ada di `docs/word/`.

## Lisensi

MIT. Lihat berkas `LICENSE`.

# Dasar Riset Quizfy.

Quizfy dirancang untuk anak SD dengan mengacu pada riset pendidikan tentang cara anak belajar dan bertahan termotivasi. Dokumen ini menghubungkan setiap fitur utama di README dengan temuan yang melatarbelakanginya.

| Fitur di README | Bagian |
| --- | --- |
| Kuis yang bisa diulang, kuis kecil tiap sesi | 1 |
| Bank soal bertag, laporan per murid dan per tema, remedial | 2 |
| Materi interaktif dengan kuis di dalam video | 3 |
| Peta perjalanan belajar, badge, progres tema | 4 |
| Ranking, poin semangat, notifikasi, penutup sesi | 5 |
| Ranking per mata pelajaran, badge kekuatan | 6 |
| Penghargaan berupa status dan progres, tampilan bersama | 7 |
| Layar kelas | 8 |

## 1. Kuis kecil dan pengulangan

Menjawab soal untuk mengingat (retrieval practice) memperkuat ingatan dibanding hanya membaca ulang, dan efeknya ditemukan pada SD, SMP/SMA, hingga perguruan tinggi. Efeknya lebih kuat ketika diulang dan ketika siswa segera tahu jawabannya benar atau salah. Soal pilihan ganda sama efektifnya dengan isian untuk tujuan ini, dan kuis berstakes rendah dapat menurunkan kecemasan menghadapi tes.

**Penerapan di Quizfy:**
- Kuis kecil di tiap sesi dan kesempatan mengulang, yang dapat diatur guru.
- Penjelasan dan umpan balik langsung setelah anak menjawab.
- **Skor percobaan pertama tersimpan sebagai skor asli**, terpisah dari skor setelah mengulang. Pengulangan dipakai untuk belajar, sedangkan penilaian guru tetap memakai skor asli.

Sumber: eedi.com/articles/10-things-we-know-about-testing; frontiersin.org/journals/education/articles/10.3389/feduc.2019.00005; metacog.bnu.edu.cn/pdf/articles/2023/YangLiZhaoLuo2023.pdf

## 2. Asesmen formatif dan laporan untuk guru

Tinjauan atas 22 studi ketat pada siswa SD menyimpulkan bahwa asesmen formatif berdampak positif pada prestasi, terutama di matematika, dan lebih besar ketika diarahkan guru atau program komputer. Efek data penilaian juga lebih besar ketika guru memakai prosedur yang jelas untuk menelaah data dan menentukan langkah berikutnya.

**Penerapan di Quizfy:**
- Soal diberi tag konsep, sehingga laporan menunjukkan konsep mana yang benar atau salah per murid dan per kelas.
- Laporan dihubungkan dengan tindak lanjut berupa latihan remedial, bukan hanya angka.
- Soal objektif dinilai otomatis, sedangkan uraian masuk antrean koreksi manual guru.

Sumber: ies.ed.gov, "Formative assessment and elementary school student academic achievement" (REL 2017-259); epaa.asu.edu/ojs/article/download/809/852

## 3. Kuis di dalam video

Beberapa studi menemukan skor tes lebih tinggi pada video dengan pertanyaan yang disisipkan, sementara studi lain tidak menemukan perbedaan dan mencatat bahwa kuis dapat mengganggu atau menimbulkan cemas pada sebagian siswa. Hasil ini menunjukkan bahwa cara kuis disisipkan menentukan manfaatnya.

**Penerapan di Quizfy:**
- Kuis sisipan bersifat ringan dan berstakes rendah.
- Guru yang menentukan titik dan tata letak kuis lewat editor bergaya video editor.

Sumber: link.springer.com/article/10.1007/s12528-020-09263-x; link.springer.com/article/10.1007/s11528-019-00374-6; pure.fh-ooe.at/en/studentTheses/interaktive-lernvideos

## 4. Peta perjalanan, badge, dan progres

Meta-analisis menunjukkan gamifikasi umumnya meningkatkan motivasi dan hasil belajar, dengan efek yang bervariasi menurut jenjang dan rancangan. Pada siswa SD efeknya lebih kecil dibanding siswa yang lebih tua, sehingga unsur permainan perlu terhubung langsung dengan kemajuan belajar.

**Penerapan di Quizfy:**
- Setiap blok materi menjadi pos di peta perjalanan bertema (gunung, pulau, angkasa). Kenaikan tingkat dihitung dari pos wajib yang diselesaikan, jadi kemajuan visual mencerminkan kemajuan belajar nyata.
- Badge dan progres per tema memberi anak penanda capaian pribadi.

Sumber: doi.org/10.3389/fpsyg.2023.1253549; Kurnaz & Koçtürk (2025), Psychology in the Schools, doi.org/10.1002/pits.70056

## 5. Ranking, poin semangat, dan notifikasi

Riset tentang papan peringkat menunjukkan efek yang berbeda menurut posisi anak. Ranking yang menampilkan posisi di sekitar diri sendiri dinilai lebih ringan tekanannya dibanding ranking penuh, dan ada saran membatasi tampilan publik peringkat bawah. Eksperimen acak pada sekitar 400 anak kelas 3 SD (usia rata-rata 8,6 tahun) menemukan bahwa ranking yang poinnya dihitung dari **peningkatan performa tiap anak** meningkatkan motivasi, usaha, dan performa matematika anak berprestasi rendah tanpa merugikan anak lain. Studi yang sama mencatat stres yang lebih tinggi pada anak berprestasi rendah, sehingga cara penyajiannya perlu dijaga.

**Penerapan di Quizfy:**
- Ranking dihitung per kuis dan per mata pelajaran, tidak diakumulasi menjadi papan permanen.
- **Poin semangat dipisahkan dari nilai murni.** Buff untuk anak di bawah peringkat 50% hanya memengaruhi poin permainan; skor asli dan nilai rapor tidak berubah.
- Notifikasi bernada semangat dan merata untuk semua anak.
- Opsi tanpa ranking, diatur guru lewat pengaturan tiga lapis.

Sumber: download.uni-mainz.de/RePEc/pdf/Discussion_Paper_1908.pdf (Hermes, Huschens, Rothlauf & Schunk, 2019); hub.hku.hk/handle/10722/368255; epub.ub.uni-muenchen.de/96762; springerprofessional.de, "The dark side of gamification"

## 6. Ranking per mata pelajaran dan badge kekuatan

Persepsi diri akademik bersifat spesifik per bidang: merasa mampu di satu mata pelajaran hampir tidak berkaitan dengan persepsi diri di mata pelajaran lain, termasuk pada anak SD. Dengan ranking dan badge per mapel, anak yang berbeda dapat merasa kompeten di bidang yang berbeda.

**Penerapan di Quizfy:**
- Ranking dan badge kekuatan dipisah per mata pelajaran (misalnya Jagoan IPA, Jagoan IPS).
- Penghargaan kemajuan pribadi tersedia untuk semua anak.

Sumber: pmc.ncbi.nlm.nih.gov/articles/PMC9853285; pedocs.de/volltexte/2020/16795/pdf/Arens_2018_testing_internal_external_A.pdf

## 7. Penghargaan dan tampilan bersama

Hadiah berwujud cenderung lebih melemahkan motivasi intrinsik pada anak dibanding mahasiswa, sedangkan hadiah tak terduga tidak berpengaruh. Perilaku siswa juga berubah ketika usaha atau pilihannya terlihat teman, dan umpan balik kolektif yang ditampilkan ke seluruh kelas dapat menambah ancaman perbandingan sosial.

**Penerapan di Quizfy:**
- Penghargaan berupa status, badge, dan progres, bukan hadiah berwujud.
- Umpan balik pribadi tampil di perangkat murid.
- Penutup sesi menampilkan semua murid tanpa urutan peringkat.

Sumber: Deci, Koestner & Ryan (1999), depts.washington.edu/techdocs/papers/deciExtrinsicRewardsAndIntrinsicMotivation99.pdf; Bursztyn & Jensen (2015), pmc.ncbi.nlm.nih.gov/articles/PMC4698889; isidore.science/document/10670/1.kqfy78

## 8. Layar kelas

Menampilkan slide guru di perangkat siswa mengurangi multitasking dan meningkatkan keterlibatan pada satu studi di perkuliahan.

**Penerapan di Quizfy:**
- Guru mengendalikan layar kelas dan perangkat murid mengikuti, dengan toggle yang diatur guru sehingga dapat dimatikan ketika anak perlu melihat langsung ke guru.

Sumber: hal-ensta-bretagne.archives-ouvertes.fr/IBSHS/hal-04107214v1

=
