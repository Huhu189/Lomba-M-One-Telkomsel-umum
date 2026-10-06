import { describe, expect, it } from 'vitest'
import {
  skemaAntreanKoreksi,
  skemaHasilKoreksi,
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
      jumlah: 1,
      item: [itemKoreksi({})],
    })

    expect(data.alasan_min).toBe(10)
    expect(data.item[0].dinilai_manual).toBe(false)
    expect(data.item[0].skor_maksimal).toBe(10)
  })

  it('menerima mapel/kelas kosong dan murid tanpa nama', () => {
    const data = skemaAntreanKoreksi.parse({
      kuis_id: 2,
      judul_kuis: 'Ulangan',
      mapel_nama: null,
      kelas_nama: null,
      alasan_min: 10,
      jumlah: 1,
      item: [itemKoreksi({ murid_id: null, murid_nama: null, no_attempt: null })],
    })

    expect(data.mapel_nama).toBeNull()
    expect(data.item[0].murid_nama).toBeNull()
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
})
