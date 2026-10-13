/**
 * Uji aturan murni panel kelola akun sekolah.
 *
 * Pagar yang dijaga di sini adalah pagar yang membuat tombol simpan tidak pernah
 * aktif untuk muatan yang pasti ditolak server: alasan terlalu pendek, sandi
 * kurang dari 10 karakter, konfirmasi tidak cocok, atau token belum diminta.
 * Tanpa uji ini, satu perubahan kecil di komponen bisa membuat admin menekan
 * "Simpan" berkali-kali tanpa tahu kenapa gagal.
 */
import { describe, expect, it } from 'vitest'
import {
  ALASAN_MIN,
  SANDI_MIN,
  aksiStatusBerikut,
  alasanCukup,
  bolehMintaToken,
  bolehSimpanAkun,
  catatanAksi,
  emailWajar,
  judulAksi,
  sandiCukup,
} from '../../../sections/admin/akunSekolah.js'

const alasanPanjang = 'Email murid salah ketik saat pendataan'

describe('emailWajar', () => {
  it('menerima email biasa', () => {
    expect(emailWajar('ana@sekolah.test')).toBe(true)
    expect(emailWajar('  bu.rina@sd-negeri.sch.id  ')).toBe(true)
  })

  it('menolak yang jelas salah sebelum dikirim ke server', () => {
    expect(emailWajar('')).toBe(false)
    expect(emailWajar('   ')).toBe(false)
    expect(emailWajar('ana')).toBe(false)
    expect(emailWajar('ana@sekolah')).toBe(false)
    expect(emailWajar('ana@@sekolah.test')).toBe(false)
    expect(emailWajar('@sekolah.test')).toBe(false)
    expect(emailWajar('ana@.test')).toBe(false)
    expect(emailWajar('ana@sekolah.')).toBe(false)
    expect(emailWajar('ana arya@sekolah.test')).toBe(false)
  })
})

describe('sandiCukup', () => {
  it('memakai panjang minimal yang sama dengan server', () => {
    expect(SANDI_MIN).toBe(10)
    expect(sandiCukup('123456789')).toBe(false)
    expect(sandiCukup('1234567890')).toBe(true)
  })

  it('tidak memotong spasi: spasi ikut dihitung seperti server', () => {
    expect(sandiCukup('          ')).toBe(true)
  })
})

describe('alasanCukup', () => {
  it('menghitung setelah spasi di ujung dipotong', () => {
    expect(ALASAN_MIN).toBe(10)
    expect(alasanCukup('pendek')).toBe(false)
    expect(alasanCukup('   pendek   ')).toBe(false)
    expect(alasanCukup('sepuluhchr')).toBe(true)
  })
})

describe('bolehMintaToken', () => {
  it('butuh alasan yang cukup di semua jenis aksi', () => {
    expect(
      bolehMintaToken({ jenis: 'status', alasan: 'pendek', status: 'suspended' }),
    ).toBe(false)
  })

  it('jenis email butuh bentuk email yang wajar', () => {
    expect(bolehMintaToken({ jenis: 'email', alasan: alasanPanjang, email: 'salah' })).toBe(false)
    expect(bolehMintaToken({ jenis: 'email', alasan: alasanPanjang, email: 'benar@sekolah.test' })).toBe(true)
  })

  it('jenis sandi butuh panjang cukup DAN konfirmasi cocok', () => {
    expect(
      bolehMintaToken({ jenis: 'sandi', alasan: alasanPanjang, sandi: 'pendek', konfirmasi: 'pendek' }),
    ).toBe(false)
    expect(
      bolehMintaToken({
        jenis: 'sandi',
        alasan: alasanPanjang,
        sandi: 'sandi-baru-aman',
        konfirmasi: 'beda-sekali-aman',
      }),
    ).toBe(false)
    expect(
      bolehMintaToken({
        jenis: 'sandi',
        alasan: alasanPanjang,
        sandi: 'sandi-baru-aman',
        konfirmasi: 'sandi-baru-aman',
      }),
    ).toBe(true)
  })

  it('jenis status hanya menerima aktif atau ditangguhkan', () => {
    expect(bolehMintaToken({ jenis: 'status', alasan: alasanPanjang, status: 'dihapus' })).toBe(false)
    expect(bolehMintaToken({ jenis: 'status', alasan: alasanPanjang, status: 'aktif' })).toBe(true)
    expect(bolehMintaToken({ jenis: 'status', alasan: alasanPanjang, status: 'suspended' })).toBe(true)
  })

  it('isian yang belum diisi (undefined) tidak pernah lolos', () => {
    expect(bolehMintaToken({ jenis: 'sandi', alasan: alasanPanjang })).toBe(false)
    expect(bolehMintaToken({ jenis: 'email', alasan: alasanPanjang })).toBe(false)
    expect(bolehMintaToken({ jenis: 'status', alasan: alasanPanjang })).toBe(false)
  })
})

describe('bolehSimpanAkun', () => {
  /** @type {Parameters<typeof bolehSimpanAkun>[0]} */
  const isianEmail = {
    jenis: 'email',
    alasan: alasanPanjang,
    email: 'ana@sekolah.test',
    token: 'tok-123',
  }

  it('butuh token yang sudah diminta', () => {
    expect(bolehSimpanAkun({ ...isianEmail, token: '' })).toBe(false)
    expect(bolehSimpanAkun({ ...isianEmail, token: '   ' })).toBe(false)
    expect(bolehSimpanAkun(isianEmail)).toBe(true)
  })

  it('token saja tidak cukup kalau isiannya masih salah', () => {
    expect(bolehSimpanAkun({ ...isianEmail, email: 'salah' })).toBe(false)
  })
})

describe('aksiStatusBerikut', () => {
  it('menawarkan kebalikan status sekarang', () => {
    expect(aksiStatusBerikut('aktif')).toEqual({ status: 'suspended', label: 'Tangguhkan akun' })
    expect(aksiStatusBerikut('suspended')).toEqual({ status: 'aktif', label: 'Aktifkan kembali' })
  })

  it('status tak dikenal diperlakukan sebagai akun yang masih boleh dipakai', () => {
    // Akun "menunggu verifikasi" tetap akun nyata; tombolnya menangguhkan.
    expect(aksiStatusBerikut('menunggu')).toEqual({ status: 'suspended', label: 'Tangguhkan akun' })
  })
})

describe('teks panel', () => {
  const jenis = /** @type {const} */ (['email', 'sandi', 'status'])

  it('setiap aksi punya judul dan catatan akibat', () => {
    for (const j of jenis) {
      expect(judulAksi(j)).not.toBe('')
      expect(catatanAksi(j)).not.toBe('')
    }
  })

  it('catatan penangguhan menyebut sesi diakhiri seketika', () => {
    expect(catatanAksi('status')).toContain('ditolak di semua jalur masuk')
  })

  it('catatan sandi menyebut sandi lama tidak berlaku', () => {
    expect(catatanAksi('sandi')).toContain('sandi lama tidak berlaku')
  })
})
