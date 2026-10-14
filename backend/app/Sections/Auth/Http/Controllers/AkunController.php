<?php

declare(strict_types=1);

namespace App\Sections\Auth\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Sections\Auth\Http\Requests\BuatSandiRequest;
use App\Sections\Auth\Http\Requests\GantiSandiRequest;
use App\Sections\Auth\Http\Requests\PerbaruiAkunRequest;
use App\Sections\Auth\Http\Resources\UserResource;
use App\Sections\Auth\Services\AkunService;
use Illuminate\Http\JsonResponse;

/**
 * Setelan akun pengguna yang sedang masuk (halaman /pengaturan).
 *
 * Halaman itu dulu tempat setelan **per ulangan**; sejak 13 Oktober 2026 setelan
 * ulangan disetel di tiap kuis (halaman detail/kelola kuis), dan /pengaturan
 * kembali ke arti namanya: akun. Seluruh aturannya (termasuk penolakan akun siswa
 * tamu, yang tidak punya kata sandi) ada di `AkunService`.
 */
class AkunController extends Controller
{
    /**
     * Ubah nama tampilan sendiri.
     */
    public function perbarui(PerbaruiAkunRequest $request, AkunService $akun): UserResource
    {
        /** @var User $user */
        $user = $request->user();

        return new UserResource($akun->perbaruiNama($user, (string) $request->input('name')));
    }

    /**
     * Buat kata sandi pertama (hanya untuk akun dari tombol Google, yang dibuat
     * server dengan sandi acak — lihat `AkunService::setelSandiPertama`).
     *
     * Halaman `/buat-sandi` memakainya: satu langkah sekali seumur akun, supaya
     * sesudahnya murid tidak pernah ditanya kata sandi lagi selama sesinya hidup.
     */
    public function buatSandiPertama(BuatSandiRequest $request, AkunService $akun): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $akun->setelSandiPertama(
            $user,
            (string) $request->input('password'),
            $request->hasSession() ? $request->session()->getId() : null,
        );

        return response()->json([
            'message' => 'Kata sandimu tersimpan. Sekarang akunmu bisa dipakai di perangkat lain juga.',
            'user' => new UserResource($user->refresh()),
        ]);
    }

    /**
     * Ganti kata sandi sendiri (wajib menyertakan sandi sekarang).
     */
    public function gantiSandi(GantiSandiRequest $request, AkunService $akun): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $akun->gantiSandi(
            $user,
            (string) $request->input('sandi_sekarang'),
            (string) $request->input('password'),
            // Sesi yang sedang dipakai disebut supaya ia TIDAK ikut diakhiri:
            // murid yang baru mengganti sandinya tidak boleh terlempar keluar.
            $request->hasSession() ? $request->session()->getId() : null,
        );

        return response()->json([
            'message' => 'Kata sandi diganti. Sesi di perangkat lain yang memakai akun ini sudah diakhiri.',
            'user' => new UserResource($user->refresh()),
        ]);
    }
}
