<?php

declare(strict_types=1);

namespace App\Sections\Scoring\Services;

use App\Models\User;
use App\Sections\Scoring\Models\TokenKonfirmasi;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Token konfirmasi sekali pakai (chunk security #6: mutasi sensitif wajib
 * autentikasi + permission + alasan + token sekali pakai + audit).
 *
 * Token asli hanya dikembalikan sekali saat dibuat; yang tersimpan hanya
 * hash-nya. Token terikat pengguna, tujuan, dan sasaran (payload), serta
 * berumur pendek.
 */
class TokenKonfirmasiService
{
    /** Umur token (detik) — cukup untuk mengisi form, terlalu singkat untuk disalahgunakan. */
    public const TTL_DETIK = 300;

    public const TUJUAN_KOREKSI = 'koreksi_nilai';

    /**
     * Buat token baru untuk satu aksi pada satu sasaran.
     *
     * @param  array<string, mixed>  $payload
     * @return array{token: string, expires_at: string, ttl_detik: int}
     */
    public function terbitkan(User $pengguna, string $tujuan, array $payload, ?string $ip = null): array
    {
        $token = bin2hex(random_bytes(24));
        $kedaluwarsa = Carbon::now()->addSeconds(self::TTL_DETIK);

        TokenKonfirmasi::query()->create([
            'user_id' => $pengguna->getKey(),
            'tujuan' => $tujuan,
            'token_hash' => $this->hash($token),
            'payload' => $payload,
            'expires_at' => $kedaluwarsa,
            'ip' => $ip,
        ]);

        return [
            'token' => $token,
            'expires_at' => $kedaluwarsa->toIso8601String(),
            'ttl_detik' => self::TTL_DETIK,
        ];
    }

    /**
     * Pakai token: validasi pemilik, tujuan, umur, sasaran, dan sekali pakai.
     *
     * Dipanggil di dalam transaksi oleh pemanggil supaya penandaan "terpakai"
     * dan perubahan datanya tidak bisa terpisah.
     *
     * @param  array<string, mixed>  $payload
     * @return TokenKonfirmasi token yang sudah ditandai terpakai
     *
     * @throws ValidationException
     */
    public function pakai(User $pengguna, string $tujuan, string $token, array $payload): TokenKonfirmasi
    {
        $baris = TokenKonfirmasi::query()
            ->where('token_hash', $this->hash($token))
            ->where('tujuan', $tujuan)
            ->where('user_id', $pengguna->getKey())
            ->lockForUpdate()
            ->first();

        if ($baris === null) {
            throw ValidationException::withMessages(['token' => 'Token konfirmasi tidak dikenal. Minta token baru.']);
        }

        if ($baris->terpakai()) {
            throw ValidationException::withMessages(['token' => 'Token konfirmasi sudah dipakai. Minta token baru.']);
        }

        if ($baris->kedaluwarsa()) {
            throw ValidationException::withMessages(['token' => 'Token konfirmasi sudah kedaluwarsa. Minta token baru.']);
        }

        foreach ($payload as $kunci => $nilai) {
            if ((string) ($baris->payload[$kunci] ?? '') !== (string) $nilai) {
                throw ValidationException::withMessages(['token' => 'Token konfirmasi ini untuk sasaran yang berbeda.']);
            }
        }

        $baris->forceFill(['used_at' => Carbon::now()])->save();

        return $baris->refresh();
    }

    /**
     * Token lama untuk sasaran yang sama dimatikan supaya tidak menumpuk.
     *
     * @param  array<string, mixed>  $payload
     */
    public function matikanSebelumnya(User $pengguna, string $tujuan, array $payload): void
    {
        $query = TokenKonfirmasi::query()
            ->where('user_id', $pengguna->getKey())
            ->where('tujuan', $tujuan)
            ->whereNull('used_at');

        foreach ($payload as $kunci => $nilai) {
            $query->where('payload->'.$kunci, $nilai);
        }

        $query->update(['used_at' => Carbon::now()]);
    }

    /** Buang token kedaluwarsa yang belum terpakai (housekeeping). */
    public function bersihkan(): int
    {
        return DB::table('confirmation_tokens')
            ->whereNull('used_at')
            ->where('expires_at', '<', Carbon::now())
            ->delete();
    }

    private function hash(string $token): string
    {
        return hash('sha256', $token);
    }
}
