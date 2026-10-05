<?php

declare(strict_types=1);

namespace App\Sections\Auth\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Sections\Auth\Services\VerifyEmailService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class VerifyEmailController extends Controller
{
    /**
     * Konsumsi tautan verifikasi bertanda tangan dari email,
     * lalu alihkan ke frontend (hanya ke FRONTEND_URL — whitelist redirect).
     */
    public function __invoke(Request $request, int $id, string $hash, VerifyEmailService $verifikasi): RedirectResponse
    {
        $frontend = rtrim((string) config('app.frontend_url'), '/');

        $user = User::query()->find($id);
        if ($user === null || ! hash_equals(sha1(mb_strtolower($user->getEmailForVerification())), $hash)) {
            return redirect()->away($frontend.'/verifikasi-email?status=gagal');
        }

        $verifikasi->verifikasi($user);

        return redirect()->away($frontend.'/verifikasi-email?status=berhasil');
    }
}
