<?php

declare(strict_types=1);

namespace App\Models;

use App\Sections\Auth\Enums\UserStatus;
use App\Sections\School\Models\Murid;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Traits\HasRoles;

#[Fillable(['name', 'email', 'password', 'status', 'role'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    use HasApiTokens;

    /** @use HasFactory<UserFactory> */
    use HasFactory;

    use HasRoles;
    use Notifiable;

    /**
     * Guard satu-satunya aplikasi ini (Sanctum mode SPA = sesi web).
     */
    protected $guard_name = 'web';

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'status' => UserStatus::class,
    ];

    /**
     * Status akun yang boleh lewat (dipakai middleware & login).
     */
    public function isAktif(): bool
    {
        return $this->status === UserStatus::Aktif;
    }

    /**
     * Alasan akun ditolak (null bila boleh masuk).
     */
    public function alasanAkunDitolak(): ?string
    {
        return match ($this->status) {
            UserStatus::Suspended => 'Akun ditangguhkan. Hubungi sekolah.',
            UserStatus::Dihapus => 'Akun sudah dihapus.',
            UserStatus::Pending => 'Verifikasi email dulu sebelum masuk.',
            UserStatus::Aktif => $this->hasVerifiedEmail() ? null : 'Verifikasi email dulu sebelum masuk.',
        };
    }

    /**
     * SATU-SATUNYA penulis peran user.
     *
     * Aplikasi ini menyimpan peran dua kali: kolom `role` (dipakai query & tampilan)
     * dan role Spatie (dipakai otorisasi). Menulisnya terpisah membuat keduanya bisa
     * berbeda, jadi keduanya selalu ditulis lewat method ini. Role dibuat bila belum
     * ada supaya impor tetap jalan walau seeder belum dijalankan.
     */
    public function tetapkanPeran(string $peran): void
    {
        $this->forceFill(['role' => $peran])->save();
        $this->syncRoles([Role::findOrCreate($peran, 'web')]);
    }

    public function isGuru(): bool
    {
        return $this->hasRole('guru') || $this->hasRole('admin');
    }

    public function isMurid(): bool
    {
        return $this->hasRole('murid');
    }

    /**
     * Boleh mengubah/menghapus baris yang dibuat oleh `$pemilikId`? (S-04/S-05)
     *
     * Admin boleh semuanya. Guru hanya baris buatannya sendiri — kuis, soal,
     * pengaturan anti-cheat satu kuis, sampai koreksi nilainya.
     *
     * Baris tanpa pemilik (`dibuat_oleh` NULL: data lama sebelum kolom itu diisi
     * konsisten, termasuk hasil impor) dianggap milik bersama. Tanpa pengecualian
     * ini guru bisa terkunci dari kuis/soalnya sendiri yang dibuat sebelum
     * kolom pemilik dicatat.
     */
    public function bolehKelola(?int $pemilikId): bool
    {
        if ($this->hasRole('admin')) {
            return true;
        }

        if (! $this->isGuru()) {
            return false;
        }

        return $pemilikId === null || (int) $this->getKey() === $pemilikId;
    }

    /** @return HasOne<Murid, $this> */
    public function murid(): HasOne
    {
        return $this->hasOne(Murid::class, 'user_id');
    }
}
