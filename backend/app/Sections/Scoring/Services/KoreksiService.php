<?php

declare(strict_types=1);

namespace App\Sections\Scoring\Services;

use App\Models\User;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Attempt\Models\Jawaban;
use App\Sections\Question\Models\Soal;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\Scoring\Enums\StatusPenilaian;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Koreksi manual guru (chunk slice-06).
 *
 * Mutasi sensitif: mengubah nilai yang sudah dinilai mesin. Karena itu alurnya
 * wajib dua langkah — minta token konfirmasi (berisi alasan) lalu pakai token
 * untuk menyimpan nilai baru. Setiap koreksi dicatat sebagai activity log
 * (append-only, lewat spatie/laravel-activitylog) dan total attempt dihitung
 * ulang dari baris jawaban, bukan ditambah manual.
 */
class KoreksiService
{
    public function __construct(private readonly TokenKonfirmasiService $token) {}

    /** Alasan minimal (karakter) supaya koreksi selalu bisa dipertanggungjawabkan. */
    public const ALASAN_MIN = 10;

    /**
     * Antrean koreksi satu kuis: soal yang belum pasti dinilai mesin.
     *
     * @return array<string, mixed>
     */
    public function antrean(Kuis $kuis): array
    {
        $kuis->loadMissing(['mapel', 'kelas']);

        $baris = Jawaban::query()
            ->whereIn('status', [StatusPenilaian::PerluTinjau->value, StatusPenilaian::Gagal->value])
            ->whereHas('attempt', static function ($query) use ($kuis): void {
                $query->where('quiz_id', $kuis->getKey())->whereNotNull('dikumpulkan_at');
            })
            ->with(['attempt.murid.user', 'soal'])
            ->get();

        $item = [];

        foreach ($baris as $satu) {
            $soal = $satu->soal;
            $attempt = $satu->attempt;
            $tipe = $soal?->tipeAman();

            $item[] = [
                'attempt_id' => (int) $satu->attempt_id,
                'question_id' => (int) $satu->question_id,
                'murid_id' => $attempt !== null ? (int) $attempt->student_id : null,
                'murid_nama' => $attempt?->murid?->user?->name,
                'no_attempt' => $attempt?->attempt_no,
                'status' => $satu->status->value,
                'status_label' => $satu->status->label(),
                'tipe' => $tipe?->value ?? 'tidak_dikenal',
                'tipe_label' => $tipe?->label() ?? 'Tidak dikenal',
                'teks_soal' => (string) ($soal?->kontenSebagaiArray()['teks'] ?? ''),
                'jawaban' => $satu->jawaban,
                'kunci' => $soal?->kunciSebagaiArray() ?? [],
                'skor_maksimal' => (float) ($soal?->skor ?? 0),
                'skor_sekarang' => (float) $satu->skor,
                'dinilai_manual' => (bool) $satu->dinilai_manual,
            ];
        }

        return [
            'kuis_id' => $kuis->getKey(),
            'judul_kuis' => $kuis->judul,
            'mapel_nama' => $kuis->mapel?->nama,
            'kelas_nama' => $kuis->kelas?->nama,
            'alasan_min' => self::ALASAN_MIN,
            'jumlah' => count($item),
            'item' => $item,
        ];
    }

    /**
     * Terbitkan token konfirmasi untuk satu koreksi (attempt + soal).
     *
     * @return array{token: string, expires_at: string, ttl_detik: int}
     */
    public function mintaToken(User $guru, Attempt $attempt, Soal $soal, string $alasan, ?string $ip = null): array
    {
        $this->pastikanSasaranValid($attempt, $soal);

        $sasaran = ['attempt_id' => $attempt->getKey(), 'question_id' => $soal->getKey()];

        // Token lama untuk sasaran yang sama dimatikan agar tidak menumpuk.
        $this->token->matikanSebelumnya($guru, TokenKonfirmasiService::TUJUAN_KOREKSI, $sasaran);

        return $this->token->terbitkan($guru, TokenKonfirmasiService::TUJUAN_KOREKSI, $sasaran, $ip);
    }

    /**
     * Simpan koreksi nilai: token sekali pakai + audit + hitung ulang total.
     *
     * @throws ValidationException
     */
    public function koreksi(
        User $guru,
        Attempt $attempt,
        Soal $soal,
        float $skor,
        string $alasan,
        string $token,
    ): Jawaban {
        $this->pastikanSasaranValid($attempt, $soal);

        $maksimal = (float) $soal->skor;
        $skor = max(0.0, min($skor, $maksimal));

        return DB::transaction(function () use ($guru, $attempt, $soal, $skor, $alasan, $token, $maksimal): Jawaban {
            // Token dipakai di dalam transaksi: sekali pakai & terikat sasaran.
            $this->token->pakai($guru, TokenKonfirmasiService::TUJUAN_KOREKSI, $token, [
                'attempt_id' => $attempt->getKey(),
                'question_id' => $soal->getKey(),
            ]);

            $baris = Jawaban::query()
                ->where('attempt_id', $attempt->getKey())
                ->where('question_id', $soal->getKey())
                ->lockForUpdate()
                ->first();

            if ($baris === null) {
                throw ValidationException::withMessages(['question_id' => 'Jawaban soal itu tidak ditemukan pada attempt ini.']);
            }

            $sebelum = (float) $baris->skor;

            $baris->forceFill([
                'status' => StatusPenilaian::Dinilai,
                'skor' => $skor,
                // "Benar" hanya bila nilainya penuh; skor parsial tetap tercatat.
                'benar' => $maksimal > 0 && $skor >= $maksimal,
                'dinilai_manual' => true,
                'alasan_koreksi' => $alasan,
                'dinilai_at' => Carbon::now(),
            ])->save();

            $attempt = $this->hitungUlang($attempt);

            activity('koreksi_nilai')
                ->causedBy($guru)
                ->performedOn($baris)
                ->event('koreksi_manual')
                ->withProperties([
                    'attempt_id' => $attempt->getKey(),
                    'question_id' => $soal->getKey(),
                    'skor_sebelum' => $sebelum,
                    'skor_sesudah' => $skor,
                    'skor_maksimal' => $maksimal,
                    'alasan' => $alasan,
                ])
                ->log('Koreksi nilai manual');

            return $baris->refresh();
        });
    }

    /**
     * Hitung ulang total attempt dari baris jawaban (sumber kebenaran), bukan
     * dengan menambah/mengurangi angka lama.
     */
    public function hitungUlang(Attempt $attempt): Attempt
    {
        $terkunci = Attempt::query()->whereKey($attempt->getKey())->lockForUpdate()->firstOrFail();

        $terkunci->forceFill([
            'skor' => (float) $terkunci->jawaban()->sum('skor'),
            'jumlah_benar' => (int) $terkunci->jawaban()->where('benar', true)->count(),
        ])->save();

        return $terkunci->refresh();
    }

    /**
     * @throws ValidationException
     */
    private function pastikanSasaranValid(Attempt $attempt, Soal $soal): void
    {
        if ($attempt->dikumpulkan_at === null) {
            throw ValidationException::withMessages(['attempt' => 'Attempt ini belum dikumpulkan, belum ada yang bisa dikoreksi.']);
        }

        $kuis = $attempt->kuis;

        if ($kuis === null || ! $kuis->soal()->whereKey($soal->getKey())->exists()) {
            throw ValidationException::withMessages(['question_id' => 'Soal itu bukan bagian dari kuis attempt ini.']);
        }
    }
}
