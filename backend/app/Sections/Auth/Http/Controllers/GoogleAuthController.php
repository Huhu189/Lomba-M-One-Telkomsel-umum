<?php

declare(strict_types=1);

namespace App\Sections\Auth\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Auth\Http\Requests\MasukGoogleRequest;
use App\Sections\Auth\Http\Resources\UserResource;
use App\Sections\Auth\Services\GoogleAuthService;
use Illuminate\Http\JsonResponse;

/**
 * Masuk & daftar lewat Google (14 Oktober 2026).
 *
 * Satu endpoint untuk dua hal: murid yang belum punya akun langsung dibuatkan
 * akun murid saat menekan tombol Google, sedangkan murid/guru yang emailnya
 * sudah terdaftar ditautkan ke akun itu dan langsung masuk (lihat
 * `GoogleAuthService`).
 */
class GoogleAuthController extends Controller
{
    /**
     * Info tombol Google (publik, tanpa sesi): apakah sekolah ini menyalakannya
     * dan id klien mana yang harus dipakai peramban.
     *
     * Halaman masuk memakainya untuk memutuskan menampilkan tombol atau tidak —
     * tanpa konfigurasi, tombol yang pasti gagal tidak pernah muncul.
     */
    public function info(GoogleAuthService $google): JsonResponse
    {
        return response()->json([
            'aktif' => $google->aktif(),
            // Id klien bukan rahasia (memang dikirim peramban); rahasia klien
            // milik server tidak pernah ikut ke sini.
            'client_id' => $google->clientId(),
        ]);
    }

    /**
     * Masuk/daftar dengan ID token Google.
     */
    public function masuk(MasukGoogleRequest $request, GoogleAuthService $google): JsonResponse
    {
        $hasil = $google->masukLewatGoogle((string) $request->input('credential'));

        return response()->json([
            'message' => $hasil['baru']
                ? 'Akun dibuat dari Google. Buat kata sandimu sekali ini saja ya.'
                : 'Berhasil masuk dengan Google.',
            'user' => new UserResource($hasil['user']),
            // Klien memakai penanda ini untuk membedakan sapaan akun lama dan
            // akun baru (mis. mengarahkan ke pembuatan kata sandi lebih dulu).
            'baru' => $hasil['baru'],
        ]);
    }
}
