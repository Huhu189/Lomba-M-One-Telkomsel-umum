<?php

declare(strict_types=1);

namespace App\Sections\Presence\Contracts;

/**
 * Gudang entri kehadiran satu kuis (slice 07, dirombak P-02).
 *
 * Kontraknya sengaja **operasi per entri**, bukan "baca seluruh peta lalu tulis
 * ulang". Tiap request murid yang memang sudah terjadi (memuat attempt, menyimpan
 * jawaban, ping) hanya perlu menyentuh entri miliknya sendiri, jadi biaya satu
 * request tidak boleh tumbuh seiring jumlah murid di kelas.
 *
 * Dua implementasi:
 * - `GudangRedis` memakai hash Redis (HSET/HGET satu medan + satu set indeks),
 *   sehingga tulis dan baca satu entri O(1) — ini yang dipakai bila cache
 *   aplikasi memang Redis.
 * - `GudangPeta` menyimpan satu peta utuh di cache Laravel (driver array/
 *   database). Perilaku lama, biaya O(N) per request, dan hanya dipakai sebagai
 *   cadangan saat Redis tidak tersedia.
 *
 * Fail-open: implementasi yang bergantung layanan luar tidak boleh melempar ke
 * jalur ujian (lihat `GudangRedis`).
 */
interface GudangPresence
{
    /** Nama gudang untuk jejak/audit: `redis`, `peta`. */
    public function nama(): string;

    /**
     * Satu entri kehadiran; `null` bila belum pernah tercatat.
     *
     * @return array<string, mixed>|null
     */
    public function entri(int $kuisId, int $attemptId): ?array;

    /**
     * Simpan/segarkan satu entri.
     *
     * @param  array<string, mixed>  $entri
     */
    public function simpan(int $kuisId, int $attemptId, array $entri): void;

    /**
     * Seluruh entri satu kuis.
     *
     * Nilai yang tidak terbaca dikembalikan sebagai `null` (bukan dibuang) supaya
     * pemanggil bisa membuangnya lewat `buang()`.
     *
     * @return array<int, array<string, mixed>|null>
     */
    public function semua(int $kuisId): array;

    /**
     * Buang entri tertentu (boleh beberapa sekaligus, dipakai sapuan).
     *
     * @param  array<int, int>  $attemptIds
     */
    public function buang(int $kuisId, array $attemptIds): void;

    /**
     * Id kuis yang masih punya catatan kehadiran.
     *
     * @return array<int, int>
     */
    public function kuis(): array;

    /** Buang seluruh entri satu kuis beserta catatan indeksnya. */
    public function lupakanKuis(int $kuisId): void;
}
