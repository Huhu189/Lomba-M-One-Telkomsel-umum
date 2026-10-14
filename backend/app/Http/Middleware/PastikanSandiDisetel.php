<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Lapisan "buat kata sandi dulu" untuk akun yang dibuat lewat Google.
 *
 * Akun dari Google dibuat dengan kata sandi acak milik server, jadi ia belum
 * punya sandi sendiri. Selama itu:
 *
 * - halaman tetap aman kalau klien memaksa membuka alamat lain (murid tidak
 *   bisa melewati lapisan ini dengan mengetik URL-nya sendiri);
 * - hanya rute di daftar putih yang boleh lewat — lihat akun sendiri, keluar,
 *   dan **membuat kata sandi**. Semua rute lain ditolak 403 dengan pesan yang
 *   menjelaskan langkah berikutnya.
 *
 * Alasannya bukan sekadar kerapian: kata sandi adalah satu-satunya cara murid
 * masuk lagi bila ia kehilangan akses ke akun Google-nya (ganti perangkat,
 * akun Google dinonaktifkan sekolah karena kebijakan akun anak). Kalau lapisan
 * ini bisa dilewati, akun tanpa sandi bisa terkunci permanen di luar jangkauan.
 */
class PastikanSandiDisetel
{
    /**
     * Rute yang tetap boleh dibuka sebelum kata sandi dibuat.
     *
     * @var array<int, string>
     */
    private const RUTE_TERBUKA = [
        'auth.saya',
        'auth.keluar',
        'akun.sandi-pertama',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        /** @var User|null $user */
        $user = $request->user();

        if ($user === null || ! $user->perluBuatSandi()) {
            return $next($request);
        }

        $namaRute = $request->route()?->getName();

        if (in_array($namaRute, self::RUTE_TERBUKA, true)) {
            return $next($request);
        }

        return response()->json([
            'message' => 'Buat kata sandimu dulu sekali ini ya, supaya akunmu bisa dipakai di perangkat lain.',
            'perlu_buat_sandi' => true,
        ], 403);
    }
}
