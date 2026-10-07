<?php

declare(strict_types=1);

namespace App\Sections\Material\Models;

use App\Models\User;
use App\Sections\Material\Enums\StatusMateri;
use App\Sections\Question\Models\Tag;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Mapel;
use App\Sections\School\Models\Sekolah;
use Database\Factories\MateriFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Materi pelajaran: judul + tema (tag) + urutan blok.
 */
#[Fillable([
    'school_id', 'subject_id', 'class_id', 'tag_id', 'judul', 'deskripsi',
    'status', 'urutan', 'publikasi_at', 'dibuat_oleh',
])]
class Materi extends Model
{
    /** @use HasFactory<MateriFactory> */
    use HasFactory;

    protected static function newFactory(): MateriFactory
    {
        return MateriFactory::new();
    }

    protected $table = 'materials';

    protected $casts = [
        'status' => StatusMateri::class,
        'publikasi_at' => 'datetime',
        'urutan' => 'integer',
    ];

    /** @return BelongsTo<Sekolah, $this> */
    public function sekolah(): BelongsTo
    {
        return $this->belongsTo(Sekolah::class, 'school_id');
    }

    /** @return BelongsTo<Mapel, $this> */
    public function mapel(): BelongsTo
    {
        return $this->belongsTo(Mapel::class, 'subject_id');
    }

    /** @return BelongsTo<Kelas, $this> */
    public function kelas(): BelongsTo
    {
        return $this->belongsTo(Kelas::class, 'class_id');
    }

    /** @return BelongsTo<Tag, $this> */
    public function tag(): BelongsTo
    {
        return $this->belongsTo(Tag::class, 'tag_id');
    }

    /** @return BelongsTo<User, $this> */
    public function pembuat(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dibuat_oleh');
    }

    /** @return HasMany<BlokMateri, $this> */
    public function blok(): HasMany
    {
        return $this->hasMany(BlokMateri::class, 'material_id')->orderBy('urutan');
    }

    /** @return HasMany<UnggahanMateri, $this> */
    public function unggahan(): HasMany
    {
        return $this->hasMany(UnggahanMateri::class, 'material_id');
    }

    public function terbit(): bool
    {
        return $this->status === StatusMateri::Publikasi;
    }
}
