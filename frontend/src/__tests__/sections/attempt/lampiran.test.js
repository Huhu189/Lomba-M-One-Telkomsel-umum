import { describe, expect, it } from 'vitest'
import {
  DURASI_REKAM_MAKS,
  JENIS_LAMPIRAN,
  MAKS_LAMPIRAN_PER_SOAL,
  UKURAN_MAKS_LAMPIRAN,
  bolehUnggahLampiran,
  hashSha256,
  hanyaLampiranSelesai,
  jenisLampiranUntukBerkas,
  periksaBerkasLampiran,
  sisaKuotaLampiran,
  skemaLampiran,
  skemaResponsPotonganLampiran,
} from '../../../sections/attempt/lampiran.js'

/**
 * Satu lampiran uji.
 * @param {number} questionId
 * @param {string} [status]
 */
function lampiran(questionId, status = 'selesai') {
  return {
    id: questionId * 10,
    kode: `kode-${questionId}-${status}`,
    question_id: questionId,
    jenis: 'gambar',
    jenis_label: 'Gambar jawaban',
    nama_asli: null,
    ekstensi: 'png',
    mime: 'image/png',
    kategori: 'umum',
    kategori_label: 'Berkas umum',
    tampil_langsung: true,
    ukuran: 1024,
    ukuran_manusia: '1 KiB',
    durasi_detik: null,
    jumlah_potongan: 1,
    ukuran_potongan: 1048576,
    hash: 'a'.repeat(64),
    status,
    status_label: status === 'selesai' ? 'Selesai' : 'Menunggu potongan',
    url: status === 'selesai' ? 'https://contoh.test/berkas/jawaban/kode' : null,
  }
}

describe('jenis lampiran menurut tipe berkas', () => {
  it('memperlakukan gambar sebagai lampiran gambar', () => {
    expect(jenisLampiranUntukBerkas({ type: 'image/jpeg' })).toBe('gambar')
    expect(jenisLampiranUntukBerkas({ type: 'image/png' })).toBe('gambar')
  })

  it('memperlakukan sisanya sebagai berkas biasa', () => {
    expect(jenisLampiranUntukBerkas({ type: 'application/pdf' })).toBe('berkas')
    expect(jenisLampiranUntukBerkas({ type: '' })).toBe('berkas')
    expect(jenisLampiranUntukBerkas(null)).toBe('berkas')
  })

  it('jenis yang dikenali harus sama dengan yang diterima server', () => {
    expect(JENIS_LAMPIRAN).toEqual(['gambar', 'rekam', 'berkas'])
  })
})

describe('pemeriksaan berkas lampiran sebelum diunggah', () => {
  it('menolak berkas kosong, tidak ada, dan terlalu besar', () => {
    expect(periksaBerkasLampiran(undefined)).toContain('Pilih berkas')
    expect(periksaBerkasLampiran({ size: 0 })).toContain('kosong')
    expect(periksaBerkasLampiran({ size: UKURAN_MAKS_LAMPIRAN + 1 })).toContain('terlalu besar')
  })

  it('meloloskan berkas dalam batas', () => {
    expect(periksaBerkasLampiran({ size: 5000 })).toBeNull()
    expect(periksaBerkasLampiran({ size: UKURAN_MAKS_LAMPIRAN })).toBeNull()
  })
})

describe('batas waktu dan kuota lampiran', () => {
  it('mengunci lampiran begitu waktu habis (server juga menolaknya)', () => {
    expect(bolehUnggahLampiran(30)).toBe(true)
    expect(bolehUnggahLampiran(1)).toBe(true)
    expect(bolehUnggahLampiran(0)).toBe(false)
    expect(bolehUnggahLampiran(-5)).toBe(false)
  })

  it('menghitung sisa kuota per soal, bukan per attempt', () => {
    const semua = [lampiran(1), lampiran(1), lampiran(2)]

    expect(sisaKuotaLampiran(semua, 1)).toBe(MAKS_LAMPIRAN_PER_SOAL - 2)
    expect(sisaKuotaLampiran(semua, 2)).toBe(MAKS_LAMPIRAN_PER_SOAL - 1)
    expect(sisaKuotaLampiran(semua, 3)).toBe(MAKS_LAMPIRAN_PER_SOAL)
  })

  it('tidak pernah memberi kuota negatif walau lampiran sudah melebihi batas', () => {
    const semua = [lampiran(1), lampiran(1), lampiran(1), lampiran(1)]

    expect(sisaKuotaLampiran(semua, 1)).toBe(0)
  })

  it('menyembunyikan sesi unggah yang belum selesai', () => {
    const semua = [lampiran(1, 'selesai'), lampiran(1, 'menunggu'), lampiran(2, 'gagal')]
    const bersih = hanyaLampiranSelesai(semua)

    expect(bersih).toHaveLength(1)
    expect(bersih[0].status).toBe('selesai')
  })

  it('batas durasi rekaman adalah 60 detik', () => {
    expect(DURASI_REKAM_MAKS).toBe(60)
  })
})

describe('skema lampiran', () => {
  it('menerima lampiran lengkap dari server', () => {
    const hasil = skemaLampiran.parse(lampiran(7))

    expect(hasil.question_id).toBe(7)
    expect(hasil.tampil_langsung).toBe(true)
    expect(typeof hasil.url).toBe('string')
  })

  it('menerima lampiran berkas berisiko tanpa URL inline', () => {
    const hasil = skemaLampiran.parse({
      ...lampiran(8),
      jenis: 'berkas',
      kategori: 'berisiko',
      kategori_label: 'Berkas berisiko',
      tampil_langsung: false,
      ekstensi: 'upload',
      mime: 'application/octet-stream',
    })

    expect(hasil.kategori).toBe('berisiko')
    expect(hasil.tampil_langsung).toBe(false)
  })

  it('menerima respons potongan yang diterima server', () => {
    const hasil = skemaResponsPotonganLampiran.parse({
      message: 'Potongan diterima.',
      indeks: 0,
      ukuran: 1024,
      hash: 'b'.repeat(64),
    })

    expect(hasil.indeks).toBe(0)
  })
})

describe('hash potongan', () => {
  it('menghasilkan sha256 hex yang sama dengan yang diverifikasi server', async () => {
    const isi = new TextEncoder().encode('abc').buffer
    // Nilai acuan sha256("abc").
    const acuan = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'

    expect(await hashSha256(isi)).toBe(acuan)
  })
})
