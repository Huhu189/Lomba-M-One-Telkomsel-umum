import { describe, expect, it } from 'vitest'
import {
  angkaBeranda,
  bagiJadwal,
  diHariIni,
  diMingguIni,
  perluPerhatian,
  urutTampil,
} from '../../../sections/home/dashboard.js'

/** Sabtu, 10 Oktober 2026, 09.00 (waktu lokal). */
const acuan = new Date(2026, 9, 10, 9, 0, 0)

/** @param {Date} waktu */
const iso = (waktu) => waktu.toISOString()

/** @param {Partial<{id: number, judul: string, status: string, sedang_berjalan: boolean, mulai_at: string|null, kelas_nama: string, jumlah_soal: number}>} isi */
function kuis(isi) {
  return {
    id: 1,
    judul: 'Kuis',
    status: 'publikasi',
    sedang_berjalan: false,
    mulai_at: null,
    ...isi,
  }
}

describe('diHariIni', () => {
  it('benar hanya pada tanggal yang sama', () => {
    expect(diHariIni(iso(new Date(2026, 9, 10, 7, 0)), acuan)).toBe(true)
    expect(diHariIni(iso(new Date(2026, 9, 11, 7, 0)), acuan)).toBe(false)
  })

  it('null, kosong, dan tanggal rusak tidak dianggap hari ini', () => {
    expect(diHariIni(null, acuan)).toBe(false)
    expect(diHariIni('bukan-tanggal', acuan)).toBe(false)
  })
})

describe('diMingguIni', () => {
  it('memakai minggu Senin–Minggu', () => {
    expect(diMingguIni(iso(new Date(2026, 9, 5, 8, 0)), acuan)).toBe(true) // Senin
    expect(diMingguIni(iso(new Date(2026, 9, 11, 23, 0)), acuan)).toBe(true) // Minggu
    expect(diMingguIni(iso(new Date(2026, 9, 4, 23, 59)), acuan)).toBe(false) // Minggu sebelumnya
    expect(diMingguIni(iso(new Date(2026, 9, 12, 0, 1)), acuan)).toBe(false) // Senin depan
  })
})

describe('urutTampil', () => {
  it('yang sedang berjalan di atas, lalu menurut waktu mulai, draf paling bawah', () => {
    const daftar = [
      kuis({ id: 1, judul: 'Draf', status: 'draf' }),
      kuis({ id: 2, judul: 'Siang', mulai_at: iso(new Date(2026, 9, 10, 13, 0)) }),
      kuis({ id: 3, judul: 'Berjalan', sedang_berjalan: true }),
      kuis({ id: 4, judul: 'Pagi', mulai_at: iso(new Date(2026, 9, 10, 8, 0)) }),
    ]
    expect(urutTampil(daftar).map((satu) => satu.judul)).toEqual([
      'Berjalan',
      'Pagi',
      'Siang',
      'Draf',
    ])
  })
})

describe('bagiJadwal', () => {
  const daftar = [
    kuis({ id: 1, judul: 'Hari ini', mulai_at: iso(new Date(2026, 9, 10, 8, 0)) }),
    kuis({ id: 2, judul: 'Awal minggu', mulai_at: iso(new Date(2026, 9, 7, 10, 0)) }),
    kuis({ id: 3, judul: 'Minggu depan', mulai_at: iso(new Date(2026, 9, 13, 10, 0)) }),
    kuis({ id: 4, judul: 'Draf baru', status: 'draf' }),
    kuis({ id: 5, judul: 'Arsip', status: 'arsip' }),
  ]

  it('tab hari ini hanya memuat kuis hari ini (plus draf, tanpa arsip)', () => {
    const jadwal = bagiJadwal(daftar, acuan)
    expect(jadwal.hari.map((satu) => satu.judul)).toEqual(['Hari ini', 'Draf baru'])
  })

  it('tab minggu ini memuat seluruh minggu berjalan, bukan minggu depan', () => {
    const jadwal = bagiJadwal(daftar, acuan)
    expect(jadwal.minggu.map((satu) => satu.judul)).toEqual(['Awal minggu', 'Hari ini', 'Draf baru'])
    expect(jadwal.minggu.map((satu) => satu.judul)).not.toContain('Minggu depan')
    expect(jadwal.minggu.map((satu) => satu.judul)).not.toContain('Arsip')
  })

  it('mempertahankan objek kuis apa adanya (bukan menyalin ke bentuk lain)', () => {
    const jadwal = bagiJadwal(daftar, acuan)
    expect(jadwal.hari[0]).toBe(daftar[0])
  })
})

describe('angkaBeranda', () => {
  it('menghitung kuis hari ini, koreksi, murid, dan kelas', () => {
    const angka = angkaBeranda(
      {
        kuis: [
          kuis({ id: 1, mulai_at: iso(new Date(2026, 9, 10, 8, 0)) }),
          kuis({ id: 2, sedang_berjalan: true }),
          kuis({ id: 3, status: 'draf' }),
        ],
        jumlahMurid: 186,
        jumlahKelas: 6,
        menungguKoreksi: 14,
      },
      acuan,
    )

    expect(angka.map((satu) => `${satu.label}=${satu.nilai}`)).toEqual([
      'Kuis hari ini=2',
      'Menunggu koreksi=14',
      'Murid=186',
      'Kuis tersimpan=3',
    ])
    expect(angka[2].ket).toBe('Di 6 kelas')
  })
})

describe('perluPerhatian', () => {
  it('mengosongkan daftar bila tidak ada keadaan mendesak', () => {
    expect(perluPerhatian({ kuisBerjalan: null, koreksi: null, laporanAvatar: 0 })).toEqual([])
    expect(
      perluPerhatian({ kuisBerjalan: null, koreksi: { judul: 'A', jumlah: 0 }, laporanAvatar: 0 }),
    ).toEqual([])
  })

  it('urutannya: berlangsung, koreksi, lalu laporan avatar', () => {
    const daftar = perluPerhatian({
      kuisBerjalan: kuis({ id: 9, judul: 'IPA Bab 3', sedang_berjalan: true, kelas_nama: '5A', jumlah_soal: 8 }),
      koreksi: { judul: 'Matematika: Pecahan', jumlah: 14 },
      laporanAvatar: 3,
    })

    expect(daftar.map((satu) => satu.jenis)).toEqual(['monitor', 'koreksi', 'avatar'])
    expect(daftar[0].judul).toContain('IPA Bab 3')
    expect(daftar[0].ket).toContain('5A')
    expect(daftar[1].judul).toBe('14 jawaban menunggu koreksi')
    expect(daftar[1].aksi).toBe('Mulai koreksi')
    expect(daftar[2].judul).toBe('3 laporan avatar belum ditinjau')
  })
})
