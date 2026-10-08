<?php

declare(strict_types=1);

namespace App\Sections\Question\Registry;

/**
 * Pembantu kecil bersama antar penangan tipe soal.
 */
final class BantuanKonten
{
    /**
     * Ambil daftar item (opsi/pasangan/item) sebagai array of array.
     *
     * @param  array<string, mixed>  $konten
     * @return array<int, array<string, mixed>>
     */
    public static function daftar(array $konten, string $kunci): array
    {
        $nilai = $konten[$kunci] ?? null;

        if (! is_array($nilai)) {
            return [];
        }

        return array_values(array_filter($nilai, static fn (mixed $baris): bool => is_array($baris)));
    }

    /**
     * Id unik dari daftar item.
     *
     * @param  array<int, array<string, mixed>>  $daftar
     * @return array<int, string>
     */
    public static function idDaftar(array $daftar): array
    {
        return array_values(array_map(
            static fn (array $baris): string => (string) ($baris['id'] ?? ''),
            $daftar,
        ));
    }

    /**
     * Galat bila ada id yang kosong atau duplikat.
     *
     * @param  array<int, array<string, mixed>>  $daftar
     * @return array<int, string>
     */
    public static function galatId(array $daftar, string $namaKolom): array
    {
        $galat = [];
        $id = self::idDaftar($daftar);

        foreach ($id as $satu) {
            if (trim($satu) === '') {
                $galat[] = "Setiap {$namaKolom} wajib punya id.";
                break;
            }
        }

        if (count($id) !== count(array_unique($id))) {
            $galat[] = "Id {$namaKolom} tidak boleh duplikat.";
        }

        return $galat;
    }

    /**
     * Teks soal wajib ada.
     *
     * @param  array<string, mixed>  $konten
     * @return array<int, string>
     */
    public static function galatTeks(array $konten): array
    {
        $teks = $konten['teks'] ?? null;

        if (! is_string($teks) || trim($teks) === '') {
            return ['Isi soal (konten.teks) wajib diisi.'];
        }

        return [];
    }

    /**
     * Media (opsional) hanya boleh berupa path/URL pendek.
     *
     * Sejak U-01 alamatnya juga dibatasi: path internal aplikasi (mis.
     * `/media/lingkaran.png`) atau URL `https` dari host yang diizinkan. Tanpa
     * batas ini guru bisa menempelkan URL host mana pun, sehingga IP dan Referer
     * anak terkirim ke server pihak ketiga saat gambar dimuat.
     *
     * @param  array<string, mixed>  $konten
     * @return array<int, string>
     */
    public static function galatMedia(array $konten): array
    {
        $media = $konten['media'] ?? null;

        if ($media === null || $media === '') {
            return [];
        }

        if (! is_string($media) || mb_strlen($media) > 255) {
            return ['konten.media wajib berupa teks maksimal 255 karakter.'];
        }

        if (! self::mediaAman($media)) {
            return ['konten.media wajib berupa path internal (mis. /media/gambar.png) atau URL https dari host yang diizinkan sistem.'];
        }

        return [];
    }

    /**
     * Apakah alamat media boleh dipakai: path internal same-origin, atau URL
     * `https` pada host aplikasi/allowlist.
     */
    private static function mediaAman(string $media): bool
    {
        $media = trim($media);

        if ($media === '') {
            return true;
        }

        // Path internal: satu garis miring di depan, bukan `//host` (protocol-relative).
        if (str_starts_with($media, '/')) {
            return ! str_starts_with($media, '//');
        }

        $bagian = parse_url($media);

        if ($bagian === false || ($bagian['scheme'] ?? '') !== 'https') {
            return false;
        }

        $host = strtolower((string) ($bagian['host'] ?? ''));

        return $host !== '' && in_array($host, self::hostMediaDiizinkan(), true);
    }

    /**
     * Host yang diizinkan memuat gambar soal: host aplikasi sendiri + allowlist
     * `media.hosts` (env `MEDIA_HOSTS`).
     *
     * @return array<int, string>
     */
    private static function hostMediaDiizinkan(): array
    {
        $host = [strtolower((string) parse_url((string) config('app.url'), PHP_URL_HOST))];

        foreach ((array) config('media.hosts', []) as $satu) {
            $host[] = strtolower((string) $satu);
        }

        return array_values(array_unique(array_filter($host)));
    }

    /**
     * MathML template (opsional) — disimpan apa adanya, dirender klien.
     *
     * @param  array<string, mixed>  $konten
     * @return array<int, string>
     */
    public static function galatMatematika(array $konten): array
    {
        $mathml = $konten['matematika'] ?? null;

        if ($mathml === null || $mathml === '') {
            return [];
        }

        if (! is_string($mathml) || mb_strlen($mathml) > 2000) {
            return ['konten.matematika wajib berupa teks MathML maksimal 2000 karakter.'];
        }

        return [];
    }
}
