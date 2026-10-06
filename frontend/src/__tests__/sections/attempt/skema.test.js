import { describe, expect, it } from 'vitest'
import { kunciIdempotensiBaru, skemaAttempt, skemaHasil, skemaSoalKerjakan } from '../../../sections/attempt/api.js'

/** Contoh payload GET /attempt/{id} (hasil server, tanpa kunci). */
const attemptContoh = {
  id: 3,
  quiz_id: 1,
  jenis: 'ulangan',
  jenis_label: 'Ulangan',
  status: 'berjalan',
  status_label: 'Sedang dikerjakan',
  judul_kuis: 'Ulangan Operasi Hitung',
  mapel_nama: 'Matematika',
  kelas_nama: '5A',
  durasi_menit: 30,
  mulai_at: '2026-10-06T10:00:00+07:00',
  deadline_at: '2026-10-06T10:30:00+07:00',
  server_now: '2026-10-06T10:00:00+07:00',
  sisa_detik: 1799,
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

describe('skema attempt', () => {
  it('menerima payload attempt berjalan', () => {
    const attempt = skemaAttempt.parse(attemptContoh)

    expect(attempt.soal).toHaveLength(1)
    expect(attempt.jawaban[0].jawaban).toBe('B')
    expect(attempt.sisa_detik).toBe(1799)
  })

  it('menolak soal tanpa bentuk konten yang benar', () => {
    expect(() => skemaSoalKerjakan.parse({ ...attemptContoh.soal[0], konten: 'teks bebas' })).toThrow()
  })

  it('menerima mapel/kelas kosong dan jawaban kosong', () => {
    const attempt = skemaAttempt.parse({ ...attemptContoh, mapel_nama: null, kelas_nama: null, jawaban: [] })

    expect(attempt.mapel_nama).toBeNull()
    expect(attempt.jawaban).toHaveLength(0)
  })
})

describe('skema hasil', () => {
  it('menerima hasil lengkap dengan rincian per soal', () => {
    const hasil = skemaHasil.parse({
      id: 3,
      quiz_id: 1,
      jenis: 'ulangan',
      jenis_label: 'Ulangan',
      status: 'selesai',
      status_label: 'Sudah dikumpulkan',
      judul_kuis: 'Ulangan Operasi Hitung',
      mapel_nama: 'Matematika',
      kelas_nama: '5A',
      mulai_at: '2026-10-06T10:00:00+07:00',
      deadline_at: '2026-10-06T10:30:00+07:00',
      dikumpulkan_at: '2026-10-06T10:20:00+07:00',
      terlambat: false,
      skor: 5,
      skor_maksimal: 5,
      jumlah_benar: 1,
      jumlah_soal: 1,
      per_soal: [
        {
          question_id: 12,
          nomor: 1,
          tipe: 'pilihan_ganda',
          tipe_label: 'Pilihan ganda',
          status: 'dinilai',
          status_label: 'Dinilai',
          benar: true,
          skor: 5,
          skor_maksimal: 5,
          terjawab: true,
        },
      ],
      ringkasan_penilaian: { dinilai: 1, perlu_tinjau: 0, gagal: 0, belum_dijawab: 0 },
    })

    expect(hasil.per_soal[0].benar).toBe(true)
    expect(hasil.ringkasan_penilaian.dinilai).toBe(1)
  })

  it('menolak rincian tanpa status penilaian', () => {
    expect(() =>
      skemaHasil.parse({
        id: 1,
        quiz_id: 1,
        jenis: 'ulangan',
        jenis_label: 'Ulangan',
        status: 'selesai',
        status_label: 'Sudah dikumpulkan',
        mulai_at: 'x',
        deadline_at: 'y',
        dikumpulkan_at: null,
        terlambat: false,
        skor: 0,
        skor_maksimal: 0,
        jumlah_benar: 0,
        jumlah_soal: 0,
        per_soal: [{ question_id: 1 }],
        ringkasan_penilaian: { dinilai: 0, perlu_tinjau: 0, gagal: 0, belum_dijawab: 0 },
      }),
    ).toThrow()
  })
})

describe('kunciIdempotensiBaru', () => {
  it('menghasilkan kunci yang panjangnya wajar dan berbeda tiap panggilan', () => {
    const satu = kunciIdempotensiBaru()
    const dua = kunciIdempotensiBaru()

    expect(satu.length).toBeGreaterThanOrEqual(8)
    expect(satu.length).toBeLessThanOrEqual(64)
    expect(satu).not.toBe(dua)
  })
})
