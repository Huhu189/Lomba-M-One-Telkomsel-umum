<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Models;

use App\Sections\School\Models\Murid;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Snapshot anggota satu attempt (Q-18).
 *
 * Dibuat sekali saat attempt dimulai untuk attempt mode tim: menyalin siapa
 * saja yang mengerjakan beserta nama dan nama timnya. Ekspor/laporan membaca
 * baris ini, bukan `team_members` yang hidup, supaya nilai historis tidak
 * berubah ketika susunan tim atau akun murid kemudian berubah.
 */
#[Fillable(['attempt_id', 'student_id', 'team_id', 'nama', 'tim_nama'])]
class AnggotaAttempt extends Model
{
    protected $table = 'attempt_members';

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
}
