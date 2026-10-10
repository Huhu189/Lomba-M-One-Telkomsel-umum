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
     *
     * Bila tautan sudah pernah dipakai, respons tetap 200 (pesan dan skema tidak
     * berubah) tetapi diberi penanda `tautan_dipakai: true` supaya UI bisa
     * menampilkan halaman "tautan sudah dipakai" alih-alih form yang pasti gagal
     * lagi. Pesan galatnya tetap sengaja sama untuk token salah maupun terpakai
     * (tidak ada informasi keamanan yang bocor).
     */
    public function aturUlang(AturUlangSandiRequest $request, PasswordResetService $reset): JsonResponse
    {
        $pesan = $reset->terapkan(
            (string) $request->input('email'),
            (string) $request->input('token'),
            (string) $request->input('password'),
        );

        return response()->json([
            'message' => $pesan,
            'tautan_dipakai' => $reset->tautanSudahDipakai(),
            // Penanda jujur apakah kata sandi benar-benar berubah: token salah atau
            // kedaluwarsa tetap dijawab 200 (skema & pesan seragam), tetapi UI
            // tidak boleh menampilkan "kata sandi sudah diganti".
            'berhasil' => $reset->berhasil(),
        ]);
    }
}
