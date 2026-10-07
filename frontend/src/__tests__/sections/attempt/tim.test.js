import { describe, expect, it } from 'vitest'
import {
  muridTanpaTim,
  ringkasAnggotaTim,
  skemaDaftarTim,
  usulJumlahTim,
} from '../../../sections/attempt/tim.js'

/**
 * Satu murid kelas sesuai kontrak server.
 * @param {Record<string, unknown>} ubah
 */
function muridKelas(ubah) {
  return {
    murid_id: 1,
    nama: 'Ayu',
    tim_id: null,
    tim_nama: null,
    ...ubah,
  }
}

describe('skema daftar tim', () => {
  it('menerima payload lengkap dari server', () => {
    const data = skemaDaftarTim.parse({
      kuis_id: 4,
      judul_kuis: 'Ulangan Kelompok',
      kelas_nama: '5B',
      mapel_nama: 'IPA',
      mode_tim: true,
      ada_attempt: false,
      jumlah_tim: 1,
      tim: [
        {
          id: 9,
          nama: 'Tim 1',
          jumlah_anggota: 2,
          anggota: [
            { murid_id: 1, nama: 'Ayu' },
            { murid_id: 2, nama: 'Bima' },
          ],
        },
      ],
      murid_kelas: [muridKelas({})],
    })

    expect(data.mode_tim).toBe(true)
    expect(data.tim[0].anggota).toHaveLength(2)
  })

  it('menerima tim tanpa anggota dan pesan tambahan dari bagi otomatis', () => {
    const data = skemaDaftarTim.parse({
      kuis_id: 4,
      judul_kuis: 'Ulangan Kelompok',
      kelas_nama: null,
      mapel_nama: null,
      mode_tim: false,
      ada_attempt: true,
      jumlah_tim: 1,
      tim: [{ id: 9, nama: 'Tim 1', jumlah_anggota: 0, anggota: [] }],
      murid_kelas: [],
      message: 'Tim dibagi otomatis.',
    })

    expect(data.jumlah_tim).toBe(1)
    expect(data.message).toBe('Tim dibagi otomatis.')
  })

  it('menolak baris tim yang kehilangan bidang wajib', () => {
    expect(() =>
      skemaDaftarTim.parse({
        kuis_id: 4,
        judul_kuis: 'Ulangan',
        kelas_nama: null,
        mapel_nama: null,
        mode_tim: false,
        ada_attempt: false,
        jumlah_tim: 0,
        tim: [{ id: 9, nama: 'Tim 1', jumlah_anggota: 0 }],
        murid_kelas: [],
      }),
    ).toThrow()
  })
})

describe('usulJumlahTim', () => {
  it('mengusulkan jumlah tim yang masuk akal untuk ukuran kelas SD', () => {
    expect(usulJumlahTim(30)).toBe(10)
    expect(usulJumlahTim(12)).toBe(4)
    expect(usulJumlahTim(12, 4)).toBe(3)
  })

  it('tidak mengusulkan tim untuk kelas yang terlalu kecil dan selalu minimal dua', () => {
    expect(usulJumlahTim(3)).toBe(0)
    expect(usulJumlahTim(4)).toBe(2)
    // Ukuran ideal yang aneh tidak menghasilkan tim lebih dari 20.
    expect(usulJumlahTim(500, 1)).toBe(20)
  })
})

describe('muridTanpaTim', () => {
  it('hanya menyisakan murid yang belum masuk tim', () => {
    const hasil = muridTanpaTim([
      muridKelas({ murid_id: 1, tim_id: 3, tim_nama: 'Tim 1' }),
      muridKelas({ murid_id: 2, nama: 'Bima' }),
      muridKelas({ murid_id: 3, nama: 'Citra' }),
    ])

    expect(hasil.map((murid) => murid.nama)).toEqual(['Bima', 'Citra'])
  })
})

describe('ringkasAnggotaTim', () => {
  it('menggabungkan nama anggota jadi satu baris', () => {
    expect(
      ringkasAnggotaTim({
        id: 1,
        nama: 'Tim 1',
        jumlah_anggota: 2,
        anggota: [
          { murid_id: 1, nama: 'Ayu' },
          { murid_id: 2, nama: 'Bima' },
        ],
      }),
    ).toBe('Ayu, Bima')
  })

  it('mengaku apa adanya saat tim masih kosong', () => {
    expect(ringkasAnggotaTim({ id: 1, nama: 'Tim 1', jumlah_anggota: 0, anggota: [] })).toBe('belum ada anggota')
  })
})
