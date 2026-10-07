<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Unggahan jawaban (slice 09)
|--------------------------------------------------------------------------
|
| Berkas jawaban disimpan di disk `local` (storage/app/private), di luar folder
| publik, dan hanya keluar lewat URL bertanda tangan berumur pendek.
|
| `maks_berkas_per_soal` membatasi jumlah lampiran tiap soal: cukup untuk
| beberapa lembar foto papan tulis, tetapi tidak cukup untuk dipakai sebagai
| tempat sampah penyimpanan sekolah.
|
| `durasi_rekam_maks_detik` membatasi rekaman diri. Rekaman hanya diizinkan bila
| guru/sekolah menyalakan saklar `rekam_diri` di pengaturan tiga lapis.
|
*/

return [
    // Ukuran satu potongan (byte). Klien memotong berkas sebesar ini.
    'chunk_byte' => (int) env('JAWABAN_CHUNK_BYTE', 1024 * 1024),

    // Batas satu berkas jawaban (byte). 10 MiB cukup untuk foto/lembar jawaban.
    'ukuran_maks' => (int) env('JAWABAN_UKURAN_MAKS', 10 * 1024 * 1024),

    // Jumlah lampiran maksimal per soal per attempt.
    'maks_berkas_per_soal' => (int) env('JAWABAN_MAKS_BERKAS', 3),

    // Batas durasi rekaman diri (detik).
    'durasi_rekam_maks_detik' => (int) env('JAWABAN_DURASI_REKAM_MAKS', 60),

    // Masa berlaku URL bertanda tangan penyajian berkas jawaban (menit).
    'ttl_url_menit' => (int) env('JAWABAN_TTL_MENIT', 30),

    // Umur sesi unggah yang ditinggalkan sebelum dibuang penjadwal (menit).
    'umur_yatim_menit' => (int) env('JAWABAN_UMUR_YATIM_MENIT', 180),

    // Prefiks lokasi internal untuk header X-Accel-Redirect (kosong = alirkan sendiri).
    'x_accel_prefix' => env('JAWABAN_X_ACCEL_PREFIX'),
];
