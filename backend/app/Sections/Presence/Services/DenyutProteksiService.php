<?php

declare(strict_types=1);

namespace App\Sections\Presence\Services;

use App\Sections\Attempt\Enums\StatusAttempt;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Cheat\Enums\KategoriKecurangan;
use App\Sections\Cheat\Services\KecuranganService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Throwable;

/**
 * Denyut proteksi ber-nonce (bagian 2D chunk anticheat).
 *
 * Bedanya dengan kehadiran (`PresenceService`): kehadiran menjawab "murid masih
 * ada", sedangkan denyut menjawab "**proteksi di perangkatnya masih hidup**".
 * Keduanya dipisah supaya tab yang disembunyikan tetap dianggap online — itu
 * bukan alasan menuduh — sementara sensor yang dimatikan paksa terlihat.
 *
 * Cara kerjanya:
 * 1. saat kuis disajikan dengan proteksi menyala, server **menerbitkan nonce**
 *    dan menandai bahwa denyut ditunggu (`aktifkan()`);
 * 2. klien mengirim denyut tiap {@see self::JEDA_DETIK} detik **dengan nonce
 *    terakhir**; nonce yang cocok dirotasi dan waktunya disegarkan
 *    (`denyut()`), nonce lama/diulang ditolak — jadi klien tidak bisa
 *    "menyetel ulang" liveness dengan memutar ulang kiriman lama;
 * 3. sapuan berkala (`sapu()`, dipanggil `SapuPresence`) mencatat
 *    `tamper_suspected` bila denyut berhenti lebih lama dari
 *    {@see self::AMBANG_HILANG_DETIK} padahal attempt masih berjalan.
 *
 * Pagar agar tidak salah tuduh:
 * - `tamper_suspected` hanya diturunkan untuk attempt yang **masih berjalan**
 *   dan **belum melewati deadline** (melewati batas waktu = klien berhenti
 *   wajar);
 * - satu attempt hanya dicatat **sekali** (penanda di cache), jadi sapuan
 *   berkala tidak menumpuk baris;
 * - **fail-open**: semua sentuhan cache dibungkus try/catch — Redis mati hanya
 *   mematikan denyut, bukan ulangannya.
 *
 * Nonce bukan pengaman rahasia; ia menutup liveness palsu (klien yang mengirim
 * kiriman lama berulang) dan tetap terikat attempt di URL + sesi pemiliknya
 * lewat policy di controller.
 */
final class DenyutProteksiService
{
    /** Jeda denyut yang diminta dari klien (detik). */
    public const JEDA_DETIK = 30;

    /**
     * Berapa lama denyut boleh hilang sebelum dicurigai (detik).
     *
     * Lebih dari tiga jeda berturut-turut; cukup longgar untuk satu kiriman yang
     * tertinggal di jaringan yang jelek, cukup cepat supaya guru masih melihat
     * catatannya saat ulangan berlangsung.
     */
    public const AMBANG_HILANG_DETIK = 100;

    /** Masa simpan penanda denyut di cache (detik). */
    public const TTL_DETIK = 21600;

    private const KUNCI_INDEKS = 'denyut:indeks';

    public function __construct(private readonly KecuranganService $kecurangan) {}

    /**
     * Tandai bahwa attempt ini sedang dijaga proteksi, dan terbitkan nonce.
     *
     * Waktu `terakhir` disetel ke sekarang: itu **masa tenggang**. Murid yang
     * memuat halaman lalu pindah ke aplikasi lain dan tidak pernah mengirim satu
     * denyut pun tetap terdeteksi — kalau tidak, berhenti sejak awal justru lolos.
     *
     * @return string nonce awal yang harus dikirim klien pada denyut berikutnya
     */
    public function aktifkan(Attempt $attempt): string
    {
        $attemptId = (int) $attempt->getKey();
        $nonce = bin2hex(random_bytes(16));

        $this->simpan($attemptId, [
            'nonce' => $nonce,
            'terakhir' => Carbon::now()->toIso8601String(),
        ]);

        $this->tambahIndeks($attemptId);

        return $nonce;
    }

    /** Berhenti menunggu denyut (attempt dikumpulkan / dihentikan). */
    public function matikan(Attempt $attempt): void
    {
        $attemptId = (int) $attempt->getKey();

        $this->hapus($attemptId);
        $this->keluarkanDariIndeks($attemptId);
    }

    /** Nonce yang sedang berlaku, atau null bila denyut tidak ditunggu. */
    public function nonce(Attempt $attempt): ?string
    {
        $keadaan = $this->baca((int) $attempt->getKey());

        return isset($keadaan['nonce']) ? (string) $keadaan['nonce'] : null;
    }

    /**
     * Terima satu denyut: periksa nonce, rotasi, dan segarkan waktu.
     *
     * @return string|null nonce baru bila diterima; null bila tidak berlaku
     *                     (dilewati, bukan disimpan — jadi kiriman lama tidak
     *                     menyegarkan liveness)
     */
    public function denyut(Attempt $attempt, ?string $nonce): ?string
    {
        $attemptId = (int) $attempt->getKey();
        $keadaan = $this->baca($attemptId);

        if ($keadaan === null) {
            return null;
        }

        $tersimpan = isset($keadaan['nonce']) ? (string) $keadaan['nonce'] : '';

        if ($nonce === null || $nonce === '' || $tersimpan === '' || ! hash_equals($tersimpan, $nonce)) {
            return null;
        }

        $baru = bin2hex(random_bytes(16));

        $this->simpan($attemptId, [
            'nonce' => $baru,
            'terakhir' => Carbon::now()->toIso8601String(),
        ]);

        return $baru;
    }

    /**
     * Catat attempt yang denyutnya berhenti. Dijalankan berkala (`SapuPresence`).
     *
     * @return int jumlah catatan `tamper_suspected` yang benar-benar ditulis
     */
    public function sapu(): int
    {
        $sekarang = Carbon::now();
        $dicatat = 0;

        foreach ($this->indeks() as $attemptId) {
            $keadaan = $this->baca($attemptId);

            if ($keadaan === null) {
                $this->keluarkanDariIndeks($attemptId);

                continue;
            }

            $attempt = Attempt::query()->find($attemptId);

            if ($attempt === null || $attempt->status !== StatusAttempt::Berjalan) {
                $this->hapus($attemptId);
                $this->keluarkanDariIndeks($attemptId);

                continue;
            }

            // Sudah lewat batas waktu: klien berhenti karena ulangannya ditutup,
            // bukan karena sensornya dimatikan.
            if ($attempt->deadline_at !== null && $sekarang->greaterThan($attempt->deadline_at)) {
                continue;
            }

            $terakhir = $this->parse($keadaan['terakhir'] ?? null);

            if ($terakhir === null) {
                continue;
            }

            if ($terakhir->diffInSeconds($sekarang, false) <= self::AMBANG_HILANG_DETIK) {
                continue;
            }

            if ($this->sudahDicetat($attemptId)) {
                continue;
            }

            $this->tandaiDicetat($attemptId);

            $this->kecurangan->catatTurunan($attempt, KategoriKecurangan::TamperSuspected, [
                'denyut_terakhir' => $terakhir->toIso8601String(),
                'detik_berhenti' => (string) abs((int) $terakhir->diffInSeconds($sekarang, false)),
            ]);

            $dicatat++;
        }

        return $dicatat;
    }

    /** @return array<string, mixed>|null */
    private function baca(int $attemptId): ?array
    {
        try {
            $nilai = Cache::get($this->kunci($attemptId));
        } catch (Throwable $galat) {
            report($galat);

            return null;
        }

        return is_array($nilai) ? $nilai : null;
    }

    /** @param array<string, mixed> $keadaan */
    private function simpan(int $attemptId, array $keadaan): void
    {
        try {
            Cache::put($this->kunci($attemptId), $keadaan, self::TTL_DETIK);
        } catch (Throwable $galat) {
            report($galat);
        }
    }

    private function hapus(int $attemptId): void
    {
        try {
            Cache::forget($this->kunci($attemptId));
        } catch (Throwable $galat) {
            report($galat);
        }
    }

    /** @return array<int, int> */
    private function indeks(): array
    {
        try {
            $indeks = Cache::get(self::KUNCI_INDEKS);
        } catch (Throwable $galat) {
            report($galat);

            return [];
        }

        return is_array($indeks) ? array_values(array_map('intval', $indeks)) : [];
    }

    private function tambahIndeks(int $attemptId): void
    {
        $indeks = $this->indeks();

        if (in_array($attemptId, $indeks, true)) {
            return;
        }

        $indeks[] = $attemptId;

        try {
            Cache::put(self::KUNCI_INDEKS, $indeks, self::TTL_DETIK);
        } catch (Throwable $galat) {
            report($galat);
        }
    }

    private function keluarkanDariIndeks(int $attemptId): void
    {
        $sisa = array_values(array_filter(
            $this->indeks(),
            static fn (int $satu): bool => $satu !== $attemptId,
        ));

        try {
            if ($sisa === []) {
                Cache::forget(self::KUNCI_INDEKS);

                return;
            }

            Cache::put(self::KUNCI_INDEKS, $sisa, self::TTL_DETIK);
        } catch (Throwable $galat) {
            report($galat);
        }
    }

    private function sudahDicetat(int $attemptId): bool
    {
        try {
            return Cache::get($this->kunciCatat($attemptId)) !== null;
        } catch (Throwable $galat) {
            report($galat);

            // Tidak bisa memastikan → anggap sudah dicatat, supaya sapuan tidak
            // menumpuk baris baru tiap kali saat cache bermasalah.
            return true;
        }
    }

    private function tandaiDicetat(int $attemptId): void
    {
        try {
            Cache::put($this->kunciCatat($attemptId), true, self::TTL_DETIK);
        } catch (Throwable $galat) {
            report($galat);
        }
    }

    private function parse(mixed $nilai): ?Carbon
    {
        if (! is_string($nilai) || $nilai === '') {
            return null;
        }

        try {
            return Carbon::parse($nilai);
        } catch (Throwable) {
            return null;
        }
    }

    private function kunci(int $attemptId): string
    {
        return 'denyut:attempt:'.$attemptId;
    }

    private function kunciCatat(int $attemptId): string
    {
        return 'denyut:dicatat:'.$attemptId;
    }
}
