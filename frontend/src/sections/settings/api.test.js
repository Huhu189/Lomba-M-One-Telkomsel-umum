import { describe, expect, it } from 'vitest'
import { skemaNilaiPengaturan, skemaResolusiPengaturan } from './api.js'

describe('skema pengaturan', () => {
  it('memvalidasi resolusi pengaturan lengkap', () => {
    const hasil = skemaResolusiPengaturan.parse({
      sekolah_id: 1,
      kelas_id: null,
      kuis_id: null,
      pengaturan: {
        retry: {
          nilai: true,
          tipe: 'boolean',
          label: 'Izinkan ulangan ulang (retry)',
          kelompok: 'Aturan ulangan',
          bawaan: true,
          sumber: 'bawaan',
          terkunci: false,
        },
      },
    })

    expect(hasil.pengaturan.retry.sumber).toBe('bawaan')
  })

  it('menolak sumber lapis yang tidak dikenal', () => {
    expect(() =>
      skemaNilaiPengaturan.parse({
        nilai: 3,
        tipe: 'integer',
        label: 'Batas percobaan',
        kelompok: 'Aturan ulangan',
        bawaan: 3,
        sumber: 'entah',
        terkunci: false,
      }),
    ).toThrow()
  })
})
