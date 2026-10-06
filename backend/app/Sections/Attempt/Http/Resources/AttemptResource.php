<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Http\Resources;

use App\Sections\Attempt\Models\Attempt;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

/**
 * Attempt untuk murid yang mengerjakan (dan guru yang memantau).
 *
 * Daftar soal diisi lewat properti `$soal` (hasil penyusunan service: sudah
 * diacak, tanpa kunci) — bukan `additional()` karena aplikasi ini memakai
 * `JsonResource::withoutWrapping()` dan `additional()` memaksa pembungkus "data".
 * `server_now` disertakan supaya timer klien bisa dikoreksi ke waktu server.
 *
 * @mixin Attempt
 */
class AttemptResource extends JsonResource
{
    /**
     * Soal siap kirim (urutan seed, tanpa kunci).
     *
     * @var array<int, array<string, mixed>>
     */
    public array $soal = [];

    /**
     * Jawaban yang sudah tersimpan di server (daftar {question_id, jawaban}),
     * hanya untuk pemilik attempt. Tanpa kunci jawaban.
     *
     * @var array<int, array{question_id: int, jawaban: mixed}>
     */
    public array $jawaban = [];

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
            'attempt_no' => $this->attempt_no,
            'asli' => $this->asli,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'judul_kuis' => $this->whenLoaded('kuis', fn () => $this->kuis->judul),
            'mapel_nama' => $this->whenLoaded('kuis', fn () => $this->kuis->mapel?->nama),
            'kelas_nama' => $this->whenLoaded('kuis', fn () => $this->kuis->kelas?->nama),
            'durasi_menit' => $this->whenLoaded('kuis', fn () => $this->kuis->durasi_menit),
            'mulai_at' => $this->mulai_at?->toIso8601String(),
            'deadline_at' => $this->deadline_at?->toIso8601String(),
            'server_now' => Carbon::now()->toIso8601String(),
            'sisa_detik' => $this->sisaDetik(),
            'terlambat' => $this->terlambat,
            'jumlah_soal' => $this->jumlah_soal,
            'skor' => $this->skor,
            'skor_maksimal' => $this->skor_maksimal,
            'jumlah_benar' => $this->jumlah_benar,
            'dikumpulkan_at' => $this->dikumpulkan_at?->toIso8601String(),
            'soal' => $this->soal,
            'jawaban' => $this->jawaban,
        ];
    }
}
