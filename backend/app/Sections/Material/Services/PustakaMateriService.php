<?php

declare(strict_types=1);

namespace App\Sections\Material\Services;

use App\Sections\Material\Enums\TipeBlok;
use App\Sections\Material\Models\BlokMateri;
use App\Sections\Material\Models\Materi;
use App\Sections\Material\Models\UnggahanMateri;
use Illuminate\Support\Facades\DB;

/**
 * Pustaka berkas materi: membuang berkas **beserta seluruh rujukannya**.
 *
 * Guru boleh menghapus berkas dari pustaka materi (tombol "Hapus berkas" di
 * editor). Yang dihapus bukan cuma barisnya di `material_uploads`, tetapi juga
 * setiap klip, media penjelasan, dan video latar tema yang menunjuk berkas itu —
 * kalau rujukannya dibiarkan, susunan materi menyimpan kode berkas yang sudah
 * tidak ada dan penyimpanan berikutnya ditolak server
 * ("Berkas media belum selesai diunggah"). Jadi pembersihan di sini yang
 * menjaga pustaka dan susunan tetap sinkron.
 *
 * Aturan pembersihannya sengaja tegas dan bisa ditebak guru:
 * - klip media yang menunjuk berkas itu **dibuang** (klip tanpa berkas tidak
 *   punya arti, dan blok media memang wajib punya berkas);
 * - media penjelasan setelah kuis **dilepas**, teks penjelasannya tetap utuh;
 * - video latar tema kembali ke animasi bawaan.
 *
 * Cakupannya seluruh sekolah (bukan cuma materi pemilik berkas) karena kode
 * unggahan boleh dipakai lintas materi dalam satu sekolah.
 */
class PustakaMateriService
{
    public function __construct(private readonly PenyimpananMateri $penyimpanan) {}

    /**
     * Buang satu berkas dari pustaka materi.
     *
     * @return array{klip: int, penjelasan: int, tema: int} jumlah rujukan yang dibersihkan
     */
    public function buang(UnggahanMateri $unggahan): array
    {
        $kode = (string) $unggahan->kode;
        $sekolah = (int) $unggahan->school_id;

        return DB::transaction(function () use ($unggahan, $kode, $sekolah): array {
            $hasil = [
                'klip' => $this->buangKlipMedia($sekolah, $kode),
                'penjelasan' => $this->lepasMediaPenjelasan($sekolah, $kode),
                'tema' => $this->lepasVideoTema($sekolah, $kode),
            ];

            $this->penyimpanan->hapus($unggahan);

            return $hasil;
        });
    }

    /**
     * Klip media yang menunjuk berkas itu dibuang seluruhnya.
     *
     * Progres murid pada blok yang dibuang ikut terhapus lewat kunci asing
     * `material_progress.block_id` (cascade), jadi tidak ada baris progres yatim.
     */
    private function buangKlipMedia(int $sekolah, string $kode): int
    {
        $jumlah = 0;

        foreach ($this->blokMateriSekolah($sekolah, 'isi->unggahan_kode', $kode) as $blok) {
            if ($blok->tipe !== TipeBlok::Media) {
                continue;
            }

            $blok->delete();
            $jumlah++;
        }

        return $jumlah;
    }

    /**
     * Media pada penjelasan setelah kuis dilepas; teksnya dipertahankan.
     *
     * Bila penjelasannya memang cuma media (teksnya kosong), kunci `penjelasan`
     * dibuang sekalian — sama dengan arti "penjelasan kosong" di
     * `MateriService::validasiPenjelasan`.
     */
    private function lepasMediaPenjelasan(int $sekolah, string $kode): int
    {
        $jumlah = 0;

        foreach ($this->blokMateriSekolah($sekolah, 'isi->penjelasan->unggahan_kode', $kode) as $blok) {
            $isi = is_array($blok->isi) ? $blok->isi : [];
            $penjelasan = is_array($isi['penjelasan'] ?? null) ? $isi['penjelasan'] : [];
            $teks = (string) ($penjelasan['teks'] ?? '');

            if ($teks === '') {
                unset($isi['penjelasan']);
            } else {
                $isi['penjelasan'] = ['teks' => $teks, 'unggahan_kode' => null];
            }

            $blok->isi = $isi;
            $blok->save();
            $jumlah++;
        }

        return $jumlah;
    }

    /** Video latar tema yang memakai berkas itu kembali ke animasi bawaan. */
    private function lepasVideoTema(int $sekolah, string $kode): int
    {
        $jumlah = 0;

        $materi = Materi::query()
            ->where('school_id', $sekolah)
            ->where('tema->video_kode', $kode)
            ->get();

        foreach ($materi as $satu) {
            $tema = is_array($satu->tema) ? $satu->tema : [];
            $tema['video_kode'] = null;

            $satu->tema = $tema;
            $satu->save();
            $jumlah++;
        }

        return $jumlah;
    }

    /**
     * Blok di satu sekolah yang isi JSON-nya menunjuk `$nilai` pada jalur `$jalur`.
     *
     * @return iterable<int, BlokMateri>
     */
    private function blokMateriSekolah(int $sekolah, string $jalur, string $nilai): iterable
    {
        return BlokMateri::query()
            ->whereHas('materi', fn ($query) => $query->where('school_id', $sekolah))
            ->where($jalur, $nilai)
            ->get();
    }
}
