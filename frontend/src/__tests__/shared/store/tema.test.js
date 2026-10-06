// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bacaTemaAwal, mulaiTema, terapkanTema, useTemaStore } from '../../../shared/store/tema.js'

/** @param {boolean} gelap */
function setPrefersDark(gelap) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: gelap })
}

describe('tema', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-bs-theme')
    setPrefersDark(false)
  })

  it('tanpa pilihan tersimpan mengikuti pengaturan perangkat', () => {
    setPrefersDark(true)
    expect(bacaTemaAwal()).toBe('gelap')
    setPrefersDark(false)
    expect(bacaTemaAwal()).toBe('terang')
  })

  it('pilihan tersimpan menang atas pengaturan perangkat', () => {
    setPrefersDark(true)
    window.localStorage.setItem('tema-ulangan', 'terang')
    expect(bacaTemaAwal()).toBe('terang')
  })

  it('nilai tersimpan yang tidak sah diabaikan (divalidasi Zod)', () => {
    window.localStorage.setItem('tema-ulangan', '<script>')
    expect(bacaTemaAwal()).toBe('terang')
  })

  it('localStorage yang melempar galat tidak merusak aplikasi', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('diblokir')
    })
    expect(bacaTemaAwal()).toBe('terang')
    spy.mockRestore()
  })

  it('terapkanTema memasang data-bs-theme', () => {
    terapkanTema('gelap')
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark')
    terapkanTema('terang')
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('light')
  })

  it('balik() mengganti tema, menerapkan, dan menyimpan pilihan', () => {
    mulaiTema()
    expect(useTemaStore.getState().tema).toBe('terang')
    useTemaStore.getState().balik()
    expect(useTemaStore.getState().tema).toBe('gelap')
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark')
    expect(window.localStorage.getItem('tema-ulangan')).toBe('gelap')
  })
})
