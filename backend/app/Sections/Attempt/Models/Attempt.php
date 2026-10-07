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
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Attempt — satu pengerjaan kuis. Waktu, seed pengacakan, dan skor semuanya
 * ditentukan server.
 */
#[Fillable([
    'school_id', 'quiz_id', 'student_id', 'team_id', 'jenis', 'attempt_no', 'asli', 'status', 'aktif', 'seed',
    'mulai_at', 'deadline_at', 'dikumpulkan_at', 'terlambat', 'jumlah_soal',
    'skor', 'skor_maksimal', 'jumlah_benar', 'idempotency_key',
])]
class Attempt extends Model
{
    protected $table = 'attempts';

    protected $casts = [
        'jenis' => JenisAttempt::class,
        'status' => StatusAttempt::class,
        'attempt_no' => 'integer',
        'asli' => 'boolean',
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

    /** Tim pemilik attempt ini (slice 09-C); null untuk ulangan individu.
     *
     * @return BelongsTo<Tim, $this>
     */
    public function tim(): BelongsTo
    {
        return $this->belongsTo(Tim::class, 'team_id');
    }

    /** @return HasMany<RevisiJawaban, $this> */
    public function revisiJawaban(): HasMany
    {
        return $this->hasMany(RevisiJawaban::class, 'attempt_id');
    }

    /**
     * Skor mencakup attempt milik sendiri DAN attempt tim yang diikuti murid ini.
     *
     * Dipakai laporan/badge/lencana supaya satu nilai tim benar-benar dibagi rata
     * ke semua anggotanya (slice 09-C), tanpa menggandakan baris attempt.
     *
     * @param  Builder<Attempt>  $query
     * @return Builder<Attempt>
     */
    public function scopeMilikMurid($query, int $muridId)
    {
        return $query->where(function (Builder $dalam) use ($muridId): void {
            $dalam->where('student_id', $muridId)
                ->orWhereIn('team_id', function ($sub) use ($muridId): void {
                    $sub->select('team_id')->from('team_members')->where('student_id', $muridId);
                });
        });
    }

    public function berjalan(): bool
    {
        return $this->status === StatusAttempt::Berjalan;
    }

    /**
     * Hanya percobaan pertama yang dihitung sebagai skor asli.
     *
     * @param  Builder<Attempt>  $query
     * @return Builder<Attempt>
     */
    public function scopeAsli($query)
    {
        return $query->where('asli', true);
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
