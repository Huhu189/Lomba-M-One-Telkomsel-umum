<?php

declare(strict_types=1);

namespace App\Sections\Question\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Question\Http\Requests\SimpanTagRequest;
use App\Sections\Question\Http\Resources\TagResource;
use App\Sections\Question\Models\Tag;
use App\Sections\School\Services\SekolahService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class TagController extends Controller
{
    public function index(SekolahService $sekolah): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Tag::class);

        $daftar = Tag::query()
            ->where('school_id', $sekolah->tunggal()->id)
            ->withCount('soal')
            ->orderBy('nama')
            ->get();

        return TagResource::collection($daftar);
    }

    public function store(SimpanTagRequest $request, SekolahService $sekolah): JsonResponse
    {
        $this->authorize('create', Tag::class);

        $tag = Tag::query()->create([
            ...$request->validated(),
            'school_id' => $sekolah->tunggal()->id,
        ]);

        return (new TagResource($tag))->response()->setStatusCode(201);
    }

    public function update(SimpanTagRequest $request, Tag $tag): TagResource
    {
        $this->authorize('update', $tag);

        $tag->fill($request->validated())->save();

        return new TagResource($tag->refresh()->loadCount('soal'));
    }

    public function destroy(Tag $tag): JsonResponse
    {
        $this->authorize('delete', $tag);

        $tag->delete();

        return response()->json(['message' => 'Tag dihapus.']);
    }
}
