/**
 * Pemilih renderer berdasarkan tipe soal (cermin RegistryTipeSoal backend).
 * Tipe yang belum didukung tetap ditampilkan sebagai keterangan, bukan crash.
 */
import { TIPE } from '../tipeSoal.js'
import SoalBacaJam from './SoalBacaJam.jsx'
import SoalBenarSalah from './SoalBenarSalah.jsx'
import SoalBenarSalahMajemuk from './SoalBenarSalahMajemuk.jsx'
import SoalGarisBilangan from './SoalGarisBilangan.jsx'
import SoalHotspotGambar from './SoalHotspotGambar.jsx'
import SoalHubungKata from './SoalHubungKata.jsx'
import SoalIsianAngka from './SoalIsianAngka.jsx'
import SoalIsianRumpang from './SoalIsianRumpang.jsx'
import SoalIsianSingkat from './SoalIsianSingkat.jsx'
import SoalKlasifikasi from './SoalKlasifikasi.jsx'
import SoalLetakKata from './SoalLetakKata.jsx'
import SoalMenjodohkan from './SoalMenjodohkan.jsx'
import SoalMengurutkan from './SoalMengurutkan.jsx'
import SoalPilihanGambar from './SoalPilihanGambar.jsx'
import SoalPilihanGanda from './SoalPilihanGanda.jsx'
import SoalPilihanGandaKompleks from './SoalPilihanGandaKompleks.jsx'
import SoalSusunHuruf from './SoalSusunHuruf.jsx'
import SoalTabelIsian from './SoalTabelIsian.jsx'
import SoalTekaSilangMini from './SoalTekaSilangMini.jsx'
import SoalTugasUnggah from './SoalTugasUnggah.jsx'
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
  [TIPE.isianRumpang]: SoalIsianRumpang,
  [TIPE.klasifikasi]: SoalKlasifikasi,
  [TIPE.tabelIsian]: SoalTabelIsian,
  [TIPE.garisBilangan]: SoalGarisBilangan,
  [TIPE.hotspotGambar]: SoalHotspotGambar,
  [TIPE.bacaJam]: SoalBacaJam,
  [TIPE.tugasUnggah]: SoalTugasUnggah,
  [TIPE.tekaSilangMini]: SoalTekaSilangMini,
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
