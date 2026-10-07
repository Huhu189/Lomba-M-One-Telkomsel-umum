<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Avatar & moderasi (slice 08)
|--------------------------------------------------------------------------
|
| Berkas avatar disimpan di disk `local` (storage/app/private), di luar folder
| publik, dan hanya keluar lewat URL bertanda tangan berumur pendek.
|
| `sisi` adalah ukuran gambar hasil encode ulang di server: klien tidak pernah
| menentukan ukuran akhir, dan berkas kiriman tidak pernah disajikan apa adanya.
|
| `ambang_laporan` adalah jumlah laporan unik yang membuat avatar disembunyikan
| dari orang lain dan masuk antrean tinjau guru. Bawaannya 3.
|
*/

return [
    // Batas berkas kiriman (byte). 2 MiB cukup untuk foto/ gambar anak.
    'ukuran_maks' => (int) env('AVATAR_UKURAN_MAKS', 2 * 1024 * 1024),

    // Sisi persegi gambar hasil encode ulang (px).
    'sisi' => (int) env('AVATAR_SISI', 256),

    // Kualitas JPEG hasil encode ulang (1-100).
    'kualitas' => (int) env('AVATAR_KUALITAS', 85),

    // Jumlah laporan unik sebelum avatar disembunyikan dari orang lain.
    'ambang_laporan' => (int) env('AVATAR_AMBANG_LAPORAN', 3),

    // Batas jumlah laporan yang boleh dikirim satu murid per jam.
    'maks_laporan_per_jam' => (int) env('AVATAR_MAKS_LAPORAN_PER_JAM', 20),

    // Masa berlaku URL bertanda tangan penyajian gambar (menit).
    'ttl_url_menit' => (int) env('AVATAR_TTL_MENIT', 30),

    // Prefiks lokasi internal untuk header X-Accel-Redirect (kosong = alirkan sendiri).
    'x_accel_prefix' => env('AVATAR_X_ACCEL_PREFIX'),
];
