<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Models;

use App\Sections\Question\Models\Soal;
use App\Sections\Scoring\Enums\StatusPenilaian;
use App\Sections\Scoring\Enums\StatusSaranAi;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Jawaban satu soal pada satu attempt. `status` = hasil penilaian per soal.
 */
#[Fillable([
    'attempt_id', 'question_id', 'jawaban', 'status', 'benar', 'skor', 'dinilai_at',
    'skor_ai', 'alasan_ai', 'ai_status', 'ai_dinilai_at',
])]
class Jawaban extends Model
{
    protected $table = 'answers';

    protected $casts = [
        'jawaban' => 'array',
        'status' => StatusPenilaian::class,
        'benar' => 'boolean',
        'skor' => 'float',
        'dinilai_at' => 'datetime',
        'dinilai_manual' => 'boolean',
        // Saran AI: nilai saran terpisah dari `skor` supaya tidak pernah jadi final.
        'skor_ai' => 'float',
        'ai_status' => StatusSaranAi::class,
        'ai_dinilai_at' => 'datetime',
    ];

    /** @return BelongsTo<Attempt, $this> */
    public function attempt(): BelongsTo
    {
        return $this->belongsTo(Attempt::class, 'attempt_id');
    }

    /** @return BelongsTo<Soal, $this> */
    public function soal(): BelongsTo
    {
        return $this->belongsTo(Soal::class, 'question_id');
    }

    /**
     * Jawaban apa adanya untuk mesin penilai (array terbungkus agar JSON
     * skalar tetap bisa disimpan di kolom json).
     *
     * @return array<int, mixed>
     */
    public function nilaiJawaban(): array
    {
        $jawaban = $this->jawaban;

        return is_array($jawaban) ? $jawaban : [];
    }
}
