import { describe, expect, it } from 'vitest'
import {
  BATAS_PERCOBAAN_AUTO,
  harusMandek,
  jedaAutoMs,
  JEDA_AUTO_MAKS,
  JEDA_AUTO_MIN,
} from '../../../sections/attempt/kebijakanKumpulAuto.js'

describe('jedaAutoMs', () => {
  it('berlipat dua tiap percobaan', () => {
    expect(jedaAutoMs(0)).toBe(JEDA_AUTO_MIN)
    expect(jedaAutoMs(1)).toBe(JEDA_AUTO_MIN * 2)
    expect(jedaAutoMs(2)).toBe(JEDA_AUTO_MIN * 4)
  })

  it('tidak pernah melewati jeda maksimum', () => {
    expect(jedaAutoMs(3)).toBe(JEDA_AUTO_MIN * 8)
    expect(jedaAutoMs(10)).toBe(JEDA_AUTO_MAKS)
    expect(jedaAutoMs(99)).toBe(JEDA_AUTO_MAKS)
  })

  it('tahan masukan aneh', () => {
    expect(jedaAutoMs(-5)).toBe(JEDA_AUTO_MIN)
    expect(jedaAutoMs(1.9)).toBe(JEDA_AUTO_MIN * 2)
  })
})

describe('harusMandek', () => {
  // Q-04: tanpa berhenti, efek auto-submit mengulang tanpa henti saat gagal.
  it('berhenti saat percobaan habis', () => {
    expect(harusMandek({ percobaan: BATAS_PERCOBAAN_AUTO - 1 })).toBe(false)
    expect(harusMandek({ percobaan: BATAS_PERCOBAAN_AUTO })).toBe(true)
    expect(harusMandek({ percobaan: BATAS_PERCOBAAN_AUTO + 10 })).toBe(true)
  })

  it('berhenti seketika pada penolakan permanen (4xx)', () => {
    expect(harusMandek({ percobaan: 1, permanen: true })).toBe(true)
  })

  it('terus mencoba pada kegagalan jaringan yang masih ada harapan', () => {
    expect(harusMandek({ percobaan: 1, permanen: false })).toBe(false)
  })

  it('tidak pernah mandek bila berhasil', () => {
    expect(harusMandek({ percobaan: BATAS_PERCOBAAN_AUTO + 1, berhasil: true })).toBe(false)
  })
})
