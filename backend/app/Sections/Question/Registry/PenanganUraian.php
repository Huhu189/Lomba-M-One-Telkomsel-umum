<?php

declare(strict_types=1);

namespace App\Sections\Question\Registry;

/**
 * Uraian.
 * konten: {teks, petunjuk?, matematika?, media?}
 * kunci : {kata_kunci:[{teks, bobot?}], ambang_lulus?:0..1, sinonim?:{kata:[alias, ...]}}
 *
 * Urutan penilaian (chunk slice-06): kata kunci berbobot dulu, lalu AI (slice 09),
 * lalu guru. Di sini hanya tahap kata kunci: rasio bobot yang muncul menentukan
 * `dinilai` (skor parsial) atau `perlu_tinjau` (guru yang memutuskan).
 */
final class PenanganUraian implements PenanganTipeSoal
{
    public const AMBANG_LULUS_BAWAAN = 0.6;

    public function validasiKonten(array $konten): array
    {
        return [
            ...BantuanKonten::galatTeks($konten),
            ...BantuanKonten::galatMedia($konten),
            ...BantuanKonten::galatMatematika($konten),
        ];
    }

    public function validasiKunci(array $konten, array $kunci): array
    {
        $galat = [];
        $kataKunci = $kunci['kata_kunci'] ?? null;

        if (! is_array($kataKunci) || $kataKunci === []) {
            return ['Kunci uraian wajib berisi kunci.kata_kunci (minimal satu kata kunci).'];
        }

        foreach ($kataKunci as $satu) {
            if (! is_array($satu) || ! is_string($satu['teks'] ?? null) || trim((string) $satu['teks']) === '') {
                $galat[] = 'Setiap kata_kunci wajib punya teks.';
                break;
            }

            if (isset($satu['bobot']) && (! is_numeric($satu['bobot']) || (float) $satu['bobot'] <= 0)) {
                $galat[] = 'Bobot kata_kunci wajib bilangan lebih dari 0.';
                break;
            }
        }

        if (isset($kunci['ambang_lulus'])) {
            $ambang = $kunci['ambang_lulus'];

            if (! is_numeric($ambang) || (float) $ambang <= 0 || (float) $ambang > 1) {
                $galat[] = 'kunci.ambang_lulus wajib berupa bilangan antara 0 dan 1.';
            }
        }

        return array_values(array_unique($galat));
    }

    public function nilai(array $konten, array $kunci, mixed $jawaban): bool
    {
        if (! is_string($jawaban) || trim($jawaban) === '') {
            return false;
        }

        return $this->rasio($konten, $kunci, $jawaban) >= $this->ambangLulus($kunci);
    }

    /**
     * Rasio bobot kata kunci yang muncul di jawaban (0..1).
     */
    public function rasio(array $konten, array $kunci, string $jawaban): float
    {
        $kataKunci = $kunci['kata_kunci'] ?? null;

        if (! is_array($kataKunci) || $kataKunci === []) {
            return 0.0;
        }

        $teksJawaban = BantuanTeks::normalisasi($jawaban);

        if ($teksJawaban === '') {
            return 0.0;
        }

        $totalBobot = 0.0;
        $bobotMuncul = 0.0;

        foreach ($kataKunci as $satu) {
            if (! is_array($satu)) {
                continue;
            }

            $bobot = is_numeric($satu['bobot'] ?? null) ? (float) $satu['bobot'] : 1.0;
            $totalBobot += $bobot;

            if ($this->muncul($teksJawaban, (string) ($satu['teks'] ?? ''), $kunci)) {
                $bobotMuncul += $bobot;
            }
        }

        return $totalBobot > 0 ? $bobotMuncul / $totalBobot : 0.0;
    }

    /**
     * @param  array<string, mixed>  $kunci
     */
    public function ambangLulus(array $kunci): float
    {
        $ambang = $kunci['ambang_lulus'] ?? null;

        return is_numeric($ambang) ? (float) $ambang : self::AMBANG_LULUS_BAWAAN;
    }

    /**
     * Kata kunci dianggap muncul bila seluruh katanya ada di jawaban (boleh
     * berbeda urutan) atau salah satu sinonimnya muncul utuh.
     *
     * @param  array<string, mixed>  $kunci
     */
    private function muncul(string $teksJawaban, string $kataKunci, array $kunci): bool
    {
        $kandidat = [BantuanTeks::normalisasi($kataKunci)];
        $sinonim = $kunci['sinonim'] ?? null;

        if (is_array($sinonim)) {
            foreach ($sinonim as $nama => $alias) {
                if (BantuanTeks::normalisasi((string) $nama) !== BantuanTeks::normalisasi($kataKunci) || ! is_array($alias)) {
                    continue;
                }

                foreach ($alias as $satu) {
                    if (is_string($satu)) {
                        $kandidat[] = BantuanTeks::normalisasi($satu);
                    }
                }
            }
        }

        $kataJawaban = explode(' ', $teksJawaban);

        foreach ($kandidat as $satu) {
            if ($satu === '') {
                continue;
            }

            $semuaAda = true;

            foreach (explode(' ', $satu) as $kata) {
                $ada = false;

                foreach ($kataJawaban as $lain) {
                    if (BantuanTeks::miripKata($kata, $lain)) {
                        $ada = true;
                        break;
                    }
                }

                if (! $ada) {
                    $semuaAda = false;
                    break;
                }
            }

            if ($semuaAda) {
                return true;
            }
        }

        return false;
    }
}
