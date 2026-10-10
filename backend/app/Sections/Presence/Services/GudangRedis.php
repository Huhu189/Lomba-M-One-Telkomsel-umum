<?php

declare(strict_types=1);

namespace App\Sections\Presence\Services;

use App\Sections\Presence\Contracts\GudangPresence;
use Illuminate\Cache\RedisStore;
use Illuminate\Redis\Connections\Connection;
use Throwable;

/**
 * Gudang Redis: satu **hash** per kuis + satu **set** indeks (P-02).
 *
 * Bentuknya:
 * - `presence:kuis:{id}` (hash) → medan `attempt_id` berisi JSON
 *   `{student_id, sesi, terakhir}`;
 * - `presence:indeks` (set) → id kuis yang punya catatan kehadiran.
 *
 * Kenapa begitu: tiap request murid (`mulai`, `show`, `jawab`, ping) hanya perlu
 * menulis **satu medan** (`HSET`) dan, untuk deteksi sesi ganda, membaca **satu
 * medan** (`HGET`). Keduanya O(1) dan tidak saling menimpa — berbeda dengan
 * `GudangPeta` yang membaca-ubah-menulis seluruh peta sehingga biayanya O(N)
 * per murid dan dua request bersamaan bisa kehilangan pembaruan (lost update).
 * Guru tetap membaca seluruh peta dalam satu round-trip (`HGETALL`).
 *
 * Fail-open (prinsip repo ini): kalau Redis mati/perintahnya gagal, presence
 * tidak boleh menjatuhkan pengerjaan ujian — setiap operasi menangkap galatnya,
 * melaporkannya, lalu mengembalikan nilai bawaan. Live Monitor punya polling dan
 * `MonitorService` tetap membaca data attempt dari basis data, jadi layar guru
 * hanya kehilangan penanda "online/offline", bukan seluruh isinya.
 */
final class GudangRedis implements GudangPresence
{
    /** Masa simpan hash/set di Redis (detik) — penyegar ikut setiap penulisan. */
    public const TTL_DETIK = 10800;

    public function __construct(private readonly RedisStore $toko) {}

    public function nama(): string
    {
        return 'redis';
    }

    public function entri(int $kuisId, int $attemptId): ?array
    {
        return $this->aman(fn (): ?array => $this->urai(
            $this->toko->connection()->hget($this->kunciKuis($kuisId), (string) $attemptId),
        ), null);
    }

    public function simpan(int $kuisId, int $attemptId, array $entri): void
    {
        $this->aman(function () use ($kuisId, $attemptId, $entri): void {
            $toko = $this->toko->connection();

            $this->tulisMedan(
                $toko,
                $this->kunciKuis($kuisId),
                (string) $attemptId,
                (string) json_encode($entri, JSON_THROW_ON_ERROR),
            );
            $toko->expire($this->kunciKuis($kuisId), self::TTL_DETIK);

            // Indeks kuis diperpanjang di sini juga supaya sapuan berkala masih
            // tahu kuis mana yang perlu diperiksa walau peta satu kuis sempat
            // kedaluwarsa lebih dulu.
            $toko->sadd($this->kunciIndeks(), (string) $kuisId);
            $toko->expire($this->kunciIndeks(), self::TTL_DETIK);
        }, null);
    }

    public function semua(int $kuisId): array
    {
        return $this->aman(function () use ($kuisId): array {
            $mentah = $this->toko->connection()->hgetall($this->kunciKuis($kuisId));

            if (! is_array($mentah)) {
                return [];
            }

            $hasil = [];

            foreach ($mentah as $attemptId => $nilai) {
                // Nilai yang tidak terbaca dikembalikan sebagai `null` supaya
                // `PresenceService::sapu()` bisa membuang medannya, sama seperti
                // perilaku lama pada peta cache.
                $hasil[(int) $attemptId] = $this->urai($nilai);
            }

            return $hasil;
        }, []);
    }

    public function buang(int $kuisId, array $attemptIds): void
    {
        if ($attemptIds === []) {
            return;
        }

        $this->aman(function () use ($kuisId, $attemptIds): void {
            $toko = $this->toko->connection();
            $kunci = $this->kunciKuis($kuisId);

            $toko->hdel($kunci, ...array_map('strval', $attemptIds));

            // Kuis tanpa entri tidak perlu disapu terus: buang kuncinya dan
            // keluarkan id-nya dari indeks.
            if ((int) $toko->hlen($kunci) === 0) {
                $toko->del($kunci);
                $toko->srem($this->kunciIndeks(), (string) $kuisId);
            }
        }, null);
    }

    public function kuis(): array
    {
        return $this->aman(function (): array {
            $anggota = $this->toko->connection()->smembers($this->kunciIndeks());

            return is_array($anggota) ? array_values(array_map('intval', $anggota)) : [];
        }, []);
    }

    public function lupakanKuis(int $kuisId): void
    {
        $this->aman(function () use ($kuisId): void {
            $toko = $this->toko->connection();

            $toko->del($this->kunciKuis($kuisId));
            $toko->srem($this->kunciIndeks(), (string) $kuisId);
        }, null);
    }

    /**
     * Tulis satu medan hash, dengan sekali pemulihan bila kuncinya ternyata
     * bukan hash (WRONGTYPE).
     *
     * Kasusnya nyata, bukan teoretis: sebelum P-02 kehadiran disimpan sebagai
     * **string** pada kunci yang sama. Saat produksi beralih ke Redis, kunci
     * sisa itu membuat `HSET` gagal terus dan presence mati diam-diam sampai
     * TTL-nya habis. Kunci sisa dibuang, lalu ditulis ulang sebagai hash.
     */
    private function tulisMedan(Connection $toko, string $kunci, string $medan, string $nilai): void
    {
        // phpredis mengembalikan `false` (tidak melempar) saat kuncinya bukan
        // hash, sedangkan klien lain melempar. Dua-duanya diperlakukan sama.
        try {
            $hasil = $toko->hset($kunci, $medan, $nilai);
        } catch (Throwable) {
            $hasil = false;
        }

        if ($hasil !== false) {
            return;
        }

        $toko->del($kunci);
        $toko->hset($kunci, $medan, $nilai);
    }

    /**
     * Jalankan satu rangkaian perintah Redis; galat = nilai bawaan, bukan 500 di
     * jalur ujian.
     *
     * @template T
     *
     * @param  callable(): T  $kerja
     * @param  T  $bawaan
     * @return T
     */
    private function aman(callable $kerja, mixed $bawaan): mixed
    {
        try {
            return $kerja();
        } catch (Throwable $galat) {
            report($galat);

            return $bawaan;
        }
    }

    /**
     * @return array<string, mixed>|null
     */
    private function urai(mixed $mentah): ?array
    {
        if (! is_string($mentah) || $mentah === '') {
            return null;
        }

        try {
            $entri = json_decode($mentah, true, 512, JSON_THROW_ON_ERROR);
        } catch (Throwable) {
            return null;
        }

        return is_array($entri) ? $entri : null;
    }

    /**
     * Kunci Redis lengkap dengan prefiks cache Laravel.
     *
     * Perintah di sini dijalankan langsung ke koneksi (bukan lewat `Repository`,
     * yang tidak punya operasi hash), jadi prefiks harus ditambahkan sendiri
     * supaya tidak bertabrakan dengan kunci cache lain di basis data Redis yang
     * sama.
     */
    private function kunciKuis(int $kuisId): string
    {
        return $this->toko->getPrefix().'presence:kuis:'.$kuisId;
    }

    private function kunciIndeks(): string
    {
        return $this->toko->getPrefix().'presence:indeks';
    }
}
