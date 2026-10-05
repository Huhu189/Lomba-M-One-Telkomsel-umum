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
        $this->authorize('update', Pengaturan::class);

        $data = $request->validated();
        $lingkup = LingkupPengaturan::from((string) $data['lingkup']);
        $kunci = KunciPengaturan::from((string) $data['kunci']);
        $sekolahId = $sekolah->tunggal()->id;

        $lingkupId = $lingkup === LingkupPengaturan::Sekolah
            ? $sekolahId
            : (int) $data['lingkup_id'];

        $nilai = $kunci->tipe() === 'integer' ? (int) $data['nilai'] : (bool) $data['nilai'];

        $service->simpan($lingkup, $lingkupId, $kunci, $nilai, (bool) ($data['terkunci'] ?? false));

        return response()->json($service->semua(
            $sekolahId,
            $request->integer('kelas_id') ?: null,
            $request->integer('kuis_id') ?: null,
        ));
    }
}
