<?php

declare(strict_types=1);

namespace App\Sections\Material\Models;

use App\Sections\Attempt\Models\Attempt;
use App\Sections\Material\Enums\StatusProgres;
use App\Sections\School\Models\Murid;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Progres seorang murid pada satu blok materi.
 *
 * Baris ini juga menyimpan tautan ke attempt kuis sisipan (jenis latihan),
 * sehingga laporan tema bisa menghitung skor latihan tanpa menebak attempt
 * mana yang lahir dari blok mana.
 */
#[Fillable([
    'school_id', 'material_id', 'block_id', 'student_id', 'attempt_id',
    'status', 'skor', 'selesai_at',
])]
class ProgresMateri extends Model
{
    protected $table = 'material_progress';

    protected $casts = [
        'status' => StatusProgres::class,
        'skor' => 'float',
        'selesai_at' => 'datetime',
    ];

    /** @return BelongsTo<Materi, $this> */
    public function materi(): BelongsTo
    {
        return $this->belongsTo(Materi::class, 'material_id');
    }

    /** @return BelongsTo<BlokMateri, $this> */
    public function blok(): BelongsTo
    {
        return $this->belongsTo(BlokMateri::class, 'block_id');
    }

    /** @return BelongsTo<Murid, $this> */
    public function murid(): BelongsTo
    {
        return $this->belongsTo(Murid::class, 'student_id');
    }

    /** @return BelongsTo<Attempt, $this> */
    public function attempt(): BelongsTo
    {
        return $this->belongsTo(Attempt::class, 'attempt_id');
    }
}
