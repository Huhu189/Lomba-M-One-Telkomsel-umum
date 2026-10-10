<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\User;
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
    /**
     * Contoh soal tipe baru gelombang 1 (Objektif 1B) untuk demo editor dan
     * layar murid. Tiap contoh dibuat sekali (idempoten) lewat `run()`.
     *
     * @return array<int, array{tipe: string, konten: array<string, mixed>, kunci: array<string, mixed>}>
     */
    private function soalTipeBaru(): array
    {
        return [
            [
                'tipe' => 'pilihan_ganda_kompleks',
                'konten' => [
                    'teks' => 'Centang semua bilangan genap.',
                    'opsi' => [
                        ['id' => 'o1', 'teks' => '4'],
                        ['id' => 'o2', 'teks' => '7'],
                        ['id' => 'o3', 'teks' => '10'],
                        ['id' => 'o4', 'teks' => '15'],
                    ],
                ],
                'kunci' => ['benar' => ['o1', 'o3']],
            ],
            [
                'tipe' => 'benar_salah_majemuk',
                'konten' => [
                    'teks' => 'Tandai benar atau salah tiap pernyataan.',
                    'pernyataan' => [
                        ['id' => 'p1', 'teks' => '8 + 5 = 13'],
                        ['id' => 'p2', 'teks' => '6 x 6 = 30'],
                        ['id' => 'p3', 'teks' => '20 : 4 = 5'],
                    ],
                ],
                'kunci' => ['jawaban' => ['p1' => true, 'p2' => false, 'p3' => true]],
            ],
            [
                'tipe' => 'isian_angka',
                'konten' => ['teks' => 'Berapa hasil 12 + 9?', 'satuan' => 'cm'],
                'kunci' => ['nilai' => 21, 'toleransi' => 0],
            ],
            [
                'tipe' => 'pilihan_gambar',
                'konten' => [
                    'teks' => 'Pilih gambar lingkaran.',
                    'opsi' => [
                        ['id' => 'g1', 'media' => '/media/lingkaran.png'],
                        ['id' => 'g2', 'media' => '/media/persegi.png'],
                        ['id' => 'g3', 'media' => '/media/segitiga.png'],
                    ],
                ],
                'kunci' => ['benar' => 'g1'],
            ],
            [
                'tipe' => 'urut_gambar',
                'konten' => [
                    'teks' => 'Urutkan gambar dari yang paling kecil.',
                    'item' => [
                        ['id' => 'u1', 'media' => '/media/besar.png'],
                        ['id' => 'u2', 'media' => '/media/kecil.png'],
                        ['id' => 'u3', 'media' => '/media/sedang.png'],
                    ],
                ],
                'kunci' => ['urutan' => ['u2', 'u3', 'u1']],
            ],
            [
                'tipe' => 'susun_huruf',
                'konten' => ['petunjuk' => 'Nama hewan berkaki empat yang mengeong.'],
                'kunci' => ['kata' => 'kucing'],
            ],
        ];
    }

    public function run(): void
    {
        $sekolah = Sekolah::query()->orderBy('id')->first();
        $kelas = Kelas::query()->where('school_id', $sekolah?->id)->orderBy('nama')->first();
        $mapel = Mapel::query()->where('school_id', $sekolah?->id)->where('kode', 'MTK')->first()
            ?? Mapel::query()->where('school_id', $sekolah?->id)->first();

        if ($sekolah === null || $kelas === null || $mapel === null) {
            return;
        }

        // Pemilik contoh konten: akun guru demo. Sejak K-04 batas baca soal/kuis
        // mengikuti pemiliknya, jadi soal contoh tanpa pemilik akan tampak kosong
        // di Bank Soal guru. Admin tetap melihat semuanya.
        $pemilik = User::query()->where('email', 'guru1@sekolah.test')->value('id')
            ?? User::query()->where('role', 'admin')->orderBy('id')->value('id');

        $tag = Tag::query()->firstOrCreate(
            ['school_id' => $sekolah->id, 'nama' => 'Operasi Hitung'],
            ['deskripsi' => 'Penjumlahan, pengurangan, perkalian, dan pembagian.'],
        );

        // Konten contoh dari seeder lama ber-`dibuat_oleh` NULL (lalu diisi admin
        // oleh migrasi pengisian pemilik). Karena baris contoh ini memang milik
        // seeder ini — kuncinya persis judul soal di bawah — pemiliknya
        // dipastikan kembali ke akun guru demo, supaya demo Bank Soal tetap bisa
        // dibuka oleh akun guru yang dipakai mendemokan.
        if ($pemilik !== null) {
            Kuis::query()
                ->where('school_id', $sekolah->id)
                ->whereIn('judul', ['Latihan Operasi Hitung (draf)', 'Ulangan Operasi Hitung'])
                ->where(fn ($query) => $query->whereNull('dibuat_oleh')->orWhere('dibuat_oleh', '!=', $pemilik))
                ->update(['dibuat_oleh' => $pemilik]);

            Soal::query()
                ->where('school_id', $sekolah->id)
                ->where('tag_id', $tag->id)
                ->where(fn ($query) => $query->whereNull('dibuat_oleh')->orWhere('dibuat_oleh', '!=', $pemilik))
                ->update(['dibuat_oleh' => $pemilik]);
        }

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
                    'dibuat_oleh' => $pemilik,
                ]);
            }
        }

        // Contoh soal tipe baru (Objektif 1) — dibuat idempoten, terpisah dari
        // blok di atas supaya instalasi yang sudah punya bank soal lama tetap
        // mendapat contoh tipe baru tanpa menggandakan soal lama.
        foreach ($this->soalTipeBaru() as $baris) {
            $penanda = $baris['konten']['teks'] ?? $baris['konten']['petunjuk'] ?? '';
            $kolomPenanda = isset($baris['konten']['teks']) ? 'konten->teks' : 'konten->petunjuk';

            $ada = Soal::query()
                ->where('school_id', $sekolah->id)
                ->where('tag_id', $tag->id)
                ->where('tipe', $baris['tipe'])
                ->where($kolomPenanda, $penanda)
                ->exists();

            if ($ada) {
                continue;
            }

            Soal::query()->create([
                ...$baris,
                'school_id' => $sekolah->id,
                'subject_id' => $mapel->id,
                'tag_id' => $tag->id,
                'skor' => 1,
                'aktif' => true,
                'dibuat_oleh' => $pemilik,
            ]);
        }

        $kuisDraf = Kuis::query()->firstOrCreate(
            ['school_id' => $sekolah->id, 'judul' => 'Latihan Operasi Hitung (draf)'],
            [
                'subject_id' => $mapel->id,
                'class_id' => $kelas->id,
                'deskripsi' => 'Contoh kuis draf: bebas diubah untuk demo.',
                'status' => StatusKuis::Draf,
                'durasi_menit' => 20,
                'dibuat_oleh' => $pemilik,
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
                'dibuat_oleh' => $pemilik,
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
