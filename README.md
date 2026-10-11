# Note: md ini Di buat manual
<h1>Quizfy</h1>
<p>Platform ujian yang aman, kelas dan penyebaran materi dan pembelajaran yang efektif dan fleksibel dengan standar enterprise-grade application.</p>
<br>
<h1>Fitur</h1>

<strong><p style="font-size:20px">Sistem Ujian</p></strong>
<ul>
  <li><strong>Sistem tahan kecurangan:</strong> Pengawasan ketat dengan deteksi upaya keluar tab, copy paste, print, memecah layar, dll. Secara aman dan tahan banyak extension.</li>
  <li><strong>Bank Soal Dinamis:</strong> Mendukung pengacakan soal dan opsi jawaban secara otomatis serta manajemen kategori soal yang fleksibel.</li>
  <li><strong>Ragam Tipe Soal:</strong> Sangat banyak pilihan tipe soal, terdiri dari 22 soal bervariatif yang memudahkan guru membuat soal ulangan/ujian.</li>
</ul>

<strong><p style="font-size:20px">Manajemen Kelas & Materi</p></strong>
<ul>
  <li><strong>Ruang Kelas Virtual:</strong> Pengelompokan siswa berdasarkan kelas atau organisasi untuk distribusi ujian yang tepat sasaran.</li>
  <li><strong>Penyebaran Materi Efektif:</strong> Unggah dan bagikan modul pembelajaran, video interaktif, dan dokumen pendukung dalam satu dashboard.</li>
  <li><strong>Pelacakan Progres:</strong> Pantau sejauh mana peserta didik telah membaca materi atau menyelesaikan tugas yang diberikan.</li>
</ul>

<strong><p style="font-size:20px">Kualitas Enterprise-Grade</p></strong>
<ul>
  <li><strong>Skalabilitas Tinggi dan kode optimal:</strong> Sanggup menampung ribuan peserta ujian secara bersamaan tanpa kendala latensi atau server down dengan Laravel Octane.</li>
  <li><strong>Keamanan Data Maksimal:</strong> Mencegah banyak percobaan pembajakan hak otorisasi hingga tahan XSS.</li>
  <li><strong>Memiliki akses data ketat:</strong> Akses data berbasis role diimplementasikan dengan sangat ketat.</li>
</ul>

<h1>Menjalankan &amp; Prasyarat</h1>
<ul>
  <li><strong>Satu perintah untuk local:</strong> <code>./nyalakan-local.sh</code> menyalakan Redis, backend (:8000), realtime (:4000), dan frontend (:5173); <code>./nyalakan-local.sh status</code> untuk cek kesehatan dan <code>./nyalakan-local.sh stop</code> untuk mematikannya. Skrip ini memakai <code>php artisan migrate</code> dan <strong>tidak</strong> menghapus data — jadi <strong>sesi login tidak ikut mati</strong> saat local dinyalakan ulang. Jangan pakai <code>migrate:fresh --seed</code> pada DB yang sedang dipakai: perintah itu menjatuhkan tabel <code>sessions</code> dan memaksa semua orang login ulang.</li>
  <li><strong>Redis wajib</strong> — dipakai untuk cache aplikasi, kehadiran Live Monitor (hash per murid), dan pub/sub siaran SSE. Kliennya ekstensi PHP <code>redis</code> (phpredis), bukan Predis: pasang ekstensinya lalu jalankan <code>redis-server</code> (<code>brew install redis</code> di macOS).</li>
  <li><strong>Service realtime (Node) hanya membaca <code>REDIS_URL</code></strong>, bukan <code>REDIS_HOST</code>/<code>REDIS_PORT</code>, dan memakai database 0. Saat deploy, isi <code>REDIS_URL</code> supaya Laravel dan service Node menunjuk Redis yang sama; kalau tidak, keduanya jatuh ke <code>127.0.0.1:6379</code>. Koneksi <code>realtime</code> Laravel sengaja tanpa prefix kunci karena Node tidak mengenal prefix internal Laravel.</li>
  <li><strong>Gerbang mutu:</strong> <code>./verify.sh</code> (Pest, Pint, checkJs, ESLint, Vitest, node --test). Langkah <strong>Backend Redis wajib</strong> sengaja MERAH bila Redis mati — jalur Redis tidak boleh "hijau" tanpa pernah diuji.</li>
  <li><strong>Kalau Redis mati</strong>, aplikasi tetap jalan: kehadiran memakai peta di memori dan panel guru turun ke polling berkala (fail-open) — ulangan tidak pernah gagal karena proteksi.</li>
</ul>

<h1>Kelebihan</h1>
<strong><p style="font-size:20px">Kemudahan guru</p></strong>
<ul>
  <li><strong>Skalabilitas pembuatan ulangan/ujian:</strong> Guru dapat membuat soal ujian/ulangan dll dengan aman dan cepat yang sudah dilengkapi pertahanan cheat.</li>
  <li><strong>Penyebaran materi:</strong> Guru dapat dengan mudah membuat materi berbasis media yang lebih mudah dipahami secara efektif dan motivatif oleh anak SD.</li>
</ul>
