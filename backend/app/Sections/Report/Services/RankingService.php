<?php

declare(strict_types=1);

namespace App\Sections\Report\Services;

use App\Sections\Attempt\Enums\JenisAttempt;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Attempt\Services\TimService;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\Settings\Enums\KunciPengaturan;
use App\Sections\Settings\Services\PengaturanService;

/**
 * Ranking (chunk slice-05).
 *
 * Aturan keras: peringkat HANYA dihitung dari attempt ber-tanda `asli`
 * (percobaan pertama) berjenis ulangan. Skor ulang tidak pernah masuk sini,
 * jadi mengulang kuis tidak bisa menaikkan (atau menurunkan) peringkat.
 * Seri dipecah: yang lebih cepat mengumpulkan menang, lalu nama (A–Z).
 *
 * Saklar `ranking` mengatur keterlihatan bagi murid; guru selalu boleh melihat
 * (dipakai untuk laporan). Saklar bawaan mati.
 *
 * Pada kuis mode tim (slice 09-C) yang diperingkat adalah TIM, bukan anak:
 * satu attempt bersama = satu baris peringkat, dan anggotanya tidak muncul
 * sendiri-sendiri.
 *
 * Dua aturan baru (14 Oktober 2026) — keduanya transparan, bukan rahasia:
 *
 * - **Nomor peringkat hanya untuk N% teratas** (`peringkat_terbuka_persen`,
 *   bawaan 30). Murid lain tetap melihat SKORNYA sendiri — jadi ia tidak buta
 *   terhadap hasil kerjanya, hanya tidak dibandingkan dengan temannya.
 * - **Bonus penyemangat** (`bonus_semangat`, bawaan mati). Murid yang skornya di
 *   bawah ambang (bawaan 50%) mendapat tambahan pada angka yang DITAMPILKAN di
 *   papan, sampai melewati titik tengah kelas, dengan batas `bonus_semangat_maks_persen`.
 *   `skor` asli tidak pernah disentuh: rapor, ekspor nilai, dan laporan tetap
 *   memakai nilai sebenarnya, dan tiap baris berbantuan menandai dirinya sendiri
 *   (`bonus` > 0, `berbantuan`) supaya guru tidak pernah membaca angka palsu
 *   tanpa tahu.
 */
class RankingService
{
    public const BAWAAN_TOP = 10;

    public const TOP_MAKSIMAL = 50;

    /** Batas aman `peringkat_terbuka_persen` bila nilainya di luar 0–100. */
    public const TERBUKA_BAWAAN = 30;

    public function __construct(
        private readonly PengaturanService $pengaturan,
        private readonly TimService $tim,
    ) {}

    /** Peta pengaturan efektif kuis ini (resolusi tiga lapis). */
    private function pengaturan(Kuis $kuis): array
    {
        return $this->pengaturan
            ->semua((int) $kuis->school_id, (int) $kuis->class_id, (int) $kuis->getKey())['pengaturan'];
    }

    /** Apakah ranking ditampilkan untuk murid pada kuis ini. */
    public function tampil(Kuis $kuis): bool
    {
        $peta = $this->pengaturan($kuis);

        return (bool) ($peta[KunciPengaturan::Ranking->value]['nilai'] ?? KunciPengaturan::Ranking->bawaan());
    }

    /**
     * Aturan keterlihatan & bonus penyemangat kuis ini.
     *
     * @return array{terbuka_persen: int, bonus: bool, bawah_persen: int, maks_persen: int}
     */
    public function aturan(Kuis $kuis): array
    {
        $peta = $this->pengaturan($kuis);
        $angka = function (KunciPengaturan $kunci) use ($peta): int {
            $nilai = $peta[$kunci->value]['nilai'] ?? $kunci->bawaan();

            return max(0, min(100, (int) $nilai));
        };

        return [
            'terbuka_persen' => $angka(KunciPengaturan::PeringkatTerbukaPersen),
            'bonus' => (bool) ($peta[KunciPengaturan::BonusSemangat->value]['nilai'] ?? KunciPengaturan::BonusSemangat->bawaan()),
            'bawah_persen' => $angka(KunciPengaturan::BonusSemangatBawahPersen),
            'maks_persen' => $angka(KunciPengaturan::BonusSemangatMaksPersen),
        ];
    }

    /**
     * Seluruh peringkat (belum dipotong) dari skor asli.
     *
     * @return array<int, array<string, mixed>>
     */
    public function semua(Kuis $kuis): array
    {
        if ($this->tim->modeTim($kuis)) {
            return $this->semuaTim($kuis);
        }

        $baris = Attempt::query()
            ->join('students', 'students.id', '=', 'attempts.student_id')
            ->join('users', 'users.id', '=', 'students.user_id')
            ->where('attempts.quiz_id', $kuis->getKey())
            ->where('attempts.jenis', JenisAttempt::Ulangan->value)
            ->where('attempts.asli', true)
            ->whereNotNull('attempts.dikumpulkan_at')
            // Siswa tamu tidak masuk peringkat kelas: mereka bukan murid kelas
            // itu, dan namanya tidak boleh muncul di daftar yang dilihat anak
            // lain. Nilai tamu tetap terlihat guru lewat panel siswa tamu.
            ->where('users.is_tamu', false)
            // Seri: waktu selesai lebih cepat menang, lalu nama.
            ->orderByDesc('attempts.skor')
            ->orderBy('attempts.dikumpulkan_at')
            ->orderBy('users.name')
            ->get([
                'attempts.id as attempt_id',
                'attempts.skor',
                'attempts.skor_maksimal',
                'attempts.jumlah_benar',
                'attempts.jumlah_soal',
                'attempts.dikumpulkan_at',
                'students.id as murid_id',
                'users.name as nama',
            ]);

        $hasil = [];

        foreach ($baris as $indeks => $satu) {
            $maksimal = (float) $satu->skor_maksimal;

            $hasil[] = [
                'peringkat' => $indeks + 1,
                'attempt_id' => (int) $satu->attempt_id,
                'murid_id' => (int) $satu->murid_id,
                // Kunci ini sengaja selalu ada (null saat mode individu) supaya
                // klien memakai satu skema untuk kedua mode (slice 09-C).
                'tim_id' => null,
                'tim_nama' => null,
                'anggota' => [],
                'nama' => (string) $satu->nama,
                'skor' => (float) $satu->skor,
                'skor_maksimal' => $maksimal,
                'persen' => $maksimal > 0 ? round((float) $satu->skor / $maksimal * 100, 1) : 0.0,
                'jumlah_benar' => (int) $satu->jumlah_benar,
                'jumlah_soal' => (int) $satu->jumlah_soal,
                'dikumpulkan_at' => $satu->dikumpulkan_at,
            ];
        }

        return $hasil;
    }

    /**
     * Peringkat versi tim: satu baris per tim, lengkap dengan anggotanya.
     *
     * @return array<int, array<string, mixed>>
     */
    private function semuaTim(Kuis $kuis): array
    {
        $baris = Attempt::query()
            ->join('teams', 'teams.id', '=', 'attempts.team_id')
            ->where('attempts.quiz_id', $kuis->getKey())
            ->where('attempts.jenis', JenisAttempt::Ulangan->value)
            ->where('attempts.asli', true)
            ->whereNotNull('attempts.dikumpulkan_at')
            ->orderByDesc('attempts.skor')
            ->orderBy('attempts.dikumpulkan_at')
            ->orderBy('teams.nama')
            ->get([
                'attempts.id as attempt_id',
                'attempts.skor',
                'attempts.skor_maksimal',
                'attempts.jumlah_benar',
                'attempts.jumlah_soal',
                'attempts.dikumpulkan_at',
                'teams.id as tim_id',
                'teams.nama as tim_nama',
            ]);

        $anggota = $this->tim->anggotaPerTim($kuis);
        $hasil = [];

        foreach ($baris as $indeks => $satu) {
            $maksimal = (float) $satu->skor_maksimal;
            $timId = (int) $satu->tim_id;

            $hasil[] = [
                'peringkat' => $indeks + 1,
                'attempt_id' => (int) $satu->attempt_id,
                // Baris tim tidak mewakili satu anak, jadi murid_id sengaja null.
                'murid_id' => null,
                'tim_id' => $timId,
                'tim_nama' => (string) $satu->tim_nama,
                'nama' => (string) $satu->tim_nama,
                'anggota' => $anggota[$timId] ?? [],
                'skor' => (float) $satu->skor,
                'skor_maksimal' => $maksimal,
                'persen' => $maksimal > 0 ? round((float) $satu->skor / $maksimal * 100, 1) : 0.0,
                'jumlah_benar' => (int) $satu->jumlah_benar,
                'jumlah_soal' => (int) $satu->jumlah_soal,
                'dikumpulkan_at' => $satu->dikumpulkan_at,
            ];
        }

        return $hasil;
    }

    /**
     * Payload siap kirim untuk layar peringkat.
     *
     * @param  int|null  $muridId  bila pemohon murid: dipakai mencari peringkatnya
     * @param  bool  $selaluTampil  guru selalu melihat peringkat walau saklar mati
     * @param  int|null  $timId  pada mode tim: tim pemohon yang dicari
     * @return array<string, mixed>
     */
    public function untukKuis(
        Kuis $kuis,
        int $top,
        ?int $muridId = null,
        bool $selaluTampil = false,
        ?int $timId = null,
    ): array {
        $tampil = $this->tampil($kuis);
        $modeTim = $this->tim->modeTim($kuis);
        $aturan = $this->aturan($kuis);
        $semua = $this->beriBonus($this->semua($kuis), $aturan);
        $batas = max(1, min($top, self::TOP_MAKSIMAL));

        $bolehLihat = $tampil || $selaluTampil;

        // Berapa baris teratas yang boleh dilihat murid: N% teratas dari peserta
        // (dibulatkan ke atas, minimal satu baris), tidak pernah lebih dari
        // jumlah yang diminta pemanggil. Guru tidak dibatasi aturan ini.
        $terbukaJumlah = count($semua) > 0
            ? max(1, (int) ceil(count($semua) * $aturan['terbuka_persen'] / 100))
            : 0;
        $terbukaJumlah = min($terbukaJumlah, self::TOP_MAKSIMAL);

        $peringkatSaya = null;
        $detailSaya = null;

        foreach ($semua as $baris) {
            $cocok = $modeTim
                ? $timId !== null && ($baris['tim_id'] ?? null) === $timId
                : $muridId !== null && $baris['murid_id'] === $muridId;

            if (! $cocok) {
                continue;
            }

            $diLuarTerbuka = ! $selaluTampil && $baris['peringkat'] > $terbukaJumlah;

            $peringkatSaya = $bolehLihat && ! $diLuarTerbuka ? $baris : null;
            // Murid yang nomor peringkatnya tidak ditampilkan tetap melihat
            // skornya sendiri (dan tahu bahwa peringkatnya memang sengaja tidak
            // dibuka) — bukan layar kosong tanpa penjelasan.
            $detailSaya = [
                'nama' => $baris['nama'],
                'skor' => $baris['skor'],
                'skor_maksimal' => $baris['skor_maksimal'],
                'persen' => $baris['persen'],
                'bonus' => $baris['bonus'],
                'skor_tampil' => $baris['skor_tampil'],
                'persen_tampil' => $baris['persen_tampil'],
                'berbantuan' => $baris['berbantuan'],
                'peringkat' => $selaluTampil || ! $diLuarTerbuka ? $baris['peringkat'] : null,
                'di_luar_terbuka' => $diLuarTerbuka && $bolehLihat,
            ];
            break;
        }

        // Guru melihat sebanyak yang diminta (untuk laporan dan proyektor);
        // murid tidak pernah melihat lebih dari N% teratas, sekalipun meminta
        // lebih — aturan yang sama dengan nomor peringkat miliknya sendiri.
        $batasTampil = 0;

        if ($bolehLihat) {
            $batasTampil = $selaluTampil ? $batas : min($batas, $terbukaJumlah);
        }

        $tampilBaris = $bolehLihat ? array_slice($semua, 0, $batasTampil) : [];

        // Mata murid tidak pernah melihat JEJAK bonus: `bonus`, `berbantuan`,
        // `peringkat_asli`, dan angka asli di samping angka tampilannya hanya
        // dikirim ke guru. Bagi murid, angka tampilan itulah `skor`/`persen`
        // (lihat `tanpaJejakBonus`).
        if (! $selaluTampil) {
            $tampilBaris = array_map($this->tanpaJejakBonus(...), $tampilBaris);
            $peringkatSaya = $peringkatSaya === null ? null : $this->tanpaJejakBonus($peringkatSaya);
            $detailSaya = $detailSaya === null ? null : $this->tanpaJejakBonus($detailSaya);
        }

        return [
            'kuis_id' => $kuis->getKey(),
            'judul_kuis' => $kuis->judul,
            'mode_tim' => $modeTim,
            'tampil' => $tampil,
            'guru' => $selaluTampil,
            'total' => count($semua),
            'top' => $batas,
            'terbuka_persen' => $aturan['terbuka_persen'],
            'terbuka_jumlah' => $terbukaJumlah,
            'bonus_aktif' => $aturan['bonus'],
            'bonus_bawah_persen' => $aturan['bawah_persen'],
            'bonus_maks_persen' => $aturan['maks_persen'],
            'peringkat' => $tampilBaris,
            'peringkat_saya' => $peringkatSaya,
            'detail_saya' => $detailSaya,
        ];
    }

    /**
     * Satu baris papan tanpa jejak bonus, untuk mata murid.
     *
     * Angka yang ditampilkan pindah ke `skor`/`persen` — dari sisi murid,
     * begitulah hasil kerjanya — dan semua penanda bantuan dibuang. Skor asli
     * tetap utuh di rapor, ekspor nilai, laporan, dan panel guru; yang
     * dirahasiakan hanyalah di papan yang dibaca anak.
     *
     * @param  array<string, mixed>  $baris
     * @return array<string, mixed>
     */
    private function tanpaJejakBonus(array $baris): array
    {
        if (array_key_exists('skor_tampil', $baris)) {
            $baris['skor'] = $baris['skor_tampil'];
        }

        if (array_key_exists('persen_tampil', $baris)) {
            $baris['persen'] = $baris['persen_tampil'];
        }

        unset(
            $baris['bonus'],
            $baris['berbantuan'],
            $baris['peringkat_asli'],
            $baris['skor_tampil'],
            $baris['persen_tampil'],
        );

        return $baris;
    }

    /**
     * Baris papan peringkat SETELAH aturan bonus penyemangat.
     *
     * Yang diubah hanya angka yang ditampilkan: `skor` tetap nilai asli murid
     * (itu yang masuk rapor, ekspor, dan laporan), sedangkan `skor_tampil`
     * ditambah bonus yang besarannya dihitung di bawah. Tiap baris membawa
     * `bonus` dan `berbantuan` supaya tidak ada angka berbantuan yang menyamar
     * sebagai nilai asli.
     *
     * Aturan bonusnya sengaja sederhana dan bisa dijelaskan ke murid: murid yang
     * persennya di bawah ambang dinaikkan SESUDAH-CUKUP sampai melewati dua
     * patokan sekaligus — ambang bawah (`bawah_persen`, bawaan 50%) dan titik
     * tengah kelas (median persen peserta) — lalu dibatasi `maks_persen`.
     *
     * Patokan "titik tengah kelas" dipakai supaya ia benar-benar keluar dari
     * separuh kelas terbawah, bukan sekadar tepat di garis ambang saat kelasnya
     * memang bernilai tinggi. Bila batas tambahannya tidak cukup, ia TIDAK
     * dipaksa menyeberang: yang tampil adalah nilai aslinya + batas itu.
     *
     * @param  array<int, array<string, mixed>>  $semua
     * @param  array{terbuka_persen: int, bonus: bool, bawah_persen: int, maks_persen: int}  $aturan
     * @return array<int, array<string, mixed>>
     */
    private function beriBonus(array $semua, array $aturan): array
    {
        $median = 0.0;

        if ($aturan['bonus'] && $semua !== []) {
            $persen = array_map(static fn (array $baris): float => (float) $baris['persen'], $semua);
            sort($persen);
            $tengah = intdiv(count($persen), 2);
            $median = count($persen) % 2 === 1
                ? $persen[$tengah]
                : ($persen[$tengah - 1] + $persen[$tengah]) / 2;
        }

        foreach ($semua as $indeks => $baris) {
            $persen = (float) $baris['persen'];
            $maksimal = (float) $baris['skor_maksimal'];
            $bawahAmbang = $aturan['bonus'] && $persen < $aturan['bawah_persen'];
            $bonus = 0.0;

            if ($bawahAmbang) {
                // Sasaran: keluar dari bawah, yaitu melewati ambang DAN separuh
                // kelas terbawah; tidak pernah lebih dari batas tambahan.
                $sasaran = min(max($median, (float) $aturan['bawah_persen']), $persen + $aturan['maks_persen']);
                $tambah = max(0.0, $sasaran - $persen);
                $bonus = $maksimal > 0 ? round($tambah / 100 * $maksimal, 2) : 0.0;
            }

            $semua[$indeks]['peringkat_asli'] = $indeks + 1;
            $semua[$indeks]['bonus'] = $bonus;
            $semua[$indeks]['berbantuan'] = $bonus > 0;
            $semua[$indeks]['skor_tampil'] = round((float) $baris['skor'] + $bonus, 2);
            $semua[$indeks]['persen_tampil'] = $maksimal > 0
                ? round($semua[$indeks]['skor_tampil'] / $maksimal * 100, 1)
                : 0.0;
        }

        if (! $aturan['bonus']) {
            return $semua;
        }

        // Urutan papan memakai angka yang ditampilkan; seri dipecah oleh skor
        // asli (yang benar-benar mengerjakan lebih baik tetap di depan), lalu
        // waktu mengumpulkan, lalu nama.
        usort($semua, static function (array $a, array $b): int {
            return $b['skor_tampil'] <=> $a['skor_tampil']
                ?: $b['skor'] <=> $a['skor']
                ?: strcmp((string) $a['dikumpulkan_at'], (string) $b['dikumpulkan_at'])
                ?: strcasecmp((string) $a['nama'], (string) $b['nama']);
        });

        foreach ($semua as $indeks => $baris) {
            $semua[$indeks]['peringkat'] = $indeks + 1;
        }

        return $semua;
    }
}
