<?php

declare(strict_types=1);

namespace App\Sections\Question\Services;

use App\Models\User;
use App\Sections\Attempt\Models\Jawaban;
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
        $this->pastikanBelumDijawab($soal);

        $soal->delete();
    }

    /**
     * Soal yang sudah dijawab murid tidak boleh dihapus (Q-09).
     *
     * FK `answers.question_id` memakai `cascadeOnDelete`, jadi menghapus soal
     * ikut menghapus jawaban murid — nilai yang sudah dikerjakan hilang permanen
     * dan tidak bisa dipertanggungjawabkan ke murid maupun orang tuanya. Guru
     * yang ingin menarik soal cukup menonaktifkannya (`aktif = false`) supaya
     * riwayat nilainya tetap utuh. Penghapusan tetap mungkin selama soal belum
     * pernah dijawab siapa pun.
     *
     * @throws ValidationException
     */
    public function pastikanBelumDijawab(Soal $soal): void
    {
        if (! Jawaban::query()->where('question_id', $soal->getKey())->exists()) {
            return;
        }

        throw ValidationException::withMessages([
            'soal' => 'Soal ini sudah dijawab murid, jadi tidak bisa dihapus. Nonaktifkan saja agar riwayat nilainya tetap utuh.',
        ]);
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
