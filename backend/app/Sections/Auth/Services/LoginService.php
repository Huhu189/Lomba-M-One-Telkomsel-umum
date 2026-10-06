<?php

declare(strict_types=1);

namespace App\Sections\Auth\Services;

use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class LoginService
{
    /**
     * Coba login sesi (SPA cookie). Akun pending/suspended/dihapus ditolak
     * dengan pesan generik yang sama seperti kredensial salah (anti-enumerasi).
     *
     * @throws ValidationException
     */
    public function masuk(string $email, string $password, bool $ingat = false): User
    {
        $user = User::query()->where('email', mb_strtolower($email))->first();

        $gagal = static function (): never {
            throw ValidationException::withMessages([
                'email' => 'Email atau kata sandi salah.',
            ]);
        };

        if ($user === null || ! Hash::check($password, $user->password)) {
            $gagal();
        }
        /** @var User $user */
        if (($alasan = $user->alasanAkunDitolak()) !== null) {
            // Pesan sama persis dengan kredensial salah agar tidak bisa dipakai menebak status akun.
            $gagal();
        }

        Auth::guard('web')->login($user, $ingat);
        session()->regenerate();

        return $user;
    }

    /**
     * Masuk otomatis tanpa cek kata sandi — dipakai setelah pendaftaran murid
     * (akun masih pending, jadi hanya halaman verifikasi yang bisa dibuka).
     */
    public function masukOtomatis(User $user, bool $ingat = false): void
    {
        Auth::guard('web')->login($user, $ingat);
        session()->regenerate();
    }

    /**
     * Logout + hancurkan sesi.
     */
    public function keluar(): void
    {
        Auth::guard('web')->logout();
        session()->invalidate();
        session()->regenerateToken();
    }
}
