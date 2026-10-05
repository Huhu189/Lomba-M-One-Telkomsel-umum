<?php

declare(strict_types=1);

namespace App\Sections\Auth\Services;

use App\Models\User;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Password;

class PasswordResetService
{
    /**
     * Kirim tautan reset (queue). Token disimpan sebagai hash dan sekali pakai
     * (tabel password_reset_tokens, ditangani Laravel).
     */
    public function kirimTautan(string $email): string
    {
        $status = Password::sendResetLink(['email' => $email]);

        // Selalu pesan netral: email tidak diperiksa keberadaannya (anti-enumerasi).
        return $status === Password::RESET_LINK_SENT
            ? 'Jika email terdaftar, tautan pengaturan ulang kata sandi telah dikirim.'
            : 'Jika email terdaftar, tautan pengaturan ulang kata sandi telah dikirim.';
    }

    /**
     * Terapkan kata sandi baru dari token (sekali pakai).
     */
    public function terapkan(array $data): string
    {
        $status = Password::reset(
            $data,
            function (User $user, string $password) {
                $user->forceFill([
                    'password' => $password,
                ])->save();
            },
            function (User $user, string $token): string {
                // Tautan menuju halaman frontend (SPA), bukan ke API.
                $dasar = rtrim((string) Config::string('app.frontend_url'), '/');

                return $dasar.'/atur-ulang-sandi?token='.$token.'&email='.urlencode($user->email);
            },
        );

        return $status === Password::PASSWORD_RESET
            ? 'Kata sandi berhasil diganti. Silakan masuk.'
            : 'Tautan tidak valid atau sudah pernah dipakai.';
    }
}
