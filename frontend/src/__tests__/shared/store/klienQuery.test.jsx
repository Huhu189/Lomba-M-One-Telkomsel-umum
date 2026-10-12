// @vitest-environment jsdom
/**
 * Bawaan klien query menentukan berapa banyak permintaan yang lahir tanpa
 * disengaja.
 *
 * Bawaan TanStack Query mengambilkan ulang SETIAP query yang sedang tampil
 * begitu jendela peramban kembali difokuskan. Di komputer yang dipakai
 * bergantian (jendela aplikasi, terminal, browser), satu perpindahan jendela
 * cukup untuk menembak seluruh daftar sekaligus — kelas, murid, kesehatan server
 * — sehingga log server tampak dibanjiri permintaan padahal tidak ada data yang
 * berubah.
 *
 * Data sesudah penyuntingan tetap segar karena tiap mutasi memanggil
 * `invalidateQueries`, sedangkan halaman yang memang butuh pembaruan berkala
 * memasang `refetchInterval` sendiri. Karena itu fokus jendela dimatikan.
 *
 * Ujinya membandingkan dua klien pada peristiwa yang sama: klien aplikasi dan
 * klien bawaan TanStack. Pembandingnya penting — tanpa itu, uji ini tetap
 * "lulus" kalau peristiwa fokusnya sendiri tidak sampai ke query mana pun.
 * Peristiwa fokus dipicu lewat `focusManager`, jalur yang sama dengan
 * `visibilitychange` di peramban.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider, focusManager, useQuery } from '@tanstack/react-query'
import { klienQuery } from '../../../shared/store/klienQuery.js'

/** @type {{ IS_REACT_ACT_ENVIRONMENT?: boolean }} */ (globalThis).IS_REACT_ACT_ENVIRONMENT = true

/** @param {number} ms */
const sleep = (ms) => new Promise((selesai) => setTimeout(selesai, ms))

/**
 * Komponen uji: satu query biasa, sama seperti halaman aplikasi.
 * @param {{ kunci: string, hitung: () => void }} props
 */
function Uji({ kunci, hitung }) {
  useQuery({
    queryKey: [kunci],
    queryFn: async () => {
      hitung()
      return 1
    },
    retry: false,
  })

  return <span>uji</span>
}

/**
 * Pasang komponen di atas sebuah klien, tunggu pengambilan pertama, lalu picu
 * "jendela difokuskan kembali" dan laporkan berapa kali query diambil.
 *
 * @param {QueryClient} klien
 * @param {string} kunci
 * @returns {Promise<number>}
 */
async function hitungSaatFokus(klien, kunci) {
  const wadah = document.createElement('div')
  document.body.appendChild(wadah)
  const root = createRoot(wadah)
  let jumlah = 0
  const hitung = () => {
    jumlah += 1
  }

  await act(async () => {
    root.render(
      <QueryClientProvider client={klien}>
        <Uji kunci={kunci} hitung={hitung} />
      </QueryClientProvider>,
    )
  })

  await vi.waitFor(() => {
    if (jumlah === 0) throw new Error('pengambilan pertama belum terjadi')
  })

  const sebelum = jumlah
  await act(async () => {
    focusManager.setFocused(false)
    focusManager.setFocused(true)
    await sleep(30)
  })

  const hasil = jumlah - sebelum

  await act(async () => root.unmount())
  wadah.remove()
  klien.removeQueries({ queryKey: [kunci] })

  return hasil
}

afterEach(() => {
  focusManager.setFocused(true)
})

describe('klienQuery', () => {
  it('fokus jendela tidak mengambilkan ulang; klien bawaan TanStack mengambilkan ulang', async () => {
    const bawaan = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    expect(await hitungSaatFokus(bawaan, 'uji-bawaan')).toBe(1)
    expect(await hitungSaatFokus(klienQuery, 'uji-aplikasi')).toBe(0)
  })

  it('tetap mencoba ulang sekali untuk galat sesaat', () => {
    expect(klienQuery.getDefaultOptions().queries?.retry).toBe(1)
  })
})
