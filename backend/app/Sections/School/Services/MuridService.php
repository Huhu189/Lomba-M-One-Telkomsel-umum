<?php

declare(strict_types=1);

namespace App\Sections\School\Services;

use App\Models\User;
use App\Sections\Auth\Enums\UserStatus;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Kelola murid tunggal (di luar impor massal).
 */
class MuridService
{
    /**
     * Nama kelas penampung untuk murid yang belum ditempatkan guru.
     *
     * Dipakai murid self-register dan murid lama yang profilnya belum ada,
     * supaya keduanya mendarat di kelas yang sama (bukan satu kelas per murid).
     */
    public const KELAS_PENAMPUNG = 'Tanpa Kelas';

    /**
     * Profil murid milik user, dibuatkan bila belum ada (idempoten).
     *
     * Akun murid bisa saja dibuat di luar jalur resmi — impor lama, baris
     * `users` langsung, atau sebelum kelas penampung ada. Tanpa baris di
     * `students`, seluruh endpoint murid menolak dengan 403 padahal akunnya
     * sah. Method ini menyembuhkan keadaan itu saat diakses: murid ditempatkan
     * di kelas penampung yang sama dengan murid self-register, dan guru bisa
     * memindahkannya lewat halaman Murid.
     *
     * Mengembalikan null hanya bila instalasi belum punya data sekolah — saat
     * itu tidak ada kelas valid untuk ditempati.
     */
    public function pastikanProfil(User $user): ?Murid
    {
        $ada = Murid::query()->where('user_id', $user->getKey())->first();

        if ($ada !== null) {
            return $ada;
        }

        $sekolah = Sekolah::query()->first();

        if ($sekolah === null) {
            return null;
        }

        $kelas = Kelas::query()->firstOrCreate(
            ['school_id' => $sekolah->getKey(), 'nama' => self::KELAS_PENAMPUNG],
            ['tingkat' => 1, 'tahun_ajaran' => null],
        );

        // `user_id` unik: dua permintaan yang tiba hampir bersamaan bisa sama-sama
        // lolos pemeriksaan di atas. `createOrFirst` menyelamatkan yang kalah dari
        // pelanggaran unik dengan mengembalikan baris yang sudah dibuat.
        return Murid::query()->createOrFirst(
            ['user_id' => $user->getKey()],
            ['school_id' => $sekolah->getKey(), 'class_id' => $kelas->getKey()],
        );
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function tambah(int $sekolahId, array $data): Murid
    {
        return DB::transaction(function () use ($sekolahId, $data): Murid {
            $user = User::query()->create([
                'name' => $data['nama'],
                'email' => mb_strtolower((string) $data['email']),
                'password' => Hash::make($data['kata_sandi'] ?? Str::password(16)),
                'status' => UserStatus::Aktif->value,
            ]);
            // email_verified_at tidak mass-assignable; guru yang membuat = terverifikasi.
            $user->forceFill(['email_verified_at' => now()])->save();
            // Kolom `role` + role Spatie ditulis bersama lewat satu pintu.
            $user->tetapkanPeran('murid');

            $murid = Murid::query()->create([
                'school_id' => $sekolahId,
                'class_id' => (int) $data['class_id'],
                'user_id' => $user->getKey(),
                'nis' => $data['nis'] ?? null,
                'nisn' => $data['nisn'] ?? null,
            ]);

            return $murid->load(['user', 'kelas']);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function ubah(Murid $murid, array $data): Murid
    {
        return DB::transaction(function () use ($murid, $data): Murid {
            $user = User::query()->findOrFail($murid->user_id);
            $user->forceFill(['name' => $data['nama']])->save();

            $murid->fill([
                'class_id' => (int) $data['class_id'],
                'nis' => $data['nis'] ?? null,
                'nisn' => $data['nisn'] ?? null,
            ])->save();

            return $murid->refresh()->load(['user', 'kelas']);
        });
    }

    public function hapus(Murid $murid): void
    {
        DB::transaction(function () use ($murid): void {
            $murid->delete();
            User::query()->whereKey($murid->user_id)->delete();
        });
    }
}
