<?php

declare(strict_types=1);

namespace App\Sections\Cache\Services;

use App\Sections\Cache\Contracts\LapisanCache;
use Illuminate\Support\Carbon;
use PDO;
use Throwable;

/**
 * L1: salinan sementara di SQLite tmpfs (slice 10).
 *
 * Kenapa SQLite di tmpfs: berkasnya di RAM (tidak menyentuh disk), tidak perlu
 * server tambahan, dan tetap satu berkas yang bisa dibaca beberapa proses FPM
 * sekaligus dengan mode WAL. Isinya selalu boleh hilang — kalau berkasnya tidak
 * bisa dibuka, lapisan ini hanya berlaku sebagai "tidak ada salinan".
 */
final class LapisanL1 implements LapisanCache
{
    private ?PDO $pdo = null;

    private bool $gagal = false;

    public function __construct(
        private readonly string $jalur,
        private readonly int $ttlDetik,
        private readonly bool $aktif = true,
    ) {}

    /**
     * Jalur default: `/dev/shm` (tmpfs) bila tersedia, kalau tidak storage lokal.
     */
    public static function jalurBawaan(?string $eksplisit = null): string
    {
        if (is_string($eksplisit) && trim($eksplisit) !== '') {
            return $eksplisit;
        }

        return is_dir('/dev/shm') && is_writable('/dev/shm')
            ? '/dev/shm/ulangan-l1.sqlite'
            : storage_path('framework/cache/ulangan-l1.sqlite');
    }

    public function nama(): string
    {
        return 'l1';
    }

    /** Apakah L1 siap dipakai (saklar nyala dan berkasnya bisa dibuka). */
    public function tersedia(): bool
    {
        return $this->aktif && $this->pdo() !== null;
    }

    /**
     * @return array{muatan: mixed, versi: int}|null
     */
    public function ambil(string $kunci): ?array
    {
        $pdo = $this->pdo();

        if ($pdo === null) {
            return null;
        }

        try {
            $pernyataan = $pdo->prepare('SELECT muatan, versi, ditulis_at FROM state_cache WHERE nama = :nama');
            $pernyataan->execute(['nama' => $kunci]);
            $baris = $pernyataan->fetch(PDO::FETCH_ASSOC);

            if ($baris === false) {
                return null;
            }

            $umur = Carbon::parse((string) $baris['ditulis_at'])->diffInSeconds(Carbon::now());

            if ($umur > $this->ttlDetik) {
                $this->lupakan($kunci);

                return null;
            }

            $muatan = json_decode((string) $baris['muatan'], true, 512, JSON_THROW_ON_ERROR);

            return ['muatan' => $muatan, 'versi' => (int) $baris['versi']];
        } catch (Throwable) {
            return null;
        }
    }

    public function simpan(string $kunci, mixed $muatan, int $versi): void
    {
        $pdo = $this->pdo();

        if ($pdo === null) {
            return;
        }

        try {
            $pernyataan = $pdo->prepare(
                'INSERT INTO state_cache (nama, muatan, versi, ditulis_at) VALUES (:nama, :muatan, :versi, :ditulis_at)
                 ON CONFLICT(nama) DO UPDATE SET muatan = excluded.muatan, versi = excluded.versi, ditulis_at = excluded.ditulis_at',
            );

            $pernyataan->execute([
                'nama' => $kunci,
                'muatan' => json_encode($muatan, JSON_THROW_ON_ERROR),
                'versi' => $versi,
                'ditulis_at' => Carbon::now()->toIso8601String(),
            ]);
        } catch (Throwable) {
            // Gagal menulis salinan bukan alasan menggagalkan permintaan.
        }
    }

    public function lupakan(string $kunci): void
    {
        $pdo = $this->pdo();

        if ($pdo === null) {
            return;
        }

        try {
            $pernyataan = $pdo->prepare('DELETE FROM state_cache WHERE nama = :nama');
            $pernyataan->execute(['nama' => $kunci]);
        } catch (Throwable) {
            // sama: diamkan
        }
    }

    public function lupakanRuang(string $ruang): void
    {
        $pdo = $this->pdo();

        if ($pdo === null) {
            return;
        }

        try {
            $pernyataan = $pdo->prepare('DELETE FROM state_cache WHERE nama LIKE :awalan');
            $pernyataan->execute(['awalan' => $this->escapeLike($ruang).':%']);
        } catch (Throwable) {
            // sama: diamkan
        }
    }

    /**
     * Buka koneksi sekali saja per proses; gagal = lapisan ini tidak dipakai.
     */
    private function pdo(): ?PDO
    {
        if (! $this->aktif || $this->gagal) {
            return null;
        }

        if ($this->pdo !== null) {
            return $this->pdo;
        }

        try {
            $folder = dirname($this->jalur);

            if (! is_dir($folder)) {
                mkdir($folder, 0770, true);
            }

            $pdo = new PDO('sqlite:'.$this->jalur, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_TIMEOUT => 2,
            ]);

            // WAL supaya pembacaan tidak memblokir penulisan salinan.
            $pdo->exec('PRAGMA journal_mode=WAL');
            $pdo->exec('PRAGMA synchronous=NORMAL');
            $pdo->exec(
                'CREATE TABLE IF NOT EXISTS state_cache (
                    nama TEXT PRIMARY KEY,
                    muatan TEXT NOT NULL,
                    versi INTEGER NOT NULL,
                    ditulis_at TEXT NOT NULL
                )',
            );

            return $this->pdo = $pdo;
        } catch (Throwable) {
            $this->gagal = true;

            return null;
        }
    }

    private function escapeLike(string $teks): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $teks);
    }
}
