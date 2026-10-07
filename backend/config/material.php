<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Materi & berkas (slice 08)
|--------------------------------------------------------------------------
|
| Berkas disimpan di disk `local` (storage/app/private), di luar folder publik.
| Penyajian selalu lewat URL bertanda tangan; TTL pendek karena tautan sering
| dibuat ulang saat halaman dibuka.
|
| `x_accel_prefix` diisi hanya bila ada reverse proxy (nginx) yang menyajikan
| berkas langsung dari disk. Selama kosong, aplikasi mengalirkan berkasnya
| sendiri — perilaku yang benar untuk dev dan test.
|
*/

return [
    // Ukuran satu potongan (byte). Klien memotong berkas sebesar ini.
    'chunk_byte' => (int) env('MATERIAL_CHUNK_BYTE', 1024 * 1024),

    // Batas satu berkas materi (byte). 200 MiB cukup untuk video pendek pelajaran.
    'kuota_unggahan' => (int) env('MATERIAL_KUOTA', 200 * 1024 * 1024),

    // Batas total penyimpanan satu sekolah (byte).
    'kuota_sekolah' => (int) env('MATERIAL_KUOTA_SEKOLAH', 2048 * 1024 * 1024),

    // Berkas yang tidak pernah digabung dibuang setelah sekian menit.
    'umur_yatim_menit' => (int) env('MATERIAL_UMUR_YATIM_MENIT', 180),

    // Masa berlaku URL bertanda tangan penyajian berkas (menit).
    'ttl_url_menit' => (int) env('MATERIAL_TTL_MENIT', 30),

    // Prefiks lokasi internal untuk header X-Accel-Redirect (kosong = alirkan sendiri).
    'x_accel_prefix' => env('MATERIAL_X_ACCEL_PREFIX'),
];
