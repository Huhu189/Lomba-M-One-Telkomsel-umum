<?php

declare(strict_types=1);

namespace App\Sections\Auth\Services;

use App\Models\User;
use App\Sections\Auth\Enums\UserStatus;
use Illuminate\Auth\Events\Verified;

class VerifyEmailService
{
    /**
     * Tandai email terverifikasi dan aktifkan akun (dipanggil dari tautan bertanda tangan).
     */
    public function verifikasi(User $user): void
    {
        if (! $user->hasVerifiedEmail()) {
            $user->forceFill([
                'email_verified_at' => $user->freshTimestamp(),
                'status' => UserStatus::Aktif->value,
            ])->save();

            event(new Verified($user));
        }
    }

    /**
     * Kirim ulang tautan verifikasi (queue) — dipanggil dengan throttle 'verifikasi'.
     */
    public function kirimUlang(User $user): void
    {
        if ($user->hasVerifiedEmail()) {
            return;
        }

        $user->sendEmailVerificationNotification();
    }
}
