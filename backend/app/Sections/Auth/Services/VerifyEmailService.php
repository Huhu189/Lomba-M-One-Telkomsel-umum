<?php

declare(strict_types=1);

namespace App\Sections\Auth\Services;

use App\Models\User;
use App\Sections\Auth\Enums\UserStatus;
use Illuminate\Auth\Events\Verified;

class VerifyEmailService
{
    public function __construct(private readonly PengirimEmail $email) {}

    /**
     * Tandai email terverifikasi dan aktifkan akun (dipanggil dari tautan bertanda tangan).
     *
     * Idempoten: tautan yang diklik dua kali tidak mengubah apa pun lagi
     * (tanda tangan sekali pakai secara efek — verifikasi hanya terjadi sekali).
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
     * Kirim ulang tautan verifikasi (fail-open) — dipanggil dengan throttle 'verifikasi'.
     *
     * @return bool true bila email berhasil diserahkan ke mailer
     */
    public function kirimUlang(User $user): bool
    {
        if ($user->hasVerifiedEmail()) {
            return true;
        }

        return $this->email->kirimVerifikasi($user);
    }
}
