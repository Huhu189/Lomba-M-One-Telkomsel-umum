<?php

declare(strict_types=1);

namespace App\Sections\Material\Models;

use App\Models\User;
use App\Sections\Material\Enums\KategoriBerkas;
use App\Sections\Material\Enums\StatusUnggahan;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Sesi unggahan berpotongan untuk satu berkas materi.
 *
 * `kode` adalah penanda publik (dipakai di URL bertanda tangan), sedangkan
 * `path` menunjuk berkas gabungan di storage privat.
 */
#[Fillable([
    'school_id', 'material_id', 'user_id', 'kode', 'nama_asli', 'nama_simpan',
    'ekstensi', 'mime', 'kategori', 'ukuran_total', 'jumlah_potongan',
    'hash', 'status', 'path', 'expires_at',
])]
class UnggahanMateri extends Model
{
    use HasFactory;

    protected $table = 'material_uploads';

    protected $casts = [
        'kategori' => KategoriBerkas::class,
        'status' => StatusUnggahan::class,
        'ukuran_total' => 'integer',
        'jumlah_potongan' => 'integer',
        'expires_at' => 'datetime',
    ];

    /**
     * Penanda rute memakai `kode` (penanda publik), bukan id internal — sama
     * seperti yang dipakai di URL bertanda tangan penyajian berkas.
     */
    public function getRouteKeyName(): string
    {
        return 'kode';
    }

    /** @return BelongsTo<Materi, $this> */
    public function materi(): BelongsTo
    {
        return $this->belongsTo(Materi::class, 'material_id');
    }

    /** @return BelongsTo<User, $this> */
    public function pengunggah(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /** @return HasMany<PotonganUnggahan, $this> */
    public function potongan(): HasMany
    {
        return $this->hasMany(PotonganUnggahan::class, 'upload_id')->orderBy('indeks');
    }

    public function selesai(): bool
    {
        return $this->status === StatusUnggahan::Selesai;
    }
}
