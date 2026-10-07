# Penjelasan Fitur Utama — untuk Juri dan Guru

Aplikasi ulangan dan belajar online untuk sekolah dasar.
Lomba M-ONE Telkomsel Coding Competition, kategori Umum, subtema *Web Education for Kids (SD)*.

Dokumen ini ditulis untuk **juri dan guru**, bukan untuk programmer. Istilah teknis dihindari; bila perlu, dijelaskan dengan contoh kelas yang nyata.

Kondisi lapangan yang kami hadapi dan jujur kami sampaikan: banyak sekolah punya **perangkat terbatas yang dipakai bergantian** dan **sinyal yang tidak selalu stabil**. Karena itu aplikasi ini dirancang hemat, tetap jalan walau koneksi pincang, dan tidak menjanjikan lebih dari yang dikerjakan.

Nilai utama yang kami kejar: **murid yang tertinggal jadi terlihat dan terbantu, guru langsung tahu tema mana yang lemah, dan nilai tetap jujur** — karena semua keputusan penting (nilai, waktu, urutan soal) ditentukan oleh server, bukan oleh perangkat murid.

Prinsip keamanan satu kalimat: **"jangan percaya perangkat murid" (do not trust client)**. Perangkat hanya alat tampil; server yang memegang kebenaran.

---

## 1. Mesin ulangan yang tidak percaya klien

### Apa ini
Mesin yang menjalankan ulangan dari awal sampai selesai: murid menerima soal, menjawab, lalu kuis dikumpulkan dan dinilai. Semua keputusan penting diambil server, bukan HP atau laptop murid.

### Cara kerjanya
Saat kuis dimulai, server mencatat waktunya sendiri dan menghitung sendiri batas waktunya. Soal dan pilihan jawaban diacak oleh server untuk tiap murid (contoh: di kuis pecahan kelas 4, urutan soal milik Rina berbeda dengan milik Budi, jadi menyontek tetangga tidak berguna). Jawaban tersimpan otomatis di perangkat sebagai cadangan, jadi kalau sinyal putus atau aplikasi tertutup tidak sengaja, jawaban murid tidak hilang dan bisa dilanjutkan. Saat murid menekan "Kumpulkan", tanda khusus (kunci satu kali) dikirim bersama jawaban sehingga menekan dua kali atau membuka dua tab tidak membuat nilainya dobel.

### Mengapa aman
Waktu, urutan soal, dan nilai ditentukan server — perangkat tidak bisa memalsukannya. Kunci jawaban **tidak pernah dikirim ke perangkat murid**, jadi tidak ada yang bisa dicuri dari HP atau laptop. Murid yang mencoba mengubah jam di perangkatnya tidak terbantu: hitungan waktu tetap milik server; kumpul setelah lewat waktu ditolak atau ditandai terlambat.

### Manfaat untuk anak SD dan guru
Anak SD sering salah menekan tombol atau perangkatnya tiba-tiba dipakai bergantian — cadangan jawaban otomatis menyelamatkan kerja mereka. Guru tidak lagi memeriksa kerja dobel atau memperdebatkan "tadi kumpul duluan siapa": server yang mencatat, adil untuk semua.

Status: **sudah bisa dipakai** (slice 04). Menyimpan jawaban otomatis, mengumpulkan dua kali tidak
digandakan, dan waktu habis dikumpulkan otomatis oleh server.

---

## 2. Delapan jenis soal dan penilaian otomatis

### Apa ini
Delapan bentuk soal yang biasa dipakai guru SD, yang dinilai otomatis sebisanya: pilihan ganda, benar/salah, isian singkat, uraian, menjodohkan, mengurutkan, letak kata, dan hubung kata.

### Cara kerjanya
Guru membuat soal sekali di bank soal, lengkap dengan kunci jawabannya. Saat murid selesai, soal pilihan ganda, benar/salah, menjodohkan, dan mengurutkan langsung dinilai otomatis. Isian singkat dan uraian dinilai lebih hati-hati: aplikasi mengabaikan perbedaan kecil penulisan (misalnya "pecahan" salah ketik "pecahn" masih bisa diterima sesuai ambang yang guru atur), angka harus persis, kata kunci dipakai untuk menilai uraian. Bila jawaban ragu-ragu, aplikasi menandainya "perlu ditinjau" — bukan menebak benar atau salah. Penilaian AI (bila dinyalakan) bekerja hanya di server dan hasilnya hanya **saran** untuk guru; keputusan akhir tetap guru, lewat koreksi manual yang mencatat siapa mengubah apa dan kenapa.

### Mengapa aman
Kunci jawaban hanya hidup di server. Penilaian yang gagal di satu soal tidak menjatuhkan soal lain — murid tetap dinilai adil. Koreksi manual guru butuh alasan dan pencatatan khusus (audit), sehingga perubahan nilai bisa dilacak dan tidak bisa disembunyikan.

### Manfaat untuk anak SD dan guru
Guru kelas 4 yang mengoreksi 30 lembar uraian "sebutkan ciri hewan berkaki dua" bisa pulang lebih cepat: yang jelas dinilai otomatis, yang ragu tinggal ditinjau. Anak yang tulisannya berantakan atau salah ketik tidak langsung dianggap salah — aplikasi memaklumi typo yang wajar untuk usia SD.

Status: **sudah bisa dipakai** (slice 06). Delapan tipe soal tersedia di editor guru, dinilai otomatis,
lalu guru mengoreksi manual lewat token konfirmasi sekali pakai yang tercatat di audit.
Pengoreksian bahasa oleh AI menyusul di slice 09.

---

## 3. Pemahaman per tema

### Apa ini
Laporan yang menunjukkan tema mana yang sudah dikuasai murid dan mana yang masih lemah. Guru menempelkan "tag tema" pada soal (misalnya: pecahan, pengukuran, membaca pemahaman).

### Cara kerjanya
Setelah beberapa kuis, setiap murid punya peta per tema: **belum paham / mulai paham / paham**. Ambang batasnya guru yang menentukan. Contoh nyata: dari kuis pecahan kelas 4, guru membuka laporan dan langsung melihat "6 dari 30 murid masih belum paham menyederhanakan pecahan" — lengkap dengan siapa saja.

### Mengapa aman
Laporan dihitung server dari jawaban asli, bukan dari klaim perangkat murid. Laporan adalah **acuan mengajar, bukan vonis** — guru yang memutuskan tindak lanjutnya.

### Manfaat untuk anak SD dan guru
Anak yang tertinggal jadi terlihat lebih awal — bukan baru ketahuan saat rapor. Guru tidak perlu menghitung manual per soal per murid; waktunya beralih ke mengajar ulang tema yang lemah.

Status: **sudah bisa dipakai** (slice 05). Halaman progres per tema untuk murid dan laporan per tema untuk
guru, dengan ambang pemahaman dan data minimum yang diatur guru.

---

## 4. Skor asli, skor ulang, ranking, badge, remedial

### Apa ini
Sistem nilai yang jujur: nilai pertama ulangan (skor asli) tidak pernah berubah, sementara murid tetap boleh berlatih ulang, mendapat lencana (badge), dan remedial otomatis.

### Cara kerjanya
Skor asli tersimpan permanen. Kalau guru menyalakan retry, murid boleh mengerjakan ulang dan skornya dicatat **terpisah** — nilai pertama tetap jadi acuan ranking. Ranking diurutkan dari skor asli; kalau seri, yang lebih cepat selesai menang, lalu urut nama. Badge per mapel memberi apresiasi. Remedial otomatis menyusun latihan dari soal bertag yang lemah, tanpa mengubah nilai asli.

### Mengapa aman
Semua perhitungan di server; skor asli tidak punya jalur perubahan dari klien. Ranking default-nya mati — guru yang menyalakannya, karena tidak semua kelas senang diperbandingkan.

### Manfaat untuk anak SD dan guru
Anak SD berani mencoba lagi tanpa takut nilai jeleknya "nempel selamanya", tapi nilai resmi tetap jujur. Guru bisa menyalakan ranking hanya saat cocok, dan remedial jalan sendiri untuk murid yang butuh.

Status: **sudah bisa dipakai** (slice 05). Ranking mati secara bawaan; lencana per mapel dan remedial
otomatis tersedia.

---

## 5. Pengaturan tiga lapis dengan kunci dari sekolah

### Apa ini
Aturan aplikasi yang bisa diatur di tingga lapis: sekolah, kelas, lalu kuis. Misalnya: berapa kali boleh retry, apakah ranking menyala, apakah anti-kecurangan aktif.

### Cara kerjanya
Kuis yang lebih spesifik menang dibanding kelas, kelas menang dibanding sekolah — kecuali sekolah mengunci aturan tertentu (locked), dan kunci itu tidak bisa dibongkar di bawahnya. Contoh: sekolah menetapkan retry maksimal 2 dan menguncinya; guru kelas 4 boleh menyalakan ranking untuk kuis pecahan saja, tapi tidak bisa melonggarkan batas retry.

### Mengapa aman
Perubahan pengaturan lewat server, dengan izin dan pencatatan. Perangkat murid tidak bisa mengubah aturan ulangan yang sedang berjalan.

### Manfaat untuk anak SD dan guru
Kepala sekolah/guru senior menyeragamkan hal penting sekali saja di lapis sekolah; guru kelas tetap punya keleluasaan untuk hal kecil. Anak SD di semua kelas mendapat aturan yang konsisten.

Status: **sudah bisa dipakai** (slice 02, diperluas di slice 07). Saklar anti-cheat juga memakai mekanisme
yang sama, termasuk preset ujian yang bisa dinyalakan sekali klik.

---

## 6. Materi berblok dengan kuis sisipan + layar guru di perangkat murid

### Apa ini
Materi pelajaran disusun seperti perjalanan: blok teks, blok gambar/video, dan blok kuis kecil di tengahnya. Ditambah fitur layar guru: tampilan yang guru buka bisa muncul di perangkat murid — yang disinkronkan **kontennya**, bukan layar penuh seperti aplikasi rapat.

### Cara kerjanya
Guru menyusun materi "Mengenal Pecahan" misalnya: penjelasan singkat → gambar pizza terbagi → kuis latihan 3 soal → video → kuis latihan lagi. Kuis sisipannya memakai soal dari bank soal yang sudah ada (tidak ada jenis soal baru) dan bertipe **latihan**: skornya masuk laporan tema, tidak masuk ranking, bukan nilai asli ulangan. Guru menandai blok wajib atau opsional; server yang memastikan urutannya ditempuh — murid tidak bisa melompat ke blok akhir. Saat layar guru menyala, murid di kelas otomatis berpindah mengikuti halaman yang guru buka (termasuk nomor blok), dipandu lewat jalur data ringan (SSE).

### Mengapa aman
Urutan blok ditegakkan server, bukan dari perangkat murid. Materi disajikan lewat tautan bertanda tangan yang kedaluwarsa, bukan folder terbuka. Layar guru hanya mengirim instruksi konten — murid tidak bisa mengirim layar palsu ke guru.

### Manfaat untuk anak SD dan guru
Materi jadi hidup: anak membaca sebentar, mencoba kuis kecil, lalu lanjut — cocok untuk rentang perhatian anak SD, dan anak yang salah di tengah materi langsung berlatih sebelum lanjut. Guru tidak perlu berteriak "buka halaman 23": semua perangkat murid ikut berpindah sendiri, hemat waktu kelas.

Status: **sebagian sudah bisa dipakai** (slice 08). Materi berblok dengan kuis sisipan latihan,
penerbitan materi, berkas aman (kategori ditentukan dari isi berkas, disajikan lewat tautan
bertanda tangan), dan laporan tema per murid sudah jalan serta diuji. Yang **belum** dikerjakan
dan kami sebutkan apa adanya: **layar guru ke perangkat murid** (sinkron konten lewat SSE) — kunci
pengaturannya sudah ada, tetapi penyiaran kontennya belum dibuat.

---

## 7. Anti-kecurangan, presence, dan Live Monitor

### Apa ini
Tiga hal sekaligus: penghalang sederhana saat ulangan (anti-paste, anti-pindah tab, dan lainnya), cara tahu murid mana yang perangkatnya hidup tapi diam saja, dan layar pemantauan guru secara langsung.

### Cara kerjanya
Semua penghalang **mati secara bawaan** dan guru yang menyalakan lewat pengaturan. Saat menyala: menempel jawaban dari luar diblok dan dicatat, pindah tab dicatat satu kali per kepergian, buka layar penuh yang keluar diberi peringatan. Semua kejadian hanya **catatan untuk guru** — bukan hukuman otomatis. Presence bekerja hemat data: klien tidak mengirim detak jantung terus-menerus; status dihitung dari aktivitas normal murid, jadi hemat kuota dan ramah sinyal lemah. Live Monitor menampilkan siapa sedang mengerjakan apa, progres, dan catatan kejadian — mengalir tanpa muat ulang.

### Mengapa aman
Kami jujur: **deteksi di browser bisa diakali**, dan aplikasi ini tidak pernah mengklaim "tahan 100%". Karena itu catatannya berfungsi sebagai bahan tinjauan guru (valid / tidak valid / menunggu), bukan vonis. Kalau perlindungannya error, ulangan **tetap jalan** (fail-open) — proteksi tidak boleh mengorbankan ujian.

### Manfaat untuk anak SD dan guru
Guru kelas 6 saat ulangan ulang semester tidak lagi berjalan bolak-balik: dari satu layar dia lihat siapa yang belum mulai, siapa diam lama, dan catatan kejadian yang perlu ditanya baik-baik ke murid. Anak SD tidak dituduh sembarangan — guru yang menilai konteksnya.

Status: **sudah bisa dipakai** (slice 07). Semua pengaman mati secara bawaan dan baru bekerja bila guru menyalakannya. Guru bisa meninjau tiap catatan (valid / tidak valid) langsung dari Live Monitor. Yang belum ada dan kami sebutkan apa adanya: deteksi gangguan proteksi tingkat lanjut, deteksi keluar layar penuh, dan pemanggilan Zoom/Meet untuk verifikasi — ketiganya ditunda, bukan disembunyikan.

---

## 8. Avatar murid dengan tombol lapor dan moderasi otomatis

### Apa ini
Foto profil anak dengan pengaman: kalau ada avatar yang tidak pantas, teman bisa melaporkan, dan sistem menyembunyikannya otomatis sampai guru meninjau.

### Cara kerjanya
Avatar hanya menerima format foto aman (JPEG/PNG/WebP; file lain termasuk gambar berisi kode ditolak) dan diolah ulang oleh server ke ukuran tetap. Satu murid hanya boleh melapor satu kali untuk satu avatar. Setelah batas laporan (bawaan: 3 orang berbeda), avatar otomatis **disembunyikan dari orang lain** — pemiliknya masih melihat punyanya sendiri — dan masuk antrean tinjauan guru untuk dipulihkan atau dihapus.

### Mengapa aman
File avatar diproses ulang di server (bukan dipercaya begitu saja), nama berkas diacak, dan penyimpanan di luar folder publik. Setiap tindakan guru (pulihkan/hapus) tercatat di audit.

### Manfaat untuk anak SD dan guru
Anak SD suka bermain avatar, tapi kadang memasang gambar yang bikin risih. Guru tidak harus memeriksa 30 avatar satu per satu setiap hari — yang bermasalah muncul sendiri ke antrean, dan yang laporan pun terlindungi dari drama antarteman.

Status: **sudah bisa dipakai** (slice 08). Foto diencode ulang server ke 256×256 (JPEG), jadi berkas
kiriman tidak pernah disajikan apa adanya dan metadata di dalamnya ikut hilang. Avatar bawaan
memakai inisial nama, satu murid hanya bisa melapor sekali per avatar, dan setelah 3 laporan unik
avatar disembunyikan dari murid lain sementara pemiliknya tetap melihatnya. Keputusan guru
(pulihkan / hapus) masuk audit. Satu hal yang kami pilih sengaja: avatar yang menunggu tinjauan
**tidak bisa** dihapus pemiliknya sendiri, supaya gambarnya tidak hilang sebelum guru melihatnya
(murid tetap boleh mengunggah gambar baru).

---

## 9. Lampiran jawaban: gambar papan tulis, rekam diri, dan berkas

### Apa ini
Selain mengetik, murid bisa melampirkan jawaban: gambar yang digambar **langsung di layar** (mis. menulis
caranya di papan tulis digital), **rekaman diri** saat anak menjelaskan dengan suara (bisa dinyalakan atau
dimatikan sekolah), dan **berkas** (foto hasil kerja di buku, PDF, dsb.).

### Cara kerjanya
Berkas dikirim **terpotong-potong** (potongan kecil 1 MiB) sambil kuis berjalan, jadi koneksi sekolah yang
lambat tidak membuat unggahan gagal total dan bisa dilanjutkan. Unggahan baru dianggap sah setelah potongan
terakhir tiba dengan sidik jari (hash) yang cocok. Gambar diolah ulang di server menjadi PNG bersih, dan
berkas yang formatnya berisiko dipaksa terunduh sebagai `.upload` alih-alih ditampilkan. Semua lampiran
terikat pada attempt dan soal, serta ditolak setelah waktu ulangan habis. Sisa unggahan yang tidak pernah
selesai dibersihkan otomatis supaya disk tidak penuh.

### Mengapa aman
Nama berkas diacak dan disimpan di luar folder publik; hanya pemilik attempt, guru kelas, dan wali kelas
yang bisa membukanya, dan URL gambarnya bertanda tangan serta kedaluwarsa. Rekaman diri butuh izin yang
dinyalakan sekolah lebih dulu, dengan batas durasi untuk melindungi anak.

### Manfaat untuk anak SD dan guru
Anak SD belum lancar mengetik, dan banyak soal (menulis tegak bersambung, menggambar bangun, membaca
nyaring) lebih jujur dinilai lewat gambar atau suara daripada lewat teks. Guru juga jadi punya bukti
pekerjaan anak yang bisa ditunjukkan ke orang tua.

Status: **sudah bisa dipakai** (slice 09-A). Rekaman diri mengikuti saklar sekolah dan bawaannya **mati**.
Yang belum ada dan kami sebutkan apa adanya: pemutaran ulang rekaman di layar guru masih memakai pemutar
browser biasa, dan belum ada batas kuota penyimpanan per sekolah.

---

## 10. Penilaian AI untuk jawaban uraian (saran, bukan hakim)

### Apa ini
Untuk soal uraian, guru bisa meminta bantuan AI membaca jawaban anak dan memberi usulan nilai beserta
catatan singkat. Angkanya **cuma saran** — nilai resmi tetap keluar dari tangan guru.

### Cara kerjanya
Permintaan ke AI hanya dijalankan **dari server lewat antrean** (satu permintaan per ulangan, dipecah bila
soalnya banyak), sehingga menekan "kumpulkan" tidak ikut menunggu layanan pihak ketiga. Jawaban murid
dikirim sebagai **data di dalam pembatas** dan model diinstruksikan mengabaikan perintah apa pun di
dalamnya. Balasannya wajib JSON sesuai skema; skornya selalu **dipotong ke rentang soal**, jadi model tidak
bisa memberi nilai 100 atau nilai negatif. Hasilnya disimpan di kolom terpisah (`skor_ai`, `alasan_ai`),
**tidak pernah** menyentuh nilai final. Kalau AI gagal, timeout, atau menjawab di luar skema, jawaban tetap
"perlu ditinjau" — tidak ada nilai yang lolos tanpa dilihat manusia.

### Mengapa aman
Kunci API AI hanya hidup di server (variabel lingkungan), tidak pernah ikut ke halaman web, ke respons API,
atau ke log. Alasan mentah dari AI hanya tampil di antrean koreksi guru dan **tidak pernah** muncul di hasil
murid. Bawaannya mati: instalasi tanpa kunci API tetap berjalan normal, dan penilaian manual tetap jalan.

### Manfaat untuk anak SD dan guru
Guru kelas 3 yang mengoreksi 30 jawaban uraian bisa mulai dari angka usulan, bukan dari nol — tetapi
tetap memegang keputusan akhir dan wajib menuliskan alasan koreksinya di audit.

Status: **sudah bisa dipakai** (slice 09-B), bawaan **mati** sampai sekolah mengisi kunci API sendiri.
Yang belum ada dan kami sebutkan apa adanya: penilaian AI belum membaca lampiran gambar/rekaman (baru teks
uraian), dan belum ada pemantauan biaya pemakaian API per sekolah.

---

## 11. Mode tim

### Apa ini
Opsi kuis dikerjakan **berkelompok**: satu tim satu jawaban bersama, satu nilai untuk semua anggota.

### Cara kerjanya
Guru menyalakan mode tim pada kuis tertentu. Anggota tim berdiskusi lalu satu jawaban dikirim atas nama tim (dengan riwayat versi, jadi terlihat bila diganti). Skor tim dibagi sama rata ke anggota. Ranking (bila menyala) diurutkan per tim.

### Mengapa aman
Identifikasi tim dan penerimaan jawaban tetap di server; versi jawaban mencegah sengketa "siapa yang ganti jawaban kami".

### Manfaat untuk anak SD dan guru
Belajar gotong royong: anak yang pintar matematika mengajari yang belum, dan nilainya dinikmati bersama — sesuai Profil Pelajar Pancasila. Guru bisa memakainya untuk kuis kompetisi seru tanpa anak yang lemah merasa hancur.

Status: belum dikerjakan (diisi ulang di tiap akhir slice).

---

## Batasan jujur

**Yang sengaja TIDAK kami lakukan:**
- Tanpa share layar WebRTC — layar guru hanya menyinkronkan **konten**, bukan salinan layar penuh.
- Tanpa kuis di detik tertentu dalam video — kuis sisipan hanya blok setelah/selama materi, bukan tersemat pada detik video.
- Tanpa multi-tenant — satu instalasi untuk satu sekolah.
- Anti-cheat **tidak menjamin 100%** — semua deteksi di browser bisa diakali; catatannya adalah bahan tinjauan guru, bukan vonis.

**Fitur yang masuk daftar potong bila waktu mepet** (urutan dari chunk_map.json): cache L1, ekspor xlsx, mode gelap, mode tim, penilaian AI, rekam diri, avatar dan moderasi, layar guru.

**Yang tidak boleh dipotong apa pun alasannya:** deploy dengan link yang bisa dibuka, Octane Swoole (atau catatan jujur bila gagal), keamanan inti (auth, pembatasan akses antar murid, kunci jawaban tidak bocor, deadline dari server), serta jurnal prompt dan log mentah yang jujur.
