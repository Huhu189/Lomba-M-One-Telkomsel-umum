<?php

declare(strict_types=1);

namespace App\Sections\Auth\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

/**
 * Pemeriksa ID token Google (JWT RS256) — tanpa pustaka pihak ketiga.
 *
 * Tombol Google di klien memakai Google Identity Services dan menyerahkan
 * **ID token** (ditandatangani Google) ke `POST /v1/auth/google`. Token itu TIDAK
 * boleh dipercaya begitu saja: klien mana pun bisa mengirim JSON apa saja ke
 * endpoint itu. Karena itu token diperiksa di sini:
 *
 * 1. tanda tangan RS256 dicocokkan dengan kunci publik Google (JWKS, di-cache);
 * 2. `aud` harus milik aplikasi ini (`services.google.client_id`) — tanpa
 *    pemeriksaan ini, ID token milik aplikasi Google LAIN bisa dipakai masuk;
 * 3. `iss` harus Google, `exp` belum lewat, dan `iat` tidak dari masa depan;
 * 4. `email` harus ada dan `email_verified` = true. Inilah pengaman terpenting
 *    untuk penautan akun: seluruh alur di aplikasi ini memakai email sebagai
 *    identitas akun, jadi hanya alamat yang benar-benar dikuasai pemakainya yang
 *    boleh dipakai menautkan/membuat akun.
 *
 * Semua kegagalan dijawab pesan yang sama (tanpa menyebut bagian mana yang
 * gagal) supaya pemeriksaan ini tidak menjadi alat memetakan akun.
 */
class GoogleIdTokenVerifier
{
    /** Kunci cache kumpulan kunci publik Google. */
    private const KUNCI_CACHE = 'google-jwks';

    /** Penerbit yang sah (Google memakai varian dengan/tanpa skema https). */
    private const PENERBIT = ['https://accounts.google.com', 'accounts.google.com'];

    /** Toleransi selisih jam antara server ini dan Google (detik). */
    private const TOLERANSI_DETIK = 60;

    /**
     * Periksa ID token dan kembalikan klaimnya.
     *
     * @return array{google_id: string, email: string, nama: ?string}
     *
     * @throws ValidationException
     */
    public function periksa(string $idToken): array
    {
        $bagian = explode('.', trim($idToken));

        if (count($bagian) !== 3) {
            $this->tolak();
        }

        [$kepala, $isi, $tandaTangan] = $bagian;

        $header = json_decode($this->dariBase64Url($kepala), true);
        $klaim = json_decode($this->dariBase64Url($isi), true);

        if (! is_array($header) || ! is_array($klaim)) {
            $this->tolak();
        }

        if (($header['alg'] ?? null) !== 'RS256') {
            // Hanya algoritma ini yang dipakai Google; menerima 'none' atau HS256
            // (HMAC dengan kunci publik sebagai rahasia) adalah celah klasik JWT.
            $this->tolak();
        }

        $kunci = $this->kunciPublik((string) ($header['kid'] ?? ''));

        if (openssl_verify($kepala.'.'.$isi, $this->dariBase64Url($tandaTangan), $kunci, OPENSSL_ALGO_SHA256) !== 1) {
            $this->tolak();
        }

        $this->periksaKlaim($klaim);

        /** @var array{google_id: string, email: string, nama: ?string} */
        return [
            'google_id' => (string) $klaim['sub'],
            'email' => mb_strtolower(trim((string) $klaim['email'])),
            'nama' => isset($klaim['name']) && is_string($klaim['name']) ? trim($klaim['name']) : null,
        ];
    }

    /**
     * Aturan klaim: aud/iss/waktu/email. Dipisah supaya mudah dibaca dan diuji.
     *
     * @param  array<string, mixed>  $klaim
     *
     * @throws ValidationException
     */
    private function periksaKlaim(array $klaim): void
    {
        $clientId = trim((string) config('services.google.client_id'));

        if ($clientId === '') {
            // Tanpa client id tidak ada yang bisa dicocokkan: lebih baik menolak
            // (fail-closed) daripada menerima token milik aplikasi siapa pun.
            $this->tolak();
        }

        $aud = $klaim['aud'] ?? null;

        if (! is_string($aud) || ! hash_equals($clientId, $aud)) {
            $this->tolak();
        }

        if (! in_array((string) ($klaim['iss'] ?? ''), self::PENERBIT, true)) {
            $this->tolak();
        }

        $sekarang = time();
        $kedaluwarsa = is_numeric($klaim['exp'] ?? null) ? (int) $klaim['exp'] : 0;
        $diterbitkan = is_numeric($klaim['iat'] ?? null) ? (int) $klaim['iat'] : 0;

        if ($kedaluwarsa <= ($sekarang - self::TOLERANSI_DETIK)) {
            $this->tolak();
        }

        if ($diterbitkan > ($sekarang + self::TOLERANSI_DETIK)) {
            $this->tolak();
        }

        $sub = $klaim['sub'] ?? null;
        $email = $klaim['email'] ?? null;

        if (! is_string($sub) || trim($sub) === '' || ! is_string($email) || trim($email) === '') {
            $this->tolak();
        }

        // Google mengirim boolean, tetapi beberapa klien mengirim "true"/"1".
        // filter_var menangani ketiganya tanpa menerima teks lain.
        if (filter_var($klaim['email_verified'] ?? false, FILTER_VALIDATE_BOOL) !== true) {
            $this->tolak();
        }
    }

    /**
     * Kunci publik Google (PEM) untuk `kid` tertentu; menyegarkan cache sekali
     * bila `kid` belum dikenal (kunci Google dirotasi beberapa hari sekali).
     *
     * @throws ValidationException
     */
    private function kunciPublik(string $kid): string
    {
        $daftar = $this->daftarKunci();
        $jwk = $kid !== '' ? ($daftar[$kid] ?? null) : null;

        if ($jwk === null) {
            Cache::forget(self::KUNCI_CACHE);
            $daftar = $this->daftarKunci();
            $jwk = $kid !== '' ? ($daftar[$kid] ?? null) : null;
        }

        if ($jwk === null) {
            $this->tolak();
        }

        return $this->pemDariJwk($jwk);
    }

    /**
     * Kumpulan kunci publik Google dari JWKS (di-cache agar tidak diunduh pada
     * setiap percobaan masuk).
     *
     * @return array<string, array<string, mixed>>
     *
     * @throws ValidationException
     */
    private function daftarKunci(): array
    {
        /** @var array<string, array<string, mixed>> */
        return Cache::remember(
            self::KUNCI_CACHE,
            (int) config('services.google.jwks_ttl_detik', 3600),
            function (): array {
                $respons = Http::timeout(10)->acceptJson()
                    ->get((string) config('services.google.jwks_url'));

                if (! $respons->successful()) {
                    $this->tolak();
                }

                $kunci = [];

                foreach ((array) $respons->json('keys') as $jwk) {
                    if (! is_array($jwk)) {
                        continue;
                    }

                    $kid = $jwk['kid'] ?? null;

                    if (is_string($kid) && $kid !== '' && isset($jwk['n'], $jwk['e'])) {
                        $kunci[$kid] = $jwk;
                    }
                }

                if ($kunci === []) {
                    $this->tolak();
                }

                return $kunci;
            },
        );
    }

    /**
     * Ubah JWK RSA (`n`, `e`) menjadi kunci publik PEM.
     *
     * Struktur DER yang dibentuk di sini sama dengan `openssl rsa -pubin`:
     * SubjectPublicKeyInfo → AlgorithmIdentifier(rsaEncryption, NULL) + BIT STRING
     * yang berisi RSAPublicKey(SEQUENCE{ modulus INTEGER, eksponen INTEGER }).
     *
     * @param  array<string, mixed>  $jwk
     */
    private function pemDariJwk(array $jwk): string
    {
        $modulus = $this->bilanganDer($this->dariBase64Url((string) $jwk['n']));
        $eksponen = $this->bilanganDer($this->dariBase64Url((string) $jwk['e']));
        $kunciRsa = $this->der(0x30, $modulus.$eksponen);

        // AlgorithmIdentifier rsaEncryption (OID 1.2.840.113549.1.1.1 + NULL).
        $algoritma = "\x30\x0d\x06\x09\x2a\x86\x48\x86\xf7\x0d\x01\x01\x01\x05\x00";
        // BIT STRING diawali satu byte “unused bits” bernilai nol.
        $kunciPublik = $this->der(0x30, $algoritma.$this->der(0x03, "\x00".$kunciRsa));

        return "-----BEGIN PUBLIC KEY-----\n"
            .chunk_split(base64_encode($kunciPublik), 64, "\n")
            ."-----END PUBLIC KEY-----\n";
    }

    /**
     * DER INTEGER dari isi big-endian unsigned (dipakai JWK `n` dan `e`).
     */
    private function bilanganDer(string $isi): string
    {
        // Nol di depan dibuang (JWK mengirim modulus tanpa padding), lalu satu
        // byte 0x00 ditambahkan lagi bila bit tertinggi menyala supaya nilainya
        // tetap dibaca positif (DER INTEGER memakai two's complement).
        $isi = ltrim($isi, "\x00");

        if ($isi === '') {
            $isi = "\x00";
        }

        if ((ord($isi[0]) & 0x80) === 0x80) {
            $isi = "\x00".$isi;
        }

        return $this->der(0x02, $isi);
    }

    /** Satu nilai DER dengan penanda `$tag`. */
    private function der(int $tag, string $isi): string
    {
        return chr($tag).$this->panjangDer(strlen($isi)).$isi;
    }

    /** Panjang DER (bentuk pendek atau panjang). */
    private function panjangDer(int $panjang): string
    {
        if ($panjang < 0x80) {
            return chr($panjang);
        }

        $byte = '';

        while ($panjang > 0) {
            $byte = chr($panjang & 0xFF).$byte;
            $panjang >>= 8;
        }

        return chr(0x80 | strlen($byte)).$byte;
    }

    /** base64url (tanpa padding) → biner. */
    private function dariBase64Url(string $data): string
    {
        $sisa = strlen($data) % 4;

        if ($sisa > 0) {
            $data .= str_repeat('=', 4 - $sisa);
        }

        $biner = base64_decode(strtr($data, '-_', '+/'), true);

        return $biner === false ? '' : $biner;
    }

    /**
     * Semua bentuk kegagalan memakai pesan yang sama: pengguna tidak perlu tahu
     * bagian mana yang gagal, dan penyerang tidak boleh memakainya untuk mengukur
     * pemalsuan token sedikit demi sedikit.
     *
     * @throws ValidationException
     */
    private function tolak(): never
    {
        throw ValidationException::withMessages([
            'credential' => 'Masuk dengan Google tidak bisa dipakai kali ini. Coba lagi ya.',
        ]);
    }
}
