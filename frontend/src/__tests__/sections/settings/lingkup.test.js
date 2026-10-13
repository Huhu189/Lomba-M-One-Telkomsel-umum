/**
 * Uji logika murni pemilihan lingkup pengaturan (K-05).
 *
 * Halaman pengaturan diskalakan per ulangan: hanya baris `kuis:<id>` yang sah.
 */
import { describe, expect, it } from 'vitest'
import {
  bacaLingkup,
  lingkupAwal,
  nilaiLingkupKuis,
  pilihanLingkup,
} from '../../../sections/settings/lingkup.js'

const kuis = [
  { id: 21, judul: 'Ulangan Pecahan' },
  { id: 22, judul: 'Ulangan Bangun Datar' },
]

describe('bacaLingkup', () => {
  it('menerjemahkan lapis kuis beserta id-nya', () => {
    expect(bacaLingkup(nilaiLingkupKuis(21))).toEqual({
      lingkup: 'kuis',
      lingkupId: 21,
      kuisId: 21,
    })
  })

  it('menolak nilai tak dikenal atau id tidak sah alih-alih menebak', () => {
    for (const nilai of [
      '',
      'kuis:',
      'kuis:0',
      'kuis:-2',
      'kuis:abc',
      'sekolah',
      'kelas:7',
      'entah',
    ]) {
      expect(bacaLingkup(nilai)).toBeNull()
    }
  })
})

describe('pilihanLingkup', () => {
  it('menyebut ulangan, bukan lapis sekolah/kelas', () => {
    const pilihan = pilihanLingkup({ daftarKuis: kuis })

    expect(pilihan.map((p) => p.nilai)).toEqual(['kuis:21', 'kuis:22'])
    expect(pilihan[0].label).toBe('Ulangan: Ulangan Pecahan')
  })

  it('guru tanpa ulangan tidak diberi pilihan apa pun', () => {
    expect(pilihanLingkup({ daftarKuis: [] })).toEqual([])
  })
})

describe('lingkupAwal', () => {
  it('mulai dari ulangan pertama', () => {
    expect(lingkupAwal(pilihanLingkup({ daftarKuis: kuis }))).toBe('kuis:21')
  })

  it('tanpa pilihan sama sekali hasilnya kosong, bukan tebakan', () => {
    expect(lingkupAwal([])).toBe('')
  })
})
