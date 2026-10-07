import { describe, expect, it } from 'vitest'
import {
  ALASAN_LAPORAN,
  inisialNama,
  jenisGambarDariMagicBytes,
  periksaBerkasAvatar,
  skemaAvatar,
  skemaAvatarSaya,
  skemaHasilLapor,
  skemaLaporanAvatar,
  terlihatUntukTeman,
  UKURAN_MAKS,
} from '../../../sections/avatar/api.js'

/** @param {string} teks */
function byte(teks) {
  return new TextEncoder().encode(teks)
}

/** @param {number[]} nilai */
function byteDari(nilai) {
  return new Uint8Array(nilai)
}

describe('jenis gambar dari magic bytes (cerminan pemeriksaan server)', () => {
  it('mengenali JPEG, PNG, dan WebP', () => {
    expect(jenisGambarDariMagicBytes(byteDari([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toBe('jpeg')
    expect(jenisGambarDariMagicBytes(byteDari([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
      'png',
    )
    // RIFF (4 byte) + ukuran (4 byte) + 'WEBP' tepat di byte ke-8..11.
    expect(jenisGambarDariMagicBytes(byte('RIFF0000WEBPVP8 '))).toBe('webp')
  })

  it('menolak SVG walau berkasnya dinamai .png', () => {
    expect(jenisGambarDariMagicBytes(byte('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull()
    expect(jenisGambarDariMagicBytes(byte('<?xml version="1.0"?><svg/>'))).toBeNull()
    expect(jenisGambarDariMagicBytes(byte('<!doctype html><script>alert(1)</script>'))).toBeNull()
    expect(jenisGambarDariMagicBytes(byte(''))).toBeNull()
  })

  it('tidak salah mengenali teks RIFF yang bukan WebP', () => {
    expect(jenisGambarDariMagicBytes(byte('RIFF0000WAVEfmt '))).toBeNull()
  })
})

describe('inisial nama untuk avatar bawaan', () => {
  it('mengambil maksimal dua huruf awal', () => {
    expect(inisialNama('Budi Santoso')).toBe('BS')
    expect(inisialNama('siti')).toBe('S')
    expect(inisialNama('dewi ayu lestari')).toBe('DA')
  })

  it('tetap aman untuk nama kosong', () => {
    expect(inisialNama('')).toBe('?')
    expect(inisialNama(null)).toBe('?')
    expect(inisialNama(undefined)).toBe('?')
  })
})

describe('pemeriksaan berkas sebelum diunggah', () => {
  it('menolak berkas kosong dan berkas terlalu besar', () => {
    expect(periksaBerkasAvatar({ size: 0 })).toContain('kosong')
    expect(periksaBerkasAvatar({ size: UKURAN_MAKS + 1 })).toContain('terlalu besar')
    expect(periksaBerkasAvatar(undefined)).toContain('Pilih berkas')
  })

  it('meloloskan berkas dalam batas', () => {
    expect(periksaBerkasAvatar({ size: 1024 })).toBeNull()
    expect(periksaBerkasAvatar({ size: UKURAN_MAKS })).toBeNull()
  })
})

describe('skema avatar', () => {
  it('menerima avatar aktif milik teman dan menandainya boleh dilaporkan', () => {
    const avatar = skemaAvatar.parse({
      id: 7,
      student_id: 3,
      nama_murid: 'Budi',
      kelas_nama: '3A',
      status: 'aktif',
      status_label: 'Aktif',
      terlihat: true,
      milik_saya: false,
      url: 'https://contoh.test/berkas/avatar/abc',
      jumlah_laporan: 0,
      boleh_lapor: true,
    })

    expect(terlihatUntukTeman(avatar)).toBe(true)
  })

  it('avatar yang disembunyikan tidak terlihat bagi teman walau URL-nya ada', () => {
    const avatar = skemaAvatar.parse({
      id: 8,
      student_id: 4,
      status: 'disembunyikan',
      status_label: 'Disembunyikan (menunggu tinjauan)',
      terlihat: false,
      milik_saya: false,
      url: null,
      jumlah_laporan: 3,
    })

    expect(terlihatUntukTeman(avatar)).toBe(false)
  })

  it('menerima penanda avatar bawaan tanpa gambar', () => {
    const hasil = skemaAvatarSaya.parse({ avatar: null, bawaan: true })

    expect(hasil.bawaan).toBe(true)
    expect(hasil.avatar).toBeNull()
  })

  it('menerima hasil laporan beserta status tinjauan', () => {
    const laporan = skemaLaporanAvatar.parse({
      id: 1,
      alasan: 'tidak_pantas',
      alasan_label: 'Gambar tidak pantas',
      keterangan: null,
      status: 'menunggu',
      status_label: 'Menunggu tinjauan',
    })

    const hasil = skemaHasilLapor.parse({
      message: 'Laporan diterima. Gambar disembunyikan sampai guru meninjau.',
      laporan,
      jumlah_laporan: 3,
      disembunyikan: true,
    })

    expect(hasil.disembunyikan).toBe(true)
    expect(hasil.jumlah_laporan).toBe(3)
  })

  it('daftar alasan laporan sinkron dengan nilai yang diterima server', () => {
    expect(ALASAN_LAPORAN.map((satu) => satu.nilai)).toEqual([
      'tidak_pantas',
      'bullying',
      'spam',
      'lainnya',
    ])
  })
})
