<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Http\Resources;

use App\Sections\Attempt\Models\Attempt;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Hasil ulangan murid: skor dan status per soal — TANPA kunci jawaban dan
 * tanpa pembahasan (chunk security: kunci tidak pernah dikirim ke klien).
 *
 * Rincian diisi lewat properti publik (bukan `additional()`, yang memaksa
 * pembungkus "data" karena aplikasi memakai `withoutWrapping()`).
 *
 * @mixin Attempt
 */
class AttemptHasilResource extends JsonResource
{
    /** @var array<int, array<string, mixed>> */
    public array $rincian = [];

    /** @var array<string, int> */
    public array $ringkasan = [];

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'quiz_id' => $this->quiz_id,
            'jenis' => $this->jenis->value,
            'jenis_label' => $this->jenis->label(),
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'judul_kuis' => $this->whenLoaded('kuis', fn () => $this->kuis->judul),
            'mapel_nama' => $this->whenLoaded('kuis', fn () => $this->kuis->mapel?->nama),
            'kelas_nama' => $this->whenLoaded('kuis', fn () => $this->kuis->kelas?->nama),
            'mulai_at' => $this->mulai_at?->toIso8601String(),
            'deadline_at' => $this->deadline_at?->toIso8601String(),
            'dikumpulkan_at' => $this->dikumpulkan_at?->toIso8601String(),
            'terlambat' => $this->terlambat,
            'skor' => $this->skor,
            'skor_maksimal' => $this->skor_maksimal,
            'jumlah_benar' => $this->jumlah_benar,
            'jumlah_soal' => $this->jumlah_soal,
            'per_soal' => $this->rincian,
            'ringkasan_penilaian' => $this->ringkasan,
        ];
    }
}
