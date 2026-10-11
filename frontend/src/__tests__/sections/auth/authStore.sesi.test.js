/**
 * @vitest-environment jsdom
 *
 * Pemulihan sesi saat refresh + penanganan 429 agar pesan tidak dobel.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../sections/auth/api.js', () => ({
  ambilSaya: vi.fn(),
  cekTerautentikasi: vi.fn(),
  keluar: vi.fn(),
  masuk: vi.fn(),
}))

import { ambilSaya, cekTerautentikasi, keluar as keluarApi } from '../../../sections/auth/api.js'
import {
  pasangListenerSesi,
  sudahDitampilkanSebagaiTunggu,
  useAuthStore,
} from '../../../sections/auth/authStore.js'
import { useRiwayatJawaban } from '../../../sections/attempt/riwayatJawaban.js'
import { useSimpananJawaban } from '../../../sections/attempt/simpananJawaban.js'
import { klienQuery } from '../../../shared/store/klienQuery.js'

/** Kunci salinan soal mode luring (isi tidak penting: yang diuji jejaknya). */
const KUNCI_SNAPSHOT = 'ulangan-snapshot-attempt-v1'

const userContoh = {
  id: 1,
  name: 'Rina',
  email: 'rina@sekolah.test',
  role: 'murid',
  status: 'aktif',
  statusLabel: 'Aktif',
  emailTerverifikasi: true,
  // Akun murid biasa: bukan siswa tamu (mode tamu tanpa login).
  isTamu: false,
}

describe('jejak sesi di perangkat bersama', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: userContoh, sesiSiap: true, detikTunggu: 0 })
    useSimpananJawaban.setState({ perAttempt: {} })
    useRiwayatJawaban.setState({ perAttempt: {} })
    localStorage.clear()
    klienQuery.clear()
  })

  /**
   * Isi jejak murid sebelumnya di perangkat: cadangan jawaban, riwayat jawaban,
   * salinan soal mode luring, dan cache query.
   */
  function tinggalkanJejak() {
    useSimpananJawaban.getState().catat(7, 21, 'B')
    useRiwayatJawaban.getState().catat(7, {
      soal_id: 21,
      nomor: 1,
      tipe: 'pilihan_ganda',
      jawaban: 'B',
      server_at: new Date().toISOString(),
    })
    localStorage.setItem(KUNCI_SNAPSHOT, '{"7":{"disimpanAt":1,"attempt":{}}}')
    klienQuery.setQueryData(['attempt', 7], { jawaban: 'B', nama: 'Rina' })

    expect(localStorage.getItem('ulangan-cadangan-jawaban-v1')).toContain('"21"')
    expect(localStorage.getItem(KUNCI_SNAPSHOT)).not.toBeNull()
  }

  /** Seluruh jejak data murid harus hilang dari perangkat bersama. */
  function harapJejakBersih() {
    expect(useSimpananJawaban.getState().perAttempt).toEqual({})
    expect(useRiwayatJawaban.getState().perAttempt).toEqual({})
    expect(localStorage.getItem(KUNCI_SNAPSHOT)).toBeNull()
    expect(klienQuery.getQueryData(['attempt', 7])).toBeUndefined()
  }

  // S-14: komputer lab dipakai bergantian — murid berikutnya tidak boleh bisa
  // membaca jawaban (atau data apa pun) milik murid sebelumnya dari perangkat.
  it('keluar membuang cadangan jawaban lokal dan cache query', async () => {
    vi.mocked(keluarApi).mockResolvedValue(undefined)
    tinggalkanJejak()

    await useAuthStore.getState().keluar()

    expect(useAuthStore.getState().user).toBeNull()
    expect(localStorage.getItem('ulangan-cadangan-jawaban-v1')).not.toContain('"21"')
    harapJejakBersih()
  })

  it('sesi habis sendiri (401/419) membersihkan jejak yang sama', () => {
    tinggalkanJejak()
    pasangListenerSesi()

    window.dispatchEvent(new Event('auth:sesi-habis'))

    expect(useAuthStore.getState().user).toBeNull()
    harapJejakBersih()
  })

  it('server menolak keluar pun, jejak tetap dibersihkan', async () => {
    vi.mocked(keluarApi).mockRejectedValue(new Error('jaringan'))
    tinggalkanJejak()

    await expect(useAuthStore.getState().keluar()).rejects.toThrow('jaringan')

    expect(useAuthStore.getState().user).toBeNull()
    harapJejakBersih()
  })

  // Identitas tamu adalah kode perangkat, jadi tamu yang menekan Keluar di
  // komputer bersama harus meninggalkan kodenya: tanpa itu anak berikutnya di
  // perangkat itu masuk ke akun (dan hasil ulangan) anak sebelumnya.
  it('tamu yang keluar membuang kode perangkatnya', async () => {
    vi.mocked(keluarApi).mockResolvedValue(undefined)
    useAuthStore.setState({ user: { ...userContoh, id: 9, isTamu: true } })
    localStorage.setItem('ulangan:perangkat-tamu', 'perangkat-tamu-0001')

    await useAuthStore.getState().keluar()

    expect(localStorage.getItem('ulangan:perangkat-tamu')).toBeNull()
  })

  it('sesi tamu yang habis sendiri TIDAK membuang kode perangkat (pekerjaannya tidak hilang)', () => {
    useAuthStore.setState({ user: { ...userContoh, id: 9, isTamu: true } })
    localStorage.setItem('ulangan:perangkat-tamu', 'perangkat-tamu-0001')
    pasangListenerSesi()

    window.dispatchEvent(new Event('auth:sesi-habis'))

    expect(localStorage.getItem('ulangan:perangkat-tamu')).toBe('perangkat-tamu-0001')
  })

  it('murid biasa yang keluar tidak menyentuh kode perangkat tamu', async () => {
    vi.mocked(keluarApi).mockResolvedValue(undefined)
    localStorage.setItem('ulangan:perangkat-tamu', 'perangkat-tamu-0001')

    await useAuthStore.getState().keluar()

    expect(localStorage.getItem('ulangan:perangkat-tamu')).toBe('perangkat-tamu-0001')
  })
})

describe('pulihkanSesi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: null, sesiSiap: false, detikTunggu: 0 })
  })

  it('sesi aktif di server → user dimuat dan sesiSiap true', async () => {
    vi.mocked(cekTerautentikasi).mockResolvedValue(true)
    vi.mocked(ambilSaya).mockResolvedValue(userContoh)

    await useAuthStore.getState().pulihkanSesi()

    expect(useAuthStore.getState().user).toEqual(userContoh)
    expect(useAuthStore.getState().sesiSiap).toBe(true)
  })

  it('tamu → tidak memanggil /auth/saya (tanpa 401 dan tanpa toast sesi berakhir)', async () => {
    vi.mocked(cekTerautentikasi).mockResolvedValue(false)

    await useAuthStore.getState().pulihkanSesi()

    expect(ambilSaya).not.toHaveBeenCalled()
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().sesiSiap).toBe(true)
  })

  it('backend mati → tetap siap sebagai tamu (tidak menggantung di layar muat)', async () => {
    vi.mocked(cekTerautentikasi).mockRejectedValue(new Error('network'))

    await useAuthStore.getState().pulihkanSesi()

    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().sesiSiap).toBe(true)
  })
})

describe('sudahDitampilkanSebagaiTunggu', () => {
  beforeEach(() => useAuthStore.setState({ detikTunggu: 0 }))

  it('429 dengan hitung mundur aktif → true (banner tunggu sudah menjelaskan)', () => {
    useAuthStore.setState({ detikTunggu: 20 })
    expect(sudahDitampilkanSebagaiTunggu({ response: { status: 429 } })).toBe(true)
  })

  it('429 tanpa Retry-After → false (pesan server tetap ditampilkan)', () => {
    expect(sudahDitampilkanSebagaiTunggu({ response: { status: 429 } })).toBe(false)
  })

  it('galat lain → false', () => {
    useAuthStore.setState({ detikTunggu: 20 })
    expect(sudahDitampilkanSebagaiTunggu({ response: { status: 422 } })).toBe(false)
    expect(sudahDitampilkanSebagaiTunggu(new Error('x'))).toBe(false)
  })
})
