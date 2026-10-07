<?php

declare(strict_types=1);

namespace App\Sections\Cache\Contracts;

/**
 * Satu lapisan cache (slice 10).
 *
 * Muatan selalu dibungkus `['muatan' => mixed, 'versi' => int]` supaya lapisan
 * atas bisa menolak salinan yang tertinggal versinya (validation check).
 * Pemanggil tidak pernah menganggap lapisan ini sumber kebenaran — sumbernya
 * tetap database.
 */
interface LapisanCache
{
    /** Nama lapisan untuk jejak/audit: `redis`, `l1`. */
    public function nama(): string;

    /** Apakah lapisan ini benar-benar bisa dipakai saat ini. */
    public function tersedia(): bool;

    /** @return array{muatan: mixed, versi: int}|null */
    public function ambil(string $kunci): ?array;

    public function simpan(string $kunci, mixed $muatan, int $versi): void;

    public function lupakan(string $kunci): void;

    /** Buang seluruh salinan satu ruang (mis. saat L1 dimatikan). */
    public function lupakanRuang(string $ruang): void;
}
