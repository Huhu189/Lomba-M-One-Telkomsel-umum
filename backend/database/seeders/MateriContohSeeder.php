<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\User;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Attempt\Models\Jawaban;
use App\Sections\Auth\Enums\UserStatus;
use App\Sections\Material\Models\BlokMateri;
use App\Sections\Material\Models\Materi;
use App\Sections\Material\Registry\TemaPerjalanan;
use App\Sections\Material\Services\MateriService;
use App\Sections\Question\Models\Soal;
use App\Sections\Question\Models\Tag;
use App\Sections\Quiz\Enums\StatusKuis;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Mapel;
use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Materi video contoh **bertema perjalanan Mendaki Gunung** (idempoten).
 *
 * Kenapa ada: materi contoh di dev dulu hanya berisi teks pendek, sehingga fitur
 * yang paling menjadi ciri aplikasi ini — perjalanan berpos, klip video, dan
 * latihan yang muncul **di dalam** video — tidak pernah terlihat saat demo.
 * Seeder ini menyusun satu materi sungguhan yang memakai keenam fase tema bawaan
 * (`TemaPerjalanan::BAWAAN`), dari Basecamp sampai Puncak.
 *
 * Sumbernya satu video asli: "PROSES FOTOSINTESIS PADA TUMBUHAN (KELAS 4 SD
 * KURIKULUM MERDEKA)" (kanal Ratih Setyaningrum) — panjangnya **3 menit 5 detik
 * (185 detik)**, dan angka itu dipakai apa adanya sebagai durasi klip
 * (`DURASI_VIDEO`), supaya pos-pos sesudahnya benar-benar mulai setelah videonya
 * habis, bukan di tengah klip yang masih berjalan.
 *
 * Kualitas yang dibangun di sini (15 Okt 2026):
 *
 * 1. **Tiga titik latihan DI DALAM video** (detik 40, 95, 150 dari klip 185
 *    detik). Video itu tidak punya bab menit tetap, jadi titiknya disebar rata
 *    dan disusun menurut isi: bahan → alat/tempat → hasil. Tiap latihan
 *    benar-benar menjadi kuis di dalam pemutar (server menandainya `host_id` =
 *    blok videonya), bukan blok terpisah di bawahnya.
 * 2. **Penjelasan sesudah setiap latihan** — termasuk ringkasan rumus dan
 *    tantangan rumah sesudah ujian penutup, jadi materi tetap punya penutup yang
 *    hangat walau pos terakhirnya adalah kuis.
 * 3. **Jenis soal beragam** dari registry yang sudah ada: pilihan ganda, benar/
 *    salah, isian singkat, menjodohkan, mengurutkan, dan **letak kata** (bahan
 *    diletakkan pada bagian tumbuhan yang mengurusinya — persis alur video).
 * 4. **Kredit sumber** ditulis di keterangan klip, supaya jelas videonya milik
 *    siapa dan berapa panjangnya.
 * 5. **Pembahasan guru untuk SETIAP soal** (15 Okt 2026). Sebelum ini kolom
 *    `pembahasan` kosong, sehingga kartu ingat sesudah latihan hanya
 *    memperlihatkan kunci jawaban tanpa alasan — "jawabannya A" tanpa "kenapa".
 *    Teksnya ada di `PEMBAHASAN`, dikunci pada teks soalnya, dan HANYA diisi
 *    bila kolomnya masih kosong (tulisan guru tidak pernah ditimpa).
 * 6. **Ujian penutup bertambah dua soal bertipe baru** — pilihan ganda kompleks
 *    ("pilih semua bahan") dan klasifikasi (bahan vs hasil) — supaya anak tidak
 *    hanya mengenali jawaban, tetapi memilahnya sendiri.
 *
 * Semua baris dibuat dengan kunci judul/teks yang tetap, lalu bloknya disusun
 * lewat `MateriService::sinkronBlok` — bukan ditulis langsung ke tabel — supaya
 * aturan yang sama dengan jalur guru (batas teks, tautan aman, penempatan
 * timeline, kuis sisipan harus objektif) tetap berlaku saat menyiapkan contoh.
 */
class MateriContohSeeder extends Seeder
{
    /** Judul tetap materi contoh (kunci idempotensi). */
    public const JUDUL = 'Fotosintesis: Perjalanan Memasak Makanan di Daun';

    /** Video YouTube: "Proses Fotosintesis pada Tumbuhan" (kelas 4 SD). */
    public const TAUTAN_VIDEO = 'https://youtu.be/nlXwuNHF8JM';

    /** Panjang asli klip video (detik) — 3 menit 5 detik. */
    public const DURASI_VIDEO = 185;

    /**
     * Detik DI DALAM klip tempat tiap latihan menjeda video, urut menurut isi
     * video: bahan → alat & tempat → hasil.
     *
     * @var array{0: int, 1: int, 2: int}
     */
    public const SISIPAN_DETIK = [40, 95, 150];

    /** Durasi tampilan satu pos teks/kuis di timeline (detik). */
    private const DURASI_POS = 20;

    /**
     * Pembahasan guru untuk tiap soal, dikunci pada **teks soalnya** (15 Okt 2026).
     *
     * Kunci pada teks — bukan pada id soal — karena id berubah tiap basis data,
     * sedangkan teks soal adalah penanda idempotensi yang sudah dipakai seeder ini
     * untuk mencari barisnya (`konten->teks`).
     *
     * Panjang tiap teks dijaga di bawah 500 karakter (batas kolom `pembahasan` di
     * `SimpanSoalRequest`) dan ditulis untuk anak kelas 4: menyebut alasan, bukan
     * sekadar mengulang jawabannya.
     *
     * @var array<string, string>
     */
    private const PEMBAHASAN = [
        'Bahan yang diserap tumbuhan dari dalam tanah untuk fotosintesis adalah ...' => 'Air diserap akar dari dalam tanah, lalu diangkut batang sampai ke daun. '
            .'Oksigen dan gula bukan bahan — keduanya hasil. Cahaya matahari juga bukan bahan: '
            .'ia sumber energi yang menyalakan dapur di daun.',

        'Fotosintesis hanya bisa terjadi bila tumbuhan mendapat cahaya matahari.' => 'Benar. Cahaya matahari adalah sumber energi dapur daun. Tanaman yang rajin disiram '
            .'tetapi lama disimpan di tempat gelap akan pucat dan lemah, karena fotosintesisnya '
            .'berhenti walau airnya cukup.',

        'Gas dari udara yang dibutuhkan tumbuhan untuk fotosintesis adalah ...' => 'Karbon dioksida (CO₂). Gas ini masuk lewat stomata — mulut daun. Oksigen justru '
            .'DILEPAS tumbuhan saat fotosintesis, jadi oksigen bukan bahan yang diserap.',

        'Zat hijau pada daun yang bertugas menangkap cahaya matahari disebut ...' => 'Klorofil, zat hijau di dalam kloroplas. Karena klorofillah daun tampak hijau dan '
            .'bisa menangkap cahaya. Stomata adalah mulut daun (jalan udara); akar menyerap air '
            .'dari tanah.',

        'Mulut daun tempat udara masuk dan keluar disebut ...' => 'Stomata (bentuk tunggalnya: stoma) — lubang kecil di permukaan daun. Lewat lubang '
            .'itu karbon dioksida masuk dan oksigen keluar.',

        'Letakkan setiap bahan pada bagian tumbuhan yang mengurusinya.' => 'Air → akar (menyerap dari tanah). Karbon dioksida → stomata (masuk lewat mulut '
            .'daun). Cahaya matahari → klorofil (zat hijau yang menangkapnya).',

        'Hasil fotosintesis yang dipakai tumbuhan untuk tumbuh adalah ...' => 'Glukosa (gula) adalah MAKANAN tumbuhan: dipakai untuk tumbuh, berbunga, dan '
            .'berbuah. Oksigen memang ikut dihasilkan, tetapi bukan makanan — ia dilepas ke '
            .'udara dan justru dipakai kita untuk bernapas.',

        'Oksigen yang dilepas tumbuhan saat fotosintesis adalah gas yang kita hirup.' => 'Benar. Karena itu tumbuhan hijau disebut penghasil oksigen: gas sisa dapurnya '
            .'adalah gas yang kita butuhkan untuk bernapas.',

        'Bagian daun yang menangkap cahaya matahari adalah ...' => 'Klorofil (zat hijau daun) di dalam kloroplas. Tulang daun hanya rangka penguat '
            .'daun, akar menyerap air, dan batang mengangkut air ke daun.',

        'Jodohkan bagian tumbuhan dengan tugasnya saat fotosintesis.' => 'Klorofil menangkap cahaya matahari · stomata (mulut daun) menjadi jalan masuk '
            .'udara · akar menyerap air dari tanah. Ketiganya bekerja bersama supaya tumbuhan '
            .'bisa memasak.',

        'Urutkan alur fotosintesis dari yang terjadi paling awal.' => 'Urutannya: air diserap akar → cahaya ditangkap klorofil → glukosa terbentuk → '
            .'oksigen dilepas ke udara. Bahan dulu, lalu prosesnya, baru hasilnya.',

        'Sebutkan nama gula hasil fotosintesis yang dipakai tumbuhan untuk tumbuh.' => 'Glukosa (boleh juga disebut gula). Glukosa inilah makanan tumbuhan; sebagian '
            .'disimpan sebagai cadangan di akar, buah, atau umbi — misalnya pada kentang dan '
            .'wortel.',

        'Air diangkut akar sampai ke daun, lalu dipakai untuk memasak makanan.' => 'Benar. Akar menyerap air, batang mengangkutnya lewat pembuluh sampai daun, dan di '
            .'daun air itu dipakai bersama karbon dioksida untuk membuat glukosa.',

        'Pilih SEMUA yang dibutuhkan tumbuhan agar fotosintesis bisa berjalan.' => 'Yang dibutuhkan adalah air (diserap akar) dan karbon dioksida (masuk lewat '
            .'stomata); cahaya matahari datang sebagai energinya. Glukosa adalah HASIL, bukan '
            .'bahan, dan pupuk bukan bahan fotosintesis — pupuk menyuburkan tanah, bukan '
            .'dimasak di daun.',

        'Kelompokkan mana BAHAN yang masuk ke daun dan mana HASIL yang dibuat daun.' => 'Yang MASUK ke daun: air dan karbon dioksida (bahan). Yang DIBUAT daun: glukosa '
            .'dan oksigen (hasil). Ingat kalimat intinya: air + karbon dioksida → glukosa + '
            .'oksigen.',
    ];

    public function run(): void
    {
        $sekolah = Sekolah::query()->orderBy('id')->first();

        if ($sekolah === null) {
            return;
        }

        $kelas = Kelas::query()
            ->where('school_id', $sekolah->id)
            ->where('nama', '4A')
            ->first()
            ?? Kelas::query()->where('school_id', $sekolah->id)->orderBy('tingkat')->first();

        $mapel = Mapel::query()->where('school_id', $sekolah->id)->where('kode', 'IPA')->first()
            ?? Mapel::query()->where('school_id', $sekolah->id)->first();

        if ($kelas === null || $mapel === null) {
            return;
        }

        // Pemilik contoh: akun guru demo, supaya materi ini benar-benar bisa
        // dibuka dan disunting guru saat mendemokan (batas baca ikut pemilik).
        $pemilik = User::query()->where('email', 'guru1@sekolah.test')->value('id')
            ?? User::query()->where('role', 'guru')->orderBy('id')->value('id')
            ?? User::query()->where('role', 'admin')->orderBy('id')->value('id');

        $tag = Tag::query()->firstOrCreate(
            ['school_id' => $sekolah->id, 'nama' => 'Fotosintesis'],
            ['deskripsi' => 'Proses tumbuhan memasak makanan sendiri dengan bantuan cahaya matahari.'],
        );

        $kelasKuis = ['school_id' => $sekolah->id, 'subject_id' => $mapel->id, 'class_id' => $kelas->id, 'pemilik' => $pemilik];

        $kuisBahan = $this->kuis($kelasKuis, [
            'judul' => 'Latihan Pos Sungai Deras: Bahan Fotosintesis',
            'deskripsi' => 'Latihan sisipan pertama (detik 40): apa saja bahan yang dibutuhkan tumbuhan.',
            'soal' => $this->soalBahan($sekolah->id, $tag->id, $pemilik),
        ]);

        $kuisAlat = $this->kuis($kelasKuis, [
            'judul' => 'Latihan Pos Lereng Berbatu: Alat dan Tempat Kerja Daun',
            'deskripsi' => 'Latihan sisipan kedua (detik 95): klorofil, stomata, dan bagian tumbuhan yang mengurusinya.',
            'soal' => $this->soalAlat($sekolah->id, $tag->id, $pemilik),
        ]);

        $kuisHasil = $this->kuis($kelasKuis, [
            'judul' => 'Latihan Pos Kabut Puncak: Hasil Fotosintesis',
            'deskripsi' => 'Latihan sisipan ketiga (detik 150): apa yang dihasilkan dan untuk apa.',
            'soal' => $this->soalHasil($sekolah->id, $tag->id, $pemilik),
        ]);

        $kuisPuncak = $this->kuis($kelasKuis, [
            'judul' => 'Ujian Puncak: Fotosintesis',
            'deskripsi' => 'Ujian penutup pendakian: bahan, tempat, urutan, hasil, dan kegunaannya bagi kita.',
            'soal' => $this->soalPuncak($sekolah->id, $tag->id, $pemilik),
        ]);

        $materi = Materi::query()->firstOrCreate(
            ['school_id' => $sekolah->id, 'judul' => self::JUDUL],
            [
                'subject_id' => $mapel->id,
                'class_id' => $kelas->id,
                'tag_id' => $tag->id,
                'deskripsi' => 'Materi IPA kelas 4: perjalanan menelusuri cara tumbuhan memasak makanan sendiri.',
                'urutan' => 1,
                'dibuat_oleh' => $pemilik,
            ],
        );

        // Baris contoh ini milik seeder ini, jadi kelas/mapel/tag-nya ikut
        // diselaraskan saat seeder dijalankan ulang. Tanpa itu, instalasi yang
        // pernah menyeed sebelum kelas 4A ada akan menyimpan materi ini di kelas
        // cadangan (mis. wadah tamu) dan tidak pernah bisa dibuka murid.
        $materi->fill([
            'subject_id' => $mapel->id,
            'class_id' => $kelas->id,
            'tag_id' => $tag->id,
            'urutan' => 1,
            'dibuat_oleh' => $pemilik,
        ])->save();

        $this->muridDemo($sekolah->id, $kelas->id);

        // Timeline: pos teks pembuka, klip video sepanjang video aslinya, tiga
        // latihan yang jatuh DI DALAM klip itu, lalu ujian penutup SETELAH klip
        // berakhir. Enam pos = keenam fase tema gunung, tanpa pos tanpa nama.
        $awalVideo = self::DURASI_POS;
        $akhirVideo = $awalVideo + self::DURASI_VIDEO;

        $blok = [
            [
                'tipe' => 'teks',
                'wajib' => true,
                'fase' => 'Basecamp',
                'track' => 0,
                'mulai_detik' => 0,
                'durasi_detik' => self::DURASI_POS,
                'isi' => ['teks' => $this->teksBasecamp()],
            ],
            [
                'tipe' => 'media',
                'wajib' => true,
                'fase' => 'Jalur Pinus',
                'track' => 0,
                'mulai_detik' => $awalVideo,
                'durasi_detik' => self::DURASI_VIDEO,
                'isi' => [
                    'tautan' => self::TAUTAN_VIDEO,
                    'keterangan' => 'Video: PROSES FOTOSINTESIS PADA TUMBUHAN (Kelas 4 SD) — Ratih Setyaningrum · 3 menit 5 detik',
                ],
                'tampilan' => ['fit' => 'contain', 'fokus_x' => 50, 'fokus_y' => 50, 'zoom' => 1],
            ],
            [
                'tipe' => 'kuis',
                'wajib' => true,
                'fase' => 'Sungai Deras',
                'quiz_id' => $kuisBahan->id,
                'track' => 0,
                'mulai_detik' => $awalVideo + self::SISIPAN_DETIK[0],
                'durasi_detik' => 14,
                'tampilan' => ['mode' => 'jeda', 'tata' => 'vertikal', 'ringkasan' => true, 'kartu' => true],
                'isi' => $this->penjelasan($this->penjelasanBahan()),
            ],
            [
                'tipe' => 'kuis',
                'wajib' => true,
                'fase' => 'Lereng Berbatu',
                'quiz_id' => $kuisAlat->id,
                'track' => 0,
                'mulai_detik' => $awalVideo + self::SISIPAN_DETIK[1],
                'durasi_detik' => 14,
                'tampilan' => ['mode' => 'jeda', 'tata' => 'vertikal', 'ringkasan' => true, 'kartu' => true],
                'isi' => $this->penjelasan($this->penjelasanAlat()),
            ],
            [
                'tipe' => 'kuis',
                'wajib' => true,
                'fase' => 'Kabut Puncak',
                'quiz_id' => $kuisHasil->id,
                'track' => 0,
                'mulai_detik' => $awalVideo + self::SISIPAN_DETIK[2],
                'durasi_detik' => 14,
                'tampilan' => ['mode' => 'jeda', 'tata' => 'vertikal', 'ringkasan' => true, 'kartu' => true],
                'isi' => $this->penjelasan($this->penjelasanHasil()),
            ],
            [
                // Mulai tepat saat videonya habis: ujian penutup tidak lagi
                // menumpang klip. Penjelasan sesudahnya merangkap penutup materi
                // (ringkasan rumus + tantangan di rumah).
                'tipe' => 'kuis',
                'wajib' => true,
                'fase' => 'Puncak',
                'quiz_id' => $kuisPuncak->id,
                'track' => 0,
                'mulai_detik' => $akhirVideo,
                'durasi_detik' => self::DURASI_POS,
                'tampilan' => ['mode' => 'jeda', 'tata' => 'vertikal', 'ringkasan' => true, 'kartu' => true, 'papan' => true],
                'isi' => $this->penjelasan($this->penjelasanPuncak()),
            ],
        ];

        // Tema perjalanan: memakai keenam fase bawaan tema "Mendaki Gunung",
        // satu fase untuk satu blok — itulah "kerangka gunung" yang dilihat anak
        // sebagai peta beranimasi.
        $tema = [
            'kode' => TemaPerjalanan::BAWAAN,
            'nama' => 'Mendaki Gunung Fotosintesis',
        ];

        app(MateriService::class)->sinkronBlok($materi, $blok, $tema);
        app(MateriService::class)->publikasi($materi);

        $this->rapikanKuisLama();
        $this->rapikanSisaAudit();
    }

    /**
     * Buang kuis contoh yang TIDAK lagi dipakai susunan materi ini.
     *
     * Versi seeder sebelumnya memakai judul lain ("Latihan Jalur Pinus…",
     * "Latihan Pos Lereng Berbatu: Alat dan Hasil…"). Setelah susunannya naik ke
     * tiga titik latihan, keduanya jadi yatim: tidak ditunjuk blok mana pun dan
     * belum pernah dikerjakan. Dibiarkan, ia cuma muncul di bank soal guru sebagai
     * kuis menganggur — dan bank soal yang bersih termasuk mutu contoh.
     *
     * Batasnya sengaja ketat: hanya judul tetap di bawah yang disentuh, dan hanya
     * bila benar-benar tidak dipakai blok serta tidak punya riwayat pengerjaan.
     * Jadi tidak ada pekerjaan guru atau riwayat murid yang bisa hilang karena
     * menjalankan ulang seeder ini.
     */
    private function rapikanKuisLama(): void
    {
        $yatim = [
            'Latihan Jalur Pinus: Fotosintesis',
            'Latihan Pos Lereng Berbatu: Alat dan Hasil Fotosintesis',
        ];

        foreach (Kuis::query()->whereIn('judul', $yatim)->get() as $kuis) {
            $dipakaiBlok = BlokMateri::query()->where('quiz_id', $kuis->getKey())->exists();
            $sudahDikerjakan = Attempt::query()->where('quiz_id', $kuis->getKey())->exists();

            if ($dipakaiBlok || $sudahDikerjakan) {
                continue;
            }

            $kuis->delete();
        }
    }

    /**
     * Buang **sisa data harnes audit** yang gagal membersihkan dirinya sendiri.
     *
     * Kenapa ada: harnes peramban (`docs/smoke-ui-*.mjs`) membuat kuis & soal
     * audit lalu menghapusnya lagi di blok `finally`. Dua jalankan yang mati di
     * tengah (mis. halaman yang membeku) meninggalkan barisnya di basis data dev —
     * dan sisa itu bukan sekadar kotor: ia muncul di bank soal guru sebagai kuis
     * "AUDIT …" yang tidak pernah dipakai siapa pun.
     *
     * Batasnya sama ketatnya dengan `rapikanKuisLama`: **hanya** kuis yang judulnya
     * berpola audit, dan **hanya** bila tidak dipakai satu blok materi maupun tidak
     * punya riwayat pengerjaan. Soalnya hanya dibuang bila sesudah itu ia tidak
     * dipakai kuis mana pun dan belum pernah dijawab murid. Jadi mengerjakan seeder
     * ini tidak bisa menghapus pekerjaan guru atau riwayat murid.
     */
    private function rapikanSisaAudit(): void
    {
        $sisa = Kuis::query()
            ->where('judul', 'like', 'AUDIT %')
            ->orWhere('judul', 'like', '% AUDIT %')
            ->get();

        foreach ($sisa as $kuis) {
            $dipakaiBlok = BlokMateri::query()->where('quiz_id', $kuis->getKey())->exists();
            $sudahDikerjakan = Attempt::query()->where('quiz_id', $kuis->getKey())->exists();

            if ($dipakaiBlok || $sudahDikerjakan) {
                continue;
            }

            $idSoal = $kuis->soal()->pluck('questions.id')
                ->map(static fn ($satu): int => (int) $satu)
                ->all();

            $kuis->soal()->detach();
            $kuis->delete();

            foreach ($idSoal as $soalId) {
                $soal = Soal::query()->find($soalId);

                if ($soal === null) {
                    continue;
                }

                if ($soal->kuis()->exists() || Jawaban::query()->where('question_id', $soalId)->exists()) {
                    continue;
                }

                $soal->delete();
            }
        }
    }

    /**
     * Akun murid demo di kelas materi contoh (idempoten).
     *
     * Materi murid hanya terbuka lewat kelas, jadi tanpa satu pun akun di kelas
     * ini materi contohnya tidak bisa dicoba dari sisi anak — dan itulah sisi yang
     * paling ingin dilihat saat demo.
     */
    private function muridDemo(int $sekolahId, int $kelasId): void
    {
        $user = User::query()->firstOrCreate(
            ['email' => 'murid4a@sekolah.test'],
            [
                'name' => 'Murid Contoh 4A',
                'password' => Hash::make('Passw0rd!Aman', ['memory_cost' => 1024]),
                'status' => UserStatus::Aktif->value,
                'email_verified_at' => now(),
                'role' => 'murid',
            ],
        );

        $user->assignRole('murid');

        $profil = Murid::query()->firstOrCreate(
            ['user_id' => $user->id],
            [
                'school_id' => $sekolahId,
                'class_id' => $kelasId,
                'nis' => '40001',
            ],
        );

        if ((int) $profil->class_id !== $kelasId) {
            $profil->forceFill(['class_id' => $kelasId, 'school_id' => $sekolahId])->save();
        }
    }

    /**
     * Satu kuis contoh + soalnya (idempoten lewat judul kuisnya).
     *
     * @param  array{school_id: int, subject_id: int, class_id: int, pemilik: int|null}  $kelas
     * @param  array{judul: string, deskripsi: string, soal: array<int, array<string, mixed>>}  $data
     */
    private function kuis(array $kelas, array $data): Kuis
    {
        $kuis = Kuis::query()->firstOrCreate(
            ['school_id' => $kelas['school_id'], 'judul' => $data['judul']],
            [
                // Slug wajib diisi di sini: `KuisService` yang biasanya membuatnya,
                // sedangkan seeder membuat barisnya langsung ke model. Tanpa slug,
                // klien menolak SELURUH daftar kuis (skema `slug: z.string()`) dan
                // beranda menulis "Gagal memuat jadwal kuis".
                'slug' => Kuis::slugBaru(),
                'subject_id' => $kelas['subject_id'],
                'class_id' => $kelas['class_id'],
                'deskripsi' => $data['deskripsi'],
                // Latihan materi harus TERBIT dan berjadwal: `AttemptService`
                // menolak kuis yang belum diterbitkan atau yang jendelanya belum
                // terbuka, dan latihan memakai mesin kuis yang sama.
                'status' => StatusKuis::Publikasi,
                'mulai_at' => now()->subDay(),
                'selesai_at' => now()->addMonths(6),
                'publikasi_at' => now()->subDay(),
                'durasi_menit' => 10,
                'acak_soal' => false,
                'acak_opsi' => false,
                'dibuat_oleh' => $kelas['pemilik'],
            ],
        );

        // Sama seperti materinya: kelas/mapel kuis contoh ikut diselaraskan, supaya
        // kuis sisipan tetap sah untuk kelas materi (validasi server menolak kuis
        // milik kelas lain) saat seeder dijalankan ulang di basis data lama.
        $kuis->fill([
            'subject_id' => $kelas['subject_id'],
            'class_id' => $kelas['class_id'],
            'deskripsi' => $data['deskripsi'],
            'dibuat_oleh' => $kelas['pemilik'],
        ])->save();

        // Baris dari seeder versi lama tidak punya slug (dibuat sebelum kolomnya
        // wajib di jalur ini) — dirapikan saat seeder dijalankan ulang.
        if (trim((string) $kuis->slug) === '') {
            $kuis->forceFill(['slug' => Kuis::slugBaru()])->save();
        }

        $id = [];

        foreach ($data['soal'] as $baris) {
            $penanda = (string) ($baris['konten']['teks'] ?? '');

            // Pencarian lewat jalur JSON (`konten->teks`), seperti BankSoalSeeder:
            // cara itu yang membuat seeder ini aman dijalankan berulang kali.
            $soal = Soal::query()
                ->where('school_id', $kelas['school_id'])
                ->where('subject_id', $kelas['subject_id'])
                ->where('tipe', $baris['tipe'])
                ->where('konten->teks', $penanda)
                ->first();

            // Pembahasan: dari barisnya sendiri bila ada, kalau tidak dari peta
            // `PEMBAHASAN` yang dikunci pada teks soalnya.
            $pembahasan = $baris['pembahasan'] ?? (self::PEMBAHASAN[$penanda] ?? null);

            if ($soal === null) {
                $soal = Soal::query()->create([
                    'school_id' => $kelas['school_id'],
                    'subject_id' => $kelas['subject_id'],
                    'tipe' => $baris['tipe'],
                    'konten' => $baris['konten'],
                    'kunci' => $baris['kunci'],
                    'pembahasan' => $pembahasan,
                    'tag_id' => $baris['tag_id'],
                    'skor' => 5,
                    'aktif' => true,
                    'dibuat_oleh' => $kelas['pemilik'],
                ]);
            } elseif (
                is_string($pembahasan)
                && trim($pembahasan) !== ''
                && trim((string) $soal->pembahasan) === ''
            ) {
                // Baris lama (dibuat sebelum seeder ini menulis pembahasan) hanya
                // diisi bila kolomnya MASIH kosong: pembahasan yang sudah ditulis
                // guru lewat editor soal tidak pernah ditimpa seeder.
                $soal->forceFill(['pembahasan' => $pembahasan])->save();
            }

            $id[] = $soal->id;
        }

        // Pemasangan soal bersifat MENAMBAH, bukan "hanya bila kuisnya kosong".
        // Versi sebelumnya berhenti begitu kuisnya punya satu soal, sehingga soal
        // baru yang ditambahkan seeder kemudian (mis. satu soal benar/salah di
        // ujian penutup, 15 Okt 2026) tidak pernah ikut terpasang walau barisnya
        // sudah dibuat — materi tampak lengkap padahal ujiannya kurang satu soal.
        $terpasang = $kuis->soal()->pluck('questions.id')->map(static fn ($satu): int => (int) $satu)->all();
        $urutan = (int) $kuis->soal()->max('quiz_questions.urutan');
        $tambah = [];

        foreach ($id as $soalId) {
            if (in_array($soalId, $terpasang, true)) {
                continue;
            }

            $urutan++;
            $tambah[$soalId] = ['urutan' => $urutan];
        }

        if ($tambah !== []) {
            $kuis->soal()->attach($tambah);
        }

        return $kuis;
    }

    /** Bentuk penjelasan setelah kuis yang dipahami `MateriService`. */
    private function penjelasan(string $teks): array
    {
        return ['penjelasan' => ['teks' => $teks]];
    }

    /**
     * Latihan sisipan 1 (detik 40): BAHAN fotosintesis.
     *
     * @return array<int, array<string, mixed>>
     */
    private function soalBahan(int $sekolahId, int $tagId, ?int $pemilik): array
    {
        return [
            [
                'tipe' => 'pilihan_ganda',
                'konten' => [
                    'teks' => 'Bahan yang diserap tumbuhan dari dalam tanah untuk fotosintesis adalah ...',
                    'opsi' => [
                        ['id' => 'A', 'teks' => 'air'],
                        ['id' => 'B', 'teks' => 'oksigen'],
                        ['id' => 'C', 'teks' => 'gula'],
                        ['id' => 'D', 'teks' => 'cahaya matahari'],
                    ],
                ],
                'kunci' => ['jawaban' => 'A'],
                'tag_id' => $tagId,
            ],
            [
                'tipe' => 'benar_salah',
                'konten' => [
                    'teks' => 'Fotosintesis hanya bisa terjadi bila tumbuhan mendapat cahaya matahari.',
                ],
                'kunci' => ['benar' => true],
                'tag_id' => $tagId,
            ],
            [
                'tipe' => 'isian_singkat',
                'konten' => [
                    'teks' => 'Gas dari udara yang dibutuhkan tumbuhan untuk fotosintesis adalah ...',
                ],
                'kunci' => ['jawaban_baku' => ['karbon dioksida', 'karbondioksida', 'CO2', 'co2']],
                'tag_id' => $tagId,
            ],
        ];
    }

    /**
     * Latihan sisipan 2 (detik 95): ALAT dan TEMPAT kerja daun — termasuk
     * **letak kata**, karena inti bagian video ini adalah "siapa mengurus apa".
     *
     * @return array<int, array<string, mixed>>
     */
    private function soalAlat(int $sekolahId, int $tagId, ?int $pemilik): array
    {
        return [
            [
                'tipe' => 'pilihan_ganda',
                'konten' => [
                    'teks' => 'Zat hijau pada daun yang bertugas menangkap cahaya matahari disebut ...',
                    'opsi' => [
                        ['id' => 'A', 'teks' => 'klorofil'],
                        ['id' => 'B', 'teks' => 'stomata'],
                        ['id' => 'C', 'teks' => 'akar'],
                        ['id' => 'D', 'teks' => 'batang'],
                    ],
                ],
                'kunci' => ['jawaban' => 'A'],
                'tag_id' => $tagId,
            ],
            [
                'tipe' => 'isian_singkat',
                'konten' => [
                    'teks' => 'Mulut daun tempat udara masuk dan keluar disebut ...',
                ],
                'kunci' => ['jawaban_baku' => ['stomata', 'stoma', 'mulut daun']],
                'tag_id' => $tagId,
            ],
            [
                'tipe' => 'letak_kata',
                'konten' => [
                    'teks' => 'Letakkan setiap bahan pada bagian tumbuhan yang mengurusinya.',
                    'kata' => [
                        ['id' => 'k1', 'teks' => 'air'],
                        ['id' => 'k2', 'teks' => 'karbon dioksida'],
                        ['id' => 'k3', 'teks' => 'cahaya matahari'],
                    ],
                    'posisi' => [
                        ['id' => 'p1', 'teks' => 'akar'],
                        ['id' => 'p2', 'teks' => 'stomata (mulut daun)'],
                        ['id' => 'p3', 'teks' => 'klorofil (zat hijau daun)'],
                    ],
                ],
                'kunci' => ['penempatan' => ['k1' => 'p1', 'k2' => 'p2', 'k3' => 'p3']],
                'tag_id' => $tagId,
            ],
        ];
    }

    /**
     * Latihan sisipan 3 (detik 150): HASIL fotosintesis.
     *
     * @return array<int, array<string, mixed>>
     */
    private function soalHasil(int $sekolahId, int $tagId, ?int $pemilik): array
    {
        return [
            [
                'tipe' => 'pilihan_ganda',
                'konten' => [
                    'teks' => 'Hasil fotosintesis yang dipakai tumbuhan untuk tumbuh adalah ...',
                    'opsi' => [
                        ['id' => 'A', 'teks' => 'glukosa (gula)'],
                        ['id' => 'B', 'teks' => 'oksigen'],
                        ['id' => 'C', 'teks' => 'air'],
                        ['id' => 'D', 'teks' => 'karbon dioksida'],
                    ],
                ],
                'kunci' => ['jawaban' => 'A'],
                'tag_id' => $tagId,
            ],
            [
                'tipe' => 'benar_salah',
                'konten' => [
                    'teks' => 'Oksigen yang dilepas tumbuhan saat fotosintesis adalah gas yang kita hirup.',
                ],
                'kunci' => ['benar' => true],
                'tag_id' => $tagId,
            ],
        ];
    }

    /**
     * Ujian penutup: bahan, tempat, urutan, hasil, dan kegunaannya bagi kita.
     *
     * @return array<int, array<string, mixed>>
     */
    private function soalPuncak(int $sekolahId, int $tagId, ?int $pemilik): array
    {
        return [
            [
                'tipe' => 'pilihan_ganda',
                'konten' => [
                    'teks' => 'Bagian daun yang menangkap cahaya matahari adalah ...',
                    'opsi' => [
                        ['id' => 'A', 'teks' => 'klorofil (zat hijau daun)'],
                        ['id' => 'B', 'teks' => 'tulang daun'],
                        ['id' => 'C', 'teks' => 'akar'],
                        ['id' => 'D', 'teks' => 'batang'],
                    ],
                ],
                'kunci' => ['jawaban' => 'A'],
                'tag_id' => $tagId,
            ],
            [
                'tipe' => 'menjodohkan',
                'konten' => [
                    'teks' => 'Jodohkan bagian tumbuhan dengan tugasnya saat fotosintesis.',
                    'kiri' => [
                        ['id' => 'k1', 'teks' => 'Klorofil'],
                        ['id' => 'k2', 'teks' => 'Stomata (mulut daun)'],
                        ['id' => 'k3', 'teks' => 'Akar'],
                    ],
                    'kanan' => [
                        ['id' => 'n1', 'teks' => 'Menangkap cahaya matahari'],
                        ['id' => 'n2', 'teks' => 'Jalan masuk udara'],
                        ['id' => 'n3', 'teks' => 'Menyerap air dari tanah'],
                    ],
                ],
                'kunci' => ['pasangan' => ['k1' => 'n1', 'k2' => 'n2', 'k3' => 'n3']],
                'tag_id' => $tagId,
            ],
            [
                'tipe' => 'mengurutkan',
                'konten' => [
                    'teks' => 'Urutkan alur fotosintesis dari yang terjadi paling awal.',
                    'item' => [
                        ['id' => 'i1', 'teks' => 'Air diserap akar'],
                        ['id' => 'i2', 'teks' => 'Cahaya ditangkap klorofil'],
                        ['id' => 'i3', 'teks' => 'Glukosa terbentuk'],
                        ['id' => 'i4', 'teks' => 'Oksigen dilepas ke udara'],
                    ],
                ],
                'kunci' => ['urutan' => ['i1', 'i2', 'i3', 'i4']],
                'tag_id' => $tagId,
            ],
            [
                // Sengaja isian singkat, bukan pilihan ganda yang sama seperti di
                // latihan sisipan ketiga: di ujian penutup anak harus MENGINGAT
                // namanya, bukan mengenalinya dari daftar opsi.
                'tipe' => 'isian_singkat',
                'konten' => [
                    'teks' => 'Sebutkan nama gula hasil fotosintesis yang dipakai tumbuhan untuk tumbuh.',
                ],
                'kunci' => ['jawaban_baku' => ['glukosa', 'gula', 'karbohidrat']],
                'tag_id' => $tagId,
            ],
            [
                'tipe' => 'benar_salah',
                'konten' => [
                    'teks' => 'Air diangkut akar sampai ke daun, lalu dipakai untuk memasak makanan.',
                ],
                'kunci' => ['benar' => true],
                'tag_id' => $tagId,
            ],
            [
                // Jawaban benar lebih dari satu: anak harus MEMILAH bahan dari
                // hasil, bukan mengenali satu jawaban benar dari daftar.
                'tipe' => 'pilihan_ganda_kompleks',
                'konten' => [
                    'teks' => 'Pilih SEMUA yang dibutuhkan tumbuhan agar fotosintesis bisa berjalan.',
                    'opsi' => [
                        ['id' => 'A', 'teks' => 'air'],
                        ['id' => 'B', 'teks' => 'karbon dioksida'],
                        ['id' => 'C', 'teks' => 'glukosa'],
                        ['id' => 'D', 'teks' => 'pupuk'],
                    ],
                ],
                'kunci' => ['benar' => ['A', 'B']],
                'tag_id' => $tagId,
            ],
            [
                // Klasifikasi: kalimat inti fotosintesis diuji sebagai pemilahan
                // masuk/keluar, bukan sebagai hafalan urutan.
                'tipe' => 'klasifikasi',
                'konten' => [
                    'teks' => 'Kelompokkan mana BAHAN yang masuk ke daun dan mana HASIL yang dibuat daun.',
                    'item' => [
                        ['id' => 'i1', 'teks' => 'air'],
                        ['id' => 'i2', 'teks' => 'karbon dioksida'],
                        ['id' => 'i3', 'teks' => 'glukosa'],
                        ['id' => 'i4', 'teks' => 'oksigen'],
                    ],
                    'kotak' => [
                        ['id' => 'k1', 'label' => 'Bahan (masuk ke daun)'],
                        ['id' => 'k2', 'label' => 'Hasil (dibuat daun)'],
                    ],
                ],
                'kunci' => ['peta' => ['i1' => 'k1', 'i2' => 'k1', 'i3' => 'k2', 'i4' => 'k2']],
                'tag_id' => $tagId,
            ],
        ];
    }

    private function penjelasanBahan(): string
    {
        return <<<'TEKS'
        Air dan karbon dioksida adalah BAHAN fotosintesis — keduanya bahan baku.
        Cahaya matahari bukan bahan, melainkan sumber energi yang menyalakan prosesnya.

        Karena itu tumbuhan tetap butuh matahari walau sudah disiram: tanpa cahaya, dapur di daunnya tidak menyala.
        TEKS;
    }

    private function penjelasanAlat(): string
    {
        return <<<'TEKS'
        Daun punya klorofil (zat hijau) di dalam kloroplas. Klorofil menangkap cahaya,
        akar menyerap air dari tanah, dan stomata — mulut daun — menjadi pintu masuk karbon dioksida.

        Kalau ketiganya bertemu, tumbuhan mulai memasak.
        TEKS;
    }

    private function penjelasanHasil(): string
    {
        return <<<'TEKS'
        Hasilnya dua: glukosa dan oksigen.

        Glukosa (gula) adalah makanan tumbuhan — dipakai untuk tumbuh, berbunga, dan berbuah.
        Oksigen dilepas ke udara, dan justru gas itulah yang kita hirup setiap saat.
        TEKS;
    }

    private function penjelasanPuncak(): string
    {
        return <<<'TEKS'
        Selamat, kamu sampai di puncak!

        Air + karbon dioksida  --(cahaya matahari & klorofil)-->  glukosa + oksigen.

        Tiga hal untuk dibawa pulang:
        1. Tumbuhan membuat makanannya sendiri dengan cahaya matahari.
        2. Bahan utamanya air dan karbon dioksida; hasilnya glukosa dan oksigen.
        3. Klorofil adalah zat hijau yang menangkap cahaya — makin sehat daunnya,
        makin lancar tumbuhan memasak.

        Tantangan di rumah: letakkan dua tanaman kecil, satu di dekat jendela dan satu di lemari yang gelap.
        Amati warna daunnya selama satu minggu, lalu tuliskan pada buku catatanmu apa yang kamu lihat.
        TEKS;
    }

    private function teksBasecamp(): string
    {
        return <<<'TEKS'
        Selamat datang di basecamp!

        Hari ini kita mendaki gunung pengetahuan tentang FOTOSINTESIS — cara tumbuhan memasak makanan sendiri.
        Sepanjang perjalanan kita akan menjawab tiga pertanyaan:

        1. Bahan apa yang dibutuhkan tumbuhan?
        2. Di bagian mana proses itu terjadi?
        3. Apa hasilnya, dan mengapa penting bagi kita?

        Tonton videonya sampai habis. Pemutarnya akan berhenti tiga kali untuk memberi latihan singkat —
        jawab dulu latihan itu, lalu lanjutkan mendaki sampai pos Puncak.
        TEKS;
    }
}
