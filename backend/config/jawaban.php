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
    // Panjang maksimal jawaban teks (karakter), mis. uraian. Harus sama dengan
    // BATAS_URAIAN di frontend (question/render/batasJawaban.js).
    'teks_maks' => (int) env('JAWABAN_TEKS_MAKS', 10000),

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

    // Batas dimensi gambar kanvas (piksel total) sebelum di-encode ulang (K-12).
    //
    // Gambar diperiksa dimensinya dulu, baru didekode, jadi angka inilah yang
    // menentukan puncak pemakaian memori: satu piksel truecolor memakan ~4 byte,
    // sehingga batas lama 40 juta piksel bisa meminta ~160 MB — di atas
    // `memory_limit` 128 MB yang lazim, dan kegagalan alokasi PHP **tidak bisa
    // ditangkap** (prosesnya mati, bukan 422).
    //
    // 12 juta piksel (mis. 4000x3000) jauh lebih longgar daripada kebutuhan
    // nyata gambar kanvas murid, tetapi tetap di bawah batas memori lazim.
    'batas_piksel_kanvas' => (int) env('JAWABAN_BATAS_PIKSEL_KANVAS', 12_000_000),

    // Prefiks lokasi internal untuk header X-Accel-Redirect (kosong = alirkan sendiri).
    'x_accel_prefix' => env('JAWABAN_X_ACCEL_PREFIX'),
];
