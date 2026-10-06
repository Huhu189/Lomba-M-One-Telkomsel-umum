<?php

declare(strict_types=1);

namespace App\Sections\Question\Services;

use App\Models\User;
use App\Sections\Question\Enums\TipeSoal;
use App\Sections\Question\Models\Soal;
use App\Sections\School\Models\Sekolah;
use Illuminate\Support\Arr;
use Illuminate\Validation\ValidationException;

/**
 * Bank soal: penyimpanan soal dan penegakan aturan "soal terkunci saat kuis berjalan".
 */
class SoalService
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function simpan(Sekolah $sekolah, User $guru, array $data): Soal
    {
        $soal = new Soal;
        $soal->fill($this->rapikan($data) + [
            'school_id' => $sekolah->getKey(),
            'dibuat_oleh' => $guru->getKey(),
        ])->save();

        return $soal->refresh();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function perbarui(Soal $soal, array $data): Soal
    {
        $this->pastikanTidakTerkunci($soal);

        $soal->fill($this->rapikan($data))->save();

        return $soal->refresh();
    }

    public function hapus(Soal $soal): void
    {
        $this->pastikanTidakTerkunci($soal);

        $soal->delete();
    }

    /**
     * Soal tidak boleh diubah/dihapus saat kuis pemakainya sedang berjalan.
     *
     * @throws ValidationException
     */
    public function pastikanTidakTerkunci(Soal $soal): void
    {
        if (! $soal->terkunci()) {
            return;
        }

        throw ValidationException::withMessages([
            'soal' => 'Soal tidak bisa diubah karena dipakai kuis yang sedang berjalan.',
        ]);
    }

    /**
     * Hanya kolom yang boleh diisi klien; kunci tetap JSON tervalidasi.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function rapikan(array $data): array
    {
        $data = Arr::only($data, [
            'subject_id', 'tag_id', 'tipe', 'konten', 'kunci', 'pembahasan', 'skor', 'aktif',
        ]);

        if (isset($data['tipe']) && is_string($data['tipe'])) {
            $data['tipe'] = TipeSoal::from($data['tipe']);
        }

        return $data;
    }
}
