<?php

declare(strict_types=1);

namespace App\Sections\Auth\Services;

use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Throwable;

/**
 * Pengirim email yang "optimistis": kegagalan SMTP/queue TIDAK pernah
 * menggagalkan pendaftaran atau permintaan tautan. Kegagalan dicatat ke log
 * (tanpa token/isi email) dan dilaporkan sebagai `email_terkirim = false`
 * supaya antarmuka bisa menyarankan tombol kirim ulang.
 */
class PengirimEmail
{
    /**
     * Kirim notifikasi verifikasi email.
     */
    public function kirimVerifikasi(User $user): bool
    {
        if ($user->hasVerifiedEmail()) {
            return true;
        }

        try {
            $user->sendEmailVerificationNotification();

            return true;
        } catch (Throwable $galat) {
            $this->catatGagal('verifikasi', $galat, ['user_id' => $user->getKey()]);

            return false;
        }
    }

    /**
     * Kirim tautan atur ulang kata sandi.
     *
     * Selalu dianggap "berhasil dikirim" kecuali mailer melempar galat, agar
     * responsnya tetap identik untuk email terdaftar maupun tidak
     * (anti user-enumeration).
     */
    public function kirimTautanReset(string $email): bool
    {
        try {
            Password::sendResetLink(['email' => $email]);

            return true;
        } catch (Throwable $galat) {
            $this->catatGagal('atur-ulang-sandi', $galat, []);

            return false;
        }
    }

    /**
     * @param  array<string, mixed>  $konteks
     */
    private function catatGagal(string $jenis, Throwable $galat, array $konteks): void
    {
        Log::warning("Pengiriman email {$jenis} gagal (fail-open, aplikasi tetap lanjut).", $konteks + [
            'pesan' => $galat->getMessage(),
        ]);
    }
}
