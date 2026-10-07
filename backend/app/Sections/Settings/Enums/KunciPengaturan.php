<?php

declare(strict_types=1);

namespace App\Sections\Settings\Enums;

/**
 * Kunci pengaturan yang dikenali beserta tipe, nilai bawaan, dan labelnya.
 * Berlaku untuk retry, batas percobaan, remedial, ranking, layar guru,
 * mode tim, saklar anti-cheat (chunk slice-02), serta ambang pemahaman dan
 * data minimum laporan per tag (chunk slice-05).
 */
enum KunciPengaturan: string
{
    case Retry = 'retry';
    case BatasPercobaan = 'batas_percobaan';
    case Remedial = 'remedial';
    case Ranking = 'ranking';
    case LayarGuru = 'layar_guru';
    case ModeTim = 'mode_tim';
    case AntiCheat = 'anti_cheat';
    // Saklar rinci anti-cheat (slice 07). Semua proteksi **mati secara bawaan**:
    // guru yang menyalakannya lewat pengaturan tiga lapis, dan tiap saklar bisa
    // dinyalakan per sekolah/kelas/kuis. `exam_mode` adalah preset yang
    // menyalakan sekelompok saklar sekaligus.
    case BlockPaste = 'block_paste';
    case BlockRightClick = 'block_right_click';
    case BlockTextSelect = 'block_text_select';
    case BlockPrint = 'block_print';
    case BlockScreenshot = 'block_screenshot';
    case BlockDevtools = 'block_devtools';
    case DetectResize = 'detect_window_resize';
    case BlockTabSwitch = 'block_tab_switch';
    case FocusLock = 'focus_lock';
    case BlockTranslate = 'block_translate';
    case ExamMode = 'exam_mode';
    case AmbangPaham = 'ambang_paham';
    case AmbangMulaiPaham = 'ambang_mulai_paham';
    case MinimalDataTag = 'data_minimum_tag';
    // Saklar izin rekam diri (slice 09). Default MATI: murid tidak boleh diminta
    // merekam dirinya sebelum sekolah/guru menyalakannya (izin sekolah/orang tua).
    case RekamDiri = 'rekam_diri';

    /** Tipe nilai yang diterima ('boolean' | 'integer'). */
    public function tipe(): string
    {
        return match ($this) {
            self::BatasPercobaan, self::AmbangPaham, self::AmbangMulaiPaham, self::MinimalDataTag => 'integer',
            default => 'boolean',
        };
    }

    /** Saklar anti-cheat rinci (preset `exam_mode` menyalakan sebagiannya). */
    public function antiCheat(): bool
    {
        return match ($this) {
            self::AntiCheat,
            self::BlockPaste, self::BlockRightClick, self::BlockTextSelect,
            self::BlockPrint, self::BlockScreenshot, self::BlockDevtools,
            self::DetectResize, self::BlockTabSwitch, self::FocusLock,
            self::BlockTranslate, self::ExamMode => true,
            default => false,
        };
    }

    /** Nilai bawaan bila tidak diatur di lapis mana pun. */
    public function bawaan(): bool|int
    {
        return match ($this) {
            self::BatasPercobaan => 3,
            // Ranking sengaja mati secara bawaan: tidak semua kelas senang
            // diperbandingkan, guru yang menyalakannya (chunk slice-05).
            self::Ranking, self::ModeTim => false,
            // Proteksi anti-cheat default MATI (chunk anticheat: "semua proteksi
            // default mati"): saklar induk pun mati, jadi instalasi baru tidak
            // pernah memasang sensor apa pun sebelum guru memintanya.
            self::AntiCheat,
            self::BlockPaste, self::BlockRightClick, self::BlockTextSelect,
            self::BlockPrint, self::BlockScreenshot, self::BlockDevtools,
            self::DetectResize, self::BlockTabSwitch, self::FocusLock,
            self::BlockTranslate, self::ExamMode => false,
            self::AmbangPaham => 80,
            self::AmbangMulaiPaham => 60,
            self::MinimalDataTag => 3,
            self::RekamDiri => false,
            default => true,
        };
    }

    /** Kelompok tampilan di halaman pengaturan. */
    public function kelompok(): string
    {
        return match ($this) {
            self::AntiCheat, self::BlockPaste, self::BlockRightClick, self::BlockTextSelect,
            self::BlockPrint, self::BlockScreenshot, self::BlockDevtools,
            self::DetectResize, self::BlockTabSwitch, self::FocusLock,
            self::BlockTranslate, self::ExamMode => 'Anti-cheat',
            self::AmbangPaham, self::AmbangMulaiPaham, self::MinimalDataTag => 'Laporan & pemahaman',
            self::LayarGuru, self::ModeTim, self::Ranking => 'Tampilan & laporan',
            default => 'Aturan ulangan',
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Retry => 'Izinkan ulangan ulang (retry)',
            self::BatasPercobaan => 'Batas percobaan',
            self::Remedial => 'Aktifkan remedial',
            self::Ranking => 'Tampilkan ranking',
            self::LayarGuru => 'Aktifkan layar guru',
            self::ModeTim => 'Aktifkan mode tim',
            self::AntiCheat => 'Aktifkan anti-cheat',
            self::BlockPaste => 'Blokir tempel (paste) jawaban',
            self::BlockRightClick => 'Blokir klik kanan',
            self::BlockTextSelect => 'Blokir seleksi teks',
            self::BlockPrint => 'Sembunyikan saat dicetak',
            self::BlockScreenshot => 'Blur saat dugaan tangkapan layar',
            self::BlockDevtools => 'Deteksi alat pengembang',
            self::DetectResize => 'Blur singkat saat ukuran jendela berubah',
            self::BlockTabSwitch => 'Catat pindah tab / jendela',
            self::FocusLock => 'Kunci layar 60 detik saat keluar jendela',
            self::BlockTranslate => 'Blokir terjemahan otomatis',
            self::ExamMode => 'Preset ujian (nyalakan sekelompok proteksi)',
            self::AmbangPaham => 'Ambang paham (%)',
            self::AmbangMulaiPaham => 'Ambang mulai paham (%)',
            self::MinimalDataTag => 'Data minimum per tema (jumlah soal)',
            self::RekamDiri => 'Izinkan rekam diri jawaban (izin sekolah/orang tua)',
        };
    }
}
