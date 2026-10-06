<?php

declare(strict_types=1);

namespace App\Sections\Auth\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Sections\Auth\Enums\UserStatus;
use App\Sections\Auth\Http\Requests\DaftarMuridRequest;
use App\Sections\Auth\Http\Requests\MasukRequest;
use App\Sections\Auth\Http\Resources\UserResource;
use App\Sections\Auth\Services\LoginService;
use App\Sections\Auth\Services\RegisterService;
use App\Sections\Auth\Services\VerifyEmailService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    /**
     * Daftar murid (role dari server = murid; guru/admin tidak bisa self-register) dan
     * LANGSUNG masuk supaya murid tidak perlu mengetik ulang kata sandi. Akun masih
     * pending, jadi hanya halaman verifikasi yang bisa dibuka sampai email diverifikasi.
     */
    public function daftar(DaftarMuridRequest $request, RegisterService $register, LoginService $login): JsonResponse
    {
        $hasil = $register->daftarMurid($request->validated());
        $login->masukOtomatis($hasil['user']);

        return response()->json([
            'message' => $register->pesanResponsDaftar(),
            'user' => new UserResource($hasil['user']),
            'perlu_verifikasi' => ! $hasil['user']->hasVerifiedEmail(),
            'email_terkirim' => $hasil['email_terkirim'],
        ], 201);
    }

    /**
     * Login sesi (cookie SPA).
     */
    public function masuk(MasukRequest $request, LoginService $login): JsonResponse
    {
        $user = $login->masuk(
            (string) $request->input('email'),
            (string) $request->input('password'),
            (bool) $request->boolean('ingat'),
        );

        return response()->json([
            'message' => 'Berhasil masuk.',
            'user' => new UserResource($user),
        ]);
    }

    /**
     * Keluar + hancurkan sesi.
     */
    public function keluar(Request $request, LoginService $login): JsonResponse
    {
        $login->keluar();

        return response()->json(['message' => 'Berhasil keluar.']);
    }

    /**
     * Data user yang sedang masuk (untuk TanStack Query frontend).
     */
    public function saya(Request $request): UserResource
    {
        /** @var User $user */
        $user = $request->user();

        return new UserResource($user);
    }

    /**
     * Kirim ulang tautan verifikasi untuk akun yang sedang masuk (pending).
     */
    public function kirimUlangVerifikasi(Request $request, VerifyEmailService $verifikasi): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $terkirim = $verifikasi->kirimUlang($user);

        return response()->json([
            'message' => $terkirim
                ? 'Tautan verifikasi dikirim (jika email belum terverifikasi).'
                : 'Tautan belum bisa dikirim sekarang. Coba lagi sebentar lagi.',
            'email_terkirim' => $terkirim,
        ]);
    }

    /**
     * Kirim ulang tautan verifikasi TANPA sesi (untuk akun pending yang belum bisa masuk).
     * Respons selalu sama persis walau email tidak terdaftar / sudah terverifikasi (anti-enumerasi).
     */
    public function kirimUlangVerifikasiPublik(Request $request, VerifyEmailService $verifikasi): JsonResponse
    {
        $email = mb_strtolower(trim((string) $request->input('email')));

        $user = $email === '' ? null : User::query()->where('email', $email)->first();

        // Pending (belum verifikasi) justru yang boleh kirim ulang; suspend/dihapus tidak.
        $bolehKirim = $user !== null
            && ! in_array($user->status, [UserStatus::Suspended, UserStatus::Dihapus], true);

        if ($bolehKirim) {
            $verifikasi->kirimUlang($user);
        }

        return response()->json(['message' => 'Tautan verifikasi dikirim (jika email belum terverifikasi).']);
    }
}
