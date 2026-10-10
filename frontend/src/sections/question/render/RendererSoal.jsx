/**
 * Pemilih renderer berdasarkan tipe soal (cermin RegistryTipeSoal backend).
 * Tipe yang belum didukung tetap ditampilkan sebagai keterangan, bukan crash.
 */
import { TIPE } from '../tipeSoal.js'
import SoalBenarSalah from './SoalBenarSalah.jsx'
import SoalBenarSalahMajemuk from './SoalBenarSalahMajemuk.jsx'
import SoalHubungKata from './SoalHubungKata.jsx'
import SoalIsianAngka from './SoalIsianAngka.jsx'
import SoalIsianSingkat from './SoalIsianSingkat.jsx'
import SoalLetakKata from './SoalLetakKata.jsx'
import SoalMenjodohkan from './SoalMenjodohkan.jsx'
import SoalMengurutkan from './SoalMengurutkan.jsx'
import SoalPilihanGambar from './SoalPilihanGambar.jsx'
import SoalPilihanGanda from './SoalPilihanGanda.jsx'
import SoalPilihanGandaKompleks from './SoalPilihanGandaKompleks.jsx'
import SoalSusunHuruf from './SoalSusunHuruf.jsx'
import SoalUraian from './SoalUraian.jsx'
import SoalUrutGambar from './SoalUrutGambar.jsx'

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
  [TIPE.pilihanGandaKompleks]: SoalPilihanGandaKompleks,
  [TIPE.benarSalahMajemuk]: SoalBenarSalahMajemuk,
  [TIPE.isianAngka]: SoalIsianAngka,
  [TIPE.pilihanGambar]: SoalPilihanGambar,
  [TIPE.urutGambar]: SoalUrutGambar,
  [TIPE.susunHuruf]: SoalSusunHuruf,
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
