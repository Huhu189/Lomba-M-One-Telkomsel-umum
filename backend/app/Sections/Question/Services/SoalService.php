<?php

declare(strict_types=1);

namespace App\Sections\Question\Services;

use App\Models\User;
use App\Sections\Attempt\Models\Jawaban;
use App\Sections\Question\Enums\TipeSoal;
use App\Sections\Question\Models\Soal;
use App\Sections\Question\Registry\RegistryTipeSoal;
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
     * Simpan perubahan soal.
     *
     * **Kebijakan 12 Oktober 2026** (permintaan pemilik produk: *"soal boleh
     * diubah di tengah-tengah quiz"*): soal yang dipakai kuis **sedang berjalan**
     * tetap boleh diperbaiki **isinya** — guru sering menemukan salah ketik, opsi
     * yang membingungkan, atau gambar yang salah pasang saat ulangan sudah jalan.
     *
     * Yang **tidak** boleh berubah di tengah ulangan adalah **kunci jawaban,
     * skor, dan jenis soal**: ketiganya menentukan penilaian, dan mengubahnya
     * berarti menilai murid dengan aturan yang belum pernah ia lihat — nilai yang
     * sudah masuk jadi tidak bisa dipertanggungjawabkan. Opsi/kata yang menjadi
     * kunci juga tidak boleh dihapus dari isi (dijaga registry tipe soal), karena
     * penilaian attempt yang sedang berjalan kehilangan acuannya.
     *
     * @param  array<string, mixed>  $data
     */
    public function perbarui(Soal $soal, array $data): Soal
    {
        $data = $this->rapikan($data);

        if ($soal->terkunci()) {
            $this->pastikanPerubahanAmanSaatBerjalan($soal, $data);
        }

        $soal->fill($data)->save();

        return $soal->refresh();
    }

    /**
     * Menghapus soal tetap terkunci selama kuis pemakainya berjalan: FK `answers`
     * memakai `cascadeOnDelete`, jadi soal yang hilang ikut menghapus jawaban
     * murid yang sedang mengerjakan (lihat {@see pastikanBelumDijawab}).
     */
    public function hapus(Soal $soal): void
    {
        $this->pastikanTidakDipakaiKuisBerjalan($soal);
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
     * Soal tidak boleh dihapus saat kuis pemakainya sedang berjalan.
     *
     * @throws ValidationException
     */
    public function pastikanTidakDipakaiKuisBerjalan(Soal $soal): void
    {
        if (! $soal->terkunci()) {
            return;
        }

        throw ValidationException::withMessages([
            'soal' => 'Soal tidak bisa dihapus karena dipakai kuis yang sedang berjalan. Kalau soal ini memang tidak dipakai, nonaktifkan saja setelah ulangannya selesai.',
        ]);
    }

    /**
     * Aturan "hanya isi" saat kuis sedang berjalan (lihat {@see perbarui}).
     *
     * @param  array<string, mixed>  $data  data yang sudah dirapikan
     *
     * @throws ValidationException
     */
    private function pastikanPerubahanAmanSaatBerjalan(Soal $soal, array $data): void
    {
        // Jenis soal diperiksa paling dulu: mengubahnya selalu ikut mengubah
        // kunci, dan pesan "jenis soal" lebih tepat daripada "kunci jawaban".
        $tipeBaru = $data['tipe'] ?? null;
        $nilaiTipeBaru = $tipeBaru instanceof TipeSoal ? $tipeBaru->value : (is_string($tipeBaru) ? $tipeBaru : null);

        if ($nilaiTipeBaru !== null && $nilaiTipeBaru !== $soal->tipeAman()?->value) {
            throw ValidationException::withMessages([
                'tipe' => 'Jenis soal tidak bisa diubah saat kuis sedang berjalan.',
            ]);
        }

        if (array_key_exists('kunci', $data) && $data['kunci'] != $soal->kunciSebagaiArray()) {
            throw ValidationException::withMessages([
                'kunci' => 'Kunci jawaban tidak bisa diubah saat kuis sedang berjalan. Tulisan dan opsi soal boleh diperbaiki; kunci baru berlaku untuk ulangan berikutnya.',
            ]);
        }

        if (array_key_exists('skor', $data) && (int) $data['skor'] !== (int) $soal->skor) {
            throw ValidationException::withMessages([
                'skor' => 'Skor soal tidak bisa diubah saat kuis sedang berjalan, karena nilai murid yang sudah masuk dihitung dengan skor lama.',
            ]);
        }

        // Kunci lama harus tetap "masuk" ke isi baru: opsi/kata yang menjadi kunci
        // tidak boleh hilang, kalau tidak penilaian attempt yang sedang berjalan
        // kehilangan acuannya. Pemeriksaannya milik registry tipe soal, jadi semua
        // jenis soal memakai aturan yang sama seperti saat menyimpan biasa.
        $tipe = $soal->tipeAman();

        if ($tipe === null) {
            return;
        }

        $kontenBaru = $data['konten'] ?? null;
        $galat = RegistryTipeSoal::penangan($tipe)->validasiKunci(
            is_array($kontenBaru) ? $kontenBaru : $soal->kontenSebagaiArray(),
            $soal->kunciSebagaiArray(),
        );

        if ($galat !== []) {
            throw ValidationException::withMessages([
                'konten' => 'Kuis sedang berjalan, jadi bagian yang menjadi kunci jawaban tidak boleh dihapus: '.implode(' ', $galat),
            ]);
        }
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
