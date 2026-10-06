<?php

declare(strict_types=1);

namespace App\Sections\Quiz\Models;

use App\Models\User;
use App\Sections\Question\Models\Soal;
use App\Sections\Quiz\Enums\StatusKuis;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Mapel;
use App\Sections\School\Models\Sekolah;
use Database\Factories\KuisFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Carbon;

/**
 * Kuis: jadwal + durasi + mapel + kelas, dengan status draf/publikasi/arsip.
 */
#[Fillable([
    'school_id', 'subject_id', 'class_id', 'judul', 'deskripsi', 'status',
    'mulai_at', 'selesai_at', 'durasi_menit', 'acak_soal', 'acak_opsi',
    'publikasi_at', 'dibuat_oleh',
])]
class Kuis extends Model
{
    /** @use HasFactory<KuisFactory> */
    use HasFactory;

    protected static function newFactory(): KuisFactory
    {
        return KuisFactory::new();
    }

    protected $table = 'quizzes';

    protected $casts = [
        'status' => StatusKuis::class,
        'mulai_at' => 'datetime',
        'selesai_at' => 'datetime',
        'publikasi_at' => 'datetime',
        'durasi_menit' => 'integer',
        'acak_soal' => 'boolean',
        'acak_opsi' => 'boolean',
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

    /** @return BelongsTo<User, $this> */
    public function pembuat(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dibuat_oleh');
    }

    /** @return BelongsToMany<Soal, $this> */
    public function soal(): BelongsToMany
    {
        return $this->belongsToMany(Soal::class, 'quiz_questions', 'quiz_id', 'question_id')
            ->withPivot('urutan')
            ->withTimestamps()
            ->orderBy('quiz_questions.urutan');
    }

    public function sedangBerjalan(): bool
    {
        if ($this->status !== StatusKuis::Publikasi) {
            return false;
        }

        $sekarang = Carbon::now();

        if ($this->mulai_at !== null && $this->mulai_at->greaterThan($sekarang)) {
            return false;
        }

        return ! ($this->selesai_at !== null && $this->selesai_at->lessThan($sekarang));
    }

    public function belumDimulai(): bool
    {
        return $this->status === StatusKuis::Publikasi
            && $this->mulai_at !== null
            && $this->mulai_at->greaterThan(Carbon::now());
    }
}
