# Prompt Claude — rombak UI/UX slice 00–02 (dikerjakan di luar repo, disalin masuk)

Asal berkas: `docs/log-mentah/promt_claude.txt` — prompt yang dikirim pengguna ke AI lain untuk merombak UI/UX.
Isi di bawah ini **apa adanya** (tidak disunting). Disalin ke dokumentasi utama sebagai bagian log mentah utuh.

---

Perhatikan, saat ini masih mvp dalam logic nay dan ui nya belum matang, kau boleh bua tui nya rombak ui nya dan ux nya matangkan dan boleh komfirm jika ada yang gak yakin
(di upload file backend dan frontend dan juga docs)

Bertindaklah sebagai tim ahli teknologi senior yang terdiri dari Principal UI/UX Architect, Lead QA Automation Engineer, Chief Information Security Officer, dan Principal Software Engineer spesialis Algoritma dan Performa Sistem.
Tugas Anda adalah melakukan analisis arsitektur, kode, dan alur sistem secara agresif serta mendalam untuk menemukan semua kemungkinan bug, edge cases, celah keamanan, dan inefisiensi performa pada input berikut:

Analisis input tersebut dan petakan seluruh masalah secara detail berdasarkan 5 pilar spesialisasi berikut:
## 1. Komponen UI/UX dan Layout Edge Cases

* State Failures: Ketiadaan indikator pemuatan data (loading state) pada koneksi lambat, ketiadaan penanganan halaman kosong (empty state) yang informatif, representasi error yang tidak spesifik bagi pengguna awam, dan hilangnya umpan balik visual saat aksi berhasil dieksekusi.
* Layout Disruption: Kegagalan pembungkusan teks (text wrapping) pada string berkarakter panjang tanpa spasi (misalnya nama pengguna dengan 100 karakter atau kata medis), kerusakan aspek rasio elemen visual pada resolusi ekstrem (ultra-wide monitor hingga ponsel layar kecil), penumpukan elemen visual (overlapping) ketika fitur aksesibilitas zoom teks diaktifkan hingga 200 persen, dan pemotongan teks tombol (truncation) yang menghilangkan konteks instruksi.
* Interaction Impedance: Pergeseran tata letak yang tidak terduga (Cumulative Layout Shift) saat elemen dinamis dimuat tardif, area interaktif layar sentuh yang terlalu berdekatan (touch target terlalu kecil) sehingga memicu salah klik, dan ketiadaan pembatalan aksi (undo) pada operasi destruktif.

## 2. Fungsional QA dan Batasan Kondisi (State Boundary)

* Input Extremes: Penanganan tipe data primitif saat menerima nilai null, undefined, string kosong, string yang hanya berisi karakter spasi (whitespace), karakter Unicode khusus, emoji, karakter escape HTML/XML (<, >, &, ', "), serta ketidaksesuaian tipe data objek yang dipaksa masuk ke sistem (type coercion).
* Mathematical Boundaries: Risiko terjadinya integer overflow atau underflow, kesalahan presisi aritmatika desimal (floating-point precision) dalam perhitungan kalkulasi finansial, input nilai negatif atau pecahan pada kolom kuantitas absolut, serta penanganan pembagian dengan angka nol (division by zero) yang dapat menghentikan eksekusi program.
* Asynchronous Timing: Dampak pengiriman permintaan berulang akibat pengguna menekan tombol kirim berkali-kali secara cepat (double-click/network flooding), navigasi mundur (back button) ketika transaksi sedang ditulis ke basis data, interupsi koneksi internet terputus total di tengah proses handshake API, penanganan sesi kedaluwarsa saat token JWT habis di tengah pengisian formulir panjang, dan inkonsistensi waktu akibat perbedaan zona waktu server, klien, serta transisi Daylight Saving Time (DST).

## 3. Celah Keamanan dan Eksploitasi (OWASP Top 10)

* Injection and Bypasses: Potensi celah SQL/NoSQL Injection pada kueri yang dibangun secara dinamis, kerentanan Cross-Site Scripting (XSS) akibat kegagalan sanitasi atau escaping input pada sisi klien sebelum dirender, eksekusi perintah jarak jauh (Remote Code Execution), serta manipulasi parameter (parameter tampering) seperti mengubah harga produk atau ID pengguna secara ilegal melalui modifikasi muatan (payload) HTTP request.
* Authorization Failure: Kerentanan Broken Object Level Authorization (BOLA/IDOR) di mana pengguna dapat mengakses atau memodifikasi data milik pengguna lain dengan mengganti pengenal ID pada URL/API, eskalasi hak akses vertikal (pengguna biasa mengeksekusi fungsi administrator), eksploitasi Broken Function Level Authorization, serta ketiadaan atau kelemahan mekanisme Rate Limiting yang membuka celah brute-force serangan siber atau Denial of Service (DoS).

## 4. Performa Algoritma, Notasi Big O, dan Optimalisasi Kode

* Computational Complexity: Deteksi algoritma dengan kompleksitas waktu buruk seperti perulangan bersarang (nested loops) yang menghasilkan Big O tingkat O(n pangkat 2) atau lebih buruk, yang berpotensi membekukan memori sistem saat volume data tumbuh linier. Identifikasi kueri basis data tanpa indeks (full table scan) dan pemanggilan fungsi atau API yang redundan di dalam siklus loop.
* Memory Management: Potensi kebocoran memori (memory leaks) yang disebabkan oleh listener acara (event listeners) atau pengatur waktu (timers) yang tidak dibersihkan setelah komponen dihancurkan, fungsi rekursif tanpa kondisi henti yang valid sehingga memicu stack overflow, serta transfer muatan data (payload) berskala masif tanpa adanya mekanisme paginasi atau streaming data.
* Rendering Efficiency: Pada sisi frontend, identifikasi pemicu re-render komponen yang tidak perlu akibat kegagalan momoisasi (memoization), ukuran aset gambar atau video yang tidak dikompresi, dan keberadaan skrip sinkronus eksternal yang memblokir proses rendering halaman utama (render-blocking scripts).

## 5. Integrasi Sistem dan Keandalan Pihak Ketiga (Third-Party)

* Fault Tolerance: Mekanisme pertahanan sistem ketika API eksternal mengalami kegagalan respons (timeout), mengembalikan kode status HTTP 5xx (internal server error), atau mengirimkan struktur data yang tidak sesuai dengan kontrak kontrak API (corrupted/schema mismatch).
* Data Integrity and Concurrency: Masalah sinkronisasi data akibat penggunaan cache yang usang (stale data), kegagalan pembatalan transaksi (rollback) saat terjadi galat parsial dalam arsitektur microservices, dan kondisi Race Condition di mana urutan penyelesaian proses latar belakang (asynchronous) berjalan tidak dapat diprediksi sehingga menimpa data valid terbaru dengan data lama.

Sajikan temuan Anda dalam format laporan yang terstruktur dengan menggunakan templat berikut untuk setiap masalah yang teridentifikasi:

* Kategori: [Pilih salah satu: UI/UX | QA | Keamanan | Performa | Integrasi]
* Skenario: [Penjelasan mendalam mengenai kondisi spesifik yang memicu masalah]
* Dampak: [Dampak teknis dan bisnis jika masalah ini diabaikan, sebutkan notasi Big O jika berkaitan dengan performa]
* Solusi: [Langkah perbaikan, validasi kode, penulisan kueri alternatif, atau revisi desain yang konkret dan siap diimplementasikan]
 
atau cari  jenis bug lain dari dari catori nya (log saja cari tanap di fix namun kau catata dengna baik hingga nama func







