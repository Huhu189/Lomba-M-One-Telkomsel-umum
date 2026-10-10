import { describe, expect, it } from 'vitest'
import {
  formatDetikTerakhir,
  ringkasMonitor,
} from '../../../sections/cheat/ringkasMonitor.js'

describe('ringkasMonitor', () => {
  it('memisahkan mengerjakan, selesai, dan tidak aktif', () => {
    const angka = ringkasMonitor([
      { status: 'berjalan', online: true, kecurangan: { belum_ditinjau: 1 } },
      { status: 'berjalan', online: true, kecurangan: { belum_ditinjau: 0 } },
      { status: 'berjalan', online: false, kecurangan: { belum_ditinjau: 2 } },
      { status: 'dikumpulkan', online: false, kecurangan: { belum_ditinjau: 0 } },
    ])

    expect(angka).toEqual([
      { label: 'Mengerjakan', nilai: '2' },
      { label: 'Selesai', nilai: '1' },
      { label: 'Tidak aktif', nilai: '1' },
      { label: 'Perlu ditinjau', nilai: '3' },
    ])
  })

  it('aman saat daftar kosong dan saat ringkasan kecurangan tidak ada', () => {
    expect(ringkasMonitor([]).map((satu) => satu.nilai)).toEqual(['0', '0', '0', '0'])
    expect(
      ringkasMonitor([{ status: 'berjalan', online: true }]).map((satu) => satu.nilai),
    ).toEqual(['1', '0', '0', '0'])
  })
})

describe('formatDetikTerakhir', () => {
  it('memakai satuan yang sesuai', () => {
    expect(formatDetikTerakhir(2)).toBe('baru saja')
    expect(formatDetikTerakhir(12)).toBe('12 dtk lalu')
    expect(formatDetikTerakhir(125)).toBe('2 mnt lalu')
    expect(formatDetikTerakhir(7200)).toBe('2 jam lalu')
  })

  it('null berarti belum ada denyut', () => {
    expect(formatDetikTerakhir(null)).toBe('—')
    expect(formatDetikTerakhir(undefined)).toBe('—')
  })
})
