/**
 * Ringkasan setelan sesi + tautan siswa (langkah 3 editor kuis).
 *
 * Yang dijaga berkas ini bukan tampilannya, melainkan aturan yang mudah salah:
 *
 * 1. **saklar induk mati = tidak ada proteksi**, walau saklar rincinya menyala
 *    (kalau ringkasan ini salah, guru menyangka ulangannya diawasi padahal
 *    tidak sama sekali);
 * 2. payload dari API tidak dipercaya — bentuk aneh tidak boleh membuat
 *    halaman editor runtuh, cukup jatuh ke "tidak ada yang menyala";
 * 3. tautan siswa selalu tautan internal `/kuis/<id>`, dan `lanjut` (jalur
 *    pulang setelah masuk) hanya menerima jalur internal — tanpa pagar ini
 *    aplikasi bisa dipakai mengantar orang ke situs lain.
 */
import { describe, expect, it } from 'vitest'
import {
  bacaNilai,
  catatanTautan,
  ringkasSetelan,
  tautanSiswa,
  tujuanLanjut,
} from '../../../sections/quiz/setelanSesi.js'

/**
 * Nilai pengaturan bentuk API: `{ nilai, tipe, label, kelompok, bawaan, sumber, terkunci }`.
 * @param {boolean|number} nilai
 * @param {string} kelompok
 * @param {string} sumber
 */
function nilai(nilai, kelompok, sumber = 'bawaan') {
  return { nilai, tipe: typeof nilai === 'number' ? 'integer' : 'boolean', label: 'label', kelompok, bawaan: false, sumber, terkunci: false }
}

/**
 * Resolusi seperti yang dikembalikan `GET /v1/pengaturan`.
 * @param {Record<string, unknown>} peta
 */
function resolusi(peta) {
  return { sekolah_id: 1, kelas_id: 7, kuis_id: 12, pengaturan: peta }
}

describe('bacaNilai', () => {
  it('mengembalikan nilai, label, sumber, dan kelompok', () => {
    const satu = bacaNilai(resolusi({ ranking: nilai(true, 'Tampilan & laporan', 'kuis') }), 'ranking')

    expect(satu?.nilai).toBe(true)
    expect(satu?.sumber).toBe('kuis')
    expect(satu?.kelompok).toBe('Tampilan & laporan')
  })

  it('payload aneh menjadi null, bukan lemparan', () => {
    expect(bacaNilai(undefined, 'ranking')).toBeNull()
    expect(bacaNilai(null, 'ranking')).toBeNull()
    expect(bacaNilai({ pengaturan: 'bukan objek' }, 'ranking')).toBeNull()
    expect(bacaNilai({ pengaturan: { ranking: 'ya' } }, 'ranking')).toBeNull()
    expect(bacaNilai({ pengaturan: {} }, 'ranking')).toBeNull()
  })
})

describe('ringkasSetelan', () => {
  it('saklar induk mati berarti tidak ada proteksi yang dipasang', () => {
    const ringkas = ringkasSetelan(
      resolusi({
        anti_cheat: nilai(false, 'Anti-cheat', 'sekolah'),
        block_paste: nilai(true, 'Anti-cheat', 'kuis'),
        block_tab_switch: nilai(true, 'Anti-cheat', 'kuis'),
      }),
    )

    expect(ringkas.indukAktif).toBe(false)
    expect(ringkas.proteksi).toEqual([])
    // Keduanya dihitung "mati" karena induknya tertutup.
    expect(ringkas.proteksiMati).toBe(2)
  })

  it('induk menyala: hanya saklar rinci yang menyala yang masuk ringkasan', () => {
    const ringkas = ringkasSetelan(
      resolusi({
        anti_cheat: nilai(true, 'Anti-cheat', 'kuis'),
        block_paste: nilai(true, 'Anti-cheat', 'kuis'),
        block_right_click: nilai(false, 'Anti-cheat'),
        exam_mode: nilai(true, 'Anti-cheat', 'sekolah'),
      }),
    )

    expect(ringkas.indukAktif).toBe(true)
    expect(ringkas.proteksi.map((satu) => satu.kunci)).toEqual(['block_paste', 'exam_mode'])
    expect(ringkas.proteksi[0].sumber).toBe('kuis')
    expect(ringkas.proteksiMati).toBe(1)
  })

  it('saklar induk sendiri tidak pernah muncul sebagai proteksi', () => {
    const ringkas = ringkasSetelan(resolusi({ anti_cheat: nilai(true, 'Anti-cheat') }))

    expect(ringkas.proteksi).toEqual([])
    expect(ringkas.proteksiMati).toBe(0)
  })

  it('hanya kelompok Anti-cheat yang dihitung sebagai proteksi', () => {
    const ringkas = ringkasSetelan(
      resolusi({
        anti_cheat: nilai(true, 'Anti-cheat'),
        ranking: nilai(true, 'Tampilan & laporan'),
        mode_tim: nilai(true, 'Tampilan & laporan'),
      }),
    )

    expect(ringkas.proteksi).toEqual([])
    expect(ringkas.proteksiMati).toBe(0)
    expect(ringkas.aturan.find((satu) => satu.kunci === 'ranking')?.aktif).toBe(true)
  })

  it('izin tamu dibaca terpisah dari proteksi', () => {
    const ringkas = ringkasSetelan(
      resolusi({
        anti_cheat: nilai(false, 'Anti-cheat'),
        izinkan_tamu: nilai(true, 'Siswa tamu', 'kuis'),
      }),
    )

    expect(ringkas.tamu).toEqual({ aktif: true, sumber: 'kuis' })
    expect(ringkas.aturan.some((satu) => satu.kunci === 'izinkan_tamu')).toBe(false)
  })

  it('resolusi kosong atau rusak jatuh ke "semua mati", bukan lemparan', () => {
    for (const masukan of [undefined, null, {}, { pengaturan: null }, { pengaturan: [] }, 'aneh']) {
      const ringkas = ringkasSetelan(masukan)

      expect(ringkas.indukAktif).toBe(false)
      expect(ringkas.proteksi).toEqual([])
      expect(ringkas.tamu.aktif).toBe(false)
      expect(ringkas.aturan).toHaveLength(5)
      expect(ringkas.aturan.every((satu) => satu.aktif === false)).toBe(true)
    }
  })

  it('ambang bilangan bulat tidak ikut jadi saklar', () => {
    const ringkas = ringkasSetelan(
      resolusi({
        data_minimum_tag: nilai(3, 'Laporan & pemahaman'),
        ambang_paham: nilai(80, 'Laporan & pemahaman'),
      }),
    )

    expect(ringkas.proteksi).toEqual([])
    expect(ringkas.aturan.map((satu) => satu.kunci)).not.toContain('ambang_paham')
  })
})

describe('tautanSiswa', () => {
  it('membentuk tautan detail kuis memakai slug, bukan id berurutan', () => {
    expect(tautanSiswa('unu5k', 'http://localhost:5173')).toBe('http://localhost:5173/kuis/unu5k')
    expect(tautanSiswa('unu5k', 'https://ulangan.sekolah.id/')).toBe(
      'https://ulangan.sekolah.id/kuis/unu5k',
    )
    expect(tautanSiswa('09ozbxxr', 'http://localhost:5173')).toBe('http://localhost:5173/kuis/09ozbxxr')
  })

  it('tautan angka lama tetap dibentuk supaya tidak mati', () => {
    expect(tautanSiswa(12, 'http://localhost:5173')).toBe('http://localhost:5173/kuis/12')
    expect(tautanSiswa('12', 'https://ulangan.sekolah.id/')).toBe('https://ulangan.sekolah.id/kuis/12')
  })

  it('kunci atau asal yang tidak masuk akal menghasilkan string kosong', () => {
    expect(tautanSiswa('', 'http://localhost:5173')).toBe('')
    expect(tautanSiswa(null, 'http://localhost:5173')).toBe('')
    expect(tautanSiswa(undefined, 'http://localhost:5173')).toBe('')
    // "0" bukan id kuis yang ada, dan bukan slug: harus ditolak, bukan jadi /kuis/0.
    expect(tautanSiswa(0, 'http://localhost:5173')).toBe('')
    expect(tautanSiswa('0', 'http://localhost:5173')).toBe('')
    expect(tautanSiswa(-3, 'http://localhost:5173')).toBe('')
    expect(tautanSiswa('dua belas', 'http://localhost:5173')).toBe('')
    // Angka panjang tetap dianggap id lama (cadangan), bukan ditolak.
    expect(tautanSiswa('12345678', 'http://localhost:5173')).toBe('http://localhost:5173/kuis/12345678')
    expect(tautanSiswa('12', '')).toBe('')
  })

  it('kunci yang mengandung jalur tambahan tidak pernah disambung', () => {
    for (const aneh of ['../admin', 'a/b', 'a b', 'unu5k?x=1', 'unu5k#frag', 'http://jahat.test']) {
      expect(tautanSiswa(aneh, 'http://localhost:5173')).toBe('')
    }
  })
})

describe('tujuanLanjut', () => {
  it('menerima jalur internal, termasuk yang berisi query', () => {
    expect(tujuanLanjut('/kuis/12')).toBe('/kuis/12')
    expect(tujuanLanjut('/kuis/12?dari=tautan')).toBe('/kuis/12?dari=tautan')
  })

  it('menolak apa pun yang bisa mengantar ke luar aplikasi', () => {
    for (const jahat of [
      'https://jahat.test',
      '//jahat.test',
      '/\\jahat.test',
      'javascript:alert(1)',
      'kuis/12',
      '',
      null,
      undefined,
      42,
      `/kuis/${'a'.repeat(400)}`,
      '/kuis/12\nhttps://jahat.test',
    ]) {
      expect(tujuanLanjut(jahat)).toBeNull()
    }
  })
})

describe('catatanTautan', () => {
  it('kuis draf: tautan belum hidup', () => {
    const catatan = catatanTautan({ status: 'draf', tamuAktif: false })

    expect(catatan).toHaveLength(1)
    expect(catatan[0]).toContain('masih draf')
  })

  it('kuis terbit + izin tamu: pintu tamu terbuka', () => {
    const catatan = catatanTautan({ status: 'publikasi', tamuAktif: true })

    expect(catatan).toHaveLength(1)
    expect(catatan[0]).toContain('Siswa tamu')
  })

  it('kuis draf + izin tamu: dua catatan, jujur soal urutannya', () => {
    const catatan = catatanTautan({ status: 'draf', tamuAktif: true })

    expect(catatan).toHaveLength(2)
    expect(catatan[1]).toContain('setelah kuis diterbitkan')
  })

  it('tanpa izin tamu pada kuis terbit: tidak ada catatan', () => {
    expect(catatanTautan({ status: 'publikasi', tamuAktif: false })).toEqual([])
  })
})
