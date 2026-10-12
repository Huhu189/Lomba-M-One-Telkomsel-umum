<?php

declare(strict_types=1);

namespace App\Sections\Material\Registry;

/**
 * Katalog **tema perjalanan** materi.
 *
 * Materi bukan cuma urutan blok: tiap blok adalah satu LANGKAH perjalanan yang
 * dilihat anak sebagai peta beranimasi. Tema menentukan nama adegan, fase
 * (nama langkah) bawaan, dan tingkat (kenaikan) yang diraih saat langkah
 * bertambah.
 *
 * Kelas ini sengaja MURNI — tanpa database, config, atau container — supaya bisa
 * dipakai berulang oleh resource, service progres, laporan, dan diuji langsung.
 * Yang berhubungan dengan berkas (video latar) divalidasi di TemaMateriService.
 *
 * Semua aturan di sini hanyalah *tampilan*: server tetap penentu boleh-tidaknya
 * membuka langkah (ProgresMateriService) dan penilai skor latihan.
 */
final class TemaPerjalanan
{
    /** Tema yang dipakai bila guru belum memilih apa pun. */
    public const BAWAAN = 'mendaki-gunung';

    /**
     * Tema "tanpa peta": materi berjalan sebagai daftar bagian biasa — tidak ada
     * pos, tingkat, atau peta perjalanan di layar murid. Sengaja menjadi pilihan
     * yang HARUS dipilih guru secara sadar, karena baris `tema` yang kosong tetap
     * berarti tema bawaan (materi lama tidak boleh berubah sendiri).
     */
    public const TANPA = 'tanpa';

    /** Panjang maksimum nama tema yang boleh dipakai guru. */
    public const MAKS_NAMA = 60;

    /** Panjang maksimum nama satu langkah (pos) yang boleh dipakai guru. */
    public const MAKS_LANGKAH = 40;

    /**
     * Seluruh template yang tersedia. Urutan pertama = pilihan pertama di editor.
     *
     * @return array<int, array<string, mixed>>
     */
    public static function semua(): array
    {
        return [
            [
                'kode' => self::BAWAAN,
                'nama' => 'Mendaki Gunung',
                'deskripsi' => 'Naik dari basecamp ke puncak: tiap bagian materi jadi satu pos pendakian.',
                'adegan' => 'gunung',
                'satuan' => 'pos',
                'fase' => [
                    ['nama' => 'Basecamp', 'ikon' => 'tenda', 'warna' => 'hijau'],
                    ['nama' => 'Jalur Pinus', 'ikon' => 'pohon', 'warna' => 'hijau'],
                    ['nama' => 'Sungai Deras', 'ikon' => 'sungai', 'warna' => 'biru'],
                    ['nama' => 'Lereng Berbatu', 'ikon' => 'batu', 'warna' => 'coklat'],
                    ['nama' => 'Kabut Puncak', 'ikon' => 'kabut', 'warna' => 'kelabu'],
                    ['nama' => 'Puncak', 'ikon' => 'bendera', 'warna' => 'jingga'],
                ],
                'tingkat' => [
                    ['nomor' => 1, 'nama' => 'Pendaki Pemula', 'min' => 0],
                    ['nomor' => 2, 'nama' => 'Pendaki Terlatih', 'min' => 25],
                    ['nomor' => 3, 'nama' => 'Penjelajah Lereng', 'min' => 60],
                    ['nomor' => 4, 'nama' => 'Penakluk Puncak', 'min' => 100],
                ],
            ],
            [
                'kode' => 'harta-karun',
                'nama' => 'Harta Karun di Pulau',
                'deskripsi' => 'Berlayar dari dermaga sampai goa harta karun: tiap bagian materi jadi satu pos pelayaran.',
                'adegan' => 'pulau',
                'satuan' => 'pos',
                'fase' => [
                    ['nama' => 'Dermaga', 'ikon' => 'dermaga', 'warna' => 'coklat'],
                    ['nama' => 'Perahu Layar', 'ikon' => 'perahu', 'warna' => 'biru'],
                    ['nama' => 'Karang', 'ikon' => 'karang', 'warna' => 'kelabu'],
                    ['nama' => 'Pantai Berpasir', 'ikon' => 'pantai', 'warna' => 'jingga'],
                    ['nama' => 'Hutan Kelapa', 'ikon' => 'pohon', 'warna' => 'hijau'],
                    ['nama' => 'Goa Harta Karun', 'ikon' => 'peti', 'warna' => 'jingga'],
                ],
                'tingkat' => [
                    ['nomor' => 1, 'nama' => 'Pelaut Pemula', 'min' => 0],
                    ['nomor' => 2, 'nama' => 'Penjelajah Pulau', 'min' => 25],
                    ['nomor' => 3, 'nama' => 'Pemburu Harta', 'min' => 60],
                    ['nomor' => 4, 'nama' => 'Penemu Harta', 'min' => 100],
                ],
            ],
            [
                'kode' => 'luar-angkasa',
                'nama' => 'Luar Angkasa',
                'deskripsi' => 'Meluncur dari landasan sampai Bulan: tiap bagian materi jadi satu pos antariksa.',
                'adegan' => 'angkasa',
                'satuan' => 'pos',
                'fase' => [
                    ['nama' => 'Landasan Peluncuran', 'ikon' => 'roket', 'warna' => 'kelabu'],
                    ['nama' => 'Orbit Bumi', 'ikon' => 'bumi', 'warna' => 'biru'],
                    ['nama' => 'Sabuk Asteroid', 'ikon' => 'asteroid', 'warna' => 'coklat'],
                    ['nama' => 'Cincin Saturnus', 'ikon' => 'planet', 'warna' => 'jingga'],
                    ['nama' => 'Bulan', 'ikon' => 'bulan', 'warna' => 'kelabu'],
                    ['nama' => 'Bintang Jauh', 'ikon' => 'bintang', 'warna' => 'jingga'],
                ],
                'tingkat' => [
                    ['nomor' => 1, 'nama' => 'Astronaut Pemula', 'min' => 0],
                    ['nomor' => 2, 'nama' => 'Penjelajah Orbit', 'min' => 25],
                    ['nomor' => 3, 'nama' => 'Kapten Antariksa', 'min' => 60],
                    ['nomor' => 4, 'nama' => 'Penakluk Galaksi', 'min' => 100],
                ],
            ],
            // Ditaruh PALING AKHIR: `temukan()` memakai entri pertama sebagai
            // cadangan, jadi urutan ini menjaga tema bawaan tetap yang pertama.
            [
                'kode' => self::TANPA,
                'nama' => 'Tanpa tema',
                'deskripsi' => 'Materi berjalan sebagai daftar bagian biasa — tanpa peta, pos, atau tingkat.',
                'adegan' => 'polos',
                'satuan' => 'bagian',
                'fase' => [],
                'tingkat' => [],
            ],
        ];
    }

    /**
     * Template berdasar kode; kode tak dikenal jatuh ke tema bawaan.
     *
     * @return array<string, mixed>
     */
    public static function temukan(?string $kode): array
    {
        $semua = self::semua();
        $cari = $kode ?? self::BAWAAN;

        foreach ($semua as $satu) {
            if ($satu['kode'] === $cari) {
                return $satu;
            }
        }

        return $semua[0];
    }

    /** @return array<int, string> */
    public static function kodeSemua(): array
    {
        return array_map(static fn (array $satu): string => (string) $satu['kode'], self::semua());
    }

    /**
     * Pilihan guru atas nama tema + video latar, sudah dinormalkan.
     *
     * `null` (guru belum pernah memilih) berarti tema bawaan dengan nama
     * bawaannya — jadi setiap materi selalu punya perjalanan, bahkan materi lama
     * yang dibuat sebelum fitur ini ada.
     *
     * @param  array<string, mixed>|null  $mentah
     * @return array{kode: string, nama: string, video_kode: string|null}
     */
    public static function normalkan(?array $mentah): array
    {
        $mentah ??= [];
        $kode = is_string($mentah['kode'] ?? null) ? (string) $mentah['kode'] : self::BAWAAN;

        if (! in_array($kode, self::kodeSemua(), true)) {
            $kode = self::BAWAAN;
        }

        $template = self::temukan($kode);
        $nama = trim((string) ($mentah['nama'] ?? ''));

        if ($nama === '') {
            $nama = (string) $template['nama'];
        }

        $video = $mentah['video_kode'] ?? null;

        return [
            'kode' => $kode,
            'nama' => mb_substr($nama, 0, self::MAKS_NAMA),
            'video_kode' => is_string($video) && trim($video) !== '' ? mb_substr(trim($video), 0, 64) : null,
        ];
    }

    /**
     * Konfigurasi lengkap untuk klien: identitas tema + fase + tingkat.
     *
     * @param  array<string, mixed>|null  $tema
     * @return array<string, mixed>
     */
    public static function konfigurasi(?array $tema): array
    {
        $bersih = self::normalkan($tema);
        $template = self::temukan($bersih['kode']);

        return [
            'kode' => $bersih['kode'],
            'nama' => $bersih['nama'],
            'video_kode' => $bersih['video_kode'],
            'tanpa' => $bersih['kode'] === self::TANPA,
            'adegan' => (string) $template['adegan'],
            'satuan' => (string) $template['satuan'],
            'deskripsi' => (string) $template['deskripsi'],
            'fase' => $template['fase'],
            'tingkat' => $template['tingkat'],
        ];
    }

    /**
     * Nama + ikon untuk langkah ke-`$indeks` (0-based).
     *
     * Guru boleh mengganti nama satu langkah lewat `$override`; kalau kosong,
     * nama bawaan tema yang dipakai. Materi dengan lebih banyak blok daripada
     * fase template melanjutkan sendiri dengan nama "Pos n" supaya tidak ada
     * langkah tanpa nama.
     *
     * @param  array<string, mixed>|null  $tema
     * @param  mixed  $override  `isi.fase` blok dari guru
     * @return array{nama: string, ikon: string, warna: string, bawaan: string, diubah: bool}
     */
    public static function langkah(?array $tema, int $indeks, mixed $override = null): array
    {
        $template = self::temukan(self::normalkan($tema)['kode']);
        /** @var array<int, array<string, string>> $fase */
        $fase = $template['fase'];
        // Nama lanjutan mengikuti satuan tema ("Pos 7" untuk tema pendakian,
        // "Bagian 3" untuk materi tanpa peta) supaya tidak ada langkah tanpa nama.
        $namaBawaan = isset($fase[$indeks])
            ? (string) $fase[$indeks]['nama']
            : ucfirst((string) $template['satuan']).' '.($indeks + 1);

        $ikonBawaan = isset($fase[$indeks]) ? (string) $fase[$indeks]['ikon'] : 'tanda';
        $warnaBawaan = isset($fase[$indeks]) ? (string) $fase[$indeks]['warna'] : 'kelabu';

        $nama = is_string($override) ? trim($override) : '';

        if ($nama === '') {
            return [
                'nama' => $namaBawaan,
                'ikon' => $ikonBawaan,
                'warna' => $warnaBawaan,
                'bawaan' => $namaBawaan,
                'diubah' => false,
            ];
        }

        return [
            'nama' => mb_substr($nama, 0, self::MAKS_LANGKAH),
            'ikon' => $ikonBawaan,
            'warna' => $warnaBawaan,
            'bawaan' => $namaBawaan,
            'diubah' => true,
        ];
    }

    /**
     * Tingkat (kenaikan) untuk persentase perjalanan tertentu.
     *
     * @param  array<string, mixed>|null  $tema
     * @return array{nomor: int, nama: string, min: int, berikut: array{nomor: int, nama: string, min: int}|null, sisa: int, puncak: bool}
     */
    public static function tingkat(?array $tema, int $persen): array
    {
        $template = self::temukan(self::normalkan($tema)['kode']);
        /** @var array<int, array<string, mixed>> $daftar */
        $daftar = $template['tingkat'];
        $persen = max(0, min($persen, 100));

        // Materi tanpa peta tidak punya tingkat sama sekali: kembalikan tingkat
        // netral supaya pemanggil tidak perlu tahu soal tema.
        if ($daftar === []) {
            return [
                'nomor' => 1,
                'nama' => '',
                'min' => 0,
                'berikut' => null,
                'sisa' => 0,
                'puncak' => false,
            ];
        }

        $kini = $daftar[0];
        $berikut = null;

        foreach ($daftar as $indeks => $satu) {
            if ($persen >= (int) $satu['min']) {
                $kini = $satu;
                $berikut = $daftar[$indeks + 1] ?? null;
            }
        }

        return [
            'nomor' => (int) $kini['nomor'],
            'nama' => (string) $kini['nama'],
            'min' => (int) $kini['min'],
            'berikut' => $berikut === null ? null : [
                'nomor' => (int) $berikut['nomor'],
                'nama' => (string) $berikut['nama'],
                'min' => (int) $berikut['min'],
            ],
            'sisa' => $berikut === null ? 0 : max(0, (int) $berikut['min'] - $persen),
            'puncak' => $persen >= 100,
        ];
    }
}
