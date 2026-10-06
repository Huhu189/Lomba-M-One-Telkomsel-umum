<?php

declare(strict_types=1);

use App\Sections\Auth\Http\Controllers\AuthController;
use App\Sections\Auth\Http\Controllers\PasswordResetController;
use App\Sections\Auth\Http\Controllers\VerifyEmailController;
use App\Sections\Health\Http\Controllers\HealthController;
use App\Sections\Question\Http\Controllers\SoalController;
use App\Sections\Question\Http\Controllers\TagController;
use App\Sections\Quiz\Http\Controllers\KuisController;
use App\Sections\School\Http\Controllers\KelasController;
use App\Sections\School\Http\Controllers\MapelController;
use App\Sections\School\Http\Controllers\MuridController;
use App\Sections\School\Http\Controllers\SekolahController;
use App\Sections\Settings\Http\Controllers\PengaturanController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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

    // Tautan verifikasi dari email (bertanda tangan, dibatasi jumlah klik).
    // Nama rute WAJIB 'verification.verify' — dipakai notifikasi VerifyEmail bawaan.
    Route::get('/auth/verifikasi-email/{id}/{hash}', VerifyEmailController::class)
        ->middleware(['signed', 'throttle:verifikasi'])
        ->name('verification.verify');

    // Jalur beresin sesi + data induk (wajib masuk; akun tidak layak ditolak 'akun-aktif').
    Route::middleware(['auth:sanctum', 'akun-aktif'])->group(function (): void {
        Route::post('/auth/keluar', [AuthController::class, 'keluar'])->name('auth.keluar');
        Route::get('/auth/saya', [AuthController::class, 'saya'])->name('auth.saya');
        Route::post('/auth/kirim-ulang-verifikasi', [AuthController::class, 'kirimUlangVerifikasi'])
            ->middleware('throttle:verifikasi')
            ->name('auth.kirim-ulang-verifikasi');

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

        // Kuis: guru mengelola; murid melihat kuis terbit kelasnya.
        Route::get('/kuis', [KuisController::class, 'index'])->name('kuis.index');
        Route::post('/kuis', [KuisController::class, 'store'])->name('kuis.store');
        Route::get('/kuis/{kuis}', [KuisController::class, 'show'])->name('kuis.show');
        Route::put('/kuis/{kuis}', [KuisController::class, 'update'])->name('kuis.update');
        Route::delete('/kuis/{kuis}', [KuisController::class, 'destroy'])->name('kuis.destroy');
        Route::put('/kuis/{kuis}/soal', [KuisController::class, 'sinkronSoal'])->name('kuis.soal');
        Route::post('/kuis/{kuis}/publikasi', [KuisController::class, 'publikasi'])->name('kuis.publikasi');
        Route::post('/kuis/{kuis}/arsip', [KuisController::class, 'arsipkan'])->name('kuis.arsip');
    });
});

// Titik pengecekan identitas cepat (dipakai diagnostik; identitas dari sesi).
Route::get('/v1/sesi', function (Request $request): JsonResponse {
    return response()->json(['terautentikasi' => $request->user() !== null]);
});
