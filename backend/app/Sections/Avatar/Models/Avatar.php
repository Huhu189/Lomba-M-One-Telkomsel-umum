<?php

declare(strict_types=1);

namespace App\Sections\Avatar\Models;

use App\Sections\Avatar\Enums\StatusAvatar;
use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
use Database\Factories\AvatarFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Satu berkas avatar murid (hasil encode ulang server).
 *
 * Selalu dibuat lewat `PenyimpananAvatar::simpan()` supaya berkas fisik dan
 * barisnya tidak pernah terpisah. Kolom `kode`, `path`, `hash`, `lebar`, dan
 * `tinggi` diisi server; tidak ada satu pun yang datang dari klien.
 */
#[Fillable([
    'school_id', 'student_id', 'kode', 'path', 'mime', 'ukuran', 'lebar', 'tinggi',
    'hash', 'status', 'jumlah_laporan', 'disembunyikan_at',
])]
class Avatar extends Model
{
    /** @use HasFactory<AvatarFactory> */
    use HasFactory;

    protected static function newFactory(): AvatarFactory
    {
        return AvatarFactory::new();
    }

    protected $table = 'avatars';

    protected $casts = [
        'status' => StatusAvatar::class,
        'disembunyikan_at' => 'datetime',
        'ukuran' => 'integer',
        'lebar' => 'integer',
        'tinggi' => 'integer',
        'jumlah_laporan' => 'integer',
    ];

    /** @return BelongsTo<Sekolah, $this> */
    public function sekolah(): BelongsTo
    {
        return $this->belongsTo(Sekolah::class, 'school_id');
    }

    /** @return BelongsTo<Murid, $this> */
    public function murid(): BelongsTo
    {
        return $this->belongsTo(Murid::class, 'student_id');
    }

    /** @return HasMany<LaporanAvatar, $this> */
    public function laporan(): HasMany
    {
        return $this->hasMany(LaporanAvatar::class, 'avatar_id');
    }

    /** Avatar yang masih dipakai/ditinjau (bukan yang sudah dihapus). */
    public function hidup(): bool
    {
        return $this->status !== StatusAvatar::Dihapus;
    }

    /** Hanya avatar aktif yang terlihat oleh murid lain. */
    public function terlihatSemua(): bool
    {
        return $this->status->terlihatSemua();
    }

    /**
     * Avatar terkini milik satu murid (baris terbaru yang belum dihapus).
     */
    public static function terkiniUntuk(int $studentId): ?self
    {
        return self::query()
            ->where('student_id', $studentId)
            ->where('status', '!=', StatusAvatar::Dihapus->value)
            ->orderByDesc('id')
            ->first();
    }
}
