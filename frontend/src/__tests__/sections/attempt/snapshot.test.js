// @vitest-environment jsdom
/**
 * Tes salinan attempt di perangkat (sistem luring).
 *
 * Yang dijaga: salinan hanya diterima bila bentuknya lolos Zod, `server_now`
 * digeser sesuai umur salinan (kalau tidak, sisa waktu membeku sejak salinan
 * dibuat), yang kedaluwarsa dibuang, dan salinan hilang setelah submit/keluar.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  BATAS_SNAPSHOT,
  KUNCI_SNAPSHOT,
  UMUR_SNAPSHOT_MS,
  ambilSnapshot,
  bersihkanSemuaSnapshot,
  bersihkanSnapshot,
  rapikanSnapshot,
  sesuaikanServerNow,
  simpanSnapshot,
} from '../../../sections/attempt/snapshot.js'

/** Payload attempt contoh (bentuknya sama dengan respons server, tanpa kunci). */
const attemptContoh = {
  id: 3,
  quiz_id: 1,
  jenis: 'ulangan',
  jenis_label: 'Ulangan',
  status: 'berjalan',
  status_label: 'Sedang dikerjakan',
  mulai_at: '2026-10-06T10:00:00+07:00',
  deadline_at: '2026-10-06T10:30:00+07:00',
  server_now: '2026-10-06T10:00:00+07:00',
  sisa_detik: 1800,
  terlambat: false,
  jumlah_soal: 1,
  skor: null,
  skor_maksimal: 5,
  jumlah_benar: 0,
  dikumpulkan_at: null,
  soal: [
    {
      id: 12,
      nomor: 1,
      tipe: 'pilihan_ganda',
      tipe_label: 'Pilihan ganda',
      konten: { teks: 'Berapa hasil 4 + 5?', opsi: [{ id: 'A', teks: '8' }, { id: 'B', teks: '9' }] },
      skor: 5,
    },
  ],
  jawaban: [{ question_id: 12, jawaban: 'B' }],
}

beforeEach(() => {
  localStorage.clear()
})

describe('sesuaikanServerNow', () => {
  it('menggeser jam server sesuai umur salinan', () => {
    const disimpanAt = Date.parse('2026-10-06T10:00:00+07:00')
    const hasil = sesuaikanServerNow(attemptContoh, disimpanAt, disimpanAt + 600_000)

    expect(Date.parse(hasil.server_now)).toBe(Date.parse(attemptContoh.server_now) + 600_000)
  })

  it('tidak menggeser bila jam salinan tidak terbaca', () => {
    const hasil = sesuaikanServerNow({ ...attemptContoh, server_now: 'x' }, 0, 600_000)

    expect(hasil.server_now).toBe('x')
  })

  it('tidak memundurkan jam server bila umur negatif', () => {
    const hasil = sesuaikanServerNow(attemptContoh, 600_000, 0)

    expect(Date.parse(hasil.server_now)).toBe(Date.parse(attemptContoh.server_now))
  })
})

describe('rapikanSnapshot', () => {
  const sekarang = 10_000_000

  it('membuang salinan kedaluwarsa dan bentuk yang tidak dikenal', () => {
    const isi = {
      1: { disimpanAt: sekarang - UMUR_SNAPSHOT_MS - 1, attempt: attemptContoh },
      2: { disimpanAt: sekarang, attempt: { bukan: 'attempt' } },
      3: { disimpanAt: sekarang, attempt: attemptContoh },
      4: 'bukan objek',
    }

    expect(Object.keys(rapikanSnapshot(isi, sekarang))).toEqual(['3'])
  })

  it('tahan menerima isi yang bukan objek sama sekali', () => {
    expect(rapikanSnapshot(null, sekarang)).toEqual({})
    expect(rapikanSnapshot('teks', sekarang)).toEqual({})
    expect(rapikanSnapshot([], sekarang)).toEqual({})
  })

  it('menyisakan salinan paling baru bila melebihi batas', () => {
    /** @type {Record<string, unknown>} */
    const isi = {}

    for (let i = 1; i <= BATAS_SNAPSHOT + 3; i++) {
      isi[String(i)] = { disimpanAt: sekarang - 1000 + i, attempt: { ...attemptContoh, quiz_id: i } }
    }

    expect(Object.keys(rapikanSnapshot(isi, sekarang))).toEqual(['4', '5', '6', '7', '8'])
  })
})

describe('simpan/ambil salinan', () => {
  it('menyimpan lalu membacanya kembali dengan jam server yang sudah disesuaikan', () => {
    const disimpanAt = 1_000_000

    expect(simpanSnapshot(attemptContoh, { sekarangMs: disimpanAt })).toBe(true)

    const hasil = ambilSnapshot(1, { sekarangMs: disimpanAt + 300_000 })

    expect(hasil?.id).toBe(3)
    expect(hasil?.soal[0].konten.teks).toBe('Berapa hasil 4 + 5?')
    expect(Date.parse(hasil?.server_now ?? '')).toBe(Date.parse(attemptContoh.server_now) + 300_000)
  })

  it('mengembalikan null bila tidak ada salinan untuk kuis itu', () => {
    expect(ambilSnapshot(99, { sekarangMs: 1_000_000 })).toBeNull()
  })

  it('mengabaikan isi localStorage yang rusak', () => {
    localStorage.setItem(KUNCI_SNAPSHOT, '{bukan json')

    expect(ambilSnapshot(1, { sekarangMs: 1_000_000 })).toBeNull()
    expect(simpanSnapshot(attemptContoh, { sekarangMs: 1_000_000 })).toBe(true)
  })

  it('menghapus salinan satu kuis (setelah submit) dan seluruhnya (setelah keluar)', () => {
    // Jam nyata dipakai di sini karena pembersihan memakai jam nyata untuk
    // membuang salinan yang sudah kedaluwarsa (> 24 jam).
    const sekarangMs = Date.now()

    simpanSnapshot(attemptContoh, { sekarangMs })
    simpanSnapshot({ ...attemptContoh, id: 4, quiz_id: 2 }, { sekarangMs })

    bersihkanSnapshot(1)

    expect(ambilSnapshot(1, { sekarangMs })).toBeNull()
    expect(ambilSnapshot(2, { sekarangMs })?.id).toBe(4)

    bersihkanSemuaSnapshot()

    expect(localStorage.getItem(KUNCI_SNAPSHOT)).toBeNull()
  })
})
