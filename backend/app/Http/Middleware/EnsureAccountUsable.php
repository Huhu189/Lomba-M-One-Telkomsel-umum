<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Akun suspended / pending / dihapus ditolak pada sesi berjalan (chunk security butir 11).
 */
class EnsureAccountUsable
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user !== null) {
            $alasan = $user->alasanAkunDitolak();

            if ($alasan !== null) {
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
