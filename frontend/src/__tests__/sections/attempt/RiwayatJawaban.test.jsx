/**
 * Tes panel riwayat jawaban (render statis).
 *
 * Yang dijaga: murid melihat berapa jawaban yang tercatat, mana yang masih
 * menunggu koneksi, dan bisa mematikan/menyalakan riwayat lokal dari layarnya.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import RiwayatJawaban from '../../../sections/attempt/RiwayatJawaban.jsx'
import { STATUS_LOKAL, STATUS_TERKIRIM } from '../../../sections/attempt/riwayatJawaban.js'

/** Baris riwayat contoh. */
const entri = (soalId, status = STATUS_LOKAL) => ({
  soal_id: soalId,
  nomor: soalId,
  tipe: 'pilihan_ganda',
  ringkas: 'B',
  at: 1000,
  server_at: new Date(2026, 9, 6, 7, 5, 9).toISOString(),
  status,
})

describe('RiwayatJawaban', () => {
  it('menampilkan jumlah tercatat dan isi tiap baris', () => {
    const html = renderToStaticMarkup(
      <RiwayatJawaban entri={[entri(1), entri(2, STATUS_TERKIRIM)]} tertunda={1} aktif luring={false} onNyalakan={() => {}} />,
    )

    expect(html).toContain('Riwayat jawaban')
    expect(html).toContain('2 tercatat')
    expect(html).toContain('Soal 1')
    expect(html).toContain('07:05:09')
    expect(html).toContain('tersimpan di server')
    expect(html).toContain('di perangkat ini')
  })

  it('menandai jawaban yang masih menunggu terkirim', () => {
    const html = renderToStaticMarkup(
      <RiwayatJawaban entri={[entri(1)]} tertunda={1} aktif luring onNyalakan={() => {}} />,
    )

    expect(html).toContain('1 menunggu terkirim')
    expect(html).toContain('Koneksi sedang putus')
  })

  it('menjelaskan saat belum ada jawaban yang tercatat', () => {
    const html = renderToStaticMarkup(
      <RiwayatJawaban entri={[]} tertunda={0} aktif luring={false} onNyalakan={() => {}} />,
    )

    expect(html).toContain('Belum ada jawaban yang tercatat')
    expect(html).not.toContain('menunggu terkirim')
  })

  it('memakai saklar "simpan riwayat di perangkat ini" yang menyala secara bawaan', () => {
    const html = renderToStaticMarkup(
      <RiwayatJawaban entri={[entri(1)]} tertunda={0} aktif luring={false} onNyalakan={() => {}} />,
    )

    expect(html).toContain('type="checkbox"')
    expect(html).toContain('checked=""')
    expect(html).toContain('Simpan riwayat jawaban di perangkat ini')
  })

  it('menjelaskan saat riwayat lokal dimatikan', () => {
    const html = renderToStaticMarkup(
      <RiwayatJawaban entri={[]} tertunda={0} aktif={false} luring={false} onNyalakan={() => {}} />,
    )

    expect(html).toContain('Riwayat lokal dimatikan di perangkat ini')
    expect(html).not.toContain('checked=""')
  })
})
