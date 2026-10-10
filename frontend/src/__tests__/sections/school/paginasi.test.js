import { describe, expect, it } from 'vitest'
import { skemaHalamanMurid } from '../../../sections/school/api.js'

/** Satu baris murid seperti dikirim MuridResource. */
const murid = {
  id: 7,
  school_id: 1,
  class_id: 3,
  nis: '9001',
  nisn: null,
  nama: 'Ayu Lestari',
  email: 'ayu@murid.test',
  kelas_nama: '6A',
}

describe('halaman daftar murid (P-01)', () => {
  it('membaca data[] beserta metadata paginasi', () => {
    const halaman = skemaHalamanMurid.parse({
      data: [murid],
      meta: { total: 120, current_page: 2, last_page: 3, per_page: 50 },
    })

    expect(halaman.data).toHaveLength(1)
    expect(halaman.data[0].nama).toBe('Ayu Lestari')
    expect(halaman.meta.total).toBe(120)
    expect(halaman.meta.last_page).toBe(3)
  })

  it('menerima halaman kosong (hasil filter kelas tanpa murid)', () => {
    const halaman = skemaHalamanMurid.parse({
      data: [],
      meta: { total: 0, current_page: 1, last_page: 1, per_page: 50 },
    })

    expect(halaman.data).toHaveLength(0)
  })

  it('menolak array telanjang (kontrak lama) agar regresi ketahuan', () => {
    // Sebelum P-01 responsnya array murid langsung. Kalau endpoint kembali ke
    // bentuk itu, tabel kehilangan `meta` dan tombol halaman salah hitung.
    expect(() => skemaHalamanMurid.parse([murid])).toThrow()
  })

  it('menolak respons tanpa meta', () => {
    expect(() => skemaHalamanMurid.parse({ data: [murid] })).toThrow()
  })
})
