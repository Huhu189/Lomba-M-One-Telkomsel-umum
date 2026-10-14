import { describe, expect, it } from 'vitest'
import { skemaProgres, skemaResponPeringkat } from '../../../sections/report/api.js'
import {
  angkaRapi,
  angkaTampil,
  barisMilikSaya,
  catatanBonusBaris,
  kelasLencana,
  milikMurid,
  ringkasAturanPapan,
  ringkasTingkat,
  tingkatTampilan,
  urutkanPeringkat,
} from '../../../sections/report/tampilan.js'

/**
 * Satu baris peringkat lengkap sesuai kontrak server.
 * @param {Partial<import('../../../sections/report/api.js').DataBarisPeringkat>} ubah
 */
function barisPeringkat(ubah) {
  return {
    peringkat: 1,
    attempt_id: 1,
    murid_id: 1,
    tim_id: null,
    tim_nama: null,
    anggota: [],
    nama: 'Ani',
    skor: 5,
    skor_maksimal: 10,
    persen: 50,
    jumlah_benar: 1,
    jumlah_soal: 2,
    dikumpulkan_at: '2026-10-06T03:00:00.000Z',
    ...ubah,
  }
}

describe('tingkatTampilan', () => {
  it('memetakan setiap tingkat ke label dan kelas lencana', () => {
    expect(tingkatTampilan('paham')).toEqual({ label: 'Paham', kelas: 'badge-status sukses' })
    expect(tingkatTampilan('mulai_paham').kelas).toBe('badge-status peringatan')
    expect(tingkatTampilan('belum_paham').kelas).toBe('badge-status salah')
    expect(tingkatTampilan('data_belum_cukup').label).toBe('Data belum cukup')
  })

  it('memakai tampilan aman untuk tingkat tak dikenal', () => {
    expect(tingkatTampilan('entah').kelas).toBe('badge-status lembut')
  })
})

describe('kelasLencana', () => {
  it('memberi kelas sesuai kode lencana', () => {
    expect(kelasLencana({ kode: 'emas' })).toBe('lencana lencana-emas')
    expect(kelasLencana({ kode: 'perak' })).toBe('lencana lencana-perak')
    expect(kelasLencana({ kode: 'perunggu' })).toBe('lencana lencana-perunggu')
    expect(kelasLencana({ kode: 'belum' })).toBe('lencana lencana-pendukung')
    expect(kelasLencana(undefined)).toBe('lencana lencana-pendukung')
  })
})

describe('ringkasTingkat', () => {
  it('menghitung tema per tingkat', () => {
    const ringkasan = ringkasTingkat([
      { tingkat: 'paham' },
      { tingkat: 'paham' },
      { tingkat: 'belum_paham' },
      { tingkat: 'data_belum_cukup' },
    ])

    expect(ringkasan.paham).toBe(2)
    expect(ringkasan.belum_paham).toBe(1)
    expect(ringkasan.mulai_paham).toBe(0)
    expect(ringkasan.data_belum_cukup).toBe(1)
  })
})

describe('urutkanPeringkat', () => {
  it('mengurutkan skor menurun', () => {
    const hasil = urutkanPeringkat([
      barisPeringkat({ nama: 'Ani', skor: 3 }),
      barisPeringkat({ nama: 'Budi', skor: 9 }),
    ])

    expect(hasil.map((b) => b.nama)).toEqual(['Budi', 'Ani'])
  })

  it('seri diputus waktu selesai lebih cepat lalu nama', () => {
    const hasil = urutkanPeringkat([
      barisPeringkat({ nama: 'Citra', skor: 5, dikumpulkan_at: '2026-10-06T04:00:00.000Z' }),
      barisPeringkat({ nama: 'Budi', skor: 5, dikumpulkan_at: '2026-10-06T02:00:00.000Z' }),
      barisPeringkat({ nama: 'Ani', skor: 5, dikumpulkan_at: '2026-10-06T02:00:00.000Z' }),
    ])

    expect(hasil.map((b) => b.nama)).toEqual(['Ani', 'Budi', 'Citra'])
  })

  it('murid yang belum mengumpulkan ditaruh paling akhir pada skor seri', () => {
    const hasil = urutkanPeringkat([
      barisPeringkat({ nama: 'Kosong', skor: 5, dikumpulkan_at: null }),
      barisPeringkat({ nama: 'Ada', skor: 5, dikumpulkan_at: '2026-10-06T02:00:00.000Z' }),
    ])

    expect(hasil[0].nama).toBe('Ada')
  })
})

describe('milikMurid', () => {
  it('menemukan baris milik murid atau null', () => {
    expect(milikMurid([{ murid_id: 7 }], 7)).toEqual({ murid_id: 7 })
    expect(milikMurid([{ murid_id: 7 }], 8)).toBeNull()
    expect(milikMurid([], 1)).toBeNull()
  })
})

describe('barisMilikSaya', () => {
  it('mencocokkan murid pada mode individu', () => {
    const baris = barisPeringkat({ murid_id: 7 })

    expect(barisMilikSaya(baris, barisPeringkat({ murid_id: 7 }), false)).toBe(true)
    expect(barisMilikSaya(baris, barisPeringkat({ murid_id: 8 }), false)).toBe(false)
    expect(barisMilikSaya(baris, null, false)).toBe(false)
  })

  it('mencocokkan tim pada mode tim, bukan muridnya', () => {
    const baris = barisPeringkat({ murid_id: null, tim_id: 3, tim_nama: 'Tim 2', nama: 'Tim 2' })
    const saya = barisPeringkat({ murid_id: 99, tim_id: 3, tim_nama: 'Tim 2', nama: 'Tim 2' })

    expect(barisMilikSaya(baris, saya, true)).toBe(true)
    expect(barisMilikSaya(baris, barisPeringkat({ murid_id: null, tim_id: 4 }), true)).toBe(false)
    // Baris murid (tim_id null) tidak pernah dianggap milik tim mana pun.
    expect(barisMilikSaya(barisPeringkat({ murid_id: 7 }), barisPeringkat({ murid_id: 7, tim_id: null }), true)).toBe(
      false,
    )
  })
})

describe('skema laporan', () => {
  it('menerima payload peringkat dari server', () => {
    const data = skemaResponPeringkat.parse({
      kuis_id: 1,
      judul_kuis: 'Ulangan Operasi Hitung',
      mode_tim: false,
      tampil: false,
      guru: false,
      total: 1,
      top: 20,
      terbuka_persen: 30,
      terbuka_jumlah: 1,
      bonus_aktif: false,
      bonus_bawah_persen: 50,
      bonus_maks_persen: 15,
      peringkat: [barisPeringkat({})],
      peringkat_saya: null,
      detail_saya: null,
    })

    expect(data.tampil).toBe(false)
    expect(data.peringkat).toHaveLength(1)
  })

  it('menerima baris peringkat mode tim', () => {
    const data = skemaResponPeringkat.parse({
      kuis_id: 1,
      judul_kuis: 'Ulangan Kelompok',
      mode_tim: true,
      tampil: true,
      guru: false,
      total: 1,
      top: 20,
      terbuka_persen: 30,
      terbuka_jumlah: 1,
      bonus_aktif: false,
      bonus_bawah_persen: 50,
      bonus_maks_persen: 15,
      detail_saya: null,
      peringkat: [
        barisPeringkat({ murid_id: null, tim_id: 9, tim_nama: 'Tim 1', nama: 'Tim 1', anggota: ['Ayu', 'Bima'] }),
      ],
      peringkat_saya: null,
    })

    expect(data.mode_tim).toBe(true)
    expect(data.peringkat[0].anggota).toEqual(['Ayu', 'Bima'])
  })

  it('menerima payload progres dengan remedial kosong', () => {
    const data = skemaProgres.parse({
      murid_id: 1,
      nama: 'Ayu',
      ambang: { ambang_paham: 80, ambang_mulai_paham: 60, data_minimum: 3 },
      tema: [
        {
          tag_id: 2,
          tag_nama: 'Operasi Hitung',
          jumlah_soal: 2,
          jumlah_benar: 1,
          persen: 50,
          tingkat: 'belum_paham',
          tingkat_label: 'Belum paham',
        },
      ],
      badge: { murid_id: 1, nama: 'Ayu', jumlah_lencana: 0, badge: [] },
      remedial: { diaktifkan: true, tema_lemah: [], soal: [] },
    })

    expect(data.tema[0].tingkat).toBe('belum_paham')
    expect(data.remedial.soal).toEqual([])
  })
})

describe('aturan papan peringkat', () => {
  /**
   * Payload papan lengkap; bawaannya papan guru tanpa bonus.
   * @param {Record<string, unknown>} ubah
   * @returns {import('../../../sections/report/api.js').DataPeringkat}
   */
  function papan(ubah) {
    return /** @type {import('../../../sections/report/api.js').DataPeringkat} */ ({
      kuis_id: 1,
      judul_kuis: 'Ulangan Operasi Hitung',
      mode_tim: false,
      tampil: true,
      guru: true,
      total: 3,
      top: 50,
      terbuka_persen: 30,
      terbuka_jumlah: 2,
      bonus_aktif: false,
      bonus_bawah_persen: 50,
      bonus_maks_persen: 15,
      peringkat: [],
      peringkat_saya: null,
      detail_saya: null,
      ...ubah,
    })
  }

  it('angkaTampil memakai angka tampilan dan jatuh ke nilai asli bila tidak dibantu', () => {
    expect(
      angkaTampil(
        barisPeringkat({ skor: 2, skor_tampil: 7, persen: 20, persen_tampil: 70, berbantuan: true }),
      ),
    ).toEqual({ nilai: 7, maksimal: 10, persen: 70 })

    // Baris murid tidak membawa skor_tampil sama sekali: nilai yang ada itulah
    // yang ditampilkan.
    expect(angkaTampil(barisPeringkat({ skor: 7, persen: 70 }))).toEqual({
      nilai: 7,
      maksimal: 10,
      persen: 70,
    })
  })

  it('catatanBonusBaris hanya hidup untuk baris yang ditandai berbantuan', () => {
    expect(catatanBonusBaris(barisPeringkat({}))).toBeNull()
    expect(catatanBonusBaris(barisPeringkat({ berbantuan: false, bonus: 0 }))).toBeNull()

    expect(
      catatanBonusBaris(
        barisPeringkat({ berbantuan: true, bonus: 5, skor: 2, skor_tampil: 7, peringkat_asli: 5 }),
      ),
    ).toEqual({ teks: 'dibantu +5 poin · nilai asli 2 / 10', asli: '2 / 10', peringkatAsli: 5 })
  })

  it('ringkasAturanPapan menjelaskan aturan terbuka kepada murid tanpa menyebut bonus', () => {
    const murid = ringkasAturanPapan(
      papan({
        guru: false,
        bonus_aktif: true,
        bonus_bawah_persen: 50,
        bonus_maks_persen: 60,
        peringkat: [barisPeringkat({ berbantuan: true, bonus: 5 })],
      }),
    )

    expect(murid.catatanKeterbukaan).toContain('2 murid teratas')
    // Sekalipun bonusnya menyala, murid tidak pernah diberi tahu apa pun.
    expect(murid.catatanBonus).toBeNull()
    expect(murid.jumlahDibantu).toBe(0)
  })

  it('ringkasAturanPapan memberi guru hitungan baris yang dibantu dan batasnya', () => {
    const guru = ringkasAturanPapan(
      papan({
        bonus_aktif: true,
        bonus_maks_persen: 60,
        peringkat: [
          barisPeringkat({ berbantuan: true, bonus: 5 }),
          barisPeringkat({ peringkat: 2, berbantuan: false, bonus: 0 }),
          barisPeringkat({ peringkat: 3, berbantuan: true, bonus: 2 }),
        ],
      }),
    )

    expect(guru.jumlahDibantu).toBe(2)
    expect(guru.catatanBonus).toContain('di bawah 50%')
    expect(guru.catatanBonus).toContain('maksimal 60%')
    expect(guru.catatanBonus).toContain('2 baris bertanda')
    expect(guru.catatanBonus).toContain('nilai aslinya tidak berubah')
  })

  it('angkaRapi menulis angka dengan koma dan tanpa nol ekor', () => {
    expect(angkaRapi(7)).toBe('7')
    expect(angkaRapi(7.5)).toBe('7,5')
    expect(angkaRapi(7.25)).toBe('7,25')
    expect(angkaRapi(6.66666)).toBe('6,67')
  })
})
