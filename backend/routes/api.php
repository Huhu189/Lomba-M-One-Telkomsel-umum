<?php

declare(strict_types=1);

use App\Sections\Auth\Http\Controllers\AuthController;
use App\Sections\Auth\Http\Controllers\PasswordResetController;
use App\Sections\Auth\Http\Controllers\VerifyEmailController;
use App\Sections\Health\Http\Controllers\HealthController;
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

    // Jalur beresin sesi (wajib masuk; akun tidak layak ditolak 'akun-aktif').
    Route::middleware(['auth:sanctum', 'akun-aktif'])->group(function (): void {
        Route::post('/auth/keluar', [AuthController::class, 'keluar'])->name('auth.keluar');
        Route::get('/auth/saya', [AuthController::class, 'saya'])->name('auth.saya');
        Route::post('/auth/kirim-ulang-verifikasi', [AuthController::class, 'kirimUlangVerifikasi'])
            ->middleware('throttle:verifikasi')
            ->name('auth.kirim-ulang-verifikasi');
    });
});

// Titik pengecekan identitas cepat (dipakai diagnostik; identitas dari sesi).
Route::get('/v1/sesi', function (Request $request): JsonResponse {
    return response()->json(['terautentikasi' => $request->user() !== null]);
});
