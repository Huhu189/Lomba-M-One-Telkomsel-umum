/**
 * Pemilih renderer berdasarkan tipe soal (cermin RegistryTipeSoal backend).
 * Tipe yang belum didukung tetap ditampilkan sebagai keterangan, bukan crash.
 */
import { TIPE } from '../tipeSoal.js'
import SoalBenarSalah from './SoalBenarSalah.jsx'
import SoalHubungKata from './SoalHubungKata.jsx'
import SoalIsianSingkat from './SoalIsianSingkat.jsx'
import SoalLetakKata from './SoalLetakKata.jsx'
import SoalMenjodohkan from './SoalMenjodohkan.jsx'
import SoalMengurutkan from './SoalMengurutkan.jsx'
import SoalPilihanGanda from './SoalPilihanGanda.jsx'
import SoalUraian from './SoalUraian.jsx'

/** @type {Record<string, import('react').ComponentType<import('./props.js').PropsSoal>>} */
const PETA_RENDERER = {
  [TIPE.pilihanGanda]: SoalPilihanGanda,
  [TIPE.benarSalah]: SoalBenarSalah,
  [TIPE.menjodohkan]: SoalMenjodohkan,
  [TIPE.mengurutkan]: SoalMengurutkan,
  [TIPE.letakKata]: SoalLetakKata,
  [TIPE.hubungKata]: SoalHubungKata,
  [TIPE.isianSingkat]: SoalIsianSingkat,
  [TIPE.uraian]: SoalUraian,
}

/** @param {import('./props.js').PropsSoal & { tipe: string }} props */
export default function RendererSoal({ tipe, ...sisa }) {
  const Komponen = PETA_RENDERER[tipe]

  if (Komponen === undefined) {
    return (
      <p className="status-salah small mb-0">
        Tipe soal “{tipe}” belum didukung di layar ini.
      </p>
    )
  }

  return <Komponen {...sisa} />
}
