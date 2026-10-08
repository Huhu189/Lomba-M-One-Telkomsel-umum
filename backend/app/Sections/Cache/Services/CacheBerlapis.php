<?php

declare(strict_types=1);

namespace App\Sections\Cache\Services;

use App\Sections\Cache\Contracts\LapisanCache;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Redis;
use Throwable;

/**
 * Cache berlapis L1 → L2 → L3 (slice 10).
 *
 * Urutan yang dijaga kelas ini:
 * 1. **Baca**: L1 (kalau pintu lalu lintas membuka dan versinya masih cocok)
 *    → L2 (Redis) → sumbernya (database, lewat callback pemanggil).
 * 2. **Tulis/ubah**: pemanggil sudah menulis ke database lebih dulu, lalu
 *    `lupakan()` menaikkan versi (supaya salinan L1 di proses lain langsung
 *    ditolak), baru membuang Redis, baru membuang L1. L1 tidak pernah menjadi
 *    sumber kebenaran — ia hanya salinan sementara.
 * 3. **Sebar**: satu pesan pub/sub Redis diberitahukan ke proses lain (service
 *    realtime) setelah invalidasi; kegagalan menyiarkan tidak pernah
 *    menggagalkan permintaan guru/murid.
 */
final class CacheBerlapis
{
    public const RUANG_PENGATURAN = 'pengaturan';

    private const AKHIRAN_VERSI = ':versi';

    /**
     * @param  array<int, LapisanCache>  $lapisan  urutan lapisan dari yang paling
     *                                             tahan lama ke yang paling sementara
     */
    public function __construct(
        private readonly PintuTraffic $pintu,
        private readonly array $lapisan,
    ) {
        if ($this->lapisan === []) {
            throw new \InvalidArgumentException('Cache berlapis butuh minimal satu lapisan.');
        }
    }

    /**
     * Ambil dari cache; bila kosong, jalankan `$sumber` (database) lalu simpan.
     *
     * @template T
     *
     * @param  callable(): T  $sumber
     * @return T
     */
    public function ingat(string $kunci, callable $sumber, string $ruang = self::RUANG_PENGATURAN): mixed
    {
        $this->pintu->catat($ruang);

        $sementara = $this->lapisanSementara();

        if (! $this->pintu->aktif($ruang)) {
            // Lalu lintas reda: L1 hanya salinan sementara, jadi dibuang.
            $sementara?->lupakanRuang($ruang);

            return $this->dariLapisanTahanLama($kunci, $sumber);
        }

        $versi = $this->versi($kunci);
        $salinan = $sementara?->ambil($kunci);

        if ($salinan !== null) {
            if ((int) ($salinan['versi'] ?? -1) === $versi) {
                return $salinan['muatan'];
            }

            // Validation check gagal: proses lain sudah mengubah data ini.
            $sementara?->lupakan($kunci);
        }

        $muatan = $this->dariLapisanTahanLama($kunci, $sumber);
        $sementara?->simpan($kunci, $muatan, $versi);

        return $muatan;
    }

    /**
     * Invalidasi berurutan setelah database ditulis pemanggil.
     *
     * @param  string|null  $ruang  bila diisi, salinan L1 satu ruang sekaligus dibuang
     */
    public function lupakan(string $kunci, ?string $ruang = null): void
    {
        $this->naikkanVersi($kunci);

        foreach ($this->lapisan as $satu) {
            $satu->lupakan($kunci);
        }

        if ($ruang !== null) {
            $this->lapisanSementara()?->lupakanRuang($ruang);
        }

        $this->siarkan($kunci);
    }

    /** Versi penanda: salinan cache dengan versi lama selalu ditolak. */
    public function versi(string $kunci): int
    {
        $isi = $this->lapisan[0]->ambil($kunci.self::AKHIRAN_VERSI);

        return $isi !== null ? (int) $isi['muatan'] : 0;
    }

    /** Nama lapisan yang aktif (untuk laporan/diagnosa). */
    public function lapisan(): array
    {
        return array_map(static fn (LapisanCache $satu): string => $satu->nama(), $this->lapisan);
    }

    /**
     * @template T
     *
     * @param  callable(): T  $sumber
     * @return T
     */
    private function dariLapisanTahanLama(string $kunci, callable $sumber): mixed
    {
        $tahanLama = $this->lapisan[0];
        $versi = $this->versi($kunci);
        $isi = $tahanLama->ambil($kunci);

        // Salinan lapisan tahan lama WAJIB diperiksa versinya, sama seperti L1:
        // versi yang sudah naik berarti ada penulisan baru yang mungkin belum
        // sempat membuang salinan ini di node/proses ini (I-01). Dulu salinan L2
        // langsung dipercaya, dan karena umurnya tak terbatas, data basi bisa
        // bertahan selamanya.
        if ($isi !== null && (int) $isi['versi'] === $versi) {
            return $isi['muatan'];
        }

        if ($isi !== null) {
            $tahanLama->lupakan($kunci);
        }

        $muatan = $sumber();

        // Bila versi berubah selagi sumber dibaca (guru menyimpan pengaturan baru
        // di tengah pembacaan murid), nilai yang baru saja dibaca sudah basi:
        // jangan disimpan, apalagi dengan nomor versi baru — kalau tidak, versinya
        // akan cocok dan pemeriksaan di atas justru melegalkan data basi itu.
        if ($this->versi($kunci) === $versi) {
            $tahanLama->simpan($kunci, $muatan, $versi);
        }

        return $muatan;
    }

    private function naikkanVersi(string $kunci): int
    {
        $baru = $this->versi($kunci) + 1;
        $this->lapisan[0]->simpan($kunci.self::AKHIRAN_VERSI, $baru, $baru);

        return $baru;
    }

    /**
     * Lapisan paling sementara (L1) menurut urutan yang diberikan: ia satu-satunya
     * yang boleh dibuang saat lalu lintas reda, jadi ia tidak boleh jadi sumber
     * kebenaran apa pun.
     */
    private function lapisanSementara(): ?LapisanCache
    {
        $satu = $this->lapisan[count($this->lapisan) - 1] ?? null;

        return $satu !== null && $satu->tersedia() ? $satu : null;
    }

    private function siarkan(string $kunci): void
    {
        $kanal = trim((string) config('cache_l1.kanal', ''));

        if ($kanal === '') {
            return;
        }

        try {
            Redis::publish($kanal, (string) json_encode([
                'kunci' => $kunci,
                'versi' => $this->versi($kunci),
                'pada' => Carbon::now()->toIso8601String(),
            ]));
        } catch (Throwable) {
            // Pub/sub hanya pemberitahuan; permintaan tetap dianggap berhasil.
        }
    }
}
