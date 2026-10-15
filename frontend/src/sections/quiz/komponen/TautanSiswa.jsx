/**
 * Tautan siswa satu kuis: tombolnya, kotaknya, dan catatannya — satu komponen.
 *
 * Kenapa dipisah (14 Oktober 2026): guru mengeluh harus **menggulir jauh** hanya
 * untuk mendapat tautan yang mau dibagikan ke grup kelas. Tautan itu dulu hanya
 * ada di langkah 3 (tinjau & publikasikan), padahal halaman susun kuis memang
 * panjang. Sekarang komponen ini dipakai di **dua tempat**: bar aksi lengket di
 * atas (selalu terjangkau dari posisi gulir mana pun) dan langkah publikasi
 * (tempat guru memang sedang meninjau). Satu penerapan, jadi perilakunya tidak
 * bisa berbeda antara keduanya.
 *
 * Tautannya sendiri dihitung `tautanSiswa()` di `setelanSesi.js` — alamat slug
 * kuis di dalam aplikasi, yang bekerja untuk murid berakun maupun siswa tamu.
 * Yang penting di UI:
 *
 * - **Belum ada slug = belum ada tautan.** Kuis yang belum pernah disimpan belum
 *   punya alamat, jadi tombolnya dimatikan dengan alasan yang jelas — bukan
 *   tombol yang ditekan lalu diam.
 * - **Salin yang gagal harus dikatakan.** Peramban tanpa izin klip papan (atau
 *   konteks non-HTTPS) tidak boleh membuat guru merasa sudah menyalin padahal
 *   tidak; kotaknya tetap terbuka supaya tautannya bisa disalin manual.
 * - **Catatan dihitung, bukan ditulis ulang.** "Masih draf" dan "siswa tamu
 *   boleh ikut" berasal dari `catatanTautan()` supaya kalimatnya sama dengan
 *   yang diuji.
 */
import { useState } from 'react'
import { catatanTautan, tautanSiswa } from '../setelan/setelanSesi.js'
import { IkonTautan } from '../../../icons.jsx'
import { Tombol } from '../../../shared/ui/Tombol.jsx'
import { tampilkanToast } from '../../../shared/ui/toast.jsx'

/**
 * @param {{
 *   slug: string,
 *   status?: string,
 *   tamuAktif?: boolean,
 *   ukuran?: 'sedang'|'besar',
 *   label?: string,
 *   kelas?: string,
 * }} props
 *
 * `tamuAktif` opsional karena tidak semua halaman tahu setelan tamu kuis itu
 * (detail kuis tidak memuatnya); bila tidak diketahui, catatannya cukup soal draf.
 */
export default function TautanSiswa({
  slug,
  status = 'draf',
  tamuAktif = false,
  ukuran = 'sedang',
  label = 'Tautan siswa',
  kelas = '',
}) {
  const [tampil, setTampil] = useState(false)

  const tautan =
    typeof window === 'undefined' ? '' : tautanSiswa(slug, window.location.origin)
  const catatan = catatanTautan({ status, tamuAktif })

  /** Salin tautan siswa; bila peramban menolak, katakan apa adanya — jangan diam. */
  async function salin() {
    try {
      if (typeof navigator.clipboard?.writeText !== 'function') throw new Error('tanpa klip papan')
      await navigator.clipboard.writeText(tautan)
      tampilkanToast('sukses', 'Tautan siswa disalin.')
    } catch {
      tampilkanToast('info', 'Peramban ini tidak mengizinkan salin otomatis. Salin tautannya dari kotak di bawah.')
    }
  }

  const belumAdaTautan = tautan === ''

  return (
    <div className={`tautan-siswa ${kelas}`.trim()}>
      <Tombol
        varian="tepi"
        ukuran={ukuran}
        ikon={IkonTautan}
        disabled={belumAdaTautan}
        aria-expanded={tampil}
        title={belumAdaTautan ? 'Simpan draf dulu supaya kuisnya punya alamat.' : undefined}
        onClick={() => setTampil((sebelumnya) => !sebelumnya)}
      >
        {label}
      </Tombol>

      {belumAdaTautan ? (
        <p className="teks-lembut small mb-0">
          Simpan draf dulu — tautannya baru ada setelah kuis ini punya alamat.
        </p>
      ) : (
        tampil && (
          <div className="tautan-siswa-kotak">
            <input
              className="form-control form-control-sm"
              readOnly
              value={tautan}
              aria-label="Tautan untuk siswa"
              onFocus={(e) => e.target.select()}
            />
            <Tombol ukuran={ukuran} onClick={() => void salin()}>
              Salin
            </Tombol>

            {catatan.map((satu) => (
              <p key={satu} className="teks-lembut small mb-0 w-100">
                {satu}
              </p>
            ))}
            <p className="teks-lembut small mb-0 w-100">
              Tautan ini bekerja untuk murid berakun (lalu “Kerjakan sekarang”) dan untuk siswa
              tamu bila pintunya dibuka di setelan ulangan.
            </p>
          </div>
        )
      )}
    </div>
  )
}
