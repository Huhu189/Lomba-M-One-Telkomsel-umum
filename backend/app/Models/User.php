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

#[Fillable(['name', 'email', 'password', 'status', 'role', 'is_tamu'])]
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

    /**
     * Nilai bawaan yang selalu ada di memori.
     *
     * Eloquent hanya mengisi atribut yang benar-benar dikirim saat `create()`,`
     * sehingga user yang baru dibuat tanpa menyebut `is_tamu` (pendaftaran murid,
     * impor, akun buatan guru) TIDAK punya atribut itu di memori — dan membaca
     * `$user->is_tamu` langsung melempar MissingAttributeException pada
     * `Model::preventAccessingMissingAttributes` (aktif di non-produksi).
     * Bawaan di sini membuat hasilnya `false` seperti kolomnya di database.
     */
    protected $attributes = [
        'is_tamu' => false,
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'status' => UserStatus::class,
        'is_tamu' => 'boolean',
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
     * Kepala sekolah (peran `admin`): melihat seluruh sekolah, boleh mengelola
     * akun guru/murid, tetapi **tidak mengubah data akademik** (14 Okt 2026).
     *
     * Perannya mengawasi dan merapikan administrasi, bukan mengajar: menyusun
     * kuis, mengganti kunci soal, mengubah nilai, dan menangguhkan catatan
     * kecurangan tetap milik guru yang mengerjakan ulangan itu — supaya tidak ada
     * dua pihak yang bisa mengubah nilai anak yang sama tanpa jejak siapa yang
     * mengerjakan.
     */
    public function hanyaMelihat(): bool
    {
        return $this->hasRole('admin');
    }

    /**
     * Boleh mengubah data akademik: guru yang bukan kepala sekolah.
     *
     * Dipakai seluruh policy **tulis** (buat/ubah/hapus/publikasi/koreksi),
     * sedangkan policy **baca** tetap memakai `isGuru()` supaya kepala sekolah
     * tetap bisa membuka daftar, kunci, laporan, dan jejak audit.
     */
    public function bolehMengubahAkademik(): bool
    {
        return $this->isGuru() && ! $this->hanyaMelihat();
    }

    /**
     * Akun siswa tamu (mode tamu tanpa login) — membuat namanya sendiri, tanpa
     * kata sandi, dan tidak terdaftar di kelas mana pun. Dipakai untuk
     * mengecualikannya dari aturan "kuis harus kelasmu" dan menggantinya dengan
     * izin tamu pada kuis itu sendiri (lihat `TamuService`).
     */
    public function isTamu(): bool
    {
        return (bool) $this->is_tamu;
    }

    /**
     * Boleh membuka (baca) sekaligus mengubah baris yang dibuat `$pemilikId`?
     * (S-04/S-05, K-04)
     *
     * Admin boleh semuanya. Guru hanya baris buatannya sendiri — kuis, soal,
     * materi, pengaturan anti-cheat satu kuis, sampai koreksi nilainya.
     *
     * Pengecualian "baris tanpa pemilik dianggap milik bersama" sudah DIBUANG:
     * dengan pengecualian itu, guru mana pun bisa membaca kunci jawaban, nilai,
     * dan catatan kecurangan milik guru lain yang datanya belum punya pemilik.
     * Baris lama yang `dibuat_oleh`-nya NULL sekarang diisi lewat migrasi
     * pengisian pemilik; sesudah itu baris tanpa pemilik hanya bisa disentuh
     * admin.
     */
    public function bolehKelola(?int $pemilikId): bool
    {
        if ($this->hasRole('admin')) {
            return true;
        }

        if (! $this->isGuru()) {
            return false;
        }

        return $pemilikId !== null && (int) $this->getKey() === $pemilikId;
    }

    /** @return HasOne<Murid, $this> */
    public function murid(): HasOne
    {
        return $this->hasOne(Murid::class, 'user_id');
    }
}
