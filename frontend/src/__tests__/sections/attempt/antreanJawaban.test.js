import { describe, expect, it } from 'vitest'
import {
  adaSisa,
  ambilUntukKirim,
  buatAntrean,
  buatPengirim,
  catat,
  kembalikan,
} from '../../../sections/attempt/antreanJawaban.js'

describe('antrean nomor urut', () => {
  // Q-02: pengiriman berjalan asinkron, murid terus mengetik. Entri lama yang
  // gagal terkirim tidak boleh menimpa jawaban yang lebih baru.
  it('tidak mengembalikan entri lama bila soal sudah diubah lagi', () => {
    const antrean = buatAntrean()

    catat(antrean, 7, 'A')
    const terkirim = ambilUntukKirim(antrean)
    catat(antrean, 7, 'B')

    expect(kembalikan(antrean, '7', terkirim[0])).toBe(false)
    expect(antrean.entri.get('7')?.nilai).toBe('B')
  })

  it('mengembalikan entri lama bila belum ada perubahan yang lebih baru', () => {
    const antrean = buatAntrean()

    catat(antrean, 7, 'A')
    const terkirim = ambilUntukKirim(antrean)

    expect(kembalikan(antrean, '7', terkirim[0])).toBe(true)
    expect(antrean.entri.get('7')).toEqual({ nilai: 'A', seq: terkirim[0].seq })
  })

  it('menaikkan nomor urut tiap perubahan, termasuk untuk soal berbeda', () => {
    const antrean = buatAntrean()

    expect(catat(antrean, 7, 'A')).toBe(1)
    expect(catat(antrean, 8, 'B')).toBe(2)
    expect(catat(antrean, 7, 'C')).toBe(3)

    expect(antrean.entri.get('7')).toEqual({ nilai: 'C', seq: 3 })
    expect(antrean.entri.get('8')).toEqual({ nilai: 'B', seq: 2 })
  })

  it('mengambil salinan lalu mengosongkan antrean', () => {
    const antrean = buatAntrean()

    catat(antrean, 7, 'A')
    catat(antrean, 8, 'B')

    const daftar = ambilUntukKirim(antrean)

    expect(daftar).toEqual([
      { kunci: '7', nilai: 'A', seq: 1 },
      { kunci: '8', nilai: 'B', seq: 2 },
    ])
    expect(adaSisa(antrean)).toBe(false)
  })

  it('melaporkan sisa antrean apa adanya', () => {
    const antrean = buatAntrean()

    expect(adaSisa(antrean)).toBe(false)

    catat(antrean, 7, 'A')

    expect(adaSisa(antrean)).toBe(true)
  })
})

describe('pengirim tunggal', () => {
  it('menjalankan pekerjaan satu per satu, tidak pernah bersamaan', async () => {
    const antrekan = buatPengirim()
    /** @type {number} */
    let berjalanBersamaan = 0
    /** @type {number[]} */
    const puncak = []
    /** @type {number[]} */
    const urutan = []

    /** @param {number} nomor */
    const kerja = (nomor) => async () => {
      berjalanBersamaan += 1
      puncak.push(berjalanBersamaan)
      await new Promise((selesai) => setTimeout(selesai, 5))
      urutan.push(nomor)
      berjalanBersamaan -= 1

      return nomor
    }

    const hasil = await Promise.all([antrekan(kerja(1)), antrekan(kerja(2)), antrekan(kerja(3))])

    expect(urutan).toEqual([1, 2, 3])
    expect(hasil).toEqual([1, 2, 3])
    expect(Math.max(...puncak)).toBe(1)
  })

  it('tetap melanjutkan antrean setelah satu pekerjaan gagal', async () => {
    const antrekan = buatPengirim()
    /** @type {string[]} */
    const urutan = []

    const gagal = antrekan(async () => {
      urutan.push('gagal')

      throw new Error('jaringan putus')
    })
    const lanjut = antrekan(async () => {
      urutan.push('lanjut')

      return 7
    })

    await expect(gagal).rejects.toThrow('jaringan putus')
    await expect(lanjut).resolves.toBe(7)
    expect(urutan).toEqual(['gagal', 'lanjut'])
  })
})
