<?php

declare(strict_types=1);

namespace App\Sections\Auth\Services;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

class PasswordResetService
{
    /** Penanda tautan terakhir gagal karena tokennya sudah pernah dipakai. */
    private bool $tautanTerpakai = false;

    public function __construct(private readonly PengirimEmail $email) {}

    /**
     * Kirim tautan reset (fail-open: mailer mati tidak menggagalkan permintaan).
     * Token disimpan sebagai hash dan SEKALI PAKAI (tabel password_reset_tokens;
     * barisnya dihapus Laravel setelah dipakai).
     *
     * Pesan sengaja identik untuk email terdaftar maupun tidak — keberadaan akun
     * tidak boleh bocor (anti user-enumeration), jadi status kirim tidak dilaporkan.
     */
    public function kirimTautan(string $email): string
    {
        $this->email->kirimTautanReset($email);

        return 'Jika email terdaftar, tautan pengaturan ulang kata sandi telah dikirim.';
    }

    /**
     * Terapkan kata sandi baru dari token (sekali pakai).
     *
     * URL tautan reset dibangun di `AppServiceProvider` lewat
     * `ResetPassword::createUrlUsing()` — `Password::reset()` hanya menerima dua
     * argumen, jadi callback url tidak boleh ditulis di sini.
     */
    public function terapkan(string $email, string $token, string $password): string
    {
        $status = Password::reset(
            ['email' => $email, 'token' => $token, 'password' => $password],
            function (User $user, string $sandiBaru): void {
                $user->forceFill([
                    'password' => $sandiBaru,
                    // Kunci ingat-saya di semua perangkat lama ikut dicabut: cookie
                    // "remember me" lama tidak lagi bisa memulihkan sesi.
                    'remember_token' => Str::random(60),
                ])->save();

                // Sesi yang masih hidup di perangkat lain ikut diakhiri
                // (SESSION_DRIVER=database, lihat config/session.php).
                if (config('session.driver') === 'database') {
                    DB::table((string) config('session.table', 'sessions'))
                        ->where('user_id', $user->getKey())
                        ->delete();
                }
            },
        );

        if ($status === Password::PASSWORD_RESET) {
            // Ingat token yang BARU SAJA dipakai (cukup hash-nya — token mentah
            // tidak pernah disimpan). Bila tautan yang sama dibuka lagi, kita bisa
            // bilang dengan jujur "tautan ini sudah pernah dipakai" alih-alih
            // "tidak valid".
            Cache::forget($this->kunciTokenDipakai($email));
            Cache::put($this->kunciTokenDipakai($email), hash('sha256', $token), now()->addDay());

            return 'Kata sandi berhasil diganti. Silakan masuk.';
        }

        // Token salah, kedaluwarsa, ATAU sudah pernah dipakai. Bedakan supaya UI
        // bisa menampilkan halaman "tautan sudah dipakai" alih-alih form yang
        // pasti gagal lagi. Deteksinya hanya menyentuh token yang memang pernah
        // dipakai untuk email ini — token orang lain tidak ikut terdeteksi.
        $dipakai = Cache::get($this->kunciTokenDipakai($email));
        $this->tautanTerpakai = is_string($dipakai) && $dipakai === hash('sha256', $token);

        return 'Tautan tidak valid atau sudah pernah dipakai.';
    }

    /** Tautan terakhir gagal karena tokennya sudah pernah dipakai? */
    public function tautanSudahDipakai(): bool
    {
        return $this->tautanTerpakai;
    }

    private function kunciTokenDipakai(string $email): string
    {
        return 'reset-dipakai:'.hash('sha256', mb_strtolower(trim($email)));
    }
}
