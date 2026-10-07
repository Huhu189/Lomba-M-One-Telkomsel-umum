<?php

declare(strict_types=1);

namespace App\Sections\Material\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Satu potongan berkas yang sudah diterima server beserta hash-nya.
 */
#[Fillable(['upload_id', 'indeks', 'ukuran', 'hash', 'path'])]
class PotonganUnggahan extends Model
{
    protected $table = 'material_upload_chunks';

    protected $casts = [
        'indeks' => 'integer',
        'ukuran' => 'integer',
    ];

    /** @return BelongsTo<UnggahanMateri, $this> */
    public function unggahan(): BelongsTo
    {
        return $this->belongsTo(UnggahanMateri::class, 'upload_id');
    }
}
