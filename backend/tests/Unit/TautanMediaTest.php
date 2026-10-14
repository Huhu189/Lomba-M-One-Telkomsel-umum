<?php

declare(strict_types=1);

use App\Sections\Material\Registry\TautanMedia;

/**
 * Pagar tautan media materi (14 Oktober 2026) — guru boleh menyelipkan klip
 * media dari tautan, dan hanya alamat yang **aman** yang boleh tersimpan.
 *
 * Yang dijaga di sini bukan cuma "bisa", tetapi juga "tidak bisa": http,
 * `javascript:`, alamat bersandi, dan alamat mesin lokal harus DITOLAK — tiga di
 * antaranya sudah terbukti gagal pada versi pertama kelas ini (lihat tes
 * `TIDAK`), jadi tes ini memang punya gigi, bukan sekadar membaca ulang kode.
 */
describe('TautanMedia::aman', function (): void {
    it('menerima alamat https publik', function (): void {
        expect(TautanMedia::aman('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))->toBeTrue()
            ->and(TautanMedia::aman('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/preview'))->toBeTrue()
            ->and(TautanMedia::aman('https://sekolah.example.test/video/materi.mp4'))->toBeTrue();
    });

    it('menolak http, skema aneh, alamat bersandi, dan alamat mesin lokal', function (): void {
        $ditolak = [
            'http://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'javascript:alert(1)',
            'data:text/html,<script>alert(1)</script>',
            'https://murid:rahasia@www.youtube.com/watch?v=dQw4w9WgXcQ',
            'https://localhost/video.mp4',
            'https://127.0.0.1/video.mp4',
            'https://192.168.1.10/video.mp4',
            'https://10.0.0.5/video.mp4',
            'https://169.254.169.254/latest/meta-data',
            'https://server-sekolah.local/video.mp4',
            'https://tanpa-titik/video.mp4',
            '',
            '   ',
            'https://www.youtube.com/watch?v='.str_repeat('a', 600),
        ];

        foreach ($ditolak as $tautan) {
            expect(TautanMedia::aman($tautan))->toBeFalse("Tautan ini seharusnya ditolak: {$tautan}");
        }
    });
});

describe('TautanMedia::jenis & sematan', function (): void {
    it('mengenali bentuk tautan YouTube yang lazim dipakai guru', function (): void {
        $youtube = [
            'https://www.youtube.com/watch?v=dQw4w9WgXcQ' => 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
            'https://youtu.be/dQw4w9WgXcQ' => 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
            'https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=30s' => 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
            'https://www.youtube.com/embed/dQw4w9WgXcQ?start=10' => 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
            'https://www.youtube.com/shorts/dQw4w9WgXcQ' => 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        ];

        foreach ($youtube as $tautan => $sematan) {
            expect(TautanMedia::jenis($tautan))->toBe('youtube')
                ->and(TautanMedia::sematan($tautan))->toBe($sematan);
        }
    });

    it('tidak menyematkan ID YouTube yang tidak berbentuk ID', function (): void {
        // 11 karakter `[A-Za-z0-9_-]` — selain itu bukan ID, jadi tidak disematkan.
        expect(TautanMedia::jenis('https://www.youtube.com/watch?v=pendek'))->toBe('lain')
            ->and(TautanMedia::sematan('https://www.youtube.com/watch?v=pendek'))->toBeNull()
            ->and(TautanMedia::sematan('https://www.youtube.com/watch?v='.str_repeat('a', 12)))->toBeNull();
    });

    it('menyematkan berkas Google Drive lewat alamat preview', function (): void {
        expect(TautanMedia::jenis('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view?usp=sharing'))->toBe('drive')
            ->and(TautanMedia::sematan('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view'))->toBe('https://drive.google.com/file/1AbCdEfGhIjKlMnOpQrStUvWxYz/preview')
            ->and(TautanMedia::sematan('https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz'))->toBe('https://drive.google.com/file/1AbCdEfGhIjKlMnOpQrStUvWxYz/preview')
            // Host lain TIDAK pernah disematkan — guru tidak bisa memilih host bingkai.
            ->and(TautanMedia::sematan('https://contoh.example.test/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view'))->toBeNull();
    });

    it('mengenali berkas media langsung dan tidak menyematkannya', function (): void {
        expect(TautanMedia::jenis('https://sekolah.example.test/materi/pecahan.mp4'))->toBe('berkas')
            ->and(TautanMedia::sematan('https://sekolah.example.test/materi/pecahan.mp4'))->toBeNull()
            ->and(TautanMedia::mime('https://sekolah.example.test/materi/pecahan.mp4'))->toBe('video/mp4')
            ->and(TautanMedia::mime('https://sekolah.example.test/materi/poster.PNG'))->toBe('image/png')
            ->and(TautanMedia::jenis('https://sekolah.example.test/bank-soal/artikel'))->toBe('lain')
            ->and(TautanMedia::mime('https://sekolah.example.test/bank-soal/artikel'))->toBeNull();
    });
});

describe('TautanMedia::nama & label', function (): void {
    it('menampilkan nama berkas, atau host untuk tautan halaman', function (): void {
        expect(TautanMedia::nama('https://sekolah.example.test/materi/pecahan%20kelas%204.mp4'))
            ->toBe('pecahan kelas 4.mp4')
            ->and(TautanMedia::nama('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))->toBe('www.youtube.com')
            ->and(TautanMedia::label('youtube'))->toBe('Video YouTube')
            ->and(TautanMedia::label('drive'))->toBe('Berkas Google Drive')
            ->and(TautanMedia::label('berkas'))->toBe('Berkas tautan')
            ->and(TautanMedia::label('lain'))->toBe('Tautan media');
    });
});
