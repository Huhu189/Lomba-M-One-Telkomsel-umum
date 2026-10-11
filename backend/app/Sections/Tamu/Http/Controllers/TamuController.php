<?php

declare(strict_types=1);

namespace App\Sections\Tamu\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Auth\Http\Resources\UserResource;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\School\Services\SekolahService;
use App\Sections\Tamu\Http\Requests\MasukTamuRequest;
use App\Sections\Tamu\Services\LaporanTamuService;
use App\Sections\Tamu\Services\TamuService;
use Illuminate\Http\JsonResponse;

/**
 * Siswa tamu (tanpa akun). Dua jalur publik saja; sisanya memakai jalur murid
 * yang sudah ada, karena tamu tetap akun berperan `murid` — yang membedakan
 * hanya izin kuisnya (lihat `TamuService`).
 */
class TamuController extends Controller
{
    /**
     * Info publik untuk halaman masuk: apakah sekolah ini menerima siswa tamu.
     *
     * Tanpa sesi dan sengaja tanpa rincian lain — halaman masuk hanya perlu tahu
     * apakah formulir tamu ditampilkan.
     */
    public function info(SekolahService $sekolah, TamuService $tamu): JsonResponse
    {
        return response()->json([
            'diizinkan' => $tamu->tersedia($sekolah->tunggal()->id),
        ]);
    }

    /**
     * Masuk sebagai siswa tamu (throttle `tamu` di rute).
     *
     * Balasannya memuat `kode_perangkat`: klien menyimpannya dan mengirimkannya
     * lagi saat masuk ulang, supaya anak yang sama kembali ke akunnya — sementara
     * anak lain yang kebetulan menulis nama yang sama tidak ikut masuk ke sana.
     */
    public function masuk(MasukTamuRequest $request, SekolahService $sekolah, TamuService $tamu): JsonResponse
    {
        $kode = $request->validated('kode_perangkat');

        $hasil = $tamu->masuk(
            (string) $request->validated('nama'),
            $sekolah->tunggal()->id,
            is_string($kode) ? $kode : null,
        );

        $user = $hasil['user'];

        return response()->json([
            'message' => 'Kamu masuk sebagai siswa tamu di perangkat ini. Hasil ulanganmu tercatat atas nama '.$user->name.'.',
            'kode_perangkat' => $hasil['kode'],
            'user' => new UserResource($user),
        ], 201);
    }

    /**
     * Hasil siswa tamu pada satu kuis (guru pemilik kuisnya).
     *
     * Laporan kelas tidak memuat tamu — mereka tidak punya kelas dan tidak
     * masuk ranking kelas — jadi guru memerlukan jalur ini untuk melihat nilai
     * orang tanpa akun yang mengerjakan kuisnya.
     */
    public function kuis(Kuis $kuis, TamuService $tamu, LaporanTamuService $laporan): JsonResponse
    {
        $this->authorize('laporan', $kuis);

        return response()->json([
            // Ditampilkan di panel guru supaya jelas apakah pintu tamu masih terbuka.
            'izin_tamu' => $tamu->izinkanKuis($kuis),
            ...$laporan->untukKuis($kuis),
        ]);
    }
}
