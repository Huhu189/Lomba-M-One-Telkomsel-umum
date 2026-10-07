<?php

declare(strict_types=1);

namespace App\Sections\Material\Services;

use App\Sections\Material\Enums\KategoriBerkas;
use App\Sections\Material\Enums\StatusUnggahan;
use App\Sections\Material\Models\PotonganUnggahan;
use App\Sections\Material\Models\UnggahanMateri;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Penyimpanan berkas materi: unggah berpotongan, penggabungan, dan penyajian.
 *
 * Alasan bentuknya begini:
 *
 * - **Berpotongan** supaya unggahan gagal tidak mengirim ulang seluruh berkas
 *   (anak-anak di sekolah sering kehilangan sinyal). Tiap potongan diverifikasi
 *   hash-nya, jadi potongan yang rusak di jalan ketahuan saat itu juga.
 * - **Digabung & diklasifikasi di server** saat klien menyatakan selesai. Nama
 *   berkas kiriman tidak dipercaya; kategori ditentukan magic bytes.
 * - **Berkas di disk privat** (storage/app/private) dan hanya keluar lewat URL
 *   bertanda tangan berumur pendek, jadi tidak ada materi yang bisa ditebak
 *   alamatnya.
 */
class PenyimpananMateri
{
    /** Disk tempat berkas materi disimpan (di luar folder publik). */
    public const DISK = 'local';

    public function __construct(private readonly KlasifikasiBerkas $klasifikasi) {}

    public function disk(): Filesystem
    {
        return Storage::disk(self::DISK);
    }

    /**
     * Buka sesi unggahan baru.
     *
     * @throws ValidationException
     */
    public function mulai(int $sekolahId, int $userId, ?int $materiId, string $namaAsli, int $ukuran): UnggahanMateri
    {
        $batasBerkas = (int) config('material.kuota_unggahan');
        $batasSekolah = (int) config('material.kuota_sekolah');
        $chunkByte = max(1, (int) config('material.chunk_byte'));

        if ($ukuran <= 0) {
            throw ValidationException::withMessages(['ukuran' => 'Ukuran berkas tidak boleh kosong.']);
        }

        if ($ukuran > $batasBerkas) {
            throw ValidationException::withMessages([
                'ukuran' => 'Berkas terlalu besar. Batas satu berkas '.$this->ukuranManusia($batasBerkas).'.',
            ]);
        }

        if ($this->kuotaTerpakai($sekolahId) + $ukuran > $batasSekolah) {
            throw ValidationException::withMessages([
                'ukuran' => 'Penyimpanan sekolah sudah penuh. Hapus materi lama dulu.',
            ]);
        }

        return UnggahanMateri::query()->create([
            'school_id' => $sekolahId,
            'material_id' => $materiId,
            'user_id' => $userId,
            'kode' => Str::random(32),
            'nama_asli' => mb_substr($namaAsli, 0, 255),
            'nama_simpan' => null,
            'ekstensi' => $this->klasifikasi->ekstensiNama($namaAsli),
            'mime' => 'application/octet-stream',
            'kategori' => KategoriBerkas::TidakDikenal,
            'ukuran_total' => $ukuran,
            'jumlah_potongan' => (int) max(1, (int) ceil($ukuran / $chunkByte)),
            'hash' => null,
            'status' => StatusUnggahan::Menunggu,
            'path' => null,
            'expires_at' => now()->addMinutes((int) config('material.umur_yatim_menit')),
        ]);
    }

    /**
     * Simpan satu potongan. Kirim ulang potongan yang sama aman (idempoten).
     *
     * @throws ValidationException
     */
    public function simpanPotongan(UnggahanMateri $unggahan, int $indeks, string $isi, ?string $hashDiklaim = null): PotonganUnggahan
    {
        if ($unggahan->status !== StatusUnggahan::Menunggu) {
            throw ValidationException::withMessages(['potongan' => 'Unggahan ini sudah selesai atau gagal.']);
        }

        if ($unggahan->expires_at !== null && $unggahan->expires_at->isPast()) {
            throw ValidationException::withMessages(['potongan' => 'Sesi unggah sudah kedaluwarsa; mulai ulang.']);
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

        return PotonganUnggahan::query()->updateOrCreate(
            ['upload_id' => $unggahan->getKey(), 'indeks' => $indeks],
            ['ukuran' => strlen($isi), 'hash' => $hash, 'path' => $path],
        );
    }

    /**
     * Gabungkan seluruh potongan, klasifikasi isinya, lalu simpan berkas final.
     *
     * @throws ValidationException
     */
    public function selesai(UnggahanMateri $unggahan): UnggahanMateri
    {
        if ($unggahan->status !== StatusUnggahan::Menunggu) {
            return $unggahan;
        }

        $potongan = PotonganUnggahan::query()
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

        // Klasifikasi dari ISI berkas, bukan dari nama kiriman.
        $kepala = (string) file_get_contents($penuh, false, null, 0, 16);

        $hasil = $this->klasifikasi->kenali($kepala);

        // Kategori 2 & 3 selalu disajikan sebagai `.upload` agar browser tidak
        // pernah menjalankannya; mime sajian pun diturunkan ke octet-stream.
        $ekstensiSajian = $hasil['kategori']->ekstensiSajian($hasil['ekstensi']);
        $mimeSajian = $hasil['kategori']->bolehTampilLangsung() ? $hasil['mime'] : 'application/octet-stream';
        $namaSimpan = $unggahan->kode.'.'.$ekstensiSajian;

        $this->disk()->move($sementara, $direktori.'/'.$namaSimpan);

        $unggahan->forceFill([
            'nama_simpan' => $namaSimpan,
            'ekstensi' => $ekstensiSajian,
            'mime' => $mimeSajian,
            'kategori' => $hasil['kategori'],
            'hash' => hash_file('sha256', $this->disk()->path($direktori.'/'.$namaSimpan)),
            'status' => StatusUnggahan::Selesai,
            'path' => $direktori.'/'.$namaSimpan,
        ])->save();

        // Potongan asli tidak lagi dibutuhkan begitu gabungannya utuh.
        $this->disk()->deleteDirectory($direktori.'/potongan');
        PotonganUnggahan::query()->where('upload_id', $unggahan->getKey())->delete();

        return $unggahan->refresh();
    }

    /** Hapus berkas + baris unggahan (dipakai juga saat materi dihapus). */
    public function hapus(UnggahanMateri $unggahan): void
    {
        $this->disk()->deleteDirectory($this->direktori($unggahan));
        $unggahan->delete();
    }

    /**
     * URL bertanda tangan berumur pendek untuk mengunduh/menampilkan berkas.
     */
    public function urlBertandaTangan(UnggahanMateri $unggahan): string
    {
        $relatif = URL::temporarySignedRoute(
            'materi.berkas',
            now()->addMinutes((int) config('material.ttl_url_menit')),
            ['kode' => $unggahan->kode],
            false,
        );

        return rtrim((string) config('app.url'), '/').$relatif;
    }

    /** Total byte yang dipakai satu sekolah (potongan menunggu ikut dihitung). */
    public function kuotaTerpakai(int $sekolahId): int
    {
        return (int) UnggahanMateri::query()
            ->where('school_id', $sekolahId)
            ->whereIn('status', [StatusUnggahan::Menunggu->value, StatusUnggahan::Selesai->value])
            ->sum('ukuran_total');
    }

    /**
     * Bersihkan sesi unggah yang ditinggalkan (dibuat penjadwal).
     */
    public function sapuYatim(): int
    {
        $batas = now()->subMinutes((int) config('material.umur_yatim_menit'));

        $yatim = UnggahanMateri::query()
            ->where('status', StatusUnggahan::Menunggu->value)
            ->where('created_at', '<', $batas)
            ->get();

        foreach ($yatim as $satu) {
            $this->hapus($satu);
        }

        return $yatim->count();
    }

    /** Lokasi internal berkas (untuk header X-Accel-Redirect). */
    public function pathInternal(UnggahanMateri $unggahan): string
    {
        $prefix = (string) config('material.x_accel_prefix', '');

        return $prefix === '' ? (string) $unggahan->path : rtrim($prefix, '/').'/'.(string) $unggahan->path;
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

    private function direktori(UnggahanMateri $unggahan): string
    {
        return 'materi/'.$unggahan->school_id.'/'.$unggahan->kode;
    }
}
