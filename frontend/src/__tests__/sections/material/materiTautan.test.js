/**
 * Tautan materi (15 Oktober 2026): alamat `/materi/<id>` dan kalimat catatannya.
 *
 * Yang dijaga di sini adalah hal-hal yang mudah salah dan mahal akibatnya —
 * tautan dibagikan ke grup kelas, jadi kalau alamatnya keliru atau catatannya
 * menjanjikan yang tidak benar (mis. “murid bisa membuka” padahal materinya
 * masih draf), gurunya sendiri yang ditegur murid.
 */
import { describe, expect, it } from 'vitest'
import { catatanMateri, tautanMateri } from '../../../sections/material/editor/materiTautan.js'

describe('tautanMateri', () => {
  it('menyusun alamat /materi/<id> dari asal aplikasi', () => {
    expect(tautanMateri(12, 'https://contoh.test')).toBe('https://contoh.test/materi/12')
  })

  it('membuang garis miring di ujung asal supaya tidak jadi //', () => {
    expect(tautanMateri(12, 'https://contoh.test/')).toBe('https://contoh.test/materi/12')
  })

  it('mengembalikan alamat relatif bila asal tidak diketahui', () => {
    expect(tautanMateri(7)).toBe('/materi/7')
  })

  it('menolak id yang belum tersimpan — belum ada yang bisa dibagikan', () => {
    // Materi baru (belum dapat id dari server) dan id yang tidak masuk akal
    // tidak boleh menghasilkan tautan yang mengarah ke materi orang lain.
    expect(tautanMateri(0, 'https://contoh.test')).toBe('')
    expect(tautanMateri(-3, 'https://contoh.test')).toBe('')
    expect(tautanMateri(1.5, 'https://contoh.test')).toBe('')
    expect(tautanMateri(Number.NaN, 'https://contoh.test')).toBe('')
  })
})

describe('catatanMateri', () => {
  it('mengingatkan bahwa materi draf belum bisa dibuka murid', () => {
    const catatan = catatanMateri({ status: 'draf', kelas: '4A' })

    expect(catatan[0]).toContain('belum terbit')
    expect(catatan.join(' ')).toContain('murid kelas 4A')
  })

  it('tidak lagi menyebut draf setelah materinya dipublikasikan', () => {
    const catatan = catatanMateri({ status: 'publikasi', kelas: '4A' })

    expect(catatan.join(' ')).not.toContain('belum terbit')
    expect(catatan.join(' ')).toContain('murid kelas 4A')
  })

  it('tetap jujur soal siapa yang boleh membuka bila kelasnya tidak diketahui', () => {
    const catatan = catatanMateri({ status: 'publikasi' })

    expect(catatan.join(' ')).toContain('yang sudah masuk dengan akunnya')
  })
})
