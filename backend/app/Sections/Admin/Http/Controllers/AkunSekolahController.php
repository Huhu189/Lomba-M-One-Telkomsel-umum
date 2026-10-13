<?php

declare(strict_types=1);

namespace App\Sections\Admin\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Sections\Admin\Http\Requests\MintaTokenAkunRequest;
use App\Sections\Admin\Http\Requests\SetelSandiAkunRequest;
use App\Sections\Admin\Http\Requests\UbahEmailAkunRequest;
use App\Sections\Admin\Http\Requests\UbahStatusAkunRequest;
use App\Sections\Admin\Http\Resources\AkunSekolahResource;
use App\Sections\Admin\Services\AkunSekolahService;
use App\Sections\Auth\Enums\UserStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Kelola akun guru & murid oleh admin sekolah.
 *
 * Alurnya dua langkah seperti koreksi nilai: minta token konfirmasi (berisi
 * alasan), lalu pakai token untuk menyimpan perubahan. Sebelum keduanya, Policy
 * memeriksa sasaran (anti-IDOR): admin tidak bisa menyentuh dirinya sendiri atau
 * akun admin lain, dan guru/murid yang tidak dikenal ditolak.
 */
class AkunSekolahController extends Controller
{
    /**
     * Daftar akun guru & murid sekolah, berpaginasi + saringan.
     *
     * Akun admin sengaja tidak muncul di sini: panel ini untuk mengelola akun
     * yang diajar, dan mengubah kredensial sesama admin bukan pengelolaan
     * sekolah (lihat AkunSekolahPolicy).
     */
    public function index(Request $request, AkunSekolahService $service): AnonymousResourceCollection
    {
        $this->authorize('lihat', User::class);

        return AkunSekolahResource::collection($service->daftar(
            max(1, min(200, $request->integer('per_page', 50))),
            max(1, $request->integer('page', 1)),
        ));
    }

    /**
     * Terbitkan token konfirmasi sekali pakai untuk satu akun sasaran.
     */
    public function token(MintaTokenAkunRequest $request, User $akun, AkunSekolahService $service): JsonResponse
    {
        $this->authorize('kelola', $akun);

        $admin = $request->user();

        if ($admin === null) {
            abort(401, 'Sesi tidak ditemukan.');
        }

        return response()->json($service->mintaToken(
            $admin,
            $akun,
            (string) $request->input('alasan'),
            $request->ip(),
        ));
    }

    /**
     * Ubah email akun guru/murid (butuh token).
     */
    public function ubahEmail(UbahEmailAkunRequest $request, User $akun, AkunSekolahService $service): JsonResponse
    {
        $this->authorize('kelola', $akun);

        $admin = $request->user();

        if ($admin === null) {
            abort(401, 'Sesi tidak ditemukan.');
        }

        $segar = $service->ubahEmail(
            $admin,
            $akun,
            (string) $request->input('email'),
            (string) $request->input('alasan'),
            (string) $request->input('token'),
        );

        return response()->json([
            'message' => 'Email akun diperbarui dan tercatat di audit. Beri tahu pemilik akun email barunya.',
            'akun' => new AkunSekolahResource($segar->loadMissing(['murid.kelas'])),
        ]);
    }

    /**
     * Setel ulang kata sandi akun guru/murid (butuh token).
     *
     * Sandi baru TIDAK pernah dikembalikan di respons — admin yang mengetiknya,
     * jadi ia yang menyampaikannya ke murid/guru; respons hanya memastikan
     * perubahan berhasil.
     */
    public function setelSandi(SetelSandiAkunRequest $request, User $akun, AkunSekolahService $service): JsonResponse
    {
        $this->authorize('kelola', $akun);

        $admin = $request->user();

        if ($admin === null) {
            abort(401, 'Sesi tidak ditemukan.');
        }

        $segar = $service->setelSandi(
            $admin,
            $akun,
            (string) $request->input('password'),
            (string) $request->input('alasan'),
            (string) $request->input('token'),
        );

        return response()->json([
            'message' => 'Kata sandi disetel ulang. Sesi akun itu di perangkat lain sudah diakhiri; sampaikan sandi baru langsung ke pemiliknya.',
            'akun' => new AkunSekolahResource($segar->loadMissing(['murid.kelas'])),
        ]);
    }

    /**
     * Aktifkan atau tangguhkan akun guru/murid (butuh token).
     */
    public function ubahStatus(UbahStatusAkunRequest $request, User $akun, AkunSekolahService $service): JsonResponse
    {
        $this->authorize('kelola', $akun);

        $admin = $request->user();

        if ($admin === null) {
            abort(401, 'Sesi tidak ditemukan.');
        }

        $status = UserStatus::from((string) $request->input('status'));

        $segar = $service->ubahStatus(
            $admin,
            $akun,
            $status,
            (string) $request->input('alasan'),
            (string) $request->input('token'),
        );

        return response()->json([
            'message' => $status === UserStatus::Suspended
                ? 'Akun ditangguhkan dan sesinya diakhiri.'
                : 'Akun diaktifkan kembali.',
            'akun' => new AkunSekolahResource($segar->loadMissing(['murid.kelas'])),
        ]);
    }
}
