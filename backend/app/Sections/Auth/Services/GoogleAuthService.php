<?php

declare(strict_types=1);

namespace App\Sections\Auth\Services;

use App\Models\User;
use App\Sections\Auth\Enums\UserStatus;
use App\Sections\School\Services\MuridService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Masuk & daftar lewat Google (14 Oktober 2026).
 *
 * Aturan mainnya — dan inilah yang membuat "Google" tidak menjadi pintu kedua
 * yang berbeda dari akun biasa:
 *
 * 1. **Satu akun per email.** Email dari Google sudah pasti milik pemakainya
 *    (`email_verified` diperiksa di verifier), jadi:
 *    - akun yang sudah punya `google_id` itu → langsung masuk;
 *    - email yang sudah terdaftar (dibuat lewat Google maupun manual) →
 *      **ditautkan** ke akun yang sudah ada, tidak dibuat akun baru. Guru yang
 *      mengimpor murid dengan alamat Google muridnya tidak menghasilkan dua
 *      akun berbeda untuk anak yang sama.
 * 2. **Akun baru dari Google tetap seperti akun biasa.** Ia dibuat dengan peran
 *    `murid`, status `aktif`, email terverifikasi (Google sudah membuktikannya),
 *    dan diberi profil kelas penampung seperti pendaftaran mandiri. Bedanya cuma
 *    satu: kata sandinya masih sandi acak milik server, jadi `perlu_buat_sandi`
 *    menyala dan murid diminta membuat kata sandinya sekali di awal
 *    (`/buat-sandi`) — sesudah itu masuk lagi tidak lagi menanyakan kata sandi
 *    selama sesinya hidup.
 * 3. **Akun yang belum punya kata sandi tidak bisa dimasuki lewat jalur sandi.**
 *    Sandi acak itu tidak pernah diberitahukan ke siapa pun, dan `LoginService`
 *    menolak akun ber-`perlu_buat_sandi` walau sandi acaknya entah bagaimana
 *    diketahui. Jadi tidak ada jalan masuk yang "beda method".
 * 4. **Akun tertangguh/dihapus tetap ditolak** walau lewat Google: status akun
 *    adalah keputusan sekolah, bukan sesuatu yang bisa dilewati dengan memilih
 *    pintu masuk lain.
 */
class GoogleAuthService
{
    /** Panjang sandi acak untuk akun yang dibuat lewat Google (tak pernah dipakai masuk). */
    private const PANJANG_SANDI_ACAK = 40;

    public function __construct(
        private readonly GoogleIdTokenVerifier $verifier,
        private readonly LoginService $login,
        private readonly MuridService $murid,
    ) {}

    /**
     * Apakah tombol Google layak ditampilkan? (client id sudah diisi pengelola)
     */
    public function aktif(): bool
    {
        return trim((string) config('services.google.client_id')) !== '';
    }

    /**
     * Id klien Google untuk klien (bukan rahasia; memang dipakai peramban).
     */
    public function clientId(): string
    {
        return trim((string) config('services.google.client_id'));
    }

    /**
     * Masuk (atau daftar) lewat ID token Google, lalu buka sesi seperti login biasa.
     *
     * @return array{user: User, baru: bool}
     *
     * @throws ValidationException
     */
    public function masukLewatGoogle(string $idToken): array
    {
        if (! $this->aktif()) {
            throw ValidationException::withMessages([
                'credential' => 'Masuk dengan Google belum dinyalakan di sekolah ini.',
            ]);
        }

        $klaim = $this->verifier->periksa($idToken);

        $hasil = DB::transaction(fn (): array => $this->tautkanAtauBuat($klaim));

        /** @var User $user */
        $user = $hasil['user'];

        if ($user->alasanAkunDitolak() !== null) {
            throw ValidationException::withMessages([
                'credential' => 'Akun ini belum bisa dipakai. Hubungi sekolah ya.',
            ]);
        }

        // Sesi dibuka lewat pintu yang sama dengan login sandi (guard web +
        // regenerasi id sesi), jadi seluruh aplikasi tidak perlu tahu bedanya.
        $this->login->masukOtomatis($user);

        return $hasil;
    }

    /**
     * Cari akun yang cocok: `google_id` dulu (identitas paling kuat), lalu email.
     * Tidak ketemu keduanya → akun baru dibuat.
     *
     * @param  array{google_id: string, email: string, nama: ?string}  $klaim
     * @return array{user: User, baru: bool}
     */
    private function tautkanAtauBuat(array $klaim): array
    {
        $user = User::query()
            ->where('google_id', $klaim['google_id'])
            ->first();

        if ($user !== null) {
            return ['user' => $user, 'baru' => false];
        }

        $user = User::query()
            // Akun siswa tamu tidak punya email sungguhan dan tidak boleh
            // ditautkan ke akun Google siapa pun.
            ->where('is_tamu', false)
            ->where('email', $klaim['email'])
            ->first();

        if ($user !== null) {
            return ['user' => $this->tautkan($user, $klaim), 'baru' => false];
        }

        return ['user' => $this->buat($klaim), 'baru' => true];
    }

    /**
     * Tautkan Google ke akun yang sudah ada (dibuat manual oleh sekolah atau
     * sebelumnya lewat Google dengan email yang sama).
     *
     * Kata sandi lama TIDAK disentuh — murid yang sudah biasa masuk dengan kata
     * sandi tetap bisa begitu, dan tidak ada sandi orang lain yang diganti diam-diam.
     * Yang dirapikan hanya dua hal: `google_id` disimpan, dan email yang sudah
     * dibuktikan Google dianggap terverifikasi (akun yang tadinya `pending`
     * karena belum membuka tautan verifikasi jadi aktif).
     *
     * @param  array{google_id: string, email: string, nama: ?string}  $klaim
     */
    private function tautkan(User $user, array $klaim): User
    {
        // Akun yang dihapus/ditangguhkan tidak ditautkan: menautkan lalu menolak
        // hanya membingungkan, dan jejaknya tidak perlu ditulis.
        if (in_array($user->status, [UserStatus::Dihapus, UserStatus::Suspended], true)) {
            throw ValidationException::withMessages([
                'credential' => 'Akun ini belum bisa dipakai. Hubungi sekolah ya.',
            ]);
        }

        $perubahan = [
            'google_id' => $klaim['google_id'],
            'email_verified_at' => $user->email_verified_at ?? now(),
        ];

        if ($user->status === UserStatus::Pending) {
            $perubahan['status'] = UserStatus::Aktif->value;
        }

        $user->forceFill($perubahan)->save();

        return $user->refresh();
    }

    /**
     * Buat akun baru dari klaim Google (selalu peran `murid`, seperti pendaftaran
     * mandiri — guru/admin tidak boleh lahir dari tombol di halaman masuk).
     *
     * @param  array{google_id: string, email: string, nama: ?string}  $klaim
     */
    private function buat(array $klaim): User
    {
        $nama = $klaim['nama'] !== null && $klaim['nama'] !== ''
            ? mb_substr($klaim['nama'], 0, 60)
            // Nama tampilan wajib ada di aplikasi ini; kalau Google tidak
            // mengirimkannya, pakai bagian sebelum @ dari emailnya.
            : mb_substr((string) strstr($klaim['email'], '@', true), 0, 60);

        $user = User::query()->create([
            'name' => $nama !== '' ? $nama : 'Murid',
            'email' => $klaim['email'],
            // Sandi acak: tidak ada yang tahu nilainya, jadi jalur sandi memang
            // belum bisa dipakai sampai murid membuat sandinya sendiri.
            'password' => Str::random(self::PANJANG_SANDI_ACAK),
            'google_id' => $klaim['google_id'],
            'status' => UserStatus::Aktif->value,
            'perlu_buat_sandi' => true,
        ]);

        // `email_verified_at` sengaja TIDAK mass-assignable (satu pola dengan
        // jalur pendaftaran & impor): email di sini sudah dibuktikan Google, jadi
        // murid tidak perlu membuka tautan verifikasi apa pun.
        $user->forceFill(['email_verified_at' => now()])->save();

        $user->tetapkanPeran('murid');
        $this->murid->pastikanProfil($user);

        return $user->refresh();
    }
}
