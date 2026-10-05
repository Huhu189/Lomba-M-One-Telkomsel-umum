<?php

declare(strict_types=1);

namespace App\Sections\Settings\Models;

use Database\Factories\PengaturanFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Pengaturan tiga lapis (sekolah / kelas / kuis) dengan penanda terkunci
 * pada lapis sekolah (chunk slice-02).
 */
#[Fillable(['lingkup', 'lingkup_id', 'kunci', 'nilai', 'terkunci'])]
class Pengaturan extends Model
{
    /** @use HasFactory<PengaturanFactory> */
    use HasFactory;

    protected static function newFactory(): PengaturanFactory
    {
        return PengaturanFactory::new();
    }

    protected $table = 'settings';

    protected $casts = [
        'lingkup_id' => 'integer',
        'nilai' => 'json',
        'terkunci' => 'boolean',
    ];
}
