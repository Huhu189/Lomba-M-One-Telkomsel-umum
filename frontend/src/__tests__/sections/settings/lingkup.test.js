/**
 * Uji logika murni pemilihan lingkup pengaturan (K-05).
 */
import { describe, expect, it } from 'vitest'
import {
  LINGKUP_SEKOLAH,
  bacaLingkup,
  lingkupAwal,
  nilaiLingkupKelas,
  nilaiLingkupKuis,
  pilihanLingkup,
} from '../../../sections/settings/lingkup.js'

const kelas = [{ id: 7, nama: '4A' }, { id: 9, nama: '5B' }]
const kuis = [{ id: 21, judul: 'Ulangan Pecahan' }]

describe('bacaLingkup', () => {
  it('menerjemahkan lapis sekolah tanpa id', () => {
    expect(bacaLingkup(LINGKUP_SEKOLAH)).toEqual({
      lingkup: 'sekolah',
      lingkupId: null,
      kelasId: null,
      kuisId: null,
    })
  })

  it('menerjemahkan lapis kelas dan kuis beserta id-nya', () => {
    expect(bacaLingkup(nilaiLingkupKelas(7))).toEqual({
      lingkup: 'kelas',
      lingkupId: 7,
      kelasId: 7,
      kuisId: null,
    })
    expect(bacaLingkup(nilaiLingkupKuis(21))).toEqual({
      lingkup: 'kuis',
      lingkupId: 21,
      kelasId: null,
      kuisId: 21,
    })
  })

  it('menolak nilai tak dikenal atau id tidak sah alih-alih menebak', () => {
    for (const nilai of ['', 'kuis:', 'kelas:0', 'kelas:-2', 'kuis:abc', 'sekolah:1', 'entah']) {
      expect(bacaLingkup(nilai)).toBeNull()
    }
  })
})

describe('pilihanLingkup', () => {
  it('admin melihat sekolah, seluruh kelas, dan kuis', () => {
    const pilihan = pilihanLingkup({ sebagaiAdmin: true, daftarKelas: kelas, daftarKuis: kuis })

    expect(pilihan.map((p) => p.nilai)).toEqual(['sekolah', 'kelas:7', 'kelas:9', 'kuis:21'])
    expect(pilihan[1].label).toBe('Kelas 4A')
    expect(pilihan[3].label).toBe('Kuis: Ulangan Pecahan')
  })

  it('guru hanya melihat kuis — lapis sekolah/kelas milik admin', () => {
    const pilihan = pilihanLingkup({ sebagaiAdmin: false, daftarKelas: kelas, daftarKuis: kuis })

    expect(pilihan.map((p) => p.nilai)).toEqual(['kuis:21'])
  })

  it('guru tanpa kuis tidak diberi pilihan apa pun', () => {
    expect(pilihanLingkup({ sebagaiAdmin: false, daftarKelas: kelas, daftarKuis: [] })).toEqual([])
  })
})

describe('lingkupAwal', () => {
  it('admin mulai dari lapis sekolah', () => {
    const pilihan = pilihanLingkup({ sebagaiAdmin: true, daftarKelas: kelas, daftarKuis: kuis })

    expect(lingkupAwal(pilihan, true)).toBe('sekolah')
  })

  it('guru mulai dari kuis pertamanya', () => {
    const pilihan = pilihanLingkup({ sebagaiAdmin: false, daftarKelas: kelas, daftarKuis: kuis })

    expect(lingkupAwal(pilihan, false)).toBe('kuis:21')
  })

  it('tanpa pilihan sama sekali hasilnya kosong, bukan tebakan', () => {
    expect(lingkupAwal([], false)).toBe('')
    expect(lingkupAwal([], true)).toBe('')
  })
})
