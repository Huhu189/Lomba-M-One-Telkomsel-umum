<?php

declare(strict_types=1);

namespace App\Sections\Auth\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

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
     * URL tautan reset dibangun di `AppServiceProvider` lewat
     * `ResetPassword::createUrlUsing()` — `Password::reset()` hanya menerima dua
     * argumen, jadi callback url tidak boleh ditulis di sini.
     */
    public function terapkan(string $email, string $token, string $password): string
    {
        $status = Password::reset(
            ['email' => $email, 'token' => $token, 'password' => $password],
            function (User $user, string $sandiBaru): void {
                $user->forceFill([
                    'password' => $sandiBaru,
                    // Kunci ingat-saya di semua perangkat lama ikut dicabut: cookie
                    // "remember me" lama tidak lagi bisa memulihkan sesi.
                    'remember_token' => Str::random(60),
                ])->save();

                // Sesi yang masih hidup di perangkat lain ikut diakhiri
                // (SESSION_DRIVER=database, lihat config/session.php).
                if (config('session.driver') === 'database') {
                    DB::table((string) config('session.table', 'sessions'))
                        ->where('user_id', $user->getKey())
                        ->delete();
                }
            },
        );

        return $status === Password::PASSWORD_RESET
            ? 'Kata sandi berhasil diganti. Silakan masuk.'
            : 'Tautan tidak valid atau sudah pernah dipakai.';
    }
}
