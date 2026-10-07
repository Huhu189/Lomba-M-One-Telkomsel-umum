/**
 * Hook keadaan layar guru (slice 10): satu jalur data, dua pemakai.
 *
 * - **murid** menyambung ke kanal kuis lewat tiket sekali pakai; begitu ada
 *   pesan, keadaan diambil ulang (payload siaran tidak dipercaya sebagai sumber
 *   kebenaran — yang ditampilkan selalu hasil bacaan terakhir dari server);
 * - **guru** tidak menyambung SSE: ia yang mengubah, dan hasil simpan sudah
 *   dibalas server; permintaan berkala cukup untuk melihat perubahan dari
 *   perangkat/tab lain.
 *
 * Polling tetap jalan di kedua peran. Itulah yang membuat layar kelas tidak
 * pernah kosong saat service realtime mati.
 */
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { urlSse } from '../../shared/api/realtime.js'
import { ambilLayar, terbitkanTiketLayar } from './layar.js'

/** Selang polling saat SSE tidak tersedia (ms). */
export const POLLING_CEPAT = 5000

/** Selang polling saat SSE hidup — cukup sebagai jaring pengaman (ms). */
export const POLLING_LAMBAT = 20000

/**
 * @param {number} kuisId
 * @param {{ peran?: 'guru'|'murid', aktif?: boolean }} [opsi]
 */
export default function useLayar(kuisId, opsi = {}) {
  const peran = opsi.peran ?? 'murid'
  const boleh = opsi.aktif ?? true
  const [statusSse, setStatusSse] = useState(peran === 'murid' ? 'mencoba' : 'polling')

  const selang = statusSse === 'hidup' ? POLLING_LAMBAT : POLLING_CEPAT

  const kueri = useQuery({
    queryKey: ['layar', kuisId],
    queryFn: () => ambilLayar(kuisId),
    enabled: boleh && Number.isInteger(kuisId) && kuisId > 0,
    refetchInterval: selang,
  })

  const refetch = kueri.refetch

  useEffect(() => {
    if (peran !== 'murid' || !boleh || !Number.isInteger(kuisId) || kuisId <= 0) return undefined

    let batal = false
    /** @type {EventSource|null} */
    let sumber = null

    async function sambung() {
      try {
        const tiket = await terbitkanTiketLayar(kuisId)
        if (batal) return

        sumber = new EventSource(urlSse('kuis', tiket.tiket))

        sumber.onopen = () => setStatusSse('hidup')
        sumber.onmessage = () => {
          void refetch()
        }
        sumber.onerror = () => {
          // Fail-open: tanpa SSE, polling sudah menutupi.
          setStatusSse('polling')
          sumber?.close()
          sumber = null
        }
      } catch {
        setStatusSse('polling')
      }
    }

    void sambung()

    return () => {
      batal = true
      sumber?.close()
      sumber = null
    }
    // `refetch` stabil (react-query), jadi menyambung ulang hanya terjadi saat
    // kuis berganti — bukan pada setiap pembaruan data.
  }, [kuisId, peran, boleh, refetch])

  return { ...kueri, statusSse }
}
