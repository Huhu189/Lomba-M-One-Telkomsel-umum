<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Sections\Auth\Enums\UserStatus;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Akun suspended / pending / dihapus ditolak pada sesi berjalan (chunk security butir 11).
 *
 * Pengecualian: murid yang BARU DAFTAR sekarang langsung masuk (auto-login), jadi
 * akun pending boleh membuka jalur verifikasi saja (lihat akun, kirim ulang
 * tautan, keluar) — semua endpoint lain tetap ditolak dan sesinya dihancurkan.
 */
class EnsureAccountUsable
{
    /**
     * Nama rute yang tetap boleh dibuka akun pending (belum verifikasi email).
     *
     * @var array<int, string>
     */
    private const RUTE_VERIFIKASI = [
        'auth.saya',
        'auth.kirim-ulang-verifikasi',
        'auth.keluar',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user !== null) {
            $alasan = $user->alasanAkunDitolak();

            if ($alasan !== null) {
                $hanyaBelumVerifikasi = $user->status === UserStatus::Pending;
                $namaRute = $request->route()?->getName();

                if ($hanyaBelumVerifikasi && in_array($namaRute, self::RUTE_VERIFIKASI, true)) {
                    return $next($request);
                }

                auth('web')->logout();

                // Request API non-stateful tidak membawa sesi; hancurkan sesi hanya bila ada.
                if ($request->hasSession()) {
                    $request->session()->invalidate();
                    $request->session()->regenerateToken();
                }

                return response()->json(['message' => $alasan], 403);
            }
        }

        return $next($request);
    }
}
