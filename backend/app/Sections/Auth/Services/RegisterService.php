<?php

declare(strict_types=1);

namespace App\Sections\Auth\Services;

use App\Models\User;
use App\Sections\Auth\Enums\UserStatus;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class RegisterService
{
    /** Nama kelas penampung untuk murid self-register yang belum ditempatkan guru. */
    public const KELAS_PENAMPUNG = 'Tanpa Kelas';

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
        $user = DB::transaction(function () use ($data): User {
            $user = User::query()->create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => Hash::make($data['password']),
                'status' => UserStatus::Pending->value,
            ]);

            // Kolom `role` + role Spatie ditulis bersama lewat satu pintu.
            $user->tetapkanPeran('murid');

            $this->hubungkanProfilMurid($user);

            return $user;
        });

        return [
            'user' => $user,
            'email_terkirim' => $this->email->kirimVerifikasi($user),
        ];
    }

    /**
     * Buat profil murid untuk akun self-register beserta kelas penampungnya.
     *
     * Profil ini syarat semua fitur murid (avatar, progres tema, lencana, kuis
     * kelas): tanpa baris di tabel `students`, endpoint murid menolak dengan 403
     * padahal akunnya sudah masuk. Kelas `kelas_id`-nya NOT NULL, jadi murid
     * ditempatkan di satu kelas penampung "Tanpa Kelas" — guru bisa memindahkan
     * dia ke kelas sungguhan lewat halaman Murid. Kelas penampung dibuat
     * sekali per sekolah (firstOrCreate) dan ikut terlihat di halaman Kelas.
     */
    private function hubungkanProfilMurid(User $user): ?Murid
    {
        // Instalasi tanpa data induk (mis. lingkungan uji yang tidak menyemai
        // sekolah): pendaftaran tetap berhasil, penyambungan profil dikerjakan
        // guru lewat halaman Murid.
        $sekolah = Sekolah::query()->first();

        if ($sekolah === null) {
            return null;
        }

        $kelas = Kelas::query()->firstOrCreate(
            ['school_id' => $sekolah->getKey(), 'nama' => self::KELAS_PENAMPUNG],
            ['tingkat' => 1, 'tahun_ajaran' => null],
        );

        return Murid::query()->create([
            'school_id' => $sekolah->getKey(),
            'class_id' => $kelas->getKey(),
            'user_id' => $user->getKey(),
        ]);
    }

    /**
     * Pesan setelah pendaftaran berhasil (murid langsung masuk, tinggal verifikasi).
     */
    public function pesanResponsDaftar(): string
    {
        return 'Akun dibuat. Kamu sudah masuk — tinggal verifikasi email untuk membuka semua fitur.';
    }
}
