<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Models;

use App\Sections\Quiz\Models\Kuis;
use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Tim dalam kuis mode kelompok (slice 09-C). Satu tim = satu attempt bersama.
 */
#[Fillable(['school_id', 'quiz_id', 'nama'])]
class Tim extends Model
{
    protected $table = 'teams';

    /** @return BelongsTo<Sekolah, $this> */
    public function sekolah(): BelongsTo
    {
        return $this->belongsTo(Sekolah::class, 'school_id');
    }

    /** @return BelongsTo<Kuis, $this> */
    public function kuis(): BelongsTo
    {
        return $this->belongsTo(Kuis::class, 'quiz_id');
    }

    /** @return HasMany<AnggotaTim, $this> */
    public function keanggotaan(): HasMany
    {
        return $this->hasMany(AnggotaTim::class, 'team_id');
    }

    /** @return BelongsToMany<Murid, $this> */
    public function murid(): BelongsToMany
    {
        return $this->belongsToMany(Murid::class, 'team_members', 'team_id', 'student_id')
            ->withTimestamps();
    }
}
