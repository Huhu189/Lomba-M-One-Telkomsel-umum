<?php

declare(strict_types=1);

namespace App\Sections\School\Models;

use App\Sections\Settings\Models\Pengaturan;
use Database\Factories\SekolahFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Sekolah — satu baris per instalasi (lapis pengaturan teratas).
 */
#[Fillable(['nama', 'npsn', 'alamat', 'kepala_sekolah', 'tahun_ajaran'])]
class Sekolah extends Model
{
    /** @use HasFactory<SekolahFactory> */
    use HasFactory;

    protected static function newFactory(): SekolahFactory
    {
        return SekolahFactory::new();
    }

    protected $table = 'schools';

    /** @return HasMany<Kelas, $this> */
    public function kelas(): HasMany
    {
        return $this->hasMany(Kelas::class, 'school_id');
    }

    /** @return HasMany<Mapel, $this> */
    public function mapel(): HasMany
    {
        return $this->hasMany(Mapel::class, 'school_id');
    }

    /** @return HasMany<Murid, $this> */
    public function murid(): HasMany
    {
        return $this->hasMany(Murid::class, 'school_id');
    }

    /** @return HasMany<Pengaturan, $this> */
    public function pengaturan(): HasMany
    {
        return $this->hasMany(Pengaturan::class, 'lingkup_id')
            ->where('lingkup', 'sekolah');
    }
}
