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

Kelas besar tetap lancar: setiap ketukan jawaban hanya membaca data yang benar-benar dibutuhkan (bukan seluruh bank soal), dan saat satu kelas menekan "Kumpulkan" hampir bersamaan, seluruh lembar dinilai dari satu bacaan lalu ditulis sekali — jadi tidak ada penumpukan permintaan di detik terakhir.

Status: **sudah bisa dipakai** (slice 04). Menyimpan jawaban otomatis, mengumpulkan dua kali tidak
digandakan, dan waktu habis dikumpulkan otomatis oleh server. Putaran 9 Oktober 2026 membuat biaya
menyimpan dan mengumpulkan jawaban tidak lagi tumbuh seiring jumlah soal.

---

## 2. Dua puluh dua jenis soal dan penilaian otomatis

### Apa ini
Dua puluh dua bentuk soal yang biasa dipakai guru SD, yang dinilai otomatis sebisanya. Delapan tipe lama: pilihan ganda, benar/salah, isian singkat, uraian, menjodohkan, mengurutkan, letak kata, dan hubung kata. Empat belas tipe tambahan: pilihan ganda kompleks (jawaban boleh lebih dari satu), benar/salah majemuk (beberapa pernyataan sekaligus), isian angka bertoleransi, isian rumpang (kalimat berlubang), klasifikasi (memasukkan item ke kotak), pilihan gambar, urut gambar, hotspot gambar (mengetuk bagian gambar), susun huruf, tabel isian, garis bilangan, baca jam, teka silang mini, dan tugas unggah (foto/coretan/suara hasil kerja anak — satu-satunya tipe yang selalu ditinjau guru, bukan dinilai mesin).

### Cara kerjanya
Guru membuat soal sekali di bank soal, lengkap dengan kunci jawabannya. Saat murid selesai, soal yang objektif langsung dinilai otomatis — sebagian tipe juga memberi **skor sebagian**: anak yang mencentang tiga dari empat jawaban benar, atau mengisi tiga dari lima lubang, tetap mendapat nilai sesuai porsi yang benar, bukan nol. Isian singkat dan uraian dinilai lebih hati-hati: aplikasi mengabaikan perbedaan kecil penulisan (misalnya "pecahan" salah ketik "pecahn" masih bisa diterima sesuai ambang yang guru atur), angka harus persis, kata kunci dipakai untuk menilai uraian. Tugas unggah tidak pernah dinilai mesin: berkasnya masuk antrean koreksi guru lengkap dengan rubrik yang guru tulis sendiri. Bila jawaban ragu-ragu, aplikasi menandainya "perlu ditinjau" — bukan menebak benar atau salah. Penilaian AI (bila dinyalakan) bekerja hanya di server dan hasilnya hanya **saran** untuk guru; keputusan akhir tetap guru, lewat koreksi manual yang mencatat siapa mengubah apa dan kenapa.

### Mengapa aman
Kunci jawaban hanya hidup di server. Penilaian yang gagal di satu soal tidak menjatuhkan soal lain — murid tetap dinilai adil. Koreksi manual guru butuh alasan dan pencatatan khusus (audit), sehingga perubahan nilai bisa dilacak dan tidak bisa disembunyikan.

### Manfaat untuk anak SD dan guru
Guru kelas 4 yang mengoreksi 30 lembar uraian "sebutkan ciri hewan berkaki dua" bisa pulang lebih cepat: yang jelas dinilai otomatis, yang ragu tinggal ditinjau. Anak yang tulisannya berantakan atau salah ketik tidak langsung dianggap salah — aplikasi memaklumi typo yang wajar untuk usia SD.

Status: **sudah bisa dipakai** (slice 06 + putaran 22 tipe). Dua puluh dua tipe soal tersedia di editor guru,
dinilai otomatis (objektif) atau menunggu koreksi guru (isian singkat, uraian, tugas unggah),
lalu guru mengoreksi manual lewat token konfirmasi sekali pakai yang tercatat di audit.
Pengoreksian bahasa oleh AI menyusul di slice 09.

Catatan tampilan: editor soal adalah **kartu pertanyaan** — pertanyaan di **paling atas** dengan **Poin**
di kanan atasnya, dan jawaban menempel **langsung di bawah pertanyaan**: pilihan ganda tampil sebagai
baris penuh dengan **lingkaran kunci di kiri** (sekali klik menandai jawaban benar, ringkasan kunci muncul
di bawahnya). **Jenis soal dipilih lebih dulu** di kartu **1. Pilih jenis soal** — semua 22 jenis tampil
sekaligus sebagai **petak berikon** (ikonnya menggambarkan bentuk soalnya) yang bisa dilipat, ringkasannya
tetap memperlihatkan jenis yang sedang aktif walau lipatan ditutup — lalu **2. Tulis soalnya** dan
**3. Pengaturan soal** (mapel, tag, pembahasan, media/MathML, aktif). Daftar periksa **Kelengkapan** di sisi
kanan bersama pratinjau (cermin aturan server, jadi tombol simpan baru hidup saat soal benar-benar
lengkap). Kuis disusun
lewat tiga langkah — info & jadwal, susun soal, lalu tinjau dan publikasikan — supaya guru tidak
menerbitkan kuis setengah jadi. Di layar murid, tiap jenis soal menampilkan **bahan yang memang dibutuhkan**
untuk menjawabnya (pilihan ganda: opsinya; menjodohkan/hubung kata: dua kolomnya; mengurutkan: itemnya;
letak kata: kata **dan** kolom posisinya) — soal tidak lagi tampil kosong hanya karena server tidak ikut
mengirim salah satu daftar itu.

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

### Peringkat sebagai alat kelas (14 Oktober 2026)
Peringkat dipakai guru di depan kelas — bisa ditampilkan besar-besar lewat **mode proyektor** di halaman
peringkat. Yang dibuka untuk murid dibatasi dua hal:

- **Nomor peringkat hanya untuk N% teratas** (`peringkat_terbuka_persen`, bawaan 30%). Murid lain tetap
  melihat **skornya sendiri** dan diberi tahu bahwa nomornya belum dibuka — bukan layar kosong. Guru selalu
  melihat seluruh papan.
- **Bonus penyemangat** (`bonus_semangat`, bawaan **mati**): murid yang nilainya di bawah ambang
  (`bonus_semangat_bawah_persen`, bawaan 50%) dinaikkan angka **tampilannya** sampai melewati ambang dan
  titik tengah kelas, dibatasi `bonus_semangat_maks_persen` (bawaan 15%). Ini **bukan nilai**: yang tercatat
  di rapor, ekspor nilai, dan laporan tetap skor sebenarnya.

Jejak bonus hanya sampai ke guru: barisnya bertanda "dibantu" lengkap dengan nilai dan peringkat aslinya,
sedangkan respons untuk murid sama sekali tidak memuat kunci bonus — dan mode proyektor menyembunyikan
kolom itu juga, supaya papan yang menghadap kelas sama persis dengan yang dilihat murid.

Sejak 14 Oktober 2026 papan yang sama bisa juga **dikirim ke HP murid** lewat mode "Papan peringkat" di
layar kelas: yang tampil di perangkat anak adalah papan versi murid (nomor hanya N% teratas), bukan papan
penuh milik guru — disusun dari komponen dan data yang sama dengan halaman peringkatnya, jadi tidak ada
angka yang bisa dibaca berbeda antara HP anak dan papan di kelas.

Di **mode tim** aturannya sama, tetapi yang diperingkat adalah timnya: satu baris per tim berisi nama tim dan
anggotanya, dan bahasa di layar anak ikut mengganti kata ("peringkat timmu", "skor timmu", "N tim teratas").
**Bonus penyemangat tidak berlaku di papan tim** walau saklarnya menyala: yang tampil adalah nilai kelompok
apa adanya, karena menambal angka kelompok bukan menyemangati anak — ia justru menutupi hasil kerja bersama
dari guru dan anggotanya sendiri.

### Mengapa aman
Semua perhitungan di server; skor asli tidak punya jalur perubahan dari klien. Ranking default-nya mati — guru yang menyalakannya, karena tidak semua kelas senang diperbandingkan. Yang bisa diubah bonus hanyalah angka di papan; nilai resmi tetap jujur.

### Manfaat untuk anak SD dan guru
Anak SD berani mencoba lagi tanpa takut nilai jeleknya "nempel selamanya", tapi nilai resmi tetap jujur. Guru bisa menyalakan ranking hanya saat cocok, dan remedial jalan sendiri untuk murid yang butuh. Anak yang selalu di bawah tidak lagi melihat namanya terpaku di dasar papan, sementara gurunya tetap tahu keadaan sebenarnya.

Status: **sudah bisa dipakai** (slice 05). Ranking mati secara bawaan; lencana per mapel dan remedial
otomatis tersedia. Aturan N% teratas dan bonus penyemangat bisa diatur guru per kuis (panel setelan
ulangan, kelompok "Tampilan & laporan").

---

## 5. Pengaturan tiga lapis dengan kunci dari sekolah

### Apa ini
Aturan aplikasi yang bisa diatur di tingga lapis: sekolah, kelas, lalu kuis. Misalnya: berapa kali boleh retry, apakah ranking menyala, apakah anti-kecurangan aktif.

### Cara kerjanya
Kuis yang lebih spesifik menang dibanding kelas, kelas menang dibanding sekolah — kecuali sekolah mengunci aturan tertentu (locked), dan kunci itu tidak bisa dibongkar di bawahnya. Contoh: sekolah menetapkan retry maksimal 2 dan menguncinya; guru kelas 4 boleh menyalakan ranking untuk kuis pecahan saja, tapi tidak bisa melonggarkan batas retry.

Setelan ulangan **menyatu dengan kuisnya**: guru membuka kuisnya (halaman detail/kelola kuis) dan
menyetel proteksi atau aturan di panel **Setelan ulangan** pada halaman itu. Tidak ada lagi daftar
ulangan untuk dipilih lebih dulu — jadi tidak ada cara salah memilih ulangan, dan halaman
**/pengaturan** kembali ke arti namanya: **akun** (nama, kata sandi, tampilan), bukan aturan ulangan.

Riwayat singkat supaya tidak membingungkan pembaca dokumen lama: sampai 11 Oktober 2026 halaman
Pengaturan menawarkan tiga lapis (sekolah/kelas/kuis); 12 Oktober 2026 pemilih lapis sekolah/kelas
dibuang; 13 Oktober 2026 pemilih ulangannya juga dibuang karena kuisnya sendiri sudah menjadi
konteksnya.

Lapis sekolah dan kelas **tetap berlaku di server** dan tetap bisa mengunci sebuah nilai; panel di
halaman kuis hanya menampilkan akibatnya ("dikunci sekolah") tanpa menjadi tempat menyetelnya — jadi
tidak ada lagi tombol yang bilangan hasilnya sama untuk semua ulangan.

### Mengapa aman
Perubahan pengaturan lewat server, dengan izin dan pencatatan. Perangkat murid tidak bisa mengubah
aturan ulangan yang sedang berjalan, dan tidak bisa membaca daftar proteksi yang dipasang guru —
saklar yang mengikatnya dikirim satu per satu lewat data ulangan, bukan sebagai peta lengkap.

### Melihat akibatnya sebelum kuis diterbitkan
Di langkah terakhir penyusunan kuis (“Tinjau dan publikasi”) ada panel **Setelan sesi ini** yang meringkas — dalam tiga baris — apa yang benar-benar berlaku untuk kuis itu setelah digabung dengan pengaturan kelas dan sekolah:

1. **Proteksi**: berapa saklar anti-kecurangan yang menyala dan nama-namanya. Kalau saklar induk anti-cheat mati, panelnya berkata terus terang bahwa **tidak ada proteksi yang dipasang** — walau saklar rinci pernah dinyalakan — supaya guru tidak menyangka ulangannya diawasi padahal tidak.
2. **Siswa tamu**: boleh ikut tanpa akun atau tidak, beserta lapis mana yang menentukannya (kuis ini, kelas, atau sekolah).
3. **Aturan lain**: ulangan ulang, peringkat, mode tim, layar guru, dan rekam diri — nyala atau mati.

Di panel yang sama ada tombol **Buat tautan siswa** yang menghasilkan satu tautan `/kuis/<id>` untuk dibagikan (WhatsApp, papan tulis, grup kelas). Tautan itu bekerja untuk dua jenis pengunjung: murid yang sudah punya akun langsung menekan “Kerjakan sekarang”, sedangkan siswa tamu bisa masuk lewat pintu tamu bila guru membuka `izinkan_tamu` untuk kuis itu. Murid yang belum masuk akan diantar ke halaman masuk **sambil membawa tujuan asalnya**, sehingga setelah masuk (dengan akun maupun sebagai tamu) ia langsung mendarat di kuis itu — bukan dilempar ke beranda. Tombol “Salin tautan” menyalinnya ke papan klip; kalau peramban menolak, tautannya tetap tampil di kotak untuk disalin manual.

### Manfaat untuk anak SD dan guru
Kepala sekolah/guru senior menyeragamkan hal penting sekali saja di lapis sekolah; guru kelas tetap punya keleluasaan untuk hal kecil pada ulangannya sendiri. Anak SD di semua kelas mendapat aturan yang konsisten. Guru juga tidak perlu membuka halaman Pengaturan untuk tahu “sebenarnya ulanganku diawasi apa saja?”, dan tidak perlu mengetik ulang alamat kuis saat membagikannya ke kelas.

### Saklar yang tidak lari dari jari (14 Oktober 2026)

Di layar sentuh, menyentuh saklar setelan dulu hanya membuat saklarnya **berpindah tempat**: teks keadaannya
("Aktif" → "Nonaktif") mengubah panjang label, blok saklarnya bergeser, dan barisnya ikut membungkus ulang —
jadi guru menyentuh satu hal dan mengenai hal lain. Sekarang lebarnya tetap dan keterangan "dikunci sekolah"
dipindah ke teks sumber di sebelah kiri, sehingga posisi saklar tidak berubah sama sekali saat disentuh
(diukur di 390 px: geser 0 px, tinggi baris tetap). Saklar itu juga punya `aria-label` yang menyebut nama
setelan dan keadaannya, jadi pembaca layar tidak bergantung pada teks label di sebelahnya.

Satu hal yang **tidak** dilakukan dengan sengaja: setelan ulangan tidak dipasang di layar pengerjaan murid.
Layar itu hanya berisi soal, navigator nomor, dan timer; saklar anti-kecurangan/percobaan ulang lengkapnya ada
di halaman kuis milik guru. Anak yang sedang ulangan tidak disuguhi saklar yang bukan miliknya — dan itu ikut
dijaga pemeriksaan peramban (bukan hanya diandaikan).

Status: **sudah bisa dipakai** (slice 02, diperluas di slice 07; ringkasan sesi + tautan siswa 12 Oktober 2026;
panelnya pindah ke halaman kuis 13 Oktober 2026; kerapian saklar di layar sentuh 14 Oktober 2026). Saklar
anti-cheat memakai mekanisme yang sama, termasuk preset ujian yang bisa dinyalakan sekali klik. Yang jujur
belum ada: lapis sekolah/kelas sekarang **hanya bisa dibaca** lewat panel itu (nilainya diatur dari API/seed
dan tetap mengunci), belum ada halaman admin khusus untuknya; kerapian saklar itu diukur di Chrome headless
pada lebar ponsel, bukan di perangkat sentuh sungguhan.

---

## 6. Materi berblok dengan kuis sisipan + layar guru di perangkat murid

### Apa ini
Materi pelajaran disusun seperti perjalanan: blok teks, blok gambar/video, dan blok kuis kecil di tengahnya. Ditambah fitur layar guru: tampilan yang guru buka bisa muncul di perangkat murid — yang disinkronkan **kontennya**, bukan layar penuh seperti aplikasi rapat.

### Cara kerjanya
Guru menyusun materi "Mengenal Pecahan" misalnya: penjelasan singkat → gambar pizza terbagi → kuis latihan 3 soal → video → kuis latihan lagi. Kuis sisipannya memakai soal dari bank soal yang sudah ada (tidak ada jenis soal baru) dan bertipe **latihan**: skornya masuk laporan tema, tidak masuk ranking, bukan nilai asli ulangan. Guru menandai blok wajib atau opsional; server yang memastikan urutannya ditempuh — murid tidak bisa melompat ke blok akhir.

Sejak 10 Oktober 2026 editor materi bergaya **video editor**: guru memilih rasio bingkai materi (16:9, 9:16, 1:1, atau 4:3), menempatkan tiap klip di track dan detik tertentu, dan mengatur tampilan tiap klip — media: **utuh** di dalam bingkai atau **penuhi bingkai** berikut titik fokus dan zoom; kuis: video **berhenti** sampai kuis dijawab atau tetap berjalan, dengan panel kuis **di bawah video** atau **di sampingnya** — selalu di luar gambar, tidak menutupi yang sedang diputar, dan tingginya tumbuh setinggi isinya (bukan jendela gulir sempit di atas video). Urutan bagian yang dilihat murid mengikuti **timeline** (detik mulai, lalu urutan simpan), bukan urutan klip dibuat. Kuis yang titik mulainya jatuh di dalam sebuah video kini muncul dari **pemutar video itu sendiri**, dan server menolak menutup video selama kuis wajib di dalamnya belum selesai — menarik slider ke ujung tidak mem-bypass urutan wajib. Layar guru (bagian 15) memakai jalur data ringan (SSE) yang sama, tetapi yang disinkronkan adalah **keadaan layar yang dipilih guru** (pengumuman, soal yang disorot, papan peringkat, instruksi setelah ulangan) — bukan perpindahan otomatis mengikuti blok materi yang sedang guru buka.

Sejak 11 Oktober 2026 (putaran A.38) guru juga bisa menulis **penjelasan setelah kuis**. Saat menyisipkan kuis ke timeline, guru memilih kuisnya lewat pemilih berisi pencarian + jumlah soal, mapel, kelas, dan status (kuis tanpa soal langsung ditandai), lalu boleh mengisi **penjelasan** — teks bebas, media dari pustaka materi, atau keduanya. Penjelasan itu tampil untuk **seluruh kelas** tepat setelah murid menyelesaikan kuis tersebut di dalam materi, sebelum videonya dilanjutkan; tidak masuk penilaian dan bukan kunci jawaban. Isinya opsional: kuis tanpa penjelasan berjalan seperti sebelumnya, dan media memakai mekanisme unggahan materi yang sama (berkas privat, tautan bertanda tangan).

Sejak 11 Oktober 2026 (putaran A.36) panjang tiap klip di timeline **tidak perlu diketik angka**: memilih satu klip memunculkan tanda `|` di kedua sisinya, seperti editor video pada umumnya. Menyeret tanda kanan menggeser akhir klip (durasi ikut berubah), sedangkan tanda kiri menggeser awalnya tanpa memindahkan ujung kanan. Tanda itu juga bisa dipangkas dari papan tombol (panah kiri/kanan, 0,1 detik sekali) dan kotak angka di inspector tetap ada sebagai jalur presisi. Berlaku untuk **semua** tipe klip — teks, media, maupun kuis sisipan. Sejak 12 Oktober 2026 (putaran A.47) tandanya digambar sebagai **satu** goresan `|` yang digeser sedikit ke dalam klip: dulu goresannya tinggal selebar 1px (cincin `border` + `box-sizing: border-box`) dan duduk menempel di tepi klip, sehingga pada klip yang diikuti klip lain ia berdempetan dengan garis tepi klip sebelahnya dan terbaca `||`. Selama klip terpilih garis tepinya seragam tipis — jenis klip (teks/media/kuis) tetap terbaca dari ikon + label di dalam klip dan dari inspector.

Sejak 10 Oktober 2026 (putaran A.34) tiap materi juga bisa dibuat **berjalan**: guru memilih **template tema**
— misalnya **"Mendaki Gunung"**, **"Harta Karun di Pulau"** (berlayar dari dermaga sampai goa harta karun),
atau **"Luar Angkasa"** (meluncur dari landasan sampai Bulan) — lalu tiap bagian materi menjadi satu **pos
perjalanan** (Basecamp → Jalur
Pinus → Sungai Deras → Lereng Berbatu → Kabut Puncak → Puncak). Guru boleh mengganti nama tema dan nama
tiap posnya, dan boleh menempelkan **video latar** untuk temanya. Di peta, tiap pos ditandai **kemah** (tenda
berwarna sesuai posnya, lengkap dengan pintu) dan **jalur antarpos berbelok-belok mendaki**: pos bergantian di
jalur kiri dan kanan yang makin menyempit ke atas, dan pos terakhir berdiri di **puncak**. Latar panggung peta
selalu **media sungguhan**: video guru bila ada, kalau tidak **berkas gambar tema** berlisensi bebas dari
`frontend/public/tema/` (lihat `LISENSI.md` di folder itu) dengan gerak zoom halus. Untuk tema bawaan
"Mendaki Gunung", berkas itu berupa **ilustrasi bergaya grafik** — gambar rata berlapis (langit cerah, **satu**
puncak bersalju yang tumpul dengan puncaknya masih di langit, bukit, pepohonan, batu, danau), bukan foto realis,
berpuncak membulat (bukan bersisi tegak yang terbaca seperti tebing), dan tanpa garis yang ujungnya menggantung. Bila tema tidak punya berkas gambar, panggung memakai latar gradien tenang; ada juga jalur ilustrasi
yang digambar sendiri untuk tema yang belum punya berkas, tetapi katalog tema saat ini tidak memakainya. Template tema bersifat **opsional**: guru boleh
memilih "Tanpa tema" agar materi berjalan sebagai daftar bagian biasa tanpa peta, pos, dan tingkat. Setiap kali murid menutup satu bagian — termasuk setelah
kuis sisipan di dalam video — ia **naik satu pos**, dan bila persentase langkah wajibnya melewati ambang
tertentu ia **naik tingkat** (Pendaki Pemula → Pendaki Terlatih → Penjelajah Lereng → Penakluk Puncak) dengan
pengumuman yang muncul hanya setelah server mengirim keadaan terbaru. Peta selalu disertai daftar pos dalam
teks, jadi pembaca layar dan layar sempit mendapat informasi yang sama persis.

### Mengapa aman
Urutan blok ditegakkan server, bukan dari perangkat murid. Materi disajikan lewat tautan bertanda tangan yang kedaluwarsa, bukan folder terbuka. Layar guru hanya mengirim instruksi konten — murid tidak bisa mengirim layar palsu ke guru. Tema dan pos hanyalah **tampilan**: boleh-tidaknya membuka langkah tetap diputus server, dan hanya langkah wajib yang menghitung kenaikan.

### Manfaat untuk anak SD dan guru
Materi jadi hidup: anak membaca sebentar, mencoba kuis kecil, lalu lanjut — cocok untuk rentang perhatian anak SD, dan anak yang salah di tengah materi langsung berlatih sebelum lanjut. Guru tidak perlu berteriak "lihat soal nomor 4": semua perangkat murid bisa diminta menampilkan hal yang sama sekaligus (bagian 15), hemat waktu kelas.

Status: **sudah bisa dipakai** (slice 08 + 10, editor video-editor 10 Oktober 2026; peta perjalanan bertema
10 Oktober 2026). Materi berblok dengan kuis sisipan latihan,
penerbitan materi, berkas aman (kategori ditentukan dari isi berkas, disajikan lewat tautan
bertanda tangan), laporan tema per murid, editor bergaya video editor (rasio bingkai, timeline,
tampilan per klip, kuis tersemat pada detik video, serta **gagang pangkas `|` di kedua sisi klip** untuk
mengatur durasi tanpa mengetik) beserta pemutar muridnya, **peta perjalanan bertema**
(template tema opsional, nama pos yang bisa diganti guru, latar video/foto tema, kenaikan pos & tingkat),
dan **layar guru ke perangkat murid (bagian 15)** sudah jalan serta diuji. Yang **belum** dikerjakan dan kami
sebutkan apa adanya: katalog tema berisi **empat** pilihan (Mendaki Gunung, Harta Karun di Pulau, Luar Angkasa,
dan "tanpa peta" — keempatnya karya sendiri, berlisensi CC0), dan belum setiap tema punya latar **video**
bawaan (video latar tetap diunggah guru sendiri). Yang juga belum: mengikuti halaman/blok materi yang sedang
dibuka guru secara otomatis — yang ada
adalah guru memilih apa yang tampil di perangkat murid, bukan aplikasi menebak posisi bacaan setiap anak.

---

## 7. Anti-kecurangan, presence, dan Monitor Ulangan

### Apa ini
Tiga hal sekaligus: penghalang sederhana saat ulangan (anti-paste, anti-pindah tab, dan lainnya), cara tahu murid mana yang perangkatnya hidup tapi diam saja, dan layar pemantauan guru secara langsung.

### Cara kerjanya
Semua penghalang **mati secara bawaan** dan guru yang menyalakan lewat pengaturan. Saat menyala: menempel jawaban dari luar diblok dan dicatat, pindah tab dicatat satu kali per kepergian, buka layar penuh yang keluar diberi peringatan. Semua kejadian hanya **catatan untuk guru** — bukan hukuman otomatis. Presence bekerja hemat data: klien tidak mengirim detak jantung terus-menerus; status dihitung dari aktivitas normal murid, jadi hemat kuota dan ramah sinyal lemah. Di server, kehadiran satu kelas disimpan sebagai satu hash Redis per kuis, sehingga setiap request murid hanya menulis satu medan miliknya sendiri — biayanya tidak tumbuh seiring jumlah anak di kelas, dan dua anak yang menyimpan jawaban bersamaan tidak saling menimpa. Monitor Ulangan (dulu bernama "Live Monitor") menampilkan siapa sedang mengerjakan apa, progres, dan catatan kejadian — mengalir tanpa muat ulang. Nama dan lencana jalur datanya diganti 12 Oktober 2026: layar guru tidak lagi memajang jargon teknis ("Langsung (SSE)" / "Polling 5 detik") karena yang penting bagi guru adalah papan pantauannya, bukan cara datanya datang; koneksi langsungnya tetap bekerja seperti semula.

### Mengapa aman
Kami jujur: **deteksi di browser bisa diakali**, dan aplikasi ini tidak pernah mengklaim "tahan 100%". Karena itu catatannya berfungsi sebagai bahan tinjauan guru (valid / tidak valid / menunggu), bukan vonis. Kalau perlindungannya error, ulangan **tetap jalan** (fail-open) — proteksi tidak boleh mengorbankan ujian.

### Manfaat untuk anak SD dan guru
Guru kelas 6 saat ulangan ulang semester tidak lagi berjalan bolak-balik: dari satu layar dia lihat siapa yang belum mulai, siapa diam lama, dan catatan kejadian yang perlu ditanya baik-baik ke murid. Anak SD tidak dituduh sembarangan — guru yang menilai konteksnya.

Sejak 12 Oktober 2026 (putaran A.53) ada satu pengaman lagi yang **sengaja tidak** ikut preset "ujian": **deteksi tamper halaman**. Kalau guru menyalakannya sendiri, aplikasi memeriksa empat hal — sumber yang dimuat dari skema extension peramban, fungsi proteksi yang diganti (dibandingkan dengan sidik jari yang diambil saat ulangan dimulai), overlay asing yang menutupi area ulangan, dan elemen penanda yang dihapus pihak lain. Overlay asing dirapikan (dihapus) dan layar dikaburkan sebentar, lalu semuanya dicatat (`dom_injection` / `extension_detected`). Kenapa tidak ikut preset: pemindai ini menyentuh DOM dan rawan salah tuduh, jadi guru harus menyalakannya dengan sadar.

Sejak putaran **A.54** sisi server ikut membuktikan sensornya **masih hidup**. Selama proteksi menyala, aplikasi di perangkat murid mengirim **denyut** kecil tiap 30 detik yang membawa **nonce** dari server; server merotasi nonce itu setiap kali. Kalau denyutnya berhenti lebih dari ~100 detik padahal ulangannya masih berjalan, server mencatat `tamper_suspected` (skor risiko 9) — muncul di Monitor Ulangan guru sebagai bahan tinjauan. Nonce membuat liveness tidak bisa dipalsukan dengan memutar ulang kiriman lama.

Status: **sudah bisa dipakai** (slice 07 + deteksi tamper 2B–2C di A.53 + sisi server 2D di A.54). Semua pengaman mati secara bawaan dan baru bekerja bila guru menyalakannya. Guru bisa meninjau tiap catatan (valid / tidak valid) langsung dari Monitor Ulangan. Yang belum ada dan kami sebutkan apa adanya: **ambang denyut masih nilai tetap** (30 detik / ~100 detik, belum bisa diatur guru — jeda jaringan yang panjang bisa membuat murid jujur tercatat, karena itu catatannya tetap bahan tinjauan, bukan vonis), deteksi keluar layar penuh, dan pemanggilan Zoom/Meet untuk verifikasi — ketiganya ditunda, bukan disembunyikan.

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
(murid tetap boleh mengunggah gambar baru). Halaman foto profil **guru** juga tidak lagi menampilkan galat: guru melihat keadaan kosong yang rapi, sedangkan unggah/ganti dan hapus tetap khusus murid.

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

Status: **sudah bisa dipakai** (slice 09-C), bawaan **mati** dan baru berlaku kalau guru menyalakan kunci
`mode_tim` untuk kuis itu. Nilai tim ikut terunduh di **Ekspor nilai** (bagian 12): setiap anggota dapat satu
baris dengan skor tim yang sama. Yang belum ada dan kami sebutkan apa adanya: penilaian AI belum membaca
lampiran tim.

---

## 12. Ekspor nilai untuk buku nilai guru

### Apa ini
Guru mengunduh nilai satu kuis sebagai berkas yang bisa dibuka di Excel atau Google Sheets — satu baris per
murid, lengkap dengan nilai tiap soal.

### Cara kerjanya
Berkasnya dihasilkan **mengalir (streaming)** dari basis data, jadi kuis dengan banyak murid tidak perlu
menahan seluruh isi di memori. Isinya hanya skor **asli** (percobaan pertama), sama seperti peringkat, supaya
nilai ulangan ulang tidak menyamarkan hasil. Pada kuis mode tim, semua anggota mendapat baris dengan skor tim
yang sama. Sel yang mirip rumus spreadsheet (`=`, `+`, `-`, `@`) diberi pengaman lebih dulu supaya berkasnya
tidak berbahaya saat dibuka.

### Mengapa aman
Hanya guru pemilik kuis yang boleh mengunduh, dan tautannya memakai sesi cookie — tidak ada token rahasia di
URL yang bisa diteruskan ke orang lain.

### Manfaat untuk anak SD dan guru
Guru tidak perlu menyalin angka satu per satu ke buku nilai. Format CSV juga bisa dibuka oleh aplikasi apa pun
yang biasa dipakai sekolah.

Status: **sudah bisa dipakai** (slice 10). Bentuknya **CSV, bukan xlsx**: chunk slice-10 mengizinkan CSV, dan
proyek ini sudah memakai `league/csv` untuk impor/ekspor murid, jadi tidak perlu menambah satu dependensi
penulis berkas biner. Yang belum ada: kolom per soal belum diberi label tag/tema, dan belum ada ekspor
nilai satu kelas lintas kuis.

---

## 13. Mode gelap

### Apa ini
Tombol terang/gelap untuk kenyamanan mata, terutama saat belajar malam atau ruang kelas bercahaya rendah.

Dulu (putaran A.49, 12 Oktober 2026) di sebelah tombol tema ada juga tombol **ukuran tulisan: Normal/Besar**
yang membesarkan seluruh tulisan ±12%. **Tombol itu dibuang pada 12 Oktober 2026 (A.58)** atas permintaan
pemilik produk: bilah atas jadi lebih ringkas, dan ukuran tulisan kembali seragam untuk semua orang. Sisa
mesin ukurannya — atribut `data-ukuran`, penyimpanan `ukuran-ulangan`, ikon huruf, dan skala kedua — ikut
dibuang supaya tidak ada kode mati; yang tinggal hanya satu variabel `--s` bernilai 1 di `theme.css` sebagai
tempat tunggal bila suatu saat skala lain dibutuhkan lagi. Kalau di perangkat guru/murid masih tersimpan
pilihan lama, tidak ada efeknya — hanya kunci localStorage yang tidak lagi dibaca.

### Cara kerjanya
Pilihan disimpan di perangkat murid/guru dan diterapkan **sebelum** halaman tampil, sehingga tidak ada
kedipan putih saat dibuka. Warnanya mengikuti satu palet variabel CSS, jadi seluruh halaman ikut berubah
sekaligus.

### Manfaat untuk anak SD dan guru
Anak yang mengerjakan ulangan di malam hari tidak silau. Yang penting bagi kami: penanda status (benar,
salah, peringatan) tetap punya ikon dan kontras yang cukup di kedua mode.

Status: **sudah bisa dipakai** (dibuat bersama tema sejak slice awal, dipakai di seluruh halaman). Pilihan
mengikuti pengaturan perangkat bila belum pernah diubah di aplikasi. Sejak 13 Oktober 2026 pilihannya juga
ada di halaman **Akun** (bagian 21) supaya tidak perlu mencari tombol di bilah atas bila guru sedang mengatur
akunnya.

---

## 14. Cache berlapis saat ulangan serempak

### Apa ini
Ketika satu sekolah membuka ulangan pada jam yang sama, ratusan permintaan membaca data yang sama
(pengaturan kuis, mis. apakah anti-cheat dinyalakan). Fitur ini menyimpan salinan sementara agar
permintaan itu tidak membebani basis data.

### Cara kerjanya
Ada tiga lapis: salinan sementara di memori (berkas SQLite di tmpfs, hilang saat server di-restart), lalu
penyimpanan cepat bersama (Redis), baru basis data sebagai sumber kebenaran. Salinan di memori **hanya
menyala saat lalu lintas benar-benar ramai** (lebih dari 10 pembacaan per detik) dan otomatis dibuang lagi
setelah reda (di bawah 2 per detik) — supaya RAM tidak dipakai untuk data yang tidak sedang dibutuhkan.
Setiap salinan membawa penanda versi: begitu guru mengubah pengaturan, versi naik dan semua salinan lama
ditolak, jadi tidak mungkin ada kelas yang memakai aturan basi.

### Mengapa aman
Salinan memori tidak pernah menjadi sumber kebenaran: guru menulis ke basis data lebih dulu, baru Redis dan
salinan memori dibuang, dan proses lain diberi tahu lewat pesan singkat (pub/sub). Kalau berkas salinannya
rusak atau tidak bisa dibuka, sistem jalan terus tanpa lapisan itu.

### Manfaat untuk anak SD dan guru
Ulangan tidak tersendat saat semua anak menekan "Mulai" di menit yang sama, dan guru tidak perlu mengatur
apa pun — bawaannya mati dan menyala sendiri hanya bila memang ramai.

Status: **kode dan pengujian selesai** (slice 10), bawaannya **mati** (`CACHE_L1_AKTIF`). Yang jujur belum:
pengukuran beban nyata dengan alat uji beban di VPS (angka 10/2 req/s masih nilai bawaan yang wajar, bukan
hasil kalibrasi lapangan), dan pemberitahuan pub/sub belum disambungkan ke service realtime (SSE).

---

## 15. Layar guru yang benar-benar sampai ke perangkat murid

### Apa ini
Guru memegang satu tombol di kelas: apa pun yang ia pilih muncul di perangkat murid kelas itu dalam
hitungan detik. Bukan berbagi layar (bukan salinan penuh layar guru) — yang dikirim adalah **keadaan
konten**: pengumuman singkat, satu soal yang sedang dibahas, papan peringkat, atau instruksi setelah
ulangan selesai.

### Cara kerjanya
Layar kelas punya lima keadaan: **kosong** (perangkat murid kembali ke tampilan ulangan biasa),
**pengumuman** (mis. "sisa waktu 10 menit"), **sorot satu soal** (soal itu tampil utuh di perangkat
murid), **papan peringkat** (14 Oktober 2026), dan **instruksi setelah ulangan**. Guru memilih keadaan
lewat halaman `Layar kelas` di detail kuis, dan setiap perubahan disiarkan lewat kanal kuis yang sama
dengan Monitor Ulangan (Nginx/Redis/pub-sub
→ service Node → SSE ke browser). Perangkat murid menyambung dengan **tiket sekali pakai** yang hanya
berlaku untuk kuis kelasnya; kalau sambungan langsung gagal (service realtime mati, kantor/sekolah
memblokir), perangkat murid **tetap** menyusul lewat pembaruan berkala 5 detik. Setiap perubahan menaikkan
`versi`, jadi perangkat tahu salinan yang dipegangnya sudah basi.

**Papan peringkat lewat layar kelas (14 Oktober 2026).** Mode ini menjawab permintaan guru: "papan di
proyektor tidak terbaca dari HP anak". Yang sampai ke HP murid adalah papan yang **sama persis** dengan
papan di halaman peringkatnya sendiri — komponen yang menyusunnya satu (`PapanPeringkat.jsx`), dan
datanya diambil perangkat murid dari endpoint peringkat dengan sesinya sendiri. Karena itu batas yang
sudah berlaku ikut utuh: **nomor peringkat hanya untuk N% teratas**, murid di bawahnya membaca skornya
sendiri, dan **jejak bonus penyemangat tidak ikut** (kolom "Catatan guru" dan kata "dibantu" hanya ada
di layar kerja guru). Payload layar kelas untuk mode ini **tidak memuat isi papan** — hanya penanda mode —
jadi tidak ada jalur pintas yang bisa membuka apa yang sengaja ditutup dari murid. Kalau ranking sedang
dimatikan guru, murid membaca keterangan itu apa adanya, bukan papan kosong; papan juga menyegarkan
dirinya sendiri selama tampil (30 detik) dan setiap kali guru menyiarkan ulang.

### Mengapa aman
Dua hal dijaga di server, bukan di tampilan: (1) **kunci jawaban tidak pernah ikut** — payload soal
ditulis kolom per kolom (id, nomor, tipe, konten, skor) tanpa `kunci`/`pembahasan`, sehingga menyorot soal
tidak pernah membocorkan jawaban ke perangkat mana pun; (2) **murid kelas lain tidak bisa menyambung** —
izin membaca layar sama persis dengan izin membaca kuisnya (harus terbit dan kelasnya cocok), dan jalur
tiket murid dipisah dari jalur guru. Layar juga bukan modal yang mengunci pekerjaan anak: pengumuman
bersifat informasi, jadi ulangan tetap berjalan walau guru sedang berbicara.

### Manfaat untuk anak SD dan guru
Inilah pengganti "semua lihat soal nomor 4" yang paling sering memakan waktu di kelas: guru menekan satu
tombol, dan seluruh perangkat menampilkan soal yang sama tanpa murid perlu scroll atau bertanya. Anak yang
sedang fokus di perangkatnya tidak kehilangan jawaban yang sudah ditulis — jawaban tetap tersimpan di
server.

Status: **kode, test, dan pengujian API selesai** (slice 10; mode papan peringkat 14 Oktober 2026).
Bawaannya **menyala** (`layar_guru`), dan bisa
dimatikan per sekolah/kelas/kuis lewat pengaturan tiga lapis; begitu dimatikan, perubahan ditolak server dan
murid tidak menerima apa pun. Yang jujur **belum**: menyorot satu soal **di dalam halaman materi** (layar
kelas bekerja di layar pengerjaan ulangan, bukan di dalam materi berblok), pembahasan langkah-demi-langkah
real-time, papan gambar/whiteboard, dan **papan peringkat hanya sampai ke murid yang masih berada di layar
pengerjaan** — anak yang sudah mengumpulkan dan berpindah ke halaman hasil belum menerimanya (panel layar
kelas memang belum dipasang di halaman hasil).

---

## 16. Pendaftaran mandiri dan pemulihan kata sandi yang rapi

### Apa ini
Dua jalur yang paling sering ditempuh murid tanpa menunggu guru: mendaftar sendiri, dan meminta tautan
pemulihan kata sandi lewat email.

### Cara kerjanya
Begitu murid mendaftar sendiri, server **langsung membuatkan profil murid dan kelas penampung** bernama
"Tanpa Kelas"; guru tinggal memindahkannya ke kelas yang sebenarnya. Dengan begitu lencana, progres tema,
dan foto profil anak langsung berfungsi sejak hari pertama, tidak lagi menampilkan galat di layar.
Semua murid baru dari satu sekolah masuk ke kelas penampung yang **sama**, jadi guru tidak dibuatkan
satu kelas kosong per murid.

Tautan pemulihan kata sandi berlaku **sekali pakai**. Bila tautan yang sama dibuka lagi (atau tautan lama
dari kotak masuk dibuka ulang), halaman tidak menyodorkan formulir yang pasti gagal, melainkan penjelasan
jelas bahwa tautan itu **sudah pernah dipakai** — beserta tombol Masuk dan Minta tautan baru.

### Mengapa aman
Token pemulihan hanya disimpan dalam bentuk hash dan ditandai terpakai begitu berhasil dipakai, sehingga
tautan yang bocor atau terbuka di perangkat lain tidak bisa dipakai dua kali. Kelas penampung dibuat
sekali dan ditulis dalam satu transaksi bersama profil murid, jadi tidak ada murid yang setengah jadi;
guru tetap satu-satunya yang menempatkan murid ke kelas asli.

### Manfaat untuk anak SD dan guru
Anak yang mendaftar sendiri di rumah tidak lagi "setengah jalan" — begitu masuk, semua halaman murid
(ganti foto profil, lencana, progres tema) langsung jalan, walau gurunya belum sempat membuat kelas.
Guru pun melihat antreannya rapi di satu kelas penampung, bukan belasan pekerjaan rumah tangga digital.

Akun murid yang sudah ada lebih dulu (dibuat sebelum kelas penampung diperkenalkan) juga **tidak lagi
menemui galat**: begitu ia membuka lencana, progres tema, atau halaman foto profil, profilnya dibuatkan
otomatis di kelas penampung yang sama. Jadi tidak ada murid yang "terjebak 403" hanya karena akunnya lebih
tua dari fiturnya.

Status: **perbaikan 8 Oktober 2026** — bawaannya menyala, tanpa pengaturan tambahan.

---

## 17. Mode luring: ulangan tetap jalan saat internet putus

### Apa ini
Internet di sekolah bisa putus di tengah ulangan — wifi masih menyala tetapi gerbangnya mati, atau
kabel lab tercabut. Mode luring membuat murid **tidak kehilangan pekerjaan**: jawaban tetap ditulis ke
perangkat, murid bisa melihat sendiri bukti penyimpanannya, dan semuanya dikirim ke server begitu koneksi
kembali.

### Cara kerjanya
Empat hal bekerja bersama:

1. **Deteksi jujur, bukan hanya `navigator.onLine`.** Status luring dihitung dari dua sumber: kabar
   peramban (event online/offline) dan kegagalan pengiriman terakhir. Selama 10 detik setelah satu kiriman
gagal, layar dianggap luring — jadi wifi yang "tersambung tapi tidak sampai ke server" tetap terbaca.
2. **Simpan dulu, kirim kemudian.** Setiap ketikan divalidasi (bentuknya harus bisa dibaca kembali dari
   penyimpanan dan tidak melebihi kuota), lalu ditulis ke cadangan jawaban di perangkat dan ke riwayat
   jawaban lokal. Saat luring, pengiriman **ditahan** — bukan ditembakkan berulang tiap 800 ms ke server
   yang tidak ada. Begitu koneksi kembali (event online), antrean diborong sekaligus.
3. **Riwayat jawaban yang bisa dibaca murid.** Panel "Riwayat jawaban" di layar pengerjaan mencantumkan
   soal nomor berapa, isinya secara ringkas, jam penyimpanan menurut jam server, dan statusnya
   ("di perangkat ini" atau "tersimpan di server") plus penanda "n menunggu terkirim". Saklar
   "Simpan riwayat jawaban di perangkat ini" ada di panel yang sama dan menyala secara bawaan.
4. **Waktu dijaga jam monotonik, bukan jam dinding.** Saat luring server tidak bisa ditanyai lagi, jadi
   sisa waktu dihitung dari jam monotonik (yang hanya bisa maju) sejak respons server terakhir. Murid yang
   memundurkan jam Windows untuk menambah waktu akan melihat penanda "Jam perangkat berubah", dan sisa
   waktunya tidak bertambah. Soal pun masih bisa dibuka dari salinan attempt di perangkat, dengan
   `server_now` yang digeser sesuai umur salinan supaya hitung mundur tidak membeku.

### Mengapa aman
Yang disimpan di perangkat hanya **jawaban yang diketik murid, ringkasannya, dan soal yang memang sudah
tampil di layarnya** — tanpa kunci jawaban, tanpa token, tanpa data sesi. Riwayat dan salinan soal dihapus
begitu jawaban dikumpulkan, dan ikut terhapus saat murid keluar atau sesinya berakhir (komputer lab dipakai
bergantian). Server tetap penentu akhir: ulangan yang sudah ditutup, batas percobaan yang habis, atau
submission lewat deadline tetap ditolak server — salinan di perangkat tidak bisa "menambal" penolakan itu,
dan kumpulkan tetap idempoten.

### Manfaat untuk anak SD dan guru
Anak tidak perlu panik saat internet sekolah tersendat: layar tidak hanya bilang "aman", tetapi menunjukkan
jawaban mana yang sudah tersimpan dan mana yang masih menunggu. Guru menerima jawaban yang sama seperti
biasa — pekerjaan luring masuk sendiri tanpa perintah tambahan.

Status: **kode dan pengujian selesai** (10 Oktober 2026). Batasan yang jujur: belum ada *service worker*,
jadi mode luring bekerja selama aplikasi masih terbuka (tab jangan ditutup); memuat ulang halaman saat
internet mati tetap butuh koneksi ke server. Pembahasan lengkap ada di `laporan-pengujian.md` A.33.

---


## 18. Siswa tamu: ikut ulangan tanpa akun, cukup nama

### Apa ini

Guru bisa membuka kuis untuk **siswa tamu** — anak yang belum punya akun sekolah — lewat pengaturan
*"Izinkan siswa tamu ikut kuis ini tanpa akun (cukup nama)"*. Di halaman masuk, tamu memilih **Masuk sebagai
tamu** dan hanya menuliskan namanya, tanpa email dan tanpa kata sandi. Saklarnya ada di sistem pengaturan
tiga lapis, jadi guru membukanya **per kuis** (kuis lain di sekolah yang sama tetap tertutup), sementara
admin bisa membukanya untuk seluruh sekolah atau satu kelas. Bawaannya **mati**: instalasi baru tidak pernah
diam-diam membuka ulangannya untuk orang tanpa akun.

### Cara kerjanya

1. Guru menyalakan saklar **Siswa tamu** pada panel *Setelan ulangan* di halaman kuis miliknya.
2. Halaman masuk menanyakan `GET /v1/tamu`; bila server menjawab boleh, muncul formulir tamu.
3. Tamu menulis nama → `POST /v1/auth/tamu` membuat (atau memakai kembali) akun tamu, lalu langsung
   membuka sesinya. Nama itu yang tertulis di daftar nilai; **identitas akunnya adalah kode perangkat**
   yang dibuat dan disimpan peramban sekali per perangkat (`sections/auth/perangkat.js`), dikirim bersama
   nama setiap kali masuk.
4. Halaman **Ulangan Tamu** hanya memuat kuis terbit yang benar-benar dibuka untuk tamu; mengerjakan,
autosave, dan mengumpulkan memakai jalur murid yang sama (waktu, pengacakan, dan nilai semuanya dari server).
5. Guru melihat hasil tamu di halaman laporan kuis, bagian **Siswa tamu** (nama, skor, benar, percobaan,
waktu mengumpulkan) beserta penanda apakah pintu tamunya masih terbuka.

### Mengapa aman

- **Tanpa izin guru, tidak ada pintu sama sekali**: sampai saklarnya dinyalakan, permintaan masuk tamu
ditolak dan tidak ada akun yang dibuat.
- **Izin dibaca per kuis** dan dicek di server pada tiga titik (baca kuis, daftar kuis, mulai attempt);
murid berkelas lain tetap ditolak walau izin tamu menyala, dan kuis draf tidak pernah terlihat tamu.
- **Tamu tidak mendapat hak apa pun yang lain**: akunnya berperan `murid` seperti biasa, jalur guru (bank
soal, pengaturan, laporan, koreksi) tetap 403, ia **tidak boleh membuka peringkat kelas**, dan namanya tidak
masuk peringkat kelas.
- **Satu perangkat = satu identitas**: masuk lagi dari perangkat yang sama melanjutkan akun dan percobaan
yang sama, jadi batas percobaan dan retry tetap berlaku (tidak bisa diakali dengan keluar-masuk).
- **Nama tidak bisa diambil alih**: dua anak yang menulis nama sama tetap dua akun berbeda, dan nama yang
tidak bisa dibuat slug (emoji, aksara non-Latin) tetap punya akunnya sendiri. Akun tamu bertaut pada kode
perangkat yang di-hash di kolom email, jadi tidak ada nama yang "sudah dipakai" dan tidak ada nama yang
membuka pekerjaan anak lain tanpa kata sandi.
- **Nama dirapikan server**: spasi berlebih, tab, dan karakter kendali dibuang/dirapatkan, dan panjangnya
2–60 karakter.
- **Pintu tamu tidak dikunci alamat sekolah**: pembatas lajunya berkunci kode perangkat (5 permintaan per
menit per anak) dengan batas per alamat IP yang longgar sebagai pagar penyalahgunaan, sehingga satu kelas
yang berbagi satu jaringan sekolah bisa masuk serentak.

### Manfaat untuk anak SD dan guru

- Anak yang lupa kata sandi, lupa email, atau memakai perangkat baru tetap bisa ikut latihan gurunya.
- Guru bisa memakai satu kuis sebagai **latihan terbuka** (mis. saat pameran sekolah atau jam pengganti) tanpa
membuat puluhan akun, lalu tetap melihat nilai siapa pun yang mengerjakannya.
- Karena mode ini hanya membuka kuis **yang dipilih guru**, kelas sungguhan tidak ikut terbuka.

---

## 19. Data induk yang bisa dicari: kelas, mapel, dan murid

### Apa ini
Halaman guru untuk mengurus data dasar sekolah: kelas, mata pelajaran, dan murid — termasuk impor/ekspor
murid lewat berkas CSV. Sejak 12 Oktober 2026 (putaran A.51) daftar murid punya kotak **Cari murid**: satu
kotak untuk nama, NIS, NISN, atau email sekaligus.

### Cara kerjanya
Pencariannya dikerjakan **server**, bukan menyaring baris yang kebetulan tampil. Ini bukan detail teknis yang
bisa diabaikan: daftar murid dikirim **berhalaman** (50 baris sekali kirim), jadi kotak cari yang menyaring
di perangkat hanya akan menemukan murid yang halamannya sedang dibuka — anak ke-51 tetap terbaca "tidak ada"
padahal ada, dan guru menyimpulkan datanya hilang. Karena itu tiap ketikan dikirim ke server sebagai
`filter[cari]`, dengan tiga kerapian: dikirim setelah guru berhenti mengetik **300 ms** (satu ketikan cepat =
satu permintaan, bukan satu per huruf), daftar kembali ke **halaman 1** tiap kata kunci berubah (kata kunci
baru tidak mendarat di halaman 3), dan kata kunci boleh digabung dengan saringan kelas. Bila tidak ada yang
cocok, tabel diganti keadaan kosong yang **menyebut kata kuncinya** dan menawarkan tombol *Bersihkan
pencarian*. Bagian yang cocok juga **disorot** di nama, NIS, dan email hasil pencarian (putaran A.53),
supaya guru langsung tahu kenapa sebuah baris ikut tampil — bukan hanya bahwa barisnya tampil.

### Mengapa aman
Pencarian tetap dibatasi **satu sekolah**, dan hak aksesnya sama seperti daftar murid itu sendiri (guru dan
admin boleh mengelola, murid hanya membaca). Karakter `%` dan `_` yang diketik guru di-escape di server,
jadi kata kunci tidak diam-diam berubah jadi "tampilkan semua murid". Kata kunci kosong atau hanya spasi
berarti daftar biasa.

### Manfaat untuk anak SD dan guru
Guru tidak lagi menelusuri halaman demi halaman untuk mencari satu anak — misalnya saat orang tua bertanya
tentang nilai, atau saat ada murid pindahan yang harus ditambahkan. Ini juga melengkapi impor CSV: setelah
data masuk, mencari siapa yang datanya salah jadi pekerjaan hitungan detik.

### Menambah murid tanpa pindah halaman (14 Oktober 2026)

Kelas dan murid adalah satu pekerjaan yang sama bagi guru: begitu kelasnya jadi, hal berikutnya hampir selalu
menambah muridnya. Sejak 14 Oktober 2026 tiap baris di halaman **Kelas** punya tombol **+** yang membuka panel
murid baru dengan **kelas itu sudah terpilih** — guru tidak perlu pindah ke halaman Murid lalu memilih lagi
kelas yang barusan ia lihat. Panelnya memuat nama, email, dan NIS/NISN (opsional) yang sama seperti halaman
Murid, termasuk sebab per kolom bila server menolak (mis. email sudah dipakai). Kode kelas yang dikirim ke
server ditentukan barisnya, bukan dipilih ulang, jadi murid tidak bisa mendarat di kelas yang salah.

Di halaman **Murid** sendiri, alamat email murid kini benar-benar bisa **diperbaiki** (14 Oktober 2026): dulu
kolom itu lolos validasi tetapi tidak pernah disimpan, sehingga panelnya menjawab "Murid diperbarui."
sementara alamatnya tetap yang lama — dan itu baru ketahuan saat murid gagal masuk dengan alamat barunya.
Verifikasi emailnya sengaja **tidak** dikosongkan: alamat ini ditetapkan sekolah (bukan pendaftaran sendiri),
dan murid tidak bisa membuka tautan verifikasi ke alamat yang baru saja diganti guru.

Status: **sudah bisa dipakai** (putaran A.51 + A.53 + A.83, diuji 18/18 → **23/23** di Chrome sungguhan,
termasuk membuktikan murid bisa masuk dengan alamat email hasil ganti). Batasan yang jujur:
pola pencariannya masih `LIKE %kata%` sehingga belum memanfaatkan indeks — sejak A.53 ada tes regresi pada
**1.200 murid** yang membuktikan pencariannya benar dan tetap berhalaman pada skala itu, tetapi itu bukan
uji beban waktu tanggap. Sejak 13 Oktober 2026 kotak cari juga ada di halaman **Bank Soal** (dan di panel
pilih-soal saat menyusun kuis) — keduanya menyaring di server dan memuat hasilnya bertahap; halaman Kelas
dan Mapel belum punya kotak cari.

---

## 20. Bank soal yang tidak dimuat sekaligus

### Apa ini
Daftar soal di halaman **Bank Soal** — dan daftar pilih-soal saat guru menyusun kuis — dimuat **20 baris sekali
kirim**, dengan tombol *Muat 20 soal berikutnya* di bawah daftar dan kotak **Cari soal** di atasnya.

### Cara kerjanya
Sekolah dengan ratusan soal tidak lagi mengirim seluruh bank dalam satu respons hanya untuk menampilkan dua
puluh baris pertama: tiap permintaan membawa `per_page=20` dan halaman yang diminta, lalu baris berikutnya
**ditambahkan** ke bawah daftar (bukan menggantikan). Kotak cari mengirim kata kunci ke server sebagai `q`
setelah guru berhenti mengetik 300 ms — jadi mencari soal lama tidak berarti membuka halaman satu per satu,
dan pencariannya berlaku ke **seluruh** bank soal, bukan hanya baris yang kebetulan tampil. Keadaan kosongnya
menyebut kata kuncinya dan menawarkan *Bersihkan pencarian*.

Satu hal yang ikut dijaga: skor dan status aktif soal yang **sudah dipilih** diingat di sisi klien. Tanpa itu,
soal pilihan yang tidak ada di halaman yang sedang tampil akan terhitung **0 poin** dan lolos dari pemeriksaan
"semua soal yang dipilih aktif" — ringkasan langkah terakhir lalu berkata tidak benar.

### Manfaat untuk anak SD dan guru
Waktu buka halaman Bank Soal dan langkah “Susun soal” tidak lagi tumbuh mengikuti jumlah soal sekolah, dan
guru tetap bisa menemukan soal semester lalu tanpa menelusuri halaman.

### Menulis rangkaian soal tanpa keluar-masuk editor (14 Oktober 2026)

Menyusun satu bab ulangan berarti menulis belasan soal yang **jenis dan mapelnya sama**. Dua jalan pintas
menutup pekerjaan berulang itu:

1. **Mapel baru dibuat di dalam editor soal.** Mapel wajib saat menyimpan, jadi sekolah yang belum punya
   mapel dulu terkunci dari bank soal: satu-satunya jalan membuatnya ada di halaman Mapel, artinya guru harus
   keluar dari soal yang sedang ditulis. Sekarang tombol *Mapel baru* di sebelah pemilih mapel membuka isian
   nama (+ kode opsional), dan mapel yang tersimpan **langsung dipakai soal itu** — daftar pemilihnya ikut
   disegarkan, bukan menunggu muat ulang halaman. Bila sekolah belum punya satu mapel pun, isiannya sudah
   terbuka sendiri disertai keterangan sebabnya.
2. **"Simpan & lanjut".** Satu centang membuat tombol simpan menjadi *Simpan & lanjut*: soalnya tersimpan,
   lalu editor tetap terbuka untuk soal **berikutnya** dengan jenis, mapel, dan tag yang sama. Yang diwarisi
   hanya pilihan yang berulang itu — teks soal, pilihan jawaban, dan kuncinya tetap kosong, karena justru itu
   yang berubah tiap nomor.

Status: **sudah bisa dipakai** (13 Oktober 2026; dua jalan pintas di atas 14 Oktober 2026). Jenis soal di bank
soal tetap boleh diperbaiki saat ulangannya berjalan; batas 20 barisnya diatur klien (`PER_HALAMAN`),
sedangkan server tetap membatasinya di 100 baris per permintaan. Batasan yang jujur: nama mapel yang sudah
dipakai tetap ditolak **server** dan pesannya tampil di panelnya (tidak ada pemeriksaan duplikat di perangkat,
karena daftarnya bisa berubah sementara guru mengetik).

---

## 21. Akun sendiri: nama, kata sandi, dan tampilan

### Apa ini
Halaman **/pengaturan** sekarang berisi setelan **akun sendiri**: nama tampilan, kata sandi, tema terang/gelap,
dan pintasan ke avatar (khusus murid). Halaman ini milik **semua** pengguna — murid, guru, maupun admin — bukan
hanya guru.

### Cara kerjanya
- **Nama**: diganti lewat `PUT /v1/akun` dan langsung tampil di kepala aplikasi, laporan, serta daftar nilai.
- **Email** hanya ditampilkan (tidak bisa diubah): ia alamat verifikasi dan pemulihan akun, jadi perubahannya
  butuh alur verifikasi tersendiri yang belum ada — server memang menolaknya, bukan sekadar tombolnya dimatikan.
- **Kata sandi**: wajib menyertakan sandi lama, minimal 10 karakter. Sekali berhasil, `remember_token`
  diacak ulang dan **sesi di perangkat lain diakhiri** — sedangkan perangkat yang sedang dipakai tetap masuk
  (kalau ikut dihapus, murid yang baru mengganti sandinya justru terlempar keluar). Jalur ini dibatasi 6
  percobaan per menit per akun, supaya sesi yang tertinggal di komputer lab tidak bisa dipakai menebak sandi.
- **Akun siswa tamu** tidak punya sandi (masuknya lewat kode perangkat), jadi halaman ini memberi tahu apa
  adanya dan menawarkan daftar sebagai murid — bukan menampilkan formulir yang pasti ditolak.

### Manfaat untuk anak SD dan guru
Guru dan murid sama-sama bisa memperbaiki namanya sendiri (salah ketik saat didaftarkan, atau nama panggilan)
tanpa menunggu admin, dan siapa pun yang merasa sandinya diketahui orang lain bisa menggantinya dari komputer
sekolah tanpa perlu akses email.

Status: **sudah bisa dipakai** (13 Oktober 2026). Setelan ulangan (proteksi, percobaan ulang, peringkat)
tidak ada di halaman ini lagi — ia menyatu dengan tiap kuis (bagian 5). Yang belum ada: halaman ini belum
menampilkan daftar perangkat/sesi yang sedang masuk.

---

## 22. Bundel yang dipotong per halaman

### Apa ini
Kode aplikasi tidak lagi dikirim sebagai satu berkas JavaScript raksasa. Setiap halaman jadi **potongannya
sendiri** yang baru diunduh saat halamannya dibuka (`React.lazy` + `Suspense`); yang ikut terkirim sejak awal
hanya kerangka aplikasi, **Beranda**, **halaman masuk**, dan **halaman 404**.

### Cara kerjanya
Daftar pemuat halaman ada di satu berkas, `frontend/src/halaman.js`. Di sana tiap halaman dibungkus
`React.lazy`, dan peta `pramuat` menghubungkan jalur menu (`/kelas`, `/bank-soal`, `/kuis`, …) dengan modulnya.
Tautan menu di panel samping **mulai mengunduh modul halamannya begitu disorot atau difokus**
(`onMouseEnter`/`onFocus`) — jadi bundel awalnya kecil, tetapi perpindahan menu tetap terasa seketika,
terutama di ponsel yang menyentuh dulu sebelum menekan.

Yang menunggu ditangani `Suspense` yang dipasang **di dalam** kerangka (di area konten), bukan membungkus
seluruh aplikasi. Akibatnya menu, bilah atas, dan kaki halaman tetap tampil selama modul diunduh — tidak pernah
ada layar kosong. Penandanya (`MemuatHalaman`) muncul dengan **jeda 150 ms** lalu memudar masuk lewat CSS:
pada modul yang sudah tersimpan di cache peramban (kasus paling umum saat berpindah halaman) penandanya sama
sekali tidak terlihat, jadi tidak ada kedipan. Tingginya juga diisi supaya kaki halaman tidak melompat naik-turun.

Angka hasil `npm run build` di mesin pengembangan:

| | Sebelum | Sesudah |
| --- | --- | --- |
| JavaScript yang diunduh sebelum halaman tampil | **923,63 kB** (262,06 kB gzip), satu berkas | **555,26 kB** (176,35 kB gzip) — berkas utama + 5 berkas yang di-`modulepreload` `index.html` |
| Jumlah berkas JS | 1 | 54 (halaman lain menyusul saat dibuka) |

Contoh yang tidak lagi ikut ke setiap pengguna: layar pengerjaan ulangan **41,57 kB** (14,27 kB gzip),
editor soal **46,52 kB**, editor materi **30,84 kB**, dan renderer soal **31,94 kB**. Murid yang mengerjakan
ulangan di ponsel kelas tidak lagi mengunduh alat guru, dan guru tidak mengunduh layar ulangan anak.

Angka itu juga diperiksa **di peramban sungguhan** (bangun produksi, `docs/ukur-bundel-peramban.mjs`):
membuka aplikasi hanya meminta **6 berkas JS (555,30 kB)** — sama persis dengan keenam berkas di `index.html` —
sedangkan menekan tautan “Daftar” hanya menambah **2 berkas kecil (3,5 kB)** tanpa memuat ulang halaman.

### Manfaat untuk anak SD dan guru
Halaman pertama muncul lebih cepat di jaringan sekolah yang lambat — sekitar **sepertiga** lebih sedikit data
yang harus lewat sebelum apa pun terlihat (`262 kB` → `176 kB` gzip). Ini juga menghemat kuota ponsel murid.

Status: **sudah bisa dipakai** (13 Oktober 2026). Yang sengaja tetap di bundel awal: kerangka aplikasi,
Beranda (halaman pertama semua orang, termasuk tamu), halaman masuk, 404, dan pagar galat ulangan — menunda
keempatnya hanya menambah satu putaran jaringan di detik-detik pertama tanpa menghemat apa pun yang berarti.
Halaman auth selain “Masuk” juga malas, tetapi tidak dipramuat karena tidak punya tautan menu yang bisa disorot.
Dua potongan vendor tetap besar dan tetap ikut di awal karena memang selalu dipakai (`react-dom` + react +
zustand 328,98 kB; `axios` + `react-router` 209,85 kB) — itu batas tumpukan yang dipilih, bukan sisa kode halaman.

---

## Batasan jujur

**Yang sengaja TIDAK kami lakukan:**
- Tanpa share layar WebRTC — layar guru hanya menyinkronkan **konten**, bukan salinan layar penuh.
- Editor bergaya video editor (rasio bingkai, timeline, kuis **tersemat pada detik** di dalam video) sejak 10 Oktober 2026 **sudah ada** dan teruji; yang masih terbatas adalah cakupan kodek videonya — bukti pemutaran kami masih pada satu berkas MP4 di basis data pengembangan, bukan seluruh format yang mungkin diunggah guru.
- Tanpa multi-tenant — satu instalasi untuk satu sekolah.
- Mode luring (bagian 17) **bukan** aplikasi PWA: belum ada service worker, jadi murid yang memuat ulang
  atau membuka ulang halaman saat internet benar-benar mati masih akan melihat layar galat. Yang dijamin:
  selama aplikasi terbuka (atau murid berpindah halaman di dalamnya), jawaban tetap aman, riwayat tetap
  terbaca, dan pengiriman ke server menunggu koneksi — bukan hilang.
- Anti-cheat **tidak menjamin 100%** — semua deteksi di browser bisa diakali; catatannya adalah bahan tinjauan guru, bukan vonis.

**Fitur yang masuk daftar potong bila waktu mepet** (urutan dari chunk_map.json): cache L1, ekspor xlsx,
mode gelap, mode tim, penilaian AI, rekam diri, avatar dan moderasi, layar guru. Per 7 Oktober 2026
**semuanya sudah selesai dan hijau**: cache L1 (bagian 14), mode gelap (bagian 13), mode tim (bagian 11),
penilaian AI (bagian 10), rekam diri (bagian 9), avatar + moderasi (bagian 8), layar guru di perangkat
murid (bagian 15), dan ekspor nilai (CSV, bukan xlsx — alasannya di bagian 12). Yang tersisa dari rencana
awal adalah **Octane Swoole** (ekstensi `swoole` tidak ada di mesin pengembangan, jadi belum bisa dijalankan
maupun diuji — dicatat jujur) dan **deploy**.

**Yang tidak boleh dipotong apa pun alasannya:** deploy dengan link yang bisa dibuka, Octane Swoole (atau catatan jujur bila gagal), keamanan inti (auth, pembatasan akses antar murid, kunci jawaban tidak bocor, deadline dari server), serta jurnal prompt dan log mentah yang jujur.
