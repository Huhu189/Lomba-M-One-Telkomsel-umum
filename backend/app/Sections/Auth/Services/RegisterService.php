<?php

declare(strict_types=1);

namespace App\Sections\Auth\Services;

use App\Models\User;
use App\Sections\Auth\Enums\UserStatus;
use App\Sections\School\Services\MuridService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class RegisterService
{
    /**
     * Nama kelas penampung untuk murid yang belum ditempatkan guru.
     *
     * Titik kebenarannya ada di `MuridService` karena kelas yang sama juga
     * dipakai saat menyambungkan murid lama yang profilnya belum ada.
     */
    public const KELAS_PENAMPUNG = MuridService::KELAS_PENAMPUNG;

    public function __construct(
        private readonly PengirimEmail $email,
        private readonly MuridService $murid,
    ) {}

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
        $user = DB::transaction(function () use ($data): User {
            $user = User::query()->create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => Hash::make($data['password']),
                'status' => UserStatus::Pending->value,
            ]);

            // Kolom `role` + role Spatie ditulis bersama lewat satu pintu.
            $user->tetapkanPeran('murid');

            $this->murid->pastikanProfil($user);

            return $user;
        });

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
