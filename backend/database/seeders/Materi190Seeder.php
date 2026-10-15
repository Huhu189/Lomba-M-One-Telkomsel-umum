<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Sections\Material\Models\BlokMateri;
use App\Sections\Material\Models\Materi;
use App\Sections\Material\Registry\TemaPerjalanan;
use App\Sections\Material\Services\MateriService;
use App\Sections\Quiz\Models\Kuis;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;

/**
 * Materi yang dilihat pemilik produk di `/materi/190/editor` disempurnakan
 * menjadi **materi contoh yang utuh** (15 Oktober 2026).
 *
 * Kenapa ada: materi itu berisi SATU klip video unggahan
 * (“PROSES FOTOSINTESIS PADA TUMBUHAN…”, 5 menit 6 detik) tanpa penjelasan dan
 * tanpa latihan — guru yang membukanya tidak bisa melihat bagaimana sebuah
 * materi yang “jadi” seharusnya disusun (pos teks pembuka, latihan yang menjeda
 * video, penjelasan sesudah tiap latihan, ujian penutup). Materi acuan
 * `MateriContohSeeder` sudah punya semua itu; seeder ini memindahkan SUSUNANNYA
 * ke materi yang sedang dipakai sebagai contoh, sambil mempertahankan video
 * unggahan miliknya sendiri.
 *
 * Cara kerjanya:
 *
 * 1. `MateriContohSeeder` dijalankan lebih dulu — materi acuan + empat kuis
 *    latihannya (lengkap dengan soal, kunci, dan pembahasan) sudah pasti ada.
 * 2. Susunan blok dibaca dari materi acuan, lalu waktunya dihitung ulang untuk
 *    video milik materi ini.
 * 3. Titik latihan DI DALAM video diletakkan pada **posisi yang sama secara
 *    proporsional** (40/95/150 dari 185 detik ≈ 22%, 51%, 81%), karena video
 *    unggahan ini lebih panjang (306 detik) dan tidak ada cara memastikan isi
 *    detiknya dari sini. Guru tetap bisa menggeser titiknya di timeline editor.
 * 4. Disimpan lewat `MateriService::sinkronBlok` — bukan ditulis langsung ke
 *    tabel — supaya aturan yang sama dengan jalur guru tetap berlaku, lalu
 *    diterbitkan dan dibuka untuk semua kelas (`class_id` kosong).
 *
 * Jalankan sekali di basis data lokal:
 *
 *     php artisan db:seed --class=Materi190Seeder
 *
 * Sengaja TIDAK dipanggil `DatabaseSeeder`: ia bergantung pada materi yang sudah
 * ada (dibuat manual lewat aplikasi), jadi pemasangan baru tidak perlu tahu apa
 * pun tentangnya.
 */
class Materi190Seeder extends Seeder
{
    /** Materi contoh yang sedang dipakai pemilik produk (dibuat manual di aplikasi). */
    public const ID_MATERI = 190;

    /** Cadangan bila id-nya berubah tapi judulnya masih sama. */
    public const JUDUL_CADANGAN = 'Foto sintetis';

    /** Panjang tampilan pos teks/kuis di timeline (detik) — sama dengan materi acuan. */
    private const DURASI_POS = 20;

    /** Durasi tampilan satu latihan sisipan (detik). */
    private const DURASI_LATIHAN = 14;

    public function run(): void
    {
        $this->call(MateriContohSeeder::class);

        $materi = Materi::query()->find(self::ID_MATERI)
            ?? Materi::query()->where('judul', self::JUDUL_CADANGAN)->orderByDesc('id')->first();

        $acuan = Materi::query()->where('judul', MateriContohSeeder::JUDUL)->first();

        if ($materi === null || $acuan === null || $materi->is($acuan)) {
            return;
        }

        $blokAcuan = BlokMateri::query()
            ->where('material_id', $acuan->getKey())
            ->orderBy('urutan')
            ->get();

        // `tipe` di-cast ke enum `TipeBlok`, jadi membandingkannya dengan string
        // (— termasuk lewat `firstWhere`) tidak pernah cocok.
        $mediaAcuan = $blokAcuan->first(
            static fn (BlokMateri $satu): bool => $satu->tipe->value === 'media',
        );

        if ($mediaAcuan === null) {
            return;
        }

        $video = $this->videoMateri($materi) ?? [
            'tautan' => (string) ($mediaAcuan->isi['tautan'] ?? ''),
            'unggahan_kode' => '',
            'durasi' => (float) ($mediaAcuan->isi['durasi_detik'] ?? 185),
            'keterangan' => (string) ($mediaAcuan->isi['keterangan'] ?? ''),
        ];

        $durasiAcuan = (float) ($mediaAcuan->isi['durasi_detik'] ?? 185);

        $blok = $this->susunUlang($blokAcuan, $mediaAcuan, $video, $durasiAcuan);

        if ($blok === []) {
            return;
        }

        // Kuis latihan di dalam materi ini harus sepakat soal kelas dengan
        // materinya: materinya dibuka untuk semua kelas (`class_id` kosong), jadi
        // kuisnya juga. Kalau dibiarkan terikat satu kelas, aturan
        // `MateriService::validasiKuis` menolak blok kuisnya — dan itu memang
        // benar: latihan tidak boleh muncul di kelas yang bukan pemiliknya.
        $idKuis = $blokAcuan->pluck('quiz_id')->filter()->all();

        if ($idKuis !== []) {
            Kuis::query()->whereIn('id', $idKuis)->update(['class_id' => null]);
        }

        // Materi contoh ini dibuka untuk semua kelas (15 Oktober 2026): yang perlu
        // dilihat adalah SUSUNAN materinya, bukan kelas mana yang berhak.
        $materi->fill([
            'class_id' => null,
            'tag_id' => $materi->tag_id ?? $acuan->tag_id,
            'deskripsi' => $materi->deskripsi ?: $acuan->deskripsi,
        ])->save();

        $namaTema = is_array($materi->tema) && is_string($materi->tema['nama'] ?? null)
            ? (string) $materi->tema['nama']
            : 'Mendaki Gunung Fotosintesis';

        app(MateriService::class)->sinkronBlok($materi, $blok, [
            'kode' => TemaPerjalanan::BAWAAN,
            'nama' => $namaTema,
        ]);

        app(MateriService::class)->publikasi($materi);
    }

    /**
     * Sumber video yang SUDAH ada di materi ini (unggahan/tautan), bila ada.
     *
     * @return array{tautan: string, unggahan_kode: string, durasi: float, keterangan: string}|null
     */
    private function videoMateri(Materi $materi): ?array
    {
        $blok = BlokMateri::query()
            ->where('material_id', $materi->getKey())
            ->where('tipe', 'media')
            ->orderBy('urutan')
            ->first();

        if ($blok === null) {
            return null;
        }

        $kode = (string) ($blok->isi['unggahan_kode'] ?? '');
        $tautan = (string) ($blok->isi['tautan'] ?? '');

        if ($kode === '' && $tautan === '') {
            return null;
        }

        return [
            'tautan' => $tautan,
            'unggahan_kode' => $kode,
            'durasi' => (float) ($blok->isi['durasi_detik'] ?? 0),
            'keterangan' => (string) ($blok->isi['keterangan'] ?? ''),
        ];
    }

    /**
     * Susunan blok materi acuan, dengan waktu dihitung ulang untuk video materi ini.
     *
     * @param  Collection<int, BlokMateri>  $blokAcuan
     * @param  array{tautan: string, unggahan_kode: string, durasi: float, keterangan: string}  $video
     * @return array<int, array<string, mixed>>
     */
    private function susunUlang(Collection $blokAcuan, BlokMateri $mediaAcuan, array $video, float $durasiAcuan): array
    {
        $awalVideo = (float) ($blokAcuan->first()?->isi['durasi_detik'] ?? self::DURASI_POS);
        $akhirVideo = $awalVideo + $video['durasi'];
        $blok = [];

        foreach ($blokAcuan as $satu) {
            $isi = is_array($satu->isi) ? $satu->isi : [];
            $jenis = $satu->tipe->value;
            $fase = is_string($isi['fase'] ?? null) ? $isi['fase'] : null;
            $mulai = (float) ($isi['mulai_detik'] ?? 0);

            $dasar = [
                'wajib' => (bool) $satu->wajib,
                'fase' => $fase,
                'track' => $isi['track'] ?? 0,
            ];

            if ($jenis === 'teks') {
                $blok[] = $dasar + [
                    'tipe' => 'teks',
                    'mulai_detik' => $mulai,
                    'durasi_detik' => (float) ($isi['durasi_detik'] ?? self::DURASI_POS),
                    'isi' => ['teks' => (string) ($isi['teks'] ?? '')],
                ];

                continue;
            }

            if ($jenis === 'media') {
                $blok[] = $dasar + [
                    'tipe' => 'media',
                    'mulai_detik' => $awalVideo,
                    'durasi_detik' => $video['durasi'],
                    'isi' => array_filter([
                        'tautan' => $video['tautan'],
                        'unggahan_kode' => $video['unggahan_kode'],
                        'keterangan' => $video['keterangan'],
                    ], static fn (string $nilai): bool => $nilai !== ''),
                    'tampilan' => $isi['tampilan'] ?? ['fit' => 'contain', 'fokus_x' => 50, 'fokus_y' => 50, 'zoom' => 1],
                ];

                continue;
            }

            // Kuis: yang jatuh DI DALAM klip video dipindahkan ke titik proporsional
            // yang sama; yang di ujung klip (ujian penutup) tetap di ujung klip.
            $diDalamVideo = $mulai < (float) ($mediaAcuan->isi['mulai_detik'] ?? 0) + $durasiAcuan;
            $selisih = $mulai - (float) ($mediaAcuan->isi['mulai_detik'] ?? 0);

            $blok[] = $dasar + [
                'tipe' => 'kuis',
                'quiz_id' => $satu->quiz_id,
                'mulai_detik' => $diDalamVideo && $durasiAcuan > 0
                    ? round($awalVideo + ($selisih / $durasiAcuan) * $video['durasi'], 2)
                    : $akhirVideo,
                'durasi_detik' => $diDalamVideo
                    ? self::DURASI_LATIHAN
                    : (float) ($isi['durasi_detik'] ?? self::DURASI_POS),
                'tampilan' => $isi['tampilan'] ?? ['mode' => 'jeda', 'tata' => 'vertikal', 'ringkasan' => true, 'kartu' => true],
                'isi' => ['penjelasan' => $isi['penjelasan'] ?? []],
            ];
        }

        return $blok;
    }
}
