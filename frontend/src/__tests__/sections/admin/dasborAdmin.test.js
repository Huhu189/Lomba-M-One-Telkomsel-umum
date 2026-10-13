/**
 * Uji perhitungan murni dasbor admin sekolah.
 *
 * Yang dijaga di sini bukan tampilannya, melainkan angka dan urutan yang dibaca
 * admin: kelas mana yang paling besar, berapa yang kosong, kapan sebuah akun
 * harus ditandai peringatan, dan urutan "perlu perhatian" (yang sedang bergerak
 * hari ini lebih dulu). Salah di sini berarti admin mengambil keputusan dari
 * angka yang salah tanpa ada yang tampak rusak.
 */
import { describe, expect, it } from 'vitest'
import {
  kelasAkun,
  perluPerhatianSekolah,
  ringkasKelas,
  statusAkunTampilan,
  urutKelas,
  waktuLalu,
} from '../../../sections/admin/dasborAdmin.js'

/** @param {import('../../../sections/admin/api.js').KelasSekolah[]} daftar */
const kelas = (daftar) => daftar

/**
 * Satu akun lengkap dengan nilai bawaan; uji cukup menimpa bagian yang diuji.
 * @param {Partial<import('../../../sections/admin/api.js').AkunSekolah>} [isi]
 * @returns {import('../../../sections/admin/api.js').AkunSekolah}
 */
const akun = (isi = {}) => ({
  id: 1,
  nama: 'Ana',
  email: 'ana@sekolah.test',
  peran: 'murid',
  peran_label: 'Murid',
  status: 'aktif',
  status_label: 'Aktif',
  terverifikasi: true,
  is_tamu: false,
  ...isi,
})

describe('urutKelas', () => {
  it('mengurutkan tingkat dulu, lalu nama', () => {
    const hasil = urutKelas(
      kelas([
        { id: 3, nama: 'Kelas 6B', tingkat: 6, jumlah_murid: 1, jumlah_kuis_terbit: 0 },
        { id: 1, nama: 'Kelas 5B', tingkat: 5, jumlah_murid: 1, jumlah_kuis_terbit: 0 },
        { id: 2, nama: 'Kelas 5A', tingkat: 5, jumlah_murid: 1, jumlah_kuis_terbit: 0 },
      ]),
    )

    expect(hasil.map((k) => k.nama)).toEqual(['Kelas 5A', 'Kelas 5B', 'Kelas 6B'])
  })

  it('tidak mengubah larik masukan', () => {
    const asli = kelas([
      { id: 2, nama: 'Kelas 6A', tingkat: 6, jumlah_murid: 0, jumlah_kuis_terbit: 0 },
      { id: 1, nama: 'Kelas 1A', tingkat: 1, jumlah_murid: 0, jumlah_kuis_terbit: 0 },
    ])

    urutKelas(asli)

    expect(asli.map((k) => k.id)).toEqual([2, 1])
  })
})

describe('ringkasKelas', () => {
  it('menjumlahkan murid dan menemukan kelas terbesar', () => {
    const hasil = ringkasKelas(
      kelas([
        { id: 1, nama: 'Kelas 5A', tingkat: 5, jumlah_murid: 30, jumlah_kuis_terbit: 2 },
        { id: 2, nama: 'Kelas 6A', tingkat: 6, jumlah_murid: 32, jumlah_kuis_terbit: 1 },
      ]),
    )

    expect(hasil.jumlahMurid).toBe(62)
    expect(hasil.terbesar?.nama).toBe('Kelas 6A')
    expect(hasil.kelasKosong).toBe(0)
  })

  it('menghitung kelas kosong', () => {
    const hasil = ringkasKelas(
      kelas([
        { id: 1, nama: 'Kelas 5A', tingkat: 5, jumlah_murid: 0, jumlah_kuis_terbit: 0 },
        { id: 2, nama: 'Kelas 5B', tingkat: 5, jumlah_murid: 12, jumlah_kuis_terbit: 0 },
      ]),
    )

    expect(hasil.kelasKosong).toBe(1)
    expect(hasil.terbesar?.nama).toBe('Kelas 5B')
  })

  it('aman untuk daftar kosong (belum ada kelas sama sekali)', () => {
    expect(ringkasKelas([])).toEqual({ jumlahMurid: 0, kelasKosong: 0, terbesar: null })
  })
})

describe('statusAkunTampilan', () => {
  it('akun aktif yang terverifikasi tampil sukses', () => {
    expect(statusAkunTampilan(akun())).toEqual({ label: 'Aktif', jenis: 'sukses' })
  })

  it('akun aktif yang belum terverifikasi ditandai peringatan', () => {
    // Justru keadaan inilah yang paling sering dicari admin: akun "ada" tetapi
    // tidak bisa dipakai masuk.
    expect(statusAkunTampilan(akun({ terverifikasi: false }))).toEqual({
      label: 'Belum terverifikasi',
      jenis: 'peringatan',
    })
  })

  it('akun ditangguhkan dan dihapus tampil sebagai kesalahan', () => {
    expect(statusAkunTampilan(akun({ status: 'suspended', status_label: 'Ditangguhkan' }))).toEqual({
      label: 'Ditangguhkan',
      jenis: 'salah',
    })
    expect(statusAkunTampilan(akun({ status: 'dihapus', status_label: 'Dihapus' }))).toEqual({
      label: 'Dihapus',
      jenis: 'salah',
    })
  })

  it('memakai label server untuk status lain, dan tetap punya cadangan', () => {
    expect(statusAkunTampilan(akun({ status: 'menunggu', status_label: 'Menunggu email' }))).toEqual({
      label: 'Menunggu email',
      jenis: 'lembut',
    })
    expect(statusAkunTampilan(akun({ status: 'menunggu', status_label: '' }))).toEqual({
      label: 'Menunggu verifikasi',
      jenis: 'lembut',
    })
  })
})

describe('perluPerhatianSekolah', () => {
  /** @param {{ murid?: object, guru?: object, kuis?: object }} bagian */
  const monitor = ({ murid = {}, guru = {}, kuis = {} } = {}) => ({
    murid: {
      total: 0,
      akun: 0,
      aktif: 0,
      online: 0,
      mengerjakan: 0,
      belum_verifikasi: 0,
      ditangguhkan: 0,
      ...murid,
    },
    guru: { total: 0, aktif: 0, online: 0, ditangguhkan: 0, admin: 1, ...guru },
    kuis: {
      total: 0,
      terbit: 0,
      draf: 0,
      arsip: 0,
      aktif: 0,
      attempt_hari_ini: 0,
      dikumpulkan_hari_ini: 0,
      koreksi_menunggu: 0,
      kejadian_hari_ini: 0,
      ...kuis,
    },
  })

  it('sekolah yang tenang tidak menghasilkan item apa pun', () => {
    expect(perluPerhatianSekolah(monitor())).toEqual([])
  })

  it('mengurutkan dari yang sedang bergerak ke sinyal kecurangan', () => {
    const daftar = perluPerhatianSekolah(
      monitor({
        murid: { mengerjakan: 3, belum_verifikasi: 2, ditangguhkan: 1 },
        guru: { ditangguhkan: 1 },
        kuis: { koreksi_menunggu: 4, kejadian_hari_ini: 5 },
      }),
    )

    expect(daftar.map((i) => i.jenis)).toEqual([
      'mengerjakan',
      'koreksi',
      'verifikasi',
      'ditangguhkan',
      'kejadian',
    ])
  })

  it('menjumlahkan penangguhan murid dan guru dalam satu baris', () => {
    const daftar = perluPerhatianSekolah(monitor({ murid: { ditangguhkan: 2 }, guru: { ditangguhkan: 3 } }))
    const item = daftar.find((i) => i.jenis === 'ditangguhkan')

    expect(item?.judul).toBe('5 akun sedang ditangguhkan')
  })

  it('setiap item membawa aksi yang bisa diklik', () => {
    const daftar = perluPerhatianSekolah(
      monitor({
        murid: { mengerjakan: 1, belum_verifikasi: 1, ditangguhkan: 1 },
        kuis: { koreksi_menunggu: 1, kejadian_hari_ini: 1 },
      }),
    )

    expect(daftar).toHaveLength(5)
    for (const item of daftar) {
      expect(item.aksi).not.toBe('')
      expect(item.ket).not.toBe('')
    }
  })
})

describe('kelasAkun', () => {
  it('murid memakai nama kelasnya, atau penanda tanpa kelas', () => {
    expect(kelasAkun(akun({ kelas_nama: 'Kelas 5A' }))).toBe('Kelas 5A')
    expect(kelasAkun(akun({ kelas_nama: null }))).toBe('Tanpa kelas')
    expect(kelasAkun(akun())).toBe('Tanpa kelas')
  })

  it('guru tidak pernah menampilkan kelas (walau ada sisa data)', () => {
    expect(kelasAkun(akun({ peran: 'guru', kelas_nama: 'Kelas 5A' }))).toBe('Guru')
  })
})

describe('waktuLalu', () => {
  /** Sabtu, 10 Oktober 2026, 09.00 (waktu lokal). */
  const sekarang = new Date(2026, 9, 10, 9, 0, 0)
  /** @param {number} detik */
  const lalu = (detik) => new Date(sekarang.getTime() - detik * 1000).toISOString()

  it('menampilkan "—" untuk waktu yang tidak ada atau tidak sah', () => {
    expect(waktuLalu(null, sekarang)).toBe('—')
    expect(waktuLalu(undefined, sekarang)).toBe('—')
    expect(waktuLalu('', sekarang)).toBe('—')
    expect(waktuLalu('bukan-tanggal', sekarang)).toBe('—')
  })

  it('menampilkan "baru saja" untuk waktu dekat atau di masa depan', () => {
    expect(waktuLalu(lalu(10), sekarang)).toBe('baru saja')
    expect(waktuLalu(lalu(59), sekarang)).toBe('baru saja')
    // Jam perangkat yang meleset tidak boleh menghasilkan "-3 menit lalu".
    expect(waktuLalu(new Date(sekarang.getTime() + 60_000).toISOString(), sekarang)).toBe('baru saja')
  })

  it('naik ke menit, jam, lalu hari', () => {
    expect(waktuLalu(lalu(60), sekarang)).toBe('1 menit lalu')
    expect(waktuLalu(lalu(60 * 59), sekarang)).toBe('59 menit lalu')
    expect(waktuLalu(lalu(3600), sekarang)).toBe('1 jam lalu')
    expect(waktuLalu(lalu(86_400), sekarang)).toBe('1 hari lalu')
    expect(waktuLalu(lalu(86_400 * 6), sekarang)).toBe('6 hari lalu')
  })

  it('lewat sepekan memakai tanggal, bukan angka hari', () => {
    // 30 September 2026, 09.00 — sepuluh hari sebelum acuan.
    expect(waktuLalu(lalu(86_400 * 10), sekarang)).toBe('30 Sep 2026')
  })
})
