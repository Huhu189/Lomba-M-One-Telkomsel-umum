<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Models;

use App\Sections\Attempt\Enums\JenisUnggahanJawaban;
use App\Sections\Material\Enums\KategoriBerkas;
use App\Sections\Material\Enums\StatusUnggahan;
use App\Sections\Question\Models\Soal;
use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Satu lampiran jawaban murid (gambar kanvas, rekaman diri, atau berkas).
 *
 * Baris ini selalu dibuat lewat `PenyimpananJawaban`, jadi berkas fisik dan
 * datanya tidak pernah terpisah. `kategori`, `mime`, dan `path` diisi server.
 */
#[Fillable([
    'school_id', 'attempt_id', 'question_id', 'student_id', 'kode', 'jenis',
    'nama_asli', 'nama_simpan', 'ekstensi', 'mime', 'kategori', 'ukuran_total',
    'jumlah_potongan', 'durasi_detik', 'hash', 'status', 'path', 'expires_at',
])]
class UnggahanJawaban extends Model
{
    protected $table = 'answer_uploads';

    protected $casts = [
        'jenis' => JenisUnggahanJawaban::class,
        'kategori' => KategoriBerkas::class,
        'status' => StatusUnggahan::class,
        'ukuran_total' => 'integer',
        'jumlah_potongan' => 'integer',
        'durasi_detik' => 'integer',
        'expires_at' => 'datetime',
    ];

    /** @return BelongsTo<Attempt, $this> */
    public function attempt(): BelongsTo
    {
        return $this->belongsTo(Attempt::class, 'attempt_id');
    }

    /** @return BelongsTo<Soal, $this> */
    public function soal(): BelongsTo
    {
        return $this->belongsTo(Soal::class, 'question_id');
    }

    /** @return BelongsTo<Murid, $this> */
    public function murid(): BelongsTo
    {
        return $this->belongsTo(Murid::class, 'student_id');
    }

    /** @return BelongsTo<Sekolah, $this> */
    public function sekolah(): BelongsTo
    {
        return $this->belongsTo(Sekolah::class, 'school_id');
    }

    /** @return HasMany<PotonganUnggahanJawaban, $this> */
    public function potongan(): HasMany
    {
        return $this->hasMany(PotonganUnggahanJawaban::class, 'upload_id');
    }

    /**
     * URL memakai `kode` acak, bukan id berurutan: id lampiran jawaban anak
     * tidak perlu bocor lewat alamat, dan tebak-menebak id tidak ada gunanya.
     */
    public function getRouteKeyName(): string
    {
        return 'kode';
    }

    public function selesai(): bool
    {
        return $this->status === StatusUnggahan::Selesai;
    }

    /** Boleh ditampilkan langsung (inline) di layar, bukan unduhan paksa. */
    public function tampilLangsung(): bool
    {
        return $this->selesai() && $this->kategori->bolehTampilLangsung();
    }
}
