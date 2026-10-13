<?php

declare(strict_types=1);

namespace App\Sections\Admin\Services;

use App\Models\User;
use App\Sections\Admin\Enums\AksiAkun;
use App\Sections\Auth\Enums\UserStatus;
use App\Sections\Scoring\Services\TokenKonfirmasiService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

/**
 * Kelola akun guru/murid oleh admin sekolah (permintaan 14 Okt 2026).
 *
 * Admin sekolah butuh memperbaiki akun murid yang emailnya salah ketik atau
 * sandinya lupa tanpa menunggu alur reset lewat email — di sekolah SD, email
 * murid sering milik orang tua, dan pesan reset memang tidak sampai.
 *
 * Karena itu jalur ini menyentuh **cara orang masuk**, ia mengikuti pagar mutasi
 * sensitif (AGENT.md prinsip keamanan #6) persis seperti koreksi nilai:
 * autentikasi (sesi) + permission (AkunSekolahPolicy) + alasan tertulis + token
 * konfirmasi sekali pakai + audit append-only. Sandi baru tidak pernah
 * dikembalikan di respons maupun ditulis ke audit.
 */
class AkunSekolahService
{
    /** Alasan minimal (karakter) supaya tiap perubahan bisa dipertanggungjawabkan. */
    public const ALASAN_MIN = 10;

    /**
     * Tujuan token konfirmasi. Terpisah dari `koreksi_nilai` supaya token koreksi
     * nilai tidak bisa dipakai untuk mengubah akun (dan sebaliknya).
     */
    public const TUJUAN_TOKEN = 'kelola_akun';

    public function __construct(private readonly TokenKonfirmasiService $token) {}

    /**
     * Daftar akun guru & murid sekolah, berpaginasi + saringan.
     *
     * Akun admin sengaja tidak muncul: panel ini untuk mengelola akun yang diajar,
     * dan mengubah kredensial sesama admin bukan pengelolaan sekolah
     * (lihat AkunSekolahPolicy). Akun siswa tamu juga tidak muncul — tanpa kata
     * sandi dan tidak pernah dipakai untuk masuk.
     *
     * Saringan (`filter[role]`, `filter[status]`, `filter[cari]`) dibaca dari
     * kueri URL oleh spatie/laravel-query-builder, jadi pemanggil cukup memberi
     * nomor halaman & ukuran halaman — pola yang sama dengan daftar murid.
     *
     * @return LengthAwarePaginator<int, User>
     */
    public function daftar(int $perHalaman, int $halaman): LengthAwarePaginator
    {
        $kueri = QueryBuilder::for(User::class)
            ->whereIn('role', ['guru', 'murid'])
            ->where('is_tamu', false)
            ->allowedFilters(
                AllowedFilter::exact('role'),
                AllowedFilter::exact('status'),
                AllowedFilter::callback('cari', $this->saringPencarian(...)),
            )
            ->allowedSorts('name')
            ->defaultSort('name')
            ->with(['murid.kelas']);

        // "Terakhir aktif" per baris diambil dari tabel sesi. Driver sesi
        // non-database tidak punya tabel itu, jadi kolomnya dilewati — bukan
        // membuat seluruh daftar gagal.
        if (config('session.driver') === 'database') {
            $kueri->addSelect([
                'terakhir_aktif' => DB::table((string) config('session.table', 'sessions'))
                    ->select('last_activity')
                    ->whereColumn('user_id', 'users.id')
                    ->orderByDesc('last_activity')
                    ->limit(1),
            ]);
        }

        return $kueri->paginate(perPage: $perHalaman, page: $halaman);
    }

    /**
     * Terbitkan token konfirmasi untuk satu sasaran.
     *
     * Payload sengaja hanya memuat id sasaran (tanpa aksi) supaya satu token
     * berlaku untuk satu perubahan pada akun itu — bukan token yang bisa dipakai
     * berkali-kali untuk aksi berbeda pada sasaran yang sama.
     *
     * @return array{token: string, expires_at: string, ttl_detik: int}
     */
    public function mintaToken(User $admin, User $sasaran, string $alasan, ?string $ip = null): array
    {
        $this->pastikanSasaranSah($admin, $sasaran);
        $this->pastikanAlasan($alasan);

        $sasaranToken = ['sasaran_id' => (int) $sasaran->getKey()];

        $this->token->matikanSebelumnya($admin, self::TUJUAN_TOKEN, $sasaranToken);

        return $this->token->terbitkan($admin, self::TUJUAN_TOKEN, $sasaranToken, $ip);
    }

    /**
     * Ubah email akun guru/murid.
     *
     * Email baru langsung ditandai terverifikasi: admin sekolah sudah memastikan
     * alamatnya benar di meja, dan membiarkannya belum terverifikasi akan membuat
     * akun itu ditolak di semua jalur masuk (middleware `akun-aktif`) sampai
     * seseorang menekan tautan yang tidak pernah sampai — persis masalah yang
     * ingin diselesaikan jalur ini.
     *
     * @throws ValidationException
     */
    public function ubahEmail(User $admin, User $sasaran, string $email, string $alasan, string $token): User
    {
        $this->pastikanSasaranSah($admin, $sasaran);
        $this->pastikanAlasan($alasan);

        $email = mb_strtolower(trim($email));
        $this->pastikanEmailBelumDipakai($email, $sasaran);

        return DB::transaction(function () use ($admin, $sasaran, $email, $alasan, $token): User {
            $this->token->pakai($admin, self::TUJUAN_TOKEN, $token, ['sasaran_id' => (int) $sasaran->getKey()]);

            $sebelum = (string) $sasaran->email;

            $sasaran->forceFill([
                'email' => $email,
                'email_verified_at' => Carbon::now(),
            ])->save();

            $this->catat($admin, $sasaran, AksiAkun::Email, $alasan, [
                'email_sebelum' => $sebelum,
                'email_sesudah' => $email,
            ]);

            return $sasaran->refresh();
        });
    }

    /**
     * Setel ulang kata sandi akun guru/murid.
     *
     * Sekali berhasil seluruh sesi akun itu diakhiri (termasuk sesi yang mungkin
     * dibuka orang lain dengan sandi lama) dan `remember_token` diacak ulang
     * supaya cookie "ingat saya" lama tidak lagi bisa memulihkan sesi.
     *
     * @throws ValidationException
     */
    public function setelSandi(User $admin, User $sasaran, string $sandiBaru, string $alasan, string $token): User
    {
        $this->pastikanSasaranSah($admin, $sasaran);
        $this->pastikanAlasan($alasan);

        return DB::transaction(function () use ($admin, $sasaran, $sandiBaru, $alasan, $token): User {
            $this->token->pakai($admin, self::TUJUAN_TOKEN, $token, ['sasaran_id' => (int) $sasaran->getKey()]);

            $sasaran->forceFill([
                'password' => $sandiBaru,
                'remember_token' => Str::random(60),
            ])->save();

            $this->akhiriSemuaSesi($sasaran);

            // Audit TIDAK memuat sandi (baru maupun lama) — hanya fakta bahwa
            // sandi disetel ulang, oleh siapa, dan alasannya.
            $this->catat($admin, $sasaran, AksiAkun::Sandi, $alasan, [
                'email' => (string) $sasaran->email,
            ]);

            return $sasaran->refresh();
        });
    }

    /**
     * Aktifkan atau tangguhkan akun (murid/guru).
     *
     * Hanya dua status yang boleh diset dari panel ini: `aktif` dan `suspended`.
     * `dihapus` sengaja tidak — menghapus akun lewat satu tombol akan menghapus
     * profil murid beserta nilainya, sedangkan `pending` berarti "menunggu
     * verifikasi" dan bukan keadaan yang bisa dipaksakan admin.
     *
     * @throws ValidationException
     */
    public function ubahStatus(User $admin, User $sasaran, UserStatus $status, string $alasan, string $token): User
    {
        $this->pastikanSasaranSah($admin, $sasaran);
        $this->pastikanAlasan($alasan);

        if (! in_array($status, [UserStatus::Aktif, UserStatus::Suspended], true)) {
            throw ValidationException::withMessages([
                'status' => 'Status yang bisa diset dari panel admin hanya aktif atau ditangguhkan.',
            ]);
        }

        return DB::transaction(function () use ($admin, $sasaran, $status, $alasan, $token): User {
            $this->token->pakai($admin, self::TUJUAN_TOKEN, $token, ['sasaran_id' => (int) $sasaran->getKey()]);

            $sebelum = $sasaran->status?->value;

            $sasaran->forceFill(['status' => $status->value])->save();

            // Akun yang ditangguhkan harus benar-benar berhenti: middleware
            // `akun-aktif` menolaknya di permintaan berikutnya, tetapi sesi yang
            // sudah terbuka tetap hidup sampai itu. Sesi aktif dihapus di sini
            // supaya penangguhan berlaku seketika, bukan di muat ulang berikutnya.
            if ($status === UserStatus::Suspended) {
                $this->akhiriSemuaSesi($sasaran);
            }

            $this->catat($admin, $sasaran, AksiAkun::Status, $alasan, [
                'status_sebelum' => $sebelum,
                'status_sesudah' => $status->value,
            ]);

            return $sasaran->refresh();
        });
    }

    /**
     * Aturan domain: sasaran harus akun guru/murid lain, bukan diri sendiri dan
     * bukan admin lain. Diperiksa juga di sini (bukan hanya Policy) supaya
     * jalur lain yang memanggil service ini tidak mendapat jalan pintas.
     *
     * @throws ValidationException
     */
    private function pastikanSasaranSah(User $admin, User $sasaran): void
    {
        if (! $admin->hasRole('admin')) {
            throw ValidationException::withMessages(['akun' => 'Hanya admin sekolah yang bisa mengelola akun.']);
        }

        if ((int) $admin->getKey() === (int) $sasaran->getKey()) {
            throw ValidationException::withMessages([
                'akun' => 'Pakai halaman Akun untuk mengubah akunmu sendiri.',
            ]);
        }

        if ($sasaran->hasRole('admin')) {
            throw ValidationException::withMessages(['akun' => 'Akun admin sekolah lain tidak bisa diubah dari sini.']);
        }

        if (! $sasaran->hasRole('guru') && ! $sasaran->hasRole('murid')) {
            throw ValidationException::withMessages(['akun' => 'Akun ini bukan akun guru atau murid sekolah.']);
        }
    }

    /**
     * @throws ValidationException
     */
    private function pastikanAlasan(string $alasan): void
    {
        if (mb_strlen(trim($alasan)) < self::ALASAN_MIN) {
            throw ValidationException::withMessages([
                'alasan' => 'Alasan minimal '.self::ALASAN_MIN.' karakter supaya perubahan akun bisa dipertanggungjawabkan.',
            ]);
        }
    }

    /**
     * Satu kotak mencari nama atau email akun.
     *
     * Pola yang sama dengan pencarian murid: `%`/`_` yang diketik admin
     * di-escape supaya mencari "100%" menyaring, bukan mengembalikan semua akun.
     */
    private function saringPencarian(Builder $kueri, mixed $nilai): void
    {
        $kata = trim((string) (is_scalar($nilai) ? $nilai : ''));

        if ($kata === '') {
            return;
        }

        $pola = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $kata).'%';

        $kueri->where(function (Builder $dalam) use ($pola): void {
            $dalam->where('name', 'like', $pola)->orWhere('email', 'like', $pola);
        });
    }

    /**
     * @throws ValidationException
     */
    private function pastikanEmailBelumDipakai(string $email, User $sasaran): void
    {
        $dipakai = User::query()
            ->where('email', $email)
            ->whereKeyNot($sasaran->getKey())
            ->exists();

        if ($dipakai) {
            throw ValidationException::withMessages([
                'email' => 'Email ini sudah dipakai akun lain. Pakai email lain.',
            ]);
        }
    }

    /**
     * Hapus seluruh sesi akun `$sasaran`.
     *
     * Driver sesi non-database tidak punya tabel untuk dihapus (pola yang sama
     * dipakai AkunService & PasswordResetService); pada driver itu penangguhan
     * tetap berlaku lewat middleware `akun-aktif` pada permintaan berikutnya.
     */
    private function akhiriSemuaSesi(User $sasaran): void
    {
        if (config('session.driver') !== 'database') {
            return;
        }

        DB::table((string) config('session.table', 'sessions'))
            ->where('user_id', $sasaran->getKey())
            ->delete();
    }

    /**
     * Catat perubahan ke audit append-only.
     *
     * @param  array<string, mixed>  $properti
     */
    private function catat(User $admin, User $sasaran, AksiAkun $aksi, string $alasan, array $properti): void
    {
        activity('kelola_akun')
            ->causedBy($admin)
            ->performedOn($sasaran)
            ->event($aksi->value)
            ->withProperties([
                'aksi_label' => $aksi->label(),
                'alasan' => trim($alasan),
                'sasaran_nama' => (string) $sasaran->name,
                'sasaran_peran' => (string) $sasaran->role,
            ] + $properti)
            ->log('Kelola akun: '.$aksi->label());
    }
}
