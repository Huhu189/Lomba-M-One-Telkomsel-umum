/**
 * Penanda "halaman sedang diunduh" — fallback `Suspense` untuk rute malas
 * (lihat `src/halaman.js`).
 *
 * Dua hal yang dijaga di sini:
 * 1. **Tidak berkedip.** Modul yang sudah tersimpan di cache peramban selesai
 *    dalam hitungan milidetik, dan penanda yang muncul-mengilang justru terasa
 *    seperti halaman rusak. Karena itu kemunculannya ditunda sedikit dan
 *    dihaluskan lewat animasi CSS `.memuat-halaman` — bukan timer di JS.
 * 2. **Tata letak tidak melompat.** Tingginya diisi (`min-height`) supaya kaki
 *    halaman tidak naik-turun saat menunggu.
 *
 * Bunyinya juga diumumkan ke pembaca layar (`role="status"`), karena tanpa itu
 * pengguna pembaca layar hanya mendengar halaman kosong.
 */
export default function MemuatHalaman() {
  return (
    <div className="memuat-halaman" role="status" aria-live="polite">
      <span className="spinner-border text-primary" aria-hidden="true" />
      <span className="sr-saja">Memuat halaman…</span>
    </div>
  )
}
