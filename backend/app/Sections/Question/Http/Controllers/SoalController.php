<?php

declare(strict_types=1);

namespace App\Sections\Question\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Question\Http\Requests\SimpanSoalRequest;
use App\Sections\Question\Http\Resources\SoalResource;
use App\Sections\Question\Models\Soal;
use App\Sections\Question\Services\SoalService;
use App\Sections\School\Services\SekolahService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class SoalController extends Controller
{
    public function index(Request $request, SekolahService $sekolah): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Soal::class);

        $pengguna = $request->user();

        // Bank soal dimuat bertahap: 20 baris per permintaan (paling banyak 100),
        // supaya sekolah dengan ratusan soal tidak mengirim seluruh bank dalam
        // satu respons. Klien meminta halaman berikutnya saat digulir/diklik.
        $perHalaman = min(100, max(1, $request->integer('per_page', 20)));
        $halaman = max(1, $request->integer('page', 1));

        // Pencarian teks soal. Dipakai editor kuis supaya soal ke-51 dan
        // seterusnya tetap terjangkau tanpa memuat seluruh bank soal.
        // Dipotong di 80 karakter: pola LIKE panjang hanya membebani basis data.
        $cari = mb_substr(trim((string) $request->query('q', '')), 0, 80);

        $kueri = Soal::query()
            ->where('school_id', $sekolah->tunggal()->id)
            // Bank soal memuat kunci jawaban, jadi guru hanya melihat soal
            // buatannya sendiri; admin melihat semuanya (K-04).
            ->when(
                $pengguna !== null && ! $pengguna->hasRole('admin'),
                fn ($query) => $query->where('dibuat_oleh', $pengguna->getKey()),
            )
            ->when(
                $cari !== '',
                // `konten` bertipe JSON di kedua driver yang dipakai (SQLite &
                // MySQL), jadi ->teks diterjemahkan ke json_extract, bukan LIKE
                // atas seluruh JSON (yang bisa cocok ke kunci jawaban juga).
                fn ($query) => $query->where('konten->teks', 'like', '%'.$cari.'%'),
            );

        $daftar = QueryBuilder::for($kueri)
            // Keempatnya kolom id/enum, jadi WAJIB persis. Filter teks biasa
            // milik spatie cocok sebagian (`LIKE %nilai%`): `filter[subject_id]=1`
            // ikut menarik mapel 12/21, dan `filter[tipe]=benar_salah` ikut
            // menarik `benar_salah_majemuk` — bank soal jadi menampilkan soal
            // mapel/tipe lain.
            ->allowedFilters(
                AllowedFilter::exact('subject_id'),
                AllowedFilter::exact('tag_id'),
                AllowedFilter::exact('tipe'),
                AllowedFilter::exact('aktif'),
            )
            ->allowedSorts('created_at', 'skor')
            ->defaultSort('-created_at')
            ->with(['mapel', 'tag'])
            // "Sedang dipakai kuis berjalan?" dihitung sekali untuk seluruh
            // halaman (bukan satu kueri per baris) — editor memakainya untuk
            // menjelaskan aturan "hanya isi yang boleh diperbaiki".
            ->withExists(['kuis as dipakai_kuis_berjalan' => static function (Builder $query): void {
                Soal::batasanKuisBerjalan($query);
            }])
            ->paginate(perPage: $perHalaman, page: $halaman);

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
