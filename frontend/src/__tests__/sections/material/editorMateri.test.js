/**
 * Tes helper murni editor materi (NLE). Yang dijaga: bentuk klip, muatan yang
 * dikirim ke server (termasuk penempatan timeline dan nama pos perjalanan),
 * urutan klip, susunan track, dan klip aktif pada waktu tertentu.
 */
import { describe, expect, it } from 'vitest'
import {
  DURASI_BAWAAN,
  DURASI_MINIMUM,
  JUMLAH_TRACK,
  MAKS_PENJELASAN,
  TIMELINE_MINIMUM,
  blokBaru,
  ciriKlip,
  dariServer,
  durasiTotal,
  formatWaktu,
  klipPada,
  muatanBlok,
  pindahBlok,
  penjelasanTerisi,
  offsetMedia,
  pangkasKanan,
  pangkasKiri,
  setDurasi,
  setMulai,
  sisipBlok,
  susunTrack,
  trackMaksimal,
} from '../../../sections/material/editorMateri.js'

/**
 * @param {import('../../../sections/material/editorMateri.js').TipeBlok} tipe
 * @param {Partial<import('../../../sections/material/editorMateri.js').BarisBlok>} [ubah]
 * @returns {import('../../../sections/material/editorMateri.js').BarisBlok}
 */
function klip(tipe, ubah = {}) {
  return { ...blokBaru(tipe), ...ubah }
}

describe('klip', () => {
  it('membuat klip baru dengan bawaan timeline', () => {
    expect(blokBaru('media')).toEqual({
      tipe: 'media',
      wajib: true,
      teks: '',
      keterangan: '',
      unggahan_kode: '',
      quiz_id: '',
      track: 0,
      mulai_detik: 0,
      durasi_detik: DURASI_BAWAAN,
      fase: '',
      penjelasan_teks: '',
      penjelasan_kode: '',
    })
  })

  it('memetakan blok server ke klip dan tahan field hilang', () => {
    const hasil = dariServer([
      { tipe: 'teks', wajib: false, teks: 'Halo', track: 2, mulai_detik: 5, durasi_detik: 7 },
      { tipe: 'kuis', wajib: true, quiz_id: 12 },
      {},
    ])

    expect(hasil).toEqual([
      { tipe: 'teks', wajib: false, teks: 'Halo', keterangan: '', unggahan_kode: '', quiz_id: '', track: 2, mulai_detik: 5, durasi_detik: 7, fase: '', penjelasan_teks: '', penjelasan_kode: '' },
      { tipe: 'kuis', wajib: true, teks: '', keterangan: '', unggahan_kode: '', quiz_id: 12, track: 0, mulai_detik: DURASI_BAWAAN, durasi_detik: DURASI_BAWAAN, fase: '', penjelasan_teks: '', penjelasan_kode: '' },
      { tipe: 'teks', wajib: false, teks: '', keterangan: '', unggahan_kode: '', quiz_id: '', track: 0, mulai_detik: 2 * DURASI_BAWAAN, durasi_detik: DURASI_BAWAAN, fase: '', penjelasan_teks: '', penjelasan_kode: '' },
    ])

    expect(dariServer(undefined)).toEqual([])
  })

  it('memberi durasi bawaan untuk klip berdurasi nol/negatif (media tak terlihat)', () => {
    // Klip durasi 0 tidak pernah aktif di timeline, jadi pratinjau video tak
    // pernah muncul. Data lama seperti ini harus tetap bisa diputar.
    const hasil = dariServer([
      { tipe: 'media', durasi_detik: 0, mulai_detik: 0 },
      { tipe: 'media', durasi_detik: -5 },
    ])

    expect(hasil[0].durasi_detik).toBe(DURASI_BAWAAN)
    expect(hasil[0].mulai_detik).toBe(0)
    expect(hasil[1].durasi_detik).toBe(DURASI_BAWAAN)
  })
})

describe('muatan ke server', () => {
  it('mengemas isi sesuai tipe dan menyertakan penempatan timeline', () => {
    const muatan = muatanBlok([
      klip('teks', { teks: 'Penjelasan', track: 1, mulai_detik: 3.5, durasi_detik: 8 }),
      klip('media', { keterangan: 'Peta', unggahan_kode: 'abc' }),
      klip('kuis', { quiz_id: '9', track: 2, mulai_detik: 2 }),
    ])

    expect(muatan).toEqual([
      { tipe: 'teks', wajib: true, isi: { teks: 'Penjelasan' }, quiz_id: null, track: 1, mulai_detik: 3.5, durasi_detik: 8 },
      { tipe: 'media', wajib: true, isi: { unggahan_kode: 'abc', keterangan: 'Peta' }, quiz_id: null, track: 0, mulai_detik: 0, durasi_detik: DURASI_BAWAAN },
      { tipe: 'kuis', wajib: true, isi: undefined, quiz_id: 9, track: 2, mulai_detik: 2, durasi_detik: DURASI_BAWAAN },
    ])
  })

  it('mengirim nama pos hanya bila guru menggantinya, dan membacanya kembali', () => {
    const muatan = muatanBlok([
      klip('teks', { fase: 'Basecamp Sekolah' }),
      klip('teks', { fase: '   ' }),
    ])

    expect(muatan[0].fase).toBe('Basecamp Sekolah')
    expect(muatan[1]).not.toHaveProperty('fase')

    // Server mengirim balik nama pos tiap blok (null = pakai bawaan tema).
    const dariSv = dariServer([
      { tipe: 'teks', wajib: true, fase: 'Basecamp Sekolah' },
      { tipe: 'teks', wajib: true, fase: null },
    ])

    expect(dariSv.map((satu) => satu.fase)).toEqual(['Basecamp Sekolah', ''])
    expect(muatanBlok(dariSv)[0].fase).toBe('Basecamp Sekolah')
  })
})

describe('penjelasan setelah kuis', () => {
  it('mengirim penjelasan hanya bila diisi, dan membacanya kembali dari server', () => {
    const kosong = muatanBlok([klip('kuis', { quiz_id: 9 })])
    expect(kosong[0].isi).toBeUndefined()

    const muatan = muatanBlok([
      klip('kuis', {
        quiz_id: 9,
        penjelasan_teks: '  Karena 3/4 lebih besar.  ',
        penjelasan_kode: 'berkas-media',
      }),
      klip('kuis', { quiz_id: 10, penjelasan_teks: '   ', penjelasan_kode: '' }),
    ])

    expect(muatan[0].isi).toEqual({
      penjelasan: { teks: 'Karena 3/4 lebih besar.', unggahan_kode: 'berkas-media' },
    })
    // Spasi saja tidak dihitung sebagai penjelasan.
    expect(muatan[1].isi).toBeUndefined()

    const dariSv = dariServer([
      { tipe: 'kuis', wajib: true, quiz_id: 9, penjelasan: { teks: 'Naik 2 langkah', unggahan_kode: 'kode-1' } },
      { tipe: 'kuis', wajib: true, quiz_id: 10, penjelasan: null },
    ])

    expect(dariSv[0].penjelasan_teks).toBe('Naik 2 langkah')
    expect(dariSv[0].penjelasan_kode).toBe('kode-1')
    expect(dariSv[1].penjelasan_teks).toBe('')
    expect(dariSv[1].penjelasan_kode).toBe('')
  })

  it('menandai penjelasan terisi dari teks atau media saja', () => {
    expect(penjelasanTerisi(klip('kuis'))).toBe(false)
    expect(penjelasanTerisi(klip('kuis', { penjelasan_teks: 'x' }))).toBe(true)
    expect(penjelasanTerisi(klip('kuis', { penjelasan_kode: 'kode' }))).toBe(true)
    expect(penjelasanTerisi(klip('kuis', { penjelasan_teks: '   ' }))).toBe(false)
  })

  it('memotong teks penjelasan yang kepanjangan, sama seperti server', () => {
    const panjang = 'a'.repeat(MAKS_PENJELASAN + 10)
    const muatan = muatanBlok([klip('kuis', { quiz_id: 1, penjelasan_teks: panjang })])
    const isi = /** @type {{penjelasan?: {teks?: string}}} */ (muatan[0].isi)

    expect(isi.penjelasan?.teks).toHaveLength(MAKS_PENJELASAN)
  })
})

describe('urutan klip', () => {
  const blok = [klip('teks', { teks: 'a' }), klip('media', { teks: 'b' }), klip('kuis', { teks: 'c' })]

  it('memindahkan klip ke posisi lain dan mengembalikan larik baru', () => {
    const hasil = pindahBlok(blok, 0, 2)
    expect(hasil.map((satu) => satu.teks)).toEqual(['b', 'c', 'a'])
    expect(blok.map((satu) => satu.teks)).toEqual(['a', 'b', 'c'])
  })

  it('mengembalikan larik apa adanya bila tujuan tidak sah', () => {
    expect(pindahBlok(blok, 0, 0)).toBe(blok)
    expect(pindahBlok(blok, -1, 2)).toBe(blok)
    expect(pindahBlok(blok, 0, 5)).toBe(blok)
  })

  it('menyisipkan klip di akhir atau posisi tertentu dan melaporkan indeksnya', () => {
    const akhir = sisipBlok(blok, blokBaru('teks'))
    expect(akhir.indeks).toBe(3)
    expect(akhir.blok).toHaveLength(4)

    const tengah = sisipBlok(blok, blokBaru('kuis'), 1)
    expect(tengah.indeks).toBe(1)
    expect(tengah.blok.map((satu) => satu.tipe)).toEqual(['teks', 'kuis', 'media', 'kuis'])
  })
})

describe('timeline', () => {
  it('menyusun klip per track dan selalu menampilkan track dasar', () => {
    const blok = [
      klip('media', { track: 0, mulai_detik: 0, durasi_detik: 10 }),
      klip('teks', { track: 2, mulai_detik: 4, durasi_detik: 6 }),
      klip('kuis', { track: 0, mulai_detik: 12, durasi_detik: 5 }),
    ]

    expect(trackMaksimal(blok)).toBe(2)

    const track = susunTrack(blok)
    expect(track).toHaveLength(3) // track 0, 1, 2
    expect(track[0].klip.map((satu) => satu.indeks)).toEqual([0, 2])
    expect(track[1].klip).toEqual([])
    expect(track[2].klip.map((satu) => satu.baris.tipe)).toEqual(['teks'])

    // Tanpa klip, timeline tetap punya track dasar.
    expect(susunTrack([])).toHaveLength(JUMLAH_TRACK)
  })

  it('menghitung durasi total dari titik akhir terjauh', () => {
    expect(durasiTotal([])).toBe(TIMELINE_MINIMUM)
    expect(durasiTotal([klip('teks', { mulai_detik: 50, durasi_detik: 20 })])).toBe(70)
  })

  it('tidak lagi memaksa timeline jadi satu menit', () => {
    // Tombol play dulu selalu berhenti di 60 detik walau isinya jauh lebih pendek.
    expect(durasiTotal([klip('media', { mulai_detik: 0, durasi_detik: 8 })])).toBe(8)
    expect(durasiTotal([klip('media', { mulai_detik: 12.4, durasi_detik: 0.5 })])).toBe(12.9)
  })

  it('memangkas durasi klip dengan langkah tipis dan menjepit ke minimum', () => {
    const blok = [klip('teks', { durasi_detik: 5 })]

    expect(setDurasi(blok, 0, 4.94)[0].durasi_detik).toBe(4.9)
    expect(setDurasi(blok, 0, 5.16)[0].durasi_detik).toBe(5.2)
    expect(setDurasi(blok, 0, 0)[0].durasi_detik).toBe(DURASI_MINIMUM)
  })

  it('memilih klip aktif pada waktu tertentu, track tertinggi menang', () => {
    const blok = [
      klip('media', { track: 0, mulai_detik: 0, durasi_detik: 20, teks: 'bawah' }),
      klip('media', { track: 1, mulai_detik: 5, durasi_detik: 10, teks: 'atas' }),
    ]

    expect(klipPada(blok, 2)?.teks).toBe('bawah')
    expect(klipPada(blok, 6)?.teks).toBe('atas')
    expect(klipPada(blok, 40)).toBeNull()
  })

  it('menggeser titik mulai dan menjepitnya agar tidak negatif', () => {
    const blok = [klip('teks', { mulai_detik: 4 })]
    expect(setMulai(blok, 0, 12.34)[0].mulai_detik).toBe(12.3)
    expect(setMulai(blok, 0, -5)[0].mulai_detik).toBe(0)
  })

  it('memformat detik jadi mm:ss', () => {
    expect(formatWaktu(0)).toBe('00:00')
    expect(formatWaktu(75)).toBe('01:15')
  })
})

describe('gagang pangkas `|` di kedua sisi klip', () => {
  it('pangkas kiri menggeser titik mulai dan menjaga ujung kanan tetap', () => {
    const blok = [klip('media', { mulai_detik: 4, durasi_detik: 10 })]
    const hasil = pangkasKiri(blok, 0, 7.26)

    // Mulai dibulatkan 0,1 detik; ujung kanan tetap 14 detik.
    expect(hasil[0].mulai_detik).toBe(7.3)
    expect(hasil[0].durasi_detik).toBe(6.7)
    expect(hasil[0].mulai_detik + hasil[0].durasi_detik).toBe(14)
  })

  it('pangkas kiri tidak pernah membuat durasi di bawah minimum', () => {
    const blok = [klip('kuis', { mulai_detik: 0, durasi_detik: 10 })]
    const hasil = pangkasKiri(blok, 0, 99)

    expect(hasil[0].durasi_detik).toBe(DURASI_MINIMUM)
    expect(hasil[0].mulai_detik).toBeCloseTo(9.9, 5)
  })

  it('pangkas kiri menolak titik mulai negatif', () => {
    const blok = [klip('teks', { mulai_detik: 3, durasi_detik: 4 })]

    expect(pangkasKiri(blok, 0, -8)[0].mulai_detik).toBe(0)
    expect(pangkasKiri(blok, 0, -8)[0].durasi_detik).toBe(7)
  })

  it('pangkas kanan menggeser ujung dan menjaga titik mulai tetap', () => {
    const blok = [klip('media', { mulai_detik: 2, durasi_detik: 10 })]
    const hasil = pangkasKanan(blok, 0, 5.04)

    expect(hasil[0].mulai_detik).toBe(2)
    expect(hasil[0].durasi_detik).toBe(3)
  })

  it('pangkas kanan menjepit ke durasi minimum', () => {
    const blok = [klip('media', { mulai_detik: 2, durasi_detik: 10 })]

    expect(pangkasKanan(blok, 0, 1)[0].durasi_detik).toBe(DURASI_MINIMUM)
  })

  it('indeks yang tidak ada tidak mengubah apa pun', () => {
    const blok = [klip('teks', { mulai_detik: 1, durasi_detik: 5 })]

    expect(pangkasKiri(blok, 9, 4)).toEqual(blok)
    expect(pangkasKanan(blok, 9, 4)).toEqual(blok)
  })
})

describe('sinkron media dengan timeline', () => {
  it('memetakan playhead global jadi offset di dalam klip', () => {
    // Klip mulai detik 5; media mulai dari 0 saat playhead menyentuh 5.
    expect(offsetMedia(5, 5, 10)).toBe(0)
    expect(offsetMedia(8, 5, 10)).toBe(3)
  })

  it('menghentikan offset di durasi klip, bukan menembus klip berikutnya', () => {
    expect(offsetMedia(100, 5, 10)).toBe(10)
  })

  it('tidak pernah negatif walau playhead sebelum klip', () => {
    expect(offsetMedia(1, 5, 10)).toBe(0)
    expect(offsetMedia(-2, 5, 10)).toBe(0)
  })

  it('memperlakukan titik mulai negatif seolah 0', () => {
    expect(offsetMedia(2, -3, 10)).toBe(2)
  })

  it('tanpa durasi klip (<= 0) tidak menjepit offset', () => {
    expect(offsetMedia(30, 5, 0)).toBe(25)
    expect(offsetMedia(30, 5, Number.NaN)).toBe(25)
  })
})

describe('ciri klip', () => {
  it('memberi ikon/label per tipe dan fallback untuk tipe tak dikenal', () => {
    expect(ciriKlip('teks')).toEqual({ ikon: '¶', label: 'Teks' })
    expect(ciriKlip('media')).toEqual({ ikon: '▶', label: 'Media' })
    expect(ciriKlip('kuis')).toEqual({ ikon: '?', label: 'Kuis sisipan' })
    expect(ciriKlip(/** @type {any} */ ('entah'))).toEqual({ ikon: '•', label: 'Blok' })
  })
})
