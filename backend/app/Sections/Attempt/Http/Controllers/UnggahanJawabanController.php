<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Attempt\Enums\JenisUnggahanJawaban;
use App\Sections\Attempt\Http\Requests\MulaiUnggahanJawabanRequest;
use App\Sections\Attempt\Http\Requests\SimpanPotonganJawabanRequest;
use App\Sections\Attempt\Http\Resources\UnggahanJawabanResource;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Attempt\Models\UnggahanJawaban;
use App\Sections\Attempt\Services\PenyimpananJawaban;
use App\Sections\Question\Models\Soal;
use App\Sections\Settings\Enums\KunciPengaturan;
use App\Sections\Settings\Services\PengaturanService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\ValidationException;

/**
 * Lampiran jawaban murid (slice 09).
 *
 * Hanya pemilik attempt yang boleh mengunggah/menghapus lampirannya, dan server
 * menolaknya begitu waktu ulangan habis (`PenyimpananJawaban`). Guru boleh
 * melihat — lampiran jawaban ikut ditampilkan di antrean koreksi, bukan hanya
 * teks jawabannya.
 */
class UnggahanJawabanController extends Controller
{
    /** Lampiran satu attempt (murid: miliknya; guru: untuk menilai). */
    public function daftar(Attempt $attempt, PenyimpananJawaban $penyimpanan): AnonymousResourceCollection
    {
        $this->authorize('view', $attempt);

        return UnggahanJawabanResource::collection($penyimpanan->daftar($attempt));
    }

    /** Buka sesi unggah untuk satu soal. */
    public function mulai(
        MulaiUnggahanJawabanRequest $request,
        Attempt $attempt,
        PenyimpananJawaban $penyimpanan,
        PengaturanService $pengaturan,
    ): JsonResponse {
        $this->authorize('unggahJawaban', $attempt);

        if ($request->user() === null) {
            abort(401, 'Sesi tidak ditemukan.');
        }

        /** @var Soal $soal */
        $soal = Soal::query()->findOrFail((int) $request->validated('question_id'));

        $durasi = $request->validated('durasi_detik');

        $unggahan = $penyimpanan->mulai(
            $attempt,
            $soal,
            JenisUnggahanJawaban::from((string) $request->validated('jenis')),
            $request->validated('nama'),
            (int) $request->validated('ukuran'),
            $durasi === null ? null : (int) $durasi,
            $this->izinRekam($attempt, $pengaturan),
        );

        return (new UnggahanJawabanResource($unggahan))->response()->setStatusCode(201);
    }

    /** Terima satu potongan (idempoten; kirim ulang potongan yang sama aman). */
    public function potongan(
        SimpanPotonganJawabanRequest $request,
        UnggahanJawaban $unggahan,
        int $indeks,
        PenyimpananJawaban $penyimpanan,
    ): JsonResponse {
        $this->authorize('unggahJawaban', $unggahan->attempt);

        $isi = $request->isi();

        if ($isi === '') {
            throw ValidationException::withMessages(['potongan' => 'Isi potongan kosong.']);
        }

        $potongan = $penyimpanan->simpanPotongan($unggahan, $indeks, $isi, $request->input('hash'));

        return response()->json([
            'message' => 'Potongan diterima.',
            'indeks' => $potongan->indeks,
            'ukuran' => $potongan->ukuran,
            'hash' => $potongan->hash,
        ]);
    }

    /**
     * Gabungkan potongan lalu proses isinya (gambar kanvas → PNG, berkas →
     * klasifikasi + karantina `.upload`).
     *
     * Menggabungkan sengaja TIDAK mengulang pemeriksaan deadline: potongan yang
     * sudah diterima sebelum waktu habis berhak utuh, walau penggabungannya baru
     * diminta beberapa detik setelah deadline.
     */
    public function selesai(UnggahanJawaban $unggahan, PenyimpananJawaban $penyimpanan): UnggahanJawabanResource
    {
        $this->authorize('unggahJawaban', $unggahan->attempt);

        return new UnggahanJawabanResource($penyimpanan->selesai($unggahan));
    }

    /** Buang satu lampiran (mis. salah pilih berkas). */
    public function hapus(UnggahanJawaban $unggahan, PenyimpananJawaban $penyimpanan): JsonResponse
    {
        $this->authorize('unggahJawaban', $unggahan->attempt);

        $penyimpanan->hapus($unggahan);

        return response()->json(['message' => 'Lampiran dibuang.']);
    }

    /** Saklar izin rekam diri (pengaturan tiga lapis; bawaan mati). */
    private function izinRekam(Attempt $attempt, PengaturanService $pengaturan): bool
    {
        $kuis = $attempt->kuis;

        $peta = $pengaturan->semua(
            (int) $attempt->school_id,
            $kuis->class_id === null ? null : (int) $kuis->class_id,
            (int) $attempt->quiz_id,
        )['pengaturan'];

        return (bool) ($peta[KunciPengaturan::RekamDiri->value]['nilai'] ?? KunciPengaturan::RekamDiri->bawaan());
    }
}
