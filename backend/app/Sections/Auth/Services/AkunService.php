<?php

declare(strict_types=1);

namespace App\Sections\Auth\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Setelan akun milik pengguna yang sedang masuk (nama + kata sandi).
 *
 * Seluruh aplikasi memakai sesi kunci-satu-guard, jadi jalur ini **tidak bisa
 * dipakai menebak sandi orang lain**: pengguna hanya menyentuh akunnya sendiri
 * dari sesinya, dan sandi lama wajib dibuktikan sebelum sandi baru disimpan.
 *
 * Email sengaja TIDAK bisa diubah di sini — email adalah alamat verifikasi dan
 * pemulihan akun, jadi mengubahnya butuh alur verifikasi ulang tersendiri
 * (belum ada). Alih-alih membuat jalan pintas, `AkunService` menolaknya.
 */
class AkunService
{
    /** Nama tampilan: dipakai di kepala aplikasi, laporan, dan daftar nilai. */
    public function perbaruiNama(User $user, string $nama): User
    {
        $this->pastikanPunyaAkun($user);

        $user->forceFill(['name' => trim($nama)])->save();

        return $user->refresh();
    }

    /**
     * Ganti kata sandi sendiri: sandi lama wajib benar (bukti pemilik akun).
     *
     * Sekali berhasil:
     * - `remember_token` diacak ulang, sehingga cookie "ingat saya" lama di
     *   perangkat lain tidak lagi bisa memulihkan sesi;
     * - sesi lain milik akun yang sama diakhiri (hanya bila driver sesi memang
     *   `database`), sedangkan sesi yang sedang dipakai dibiarkan hidup — kalau
     *   ikut dihapus, murid yang baru mengganti sandinya justru terlempar keluar.
     *
     * @throws ValidationException
     */
    public function gantiSandi(User $user, string $sandiSekarang, string $sandiBaru, ?string $sesiSekarang = null): User
    {
        $this->pastikanPunyaAkun($user);

        if (! Hash::check($sandiSekarang, (string) $user->password)) {
            throw ValidationException::withMessages([
                'sandi_sekarang' => 'Kata sandi sekarang tidak cocok.',
            ]);
        }

        $user->forceFill([
            'password' => $sandiBaru,
            'remember_token' => Str::random(60),
        ])->save();

        $this->akhiriSesiLain($user, $sesiSekarang);

        return $user;
    }

    /**
     * Akun siswa tamu masuk lewat kode perangkat dan tidak punya kata sandi, jadi
     * tidak ada setelan akun yang bisa diubahnya — lebih baik ditolak dengan jelas
     * daripada menyimpan kata sandi yang tidak pernah dipakai untuk masuk.
     *
     * @throws ValidationException
     */
    private function pastikanPunyaAkun(User $user): void
    {
        if (! $user->isTamu()) {
            return;
        }

        throw ValidationException::withMessages([
            'akun' => 'Akun siswa tamu tidak punya setelan akun. Daftar dulu supaya punya akun sendiri.',
        ]);
    }

    /**
     * Akhiri sesi lain milik akun ini, kecuali sesi yang sedang dipakai.
     *
     * Driver sesi non-database tidak punya tabel untuk diperiksa, jadi dilewati
     * (pola yang sama dipakai `PasswordResetService`).
     */
    private function akhiriSesiLain(User $user, ?string $sesiSekarang): void
    {
        if (config('session.driver') !== 'database') {
            return;
        }

        $kueri = DB::table((string) config('session.table', 'sessions'))
            ->where('user_id', $user->getKey());

        if ($sesiSekarang !== null && $sesiSekarang !== '') {
            $kueri->where('id', '!=', $sesiSekarang);
        }

        $kueri->delete();
    }
}
