/**
 * Tes deteksi keadaan jaringan luring.
 *
 * Yang dijaga: keputusan "simpan lokal dulu" vs "kirim ke server" tidak boleh
 * bergantung pada `navigator.onLine` saja — wifi yang masih tersambung tetapi
 * gerbangnya mati harus tetap terbaca sebagai luring dari kegagalan kirim.
 */
import { describe, expect, it } from 'vitest'
import {
  DARING,
  JENDELA_GAGAL_MS,
  LURING,
  keadaanJaringan,
  layakKirim,
  sadarDaring,
  sadarGagal,
  sadarPulih,
  statusJaringan,
  tundaKirimMs,
} from '../../../sections/attempt/luring.js'

/** Jam acuan uji (ms). */
const T0 = 1_000_000

describe('statusJaringan', () => {
  it('luring saat navigator bilang putus', () => {
    expect(statusJaringan(keadaanJaringan(false), T0)).toBe(LURING)
  })

  it('daring saat tidak ada kabar buruk', () => {
    expect(statusJaringan(keadaanJaringan(true), T0)).toBe(DARING)
  })

  it('luring selama jendela kegagalan walau navigator bilang daring', () => {
    const keadaan = sadarGagal(keadaanJaringan(true), T0)

    expect(statusJaringan(keadaan, T0)).toBe(LURING)
    expect(statusJaringan(keadaan, T0 + 3000)).toBe(LURING)
    // Tepat di ujung jendela masih luring; satu ms setelahnya sudah daring lagi.
    expect(statusJaringan(keadaan, T0 + JENDELA_GAGAL_MS)).toBe(LURING)
    expect(statusJaringan(keadaan, T0 + JENDELA_GAGAL_MS + 1)).toBe(DARING)
  })

  it('satu permintaan berhasil menutup jendela kegagalan', () => {
    const gagal = sadarGagal(keadaanJaringan(true), T0)
    const pulih = sadarPulih(gagal)

    expect(statusJaringan(pulih, T0)).toBe(DARING)
  })

  it('event online/offline mengubah kabar navigator tanpa menyentuh jendela', () => {
    const turun = sadarDaring(keadaanJaringan(true), false)

    expect(turun.online).toBe(false)
    expect(statusJaringan(turun, T0)).toBe(LURING)
    expect(sadarDaring(turun, true).online).toBe(true)
  })

  it('layakKirim sejalan dengan statusJaringan', () => {
    const keadaan = sadarGagal(keadaanJaringan(true), T0)

    expect(layakKirim(keadaan, T0)).toBe(false)
    expect(layakKirim(keadaan, T0 + JENDELA_GAGAL_MS + 1)).toBe(true)
  })
})

describe('tundaKirimMs', () => {
  it('0 saat jaringan siap', () => {
    expect(tundaKirimMs(keadaanJaringan(true), T0)).toBe(0)
  })

  it('sisa jendela kegagalan saat kirim gagal', () => {
    const keadaan = sadarGagal(keadaanJaringan(true), T0)

    expect(tundaKirimMs(keadaan, T0 + 4000)).toBe(JENDELA_GAGAL_MS - 4000)
  })

  it('tak terhingga saat navigator bilang putus — tunggu event online, bukan timer', () => {
    expect(tundaKirimMs(keadaanJaringan(false), T0)).toBe(Number.POSITIVE_INFINITY)
  })
})
