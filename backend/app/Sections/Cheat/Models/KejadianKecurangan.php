<?php

declare(strict_types=1);

namespace App\Sections\Cheat\Models;

use App\Models\User;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Cheat\Enums\KategoriKecurangan;
use App\Sections\Cheat\Enums\StatusTinjauan;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use RuntimeException;

/**
 * Catatan kecurangan — **append-only**.
 *
 * Setelah baris dibuat, hanya kolom tinjauan (`review_status`, `reviewed_by`,
 * `reviewed_at`) yang boleh berubah. Aturan itu ditegakkan di model ini, bukan
 * hanya dipatuhi oleh pemanggil, supaya catatan tetap layak jadi bahan tinjauan
 * dan tidak bisa dirapikan diam-diam oleh kode yang keliru.
 */
#[Fillable([
    'school_id', 'quiz_id', 'attempt_id', 'student_id', 'kategori', 'skor_risiko',
    'dari_klien', 'client_at', 'rincian', 'review_status', 'reviewed_by', 'reviewed_at', 'sidik',
])]
class KejadianKecurangan extends Model
{
    protected $table = 'cheat_events';

    /** Kolom yang masih boleh berubah setelah baris dibuat. */
    public const KOLOM_TINJAUAN = ['review_status', 'reviewed_by', 'reviewed_at', 'updated_at'];

    protected $casts = [
        'kategori' => KategoriKecurangan::class,
        'review_status' => StatusTinjauan::class,
        'skor_risiko' => 'integer',
        'dari_klien' => 'boolean',
        'client_at' => 'datetime',
        'rincian' => 'array',
        'reviewed_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::updating(function (self $kejadian): void {
            $terlarang = array_diff(array_keys($kejadian->getDirty()), self::KOLOM_TINJAUAN);

            if ($terlarang !== []) {
                throw new RuntimeException(
                    'Catatan kecurangan bersifat append-only; kolom berikut tidak boleh diubah: '
                    .implode(', ', $terlarang)
                );
            }
        });

        static::deleting(function (): void {
            throw new RuntimeException('Catatan kecurangan tidak boleh dihapus.');
        });
    }

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

    /** @return BelongsTo<Attempt, $this> */
    public function attempt(): BelongsTo
    {
        return $this->belongsTo(Attempt::class, 'attempt_id');
    }

    /** @return BelongsTo<Murid, $this> */
    public function murid(): BelongsTo
    {
        return $this->belongsTo(Murid::class, 'student_id');
    }

    /** @return BelongsTo<User, $this> */
    public function peninjau(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /**
     * Catatan satu kuis untuk guru, terbaru dulu.
     *
     * @param  Builder<KejadianKecurangan>  $query
     * @return Builder<KejadianKecurangan>
     */
    public function scopeKuis($query, int $kuisId)
    {
        return $query->where('quiz_id', $kuisId);
    }

    public function sudahDitinjau(): bool
    {
        return $this->review_status !== StatusTinjauan::Menunggu;
    }
}
