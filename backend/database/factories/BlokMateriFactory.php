<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Sections\Material\Enums\TipeBlok;
use App\Sections\Material\Models\BlokMateri;
use App\Sections\Material\Models\Materi;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<BlokMateri>
 */
class BlokMateriFactory extends Factory
{
    protected $model = BlokMateri::class;

    public function definition(): array
    {
        return [
            'material_id' => Materi::factory(),
            'urutan' => 1,
            'tipe' => TipeBlok::Teks,
            'wajib' => true,
            'isi' => ['teks' => 'Bacalah penjelasan berikut dengan saksama.'],
            'quiz_id' => null,
        ];
    }

    public function teks(string $isi = 'Bacalah penjelasan berikut dengan saksama.'): static
    {
        return $this->state(fn () => [
            'tipe' => TipeBlok::Teks,
            'isi' => ['teks' => $isi],
        ]);
    }

    public function media(string $kode, string $keterangan = ''): static
    {
        return $this->state(fn () => [
            'tipe' => TipeBlok::Media,
            'isi' => ['unggahan_kode' => $kode, 'keterangan' => $keterangan],
        ]);
    }

    public function kuis(int $kuisId, bool $wajib = true): static
    {
        return $this->state(fn () => [
            'tipe' => TipeBlok::Kuis,
            'wajib' => $wajib,
            'isi' => null,
            'quiz_id' => $kuisId,
        ]);
    }
}
