<?php

declare(strict_types=1);

namespace App\Sections\Material\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Material\Enums\StatusMateri;
use App\Sections\Material\Http\Requests\SimpanMateriRequest;
use App\Sections\Material\Http\Requests\SinkronBlokRequest;
use App\Sections\Material\Http\Resources\MateriResource;
use App\Sections\Material\Models\Materi;
use App\Sections\Material\Services\MateriService;
use App\Sections\Material\Services\ProgresMateriService;
use App\Sections\School\Services\SekolahService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class MateriController extends Controller
{
    /**
     * Guru melihat semua materi sekolah; murid hanya materi terbit kelasnya.
     */
    public function index(Request $request, SekolahService $sekolah): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Materi::class);

        $pengguna = $request->user();
        $kolom = ['mapel', 'kelas', 'tag'];

        if ($pengguna !== null && $pengguna->isGuru()) {
            return MateriResource::collection(
                Materi::query()
                    ->where('school_id', $sekolah->tunggal()->id)
                    ->with($kolom)
                    ->withCount('blok')
                    ->orderBy('urutan')
                    ->orderByDesc('created_at')
                    ->get(),
            );
        }

        $kelasId = $pengguna?->murid?->class_id;

        return MateriResource::collection(
            Materi::query()
                ->when(
                    $kelasId !== null,
                    fn ($query) => $query->where('class_id', $kelasId),
                    fn ($query) => $query->whereRaw('1 = 0'),
                )
                ->where('status', StatusMateri::Publikasi->value)
                ->with($kolom)
                ->withCount('blok')
                ->orderBy('urutan')
                ->orderBy('id')
                ->get(),
        );
    }

    /**
     * Guru: materi + urutan blok + berkas; murid: ringkasan progres menempuh.
     */
    public function show(Request $request, Materi $materi, ProgresMateriService $progres): MateriResource|JsonResponse
    {
        $this->authorize('view', $materi);

        $pengguna = $request->user();

        if ($pengguna !== null && $pengguna->isGuru()) {
            $materi->load(['mapel', 'kelas', 'tag', 'blok.kuis', 'unggahan'])->loadCount('blok');

            return new MateriResource($materi);
        }

        if ($pengguna === null) {
            abort(401, 'Sesi tidak ditemukan.');
        }

        return response()->json($progres->ringkasan($materi, $pengguna));
    }

    public function store(SimpanMateriRequest $request, SekolahService $sekolah, MateriService $service): JsonResponse
    {
        $this->authorize('create', Materi::class);

        $pengguna = $request->user();

        if ($pengguna === null) {
            abort(401, 'Sesi tidak ditemukan.');
        }

        $materi = $service->simpan($sekolah->tunggal(), $pengguna, $request->validated());

        return (new MateriResource($materi->load(['mapel', 'kelas', 'tag'])->loadCount('blok')))
            ->response()->setStatusCode(201);
    }

    public function update(SimpanMateriRequest $request, Materi $materi, MateriService $service): MateriResource
    {
        $this->authorize('update', $materi);

        $materi = $service->perbarui($materi, $request->validated());

        return new MateriResource($materi->load(['mapel', 'kelas', 'tag'])->loadCount('blok'));
    }

    public function destroy(Materi $materi, MateriService $service): JsonResponse
    {
        $this->authorize('delete', $materi);

        $service->hapus($materi);

        return response()->json(['message' => 'Materi dihapus.']);
    }

    public function sinkronBlok(SinkronBlokRequest $request, Materi $materi, MateriService $service): MateriResource
    {
        $this->authorize('update', $materi);

        $materi = $service->sinkronBlok($materi, $request->daftarBlok());

        return new MateriResource($materi->load(['mapel', 'kelas', 'tag', 'blok.kuis', 'unggahan'])->loadCount('blok'));
    }

    public function publikasi(Materi $materi, MateriService $service): MateriResource
    {
        $this->authorize('publikasi', $materi);

        $materi = $service->publikasi($materi);

        return new MateriResource($materi->load(['mapel', 'kelas', 'tag', 'blok.kuis'])->loadCount('blok'));
    }

    public function arsipkan(Materi $materi, MateriService $service): MateriResource
    {
        $this->authorize('update', $materi);

        $materi = $service->arsipkan($materi);

        return new MateriResource($materi->load(['mapel', 'kelas', 'tag'])->loadCount('blok'));
    }
}
