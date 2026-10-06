<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Sections\Question\Models\Soal;
use App\Sections\Question\Models\Tag;
use App\Sections\Quiz\Enums\StatusKuis;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Mapel;
use App\Sections\School\Models\Sekolah;
use Illuminate\Database\Seeder;

/**
 * Bank soal contoh (idempoten) supaya slice 03 bisa langsung didemokan:
 * tag, empat soal objektif (satu per jenis), satu kuis draf, dan satu kuis
 * terbit yang sedang berjalan.
 */
class BankSoalSeeder extends Seeder
{
    public function run(): void
    {
        $sekolah = Sekolah::query()->orderBy('id')->first();
        $kelas = Kelas::query()->where('school_id', $sekolah?->id)->orderBy('nama')->first();
        $mapel = Mapel::query()->where('school_id', $sekolah?->id)->where('kode', 'MTK')->first()
            ?? Mapel::query()->where('school_id', $sekolah?->id)->first();

        if ($sekolah === null || $kelas === null || $mapel === null) {
            return;
        }

        $tag = Tag::query()->firstOrCreate(
            ['school_id' => $sekolah->id, 'nama' => 'Operasi Hitung'],
            ['deskripsi' => 'Penjumlahan, pengurangan, perkalian, dan pembagian.'],
        );

        if (Soal::query()->where('school_id', $sekolah->id)->doesntExist()) {
            $daftarSoal = [
                [
                    'tipe' => 'pilihan_ganda',
                    'konten' => [
                        'teks' => 'Berapa hasil dari 7 + 8?',
                        'opsi' => [
                            ['id' => 'A', 'teks' => '13'],
                            ['id' => 'B', 'teks' => '14'],
                            ['id' => 'C', 'teks' => '15'],
                            ['id' => 'D', 'teks' => '16'],
                        ],
                    ],
                    'kunci' => ['jawaban' => 'C'],
                ],
                [
                    'tipe' => 'benar_salah',
                    'konten' => ['teks' => 'Hasil dari 9 x 3 adalah 27.'],
                    'kunci' => ['benar' => true],
                ],
                [
                    'tipe' => 'menjodohkan',
                    'konten' => [
                        'teks' => 'Jodohkan soal dengan hasilnya.',
                        'kiri' => [
                            ['id' => 'k1', 'teks' => '6 x 2'],
                            ['id' => 'k2', 'teks' => '20 - 5'],
                        ],
                        'kanan' => [
                            ['id' => 'n1', 'teks' => '12'],
                            ['id' => 'n2', 'teks' => '15'],
                        ],
                    ],
                    'kunci' => ['pasangan' => ['k1' => 'n1', 'k2' => 'n2']],
                ],
                [
                    'tipe' => 'mengurutkan',
                    'konten' => [
                        'teks' => 'Urutkan bilangan dari yang terkecil.',
                        'item' => [
                            ['id' => 'i1', 'teks' => '9'],
                            ['id' => 'i2', 'teks' => '3'],
                            ['id' => 'i3', 'teks' => '7'],
                        ],
                    ],
                    'kunci' => ['urutan' => ['i2', 'i3', 'i1']],
                ],
            ];

            foreach ($daftarSoal as $baris) {
                Soal::query()->create([
                    ...$baris,
                    'school_id' => $sekolah->id,
                    'subject_id' => $mapel->id,
                    'tag_id' => $tag->id,
                    'skor' => 1,
                    'aktif' => true,
                ]);
            }
        }

        $kuisDraf = Kuis::query()->firstOrCreate(
            ['school_id' => $sekolah->id, 'judul' => 'Latihan Operasi Hitung (draf)'],
            [
                'subject_id' => $mapel->id,
                'class_id' => $kelas->id,
                'deskripsi' => 'Contoh kuis draf: bebas diubah untuk demo.',
                'status' => StatusKuis::Draf,
                'durasi_menit' => 20,
            ],
        );

        $kuisBerjalan = Kuis::query()->firstOrCreate(
            ['school_id' => $sekolah->id, 'judul' => 'Ulangan Operasi Hitung'],
            [
                'subject_id' => $mapel->id,
                'class_id' => $kelas->id,
                'deskripsi' => 'Contoh kuis terbit yang sedang berjalan.',
                'status' => StatusKuis::Publikasi,
                'mulai_at' => now()->subMinutes(5),
                'selesai_at' => now()->addHours(2),
                'publikasi_at' => now()->subMinutes(10),
                'durasi_menit' => 30,
            ],
        );

        $idSoal = Soal::query()->where('school_id', $sekolah->id)->orderBy('id')->pluck('id')->all();

        foreach ([$kuisDraf, $kuisBerjalan] as $kuis) {
            if ($kuis->soal()->count() === 0) {
                $kuis->soal()->attach(
                    collect($idSoal)->mapWithKeys(
                        static fn (int $id, int $posisi): array => [$id => ['urutan' => $posisi + 1]],
                    )->all(),
                );
            }
        }
    }
}
