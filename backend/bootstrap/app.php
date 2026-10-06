<?php

declare(strict_types=1);

use App\Http\Middleware\EnsureAccountUsable;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Routing\Exceptions\InvalidSignatureException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Sanctum mode SPA: sesi cookie untuk request dari domain frontend.
        $middleware->statefulApi();

        // Api/* tidak pernah redirect ke rute 'login': tamu mendapat 401 JSON.
        $middleware->redirectGuestsTo(
            fn (Request $request): ?string => $request->is('api/*') || $request->expectsJson()
                ? null
                : config('app.frontend_url').'/masuk',
        );

        // Akun suspended/pending/dihapus ditolak (dipasang SETELAH auth di rute).
        $middleware->alias([
            'akun-aktif' => EnsureAccountUsable::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // Tautan verifikasi dibuka langsung dari email oleh peramban (bukan XHR): tanda
        // tangan rusak/kedaluwarsa harus mendarat di halaman frontend yang ramah, bukan JSON 403.
        $exceptions->render(function (InvalidSignatureException $galat, Request $request) {
            if ($request->routeIs('verification.verify')) {
                return redirect()->away(rtrim((string) config('app.frontend_url'), '/').'/verifikasi-email?status=gagal');
            }

            return null;
        });

        // Rute API selalu merespons JSON 401 bila belum masuk — termasuk permintaan
        // non-JSON (mis. unduhan CSV lewat tautan peramban) yang sebelumnya 500.
        $exceptions->render(function (AuthenticationException $galat, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }

            return null;
        });
    })->create();
