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
use Illuminate\Support\Str;

/**
 * Kuis: jadwal + durasi + mapel + kelas, dengan status draf/publikasi/arsip.
 */
#[Fillable([
    'school_id', 'subject_id', 'class_id', 'judul', 'deskripsi', 'status',
    'mulai_at', 'selesai_at', 'durasi_menit', 'acak_soal', 'acak_opsi',
    'publikasi_at', 'dibuat_oleh', 'slug',
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

    /**
     * URL kuis memakai slug, bukan id berurutan.
     *
     * Dengan `/kuis/191`, siapa pun yang sudah masuk bisa menyisir id dan
     * menebak kuis mana yang ada; slug acak menghilangkan pintu itu. Otorisasi
     * tetap pagar utamanya — slug hanya membuat alamatnya tidak bisa ditebak.
     */
    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /**
     * Cari kuis dari slug **atau** id.
     *
     * Cadangan id sengaja dipertahankan supaya tautan lama, berkas uji, dan
     * harness smoke yang masih memakai angka tetap hidup; yang berubah adalah
     * alamat yang dibagikan/dibuat aplikasi (selalu slug). Tanpa cadangan ini
     * setiap `/kuis/191` yang beredar akan berubah jadi 404.
     */
    public function resolveRouteBinding($value, $field = null): ?self
    {
        $kueri = $this->newQuery()->where('slug', $value);

        if (is_numeric($value)) {
            $kueri->orWhere($this->getKeyName(), (int) $value);
        }

        return $kueri->first();
    }

    /**
     * Slug acak yang belum dipakai kuis lain.
     *
     * Diperiksa ke basis data (bukan hanya acak-asal) karena kolomnya unik:
     * tumbukan akan melempar galat basis data di tengah penyimpanan guru.
     */
    public static function slugBaru(): string
    {
        do {
            $slug = Str::lower(Str::random(8));
        } while (static::query()->where('slug', $slug)->exists());

        return $slug;
    }

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
