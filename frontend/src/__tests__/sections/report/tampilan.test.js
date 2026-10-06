import { describe, expect, it } from 'vitest'
import { skemaProgres, skemaResponPeringkat } from '../../../sections/report/api.js'
import { kelasLencana, milikMurid, ringkasTingkat, tingkatTampilan, urutkanPeringkat } from '../../../sections/report/tampilan.js'

/**
 * Satu baris peringkat lengkap sesuai kontrak server.
 * @param {Partial<import('../../../sections/report/api.js').DataBarisPeringkat>} ubah
 */
function barisPeringkat(ubah) {
  return {
    peringkat: 1,
    attempt_id: 1,
    murid_id: 1,
    nama: 'Ani',
    skor: 5,
    skor_maksimal: 10,
    persen: 50,
    jumlah_benar: 1,
    jumlah_soal: 2,
    dikumpulkan_at: '2026-10-06T03:00:00.000Z',
    ...ubah,
  }
}

describe('tingkatTampilan', () => {
  it('memetakan setiap tingkat ke label dan kelas lencana', () => {
    expect(tingkatTampilan('paham')).toEqual({ label: 'Paham', kelas: 'badge-status sukses' })
    expect(tingkatTampilan('mulai_paham').kelas).toBe('badge-status peringatan')
    expect(tingkatTampilan('belum_paham').kelas).toBe('badge-status salah')
    expect(tingkatTampilan('data_belum_cukup').label).toBe('Data belum cukup')
  })

  it('memakai tampilan aman untuk tingkat tak dikenal', () => {
    expect(tingkatTampilan('entah').kelas).toBe('badge-status lembut')
  })
})

describe('kelasLencana', () => {
  it('memberi kelas sesuai kode lencana', () => {
    expect(kelasLencana({ kode: 'emas' })).toBe('lencana lencana-emas')
    expect(kelasLencana({ kode: 'perak' })).toBe('lencana lencana-perak')
    expect(kelasLencana({ kode: 'perunggu' })).toBe('lencana lencana-perunggu')
    expect(kelasLencana({ kode: 'belum' })).toBe('lencana lencana-pendukung')
    expect(kelasLencana(undefined)).toBe('lencana lencana-pendukung')
  })
})

describe('ringkasTingkat', () => {
  it('menghitung tema per tingkat', () => {
    const ringkasan = ringkasTingkat([
      { tingkat: 'paham' },
      { tingkat: 'paham' },
      { tingkat: 'belum_paham' },
      { tingkat: 'data_belum_cukup' },
    ])

    expect(ringkasan.paham).toBe(2)
    expect(ringkasan.belum_paham).toBe(1)
    expect(ringkasan.mulai_paham).toBe(0)
    expect(ringkasan.data_belum_cukup).toBe(1)
  })
})

describe('urutkanPeringkat', () => {
  it('mengurutkan skor menurun', () => {
    const hasil = urutkanPeringkat([
      barisPeringkat({ nama: 'Ani', skor: 3 }),
      barisPeringkat({ nama: 'Budi', skor: 9 }),
    ])

    expect(hasil.map((b) => b.nama)).toEqual(['Budi', 'Ani'])
  })

  it('seri diputus waktu selesai lebih cepat lalu nama', () => {
    const hasil = urutkanPeringkat([
      barisPeringkat({ nama: 'Citra', skor: 5, dikumpulkan_at: '2026-10-06T04:00:00.000Z' }),
      barisPeringkat({ nama: 'Budi', skor: 5, dikumpulkan_at: '2026-10-06T02:00:00.000Z' }),
      barisPeringkat({ nama: 'Ani', skor: 5, dikumpulkan_at: '2026-10-06T02:00:00.000Z' }),
    ])

    expect(hasil.map((b) => b.nama)).toEqual(['Ani', 'Budi', 'Citra'])
  })

  it('murid yang belum mengumpulkan ditaruh paling akhir pada skor seri', () => {
    const hasil = urutkanPeringkat([
      barisPeringkat({ nama: 'Kosong', skor: 5, dikumpulkan_at: null }),
      barisPeringkat({ nama: 'Ada', skor: 5, dikumpulkan_at: '2026-10-06T02:00:00.000Z' }),
    ])

    expect(hasil[0].nama).toBe('Ada')
  })
})

describe('milikMurid', () => {
  it('menemukan baris milik murid atau null', () => {
    expect(milikMurid([{ murid_id: 7 }], 7)).toEqual({ murid_id: 7 })
    expect(milikMurid([{ murid_id: 7 }], 8)).toBeNull()
    expect(milikMurid([], 1)).toBeNull()
  })
})

describe('skema laporan', () => {
  it('menerima payload peringkat dari server', () => {
    const data = skemaResponPeringkat.parse({
      kuis_id: 1,
      judul_kuis: 'Ulangan Operasi Hitung',
      tampil: false,
      total: 1,
      top: 20,
      peringkat: [barisPeringkat({})],
      peringkat_saya: null,
    })

    expect(data.tampil).toBe(false)
    expect(data.peringkat).toHaveLength(1)
  })

  it('menerima payload progres dengan remedial kosong', () => {
    const data = skemaProgres.parse({
      murid_id: 1,
      nama: 'Ayu',
      ambang: { ambang_paham: 80, ambang_mulai_paham: 60, data_minimum: 3 },
      tema: [
        {
          tag_id: 2,
          tag_nama: 'Operasi Hitung',
          jumlah_soal: 2,
          jumlah_benar: 1,
          persen: 50,
          tingkat: 'belum_paham',
          tingkat_label: 'Belum paham',
        },
      ],
      badge: { murid_id: 1, nama: 'Ayu', jumlah_lencana: 0, badge: [] },
      remedial: { diaktifkan: true, tema_lemah: [], soal: [] },
    })

    expect(data.tema[0].tingkat).toBe('belum_paham')
    expect(data.remedial.soal).toEqual([])
  })
})
