<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Models;

use App\Sections\School\Models\Murid;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Riwayat versi satu jawaban (slice 09-C) — hanya dicatat pada mode tim.
 *
 * Jawaban bersama gampang berubah saat beberapa anak memegang satu perangkat,
 * jadi tiap perubahan disimpan sebagai versi baru: guru bisa melihat nilai yang
 * dikirim tiap versi dan siapa yang mengubahnya.
 */
#[Fillable(['attempt_id', 'question_id', 'student_id', 'versi', 'jawaban'])]
class RevisiJawaban extends Model
{
    protected $table = 'answer_revisions';

    protected $casts = [
        'versi' => 'integer',
        'jawaban' => 'array',
    ];

    /** @return BelongsTo<Attempt, $this> */
    public function attempt(): BelongsTo
    {
        return $this->belongsTo(Attempt::class, 'attempt_id');
    }

    /** @return BelongsTo<Murid, $this> */
    public function murid(): BelongsTo
    {
        return $this->belongsTo(Murid::class, 'student_id');
    }
}
