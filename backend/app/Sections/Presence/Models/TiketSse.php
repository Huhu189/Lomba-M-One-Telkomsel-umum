<?php

declare(strict_types=1);

namespace App\Sections\Presence\Models;

use App\Models\User;
use App\Sections\Quiz\Models\Kuis;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Ticket SSE. Yang disimpan hanya hash — ticket asli dikirim sekali ke klien
 * dan tidak pernah bisa dibaca lagi dari database (prinsip keamanan: tidak ada
 * token di log atau penyimpanan yang bisa dipakai ulang).
 */
#[Fillable(['user_id', 'quiz_id', 'token_hash', 'expires_at', 'used_at'])]
class TiketSse extends Model
{
    protected $table = 'sse_tickets';

    protected $casts = [
        'expires_at' => 'datetime',
        'used_at' => 'datetime',
    ];

    /** @return BelongsTo<User, $this> */
    public function pengguna(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /** @return BelongsTo<Kuis, $this> */
    public function kuis(): BelongsTo
    {
        return $this->belongsTo(Kuis::class, 'quiz_id');
    }

    public function terpakai(): bool
    {
        return $this->used_at !== null;
    }

    public function kedaluwarsa(): bool
    {
        return $this->expires_at->isPast();
    }
}
