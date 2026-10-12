/**
 * Penyorotan kata kunci pencarian murid.
 *
 * Yang dijaga: pencocokan tidak peduli huruf besar/kecil, kata kunci kosong
 * tidak menyorot apa pun, dan metakarakter regex (mis. `%`) diperlakukan sebagai
 * huruf biasa — kalau tidak, kata kunci yang diketik guru bisa membuat pola
 * regex yang salah dan menyorot bagian yang keliru.
 */
import { describe, expect, it } from 'vitest'
import { potongUntukSorot } from '../../../sections/school/penyorotan.js'

describe('potongUntukSorot', () => {
  it('memecah teks jadi bagian yang cocok dan tidak cocok', () => {
    expect(potongUntukSorot('Rina Aulia', 'rina')).toEqual([
      { teks: 'Rina', cocok: true },
      { teks: ' Aulia', cocok: false },
    ])
  })

  it('tidak peduli huruf besar/kecil', () => {
    const bagian = potongUntukSorot('rina', 'RINA')

    expect(bagian).toEqual([{ teks: 'rina', cocok: true }])
  })

  it('kata kunci kosong berarti tidak ada sorotan', () => {
    expect(potongUntukSorot('Rina Aulia', '   ')).toEqual([{ teks: 'Rina Aulia', cocok: false }])
    expect(potongUntukSorot('Rina Aulia', '')).toEqual([{ teks: 'Rina Aulia', cocok: false }])
  })

  it('metakarakter regex diperlakukan sebagai huruf biasa', () => {
    const bagian = potongUntukSorot('Nilai 100% tercapai', '100%')

    expect(bagian).toEqual([
      { teks: 'Nilai ', cocok: false },
      { teks: '100%', cocok: true },
      { teks: ' tercapai', cocok: false },
    ])
  })

  it('menyorot semua kemunculan kata kunci', () => {
    const cocok = potongUntukSorot('ana dan ana', 'ana').filter((satu) => satu.cocok)

    expect(cocok).toHaveLength(2)
  })
})
