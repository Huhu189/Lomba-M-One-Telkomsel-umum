<?php

declare(strict_types=1);

namespace App\Sections\School\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\School\Http\Requests\SimpanKelasRequest;
use App\Sections\School\Http\Resources\KelasResource;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Services\SekolahService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class KelasController extends Controller
{
    public function index(SekolahService $sekolah): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Kelas::class);

        $daftar = QueryBuilder::for(Kelas::class)
            ->where('school_id', $sekolah->tunggal()->id)
            ->allowedFilters(AllowedFilter::exact('tingkat'))
            ->allowedSorts('nama', 'tingkat')
            ->defaultSort('tingkat')
            ->withCount('murid')
            ->get();

        return KelasResource::collection($daftar);
    }

    public function store(SimpanKelasRequest $request, SekolahService $sekolah): JsonResponse
    {
        $this->authorize('create', Kelas::class);

        $kelas = Kelas::query()->create([
            ...$request->validated(),
            'school_id' => $sekolah->tunggal()->id,
        ]);

        return (new KelasResource($kelas))->response()->setStatusCode(201);
    }

    public function update(SimpanKelasRequest $request, Kelas $kelas): KelasResource
    {
        $this->authorize('update', $kelas);

        $kelas->fill($request->validated())->save();

        return new KelasResource($kelas->refresh());
    }

    public function destroy(Kelas $kelas): JsonResponse
    {
        $this->authorize('delete', $kelas);

        $kelas->delete();

        return response()->json(['message' => 'Kelas dihapus.']);
    }
}
