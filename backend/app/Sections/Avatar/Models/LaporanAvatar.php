<?php

declare(strict_types=1);

namespace App\Sections\Avatar\Models;

use App\Models\User;
use App\Sections\Avatar\Enums\AlasanLaporan;
use App\Sections\Cheat\Enums\StatusTinjauan;
use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
use Database\Factories\LaporanAvatarFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Laporan satu murid atas satu avatar.
 *
 * Unique (avatar_id, reporter_id) menjamin aturan "satu laporan per murid per
 * avatar": laporan ganda tidak menambah hitungan, sehingga ambang 3 laporan
 * benar-benar berarti tiga anak yang berbeda.
 *
 * Status tinjauan memakai enum yang sama dengan catatan kecurangan
 * (`StatusTinjauan`) karena semantiknya identik: menunggu / valid / tidak valid.
 */
#[Fillable([
    'avatar_id', 'reporter_id', 'school_id', 'alasan', 'keterangan',
    'review_status', 'reviewed_by', 'reviewed_at',
])]
class LaporanAvatar extends Model
{
    /** @use HasFactory<LaporanAvatarFactory> */
    use HasFactory;

    protected static function newFactory(): LaporanAvatarFactory
    {
        return LaporanAvatarFactory::new();
    }

    protected $table = 'avatar_reports';

    protected $casts = [
        'alasan' => AlasanLaporan::class,
        'review_status' => StatusTinjauan::class,
        'reviewed_at' => 'datetime',
    ];

    /** @return BelongsTo<Avatar, $this> */
    public function avatar(): BelongsTo
    {
        return $this->belongsTo(Avatar::class, 'avatar_id');
    }

    /** @return BelongsTo<Murid, $this> */
    public function pelapor(): BelongsTo
    {
        return $this->belongsTo(Murid::class, 'reporter_id');
    }

    /** @return BelongsTo<Sekolah, $this> */
    public function sekolah(): BelongsTo
    {
        return $this->belongsTo(Sekolah::class, 'school_id');
    }

    /** @return BelongsTo<User, $this> */
    public function peninjau(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
