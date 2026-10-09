<?php

declare(strict_types=1);

namespace App\Sections\Quiz\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Quiz\Enums\StatusKuis;
use App\Sections\Quiz\Http\Requests\SimpanKuisRequest;
use App\Sections\Quiz\Http\Requests\SinkronSoalKuisRequest;
use App\Sections\Quiz\Http\Resources\KuisMuridResource;
use App\Sections\Quiz\Http\Resources\KuisResource;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\Quiz\Services\KuisService;
use App\Sections\School\Services\SekolahService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class KuisController extends Controller
{
    /**
     * Guru melihat semua kuis sekolah; murid hanya kuis terbit kelasnya.
     */
    public function index(Request $request, SekolahService $sekolah): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Kuis::class);

        $pengguna = $request->user();
        $kolom = ['mapel', 'kelas'];

        if ($pengguna !== null && $pengguna->isGuru()) {
            $daftar = Kuis::query()
                ->where('school_id', $sekolah->tunggal()->id)
                // Daftar guru disaring seperti batas bacanya (K-04): kuis yang
                // tidak boleh dibuka jangan muncul sebagai tautan mati. Admin
                // tetap melihat seluruh kuis sekolah.
                ->when(
                    ! $pengguna->hasRole('admin'),
                    fn ($query) => $query->where('dibuat_oleh', $pengguna->getKey()),
                )
                ->with($kolom)
                ->withCount('soal')
                ->orderByDesc('created_at')
                ->get();

            return KuisResource::collection($daftar);
        }

        $kelasId = $pengguna?->murid?->class_id;

        $daftar = Kuis::query()
            ->when(
                $kelasId !== null,
                fn ($query) => $query->where('class_id', $kelasId),
                fn ($query) => $query->whereRaw('1 = 0'),
            )
            ->where('status', StatusKuis::Publikasi->value)
            ->with($kolom)
            ->withCount('soal')
            ->orderBy('mulai_at')
            ->get();

        return KuisMuridResource::collection($daftar);
    }

    public function store(SimpanKuisRequest $request, SekolahService $sekolah, KuisService $service): JsonResponse
    {
        $this->authorize('create', Kuis::class);

        $kuis = $service->simpan($sekolah->tunggal(), $request->user(), $request->validated());

        return (new KuisResource($kuis->load(['mapel', 'kelas'])->loadCount('soal')))
            ->response()->setStatusCode(201);
    }

    /**
     * Guru melihat susunan soal lengkap; murid hanya soal tanpa kunci.
     */
    public function show(Request $request, Kuis $kuis): KuisResource|KuisMuridResource
    {
        $this->authorize('view', $kuis);

        $pengguna = $request->user();

        if ($pengguna !== null && $pengguna->isGuru()) {
            $kuis->load(['mapel', 'kelas', 'soal.mapel', 'soal.tag'])->loadCount('soal');

            return new KuisResource($kuis);
        }

        // Murid hanya menerima metadata: daftar soal TIDAK ikut (K-02). Soal
        // keluar lewat attempt yang sudah dimulai, memakai snapshot + urutan
        // hasil pengacakan server.
        $kuis->load(['mapel', 'kelas'])->loadCount('soal');

        return new KuisMuridResource($kuis);
    }

    public function update(SimpanKuisRequest $request, Kuis $kuis, KuisService $service): KuisResource
    {
        $this->authorize('update', $kuis);

        $kuis = $service->perbarui($kuis, $request->validated());

        return new KuisResource($kuis->load(['mapel', 'kelas'])->loadCount('soal'));
    }

    public function destroy(Kuis $kuis, KuisService $service): JsonResponse
    {
        $this->authorize('delete', $kuis);

        $service->hapus($kuis);

        return response()->json(['message' => 'Kuis dihapus.']);
    }

    public function sinkronSoal(SinkronSoalKuisRequest $request, Kuis $kuis, KuisService $service): KuisResource
    {
        $this->authorize('update', $kuis);

        /** @var array<int, int> $soal */
        $soal = array_map('intval', (array) $request->validated('soal'));

        $kuis = $service->sinkronSoal($kuis, $soal);

        return new KuisResource($kuis->load(['mapel', 'kelas', 'soal.mapel', 'soal.tag'])->loadCount('soal'));
    }

    public function publikasi(Kuis $kuis, KuisService $service): KuisResource
    {
        $this->authorize('publikasi', $kuis);

        $kuis = $service->publikasi($kuis);

        return new KuisResource($kuis->load(['mapel', 'kelas'])->loadCount('soal'));
    }

    public function arsipkan(Kuis $kuis, KuisService $service): KuisResource
    {
        $this->authorize('update', $kuis);

        $kuis = $service->arsipkan($kuis);

        return new KuisResource($kuis->load(['mapel', 'kelas'])->loadCount('soal'));
    }
}
