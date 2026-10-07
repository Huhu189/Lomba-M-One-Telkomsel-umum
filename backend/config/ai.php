<?php

declare(strict_types=1);

/**
 * Penilaian AI untuk jawaban uraian (slice 09-B).
 *
 * Bawaannya MATI: sekolah tanpa kunci API tetap bisa memakai aplikasi, dan
 * mengumpulkan ulangan tidak ikut menunggu layanan pihak ketiga. Saat dinyalakan,
 * panggilan hanya dilakukan dari server lewat queue — kunci API tidak pernah
 * dikirim ke klien, tidak ikut ke log, dan tidak ditulis ke basis data.
 */
return [
    /** Saklar utama; hanya berlaku kalau `kunci` diisi. */
    'aktif' => (bool) env('AI_PENILAIAN_AKTIF', false),

    /** Endpoint bergaya chat completions (OpenAI-compatible). */
    'url' => (string) env('AI_PENILAIAN_URL', 'https://api.openai.com/v1/chat/completions'),

    /** Kunci API. HANYA di server: jangan pernah dicatat atau dikirim ke klien. */
    'kunci' => (string) env('AI_PENILAIAN_KUNCI', ''),

    'model' => (string) env('AI_PENILAIAN_MODEL', 'gpt-4o-mini'),

    /** Batas tunggu (detik). Lewat batas = soal ditandai gagal, guru meninjau. */
    'timeout_detik' => (int) env('AI_PENILAIAN_TIMEOUT', 20),

    /** Satu permintaan ke API menampung maksimal sekian soal (sisanya dipecah). */
    'maks_soal_per_permintaan' => (int) env('AI_PENILAIAN_MAKS_SOAL', 5),

    /** Pemotongan teks soal/jawaban supaya besar permintaan tetap terkendali. */
    'maks_karakter' => (int) env('AI_PENILAIAN_MAKS_KARAKTER', 4000),
];
