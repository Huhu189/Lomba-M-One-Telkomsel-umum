// @vitest-environment jsdom
/**
 * Tes cadangan jawaban lokal. Yang dijaga: jawaban server digabung antrean lokal
 * (antrean menang), entries terkirim keluar dari antrean, kunci idempotensi
 * dibuat sekali, dan isinya benar-benar tersimpan di localStorage.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { entriKosong, gabungJawaban, useSimpananJawaban } from '../../../sections/attempt/simpananJawaban.js'

const KUNCI_SIMPANAN = 'ulangan-cadangan-jawaban-v1'

beforeEach(() => {
  localStorage.clear()
  useSimpananJawaban.setState({ perAttempt: {} })
})

describe('gabungJawaban', () => {
  it('mengutamakan jawaban lokal yang belum terkirim di atas jawaban server', () => {
    const hasil = gabungJawaban(
      [
        { question_id: 1, jawaban: 'A' },
        { question_id: 2, jawaban: true },
      ],
      {
        jawaban: { 1: 'C', 3: 'B' },
        belumTerkirim: { 1: 'C' },
        kunciIdempotensi: 'kunci-1',
        disimpanAt: 1,
      },
    )

    // Soal 1 ada di antrean lokal yang belum terkirim → menang.
    // Soal 2 hanya ada di server → dipakai.
    // Soal 3 ada di `jawaban` lokal tetapi SUDAH terkirim (tidak di antrean),
    // jadi server yang jadi acuan — bukan salinan lokal.
    expect(hasil).toEqual({ 1: 'C', 2: true })
  })

  it('tidak menimpa jawaban server yang lebih baru dengan cadangan yang sudah terkirim (Q-05)', () => {
    // Mode tim: anggota B baru saja menyimpan 'B' ke server, sedangkan layar A
    // masih memegang salinan lama 'A' yang sudah pernah terkirim.
    const hasil = gabungJawaban(
      [{ question_id: 1, jawaban: 'B' }],
      { jawaban: { 1: 'A' }, belumTerkirim: {}, kunciIdempotensi: '', disimpanAt: 1 },
    )

    // Tampilan harus sama dengan yang dinilai server; kalau tidak, A diam-diam
    // menimpa jawaban B dan jawaban yang dikirim tidak sesuai yang terlihat.
    expect(hasil).toEqual({ 1: 'B' })
  })

  it('aman saat cadangan kosong', () => {
    expect(gabungJawaban([{ question_id: 7, jawaban: 'D' }], entriKosong())).toEqual({ 7: 'D' })
  })
})

describe('store cadangan jawaban', () => {
  it('mencatat jawaban, menaruhnya di antrean, lalu menandai terkirim', () => {
    const { catat, tandaiTerkirim, ambil } = useSimpananJawaban.getState()

    catat(9, 21, 'B')

    expect(ambil(9).jawaban['21']).toBe('B')
    expect(ambil(9).belumTerkirim['21']).toBe('B')

    tandaiTerkirim(9, 21, 'B')

    expect(ambil(9).belumTerkirim['21']).toBeUndefined()
    expect(ambil(9).jawaban['21']).toBe('B')
  })

  it('tidak membuang jawaban lebih baru yang diketik selagi pengiriman berjalan (Q-03)', () => {
    const { catat, tandaiTerkirim, ambil } = useSimpananJawaban.getState()

    // Murid mengetik X; permintaan X sedang berjalan menuju server.
    catat(9, 21, 'X')
    // Selagi menunggu balasan, murid mengganti isian menjadi Y.
    catat(9, 21, 'Y')
    // Server menerima jawaban lama X dan membalas OK.
    tandaiTerkirim(9, 21, 'X')

    // Y belum pernah tersimpan di server, jadi harus tetap menunggu di antrean;
    // tanpa ini, muat ulang halaman menghapus Y dari cadangan (Q-03).
    expect(ambil(9).belumTerkirim['21']).toBe('Y')

    // Setelah giliran Y benar-benar tersimpan, barulah antrean bersih.
    tandaiTerkirim(9, 21, 'Y')
    expect(ambil(9).belumTerkirim['21']).toBeUndefined()
  })

  it('menyimpan hasil ke localStorage sehingga bisa dipulihkan', () => {
    useSimpananJawaban.getState().catat(4, 8, { k1: 'n1' })

    const tersimpan = JSON.parse(localStorage.getItem(KUNCI_SIMPANAN) ?? '{}')

    expect(tersimpan.state.perAttempt['4'].jawaban['8']).toEqual({ k1: 'n1' })
    expect(tersimpan.state.perAttempt['4'].belumTerkirim['8']).toEqual({ k1: 'n1' })
  })

  it('membuat kunci idempotensi satu kali per attempt', () => {
    const { kunciIdempotensi } = useSimpananJawaban.getState()
    let jumlahPanggil = 0
    const buat = () => {
      jumlahPanggil += 1
      return `kunci-${jumlahPanggil}`
    }

    const pertama = kunciIdempotensi(3, buat)
    const kedua = kunciIdempotensi(3, buat)

    expect(pertama).toBe('kunci-1')
    expect(kedua).toBe('kunci-1')
    expect(jumlahPanggil).toBe(1)
    // Attempt berbeda mendapat kuncinya sendiri.
    expect(kunciIdempotensi(5, buat)).toBe('kunci-2')
  })

  it('membersihkan cadangan setelah hasil final', () => {
    const { catat, bersihkan, ambil } = useSimpananJawaban.getState()

    catat(11, 2, 'A')
    bersihkan(11)

    expect(ambil(11)).toEqual(entriKosong())
  })
})
