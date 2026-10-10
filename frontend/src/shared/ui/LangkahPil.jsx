/**
 * Pil langkah untuk alur bersusun (papan 10: susun kuis tiga langkah).
 *
 * Beda dengan `Langkah.jsx` (penunjuk tahapan statis seperti "daftar → cek
 * email → aktif"), komponen ini adalah navigasi: tiap langkah adalah tombol
 * asli, jadi bisa diklik maupun dicapai dengan Tab + Enter tanpa kode tambahan.
 * Langkah aktif ditandai `aria-current="step"`, bukan hanya warna.
 *
 * @param {{
 *   langkah: string[],
 *   aktif: number,
 *   onPilih: (indeks: number) => void,
 *   label?: string,
 * }} props aktif = indeks (0-based) langkah yang sedang dibuka
 */
export default function LangkahPil({ langkah, aktif, onPilih, label = 'Langkah' }) {
  return (
    <nav aria-label={label} className="d-flex flex-wrap gap-2">
      {langkah.map((nama, i) => (
        <button
          key={nama}
          type="button"
          className="pil-langkah"
          aria-current={i === aktif ? 'step' : undefined}
          onClick={() => onPilih(i)}
        >
          <span className="no">{i + 1}</span>
          {nama}
          {i === aktif && <span className="sr-saja"> (sedang dibuka)</span>}
        </button>
      ))}
    </nav>
  )
}
