<?php

declare(strict_types=1);

namespace App\Sections\Quiz\Services;

use App\Models\User;
use App\Sections\Question\Models\Soal;
use App\Sections\Question\Registry\RegistryTipeSoal;
use App\Sections\Quiz\Enums\StatusKuis;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\School\Models\Sekolah;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Kuis: penyimpanan, susunan soal, dan publikasi dengan validasi kelengkapan.
 */
class KuisService
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function simpan(Sekolah $sekolah, User $guru, array $data): Kuis
    {
        $kuis = new Kuis;
        $kuis->fill($this->rapikan($data) + [
            'school_id' => $sekolah->getKey(),
            'status' => StatusKuis::Draf,
            'dibuat_oleh' => $guru->getKey(),
        ])->save();

        return $kuis->refresh();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function perbarui(Kuis $kuis, array $data): Kuis
    {
        $kuis->fill($this->rapikan($data))->save();

        return $kuis->refresh();
    }

    /**
     * Susun ulang soal kuis (urutan mengikuti urutan id yang dikirim).
     *
     * @param  array<int, int|string>  $soalId
     *
     * @throws ValidationException
     */
    public function sinkronSoal(Kuis $kuis, array $soalId): Kuis
    {
        if ($kuis->sedangBerjalan()) {
            throw ValidationException::withMessages([
                'soal' => 'Susunan soal tidak bisa diubah saat kuis sedang berjalan.',
            ]);
        }

        $soalId = array_values(array_unique(array_map('intval', $soalId)));

        $jumlahSesuai = Soal::query()->whereIn('id', $soalId)->count();

        if ($jumlahSesuai !== count($soalId)) {
            throw ValidationException::withMessages([
                'soal' => 'Ada soal yang tidak ditemukan di bank soal.',
            ]);
        }

        DB::transaction(function () use ($kuis, $soalId): void {
            $kuis->soal()->detach();

            $baris = [];
            foreach ($soalId as $posisi => $id) {
                $baris[$id] = ['urutan' => $posisi + 1];
            }

            if ($baris !== []) {
                $kuis->soal()->attach($baris);
            }
        });

        return $kuis->refresh()->load('soal');
    }

    /**
     * Publikasikan kuis setelah memastikan kelengkapannya.
     *
     * @throws ValidationException
     */
    public function publikasi(Kuis $kuis): Kuis
    {
        $galat = $this->galatKelengkapan($kuis);

        if ($galat !== []) {
            throw ValidationException::withMessages($galat);
        }

        $kuis->status = StatusKuis::Publikasi;
        $kuis->publikasi_at = now();
        $kuis->save();

        return $kuis->refresh();
    }

    public function arsipkan(Kuis $kuis): Kuis
    {
        $kuis->status = StatusKuis::Arsip;
        $kuis->save();

        return $kuis->refresh();
    }

    public function hapus(Kuis $kuis): void
    {
        DB::transaction(function () use ($kuis): void {
            $kuis->soal()->detach();
            $kuis->delete();
        });
    }

    /**
     * Kuis siap terbit bila: ada soal aktif yang jenisnya dikenal mesin penilaian,
     * jadwal masuk akal, dan durasi wajar.
     *
     * Sejak slice 06 kedelapan jenis soal punya penangan (termasuk isian singkat
     * dan uraian yang dinilai berlapis), jadi penjaga di sini bukan lagi
     * "objektif saja" melainkan "jenisnya dikenal penilaian".
     *
     * @return array<string, string>
     */
    public function galatKelengkapan(Kuis $kuis): array
    {
        $galat = [];
        $soal = $kuis->soal()->get();

        if ($soal->isEmpty()) {
            $galat['soal'] = 'Kuis wajib punya minimal satu soal sebelum diterbitkan.';
        }

        // `tipeAman()` (bukan `tipe`) supaya baris soal dengan nilai tipe rusak
        // tidak melempar ValueError ke guru — cukup dilaporkan sebagai galat.
        $tanpaPenangan = $soal->reject(function (Soal $satu): bool {
            $tipe = $satu->tipeAman();

            return $tipe !== null && RegistryTipeSoal::dukung($tipe);
        });

        if ($tanpaPenangan->isNotEmpty()) {
            $galat['soal_tipe'] = 'Ada soal dengan jenis yang belum didukung mesin penilaian. Keluarkan soal itu dulu.';
        }

        $tidakAktif = $soal->reject(fn (Soal $satu): bool => $satu->aktif);

        if ($tidakAktif->isNotEmpty()) {
            $galat['soal_nonaktif'] = 'Ada soal nonaktif di susunan kuis. Aktifkan atau keluarkan dulu.';
        }

        if ($kuis->mulai_at === null || $kuis->selesai_at === null) {
            $galat['jadwal'] = 'Kuis wajib punya jadwal mulai dan selesai sebelum diterbitkan.';
        } elseif ($kuis->selesai_at->lessThanOrEqualTo($kuis->mulai_at)) {
            $galat['jadwal'] = 'Jadwal selesai wajib setelah jadwal mulai.';
        }

        if ($kuis->durasi_menit < 1) {
            $galat['durasi_menit'] = 'Durasi kuis minimal 1 menit.';
        }

        return $galat;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function rapikan(array $data): array
    {
        return Arr::only($data, [
            'subject_id', 'class_id', 'judul', 'deskripsi', 'mulai_at',
            'selesai_at', 'durasi_menit', 'acak_soal', 'acak_opsi',
        ]);
    }
}
