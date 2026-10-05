<?php

declare(strict_types=1);

namespace App\Sections\School\Models;

use App\Models\User;
use Database\Factories\MuridFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Murid — profil murid; FK sekolah, kelas, dan user semuanya NOT NULL.
 */
#[Fillable(['school_id', 'class_id', 'user_id', 'nis', 'nisn'])]
class Murid extends Model
{
    /** @use HasFactory<MuridFactory> */
    use HasFactory;

    protected static function newFactory(): MuridFactory
    {
        return MuridFactory::new();
    }

    protected $table = 'students';

    /** @return BelongsTo<Sekolah, $this> */
    public function sekolah(): BelongsTo
    {
        return $this->belongsTo(Sekolah::class, 'school_id');
    }

    /** @return BelongsTo<Kelas, $this> */
    public function kelas(): BelongsTo
    {
        return $this->belongsTo(Kelas::class, 'class_id');
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
