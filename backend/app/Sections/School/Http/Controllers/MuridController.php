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
use Illuminate\Database\Eloquent\Builder;
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
            ->allowedFilters(
                AllowedFilter::exact('class_id'),
                // Satu kotak untuk mencari "murid tertentu": nama, NIS, NISN, dan
                // email sekaligus. Sebelum ini guru hanya bisa menyaring per kelas,
                // jadi mencari satu anak di sekolah berisi ribuan murid berarti
                // menelusuri halaman satu per satu.
                AllowedFilter::callback('cari', $this->saringPencarian(...)),
            )
            ->allowedSorts('nis')
            ->defaultSort('nis')
            ->with(['user', 'kelas'])
            ->paginate(perPage: $perHalaman, page: max(1, $request->integer('page', 1)));

        return MuridResource::collection($daftar);
    }

    /**
     * Menyaring daftar murid dengan satu kata kunci (filter `cari`).
     *
     * Tanpa filter ini guru hanya bisa menyaring per kelas; mencari satu anak
     * berarti membuka halaman daftar satu per satu.
     *
     * Kata kunci yang cuma berisi spasi diabaikan (bukan mencari spasi), dan
     * `%`/`_` yang diketik guru di-escape supaya tidak berubah jadi wildcard —
     * mencari "100%" harus menyaring, bukan diam-diam mengembalikan semua murid.
     * Kolom `nis`/`nisn` boleh NULL, jadi pencarian nama tetap menemukan murid
     * yang belum diberi NIS.
     */
    private function saringPencarian(Builder $kueri, mixed $nilai): void
    {
        $kata = trim((string) (is_scalar($nilai) ? $nilai : ''));

        if ($kata === '') {
            return;
        }

        $pola = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $kata).'%';

        $kueri->where(function (Builder $dalam) use ($pola): void {
            $dalam->where('nis', 'like', $pola)
                ->orWhere('nisn', 'like', $pola)
                ->orWhereHas('user', function (Builder $user) use ($pola): void {
                    $user->where('name', 'like', $pola)->orWhere('email', 'like', $pola);
                });
        });
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
