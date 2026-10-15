/**
 * **Satu tombol** untuk setelan ulangan (14 Oktober 2026).
 *
 * Sebelum ini setelan satu kuis digelar langsung di halaman detail kuis: satu
 * bagian panjang berisi belasan saklar, tombol massal per kelompok, dan kotak
 * angka — semuanya terlihat sekaligus walau guru sedang mencari satu hal saja.
 * Sekarang halaman hanya memuat **satu tombol** ("Setelan ulangan") berikut
 * ringkasan angka aktifnya; isinya terbuka di panel samping yang terstruktur
 * per kelompok.
 *
 * Ringkasan di tombol sengaja memakai `ringkasSetelan()` yang sama dengan
 * bagian "Tinjau" di editor kuis, jadi angka yang dibaca guru di dua tempat itu
 * tidak mungkin berbeda. Permintaannya satu query dengan key yang sama seperti
 * panelnya (`['pengaturan', kuisId]`), jadi membuka panel tidak menembak server
 * dua kali.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ambilPengaturan } from '../../settings/api.js'
import { ringkasSetelan } from './setelanSesi.js'
import { IkonGear } from '../../../icons.jsx'
import PanelForm from '../../../shared/ui/PanelForm.jsx'
import { Tombol } from '../../../shared/ui/Tombol.jsx'
import PanelSetelanUlangan from './PanelSetelanUlangan.jsx'

/**
 * @param {{
 *   kuisId: number,
 *   varian?: 'utama'|'tepi'|'bahaya'|'teks',
 *   ukuran?: 'sedang'|'besar',
 *   className?: string,
 * }} props
 */
export default function SetelanUlangan({ kuisId, varian = 'tepi', ukuran = 'sedang', className = '' }) {
  const [buka, setBuka] = useState(false)

  const resolusi = useQuery({
    queryKey: ['pengaturan', kuisId],
    queryFn: () => ambilPengaturan(null, kuisId),
    enabled: Number.isInteger(kuisId) && kuisId > 0,
    // Ringkasannya hanya untuk tombol; nilai yang sedang tampil di panel harus
    // tetap segar saat dibuka, jadi cache-nya pendek.
    staleTime: 15_000,
  })

  const ringkas = ringkasSetelan(resolusi.data)
  const saklar = ringkas.aturan.length + 2
  const nyala = (ringkas.indukAktif ? 1 : 0) + (ringkas.tamu.aktif ? 1 : 0) + ringkas.aturan.filter((satu) => satu.aktif).length

  return (
    <>
      <Tombol
        varian={varian}
        ukuran={ukuran}
        ikon={IkonGear}
        className={className}
        aria-haspopup="dialog"
        onClick={() => setBuka(true)}
      >
        <span className="d-inline-flex align-items-center gap-2">
          Setelan ulangan
          {resolusi.isSuccess && (
            <span className="badge-status lembut">
              {nyala}/{saklar} aktif
            </span>
          )}
        </span>
      </Tombol>

      <PanelForm
        buka={buka}
        judul="Setelan ulangan"
        labelTutup="Tutup setelan ulangan"
        onTutup={() => setBuka(false)}
      >
        <p className="teks-lembut small">
          Atur cara kuis ini dikerjakan. Perubahan tersimpan otomatis. Setelan yang dikunci sekolah
          tidak bisa diubah.
        </p>

        {buka && <PanelSetelanUlangan kuisId={kuisId} />}
      </PanelForm>
    </>
  )
}
