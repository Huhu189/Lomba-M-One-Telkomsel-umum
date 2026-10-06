import { describe, expect, it } from 'vitest'
import { skemaLaporanImpor, skemaResponsImpor } from '../../../sections/school/api.js'
import { ringkasLaporanImpor } from '../../../sections/school/validasi.js'

/** @type {import('../../../sections/school/api.js').LaporanImpor} */
const laporanValid = {
  total: 3,
  sukses: 1,
  gagal: 2,
  dihentikan: false,
  batas_galat: 100,
  galat: [
    { baris: 3, pesan: 'Format email tidak valid.' },
    { baris: 4, pesan: 'Kelas "9Z" tidak ditemukan.' },
  ],
}

describe('skema laporan impor', () => {
  it('memvalidasi bentuk laporan dari server', () => {
    const laporan = skemaLaporanImpor.parse(laporanValid)
    expect(laporan.galat).toHaveLength(2)
  })

  it('menolak laporan dengan tipe salah', () => {
    expect(() => skemaLaporanImpor.parse({ ...laporanValid, sukses: 'satu' })).toThrow()
  })

  it('memvalidasi respons impor lengkap', () => {
    const respons = skemaResponsImpor.parse({ message: 'ok', laporan: laporanValid })
    expect(respons.laporan.total).toBe(3)
  })
})

describe('ringkasLaporanImpor', () => {
  it('menghasilkan ringkasan dan galat per baris', () => {
    const { ringkasan, galat } = ringkasLaporanImpor(skemaLaporanImpor.parse(laporanValid))

    expect(ringkasan).toContain('1 baris berhasil')
    expect(ringkasan).toContain('2 baris gagal')
    expect(galat.map((item) => item.baris)).toEqual([3, 4])
    expect(galat[1].pesan).toContain('9Z')
  })

  it('menandai laporan yang dihentikan karena batas galat', () => {
    const { ringkasan } = ringkasLaporanImpor(
      skemaLaporanImpor.parse({ ...laporanValid, gagal: 100, dihentikan: true }),
    )
    expect(ringkasan).toContain('dihentikan setelah 100 galat')
  })
})
