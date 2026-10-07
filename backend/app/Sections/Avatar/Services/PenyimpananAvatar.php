<?php

declare(strict_types=1);

namespace App\Sections\Avatar\Services;

use App\Sections\Avatar\Enums\StatusAvatar;
use App\Sections\Avatar\Models\Avatar;
use App\Sections\School\Models\Murid;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Penyimpanan avatar murid.
 *
 * Aturan yang dijaga di sini, bukan di klien:
 *
 * - **Hanya JPEG, PNG, dan WebP**, ditentukan dari magic bytes isi berkas.
 *   SVG **selalu ditolak**: SVG adalah dokumen yang bisa memuat skrip, jadi ia
 *   tidak pernah diperlakukan sebagai gambar walau namanya `.png`.
 * - Gambar **diencode ulang di server** ke persegi berukuran tetap. Berkas
 *   kiriman tidak pernah disajikan apa adanya, sehingga metadata (mis. GPS di
 *   EXIF foto ponsel) dan data tersembunyi di dalamnya tidak pernah ikut keluar.
 * - Nama berkas **acak** dan berada di disk privat (storage/app/private),
 *   jadi alamat gambar tidak bisa ditebak dan hanya keluar lewat URL bertanda
 *   tangan berumur pendek.
 */
class PenyimpananAvatar
{
    public const DISK = 'local';

    public function disk(): Filesystem
    {
        return Storage::disk(self::DISK);
    }

    /**
     * Simpan avatar baru untuk seorang murid.
     *
     * Avatar lama milik murid yang sama ikut dirapikan: yang **aktif** dihapus
     * berkasnya (sudah diganti), sedangkan yang sedang **disembunyikan** tetap
     * disimpan sebagai bukti sampai guru meninjaunya.
     *
     * @throws ValidationException
     */
    public function simpan(Murid $murid, string $isi): Avatar
    {
        $batas = (int) config('avatar.ukuran_maks');

        if ($isi === '') {
            throw ValidationException::withMessages(['avatar' => 'Berkas gambar kosong.']);
        }

        if (strlen($isi) > $batas) {
            throw ValidationException::withMessages([
                'avatar' => 'Gambar terlalu besar (batas '.$this->ukuranManusia($batas).').',
            ]);
        }

        if ($this->jenisGambar($isi) === null) {
            throw ValidationException::withMessages([
                'avatar' => 'Hanya gambar JPEG, PNG, atau WebP yang diterima.',
            ]);
        }

        $gambar = $this->bukaGambar($isi);
        $kanvas = $this->kuadratkan($gambar);

        // Ukuran akhir dibaca SEBELUM gambar dimusnahkan (GD membebaskan memorinya).
        $lebarAkhir = imagesx($kanvas);
        $tinggiAkhir = imagesy($kanvas);
        $keluaran = $this->encodeJpeg($kanvas);

        imagedestroy($gambar);
        imagedestroy($kanvas);

        $kode = Str::random(32);
        $direktori = 'avatar/'.$murid->school_id;
        $path = $direktori.'/'.$kode.'.jpg';

        $this->disk()->put($path, $keluaran);

        $avatar = Avatar::query()->create([
            'school_id' => $murid->school_id,
            'student_id' => $murid->getKey(),
            'kode' => $kode,
            'path' => $path,
            'mime' => 'image/jpeg',
            'ukuran' => strlen($keluaran),
            'lebar' => $lebarAkhir,
            'tinggi' => $tinggiAkhir,
            'hash' => hash('sha256', $keluaran),
            'status' => StatusAvatar::Aktif,
            'jumlah_laporan' => 0,
            'disembunyikan_at' => null,
        ]);

        $this->rapikanAvatarLama($murid, $avatar);

        return $avatar;
    }

    /** URL bertanda tangan berumur pendek untuk menampilkan gambar avatar. */
    public function urlBertandaTangan(Avatar $avatar): string
    {
        $relatif = URL::temporarySignedRoute(
            'avatar.berkas',
            now()->addMinutes((int) config('avatar.ttl_url_menit')),
            ['kode' => $avatar->kode],
            false,
        );

        return rtrim((string) config('app.url'), '/').$relatif;
    }

    /** Lokasi internal berkas (untuk header X-Accel-Redirect). */
    public function pathInternal(Avatar $avatar): string
    {
        $prefix = (string) config('avatar.x_accel_prefix', '');

        return $prefix === '' ? (string) $avatar->path : rtrim($prefix, '/').'/'.(string) $avatar->path;
    }

    /** Hapus berkas fisik satu avatar (barisnya tetap ada untuk jejak audit). */
    public function hapusBerkas(Avatar $avatar): void
    {
        $path = (string) $avatar->path;

        if ($path !== '' && $this->disk()->exists($path)) {
            $this->disk()->delete($path);
        }
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
     * Jenis gambar menurut magic bytes isi berkas — bukan nama maupun header
     * kiriman. SVG/XML/HTML tidak pernah lolos dari sini.
     */
    public function jenisGambar(string $isi): ?string
    {
        if (str_starts_with($isi, "\xFF\xD8\xFF")) {
            return 'jpeg';
        }

        if (str_starts_with($isi, "\x89PNG\r\n\x1a\n")) {
            return 'png';
        }

        if (strlen($isi) >= 12 && str_starts_with($isi, 'RIFF') && substr($isi, 8, 4) === 'WEBP') {
            return 'webp';
        }

        return null;
    }

    /** @throws ValidationException */
    private function bukaGambar(string $isi): \GdImage
    {
        try {
            $gambar = @imagecreatefromstring($isi);
        } catch (Throwable) {
            $gambar = false;
        }

        if (! $gambar instanceof \GdImage) {
            throw ValidationException::withMessages([
                'avatar' => 'Gambar tidak bisa dibaca. Coba pilih gambar lain.',
            ]);
        }

        return $gambar;
    }

    /**
     * Potong tengah ke persegi, lalu perkecil ke ukuran tetap.
     *
     * Pemotongan tengah dipakai supaya wajah pada foto biasanya tetap berada di
     * tengah bingkai; latar putih mencegah warna aneh saat gambar aslinya
     * transparan (PNG).
     */
    private function kuadratkan(\GdImage $gambar): \GdImage
    {
        $sisi = max(32, (int) config('avatar.sisi'));
        $lebar = imagesx($gambar);
        $tinggi = imagesy($gambar);

        if ($lebar < 1 || $tinggi < 1) {
            throw ValidationException::withMessages(['avatar' => 'Ukuran gambar tidak masuk akal.']);
        }

        $sisiKecil = min($lebar, $tinggi);
        $sumberX = (int) (($lebar - $sisiKecil) / 2);
        $sumberY = (int) (($tinggi - $sisiKecil) / 2);

        $kanvas = imagecreatetruecolor($sisi, $sisi);
        $putih = imagecolorallocate($kanvas, 255, 255, 255);
        imagefilledrectangle($kanvas, 0, 0, $sisi, $sisi, $putih);
        imagecopyresampled($kanvas, $gambar, 0, 0, $sumberX, $sumberY, $sisi, $sisi, $sisiKecil, $sisiKecil);

        return $kanvas;
    }

    private function encodeJpeg(\GdImage $kanvas): string
    {
        $kualitas = max(10, min(100, (int) config('avatar.kualitas')));

        ob_start();
        imagejpeg($kanvas, null, $kualitas);
        $keluaran = (string) ob_get_clean();

        if ($keluaran === '') {
            throw ValidationException::withMessages(['avatar' => 'Gagal menyiapkan gambar.']);
        }

        return $keluaran;
    }

    /**
     * Bereskan avatar sebelumnya.
     *
     * Yang aktif dihapus berkasnya karena muridnya sudah menggantinya. Yang
     * disembunyikan **tidak** dihapus: gambar itu sedang menunggu tinjauan guru,
     * dan menghapusnya saat murid mengunggah ulang akan menghapus barang bukti.
     */
    private function rapikanAvatarLama(Murid $murid, Avatar $baru): void
    {
        $lama = Avatar::query()
            ->where('student_id', $murid->getKey())
            ->where('id', '!=', $baru->getKey())
            ->where('status', StatusAvatar::Aktif->value)
            ->get();

        foreach ($lama as $satu) {
            $this->hapusBerkas($satu);
            $satu->forceFill(['status' => StatusAvatar::Dihapus])->save();
        }
    }
}
