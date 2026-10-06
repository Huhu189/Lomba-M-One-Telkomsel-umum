<?php

declare(strict_types=1);

namespace App\Sections\Presence\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;
use Throwable;

/**
 * Penyiar pesan realtime ke Redis pub/sub untuk diteruskan service Node (SSE).
 *
 * Semua pengiriman **fail-open**: kalau Redis tidak ada, aplikasi tetap jalan —
 * Live Monitor jatuh ke polling dan ulangan tidak pernah gagal karena proteksi
 * (chunk anticheat). Kegagalan dicatat sebagai peringatan, bukan error 500.
 */
class PenyiarRealtime
{
    /**
     * Nama koneksi Redis khusus jalur realtime.
     *
     * Koneksi ini sengaja TANPA prefix kunci (lihat `config/database.php`):
     * service Node tidak mengenal prefix internal Laravel, jadi kunci harus
     * disebut sama persis oleh kedua sisi.
     */
    public const KONEKSI = 'realtime';

    /** Kanal per kuis: satu kanal untuk seluruh kejadian kuis itu. */
    public function kanalKuis(int $kuisId): string
    {
        return 'ulangan:kuis:'.$kuisId;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function siarkan(string $kanal, array $payload): bool
    {
        try {
            Redis::connection(self::KONEKSI)->publish($kanal, json_encode($payload, JSON_THROW_ON_ERROR));

            return true;
        } catch (Throwable $galat) {
            // Fail-open: guru kehilangan pembaruan langsung, bukan kehilangan ulangan.
            Log::warning('Siaran realtime gagal dikirim.', [
                'kanal' => $kanal,
                'sebab' => $galat->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Daftarkan ticket SSE yang siap dipakai. Node membacanya satu kali
     * (GETDEL) lalu memutusnya; Node tidak perlu kredensial database.
     *
     * @param  array<string, mixed>  $tiket  isi tiket (mis. user_id, quiz_id, nama)
     */
    public function armTicket(string $hash, array $tiket, int $ttlDetik): bool
    {
        try {
            Redis::connection(self::KONEKSI)->setex(
                'sse:tiket:'.$hash,
                $ttlDetik,
                json_encode($tiket, JSON_THROW_ON_ERROR),
            );

            return true;
        } catch (Throwable $galat) {
            Log::warning('Ticket SSE gagal didaftarkan ke Redis.', ['sebab' => $galat->getMessage()]);

            return false;
        }
    }
}
