<?php

declare(strict_types=1);

namespace App\Sections\Question\Models;

use App\Sections\School\Models\Sekolah;
use Database\Factories\TagFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Tag soal — sekaligus tema pemahaman pada laporan (satu konsep).
 */
#[Fillable(['school_id', 'nama', 'deskripsi'])]
class Tag extends Model
{
    /** @use HasFactory<TagFactory> */
    use HasFactory;

    protected static function newFactory(): TagFactory
    {
        return TagFactory::new();
    }

    protected $table = 'tags';

    /** @return BelongsTo<Sekolah, $this> */
    public function sekolah(): BelongsTo
    {
        return $this->belongsTo(Sekolah::class, 'school_id');
    }

    /** @return HasMany<Soal, $this> */
    public function soal(): HasMany
    {
        return $this->hasMany(Soal::class, 'tag_id');
    }
}
