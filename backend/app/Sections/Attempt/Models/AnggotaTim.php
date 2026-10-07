<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Models;

use App\Sections\Quiz\Models\Kuis;
use App\Sections\School\Models\Murid;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Keanggotaan seorang murid pada satu tim (slice 09-C).
 *
 * `quiz_id` disimpan juga di sini supaya batas "satu murid satu tim per kuis"
 * bisa dijaga langsung oleh unique index, tanpa mengandalkan aplikasi.
 */
#[Fillable(['team_id', 'quiz_id', 'student_id'])]
class AnggotaTim extends Model
{
    protected $table = 'team_members';

    /** @return BelongsTo<Tim, $this> */
    public function tim(): BelongsTo
    {
        return $this->belongsTo(Tim::class, 'team_id');
    }

    /** @return BelongsTo<Kuis, $this> */
    public function kuis(): BelongsTo
    {
        return $this->belongsTo(Kuis::class, 'quiz_id');
    }

    /** @return BelongsTo<Murid, $this> */
    public function murid(): BelongsTo
    {
        return $this->belongsTo(Murid::class, 'student_id');
    }
}
