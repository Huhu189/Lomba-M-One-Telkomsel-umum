<?php

declare(strict_types=1);

namespace App\Sections\Settings\Services;

use App\Sections\Cache\Services\CacheBerlapis;
use App\Sections\Settings\Enums\KunciPengaturan;
use App\Sections\Settings\Enums\LingkupPengaturan;
use App\Sections\Settings\Models\Pengaturan;

/**
 * Pengaturan tiga lapis: kuis > kelas > sekolah, kecuali sekolah menandai
 * sebuah kunci `terkunci` (maka nilai sekolah menang). Peta tiap lingkup
 * di-cache berlapis dan diinvalidasi setiap kali pengaturan berubah
 * (chunk slice-02; cache berlapis ditambahkan slice 10).
 */
class PengaturanService
{
    private const AWALAN_CACHE = 'pengaturan';

    public function __construct(private readonly CacheBerlapis $cache) {}

    /**
     * Resolusi pengaturan untuk konteks sekolah/kelas/kuis.
     *
     * @return array{
     *     sekolah_id: int,
     *     kelas_id: int|null,
     *     kuis_id: int|null,
     *     pengaturan: array<string, array{nilai: bool|int, tipe: string, label: string, kelompok: string, bawaan: bool|int, sumber: string, terkunci: bool}>
     * }
     */
    public function semua(int $sekolahId, ?int $kelasId = null, ?int $kuisId = null): array
    {
        $sekolah = $this->peta(LingkupPengaturan::Sekolah->value, $sekolahId);
        $kelas = $kelasId !== null ? $this->peta(LingkupPengaturan::Kelas->value, $kelasId) : $this->petaKosong();
        $kuis = $kuisId !== null ? $this->peta(LingkupPengaturan::Kuis->value, $kuisId) : $this->petaKosong();

        $hasil = [];

        foreach (KunciPengaturan::cases() as $kunci) {
            $k = $kunci->value;
            $nilai = $kunci->bawaan();
            $sumber = 'bawaan';

            if (array_key_exists($k, $sekolah['nilai'])) {
                $nilai = $sekolah['nilai'][$k];
                $sumber = LingkupPengaturan::Sekolah->value;
            }

            // Sekolah mengunci → nilai sekolah menang, lapis bawah diabaikan.
            if (! isset($sekolah['terkunci'][$k])) {
                if (array_key_exists($k, $kelas['nilai'])) {
                    $nilai = $kelas['nilai'][$k];
                    $sumber = LingkupPengaturan::Kelas->value;
                }

                if (array_key_exists($k, $kuis['nilai'])) {
                    $nilai = $kuis['nilai'][$k];
                    $sumber = LingkupPengaturan::Kuis->value;
                }
            }

            $hasil[$k] = [
                'nilai' => $nilai,
                'tipe' => $kunci->tipe(),
                'label' => $kunci->label(),
                'kelompok' => $kunci->kelompok(),
                'bawaan' => $kunci->bawaan(),
                'sumber' => $sumber,
                'terkunci' => isset($sekolah['terkunci'][$k]),
            ];
        }

        return [
            'sekolah_id' => $sekolahId,
            'kelas_id' => $kelasId,
            'kuis_id' => $kuisId,
            'pengaturan' => $hasil,
        ];
    }

    /**
     * Simpan satu pengaturan lalu invalidasi cache lingkupnya.
     */
    public function simpan(
        LingkupPengaturan $lingkup,
        int $lingkupId,
        KunciPengaturan $kunci,
        bool|int $nilai,
        bool $terkunci = false,
    ): Pengaturan {
        $pengaturan = Pengaturan::query()->updateOrCreate(
            [
                'lingkup' => $lingkup->value,
                'lingkup_id' => $lingkupId,
                'kunci' => $kunci->value,
            ],
            [
                'nilai' => $nilai,
                // Penguncian hanya bermakna pada lapis sekolah.
                'terkunci' => $terkunci && $lingkup === LingkupPengaturan::Sekolah,
            ],
        );

        $this->lupakan($lingkup, $lingkupId);

        return $pengaturan;
    }

    /**
     * Buang cache peta satu lingkup (dipanggil saat pengaturan berubah).
     */
    public function lupakan(LingkupPengaturan $lingkup, int $lingkupId): void
    {
        // Database sudah ditulis pemanggil; invalidasi berjalan Redis → L1
        // dengan penanda versi supaya salinan L1 di proses lain ditolak.
        $this->cache->lupakan($this->kunciCache($lingkup->value, $lingkupId), CacheBerlapis::RUANG_PENGATURAN);
    }

    /**
     * @return array{nilai: array<string, bool|int>, terkunci: array<string, bool>}
     */
    private function peta(string $lingkup, int $lingkupId): array
    {
        return $this->cache->ingat(
            $this->kunciCache($lingkup, $lingkupId),
            function () use ($lingkup, $lingkupId): array {
                $nilai = [];
                $terkunci = [];

                foreach (Pengaturan::query()
                    ->where('lingkup', $lingkup)
                    ->where('lingkup_id', $lingkupId)
                    ->get() as $baris) {
                    $nilai[$baris->kunci] = $baris->nilai;
                    if ($baris->terkunci) {
                        $terkunci[$baris->kunci] = true;
                    }
                }

                return ['nilai' => $nilai, 'terkunci' => $terkunci];
            },
            CacheBerlapis::RUANG_PENGATURAN,
        );
    }

    /**
     * @return array{nilai: array<string, bool|int>, terkunci: array<string, bool>}
     */
    private function petaKosong(): array
    {
        return ['nilai' => [], 'terkunci' => []];
    }

    private function kunciCache(string $lingkup, int $lingkupId): string
    {
        return self::AWALAN_CACHE.":{$lingkup}:{$lingkupId}";
    }
}
