<?php

declare(strict_types=1);

namespace App\Sections\Auth\Services;

use App\Models\User;
use App\Sections\Auth\Enums\UserStatus;
use Illuminate\Auth\Events\Verified;

class VerifyEmailService
{
    public function __construct(private readonly PengirimEmail $email) {}

    /**
     * Tandai email terverifikasi dan aktifkan akun (dipanggil dari tautan bertanda tangan).
     *
     * Idempoten: tautan yang diklik dua kali tidak mengubah apa pun lagi
     * (tanda tangan sekali pakai secara efek — verifikasi hanya terjadi sekali).
     */
    public function verifikasi(User $user): void
    {
        if ($user->hasVerifiedEmail()) {
            return;
        }

        $perubahan = ['email_verified_at' => $user->freshTimestamp()];

        // Status hanya dinaikkan dari Pending. Akun yang ditangguhkan atau sedang
        // dihapus sekolah tidak boleh hidup kembali hanya karena tautan verifikasi
        // (yang tandatangannya masih berlaku) dibuka.
        if ($user->status === UserStatus::Pending) {
            $perubahan['status'] = UserStatus::Aktif->value;
        }

        $user->forceFill($perubahan)->save();

        event(new Verified($user));
    }

    /**
     * Kirim ulang tautan verifikasi (fail-open) — dipanggil dengan throttle 'verifikasi'.
     *
     * @return bool true bila email berhasil diserahkan ke mailer
     */
    public function kirimUlang(User $user): bool
    {
        if ($user->hasVerifiedEmail()) {
            return true;
        }

        return $this->email->kirimVerifikasi($user);
    }

    /**
     * Kirim ulang tautan TANPA sesi (akun pending belum bisa masuk).
     *
     * Penelusuran email dan penjaga status sengaja ada di sini supaya controller
     * hanya bicara dengan service, bukan menyentuh model langsung.
     */
    public function kirimUlangPublik(string $email): void
    {
        $email = mb_strtolower(trim($email));

        if ($email === '') {
            return;
        }

        $user = User::query()->where('email', $email)->first();

        // Pending (belum verifikasi) justru yang boleh kirim ulang; suspend/dihapus tidak.
        if ($user === null || in_array($user->status, [UserStatus::Suspended, UserStatus::Dihapus], true)) {
            return;
        }

        $this->kirimUlang($user);
    }
}
