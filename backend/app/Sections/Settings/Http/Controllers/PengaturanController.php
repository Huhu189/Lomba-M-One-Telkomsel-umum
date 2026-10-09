<?php

declare(strict_types=1);

namespace App\Sections\Settings\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\School\Services\SekolahService;
use App\Sections\Settings\Enums\KunciPengaturan;
use App\Sections\Settings\Enums\LingkupPengaturan;
use App\Sections\Settings\Http\Requests\SimpanPengaturanRequest;
use App\Sections\Settings\Models\Pengaturan;
use App\Sections\Settings\Services\PengaturanService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PengaturanController extends Controller
{
    /**
     * Aturan yang berlaku di sekolah/kelas/kuis.
     *
     * Hanya guru/admin (K-05): murid tidak lagi bisa memetakan proteksi mana
     * yang aktif lewat `GET /pengaturan?kuis_id=`. Saklar anti-cheat yang
     * mengikatnya dikirim lewat payload attempt, satu per satu sesuai saklar
     * efektif kuisnya — tanpa daftar lengkap "apa yang dipasang guru".
     */
    public function index(
        Request $request,
        SekolahService $sekolah,
        PengaturanService $service,
    ): JsonResponse {
        $this->authorize('viewAny', Pengaturan::class);

        return response()->json($service->semua(
            $sekolah->tunggal()->id,
            $request->integer('kelas_id') ?: null,
            $request->integer('kuis_id') ?: null,
        ));
    }

    public function perbarui(
        SimpanPengaturanRequest $request,
        SekolahService $sekolah,
        PengaturanService $service,
    ): JsonResponse {
        $data = $request->validated();
        $lingkup = LingkupPengaturan::from((string) $data['lingkup']);
        $kunci = KunciPengaturan::from((string) $data['kunci']);
        $sekolahId = $sekolah->tunggal()->id;

        $lingkupId = $lingkup === LingkupPengaturan::Sekolah
            ? $sekolahId
            : (int) $data['lingkup_id'];

        // Lingkup kuis diperiksa kepemilikannya (S-05): saklar anti-cheat satu
        // kuis bukan milik semua guru.
        $this->authorize('update', [Pengaturan::class, $lingkup, $lingkupId]);

        $nilai = $kunci->tipe() === 'integer' ? (int) $data['nilai'] : (bool) $data['nilai'];

        $service->simpan($lingkup, $lingkupId, $kunci, $nilai, (bool) ($data['terkunci'] ?? false));

        return response()->json($service->semua(
            $sekolahId,
            $request->integer('kelas_id') ?: null,
            $request->integer('kuis_id') ?: null,
        ));
    }
}
