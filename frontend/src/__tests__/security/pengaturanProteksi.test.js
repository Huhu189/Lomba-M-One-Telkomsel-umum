import { describe, expect, it } from 'vitest'
import {
  adaProteksiAktif,
  bacaProteksi,
  proteksiEfektif,
  SAKLAR_PRESET_UJIAN,
  SAKLAR_RINCI,
} from '../../security/pengaturanProteksi.js'

describe('pembacaan saklar proteksi', () => {
  it('payload kosong atau bukan objek dianggap semua mati', () => {
    expect(bacaProteksi(undefined)).toMatchObject({ anti_cheat: false, exam_mode: false })
    expect(bacaProteksi([])).toMatchObject({ anti_cheat: false })
    expect(bacaProteksi('aneh')).toMatchObject({ anti_cheat: false })
    expect(adaProteksiAktif(undefined)).toBe(false)
  })

  it('nilai yang salah tipe tidak pernah menyalakan proteksi', () => {
    const proteksi = bacaProteksi({ anti_cheat: 'ya', block_paste: 1 })

    expect(proteksi.anti_cheat).toBe(false)
    expect(proteksi.block_paste).toBe(false)
  })

  it('saklar induk mati berarti semuanya mati walau saklar rinci menyala', () => {
    const mentah = { anti_cheat: false, block_paste: true, block_tab_switch: true }

    const efektif = proteksiEfektif(mentah)

    expect(efektif.block_paste).toBe(true)
    // Tanpa saklar induk, tidak ada proteksi yang benar-benar dipasang.
    expect(adaProteksiAktif(mentah)).toBe(false)
  })

  it('preset exam_mode menyalakan kelompoknya tanpa mematikan saklar lain', () => {
    const efektif = proteksiEfektif({ anti_cheat: true, exam_mode: true })

    for (const saklar of SAKLAR_PRESET_UJIAN) {
      expect(efektif[saklar]).toBe(true)
    }

    // Saklar yang bukan bagian preset tetap mati.
    expect(efektif.block_translate).toBe(false)
    expect(efektif.block_screenshot).toBe(false)
    expect(adaProteksiAktif({ anti_cheat: true, exam_mode: true })).toBe(true)
  })

  it('adaProteksiAktif hanya benar bila induk dan minimal satu saklar rinci menyala', () => {
    expect(adaProteksiAktif({ anti_cheat: true })).toBe(false)
    expect(adaProteksiAktif({ anti_cheat: true, detect_window_resize: true })).toBe(true)
    expect(SAKLAR_RINCI).toContain('detect_window_resize')
  })
})
