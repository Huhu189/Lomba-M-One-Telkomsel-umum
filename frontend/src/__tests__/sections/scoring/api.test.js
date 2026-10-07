import { describe, expect, it } from 'vitest'
import {
  skemaAntreanKoreksi,
  skemaHasilKoreksi,
  skemaHasilSaranAi,
  skemaItemKoreksi,
  skemaTokenKoreksi,
} from '../../../sections/scoring/api.js'

/**
 * Satu baris antrean koreksi sesuai kontrak KoreksiController.
 * Nilai `ubah` sengaja longgar supaya tes bisa menyisipkan data rusak.
 * @param {Record<string, unknown>} ubah
 */
function itemKoreksi(ubah) {
  return {
    attempt_id: 2,
    question_id: 4,
    murid_id: 3,
    murid_nama: 'Ayu',
    no_attempt: 1,
    status: 'perlu_tinjau',
    status_label: 'Perlu ditinjau',
    tipe: 'uraian',
    tipe_label: 'Uraian',
    teks_soal: 'Jelaskan cara menjumlahkan.',
    jawaban: 'karena dijumlahkan dulu',
    kunci: { kata_kunci: [{ teks: 'jumlah' }] },
    skor_maksimal: 10,
    skor_sekarang: 4,
    dinilai_manual: false,
    saran_ai: null,
    alasan_ai: null,
    ai_status: null,
    ai_label: null,
    ai_dinilai_at: null,
    ...ubah,
  }
}

describe('skema antrean koreksi', () => {
  it('menerima antrean lengkap dari server', () => {
    const data = skemaAntreanKoreksi.parse({
      kuis_id: 2,
      judul_kuis: 'Ulangan Operasi Hitung',
      mapel_nama: 'Matematika',
      kelas_nama: '3A',
      alasan_min: 10,
      ai_aktif: true,
      jumlah: 1,
      item: [itemKoreksi({})],
    })

    expect(data.alasan_min).toBe(10)
    expect(data.ai_aktif).toBe(true)
    expect(data.item[0].dinilai_manual).toBe(false)
    expect(data.item[0].skor_maksimal).toBe(10)
    expect(data.item[0].saran_ai).toBeNull()
  })

  it('menerima mapel/kelas kosong dan murid tanpa nama', () => {
    const data = skemaAntreanKoreksi.parse({
      kuis_id: 2,
      judul_kuis: 'Ulangan',
      mapel_nama: null,
      kelas_nama: null,
      alasan_min: 10,
      ai_aktif: false,
      jumlah: 1,
      item: [itemKoreksi({ murid_id: null, murid_nama: null, no_attempt: null })],
    })

    expect(data.mapel_nama).toBeNull()
    expect(data.item[0].murid_nama).toBeNull()
  })

  it('membaca saran AI pada baris antrean', () => {
    const data = skemaItemKoreksi.parse(
      itemKoreksi({
        saran_ai: 2.5,
        alasan_ai: 'Jawaban menyebut kata kunci utama.',
        ai_status: 'saran',
        ai_label: 'Saran AI tersedia',
        ai_dinilai_at: '2026-10-07T09:00:00.000Z',
      }),
    )

    expect(data.saran_ai).toBe(2.5)
    expect(data.alasan_ai).toBe('Jawaban menyebut kata kunci utama.')
    expect(data.ai_status).toBe('saran')
  })

  it('menolak saran AI yang bukan angka', () => {
    expect(() => skemaItemKoreksi.parse(itemKoreksi({ saran_ai: '2,5' }))).toThrow()
  })

  it('menolak item yang kehilangan bidang wajib', () => {
    expect(() => skemaItemKoreksi.parse(itemKoreksi({ status_label: undefined }))).toThrow()
    expect(() => skemaItemKoreksi.parse(itemKoreksi({ kunci: 'bukan peta' }))).toThrow()
  })
})

describe('skema token & hasil koreksi', () => {
  it('membaca token konfirmasi sekali pakai', () => {
    const data = skemaTokenKoreksi.parse({
      token: 'a'.repeat(48),
      expires_at: '2026-10-06T03:05:00.000Z',
      ttl_detik: 300,
    })

    expect(data.ttl_detik).toBe(300)
  })

  it('membaca hasil koreksi beserta total attempt', () => {
    const data = skemaHasilKoreksi.parse({
      message: 'Nilai soal tersimpan.',
      attempt_id: 2,
      question_id: 4,
      status: 'dinilai',
      skor_soal: 8,
      skor_maksimal_soal: 10,
      total_skor: 24,
      total_benar: 5,
      total_skor_maksimal: 30,
    })

    expect(data.skor_soal).toBe(8)
    expect(data.total_skor).toBe(24)
  })

  it('membaca jawaban permintaan saran AI', () => {
    const data = skemaHasilSaranAi.parse({
      aktif: true,
      terantre: 3,
      message: 'Saran AI diminta untuk 3 jawaban.',
    })

    expect(data.aktif).toBe(true)
    expect(data.terantre).toBe(3)

    expect(() => skemaHasilSaranAi.parse({ aktif: false, message: 'mati' })).toThrow()
  })
})
