<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Satu potongan berkas jawaban. Hash per potongan membuat kiriman ulang setelah
 * sinyal putus aman: potongan yang sama tidak pernah digabung dua kali, dan yang
 * rusak di jalan ditolak sebelum ikut digabung.
 */
#[Fillable(['upload_id', 'indeks', 'ukuran', 'hash', 'path'])]
class PotonganUnggahanJawaban extends Model
{
    protected $table = 'answer_upload_chunks';

    protected $casts = [
        'indeks' => 'integer',
        'ukuran' => 'integer',
    ];

    /** @return BelongsTo<UnggahanJawaban, $this> */
    public function unggahan(): BelongsTo
    {
        return $this->belongsTo(UnggahanJawaban::class, 'upload_id');
    }
}
