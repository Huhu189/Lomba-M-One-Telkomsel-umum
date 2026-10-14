<?php

declare(strict_types=1);

namespace App\Sections\Material\Registry;

/**
 * Tautan media materi (14 Oktober 2026).
 *
 * Guru tidak lagi diwajibkan mengunggah berkas: klip media boleh menunjuk
 * **tautan** (`isi.tautan`) ke video YouTube, berkas Google Drive, atau berkas
 * media yang bisa diakses publik. Kelas ini MURNI — tanpa database, HTTP, atau
 * container — supaya bisa dipakai berulang oleh validasi (SinkronBlokRequest),
 * resource guru (BlokResource), dan payload murid (ProgresMateriService), serta
 * diuji langsung.
 *
 * **Kenapa sematannya dihitung di sini, bukan disimpan guru.** Guru menempel
 * alamat halaman yang ia kenal (`https://www.youtube.com/watch?v=…`), sedangkan
 * yang dipasang di halaman murid adalah alamat sematan resmi
 * (`https://www.youtube-nocookie.com/embed/…`). Kalau alamat sematan ikut
 * tersimpan dari klien, siapa pun bisa menyelipkan bingkai asing ke halaman
 * sekolah hanya dengan menulis `isi.sematan`. Karena itu hanya **alamat yang
 * sudah tersimpan** yang diterjemahkan di sini, dan hostingnya dibatasi daftar
 * tetap di bawah.
 *
 * Yang **tidak** dilakukan kelas ini: memastikan berkasnya benar-benar ada
 * (server tidak mengunduh tautan murid), dan memutar sematan saat materi
 * luring — dua hal itu disebut apa adanya di `docs/penjelasan-fitur.md`.
 */
final class TautanMedia
{
    /** Panjang maksimum tautan yang boleh disimpan (sama dengan aturan validasi). */
    public const MAKS = 500;

    /** Host sematan yang diizinkan (bingkai di halaman murid). */
    public const HOST_SEMATAN = ['www.youtube-nocookie.com', 'drive.google.com'];

    /**
     * Mime yang dikenali dari ekstensi berkas tautan langsung.
     *
     * Hanya berkas jenis inilah yang dirender pemutar bawaan (`<video>`,
     * `<img>`, `<audio>`); tautan halaman biasa tetap bisa dibuka murid lewat
     * tautan, tetapi tidak disematkan sebagai bingkai.
     *
     * @var array<string, string>
     */
    private const MIME = [
        'mp4' => 'video/mp4',
        'm4v' => 'video/mp4',
        'webm' => 'video/webm',
        'ogv' => 'video/ogg',
        'mp3' => 'audio/mpeg',
        'wav' => 'audio/wav',
        'm4a' => 'audio/mp4',
        'oga' => 'audio/ogg',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'webp' => 'image/webp',
        'gif' => 'image/gif',
        'avif' => 'image/avif',
        'pdf' => 'application/pdf',
    ];

    /**
     * Tautan yang boleh disimpan: **https**, host publik ber titik, tanpa
     * kredensial di dalam alamat, dan tidak menyebut mesin lokal.
     *
     * `http` ditolak karena halaman sekolah berjalan di https (campuran konten
     * akan diblokir peramban), dan alamat lokal ditolak supaya tautan materi
     * tidak bisa dipakai memindai jaringan sekolah dari sisi peramban murid.
     */
    public static function aman(string $tautan): bool
    {
        $tautan = trim($tautan);

        if ($tautan === '' || mb_strlen($tautan) > self::MAKS) {
            return false;
        }

        $bagian = parse_url($tautan);

        if (! is_array($bagian) || ($bagian['scheme'] ?? '') !== 'https') {
            return false;
        }

        // Kredensial di dalam alamat (`https://user:sandi@host/…`) sering dipakai
        // menyamarkan tujuan sebenarnya — tidak pernah dibutuhkan untuk media.
        if (($bagian['user'] ?? '') !== '' || ($bagian['pass'] ?? '') !== '') {
            return false;
        }

        $host = strtolower((string) ($bagian['host'] ?? ''));

        if ($host === '' || ! str_contains($host, '.') || str_ends_with($host, '.local')) {
            return false;
        }

        // Alamat IP privat/terpesan (10.x, 192.168.x, 169.254.x, ::1, …) ditolak.
        if (filter_var($host, FILTER_VALIDATE_IP) !== false) {
            return filter_var(
                $host,
                FILTER_VALIDATE_IP,
                FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE,
            ) !== false;
        }

        return true;
    }

    /**
     * Jenis tautan: `youtube`, `drive`, `berkas` (berkas media langsung), atau
     * `lain` (halaman biasa yang hanya bisa dibuka lewat tautan).
     */
    public static function jenis(string $tautan): string
    {
        if (self::idYoutube($tautan) !== null) {
            return 'youtube';
        }

        if (self::idDrive($tautan) !== null) {
            return 'drive';
        }

        return self::mime($tautan) === null ? 'lain' : 'berkas';
    }

    /**
     * Alamat sematan (embed) bila tautan ini boleh dipasang sebagai bingkai di
     * halaman murid; `null` bila tidak boleh/disematkan.
     *
     * Semua alamat yang dikembalikan di sini hostnya ada di `HOST_SEMATAN` —
     * guru tidak pernah bisa menulis host bingkai sendiri.
     */
    public static function sematan(string $tautan): ?string
    {
        $id = self::idYoutube($tautan);

        if ($id !== null) {
            // `youtube-nocookie.com`: mode privasi YouTube (tanpa cookie pelacak
            // sampai video diputar) — dipakai supaya halaman sekolah tidak
            // menempelkan cookie pihak ketiga untuk murid yang belum menonton.
            return 'https://www.youtube-nocookie.com/embed/'.$id;
        }

        $id = self::idDrive($tautan);

        if ($id !== null) {
            return 'https://drive.google.com/file/'.$id.'/preview';
        }

        return null;
    }

    /**
     * Mime berkas media dari ekstensinya; `null` bila tautannya bukan berkas
     * media yang dikenal (mis. halaman HTML).
     */
    public static function mime(string $tautan): ?string
    {
        $jalur = strtolower(rawurldecode((string) parse_url(trim($tautan), PHP_URL_PATH)));
        $ekstensi = pathinfo($jalur, PATHINFO_EXTENSION);

        return self::MIME[$ekstensi] ?? null;
    }

    /**
     * Nama yang ditampilkan ke guru & murid: nama berkasnya bila ada, atau nama
     * hostnya (mis. `www.youtube.com`) untuk tautan halaman.
     */
    public static function nama(string $tautan): string
    {
        $tautan = trim($tautan);
        $jalur = rawurldecode((string) parse_url($tautan, PHP_URL_PATH));
        $nama = basename($jalur);

        if ($nama !== '' && str_contains($nama, '.')) {
            return mb_substr($nama, 0, 120);
        }

        $host = (string) parse_url($tautan, PHP_URL_HOST);

        return $host === '' ? 'Tautan media' : mb_substr($host, 0, 120);
    }

    /**
     * Label kategori yang dibaca guru/murid (dipakai di ringkasan berkas).
     */
    public static function label(string $jenis): string
    {
        return match ($jenis) {
            'youtube' => 'Video YouTube',
            'drive' => 'Berkas Google Drive',
            'berkas' => 'Berkas tautan',
            default => 'Tautan media',
        };
    }

    /**
     * ID video YouTube dari bentuk alamat yang lazim dipakai guru.
     *
     * ID YouTube selalu 11 karakter (`[A-Za-z0-9_-]`); bentuk yang tidak cocok
     * dianggap bukan tautan YouTube, jadi tidak pernah disematkan.
     */
    private static function idYoutube(string $tautan): ?string
    {
        $tautan = trim($tautan);
        $host = strtolower((string) parse_url($tautan, PHP_URL_HOST));
        $jalur = (string) parse_url($tautan, PHP_URL_PATH);
        $kueri = [];
        parse_str((string) parse_url($tautan, PHP_URL_QUERY), $kueri);

        $kandidat = null;

        if (in_array($host, ['youtu.be', 'www.youtu.be'], true)) {
            $kandidat = ltrim($jalur, '/');
            $kandidat = explode('/', $kandidat)[0];
        } elseif (in_array($host, ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'], true)) {
            $potongan = array_values(array_filter(explode('/', $jalur), static fn (string $satu): bool => $satu !== ''));

            if (isset($potongan[0], $potongan[1]) && in_array($potongan[0], ['embed', 'shorts', 'live', 'v'], true)) {
                $kandidat = $potongan[1];
            } elseif (is_string($kueri['v'] ?? null)) {
                $kandidat = $kueri['v'];
            }
        }

        if (! is_string($kandidat) || preg_match('/^[A-Za-z0-9_-]{11}$/', $kandidat) !== 1) {
            return null;
        }

        return $kandidat;
    }

    /**
     * ID berkas Google Drive dari bentuk alamat `/file/d/{id}/…` atau `?id={id}`.
     */
    private static function idDrive(string $tautan): ?string
    {
        $tautan = trim($tautan);
        $host = strtolower((string) parse_url($tautan, PHP_URL_HOST));

        if (! in_array($host, ['drive.google.com', 'docs.google.com'], true)) {
            return null;
        }

        $jalur = (string) parse_url($tautan, PHP_URL_PATH);
        $kueri = [];
        parse_str((string) parse_url($tautan, PHP_URL_QUERY), $kueri);

        $kandidat = null;

        if (preg_match('#/d/([A-Za-z0-9_-]{10,})#', $jalur, $cocok) === 1) {
            $kandidat = $cocok[1];
        } elseif (is_string($kueri['id'] ?? null)) {
            $kandidat = $kueri['id'];
        }

        if (! is_string($kandidat) || preg_match('/^[A-Za-z0-9_-]{10,}$/', $kandidat) !== 1) {
            return null;
        }

        return $kandidat;
    }
}
