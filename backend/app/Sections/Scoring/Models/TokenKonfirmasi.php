<?php

declare(strict_types=1);

namespace App\Sections\Scoring\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Token konfirmasi sekali pakai untuk mutasi sensitif (koreksi nilai manual).
 * Yang disimpan adalah hash token; token asli hanya ada di memori/klien.
 */
#[Fillable(['user_id', 'tujuan', 'token_hash', 'payload', 'expires_at', 'used_at', 'ip'])]
class TokenKonfirmasi extends Model
{
    protected $table = 'confirmation_tokens';

    protected $casts = [
        'payload' => 'array',
        'expires_at' => 'datetime',
        'used_at' => 'datetime',
    ];

    /** @return BelongsTo<User, $this> */
    public function pengguna(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function kedaluwarsa(?Carbon $sekarang = null): bool
    {
        $sekarang ??= Carbon::now();

        return $this->expires_at->lessThan($sekarang);
    }

    public function terpakai(): bool
    {
        return $this->used_at !== null;
    }
}
