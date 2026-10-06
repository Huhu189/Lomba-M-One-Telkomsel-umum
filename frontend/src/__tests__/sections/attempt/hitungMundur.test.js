import { describe, expect, it } from 'vitest'
import { formatSisa, geserJamMs, sisaDetik, sisaDetikAttempt, tingkatWaktu } from '../../../sections/attempt/hitungMundur.js'

const ISO = '2026-10-06T10:00:00+07:00'

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
  it('memakai jam server, bukan jam klien', () => {
    const serverNow = ISO
    // Jam klien mundur 10 menit, jadi tanpa koreksi murid merasa punya 10 menit ekstra.
    const jamKlien = Date.parse(serverNow) - 600_000

    // Deadline 30 menit setelah server_now → tetap 1800 detik.
    expect(
      sisaDetik({ deadlineIso: '2026-10-06T10:30:00+07:00', serverNowIso: serverNow, sekarangMs: jamKlien }),
    ).toBe(1800)
  })

  it('tidak pernah negatif setelah deadline lewat', () => {
    const serverNow = Date.parse(ISO)

    expect(
      sisaDetik({
        deadlineIso: '2026-10-06T09:30:00+07:00',
        serverNowIso: ISO,
        sekarangMs: serverNow,
      }),
    ).toBe(0)
  })

  it('mengembalikan 0 bila deadline tidak terbaca', () => {
    expect(sisaDetik({ deadlineIso: '', serverNowIso: ISO, sekarangMs: Date.now() })).toBe(0)
  })
})

describe('sisaDetikAttempt', () => {
  it('menghitung dari payload attempt', () => {
    const attempt = {
      deadline_at: '2026-10-06T10:10:00+07:00',
      server_now: ISO,
    }

    expect(sisaDetikAttempt(attempt, Date.parse(ISO))).toBe(600)
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
