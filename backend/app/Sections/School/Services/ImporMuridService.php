<?php

declare(strict_types=1);

namespace App\Sections\School\Services;

use App\Models\User;
use App\Sections\Auth\Enums\UserStatus;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Murid;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use League\Csv\Reader;

/**
 * Impor murid dari CSV: streaming, validasi per baris, batas 100 galat,
 * dan upsert per 500 baris di dalam satu transaksi (chunk slice-02).
 *
 * Kolom wajib: nama, email, kelas. Kolom opsional: nis, nisn, kata_sandi.
 * Bila `kata_sandi` kosong, akun dibuat dengan kata sandi acak server
 * (murid mengatur ulang lewat menu lupa sandi).
 */
class ImporMuridService
{
    public const BATAS_GALAT = 100;

    public const UKURAN_BATCH = 500;

    private const KOLOM_WAJIB = ['nama', 'email', 'kelas'];

    /**
     * @return array{total: int, sukses: int, gagal: int, dihentikan: bool, batas_galat: int, galat: list<array{baris: int, pesan: string}>}
     */
    public function impor(string $path, int $sekolahId): array
    {
        $reader = Reader::createFromPath($path, 'r');
        $reader->setHeaderOffset(0);
        $reader->skipEmptyRecords();

        /** @var list<string> $headerAsli */
        $headerAsli = $reader->getHeader();
        $mapKolom = $this->petakanKolom($headerAsli);
        $this->pastikanKolomWajib($mapKolom);

        $kelasMap = Kelas::query()
            ->where('school_id', $sekolahId)
            ->get()
            ->keyBy(fn (Kelas $kelas): string => mb_strtolower($kelas->nama));

        $muridPerNis = Murid::query()
            ->with('user')
            ->where('school_id', $sekolahId)
            ->whereNotNull('nis')
            ->get()
            ->keyBy(fn (Murid $murid): string => (string) $murid->nis);

        $galat = [];
        $sukses = 0;
        $total = 0;
        $dihentikan = false;
        $nisTerpakai = [];
        $emailTerpakai = [];
        $batch = [];

        foreach ($reader->getRecords() as $record) {
            $total++;
            $nomorBaris = $total + 1; // baris 1 = header

            $baris = $this->barisDariRecord($record, $mapKolom);

            $pesan = $this->validasiBaris($baris, $kelasMap, $muridPerNis, $nisTerpakai, $emailTerpakai);

            if ($pesan !== null) {
                $galat[] = ['baris' => $nomorBaris, 'pesan' => $pesan];

                if (count($galat) >= self::BATAS_GALAT) {
                    $dihentikan = true;
                    break;
                }

                continue;
            }

            if ($baris['nis'] !== null) {
                $nisTerpakai[$baris['nis']] = true;
            }
            $emailTerpakai[$baris['email']] = true;

            $batch[] = $baris;

            if (count($batch) >= self::UKURAN_BATCH) {
                $sukses += $this->prosesBatch($batch, $sekolahId, $kelasMap);
                $batch = [];
            }
        }

        if ($batch !== []) {
            $sukses += $this->prosesBatch($batch, $sekolahId, $kelasMap);
        }

        return [
            'total' => $total,
            'sukses' => $sukses,
            'gagal' => count($galat),
            'dihentikan' => $dihentikan,
            'batas_galat' => self::BATAS_GALAT,
            'galat' => $galat,
        ];
    }

    /**
     * @param  list<string>  $headerAsli
     * @return array<string, string> nama kolom ternormalisasi => nama kolom asli
     */
    private function petakanKolom(array $headerAsli): array
    {
        $map = [];

        foreach ($headerAsli as $nama) {
            $map[$this->normalisasiNamaKolom($nama)] = $nama;
        }

        return $map;
    }

    /**
     * @param  array<string, string>  $mapKolom
     */
    private function pastikanKolomWajib(array $mapKolom): void
    {
        $hilang = array_values(array_filter(
            self::KOLOM_WAJIB,
            fn (string $kolom): bool => ! array_key_exists($kolom, $mapKolom),
        ));

        if ($hilang !== []) {
            throw ValidationException::withMessages([
                'file' => 'Kolom wajib tidak ditemukan: '.implode(', ', $hilang).'.',
            ]);
        }
    }

    private function normalisasiNamaKolom(string $nama): string
    {
        return mb_strtolower(trim(str_replace(["\xEF\xBB\xBF", "\u{FEFF}"], '', $nama)));
    }

    /**
     * @param  array<string, mixed>  $record
     * @param  array<string, string>  $mapKolom
     * @return array{nama: string, email: string, kelas: string, nis: string|null, nisn: string|null, kata_sandi: string|null}
     */
    private function barisDariRecord(array $record, array $mapKolom): array
    {
        $ambil = function (string $kolom) use ($record, $mapKolom): ?string {
            $asli = $mapKolom[$kolom] ?? null;

            if ($asli === null || ! array_key_exists($asli, $record)) {
                return null;
            }

            $nilai = $record[$asli];

            if ($nilai === null) {
                return null;
            }

            $teks = trim((string) $nilai);

            return $teks === '' ? null : $teks;
        };

        return [
            'nama' => $ambil('nama') ?? '',
            'email' => mb_strtolower($ambil('email') ?? ''),
            'kelas' => $ambil('kelas') ?? '',
            'nis' => $ambil('nis'),
            'nisn' => $ambil('nisn'),
            'kata_sandi' => $ambil('kata_sandi'),
        ];
    }

    /**
     * @param  array{nama: string, email: string, kelas: string, nis: string|null, nisn: string|null, kata_sandi: string|null}  $baris
     * @param  Collection<string, Kelas>  $kelasMap
     * @param  Collection<string, Murid>  $muridPerNis
     * @param  array<string, bool>  $nisTerpakai
     * @param  array<string, bool>  $emailTerpakai
     */
    private function validasiBaris(
        array $baris,
        Collection $kelasMap,
        Collection $muridPerNis,
        array $nisTerpakai,
        array $emailTerpakai,
    ): ?string {
        $validator = Validator::make($baris, [
            'nama' => ['required', 'string', 'min:2', 'max:120'],
            'email' => ['required', 'string', 'email:rfc', 'max:120'],
            'kelas' => ['required', 'string', 'max:60'],
            'nis' => ['nullable', 'string', 'max:30'],
            'nisn' => ['nullable', 'string', 'max:20'],
            'kata_sandi' => ['nullable', 'string', 'min:10'],
        ]);

        if ($validator->fails()) {
            return implode(' ', $validator->errors()->all());
        }

        if (isset($emailTerpakai[$baris['email']])) {
            return 'Email ganda di dalam berkas.';
        }

        if (! $kelasMap->has(mb_strtolower($baris['kelas']))) {
            return 'Kelas "'.$baris['kelas'].'" tidak ditemukan.';
        }

        $userAda = User::query()->where('email', $baris['email'])->first(['id', 'role']);

        if ($userAda !== null && $userAda->role !== 'murid') {
            return 'Email sudah dipakai akun non-murid.';
        }

        if ($baris['nis'] !== null) {
            if (isset($nisTerpakai[$baris['nis']])) {
                return 'NIS ganda di dalam berkas.';
            }

            $muridNis = $muridPerNis->get($baris['nis']);

            if ($muridNis !== null) {
                $emailPemilik = $muridNis->user?->email;

                if ($emailPemilik !== $baris['email']) {
                    return 'NIS sudah dipakai murid lain.';
                }
            }
        }

        return null;
    }

    /**
     * Upsert satu batch (maks 500 baris) dalam satu transaksi.
     *
     * @param  list<array{nama: string, email: string, kelas: string, nis: string|null, nisn: string|null, kata_sandi: string|null}>  $batch
     * @param  Collection<string, Kelas>  $kelasMap
     */
    private function prosesBatch(array $batch, int $sekolahId, Collection $kelasMap): int
    {
        $jumlah = 0;

        DB::transaction(function () use ($batch, $sekolahId, $kelasMap, &$jumlah): void {
            $emails = array_column($batch, 'email');
            $users = User::query()->whereIn('email', $emails)->get()->keyBy('email');

            foreach ($batch as $baris) {
                $user = $users->get($baris['email']);

                if ($user === null) {
                    $user = User::query()->create([
                        'name' => $baris['nama'],
                        'email' => $baris['email'],
                        'password' => Hash::make($baris['kata_sandi'] ?? Str::password(16)),
                        'status' => UserStatus::Aktif->value,
                    ]);
                    // email_verified_at tidak mass-assignable; admin yang mengimpor = terverifikasi.
                    $user->forceFill(['email_verified_at' => now()])->save();
                    // Kolom `role` + role Spatie ditulis bersama lewat satu pintu.
                    $user->tetapkanPeran('murid');
                    $users->put($baris['email'], $user);
                } elseif ($user->name !== $baris['nama']) {
                    $user->forceFill(['name' => $baris['nama']])->save();
                }

                /** @var Kelas $kelas */
                $kelas = $kelasMap->get(mb_strtolower($baris['kelas']));

                Murid::query()->updateOrCreate(
                    ['user_id' => $user->getKey()],
                    [
                        'school_id' => $sekolahId,
                        'class_id' => $kelas->getKey(),
                        'nis' => $baris['nis'],
                        'nisn' => $baris['nisn'],
                    ],
                );

                $jumlah++;
            }
        });

        return $jumlah;
    }
}
