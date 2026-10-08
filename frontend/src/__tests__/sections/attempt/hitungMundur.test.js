import { describe, expect, it } from 'vitest'
import {
  formatSisa,
  geserJamMs,
  offsetAttemptMs,
  sisaDetik,
  sisaDetikAttempt,
  tingkatWaktu,
} from '../../../sections/attempt/hitungMundur.js'

const ISO = '2026-10-06T10:00:00+07:00'
const DEADLINE = '2026-10-06T10:30:00+07:00'

describe('geserJamMs', () => {
  it('menghitung selisih jam server terhadap jam klien', () => {
    // Jam klien 5 menit tertinggal dari server.
    const jamKlien = Date.parse(ISO) - 300_000

    expect(geserJamMs(ISO, jamKlien)).toBe(300_000)
  })

  it('mengembalikan 0 bila jam server tidak terbaca', () => {
    expect(geserJamMs('bukan-tanggal', Date.now())).toBe(0)
  })
})

describe('sisaDetik', () => {
  // Q-01: offset dihitung SEKALI saat respons diterima, bukan tiap detak.
  it('berkurang seiring waktu berjalan', () => {
    const awal = Date.parse(ISO)

    expect(sisaDetik({ deadlineIso: DEADLINE, offsetMs: 0, sekarangMs: awal })).toBe(1800)
    expect(sisaDetik({ deadlineIso: DEADLINE, offsetMs: 0, sekarangMs: awal + 60_000 })).toBe(1740)
    expect(sisaDetik({ deadlineIso: DEADLINE, offsetMs: 0, sekarangMs: awal + 1_799_000 })).toBe(1)
  })

  it('tidak memberi waktu ekstra saat jam klien dimundurkan', () => {
    // Jam klien mundur 10 menit; offset dihitung sekali dari respons server.
    const jamKlien = Date.parse(ISO) - 600_000
    const offsetMs = geserJamMs(ISO, jamKlien)

    // Tanpa koreksi murid merasa punya 10 menit ekstra; dengan offset tetap 1800.
    expect(sisaDetik({ deadlineIso: DEADLINE, offsetMs, sekarangMs: jamKlien })).toBe(1800)
    expect(sisaDetik({ deadlineIso: DEADLINE, offsetMs, sekarangMs: jamKlien + 30_000 })).toBe(1770)
  })

  it('tidak pernah negatif setelah deadline lewat', () => {
    const serverNow = Date.parse(ISO)

    expect(
      sisaDetik({
        deadlineIso: '2026-10-06T09:30:00+07:00',
        offsetMs: 0,
        sekarangMs: serverNow,
      }),
    ).toBe(0)
  })

  it('mengembalikan 0 bila deadline tidak terbaca', () => {
    expect(sisaDetik({ deadlineIso: '', offsetMs: 0, sekarangMs: Date.now() })).toBe(0)
  })
})

describe('offsetAttemptMs', () => {
  it('menghitung offset dari payload attempt', () => {
    const jamKlien = Date.parse(ISO) + 120_000

    expect(offsetAttemptMs({ server_now: ISO }, jamKlien)).toBe(-120_000)
  })
})

describe('sisaDetikAttempt', () => {
  it('menghitung dari payload attempt memakai offset tetap', () => {
    const attempt = {
      deadline_at: '2026-10-06T10:10:00+07:00',
      server_now: ISO,
    }
    const jamKlien = Date.parse(ISO)
    const offsetMs = offsetAttemptMs(attempt, jamKlien)

    expect(sisaDetikAttempt(attempt, jamKlien, offsetMs)).toBe(600)
    expect(sisaDetikAttempt(attempt, jamKlien + 120_000, offsetMs)).toBe(480)
  })
})

describe('formatSisa', () => {
  it('memakai MM:SS di bawah satu jam', () => {
    expect(formatSisa(0)).toBe('00:00')
    expect(formatSisa(65)).toBe('01:05')
    expect(formatSisa(3599)).toBe('59:59')
  })

  it('memakai H:MM:SS di atas satu jam', () => {
    expect(formatSisa(3600)).toBe('1:00:00')
    expect(formatSisa(3661)).toBe('1:01:01')
  })
})

describe('tingkatWaktu', () => {
  it('menandai peringatan 5 menit dan kritis 1 menit', () => {
    expect(tingkatWaktu(1800)).toBe('aman')
    expect(tingkatWaktu(300)).toBe('peringatan')
    expect(tingkatWaktu(61)).toBe('peringatan')
    expect(tingkatWaktu(60)).toBe('kritis')
    expect(tingkatWaktu(0)).toBe('kritis')
  })
})
