# src/security/

Folder untuk kode proteksi ulangan (chunk `anticheat`):

- hook per proteksi (block_paste, block_tab_switch, block_devtools, dst.);
- orkestrator `useExamSecurity` yang men-gate setiap proteksi lewat
  pengaturan tiga lapis (semua default mati, fail-open);
- pengirim catatan kejadian (kirim berkelompok maks 50, dedupe,
  antrean offline lokal maks 200 entri / 48 jam);
- pemindai tamper halaman `deteksiTamper.js` (putaran A.53): sumber dari skema
  extension, fungsi proteksi yang diganti, overlay asing yang dinetralkan, dan
  elemen kanari yang hilang — menyala hanya lewat saklar `detect_tamper` yang
  default mati dan **tidak** ikut preset `exam_mode`.

Diimplementasikan pada **slice 07** — folder disiapkan sejak scaffold.
