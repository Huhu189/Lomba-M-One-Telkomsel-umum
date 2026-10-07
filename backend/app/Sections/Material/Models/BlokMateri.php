<?php

declare(strict_types=1);

namespace App\Sections\Material\Models;

use App\Sections\Material\Enums\TipeBlok;
use App\Sections\Quiz\Models\Kuis;
use Database\Factories\BlokMateriFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Satu blok dalam urutan materi.
 *
 * `isi` menyimpan muatan menurut tipe: teks (teks), media (unggahan_kode,
 * keterangan), kuis (kosong — kuis ditunjuk lewat `quiz_id`).
 */
#[Fillable(['material_id', 'urutan', 'tipe', 'wajib', 'isi', 'quiz_id'])]
class BlokMateri extends Model
{
    /** @use HasFactory<BlokMateriFactory> */
    use HasFactory;

    protected static function newFactory(): BlokMateriFactory
    {
        return BlokMateriFactory::new();
    }

    protected $table = 'material_blocks';

    protected $casts = [
        'tipe' => TipeBlok::class,
        'wajib' => 'boolean',
        'isi' => 'array',
        'urutan' => 'integer',
    ];

    /** @return BelongsTo<Materi, $this> */
    public function materi(): BelongsTo
    {
        return $this->belongsTo(Materi::class, 'material_id');
    }

    /** @return BelongsTo<Kuis, $this> */
    public function kuis(): BelongsTo
    {
        return $this->belongsTo(Kuis::class, 'quiz_id');
    }

    /** @return HasMany<ProgresMateri, $this> */
    public function progres(): HasMany
    {
        return $this->hasMany(ProgresMateri::class, 'block_id');
    }

    /**
     * Penunjukan kuis yang sah: blok kuis harus punya quiz_id.
     */
    public function berkuisSah(): bool
    {
        return $this->tipe->berkuis() && $this->quiz_id !== null;
    }
}
