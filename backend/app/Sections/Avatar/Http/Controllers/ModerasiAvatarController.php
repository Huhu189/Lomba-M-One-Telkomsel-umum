<?php

declare(strict_types=1);

namespace App\Sections\Avatar\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Avatar\Http\Requests\ModerasiAvatarRequest;
use App\Sections\Avatar\Http\Resources\AvatarResource;
use App\Sections\Avatar\Models\Avatar;
use App\Sections\Avatar\Services\ModerasiAvatarService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Antrean tinjau avatar untuk guru.
 *
 * Sinyal dari teman sekelas diperlakukan seperti sinyal lain di aplikasi ini:
 * **bahan tinjauan, bukan vonis**. Karena itu tidak ada satu pun endpoint di
 * sini yang menghapus avatar tanpa keputusan guru, dan tiap keputusan masuk
 * audit (`activity_log`).
 */
class ModerasiAvatarController extends Controller
{
    /** Avatar yang disembunyikan karena laporan, menunggu keputusan guru. */
    public function antrean(ModerasiAvatarService $moderasi): AnonymousResourceCollection
    {
        $this->authorize('moderasi', Avatar::class);

        return AvatarResource::collection($moderasi->antrean());
    }

    /** Pulihkan avatar: kembali tampil, laporan yang menunggu jadi tidak valid. */
    public function pulihkan(
        ModerasiAvatarRequest $request,
        Avatar $avatar,
        ModerasiAvatarService $moderasi,
    ): AvatarResource {
        $this->authorize('moderasi', Avatar::class);

        $pengguna = $request->user();

        if ($pengguna === null) {
            abort(401, 'Sesi tidak ditemukan.');
        }

        $catatan = $request->validated('catatan');
        $baru = $moderasi->pulihkan($avatar, $pengguna, is_string($catatan) ? $catatan : null);

        return new AvatarResource($baru->load(['murid.user', 'murid.kelas', 'laporan.pelapor.user']));
    }

    /** Hapus avatar (tindakan moderasi terakhir): berkas dibuang, audit dicatat. */
    public function hapus(
        ModerasiAvatarRequest $request,
        Avatar $avatar,
        ModerasiAvatarService $moderasi,
    ): JsonResponse {
        $this->authorize('delete', $avatar);

        $pengguna = $request->user();

        if ($pengguna === null) {
            abort(401, 'Sesi tidak ditemukan.');
        }

        $catatan = $request->validated('catatan');
        $moderasi->hapus($avatar, $pengguna, is_string($catatan) ? $catatan : null);

        return response()->json(['message' => 'Avatar dihapus dan tercatat di audit.']);
    }
}
