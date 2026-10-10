<?php

declare(strict_types=1);

namespace App\Sections\School\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\School\Http\Requests\ImporMuridRequest;
use App\Sections\School\Http\Requests\SimpanMuridRequest;
use App\Sections\School\Http\Resources\MuridResource;
use App\Sections\School\Models\Murid;
use App\Sections\School\Services\EksporMuridService;
use App\Sections\School\Services\ImporMuridService;
use App\Sections\School\Services\MuridService;
use App\Sections\School\Services\SekolahService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MuridController extends Controller
{
    public function index(Request $request, SekolahService $sekolah): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Murid::class);

        // P-01: satu sekolah bisa punya ribuan murid; daftar dibatasi per halaman
        // supaya payload dan memori tidak tumbuh mengikuti jumlah murid. Batas
        // atas 200 menjaga `?per_page=1000` tidak mengembalikan semuanya lagi.
        $perHalaman = max(1, min(200, $request->integer('per_page', 50)));

        $daftar = QueryBuilder::for(Murid::class)
            ->where('school_id', $sekolah->tunggal()->id)
            ->allowedFilters(AllowedFilter::exact('class_id'))
            ->allowedSorts('nis')
            ->defaultSort('nis')
            ->with(['user', 'kelas'])
            ->paginate(perPage: $perHalaman, page: max(1, $request->integer('page', 1)));

        return MuridResource::collection($daftar);
    }

    public function store(SimpanMuridRequest $request, SekolahService $sekolah, MuridService $service): JsonResponse
    {
        $this->authorize('create', Murid::class);

        $murid = $service->tambah($sekolah->tunggal()->id, $request->validated());

        return (new MuridResource($murid))->response()->setStatusCode(201);
    }

    public function update(SimpanMuridRequest $request, Murid $murid, MuridService $service): MuridResource
    {
        $this->authorize('update', $murid);

        return new MuridResource($service->ubah($murid, $request->validated()));
    }

    public function destroy(Murid $murid, MuridService $service): JsonResponse
    {
        $this->authorize('delete', $murid);

        $service->hapus($murid);

        return response()->json(['message' => 'Murid dihapus.']);
    }

    public function impor(
        ImporMuridRequest $request,
        SekolahService $sekolah,
        ImporMuridService $impor,
    ): JsonResponse {
        $this->authorize('create', Murid::class);

        $berkas = $request->file('file');

        $laporan = $impor->impor(
            (string) $berkas?->getRealPath(),
            $sekolah->tunggal()->id,
        );

        return response()->json([
            'message' => $laporan['sukses'].' murid berhasil diimpor, '.$laporan['gagal'].' baris gagal.',
            'laporan' => $laporan,
        ]);
    }

    public function ekspor(Request $request, SekolahService $sekolah, EksporMuridService $ekspor): StreamedResponse
    {
        $this->authorize('viewAny', Murid::class);

        // `?delimiter=;` untuk Excel berbahasa Indonesia (Q-16).
        return $ekspor->ekspor($sekolah->tunggal()->id, (string) $request->query('delimiter', ','));
    }
}
