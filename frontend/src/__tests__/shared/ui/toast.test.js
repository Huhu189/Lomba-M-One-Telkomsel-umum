import { describe, expect, it } from 'vitest'
import { useToastStore } from '../../../shared/ui/toast.jsx'

describe('store toast', () => {
  it('push menambah toast dengan id unik', () => {
    const store = useToastStore.getState()
    store.toasts.length && useToastStore.setState({ toasts: [] })

    const idA = store.push({ jenis: 'info', pesan: 'pertama' })
    const idB = store.push({ jenis: 'sukses', pesan: 'kedua' })

    expect(idA).not.toBe(idB)
    expect(useToastStore.getState().toasts).toHaveLength(2)
    expect(useToastStore.getState().toasts[0].pesan).toBe('pertama')
  })

  it('dismiss menghapus toast berdasarkan id', () => {
    useToastStore.setState({ toasts: [] })
    const store = useToastStore.getState()
    const id = store.push({ jenis: 'salah', pesan: 'hapus saya' })

    useToastStore.getState().dismiss(id)

    expect(useToastStore.getState().toasts).toHaveLength(0)
  })
})
