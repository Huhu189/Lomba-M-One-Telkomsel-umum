<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Services;

use App\Sections\Attempt\Enums\JenisUnggahanJawaban;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Attempt\Models\PotonganUnggahanJawaban;
use App\Sections\Attempt\Models\UnggahanJawaban;
use App\Sections\Material\Enums\KategoriBerkas;
use App\Sections\Material\Enums\StatusUnggahan;
use App\Sections\Material\Services\KlasifikasiBerkas;
use App\Sections\Question\Models\Soal;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Lampiran jawaban murid: unggah berpotongan, penggabungan, penyajian.
 *
 * Aturan yang ditegakkan di sini (bukan di klien):
 *
 * - **Deadline ditegakkan server.** Unggahan ditolak begitu waktu ulangan habis;
 *   melampirkan foto jawaban bukan jalan pintas menambah waktu.
 * - **Gambar kanvas diencode ulang ke PNG di server.** Berkas kiriman tidak
 *   pernah disajikan apa adanya, dan dimensinya dibatasi supaya gambar raksasa
 *   tidak dipakai menghabiskan memori server.
 * - **Rekaman diri butuh izin.** Saklar `rekam_diri` (pengaturan tiga lapis,
 *   bawaan mati) harus menyala dan durasinya dibatasi.
 * - **Berkas asing masuk karantina.** Hasil klasifikasi isi berkas menentukan
 *   penyajian: yang berisiko/tidak dikenal selalu diunduh sebagai `.upload`.
 *
 * Klasifikasi berkas dan pola potongannya sengaja memakai ulang yang sudah ada di
 * bagian Material (slice 08) — aturan keamanannya identik, jadi tidak ada gunanya
 * menulis dua pemeriksaan magic bytes yang bisa berbeda diam-diam.
 */
class PenyimpananJawaban
{
    /** Disk tempat berkas jawaban disimpan (di luar folder publik). */
    public const DISK = 'local';

    /** Batas dimensi gambar kanvas sebelum diencode ulang (piksel total). */
    public const BATAS_PIKSEL = 40_000_000;

    public function __construct(private readonly KlasifikasiBerkas $klasifikasi) {}

    public function disk(): Filesystem
    {
        return Storage::disk(self::DISK);
    }

    /**
     * Buka sesi unggah lampiran untuk satu soal pada satu attempt.
     *
     * @throws ValidationException
     */
    public function mulai(
        Attempt $attempt,
        Soal $soal,
        JenisUnggahanJawaban $jenis,
        ?string $namaAsli,
        int $ukuran,
        ?int $durasiDetik,
        bool $izinRekam,
    ): UnggahanJawaban {
        $this->pastikanBolehUnggah($attempt, $soal, $jenis, $izinRekam);

        $batas = (int) config('jawaban.ukuran_maks');
        $chunkByte = max(1, (int) config('jawaban.chunk_byte'));
        $maksBerkas = max(1, (int) config('jawaban.maks_berkas_per_soal'));

        if ($ukuran <= 0) {
            throw ValidationException::withMessages(['ukuran' => 'Ukuran berkas tidak boleh kosong.']);
        }

        if ($ukuran > $batas) {
            throw ValidationException::withMessages([
                'ukuran' => 'Berkas terlalu besar. Batas satu berkas '.$this->ukuranManusia($batas).'.',
            ]);
        }

        $sudahAda = UnggahanJawaban::query()
            ->where('attempt_id', $attempt->getKey())
            ->where('question_id', $soal->getKey())
            ->where('status', '!=', StatusUnggahan::Gagal->value)
            ->count();

        if ($sudahAda >= $maksBerkas) {
            throw ValidationException::withMessages([
                'unggahan' => 'Lampiran untuk soal ini sudah maksimal ('.$maksBerkas.' berkas).',
            ]);
        }

        $durasi = null;

        if ($jenis->perluIzin()) {
            $batasDurasi = max(1, (int) config('jawaban.durasi_rekam_maks_detik'));
            $durasi = (int) ($durasiDetik ?? 0);

            if ($durasi <= 0 || $durasi > $batasDurasi) {
                throw ValidationException::withMessages([
                    'durasi_detik' => 'Durasi rekaman harus antara 1 dan '.$batasDurasi.' detik.',
                ]);
            }
        }

        return UnggahanJawaban::query()->create([
            'school_id' => $attempt->school_id,
            'attempt_id' => $attempt->getKey(),
            'question_id' => $soal->getKey(),
            'student_id' => $attempt->student_id,
            'kode' => Str::random(32),
            'jenis' => $jenis,
            'nama_asli' => $namaAsli === null ? null : mb_substr($namaAsli, 0, 255),
            'nama_simpan' => null,
            'ekstensi' => $namaAsli === null ? 'bin' : $this->klasifikasi->ekstensiNama($namaAsli),
            'mime' => 'application/octet-stream',
            'kategori' => KategoriBerkas::TidakDikenal,
            'ukuran_total' => $ukuran,
            'jumlah_potongan' => (int) max(1, (int) ceil($ukuran / $chunkByte)),
            'durasi_detik' => $durasi,
            'hash' => null,
            'status' => StatusUnggahan::Menunggu,
            'path' => null,
            'expires_at' => Carbon::now()->addMinutes((int) config('jawaban.umur_yatim_menit')),
        ]);
    }

    /**
     * Terima satu potongan (idempoten: kirim ulang aman).
     *
     * @throws ValidationException
     */
    public function simpanPotongan(UnggahanJawaban $unggahan, int $indeks, string $isi, ?string $hashDiklaim = null): PotonganUnggahanJawaban
    {
        if ($unggahan->status !== StatusUnggahan::Menunggu) {
            throw ValidationException::withMessages(['potongan' => 'Unggahan ini sudah selesai atau gagal.']);
        }

        if ($unggahan->expires_at !== null && $unggahan->expires_at->isPast()) {
            throw ValidationException::withMessages(['potongan' => 'Sesi unggah sudah kedaluwarsa; mulai ulang.']);
        }

        // Waktu habis juga menghentikan pengiriman potongan: berkas yang datang
        // setelah deadline tidak boleh ikut digabung.
        if (Carbon::now()->greaterThan($unggahan->attempt->deadline_at)) {
            throw ValidationException::withMessages(['potongan' => 'Waktu ulangan sudah habis; lampiran tidak bisa dikirim.']);
        }

        if ($indeks < 0 || $indeks >= (int) $unggahan->jumlah_potongan) {
            throw ValidationException::withMessages(['potongan' => 'Nomor potongan di luar rentang.']);
        }

        $hash = hash('sha256', $isi);

        if ($hashDiklaim !== null && ! hash_equals($hash, mb_strtolower($hashDiklaim))) {
            throw ValidationException::withMessages(['potongan' => 'Hash potongan tidak cocok; kirim ulang.']);
        }

        $path = $this->direktori($unggahan).'/potongan/'.$indeks.'.part';
        $this->disk()->put($path, $isi);

        return PotonganUnggahanJawaban::query()->updateOrCreate(
            ['upload_id' => $unggahan->getKey(), 'indeks' => $indeks],
            ['ukuran' => strlen($isi), 'hash' => $hash, 'path' => $path],
        );
    }

    /**
     * Gabungkan potongan, proses isinya, lalu simpan berkas final.
     *
     * @throws ValidationException
     */
    public function selesai(UnggahanJawaban $unggahan): UnggahanJawaban
    {
        if ($unggahan->status !== StatusUnggahan::Menunggu) {
            return $unggahan;
        }

        $potongan = PotonganUnggahanJawaban::query()
            ->where('upload_id', $unggahan->getKey())
            ->orderBy('indeks')
            ->get();

        if ($potongan->count() !== (int) $unggahan->jumlah_potongan) {
            throw ValidationException::withMessages([
                'unggahan' => 'Masih ada potongan yang belum diterima ('.$potongan->count().'/'.$unggahan->jumlah_potongan.').',
            ]);
        }

        $direktori = $this->direktori($unggahan);
        $sementara = $direktori.'/gabungan.tmp';
        $penuh = $this->disk()->path($sementara);

        if (! is_dir(dirname($penuh))) {
            mkdir(dirname($penuh), 0o775, true);
        }

        $keluar = fopen($penuh, 'wb');

        if ($keluar === false) {
            throw ValidationException::withMessages(['unggahan' => 'Gagal menyiapkan berkas gabungan.']);
        }

        $total = 0;

        try {
            foreach ($potongan as $satu) {
                $masuk = $this->disk()->readStream((string) $satu->path);

                if ($masuk === false) {
                    throw ValidationException::withMessages(['unggahan' => 'Ada potongan yang tidak terbaca; kirim ulang.']);
                }

                $disalin = stream_copy_to_stream($masuk, $keluar);
                fclose($masuk);
                $total += (int) $disalin;
            }
        } finally {
            fclose($keluar);
        }

        if ($total !== (int) $unggahan->ukuran_total) {
            $this->disk()->delete($sementara);

            throw ValidationException::withMessages([
                'unggahan' => 'Ukuran gabungan tidak sesuai ('.$total.' dari '.$unggahan->ukuran_total.' byte).',
            ]);
        }

        $isi = (string) file_get_contents($penuh);

        [$ekstensi, $mime, $kategori, $hasil] = $unggahan->jenis->diencodeUlangPng()
            ? $this->prosesGambarKanvas($isi, $unggahan)
            : $this->prosesBerkasBiasa($isi);

        $namaSimpan = $unggahan->kode.'.'.$ekstensi;
        $this->disk()->put($direktori.'/'.$namaSimpan, $hasil);
        $this->disk()->delete($sementara);

        $unggahan->forceFill([
            'nama_simpan' => $namaSimpan,
            'ekstensi' => $ekstensi,
            'mime' => $mime,
            'kategori' => $kategori,
            'ukuran_total' => strlen($hasil),
            'hash' => hash('sha256', $hasil),
            'status' => StatusUnggahan::Selesai,
            'path' => $direktori.'/'.$namaSimpan,
        ])->save();

        // Potongan asli tidak lagi dibutuhkan begitu gabungannya utuh.
        $this->disk()->deleteDirectory($direktori.'/potongan');
        PotonganUnggahanJawaban::query()->where('upload_id', $unggahan->getKey())->delete();

        return $unggahan->refresh();
    }

    /** Buang satu lampiran (baris + berkasnya). */
    public function hapus(UnggahanJawaban $unggahan): void
    {
        $this->disk()->deleteDirectory($this->direktori($unggahan));
        $unggahan->delete();
    }

    /** Semua lampiran satu attempt (guru melihatnya bersama hasil). */
    public function daftar(Attempt $attempt): Collection
    {
        return UnggahanJawaban::query()
            ->where('attempt_id', $attempt->getKey())
            ->where('status', StatusUnggahan::Selesai->value)
            ->orderBy('question_id')
            ->orderBy('id')
            ->get();
    }

    /**
     * URL bertanda tangan berumur pendek untuk menampilkan/mengunduh lampiran.
     */
    public function urlBertandaTangan(UnggahanJawaban $unggahan): string
    {
        $relatif = URL::temporarySignedRoute(
            'jawaban.berkas',
            Carbon::now()->addMinutes((int) config('jawaban.ttl_url_menit')),
            ['kode' => $unggahan->kode],
            false,
        );

        return rtrim((string) config('app.url'), '/').$relatif;
    }

    /** Lokasi internal berkas (untuk header X-Accel-Redirect). */
    public function pathInternal(UnggahanJawaban $unggahan): string
    {
        $prefix = (string) config('jawaban.x_accel_prefix', '');

        return $prefix === '' ? (string) $unggahan->path : rtrim($prefix, '/').'/'.(string) $unggahan->path;
    }

    /**
     * Bersihkan sesi unggah lampiran yang ditinggalkan (dibuat penjadwal).
     */
    public function sapuYatim(): int
    {
        $batas = Carbon::now()->subMinutes((int) config('jawaban.umur_yatim_menit'));

        $yatim = UnggahanJawaban::query()
            ->where('status', StatusUnggahan::Menunggu->value)
            ->where('created_at', '<', $batas)
            ->get();

        foreach ($yatim as $satu) {
            $this->hapus($satu);
        }

        return $yatim->count();
    }

    public function ukuranManusia(int $byte): string
    {
        $satuan = ['B', 'KiB', 'MiB', 'GiB'];
        $nilai = (float) $byte;
        $indeks = 0;

        while ($nilai >= 1024 && $indeks < count($satuan) - 1) {
            $nilai /= 1024;
            $indeks++;
        }

        return round($nilai, 1).' '.$satuan[$indeks];
    }

    /**
     * Aturan "boleh mengunggah sekarang?" untuk satu attempt + soal.
     *
     * @throws ValidationException
     */
    private function pastikanBolehUnggah(
        Attempt $attempt,
        Soal $soal,
        JenisUnggahanJawaban $jenis,
        bool $izinRekam,
    ): void {
        if (! $attempt->berjalan()) {
            throw ValidationException::withMessages(['attempt' => 'Ulangan ini sudah dikumpulkan.']);
        }

        if (Carbon::now()->greaterThan($attempt->deadline_at)) {
            throw ValidationException::withMessages([
                'attempt' => 'Waktu ulangan sudah habis; lampiran jawaban tidak bisa diunggah lagi.',
            ]);
        }

        if (! $attempt->kuis->soal()->whereKey($soal->getKey())->exists()) {
            throw ValidationException::withMessages(['question_id' => 'Soal itu bukan bagian dari kuis ini.']);
        }

        if ($jenis->perluIzin() && ! $izinRekam) {
            throw ValidationException::withMessages([
                'jenis' => 'Rekaman diri belum diizinkan sekolah/guru untuk kuis ini.',
            ]);
        }
    }

    /**
     * Gambar kanvas: dibaca, dibatasi dimensinya, lalu **diencode ulang ke PNG**.
     *
     * @return array{0: string, 1: string, 2: KategoriBerkas, 3: string}
     */
    private function prosesGambarKanvas(string $isi, UnggahanJawaban $unggahan): array
    {
        $info = @getimagesizefromstring($isi);

        if ($info === false) {
            // Termasuk SVG/HTML yang dikirim dengan nama gambar: GD tidak bisa
            // membacanya, jadi tidak pernah lolos sebagai "gambar jawaban".
            throw ValidationException::withMessages([
                'unggahan' => 'Gambar jawaban tidak bisa dibaca. Coba kirim ulang gambarnya.',
            ]);
        }

        if (((int) $info[0] * (int) $info[1]) > self::BATAS_PIKSEL) {
            throw ValidationException::withMessages([
                'unggahan' => 'Gambar jawaban terlalu besar dimensinya.',
            ]);
        }

        try {
            $gambar = @imagecreatefromstring($isi);
        } catch (Throwable) {
            $gambar = false;
        }

        if (! $gambar instanceof \GdImage) {
            throw ValidationException::withMessages(['unggahan' => 'Gambar jawaban tidak bisa dibaca.']);
        }

        ob_start();
        imagepng($gambar);
        $keluaran = (string) ob_get_clean();
        imagedestroy($gambar);

        if ($keluaran === '') {
            throw ValidationException::withMessages(['unggahan' => 'Gagal menyiapkan gambar jawaban.']);
        }

        return ['png', 'image/png', KategoriBerkas::Umum, $keluaran];
    }

    /**
     * Berkas biasa: kategori ditentukan **isi** berkas, bukan nama kiriman.
     *
     * @return array{0: string, 1: string, 2: KategoriBerkas, 3: string}
     */
    private function prosesBerkasBiasa(string $isi): array
    {
        $hasil = $this->klasifikasi->kenali($isi);
        $ekstensiSajian = $hasil['kategori']->ekstensiSajian($hasil['ekstensi']);
        $mimeSajian = $hasil['kategori']->bolehTampilLangsung() ? $hasil['mime'] : 'application/octet-stream';

        return [$ekstensiSajian, $mimeSajian, $hasil['kategori'], $isi];
    }

    private function direktori(UnggahanJawaban $unggahan): string
    {
        return 'jawaban/'.$unggahan->school_id.'/'.$unggahan->kode;
    }
}
