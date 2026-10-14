/**
 * Kartu ingat (flashcard) sesudah kuis sisipan.
 *
 * Murid membaca pertanyaan, membalik kartu, lalu menilai diri: "Sudah ingat"
 * atau "Belum ingat". Kartu yang tadi salah muncul lebih dulu (lihat
 * `urutKartu`). Di akhir ada rekap dan tombol mengulang yang belum ingat.
 *
 * Penilaian diri dipegang induk (`penilaian`) supaya berpindah ke tab ringkasan
 * dan kembali tidak menghapus kemajuan. Kartu bisa dibalik dengan klik, Enter,
 * atau Spasi (elemen <button> asli); animasi balik dimatikan oleh
 * `prefers-reduced-motion` di CSS.
 */
import { useMemo, useState } from 'react'
import { Tombol } from '../../shared/ui/Tombol.jsx'
import { IkonCentang, IkonMuatUlang, IkonSilang } from '../../icons.jsx'
import { kartuUlang, rekapKartu, urutKartu } from './ringkasanKuis.js'

/**
 * @param {{
 *   kartu: import('./ringkasanKuis.js').KartuIngat[],
 *   penilaian: Record<number, 'ingat'|'belum'>,
 *   onNilai: (idSoal: number, nilai: 'ingat'|'belum') => void,
 *   onUlang: (idSoal: number[]|null) => void, // null = hapus semua penilaian
 *   awalId?: number|null,
 *   onLihatRingkasan?: (idSoal: number) => void,
 * }} props
 */
export default function KartuIngat({ kartu, penilaian, onNilai, onUlang, awalId = null, onLihatRingkasan }) {
  const semua = useMemo(() => urutKartu(kartu), [kartu])
  // Putaran: semua kartu di awal, lalu hanya yang "belum ingat" saat mengulang.
  const [putaran, setPutaran] = useState(semua)
  const [indeks, setIndeks] = useState(() => {
    const posisi = awalId === null ? -1 : semua.findIndex((satu) => satu.question_id === awalId)
    return posisi < 0 ? 0 : posisi
  })
  const [terbalik, setTerbalik] = useState(false)

  if (semua.length === 0) {
    return <p className="small teks-lembut mb-0">Belum ada kartu untuk kuis ini.</p>
  }

  const rekap = rekapKartu(putaran, penilaian)
  const saatIni = putaran[indeks]
  const perluUlang = kartuUlang(semua, penilaian)

  /** @param {'ingat'|'belum'} nilaiBaru */
  function nilai(nilaiBaru) {
    if (!saatIni) return
    onNilai(saatIni.question_id, nilaiBaru)
    setTerbalik(false)
    setIndeks((sebelum) => Math.min(sebelum + 1, putaran.length))
  }

  function ulangiYangBelum() {
    onUlang(perluUlang.map((satu) => satu.question_id))
    setPutaran(perluUlang)
    setIndeks(0)
    setTerbalik(false)
  }

  // Semua kartu putaran ini sudah dinilai → layar rekap.
  if (indeks >= putaran.length) {
    const semuaIngat = perluUlang.length === 0

    return (
      <div className="ks-kartu-rekap" role="status">
        <p className="ks-kartu-rekap-judul">{semuaIngat ? 'Semua kartu sudah kamu ingat!' : 'Putaran selesai'}</p>
        <p className="small teks-lembut mb-3">
          {kartu.length - perluUlang.length} dari {kartu.length} kartu sudah diingat
          {semuaIngat ? '.' : `, ${perluUlang.length} kartu perlu diulang.`}
        </p>
        <div className="d-flex flex-wrap gap-2 justify-content-center">
          {!semuaIngat && (
            <Tombol onClick={ulangiYangBelum}>
              <IkonMuatUlang size={18} /> Ulangi {perluUlang.length} kartu
            </Tombol>
          )}
          <Tombol
            varian="tepi"
            onClick={() => {
              onUlang(null)
              setPutaran(semua)
              setIndeks(0)
              setTerbalik(false)
            }}
          >
            Mulai dari awal
          </Tombol>
        </div>
      </div>
    )
  }

  const sudahDinilai = penilaian[saatIni.question_id]

  return (
    <div className="ks-kartu-wadah">
      <div className="ks-kartu-atas">
        <span className="small fw-semibold">
          Kartu {indeks + 1} dari {putaran.length}
        </span>
        <span className="small teks-lembut" aria-live="polite">
          {rekap.ingat} ingat · {rekap.belum} belum
        </span>
      </div>
      <div
        className="progress ks-kartu-bar"
        role="progressbar"
        aria-label="Kemajuan kartu"
        aria-valuemin={0}
        aria-valuemax={putaran.length}
        aria-valuenow={indeks}
      >
        <div className="progress-bar" style={{ width: `${(indeks / putaran.length) * 100}%` }} />
      </div>

      <button
        type="button"
        className={`ks-kartu${terbalik ? ' terbalik' : ''}`}
        aria-pressed={terbalik}
        aria-label={terbalik ? 'Kartu menunjukkan jawaban. Tekan untuk melihat pertanyaan.' : 'Tekan untuk melihat jawaban.'}
        onClick={() => setTerbalik((sebelum) => !sebelum)}
      >
        {saatIni.benar === false && !terbalik && <span className="ks-kartu-tanda">Tadi belum tepat</span>}
        <span className="ks-kartu-label">{terbalik ? 'Jawaban' : `Soal ${saatIni.nomor}`}</span>
        {!terbalik && <span className="ks-kartu-isi">{saatIni.depan}</span>}
        {terbalik && (
          <>
            {saatIni.belakang !== null && <span className="ks-kartu-isi ks-kartu-jawab">{saatIni.belakang}</span>}
            {saatIni.catatan !== null && <span className="ks-kartu-catatan">{saatIni.catatan}</span>}
          </>
        )}
        <span className="ks-kartu-petunjuk">{terbalik ? 'Tekan untuk kembali ke soal' : 'Tekan untuk membalik'}</span>
      </button>

      {terbalik ? (
        <div className="ks-kartu-nilai">
          <Tombol varian="tepi" onClick={() => nilai('belum')}>
            <IkonSilang size={18} /> Belum ingat
          </Tombol>
          <Tombol onClick={() => nilai('ingat')}>
            <IkonCentang size={18} /> Sudah ingat
          </Tombol>
        </div>
      ) : (
        <p className="small teks-lembut text-center mb-0">
          Coba jawab dulu dalam hati, lalu balik kartunya.
          {sudahDinilai ? ` (Penilaian sebelumnya: ${sudahDinilai === 'ingat' ? 'ingat' : 'belum ingat'}.)` : ''}
        </p>
      )}

      {onLihatRingkasan && (
        <div className="text-center mt-2">
          <button type="button" className="btn btn-teks btn-sedang" onClick={() => onLihatRingkasan(saatIni.question_id)}>
            Lihat soal ini di ringkasan
          </button>
        </div>
      )}
    </div>
  )
}
