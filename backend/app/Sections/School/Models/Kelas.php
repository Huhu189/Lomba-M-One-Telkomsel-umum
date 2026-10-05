<?php

declare(strict_types=1);

namespace App\Sections\School\Models;

use Database\Factories\KelasFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Kelas — FK ke sekolah NOT NULL.
 */
#[Fillable(['school_id', 'nama', 'tingkat', 'tahun_ajaran'])]
class Kelas extends Model
{
    /** @use HasFactory<KelasFactory> */
    use HasFactory;

    protected static function newFactory(): KelasFactory
    {
        return KelasFactory::new();
    }

    protected $table = 'classes';

    protected $casts = [
        'tingkat' => 'integer',
    ];

    /** @return BelongsTo<Sekolah, $this> */
    public function sekolah(): BelongsTo
    {
        return $this->belongsTo(Sekolah::class, 'school_id');
    }

    /** @return HasMany<Murid, $this> */
    public function murid(): HasMany
    {
        return $this->hasMany(Murid::class, 'class_id');
    }
}
