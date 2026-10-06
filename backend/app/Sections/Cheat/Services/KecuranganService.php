<?php

declare(strict_types=1);

namespace App\Sections\Cheat\Services;

use App\Models\User;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Cheat\Enums\KategoriKecurangan;
use App\Sections\Cheat\Enums\StatusTinjauan;
use App\Sections\Cheat\Models\KejadianKecurangan;
use App\Sections\Quiz\Models\Kuis;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Catatan kecurangan: tulis (dari klien maupun turunan server), baca untuk guru,
 * dan tinjau. Semua keputusan kategori divalidasi di server — payload klien
 * tidak pernah dipercaya apa adanya.
 *
 * Sifat catatan: **append-only**. Service ini tidak pernah memperbarui kejadian
 * selain kolom tinjauan, dan tidak pernah menghapus.
 */
class KecuranganService
{
    /** Batas jumlah kejadian per kiriman berkelompok (chunk anticheat). */
    public const BATAS_BERKELOMPOK = 50;

    /**
     * Simpan kejadian dari perangkat murid.
     *
     * Kategori turunan server DITOLAK di sini, supaya murid tidak bisa
     * "menuduh dirinya sendiri" dengan kategori berat dan mengaburkan catatan.
     *
     * @param  array<int, array{kategori?: mixed, client_at?: mixed, rincian?: mixed}>  $kejadian
     * @return int jumlah baris baru yang tersimpan
     */
    public function catat(Attempt $attempt, User $murid, array $kejadian): int
    {
        if (count($kejadian) > self::BATAS_BERKELOMPOK) {
            throw new InvalidArgumentException(
                'Kiriman kejadian melebihi batas '.self::BATAS_BERKELOMPOK.' per permintaan.'
            );
        }

        $baris = [];

        foreach ($kejadian as $satu) {
            $kategori = KategoriKecurangan::tryFrom((string) ($satu['kategori'] ?? ''));

            if ($kategori === null || ! $kategori->dariKlien()) {
                continue;
            }

            $clientAt = $this->waktuKlien($satu['client_at'] ?? null);
            $rincian = $this->rincianAman($satu['rincian'] ?? null);

            $baris[] = [
                'school_id' => $attempt->school_id,
                'quiz_id' => $attempt->quiz_id,
                'attempt_id' => $attempt->getKey(),
                'student_id' => $attempt->student_id,
                'kategori' => $kategori->value,
                'skor_risiko' => $kategori->skorRisiko(),
                'dari_klien' => true,
                'client_at' => $clientAt,
                'rincian' => $rincian === null ? null : json_encode($rincian),
                'review_status' => StatusTinjauan::Menunggu->value,
                'sidik' => $this->sidik($attempt, $kategori, $clientAt, $rincian),
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ];
        }

        if ($baris === []) {
            return 0;
        }

        // `insertOrIgnore` membuat kiriman ulang (retry) idempoten lewat unique
        // attempt_id + sidik, tanpa perlu membaca dulu.
        return DB::table('cheat_events')->insertOrIgnore($baris);
    }

    /**
     * Catat kejadian yang HANYA boleh diturunkan server (mis. mengumpulkan
     * terlambat, sesi ganda). Kategori dari klien ditolak di sini.
     *
     * @param  array<string, mixed>|null  $rincian
     */
    public function catatTurunan(Attempt $attempt, KategoriKecurangan $kategori, ?array $rincian = null): ?KejadianKecurangan
    {
        if ($kategori->dariKlien()) {
            throw new InvalidArgumentException('Kategori '.$kategori->value.' harus datang dari klien, bukan diturunkan server.');
        }

        $sidik = $this->sidik($attempt, $kategori, null, $rincian);

        // Kejadian turunan boleh berulang (mis. terlambat dua kali); sidiknya
        // diberi pembeda waktu supaya tidak berbenturan dengan unique index.
        $sudahAda = KejadianKecurangan::query()
            ->where('attempt_id', $attempt->getKey())
            ->where('sidik', $sidik)
            ->exists();

        if ($sudahAda) {
            return null;
        }

        return KejadianKecurangan::query()->create([
            'school_id' => $attempt->school_id,
            'quiz_id' => $attempt->quiz_id,
            'attempt_id' => $attempt->getKey(),
            'student_id' => $attempt->student_id,
            'kategori' => $kategori,
            'skor_risiko' => $kategori->skorRisiko(),
            'dari_klien' => false,
            'client_at' => null,
            'rincian' => $rincian,
            'review_status' => StatusTinjauan::Menunggu,
            'sidik' => $sidik,
        ]);
    }

    /**
     * Catatan satu kuis untuk guru.
     *
     * @return Collection<int, KejadianKecurangan>
     */
    public function daftar(Kuis $kuis, ?StatusTinjauan $status = null): Collection
    {
        return KejadianKecurangan::query()
            ->where('quiz_id', $kuis->getKey())
            ->when($status !== null, fn ($query) => $query->where('review_status', $status->value))
            ->with(['murid.user'])
            ->orderByDesc('created_at')
            ->get();
    }

    /**
     * Ringkasan per attempt untuk Live Monitor: jumlah catatan, skor risiko
     * tertinggi, dan berapa yang belum ditinjau.
     *
     * @return array<int, array{jumlah: int, skor_tertinggi: int, belum_ditinjau: int}>
     */
    public function ringkasan(Kuis $kuis): array
    {
        /** @var Collection<int, object> $baris */
        $baris = KejadianKecurangan::query()
            ->where('quiz_id', $kuis->getKey())
            ->selectRaw('attempt_id, COUNT(*) as jumlah, MAX(skor_risiko) as skor_tertinggi')
            ->selectRaw("SUM(CASE WHEN review_status = '".StatusTinjauan::Menunggu->value."' THEN 1 ELSE 0 END) as belum_ditinjau")
            ->groupBy('attempt_id')
            ->get();

        $ringkas = [];

        foreach ($baris as $satu) {
            $ringkas[(int) $satu->attempt_id] = [
                'jumlah' => (int) $satu->jumlah,
                'skor_tertinggi' => (int) $satu->skor_tertinggi,
                'belum_ditinjau' => (int) $satu->belum_ditinjau,
            ];
        }

        return $ringkas;
    }

    /**
     * Tinjauan guru: valid / tidak valid. Hanya kolom tinjauan yang berubah,
     * dan setiap tinjauan dicatat di audit.
     */
    public function tinjau(
        KejadianKecurangan $kejadian,
        StatusTinjauan $status,
        User $guru,
        ?string $catatan = null,
    ): KejadianKecurangan {
        if ($status === StatusTinjauan::Menunggu) {
            throw new InvalidArgumentException('Status tinjauan hanya boleh valid atau tidak valid.');
        }

        $sebelum = $kejadian->review_status;

        $kejadian->forceFill([
            'review_status' => $status,
            'reviewed_by' => $guru->getKey(),
            'reviewed_at' => Carbon::now(),
        ])->save();

        activity('kecurangan')
            ->causedBy($guru)
            ->performedOn($kejadian)
            ->event('tinjauan')
            ->withProperties([
                'kejadian_id' => $kejadian->getKey(),
                'attempt_id' => $kejadian->attempt_id,
                'kategori' => $kejadian->kategori->value,
                'status_sebelum' => $sebelum->value,
                'status_sesudah' => $status->value,
                'catatan' => $catatan,
            ])
            ->log('Tinjauan catatan kecurangan');

        return $kejadian->refresh();
    }

    /** Waktu perangkat murid tidak dipercaya: dibatasi agar tidak masuk akal. */
    private function waktuKlien(mixed $nilai): ?Carbon
    {
        if (! is_string($nilai) || $nilai === '') {
            return null;
        }

        try {
            $waktu = Carbon::parse($nilai);
        } catch (\Throwable) {
            return null;
        }

        $sekarang = Carbon::now();

        // Jam perangkat yang melompat terlalu jauh dibiarkan tercatat sebagai
        // null; server tetap memakai created_at sebagai waktu kebenaran.
        if ($waktu->lessThan($sekarang->copy()->subDay()) || $waktu->greaterThan($sekarang->copy()->addMinutes(5))) {
            return null;
        }

        return $waktu;
    }

    /** @return array<string, mixed>|null */
    private function rincianAman(mixed $nilai): ?array
    {
        if (! is_array($nilai)) {
            return null;
        }

        // Batasi ukuran: rincian hanya keterangan pendek, bukan tempat menyelundupkan data.
        $bersih = [];

        foreach (array_slice($nilai, 0, 10, true) as $kunci => $isi) {
            if (! is_string($kunci) || mb_strlen($kunci) > 40) {
                continue;
            }

            if (is_scalar($isi)) {
                $bersih[$kunci] = mb_substr((string) $isi, 0, 200);
            }
        }

        return $bersih === [] ? null : $bersih;
    }

    /**
     * Sidik jari untuk dedupe: satu kejadian yang sama tidak dicatat dua kali
     * walau kirimannya terulang.
     *
     * @param  array<string, mixed>|null  $rincian
     */
    private function sidik(Attempt $attempt, KategoriKecurangan $kategori, ?Carbon $clientAt, ?array $rincian): string
    {
        return hash('sha256', implode('|', [
            (string) $attempt->getKey(),
            $kategori->value,
            $clientAt?->toIso8601String() ?? '',
            $rincian === null ? '' : json_encode($rincian),
        ]));
    }
}
