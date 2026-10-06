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

        if ($user === null) {
            // Tetap hitung satu hash walau akunnya tidak ada, supaya lama respons
            // tidak membocorkan email mana yang terdaftar (timing attack).
            Hash::check($password, self::sandiDummy());

            $gagal();
        }
        /** @var User $user */
        if (! Hash::check($password, $user->password)) {
            $gagal();
        }

        if ($user->alasanAkunDitolak() !== null) {
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
     * Hash sekali pakai untuk menyamakan waktu respons saat akun tidak ditemukan.
     * Memakai hasher yang sedang aktif (bcrypt di test, argon2id di produksi) agar
     * biaya komputasinya setara dengan pemeriksaan kata sandi sungguhan.
     */
    private static function sandiDummy(): string
    {
        static $hash = null;

        return $hash ??= Hash::make('sandi-dummy-anti-enumerasi');
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
