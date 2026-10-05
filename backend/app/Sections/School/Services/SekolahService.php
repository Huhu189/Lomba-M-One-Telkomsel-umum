<?php

declare(strict_types=1);

namespace App\Sections\School\Services;

use App\Sections\School\Models\Sekolah;

/**
 * Sekolah — satu instalasi satu sekolah.
 */
class SekolahService
{
    /**
     * Ambil satu-satunya baris sekolah.
     */
    public function tunggal(): Sekolah
    {
        return Sekolah::query()->orderBy('id')->firstOrFail();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function perbarui(array $data): Sekolah
    {
        $sekolah = $this->tunggal();
        $sekolah->fill($data)->save();

        return $sekolah->refresh();
    }
}
