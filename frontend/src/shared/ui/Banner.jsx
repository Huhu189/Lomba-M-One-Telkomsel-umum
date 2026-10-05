/**
 * Banner status inline: selalu ikon + teks (tidak hanya warna).
 * 'salah' memakai role=alert, lainnya role=status (dibacakan pembaca layar).
 */
import { IkonCentang, IkonInfo, IkonPeringatan, IkonSilang } from '../../icons.jsx'

const peta = {
  salah: { kelas: 'banner-salah', Ikon: IkonSilang, role: 'alert' },
  sukses: { kelas: 'banner-sukses', Ikon: IkonCentang, role: 'status' },
  peringatan: { kelas: 'banner-peringatan', Ikon: IkonPeringatan, role: 'status' },
  info: { kelas: '', Ikon: IkonInfo, role: 'status' },
}

/**
 * @param {{
 *   jenis?: 'salah'|'sukses'|'peringatan'|'info',
 *   judul?: string,
 *   children?: import('react').ReactNode,
 * }} props
 */
export default function Banner({ jenis = 'info', judul = '', children }) {
  const { kelas, Ikon, role } = peta[jenis]
  return (
    <div className={`banner ${kelas}`.trim()} role={role}>
      <Ikon size={22} />
      <div>
        {judul && <strong className="banner-judul">{judul}</strong>}
        {children}
      </div>
    </div>
  )
}
