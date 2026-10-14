<?php

declare(strict_types=1);

use App\Sections\Admin\Http\Controllers\AkunSekolahController;
use App\Sections\Admin\Http\Controllers\MonitorSekolahController;
use App\Sections\Attempt\Http\Controllers\AttemptController;
use App\Sections\Attempt\Http\Controllers\BerkasJawabanController;
use App\Sections\Attempt\Http\Controllers\TimController;
use App\Sections\Attempt\Http\Controllers\UnggahanJawabanController;
use App\Sections\Auth\Http\Controllers\AkunController;
use App\Sections\Auth\Http\Controllers\AuthController;
use App\Sections\Auth\Http\Controllers\CekSesiController;
use App\Sections\Auth\Http\Controllers\PasswordResetController;
use App\Sections\Auth\Http\Controllers\VerifyEmailController;
use App\Sections\Avatar\Http\Controllers\AvatarController;
use App\Sections\Avatar\Http\Controllers\BerkasAvatarController;
use App\Sections\Avatar\Http\Controllers\ModerasiAvatarController;
use App\Sections\Cheat\Http\Controllers\KecuranganController;
use App\Sections\Health\Http\Controllers\HealthController;
use App\Sections\Material\Http\Controllers\BerkasController;
use App\Sections\Material\Http\Controllers\LaporanMateriController;
use App\Sections\Material\Http\Controllers\MateriController;
use App\Sections\Material\Http\Controllers\ProgresMateriController;
use App\Sections\Material\Http\Controllers\UnggahanController;
use App\Sections\Presence\Http\Controllers\KehadiranController;
use App\Sections\Presence\Http\Controllers\LayarController;
use App\Sections\Presence\Http\Controllers\MonitorController;
use App\Sections\Presence\Http\Controllers\TiketSseController;
use App\Sections\Question\Http\Controllers\SoalController;
use App\Sections\Question\Http\Controllers\TagController;
use App\Sections\Quiz\Http\Controllers\KuisController;
use App\Sections\Report\Http\Controllers\BadgeController;
use App\Sections\Report\Http\Controllers\LaporanController;
use App\Sections\Report\Http\Controllers\ProgresController;
use App\Sections\Report\Http\Controllers\RankingController;
use App\Sections\School\Http\Controllers\KelasController;
use App\Sections\School\Http\Controllers\MapelController;
use App\Sections\School\Http\Controllers\MuridController;
use App\Sections\School\Http\Controllers\SekolahController;
use App\Sections\Scoring\Http\Controllers\KoreksiController;
use App\Sections\Settings\Http\Controllers\PengaturanController;
use App\Sections\Tamu\Http\Controllers\TamuController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('/health', HealthController::class)->name('health');

    // Jalur publik auth — throttle 'auth' (anti brute-force & anti spam email).
    Route::middleware('throttle:auth')->group(function (): void {
        Route::post('/auth/daftar', [AuthController::class, 'daftar'])->name('auth.daftar');
        Route::post('/auth/masuk', [AuthController::class, 'masuk'])->name('auth.masuk');
        Route::post('/auth/lupa-sandi', [PasswordResetController::class, 'lupa'])->name('auth.lupa-sandi');
        Route::post('/auth/atur-ulang-sandi', [PasswordResetController::class, 'aturUlang'])->name('auth.atur-ulang-sandi');

        // Kirim ulang tautan verifikasi tanpa sesi (akun pending belum bisa masuk).
        Route::post('/auth/kirim-ulang-verifikasi-publik', [AuthController::class, 'kirimUlangVerifikasiPublik'])
            ->name('auth.kirim-ulang-verifikasi-publik');
    });

    // Siswa tamu (tanpa akun): cukup nama, ditentukan guru lewat pengaturan
    // `izinkan_tamu`. Throttle-nya SENDIRI (T1), bukan `auth`: limiter `auth`
    // berkunci per IP+email, sehingga semua tamu dari satu sekolah berbagi satu
    // kunci dan murid ke-6 ditolak. Limiter `tamu` berkunci per kode perangkat
    // pengunjung, dengan batas per IP yang longgar sebagai pagar penyalahgunaan.
    Route::post('/auth/tamu', [TamuController::class, 'masuk'])
        ->middleware('throttle:tamu')
        ->name('auth.tamu');

    // Info publik mode tamu: dipakai halaman masuk untuk memutuskan apakah
    // formulir "masuk sebagai siswa tamu" ditampilkan. Tanpa sesi dan tanpa data
    // pribadi, jadi tidak ikut throttle jalur auth.
    Route::get('/tamu', [TamuController::class, 'info'])->name('tamu.info');

    // Tautan verifikasi dari email (bertanda tangan, dibatasi jumlah klik).
    // Nama rute WAJIB 'verification.verify' — dipakai notifikasi VerifyEmail bawaan.
    Route::get('/auth/verifikasi-email/{id}/{hash}', VerifyEmailController::class)
        ->middleware(['signed:relative', 'throttle:verifikasi-klik'])
        ->name('verification.verify');

    // Penyajian berkas materi (slice 08) — TANPA sesi, cukup URL bertanda tangan
    // berumur pendek. Berkas fisik ada di storage privat, jadi ini satu-satunya jalan.
    Route::get('/berkas/{kode}', BerkasController::class)
        ->middleware(['signed:relative', 'throttle:berkas'])
        ->name('materi.berkas');

    // Penyajian gambar avatar (slice 08) — sama: tanpa sesi, hanya URL bertanda tangan.
    Route::get('/berkas/avatar/{kode}', BerkasAvatarController::class)
        ->middleware(['signed:relative', 'throttle:berkas'])
        ->name('avatar.berkas');

    // Penyajian lampiran jawaban murid (slice 09) — URL bertanda tangan berumur
    // pendek, hanya diberikan ke pemilik attempt dan guru.
    Route::get('/berkas/jawaban/{kode}', BerkasJawabanController::class)
        ->middleware(['signed:relative', 'throttle:berkas'])
        ->name('jawaban.berkas');

    // Jalur beresin sesi + data induk (wajib masuk; akun tidak layak ditolak 'akun-aktif').
    Route::middleware(['auth:sanctum', 'akun-aktif'])->group(function (): void {
        Route::post('/auth/keluar', [AuthController::class, 'keluar'])->name('auth.keluar');
        Route::get('/auth/saya', [AuthController::class, 'saya'])->name('auth.saya');
        Route::post('/auth/kirim-ulang-verifikasi', [AuthController::class, 'kirimUlangVerifikasi'])
            ->middleware('throttle:verifikasi')
            ->name('auth.kirim-ulang-verifikasi');

        // Setelan akun sendiri (nama + kata sandi). Ganti sandi dibatasi throttle
        // `sandi`: menebak sandi lama dari sesi yang tertinggal di komputer bersama
        // tidak boleh bisa dicoba tanpa batas.
        Route::put('/akun', [AkunController::class, 'perbarui'])->name('akun.perbarui');
        Route::put('/akun/sandi', [AkunController::class, 'gantiSandi'])
            ->middleware('throttle:sandi')
            ->name('akun.sandi');

        // Sekolah (satu baris).
        Route::get('/sekolah', [SekolahController::class, 'show'])->name('sekolah.show');
        Route::put('/sekolah', [SekolahController::class, 'update'])->name('sekolah.update');

        // Kelas.
        Route::get('/kelas', [KelasController::class, 'index'])->name('kelas.index');
        Route::post('/kelas', [KelasController::class, 'store'])->name('kelas.store');
        Route::put('/kelas/{kelas}', [KelasController::class, 'update'])->name('kelas.update');
        Route::delete('/kelas/{kelas}', [KelasController::class, 'destroy'])->name('kelas.destroy');

        // Mapel.
        Route::get('/mapel', [MapelController::class, 'index'])->name('mapel.index');
        Route::post('/mapel', [MapelController::class, 'store'])->name('mapel.store');
        Route::put('/mapel/{mapel}', [MapelController::class, 'update'])->name('mapel.update');
        Route::delete('/mapel/{mapel}', [MapelController::class, 'destroy'])->name('mapel.destroy');

        // Murid + impor/ekspor CSV.
        Route::get('/murid', [MuridController::class, 'index'])->name('murid.index');
        Route::post('/murid', [MuridController::class, 'store'])->name('murid.store');
        Route::post('/murid/impor', [MuridController::class, 'impor'])->name('murid.impor');
        Route::get('/murid/ekspor', [MuridController::class, 'ekspor'])->name('murid.ekspor');
        Route::put('/murid/{murid}', [MuridController::class, 'update'])->name('murid.update');
        Route::delete('/murid/{murid}', [MuridController::class, 'destroy'])->name('murid.destroy');

        // Pengaturan tiga lapis.
        Route::get('/pengaturan', [PengaturanController::class, 'index'])->name('pengaturan.index');
        Route::put('/pengaturan', [PengaturanController::class, 'perbarui'])->name('pengaturan.perbarui');

        // Tag soal = tema pemahaman.
        Route::get('/tag', [TagController::class, 'index'])->name('tag.index');
        Route::post('/tag', [TagController::class, 'store'])->name('tag.store');
        Route::put('/tag/{tag}', [TagController::class, 'update'])->name('tag.update');
        Route::delete('/tag/{tag}', [TagController::class, 'destroy'])->name('tag.destroy');

        // Bank soal (guru/admin; murid menerima soal lewat kuis tanpa kunci).
        Route::get('/soal', [SoalController::class, 'index'])->name('soal.index');
        Route::post('/soal', [SoalController::class, 'store'])->name('soal.store');
        Route::get('/soal/{soal}', [SoalController::class, 'show'])->name('soal.show');
        Route::put('/soal/{soal}', [SoalController::class, 'update'])->name('soal.update');
        Route::delete('/soal/{soal}', [SoalController::class, 'destroy'])->name('soal.destroy');

        // Materi berblok (slice 08): guru mengelola, murid menempuh.
        Route::get('/materi', [MateriController::class, 'index'])->name('materi.index');
        Route::post('/materi', [MateriController::class, 'store'])->name('materi.store');
        Route::get('/materi-saya', [ProgresMateriController::class, 'daftar'])->name('materi.saya');
        // Katalog tema perjalanan (template tema materi) — didaftarkan SEBELUM
        // `/materi/{materi}` supaya "tema" tidak dibaca sebagai id materi.
        Route::get('/materi/tema', [MateriController::class, 'tema'])->name('materi.tema');
        Route::get('/materi/{materi}', [MateriController::class, 'show'])->name('materi.show');
        Route::put('/materi/{materi}', [MateriController::class, 'update'])->name('materi.update');
        Route::delete('/materi/{materi}', [MateriController::class, 'destroy'])->name('materi.destroy');
        Route::put('/materi/{materi}/blok', [MateriController::class, 'sinkronBlok'])->name('materi.blok');
        Route::post('/materi/{materi}/publikasi', [MateriController::class, 'publikasi'])->name('materi.publikasi');
        Route::post('/materi/{materi}/arsip', [MateriController::class, 'arsipkan'])->name('materi.arsip');
        Route::get('/materi/{materi}/laporan', [LaporanMateriController::class, 'show'])->name('materi.laporan');

        // Unggah berkas materi secara berpotongan (hash per potongan).
        Route::post('/materi/{materi}/unggahan', [UnggahanController::class, 'mulai'])->name('materi.unggahan.mulai');
        Route::put('/unggahan/{unggahan}/potongan/{indeks}', [UnggahanController::class, 'potongan'])
            ->whereNumber('indeks')->name('materi.unggahan.potongan');
        Route::post('/unggahan/{unggahan}/selesai', [UnggahanController::class, 'selesai'])->name('materi.unggahan.selesai');
        Route::delete('/unggahan/{unggahan}', [UnggahanController::class, 'destroy'])->name('materi.unggahan.hapus');

        // Murid menempuh blok: progres + blok kuis sisipan (latihan).
        Route::get('/materi/{materi}/progres', [ProgresMateriController::class, 'ringkasan'])->name('materi.progres');
        Route::post('/materi/{materi}/blok/{blok}/buka', [ProgresMateriController::class, 'buka'])->name('materi.blok.buka');
        Route::post('/materi/{materi}/blok/{blok}/selesai', [ProgresMateriController::class, 'selesai'])->name('materi.blok.selesai');
        Route::get('/materi/{materi}/blok/{blok}/ringkasan-kuis', [ProgresMateriController::class, 'ringkasanKuis'])->name('materi.blok.ringkasan');

        // Avatar murid + moderasi (slice 08): murid mengurus avatarnya sendiri dan
        // melaporkan avatar teman; guru memutuskan hasil tinjauan.
        Route::get('/avatar', [AvatarController::class, 'daftar'])->name('avatar.index');
        Route::get('/avatar/saya', [AvatarController::class, 'saya'])->name('avatar.saya');
        Route::get('/avatar/moderasi', [ModerasiAvatarController::class, 'antrean'])->name('avatar.moderasi');
        Route::post('/avatar', [AvatarController::class, 'unggah'])
            ->middleware('throttle:avatar')->name('avatar.unggah');
        Route::delete('/avatar', [AvatarController::class, 'hapus'])
            ->middleware('throttle:avatar')->name('avatar.hapus');
        Route::post('/avatar/{avatar}/lapor', [AvatarController::class, 'lapor'])
            ->middleware('throttle:avatar')->name('avatar.lapor');
        Route::post('/avatar/{avatar}/pulihkan', [ModerasiAvatarController::class, 'pulihkan'])
            ->middleware('throttle:avatar')->name('avatar.pulihkan');
        Route::post('/avatar/{avatar}/hapus', [ModerasiAvatarController::class, 'hapus'])
            ->middleware('throttle:avatar')->name('avatar.moderasi.hapus');

        // Kuis: guru mengelola; murid melihat kuis terbit kelasnya.
        Route::get('/kuis', [KuisController::class, 'index'])->name('kuis.index');
        Route::post('/kuis', [KuisController::class, 'store'])->name('kuis.store');
        Route::get('/kuis/{kuis}', [KuisController::class, 'show'])->name('kuis.show');
        Route::put('/kuis/{kuis}', [KuisController::class, 'update'])->name('kuis.update');
        Route::delete('/kuis/{kuis}', [KuisController::class, 'destroy'])->name('kuis.destroy');
        Route::put('/kuis/{kuis}/soal', [KuisController::class, 'sinkronSoal'])->name('kuis.soal');
        Route::post('/kuis/{kuis}/publikasi', [KuisController::class, 'publikasi'])->name('kuis.publikasi');
        Route::post('/kuis/{kuis}/arsip', [KuisController::class, 'arsipkan'])->name('kuis.arsip');
        // Pulihkan kuis yang diarsipkan (14 Oktober 2026): arsip dulu satu arah,
        // jadi salah tekan berarti kuisnya hilang dari daftar kerja guru.
        Route::post('/kuis/{kuis}/pulihkan', [KuisController::class, 'pulihkan'])->name('kuis.pulihkan');

        // Pengerjaan kuis (slice 04): mulai, autosave jawaban, kumpulkan, hasil.
        Route::post('/kuis/{kuis}/mulai', [AttemptController::class, 'mulai'])->name('attempt.mulai');
        Route::get('/attempt/{attempt}', [AttemptController::class, 'show'])->name('attempt.show');
        // Cap versi isi soal: dipakai halaman pengerjaan untuk tahu kapan guru
        // memperbaiki soal di tengah ulangan (12 Okt 2026).
        Route::get('/attempt/{attempt}/versi-soal', [AttemptController::class, 'versiSoal'])->name('attempt.versi_soal');
        Route::post('/attempt/{attempt}/jawab', [AttemptController::class, 'jawab'])->name('attempt.jawab');
        Route::post('/attempt/{attempt}/kumpulkan', [AttemptController::class, 'kumpulkan'])->name('attempt.kumpulkan');
        Route::get('/attempt/{attempt}/hasil', [AttemptController::class, 'hasil'])->name('attempt.hasil');

        // Lampiran jawaban murid (slice 09): gambar kanvas, rekaman diri, berkas.
        Route::get('/attempt/{attempt}/lampiran', [UnggahanJawabanController::class, 'daftar'])->name('jawaban.daftar');
        Route::post('/attempt/{attempt}/lampiran', [UnggahanJawabanController::class, 'mulai'])->name('jawaban.mulai');
        Route::put('/lampiran/{unggahan}/potongan/{indeks}', [UnggahanJawabanController::class, 'potongan'])
            ->whereNumber('indeks')->name('jawaban.potongan');
        Route::post('/lampiran/{unggahan}/selesai', [UnggahanJawabanController::class, 'selesai'])->name('jawaban.selesai');
        Route::delete('/lampiran/{unggahan}', [UnggahanJawabanController::class, 'hapus'])->name('jawaban.hapus');

        // Skor asli, ranking, badge, remedial, dan laporan per tema (slice 05).
        Route::get('/kuis/{kuis}/ranking', [RankingController::class, 'show'])->name('ranking.show');
        // Ekspor nilai kuis ke CSV (slice 10) — buku nilai guru, sesi cookie.
        Route::get('/kuis/{kuis}/ekspor-nilai', [LaporanController::class, 'eksporNilai'])->name('kuis.ekspor_nilai');
        Route::get('/kuis/{kuis}/laporan', [LaporanController::class, 'show'])->name('laporan.show');
        // Hasil siswa tamu satu kuis (guru pemilik kuis): laporan kelas tidak
        // memuat tamu, jadi guru perlu jalur ini untuk melihat nilainya.
        Route::get('/kuis/{kuis}/tamu', [TamuController::class, 'kuis'])->name('tamu.kuis');
        // Badge & progres murid yang sedang masuk. GET adalah jalur resmi;
        // POST disediakan sebagai alias yang setara (dua-duanya hanya membaca)
        // supaya klien tidak menabrak 405 saat tersalah kirim POST.
        Route::get('/badge/saya', [BadgeController::class, 'saya'])->name('badge.saya');
        Route::post('/badge/saya', [BadgeController::class, 'sayaPost'])
            ->name('badge.saya.post');
        Route::get('/progres/saya', [ProgresController::class, 'saya'])->name('progres.saya');
        Route::post('/progres/saya', [ProgresController::class, 'sayaPost'])
            ->name('progres.saya.post');

        // Tim kuis mode kelompok (slice 09-C): guru menyusun, murid melihat timnya.
        Route::get('/kuis/{kuis}/tim', [TimController::class, 'daftar'])->name('tim.daftar');
        Route::post('/kuis/{kuis}/tim', [TimController::class, 'simpan'])->name('tim.simpan');
        Route::post('/kuis/{kuis}/tim/bagi', [TimController::class, 'bagi'])->name('tim.bagi');
        Route::delete('/kuis/{kuis}/tim/{tim}', [TimController::class, 'hapus'])->name('tim.hapus');
        Route::get('/kuis/{kuis}/tim-saya', [TimController::class, 'milikSaya'])->name('tim.milik_saya');

        // Koreksi manual guru (slice 06): antrean → token konfirmasi → simpan.
        Route::get('/kuis/{kuis}/koreksi', [KoreksiController::class, 'antrean'])->name('koreksi.antrean');
        Route::post('/attempt/{attempt}/koreksi/token', [KoreksiController::class, 'token'])->name('koreksi.token');
        Route::post('/attempt/{attempt}/koreksi', [KoreksiController::class, 'simpan'])->name('koreksi.simpan');
        // Minta ulang saran AI untuk satu attempt (slice 09-B); tetap saran saja.
        Route::post('/attempt/{attempt}/nilai-ai', [KoreksiController::class, 'nilaiAi'])->name('koreksi.nilai_ai');

        // Anti-cheat + presence + Live Monitor (slice 07).
        // Murid: kirim kejadian berkelompok + ping kehadiran.
        // Throttle `kejadian` (K-09): tanpa batas, satu akun bisa menembak rute ini
        // berulang kali dan menulis puluhan ribu baris `cheat_events` per menit.
        // Kuota per attempt di KecuranganService adalah pagar terakhirnya.
        Route::post('/attempt/{attempt}/kejadian', [KecuranganController::class, 'catat'])
            ->middleware('throttle:kejadian')->name('kecurangan.catat');
        Route::post('/attempt/{attempt}/hadir', [KehadiranController::class, 'ping'])->name('presence.ping');
        // Denyut proteksi ber-nonce (2D): membuktikan sensor di perangkat murid
        // masih hidup. Throttle-nya murah — satu denyut tiap 30 detik.
        Route::post('/attempt/{attempt}/denyut', [KehadiranController::class, 'denyut'])
            ->middleware('throttle:denyut')->name('presence.denyut');

        // Guru: catatan kejadian, tinjauan, snapshot Live Monitor, ticket SSE.
        Route::get('/kuis/{kuis}/kejadian', [KecuranganController::class, 'daftar'])->name('kecurangan.daftar');
        Route::put('/kejadian/{kejadian}', [KecuranganController::class, 'tinjau'])->name('kecurangan.tinjau');
        Route::get('/kuis/{kuis}/monitor', [MonitorController::class, 'show'])->name('monitor.show');
        // Throttle `tiket` (K-10): tiap panggilan menulis baris `sse_tickets` +
        // kunci Redis, jadi tanpa batas ini satu akun bisa membengkakkan keduanya.
        Route::post('/kuis/{kuis}/sse-tiket', [TiketSseController::class, 'terbitkan'])
            ->middleware('throttle:tiket')->name('sse.tiket');

        // Layar guru → perangkat murid (slice 10). Satu endpoint dibaca dua arah:
        // guru mengendalikan (PUT), murid kelas itu mengikuti (GET + tiket SSE).
        Route::get('/kuis/{kuis}/layar', [LayarController::class, 'show'])->name('layar.show');
        Route::put('/kuis/{kuis}/layar', [LayarController::class, 'simpan'])->name('layar.simpan');
        Route::post('/kuis/{kuis}/sse-tiket-murid', [TiketSseController::class, 'terbitkanMurid'])
            ->middleware('throttle:tiket')->name('sse.tiket_murid');

        // Panel admin sekolah (14 Okt 2026): dasbor skala sekolah + kelola akun
        // guru/murid (email, sandi, status). Gerbang sebenarnya adalah policy
        // AkunSekolahPolicy — guru yang menembak rute ini ditolak 403 walau ia
        // sudah masuk — sedangkan mutasinya memakai token konfirmasi sekali pakai
        // + alasan + audit, pola yang sama dengan koreksi nilai.
        Route::prefix('admin')->group(function (): void {
            Route::get('/monitor', [MonitorSekolahController::class, 'show'])->name('admin.monitor');
            Route::get('/akun', [AkunSekolahController::class, 'index'])->name('admin.akun.index');
            Route::post('/akun/{akun}/token', [AkunSekolahController::class, 'token'])
                ->middleware('throttle:kelola-akun')->name('admin.akun.token');
            Route::put('/akun/{akun}/email', [AkunSekolahController::class, 'ubahEmail'])
                ->middleware('throttle:kelola-akun')->name('admin.akun.email');
            Route::put('/akun/{akun}/sandi', [AkunSekolahController::class, 'setelSandi'])
                ->middleware('throttle:kelola-akun')->name('admin.akun.sandi');
            Route::put('/akun/{akun}/status', [AkunSekolahController::class, 'ubahStatus'])
                ->middleware('throttle:kelola-akun')->name('admin.akun.status');
        });
    });
});

// Titik pengecekan identitas cepat (dipakai diagnostik; identitas dari sesi).
// Controller invokable (bukan closure) agar `route:cache` tidak ditolak.
Route::get('/v1/sesi', CekSesiController::class)->name('sesi');
