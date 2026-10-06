<?php

declare(strict_types=1);

namespace App\Sections\Presence\Services;

use App\Models\User;
use App\Sections\Presence\Models\TiketSse;
use App\Sections\Quiz\Models\Kuis;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Ticket SSE sekali pakai (chunk slice-07).
 *
 * Alurnya: guru minta ticket → Laravel menyimpan **hash**-nya di database (jejak
 * audit) dan mendaftarkan ticket ke Redis → guru membuka EventSource dengan
 * ticket itu → Node mengambil ticket dari Redis secara atomik (GETDEL, jadi
 * sekali pakai) lalu meneruskan aliran. Node tidak pernah menyentuh database.
 *
 * `pakai()` adalah penjaga sekali-pakai sisi Laravel (dipakai saat Redis tidak
 * tersedia / untuk pengujian), sehingga jaminan "tidak bisa dipakai dua kali"
 * tetap berlaku walau jalur Redis sedang mati.
 */
class TokenSseService
{
    /** Umur ticket (detik) — cukup untuk handshake, tidak cukup untuk dibagikan. */
    public const TTL_DETIK = 45;

    public function __construct(private readonly PenyiarRealtime $penyiar) {}

    /**
     * Terbitkan ticket untuk guru pada satu kuis.
     *
     * @return array{tiket: string, expires_at: string}
     */
    public function terbitkan(User $guru, Kuis $kuis): array
    {
        $tiket = Str::random(64);
        $hash = hash('sha256', $tiket);
        $kedaluwarsa = Carbon::now()->addSeconds(self::TTL_DETIK);

        TiketSse::query()->create([
            'user_id' => $guru->getKey(),
            'quiz_id' => $kuis->getKey(),
            'token_hash' => $hash,
            'expires_at' => $kedaluwarsa,
        ]);

        $this->penyiar->armTicket(
            $hash,
            [
                'user_id' => (int) $guru->getKey(),
                'quiz_id' => (int) $kuis->getKey(),
                'nama' => (string) $guru->name,
            ],
            self::TTL_DETIK,
        );

        return [
            'tiket' => $tiket,
            'expires_at' => $kedaluwarsa->toIso8601String(),
        ];
    }

    /**
     * Pakai ticket (penjaga sekali-pakai sisi Laravel).
     *
     * @return TiketSse|null null bila ticket tidak ada, kedaluwarsa, atau sudah dipakai
     */
    public function pakai(string $tiket): ?TiketSse
    {
        $hash = hash('sha256', $tiket);

        return DB::transaction(function () use ($hash): ?TiketSse {
            $baris = TiketSse::query()->where('token_hash', $hash)->lockForUpdate()->first();

            if ($baris === null || $baris->used_at !== null || $baris->expires_at->isPast()) {
                return null;
            }

            $baris->forceFill(['used_at' => Carbon::now()])->save();

            return $baris;
        });
    }
}
