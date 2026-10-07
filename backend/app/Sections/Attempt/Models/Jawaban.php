<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Models;

use App\Sections\Question\Models\Soal;
use App\Sections\School\Models\Murid;
use App\Sections\Scoring\Enums\StatusPenilaian;
use App\Sections\Scoring\Enums\StatusSaranAi;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Jawaban satu soal pada satu attempt. `status` = hasil penilaian per soal.
 */
#[Fillable([
    'attempt_id', 'question_id', 'penjawab_id', 'versi', 'jawaban', 'status', 'benar', 'skor', 'dinilai_at',
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
        // Mode tim (slice 09-C): siapa yang terakhir mengubah + versi keberapa.
        'penjawab_id' => 'integer',
        'versi' => 'integer',
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

    /** Murid yang terakhir menulis jawaban ini (mode tim).
     *
     * @return BelongsTo<Murid, $this>
     */
    public function penjawab(): BelongsTo
    {
        return $this->belongsTo(Murid::class, 'penjawab_id');
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
