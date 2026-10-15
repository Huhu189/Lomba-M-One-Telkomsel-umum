<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Mapel;
use App\Sections\School\Models\Sekolah;
use Illuminate\Database\Seeder;

class MasterDataSeeder extends Seeder
{
    /**
     * Data induk contoh agar aplikasi bisa langsung didemokan (idempoten).
     */
    public function run(): void
    {
        $sekolah = Sekolah::query()->orderBy('id')->first();

        if ($sekolah === null) {
            return;
        }

        $daftarKelas = [
            ['nama' => '6A', 'tingkat' => 6],
            ['nama' => '6B', 'tingkat' => 6],
            ['nama' => '5A', 'tingkat' => 5],
            // Kelas 4 dipakai materi contoh bertema gunung (`MateriContohSeeder`):
            // videonya memang untuk kelas 4 SD, jadi demonya pun sepadan.
            ['nama' => '4A', 'tingkat' => 4],
        ];

        foreach ($daftarKelas as $kelas) {
            Kelas::query()->firstOrCreate(
                ['school_id' => $sekolah->id, 'nama' => $kelas['nama']],
                ['tingkat' => $kelas['tingkat'], 'tahun_ajaran' => '2026/2027'],
            );
        }

        $daftarMapel = [
            ['nama' => 'Matematika', 'kode' => 'MTK'],
            ['nama' => 'Bahasa Indonesia', 'kode' => 'BIN'],
            ['nama' => 'Ilmu Pengetahuan Alam', 'kode' => 'IPA'],
        ];

        foreach ($daftarMapel as $mapel) {
            Mapel::query()->firstOrCreate(
                ['school_id' => $sekolah->id, 'nama' => $mapel['nama']],
                ['kode' => $mapel['kode']],
            );
        }
    }
}
