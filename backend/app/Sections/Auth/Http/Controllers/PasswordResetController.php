<?php

declare(strict_types=1);

namespace App\Sections\Auth\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Auth\Http\Requests\AturUlangSandiRequest;
use App\Sections\Auth\Http\Requests\LupaSandiRequest;
use App\Sections\Auth\Services\PasswordResetService;
use Illuminate\Http\JsonResponse;

class PasswordResetController extends Controller
{
    /**
     * Minta tautan reset (anti-enumerasi: respons identik untuk email apa pun).
     */
    public function lupa(LupaSandiRequest $request, PasswordResetService $reset): JsonResponse
    {
        return response()->json([
            'message' => $reset->kirimTautan((string) $request->input('email')),
        ]);
    }

    /**
     * Terapkan kata sandi baru dengan token sekali pakai.
     */
    public function aturUlang(AturUlangSandiRequest $request, PasswordResetService $reset): JsonResponse
    {
        return response()->json([
            'message' => $reset->terapkan(
                (string) $request->input('email'),
                (string) $request->input('token'),
                (string) $request->input('password'),
            ),
        ]);
    }
}
