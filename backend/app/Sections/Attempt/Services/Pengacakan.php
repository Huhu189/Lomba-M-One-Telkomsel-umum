<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Services;

use App\Sections\Question\Models\Soal;

/**
 * Pengacakan urutan soal dan opsi — dilakukan SERVER, bukan klien (chunk security).
 *
 * Urutan diturunkan dari hash(seed, id) sehingga: (a) tidak perlu menyimpan
 * tabel urutan tambahan, (b) hasilnya stabil untuk attempt yang sama (murid yang
 * menyegarkan halaman melihat urutan yang sama), dan (c) bisa diuji.
 */
final class Pengacakan
{
    /**
     * Urutan soal untuk attempt (stabil per seed + id attempt).
     *
     * @param  array<int, Soal>  $soal
     * @return array<int, Soal>
     */
    public static function urutSoal(array $soal, int $seed, int $attemptId): array
    {
        return self::urut(
            $soal,
            static fn (Soal $satu): string => sha1($seed.'|attempt-'.$attemptId.'|soal|'.$satu->getKey()),
        );
    }

    /**
     * Urutan opsi satu soal. Bila `acak` false, urutan asli dipertahankan.
     *
     * @param  array<int, array<string, mixed>>  $opsi
     * @return array<int, array<string, mixed>>
     */
    public static function urutOpsi(array $opsi, int $seed, int|string $soalId, bool $acak): array
    {
        if (! $acak) {
            return array_values($opsi);
        }

        $hashId = static fn (array $satu): string => sha1($seed.'|soal-'.$soalId.'|opsi|'.(string) ($satu['id'] ?? ''));

        return self::urut($opsi, $hashId);
    }

    /**
     * Huruf teracak untuk soal susun huruf.
     *
     * Hasilnya stabil per seed + soal (murid yang menyegarkan halaman melihat
     * susunan huruf yang sama), dan huruf aslinya tidak pernah dikirim: layar
     * anak hanya menerima hasil acak ini.
     *
     * @return array<int, string>
     */
    public static function urutHuruf(string $kata, int $seed, int|string $soalId): array
    {
        $huruf = mb_str_split($kata);
        $berbobot = [];

        foreach ($huruf as $urutan => $satu) {
            $berbobot[] = [
                'bobot' => sha1($seed.'|soal-'.$soalId.'|huruf|'.$urutan.'|'.$satu),
                'urutan' => $urutan,
                'nilai' => $satu,
            ];
        }

        // Bila hasil acak ternyata sama persis dengan kata aslinya (mungkin
        // untuk kata pendek), urutkan mundur supaya anak tetap harus menyusun.
        usort($berbobot, static fn (array $kiri, array $kanan): int => [$kiri['bobot'], $kiri['urutan']] <=> [$kanan['bobot'], $kanan['urutan']]);

        $acak = array_map(static fn (array $baris): string => (string) $baris['nilai'], $berbobot);

        return $acak === $huruf ? array_reverse($acak) : $acak;
    }

    /**
     * @template T
     *
     * @param  array<int, T>  $daftar
     * @param  callable(T): string  $bobot
     * @return array<int, T>
     */
    private static function urut(array $daftar, callable $bobot): array
    {
        $berbobot = [];

        foreach ($daftar as $urutan => $satu) {
            $berbobot[] = ['bobot' => $bobot($satu), 'urutan' => $urutan, 'nilai' => $satu];
        }

        usort($berbobot, static function (array $kiri, array $kanan): int {
            return [$kiri['bobot'], $kiri['urutan']] <=> [$kanan['bobot'], $kanan['urutan']];
        });

        return array_values(array_map(static fn (array $baris): mixed => $baris['nilai'], $berbobot));
    }
}
