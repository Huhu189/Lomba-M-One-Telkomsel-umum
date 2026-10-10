<?php

declare(strict_types=1);

namespace App\Sections\Cheat\Enums;

/**
 * Kategori kejadian kecurangan (chunk anticheat).
 *
 * Empat tempat wajib selaras saat menambah kategori: pengirim frontend,
 * enum ini, skor risiko di sini, dan label UI (dipakai Live Monitor).
 *
 * `dariKlien()` membedakan kejadian yang boleh dikirim perangkat murid dari
 * kejadian yang **hanya** boleh diturunkan server (mis. `duplicate_session`,
 * `late_submit`). Ini menutup celah murid menulis catatan turunan server —
 * mis. mengaku "sesi ganda" — untuk mengaburkan catatan.
 *
 * `tamper_suspected` kini turunan server: ia muncul saat denyut proteksi murid
 * berhenti padahal attempt masih berjalan (lihat SapuPresence), jadi perangkat
 * murid tidak boleh menuliskannya sendiri. Deteksi sisi klien yang memang
 * berasal dari perangkat memakai kategori `dom_injection` (elemen asing
 * disisipkan ke halaman ulangan) dan `extension_detected` (peramban memuat
 * sumber/skrip dari skema extension).
 */
enum KategoriKecurangan: string
{
    // Dari klien (deteksi di perangkat murid).
    case TabSwitch = 'tab_switch';
    case WindowBlur = 'window_blur';
    case FullscreenExit = 'fullscreen_exit';
    case PasteAttempt = 'paste_attempt';
    case TextSelectAttempt = 'text_select_attempt';
    case ScreenshotAttempt = 'screenshot_attempt';
    case DevtoolsOpen = 'devtools_open';
    case DevtoolsShortcut = 'devtools_shortcut';
    case DomInjection = 'dom_injection';
    case ExtensionDetected = 'extension_detected';

    // Turunan server (dihitung dari data yang server pegang sendiri).
    case DuplicateSession = 'duplicate_session';
    case LongOffline = 'long_offline';
    case LateSubmit = 'late_submit';
    case ClockJump = 'clock_jump';
    case TamperSuspected = 'tamper_suspected';

    /**
     * Skor risiko acuan (chunk anticheat). Angka ini bukan hukuman; ia hanya
     * membantu guru memilah catatan mana yang perlu ditanya lebih dulu.
     */
    public function skorRisiko(): int
    {
        return match ($this) {
            self::TamperSuspected => 9,
            self::DuplicateSession, self::DevtoolsOpen, self::DevtoolsShortcut => 8,
            self::ScreenshotAttempt, self::DomInjection => 7,
            self::PasteAttempt, self::ClockJump, self::ExtensionDetected => 6,
            self::TextSelectAttempt => 5,
            self::TabSwitch, self::FullscreenExit, self::LongOffline => 4,
            self::WindowBlur, self::LateSubmit => 3,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::TabSwitch => 'Pindah tab',
            self::WindowBlur => 'Jendela kehilangan fokus',
            self::FullscreenExit => 'Keluar layar penuh',
            self::PasteAttempt => 'Percobaan menempel jawaban',
            self::TextSelectAttempt => 'Percobaan menyeleksi teks',
            self::ScreenshotAttempt => 'Percobaan tangkapan layar',
            self::DevtoolsOpen => 'Alat pengembang terbuka',
            self::DevtoolsShortcut => 'Pintasan alat pengembang',
            self::DomInjection => 'Elemen asing disisipkan ke halaman',
            self::ExtensionDetected => 'Extension peramban terdeteksi',
            self::TamperSuspected => 'Dugaan gangguan pada proteksi (denyut berhenti)',
            self::DuplicateSession => 'Sesi ganda',
            self::LongOffline => 'Lama tidak aktif',
            self::LateSubmit => 'Mengumpulkan terlambat',
            self::ClockJump => 'Jam perangkat melompat',
        };
    }

    /** Boleh dikirim perangkat murid? */
    public function dariKlien(): bool
    {
        return match ($this) {
            self::DuplicateSession, self::LongOffline, self::LateSubmit, self::ClockJump,
            self::TamperSuspected => false,
            default => true,
        };
    }
}
