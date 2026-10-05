<?php

declare(strict_types=1);

namespace App\Sections\School\Models;

use Database\Factories\MapelFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Mapel — FK ke sekolah NOT NULL.
 */
#[Fillable(['school_id', 'nama', 'kode'])]
class Mapel extends Model
{
    /** @use HasFactory<MapelFactory> */
    use HasFactory;

    protected static function newFactory(): MapelFactory
    {
        return MapelFactory::new();
    }

    protected $table = 'subjects';

    /** @return BelongsTo<Sekolah, $this> */
    public function sekolah(): BelongsTo
    {
        return $this->belongsTo(Sekolah::class, 'school_id');
    }
}
