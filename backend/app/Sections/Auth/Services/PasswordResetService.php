<?php

declare(strict_types=1);

namespace App\Sections\Auth\Services;

use App\Models\User;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Password;

class PasswordResetService
{
    public function __construct(private readonly PengirimEmail $email) {}

    /**
     * Kirim tautan reset (fail-open: mailer mati tidak menggagalkan permintaan).
     * Token disimpan sebagai hash dan SEKALI PAKAI (tabel password_reset_tokens;
     * barisnya dihapus Laravel setelah dipakai).
     *
     * Pesan sengaja identik untuk email terdaftar maupun tidak — keberadaan akun
     * tidak boleh bocor (anti user-enumeration), jadi status kirim tidak dilaporkan.
     */
    public function kirimTautan(string $email): string
    {
        $this->email->kirimTautanReset($email);

        return 'Jika email terdaftar, tautan pengaturan ulang kata sandi telah dikirim.';
    }

    /**
     * Terapkan kata sandi baru dari token (sekali pakai).
     *
     * @param  array{token: string, email: string, password: string}  $data
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
