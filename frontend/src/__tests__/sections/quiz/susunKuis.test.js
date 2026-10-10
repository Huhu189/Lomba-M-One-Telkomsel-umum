/**
 * Tes aturan alur susun kuis tiga langkah (papan 10). Daftar kelengkapan di sini
 * adalah cermin KuisService::galatKelengkapan() di backend, jadi tesnya menjaga
 * agar tombol "Publikasikan kuis" tidak menyala untuk kuis yang pasti ditolak.
 */
import { describe, expect, it } from 'vitest'
import {
  LANGKAH_KUIS,
  jadwalWajar,
  kelengkapanKuis,
  ringkasJadwal,
  siapTerbit,
  totalPoin,
} from '../../../sections/quiz/susunKuis.js'

/** Isi formulir yang sudah lengkap; tes mengubah satu bidang saja. */
const LENGKAP = {
  judul: 'Ulangan Harian IPA Bab 3',
  subject_id: '1',
  class_id: '2',
  durasi_menit: '60',
  mulai_at: '2026-10-12T08:00',
  selesai_at: '2026-10-12T09:00',
}

const SUSUNAN = { jumlahSoal: 4, adaSoalNonaktif: false }

describe('LANGKAH_KUIS', () => {
  it('tiga langkah sesuai papan desain', () => {
    expect(LANGKAH_KUIS).toEqual(['Info dan jadwal', 'Susun soal', 'Tinjau dan publikasi'])
  })
})

describe('kelengkapanKuis', () => {
  it('semua butir lengkap untuk kuis yang siap terbit', () => {
    const butir = kelengkapanKuis(LENGKAP, SUSUNAN)

    expect(butir.every((satu) => satu.ok)).toBe(true)
    expect(siapTerbit(butir)).toBe(true)
    expect(butir.map((satu) => satu.teks)).toEqual([
      'Judul terisi (minimal 3 huruf)',
      'Mapel dipilih',
      'Kelas dipilih',
      'Durasi lebih dari 0 menit',
      'Jadwal mulai dan selesai terisi',
      'Jadwal selesai setelah jadwal mulai',
      'Minimal satu soal dipilih',
      'Semua soal yang dipilih aktif',
    ])
  })

  it('menandai tiap bidang yang belum diisi, termasuk judul terlalu pendek', () => {
    const butir = kelengkapanKuis(
      { ...LENGKAP, judul: 'ab', subject_id: '', class_id: '', durasi_menit: '0' },
      { jumlahSoal: 0, adaSoalNonaktif: false },
    )

    const belum = butir.filter((satu) => !satu.ok).map((satu) => satu.teks)
    expect(belum).toEqual([
      'Judul terisi (minimal 3 huruf)',
      'Mapel dipilih',
      'Kelas dipilih',
      'Durasi lebih dari 0 menit',
      'Minimal satu soal dipilih',
    ])
    expect(siapTerbit(butir)).toBe(false)
  })

  it('jadwal kosong ditandai belum lengkap, bukan dianggap salah', () => {
    const kosong = kelengkapanKuis({ ...LENGKAP, mulai_at: '', selesai_at: '' }, SUSUNAN)
    const jadwal = kosong.filter((satu) => satu.teks.startsWith('Jadwal'))

    expect(jadwal).toEqual([
      { ok: false, teks: 'Jadwal mulai dan selesai terisi' },
      { ok: true, teks: 'Jadwal selesai setelah jadwal mulai' },
    ])
  })

  it('jadwal yang terbalik ditolak (cermin aturan after:mulai_at di server)', () => {
    const butir = kelengkapanKuis(
      { ...LENGKAP, mulai_at: '2026-10-12T09:00', selesai_at: '2026-10-12T08:00' },
      SUSUNAN,
    )

    expect(jadwalWajar('2026-10-12T09:00', '2026-10-12T08:00')).toBe(false)
    expect(butir.find((satu) => satu.teks === 'Jadwal selesai setelah jadwal mulai')?.ok).toBe(false)
  })

  it('soal nonaktif di susunan menahan publikasi (aturan galatKelengkapan)', () => {
    const butir = kelengkapanKuis(LENGKAP, { jumlahSoal: 3, adaSoalNonaktif: true })

    expect(butir.find((satu) => satu.teks === 'Semua soal yang dipilih aktif')?.ok).toBe(false)
    expect(siapTerbit(butir)).toBe(false)
  })
})

describe('ringkasJadwal', () => {
  it('menyebut jadwal kosong secara jujur', () => {
    expect(ringkasJadwal('', '')).toBe('Tanpa jadwal')
  })

  it('menampilkan rentang jadwal dari waktu lokal', () => {
    const teks = ringkasJadwal('2026-10-12T08:00', '2026-10-12T09:00')

    expect(teks).toContain(' s.d. ')
    expect(teks).not.toContain('Invalid Date')
  })

  it('menandai sisi yang belum diisi dengan tanda pisah', () => {
    expect(ringkasJadwal('2026-10-12T08:00', '').endsWith('s.d. —')).toBe(true)
    expect(ringkasJadwal('', '2026-10-12T09:00').startsWith('— s.d.')).toBe(true)
  })
})

describe('totalPoin', () => {
  it('menjumlahkan skor soal yang dipilih saja', () => {
    const katalog = [
      { id: 1, skor: 10 },
      { id: 2, skor: 5 },
      { id: 3, skor: 15 },
    ]

    expect(totalPoin([1, 3], katalog)).toBe(25)
  })

  it('soal yang belum termuat di halaman bank soal dihitung 0, bukan NaN', () => {
    expect(totalPoin([9], [{ id: 1, skor: 10 }])).toBe(0)
  })
})
