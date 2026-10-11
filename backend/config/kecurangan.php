<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Catatan kecurangan (slice 07)
|--------------------------------------------------------------------------
|
| Sinyal kecurangan dikirim perangkat murid secara berkelompok. Tanpa batas
| jumlah, satu attempt bisa menulis ribuan baris `cheat_events` hanya dengan
| memicu kejadian berulang (pindah tab, buka devtools, tempel) — tabel tumbuh
| mengikuti kemauan klien, dan guru menerima catatan yang tak bisa dibaca.
|
| Batasnya per ATTEMPT, bukan per akun: nilai ini adalah pagar terakhir yang
| tetap berlaku walau klien mengabaikan cooldown dan throttle rutenya. Angka
| bawaannya jauh di atas wajar untuk ulangan satu jam (puluhan kejadian),
| tetapi jauh di bawah jumlah yang bisa merusak basis data.
|
| Ingat: catatan ini bahan tinjauan guru, bukan vonis — karena itu batasnya
| murah dan tidak pernah menghentikan ulangan murid.
|
*/

return [
    // Jumlah maksimal catatan dari perangkat murid untuk satu attempt.
    'maks_kejadian_per_attempt' => (int) env('KECURANGAN_MAKS_KEJADIAN', 400),
];
