<?php

declare(strict_types=1);

namespace App\Sections\Presence\Models;

use App\Models\User;
use App\Sections\Presence\Enums\ModeLayar;
use App\Sections\Question\Models\Soal;
use App\Sections\Quiz\Models\Kuis;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Keadaan layar guru satu kuis (slice 10). Satu kuis = satu baris.
 *
 * `mode` disimpan sebagai string biasa dan dibaca aman lewat `modeAman()`:
 * nilai tak dikenal (data rusak) tidak boleh meledak menjadi ValueError di
 * tengah ulangan — layar hanya dianggap kosong.
 */
#[Fillable(['quiz_id', 'mode', 'judul', 'isi', 'question_id', 'versi', 'diubah_oleh'])]
class LayarKuis extends Model
{
    protected $table = 'quiz_screens';

    protected $casts = [
        'versi' => 'integer',
    ];

    /** @return BelongsTo<Kuis, $this> */
    public function kuis(): BelongsTo
    {
        return $this->belongsTo(Kuis::class, 'quiz_id');
    }

    /** @return BelongsTo<Soal, $this> */
    public function soal(): BelongsTo
    {
        return $this->belongsTo(Soal::class, 'question_id');
    }

    /** @return BelongsTo<User, $this> */
    public function pengubah(): BelongsTo
    {
        return $this->belongsTo(User::class, 'diubah_oleh');
    }

    public function modeAman(): ModeLayar
    {
        return ModeLayar::tryFrom((string) $this->mode) ?? ModeLayar::Kosong;
    }
}
