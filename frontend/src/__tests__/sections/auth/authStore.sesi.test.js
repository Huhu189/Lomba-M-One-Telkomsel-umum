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

import { ambilSaya, cekTerautentikasi } from '../../../sections/auth/api.js'
import { sudahDitampilkanSebagaiTunggu, useAuthStore } from '../../../sections/auth/authStore.js'

const userContoh = {
  id: 1,
  name: 'Rina',
  email: 'rina@sekolah.test',
  role: 'murid',
  status: 'aktif',
  statusLabel: 'Aktif',
  emailTerverifikasi: true,
}

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
