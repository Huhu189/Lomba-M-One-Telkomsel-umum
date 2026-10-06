<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Models;

use App\Sections\Attempt\Enums\JenisAttempt;
use App\Sections\Attempt\Enums\StatusAttempt;
use App\Sections\Question\Models\Soal;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Attempt — satu pengerjaan kuis. Waktu, seed pengacakan, dan skor semuanya
 * ditentukan server.
 */
#[Fillable([
    'school_id', 'quiz_id', 'student_id', 'jenis', 'status', 'aktif', 'seed',
    'mulai_at', 'deadline_at', 'dikumpulkan_at', 'terlambat', 'jumlah_soal',
    'skor', 'skor_maksimal', 'jumlah_benar', 'idempotency_key',
])]
class Attempt extends Model
{
    protected $table = 'attempts';

    protected $casts = [
        'jenis' => JenisAttempt::class,
        'status' => StatusAttempt::class,
        'aktif' => 'boolean',
        'seed' => 'integer',
        'mulai_at' => 'datetime',
        'deadline_at' => 'datetime',
        'dikumpulkan_at' => 'datetime',
        'terlambat' => 'boolean',
        'jumlah_soal' => 'integer',
        'skor' => 'float',
        'skor_maksimal' => 'float',
        'jumlah_benar' => 'integer',
    ];

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

    /** @return BelongsTo<Murid, $this> */
    public function murid(): BelongsTo
    {
        return $this->belongsTo(Murid::class, 'student_id');
    }

    /** @return HasMany<Jawaban, $this> */
    public function jawaban(): HasMany
    {
        return $this->hasMany(Jawaban::class, 'attempt_id');
    }

    public function berjalan(): bool
    {
        return $this->status === StatusAttempt::Berjalan;
    }

    /**
     * Soal kuis dalam urutan yang sudah diacak seed attempt.
     *
     * @return array<int, Soal>
     */
    public function soalTerurut(): array
    {
        $soal = $this->kuis->soal->all();

        return Pengacakan::urut($soal, $this->seed, (int) $this->getKey());
    }

    /** Sisa detik sampai deadline (negatif berarti sudah lewat). */
    public function sisaDetik(?Carbon $sekarang = null): int
    {
        $sekarang ??= Carbon::now();

        return (int) $sekarang->diffInSeconds($this->deadline_at, false);
    }
}
