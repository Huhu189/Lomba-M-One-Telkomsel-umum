/**
 * Uji parameter daftar akun panel admin.
 *
 * Satu hal kecil yang mudah salah dan mahal: mengirim saringan kosong. Server
 * akan memperlakukannya sebagai penyaring sungguhan (`filter[role]=`), sehingga
 * daftar tampak kosong padahal datanya ada — dan tiap ketikan baru membuat
 * alamat kueri berbeda, jadi cache ikut pecah. Karena itu spasi di ujung kata
 * kunci dipotong lebih dulu di sini.
 */
import { describe, expect, it } from 'vitest'
import { paramAkun, skemaMonitorSekolah } from '../../../sections/admin/api.js'

describe('paramAkun', () => {
  it('tanpa opsi hanya mengirim halaman pertama', () => {
    expect(paramAkun()).toEqual({ page: 1 })
  })

  it('saringan kosong tidak dikirim sama sekali', () => {
    const params = paramAkun({ peran: '', status: '', cari: '   ' })

    expect(params).toEqual({ page: 1 })
    expect(params).not.toHaveProperty('filter[role]')
    expect(params).not.toHaveProperty('filter[status]')
    expect(params).not.toHaveProperty('filter[cari]')
  })

  it('memotong spasi di ujung kata kunci', () => {
    expect(paramAkun({ cari: '  rina  ' })['filter[cari]']).toBe('rina')
    expect(paramAkun({ cari: 'rina' })).toEqual(paramAkun({ cari: '  rina  ' }))
  })

  it('mengirim saringan yang benar-benar diisi', () => {
    expect(paramAkun({ halaman: 3, peran: 'guru', status: 'suspended', cari: 'budi' })).toEqual({
      page: 3,
      'filter[role]': 'guru',
      'filter[status]': 'suspended',
      'filter[cari]': 'budi',
    })
  })
})

describe('skemaMonitorSekolah', () => {
  const dasar = {
    sekolah: { nama: 'SD Negeri 1', npsn: null, tahun_ajaran: null },
    server_now: '2026-10-14T02:00:00Z',
    menit_online: 5,
    murid: {
      total: 0,
      akun: 0,
      aktif: 0,
      online: 0,
      mengerjakan: 0,
      belum_verifikasi: 0,
      ditangguhkan: 0,
    },
    guru: { total: 1, aktif: 1, online: 0, ditangguhkan: 0, admin: 1 },
    kelas: { total: 0, daftar: [] },
    kuis: {
      total: 0,
      terbit: 0,
      draf: 0,
      arsip: 0,
      aktif: 0,
      attempt_hari_ini: 0,
      dikumpulkan_hari_ini: 0,
      koreksi_menunggu: 0,
      kejadian_hari_ini: 0,
    },
    angka: [],
    kuis_berjalan: [],
    aktivitas: [],
  }

  it('menerima snapshot lengkap tanpa satu pun bagian', () => {
    expect(skemaMonitorSekolah.parse(dasar).guru.admin).toBe(1)
  })

  it('menolak snapshot yang kehilangan bagiannya', () => {
    // Dasbor membaca `kuis.koreksi_menunggu` langsung; respons yang tidak lengkap
    // harus ketahuan di sini, bukan menjadi `undefined` di tengah halaman.
    /** @type {Record<string, unknown>} */
    const tanpaKuis = { ...dasar }
    delete tanpaKuis.kuis

    expect(() => skemaMonitorSekolah.parse(tanpaKuis)).toThrow()
  })
})
