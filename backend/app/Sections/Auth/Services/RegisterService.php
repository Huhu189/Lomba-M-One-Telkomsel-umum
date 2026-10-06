<?php

declare(strict_types=1);

namespace App\Sections\Auth\Services;

use App\Models\User;
use App\Sections\Auth\Enums\UserStatus;
use Illuminate\Support\Facades\Hash;

class RegisterService
{
    public function __construct(private readonly PengirimEmail $email) {}

    /**
     * Daftarkan murid baru dan kirim tautan verifikasi (fail-open: kegagalan
     * email tidak membatalkan akun yang sudah dibuat).
     *
     * Hanya murid yang boleh self-register; role selalu 'murid' dari server.
     *
     * @param  array{name: string, email: string, password: string}  $data
     * @return array{user: User, email_terkirim: bool}
     */
    public function daftarMurid(array $data): array
    {
        $user = User::query()->create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'status' => UserStatus::Pending->value,
            'role' => 'murid',
        ]);

        $user->assignRole('murid');

        return [
            'user' => $user,
            'email_terkirim' => $this->email->kirimVerifikasi($user),
        ];
    }

    /**
     * Pesan setelah pendaftaran berhasil (murid langsung masuk, tinggal verifikasi).
     */
    public function pesanResponsDaftar(): string
    {
        return 'Akun dibuat. Kamu sudah masuk — tinggal verifikasi email untuk membuka semua fitur.';
    }
}
