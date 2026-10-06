<?php

declare(strict_types=1);

namespace App\Sections\Question\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Question\Http\Requests\SimpanSoalRequest;
use App\Sections\Question\Http\Resources\SoalResource;
use App\Sections\Question\Models\Soal;
use App\Sections\Question\Services\SoalService;
use App\Sections\School\Services\SekolahService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Spatie\QueryBuilder\QueryBuilder;

class SoalController extends Controller
{
    public function index(Request $request, SekolahService $sekolah): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Soal::class);

        $daftar = QueryBuilder::for(Soal::class)
            ->where('school_id', $sekolah->tunggal()->id)
            ->allowedFilters('subject_id', 'tag_id', 'tipe', 'aktif')
            ->allowedSorts('created_at', 'skor')
            ->defaultSort('-created_at')
            ->with(['mapel', 'tag'])
            ->paginate(perPage: 50, page: max(1, $request->integer('page', 1)));

        return SoalResource::collection($daftar);
    }

    public function store(SimpanSoalRequest $request, SekolahService $sekolah, SoalService $service): JsonResponse
    {
        $this->authorize('create', Soal::class);

        $soal = $service->simpan($sekolah->tunggal(), $request->user(), $request->validated());

        return (new SoalResource($soal->load(['mapel', 'tag'])))->response()->setStatusCode(201);
    }

    public function show(Soal $soal): SoalResource
    {
        $this->authorize('view', $soal);

        return new SoalResource($soal->load(['mapel', 'tag']));
    }

    public function update(SimpanSoalRequest $request, Soal $soal, SoalService $service): SoalResource
    {
        $this->authorize('update', $soal);

        return new SoalResource($service->perbarui($soal, $request->validated())->load(['mapel', 'tag']));
    }

    public function destroy(Soal $soal, SoalService $service): JsonResponse
    {
        $this->authorize('delete', $soal);

        $service->hapus($soal);

        return response()->json(['message' => 'Soal dihapus.']);
    }
}
