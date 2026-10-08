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
import { useSimpananJawaban } from '../../../sections/attempt/simpananJawaban.js'
import { klienQuery } from '../../../shared/store/klienQuery.js'

const userContoh = {
  id: 1,
  name: 'Rina',
  email: 'rina@sekolah.test',
  role: 'murid',
  status: 'aktif',
  statusLabel: 'Aktif',
  emailTerverifikasi: true,
}

describe('jejak sesi di perangkat bersama', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: userContoh, sesiSiap: true, detikTunggu: 0 })
    useSimpananJawaban.setState({ perAttempt: {} })
    localStorage.clear()
    klienQuery.clear()
  })

  /** Isi jejak murid sebelumnya di perangkat: cadangan jawaban + cache query. */
  function tinggalkanJejak() {
    useSimpananJawaban.getState().catat(7, 21, 'B')
    klienQuery.setQueryData(['attempt', 7], { jawaban: 'B', nama: 'Rina' })

    expect(localStorage.getItem('ulangan-cadangan-jawaban-v1')).toContain('"21"')
  }

  // S-14: komputer lab dipakai bergantian — murid berikutnya tidak boleh bisa
  // membaca jawaban (atau data apa pun) milik murid sebelumnya dari perangkat.
  it('keluar membuang cadangan jawaban lokal dan cache query', async () => {
    vi.mocked(keluarApi).mockResolvedValue(undefined)
    tinggalkanJejak()

    await useAuthStore.getState().keluar()

    expect(useAuthStore.getState().user).toBeNull()
    expect(useSimpananJawaban.getState().perAttempt).toEqual({})
    expect(localStorage.getItem('ulangan-cadangan-jawaban-v1')).not.toContain('"21"')
    expect(klienQuery.getQueryData(['attempt', 7])).toBeUndefined()
  })

  it('sesi habis sendiri (401/419) membersihkan jejak yang sama', () => {
    tinggalkanJejak()
    pasangListenerSesi()

    window.dispatchEvent(new Event('auth:sesi-habis'))

    expect(useAuthStore.getState().user).toBeNull()
    expect(useSimpananJawaban.getState().perAttempt).toEqual({})
    expect(klienQuery.getQueryData(['attempt', 7])).toBeUndefined()
  })

  it('server menolak keluar pun, jejak tetap dibersihkan', async () => {
    vi.mocked(keluarApi).mockRejectedValue(new Error('jaringan'))
    tinggalkanJejak()

    await expect(useAuthStore.getState().keluar()).rejects.toThrow('jaringan')

    expect(useAuthStore.getState().user).toBeNull()
    expect(useSimpananJawaban.getState().perAttempt).toEqual({})
    expect(klienQuery.getQueryData(['attempt', 7])).toBeUndefined()
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
