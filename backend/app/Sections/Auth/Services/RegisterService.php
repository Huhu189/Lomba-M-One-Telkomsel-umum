<?php

declare(strict_types=1);

namespace App\Sections\Auth\Services;

use App\Models\User;
use App\Sections\Auth\Enums\UserStatus;
use Illuminate\Support\Facades\Hash;

class RegisterService
{
    /**
     * Daftarkan murid baru dan kirim tautan verifikasi (queue).
     * Hanya murid yang boleh self-register; role selalu 'murid' dari server.
     *
     * @param  array{name: string, email: string, password: string}  $data
     */
    public function daftarMurid(array $data): User
    {
        $user = User::query()->create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'status' => UserStatus::Pending->value,
            'role' => 'murid',
        ]);

        $user->assignRole('murid');
        $user->sendEmailVerificationNotification();

        return $user;
    }

    /**
     * Respons pendaftaran yang identik tanpa membocorkan keberadaan email
     * (anti user-enumeration).
     */
    public function pesanResponsDaftar(): string
    {
        return 'Jika email belum terdaftar, tautan verifikasi telah dikirim. Periksa kotak masuk Anda.';
    }
}
