<?php

declare(strict_types=1);

namespace App\Sections\School\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\School\Http\Requests\SimpanMapelRequest;
use App\Sections\School\Http\Resources\MapelResource;
use App\Sections\School\Models\Mapel;
use App\Sections\School\Services\SekolahService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Spatie\QueryBuilder\QueryBuilder;

class MapelController extends Controller
{
    public function index(SekolahService $sekolah): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Mapel::class);

        $daftar = QueryBuilder::for(Mapel::class)
            ->where('school_id', $sekolah->tunggal()->id)
            ->allowedSorts('nama')
            ->defaultSort('nama')
            ->get();

        return MapelResource::collection($daftar);
    }

    public function store(SimpanMapelRequest $request, SekolahService $sekolah): JsonResponse
    {
        $this->authorize('create', Mapel::class);

        $mapel = Mapel::query()->create([
            ...$request->validated(),
            'school_id' => $sekolah->tunggal()->id,
        ]);

        return (new MapelResource($mapel))->response()->setStatusCode(201);
    }

    public function update(SimpanMapelRequest $request, Mapel $mapel): MapelResource
    {
        $this->authorize('update', $mapel);

        $mapel->fill($request->validated())->save();

        return new MapelResource($mapel->refresh());
    }

    public function destroy(Mapel $mapel): JsonResponse
    {
        $this->authorize('delete', $mapel);

        $mapel->delete();

        return response()->json(['message' => 'Mapel dihapus.']);
    }
}
