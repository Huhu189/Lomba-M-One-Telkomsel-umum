<?php

declare(strict_types=1);

namespace App\Sections\Question\Models;

use App\Sections\Question\Enums\TipeSoal;
use App\Sections\Quiz\Enums\StatusKuis;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\School\Models\Mapel;
use App\Sections\School\Models\Sekolah;
use Database\Factories\SoalFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Carbon;

/**
 * Soal bank soal. `konten` = isi soal (teks + MathML + media),
 * `kunci` = jawaban benar dan TIDAK pernah dikirim ke klien murid.
 */
#[Fillable(['school_id', 'subject_id', 'tag_id', 'tipe', 'konten', 'kunci', 'pembahasan', 'skor', 'aktif', 'dibuat_oleh'])]
class Soal extends Model
{
    /** @use HasFactory<SoalFactory> */
    use HasFactory;

    protected static function newFactory(): SoalFactory
    {
        return SoalFactory::new();
    }

    protected $table = 'questions';

    protected $casts = [
        'tipe' => TipeSoal::class,
        'konten' => 'array',
        'kunci' => 'array',
        'skor' => 'integer',
        'aktif' => 'boolean',
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

    /** @return BelongsTo<Tag, $this> */
    public function tag(): BelongsTo
    {
        return $this->belongsTo(Tag::class, 'tag_id');
    }

    /** @return BelongsToMany<Kuis, $this> */
    public function kuis(): BelongsToMany
    {
        return $this->belongsToMany(Kuis::class, 'quiz_questions', 'question_id', 'quiz_id')
            ->withPivot('urutan')
            ->withTimestamps();
    }

    /**
     * Soal terkunci bila dipakai kuis yang sedang berjalan
     * (sudah terbit dan jadwalnya sedang berlangsung).
     */
    public function terkunci(): bool
    {
        $sekarang = Carbon::now();

        return $this->kuis()
            ->where('status', StatusKuis::Publikasi->value)
            ->whereNotNull('mulai_at')
            ->where('mulai_at', '<=', $sekarang)
            ->where(static function ($query) use ($sekarang): void {
                $query->whereNull('selesai_at')->orWhere('selesai_at', '>=', $sekarang);
            })
            ->exists();
    }

    /**
     * Amankan struktur kunci untuk dibaca mesin penilaian.
     *
     * @return array<string, mixed>
     */
    public function kunciSebagaiArray(): array
    {
        $kunci = $this->kunci;

        return is_array($kunci) ? $kunci : [];
    }

    /**
     * @return array<string, mixed>
     */
    public function kontenSebagaiArray(): array
    {
        $konten = $this->konten;

        return is_array($konten) ? $konten : [];
    }
}
