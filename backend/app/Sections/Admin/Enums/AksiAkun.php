<?php

declare(strict_types=1);

namespace App\Sections\Admin\Enums;

/**
 * Aksi mutasi akun yang boleh dilakukan admin sekolah dari panel admin.
 *
 * Ketiganya sensitif (menyentuh cara seseorang masuk), jadi ketiganya memakai
 * satu alur yang sama: token konfirmasi sekali pakai + alasan tertulis + audit
 * append-only (AGENT.md prinsip keamanan #6).
 */
enum AksiAkun: string
{
    case Email = 'email';
    case Sandi = 'sandi';
    case Status = 'status';

    /** Label Indonesia untuk UI (status/aksi selalu tampil dengan teks). */
    public function label(): string
    {
        return match ($this) {
            self::Email => 'Ubah email',
            self::Sandi => 'Setel ulang kata sandi',
            self::Status => 'Aktifkan / tangguhkan akun',
        };
    }
}
