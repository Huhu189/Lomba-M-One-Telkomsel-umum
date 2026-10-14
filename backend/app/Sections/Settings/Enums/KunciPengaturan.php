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
    // Deteksi tamper halaman (chunk anticheat, bagian "deteksi tamper"):
    // overlay asing ber-z-index tinggi, elemen kanari yang hilang, fungsi bawaan
    // yang diganti, dan sumber dari skema extension. Sengaja TIDAK ikut preset
    // `exam_mode`: ia merapikan DOM (menetralkan overlay), jadi guru harus
    // menyalakannya sendiri dengan sadar — deteksi jenis ini rawan salah tuduh.
    case DetectTamper = 'detect_tamper';
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
    // Saklar siswa tamu (mode tamu tanpa login). Default MATI: kuis tidak pernah
    // terbuka untuk orang tanpa akun sebelum guru membukanya. Karena pengaturan
    // ini tiga lapis, guru memakainya pada **lapis kuis** miliknya sendiri
    // (admin bisa menyalakannya untuk sekolah/kelas).
    case IzinkanTamu = 'izinkan_tamu';
    // Keterlihatan peringkat (14 Oktober 2026). Peringkat adalah alat kelas,
    // bukan rapor: yang melihat NOMOR peringkat hanya N% teratas, sedangkan
    // murid lain tetap melihat skornya sendiri. Guru selalu melihat seluruh
    // daftar (dipakai laporan dan layar proyektor).
    case PeringkatTerbukaPersen = 'peringkat_terbuka_persen';
    // Bonus penyemangat (14 Oktober 2026). Ini BUKAN nilai: skor asli di rapor,
    // ekspor, dan laporan tidak pernah berubah. Yang berubah hanya angka yang
    // DITAMPILKAN di papan peringkat, dan barisnya menandai diri sendiri sebagai
    // berbantuan supaya guru (dan muridnya) tahu persis apa yang terjadi.
    case BonusSemangat = 'bonus_semangat';
    case BonusSemangatBawahPersen = 'bonus_semangat_bawah_persen';
    case BonusSemangatMaksPersen = 'bonus_semangat_maks_persen';

    /** Tipe nilai yang diterima ('boolean' | 'integer'). */
    public function tipe(): string
    {
        return match ($this) {
            self::BatasPercobaan, self::AmbangPaham, self::AmbangMulaiPaham, self::MinimalDataTag,
            self::PeringkatTerbukaPersen, self::BonusSemangatBawahPersen,
            self::BonusSemangatMaksPersen => 'integer',
            default => 'boolean',
        };
    }

    /** Kunci yang nilainya persentase 0–100 (divalidasi di request). */
    public function persentase(): bool
    {
        return match ($this) {
            self::AmbangPaham, self::AmbangMulaiPaham,
            self::PeringkatTerbukaPersen, self::BonusSemangatBawahPersen,
            self::BonusSemangatMaksPersen => true,
            default => false,
        };
    }

    /** Saklar anti-cheat rinci (preset `exam_mode` menyalakan sebagiannya). */
    public function antiCheat(): bool
    {
        return match ($this) {
            self::AntiCheat,
            self::BlockPaste, self::BlockRightClick, self::BlockTextSelect,
            self::BlockPrint, self::BlockScreenshot, self::BlockDevtools,
            self::DetectTamper, self::DetectResize, self::BlockTabSwitch, self::FocusLock,
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
            self::DetectTamper, self::DetectResize, self::BlockTabSwitch, self::FocusLock,
            self::BlockTranslate, self::ExamMode => false,
            self::AmbangPaham => 80,
            self::AmbangMulaiPaham => 60,
            self::MinimalDataTag => 3,
            self::RekamDiri => false,
            // Kuis hanya terbuka untuk orang tanpa akun bila guru memintanya.
            self::IzinkanTamu => false,
            // Bawaan yang sengaja ramah kelas: nomor peringkat hanya untuk 30%
            // teratas, dan bonus penyemangat mati kecuali guru menyalakannya.
            self::PeringkatTerbukaPersen => 30,
            self::BonusSemangat => false,
            self::BonusSemangatBawahPersen => 50,
            self::BonusSemangatMaksPersen => 15,
            default => true,
        };
    }

    /** Kelompok tampilan di halaman pengaturan. */
    public function kelompok(): string
    {
        return match ($this) {
            self::AntiCheat, self::BlockPaste, self::BlockRightClick, self::BlockTextSelect,
            self::BlockPrint, self::BlockScreenshot, self::BlockDevtools,
            self::DetectTamper, self::DetectResize, self::BlockTabSwitch, self::FocusLock,
            self::BlockTranslate, self::ExamMode => 'Anti-cheat',
            self::AmbangPaham, self::AmbangMulaiPaham, self::MinimalDataTag => 'Laporan & pemahaman',
            self::LayarGuru, self::ModeTim, self::Ranking,
            self::PeringkatTerbukaPersen, self::BonusSemangat,
            self::BonusSemangatBawahPersen, self::BonusSemangatMaksPersen => 'Tampilan & laporan',
            self::IzinkanTamu => 'Siswa tamu',
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
            self::DetectTamper => 'Deteksi tamper halaman (overlay asing & extension)',
            self::DetectResize => 'Blur singkat saat ukuran jendela berubah',
            self::BlockTabSwitch => 'Catat pindah tab / jendela',
            self::FocusLock => 'Kunci layar 60 detik saat keluar jendela',
            self::BlockTranslate => 'Blokir terjemahan otomatis',
            self::ExamMode => 'Preset ujian (nyalakan sekelompok proteksi)',
            self::AmbangPaham => 'Ambang paham (%)',
            self::AmbangMulaiPaham => 'Ambang mulai paham (%)',
            self::MinimalDataTag => 'Data minimum per tema (jumlah soal)',
            self::RekamDiri => 'Izinkan rekam diri jawaban (izin sekolah/orang tua)',
            self::IzinkanTamu => 'Izinkan siswa tamu ikut kuis ini tanpa akun (cukup nama)',
            self::PeringkatTerbukaPersen => 'Nomor peringkat hanya untuk …% teratas',
            self::BonusSemangat => 'Bonus penyemangat untuk murid di bawah ambang (hanya tampilan)',
            self::BonusSemangatBawahPersen => 'Bonus penyemangat: ambang bawah (%)',
            self::BonusSemangatMaksPersen => 'Bonus penyemangat: tambahan maksimal (%)',
        };
    }
}
