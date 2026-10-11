<?php

declare(strict_types=1);

namespace App\Sections\Material\Services;

use App\Sections\Material\Enums\StatusUnggahan;
use App\Sections\Material\Models\BlokMateri;
use App\Sections\Material\Models\Materi;
use App\Sections\Material\Models\UnggahanMateri;
use App\Sections\Material\Registry\TemaPerjalanan;

/**
 * Perjalanan materi: tema yang dipilih guru + langkah (pos) yang sudah dilewati
 * seorang murid.
 *
 * Dua pekerjaan kelas ini:
 *
 * 1. **Menjaga pilihan guru tetap sah** — kode tema harus ada di registry, nama
 *    dipangkas, dan video latar hanya boleh berkas yang benar-benar milik materi
 *    ini dan sudah selesai diunggah. Tanpa itu, satu kode sembarangan bisa
 *    membuat peta murid kosong.
 * 2. **Menyusun peta perjalanan** untuk layar murid dan laporan guru dari data
 *    yang sama, sehingga "pos 3 dari 6" di layar anak persis sama dengan yang
 *    dilihat guru — tidak ada dua perhitungan berbeda yang bisa berselisih.
 *
 * Urutan langkah mengikuti **urutan tayang** (titik mulai di timeline, lalu
 * urutan simpan), sama seperti urutan membuka blok di server. Jadi peta anak
 * tidak pernah menampilkan pos yang berbeda dari yang boleh dibukanya.
 */
class TemaMateriService
{
    public function __construct(private readonly PenyimpananMateri $penyimpanan) {}

    /**
     * Pilihan tema dari editor, siap disimpan ke kolom `tema`.
     *
     * @param  array<string, mixed>  $mentah
     * @return array{kode: string, nama: string, video_kode: string|null}
     */
    public function siapkan(Materi $materi, array $mentah): array
    {
        $tema = TemaPerjalanan::normalkan($mentah);

        if ($tema['video_kode'] !== null) {
            $ada = UnggahanMateri::query()
                ->where('kode', $tema['video_kode'])
                ->where('material_id', $materi->getKey())
                ->where('status', StatusUnggahan::Selesai->value)
                ->exists();

            // Berkas asing/ belum jadi cukup diabaikan (peta tetap tampil dengan
            // animasi bawaan), bukan menggagalkan seluruh penyimpanan susunan.
            $tema['video_kode'] = $ada ? $tema['video_kode'] : null;
        }

        return $tema;
    }

    /**
     * Seluruh langkah perjalanan materi ini, urut tayang. Dipakai laporan guru
     * untuk memberi judul kolom tanpa menghitung ulang per murid.
     *
     * @param  iterable<int, BlokMateri>  $blok
     * @return array<int, array{block_id: int, nomor: int, nama: string, ikon: string, warna: string, bawaan: string, wajib: bool}>
     */
    public function langkah(iterable $blok, ?array $tema): array
    {
        $hasil = [];

        foreach ($this->urutTayang($blok) as $indeks => $satu) {
            $isi = is_array($satu->isi) ? $satu->isi : [];
            $fase = TemaPerjalanan::langkah($tema, $indeks, $isi['fase'] ?? null);

            $hasil[] = [
                'block_id' => (int) $satu->getKey(),
                'nomor' => $indeks + 1,
                'nama' => $fase['nama'],
                'ikon' => $fase['ikon'],
                'warna' => $fase['warna'],
                'bawaan' => $fase['bawaan'],
                'wajib' => (bool) $satu->wajib,
            ];
        }

        return $hasil;
    }

    /**
     * Peta perjalanan seorang murid pada satu materi.
     *
     * @param  array<int, string>  $statusPerBlok  block_id => status progres
     * @return array<string, mixed>
     */
    public function perjalanan(Materi $materi, array $statusPerBlok): array
    {
        $konfigurasi = TemaPerjalanan::konfigurasi($materi->tema);
        $langkah = [];

        foreach ($this->langkah($materi->blok, $materi->tema) as $satu) {
            $status = $statusPerBlok[$satu['block_id']] ?? 'belum';

            $langkah[] = $satu + [
                'status' => $status,
                'selesai' => $status === 'selesai',
            ];
        }

        // Kenaikan dihitung dari langkah WAJIB: itulah jalur yang harus ditempuh
        // anak. Langkah opsional tetap tampil di peta sebagai jalan pintas, tapi
        // tidak pernah menahan kenaikan tingkat.
        $dasar = array_values(array_filter($langkah, static fn (array $satu): bool => $satu['wajib']));

        if ($dasar === []) {
            $dasar = $langkah;
        }

        $selesai = count(array_filter($dasar, static fn (array $satu): bool => $satu['selesai']));
        $total = count($dasar);
        $persen = $total > 0 ? (int) round($selesai / $total * 100) : 0;
        $tuntas = $total > 0 && $selesai === $total;

        $posisi = 0;

        foreach ($dasar as $satu) {
            if (! $satu['selesai']) {
                $posisi = $satu['nomor'];
                break;
            }
        }

        if ($posisi === 0) {
            $posisi = $total > 0 ? (int) $dasar[$total - 1]['nomor'] : 0;
        }

        $tingkat = TemaPerjalanan::tingkat($materi->tema, $persen);

        return [
            'kode' => $konfigurasi['kode'],
            'nama' => $konfigurasi['nama'],
            // `true` = materi berjalan sebagai daftar bagian biasa tanpa peta.
            'tanpa' => (bool) $konfigurasi['tanpa'],
            'adegan' => $konfigurasi['adegan'],
            'satuan' => $konfigurasi['satuan'],
            'deskripsi' => $konfigurasi['deskripsi'],
            'video_url' => $this->videoUrl($materi),
            'langkah' => $langkah,
            'jumlah_langkah' => count($langkah),
            'posisi' => $posisi,
            'selesai' => $selesai,
            'total' => $total,
            'persen' => $persen,
            'tuntas' => $tuntas,
            'tingkat' => [
                'nomor' => $tingkat['nomor'],
                'nama' => $tingkat['nama'],
                'min' => $tingkat['min'],
                'puncak' => $tingkat['puncak'],
            ],
            'tingkat_berikut' => $tingkat['berikut'] === null ? null : [
                'nomor' => $tingkat['berikut']['nomor'],
                'nama' => $tingkat['berikut']['nama'],
                'min' => $tingkat['berikut']['min'],
                'sisa' => $tingkat['sisa'],
            ],
        ];
    }

    /**
     * Video latar tema (bila guru mengunggahnya) sebagai URL bertanda tangan.
     */
    private function videoUrl(Materi $materi): ?string
    {
        $kode = TemaPerjalanan::normalkan($materi->tema)['video_kode'];

        if ($kode === null) {
            return null;
        }

        $unggahan = UnggahanMateri::query()
            ->where('kode', $kode)
            ->where('material_id', $materi->getKey())
            ->where('status', StatusUnggahan::Selesai->value)
            ->first();

        return $unggahan === null ? null : $this->penyimpanan->urlBertandaTangan($unggahan);
    }

    /**
     * Blok urut tayang: titik mulai di timeline lebih dulu, seri → urutan simpan.
     *
     * @param  iterable<int, BlokMateri>  $blok
     * @return array<int, BlokMateri>
     */
    private function urutTayang(iterable $blok): array
    {
        $daftar = [];

        foreach ($blok as $satu) {
            $daftar[] = $satu;
        }

        usort($daftar, function (BlokMateri $a, BlokMateri $b): int {
            $selisih = $this->mulai($a) <=> $this->mulai($b);

            return $selisih !== 0 ? $selisih : ($a->urutan <=> $b->urutan);
        });

        return $daftar;
    }

    private function mulai(BlokMateri $blok): float
    {
        return (float) (is_array($blok->isi) ? ($blok->isi['mulai_detik'] ?? 0) : 0);
    }
}
