<?php

declare(strict_types=1);

namespace App\Sections\Material\Models;

use App\Models\User;
use App\Sections\Material\Enums\StatusMateri;
use App\Sections\Question\Models\Tag;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Mapel;
use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
use Database\Factories\MateriFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Materi pelajaran: judul + tema (tag) + urutan blok.
 *
 * Kolom `tema` menyimpan pilihan tema perjalanan guru (`kode`, `nama`,
 * `video_kode`); lihat Registry\TemaPerjalanan untuk isi fasenya. Materi lama
 * yang belum punya tema otomatis memakai tema bawaan, jadi peta perjalanan
 * selalu bisa ditampilkan.
 */
#[Fillable([
    'school_id', 'subject_id', 'class_id', 'tag_id', 'judul', 'deskripsi',
    'status', 'urutan', 'tema', 'publikasi_at', 'dibuat_oleh',
])]
class Materi extends Model
{
    /** @use HasFactory<MateriFactory> */
    use HasFactory;

    protected static function newFactory(): MateriFactory
    {
        return MateriFactory::new();
    }

    protected $table = 'materials';

    protected $casts = [
        'status' => StatusMateri::class,
        'publikasi_at' => 'datetime',
        'urutan' => 'integer',
        'tema' => 'array',
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

    /** @return BelongsTo<Tag, $this> */
    public function tag(): BelongsTo
    {
        return $this->belongsTo(Tag::class, 'tag_id');
    }

    /** @return BelongsTo<User, $this> */
    public function pembuat(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dibuat_oleh');
    }

    /** @return HasMany<BlokMateri, $this> */
    public function blok(): HasMany
    {
        return $this->hasMany(BlokMateri::class, 'material_id')->orderBy('urutan');
    }

    /** @return HasMany<UnggahanMateri, $this> */
    public function unggahan(): HasMany
    {
        return $this->hasMany(UnggahanMateri::class, 'material_id');
    }

    public function terbit(): bool
    {
        return $this->status === StatusMateri::Publikasi;
    }

    /**
     * Materi tanpa kelas = terbuka untuk **semua kelas** di sekolahnya
     * (15 Oktober 2026). Guru yang tidak membatasi kelas cukup mengosongkan
     * pilihan kelasnya — aturannya sengaja sama dengan kuis (`Kuis::untukSemuaKelas`)
     * supaya "tanpa kelas" tidak berarti dua hal berbeda di aplikasi yang sama.
     */
    public function untukSemuaKelas(): bool
    {
        return $this->class_id === null;
    }

    /** Nama kelas untuk tampilan; materi tanpa kelas = "Semua kelas". */
    public function namaKelas(): string
    {
        return $this->class_id === null ? 'Semua kelas' : (string) ($this->kelas?->nama ?? '');
    }

    /** Kelas materi sebagai int atau null (null = semua kelas). */
    public function kelasIdAtauNull(): ?int
    {
        return $this->class_id === null ? null : (int) $this->class_id;
    }

    /** Apakah murid dari kelas ini boleh menempuh materi ini. */
    public function terbukaUntukKelas(?int $kelasId): bool
    {
        if ($this->untukSemuaKelas()) {
            return $kelasId !== null;
        }

        return $kelasId !== null && $kelasId === (int) $this->class_id;
    }

    /**
     * Murid yang masuk cakupan materi: satu kelas, atau seluruh murid sekolah
     * bila materinya tidak membatasi kelas.
     *
     * @return Builder<Murid>
     */
    public function muridCakupan(): Builder
    {
        return Murid::query()
            ->where('school_id', $this->school_id)
            ->when($this->class_id !== null, fn ($q) => $q->where('class_id', $this->class_id));
    }
}
