/**
 * Tabel teknik koreksi per jenis soal (14 Oktober 2026).
 *
 * Tabel di `sections/question/teknikKoreksi.js` sengaja kembar dengan
 * `Enums\TeknikKoreksi` + `TipeSoal::teknikKoreksiTersedia()` di server. Tes ini
 * mengunci isi tabelnya (dan Pest mengunci sisi PHP-nya), supaya dua sisi tidak
 * diam-diam berbeda pendapat soal teknik apa yang boleh dipilih guru.
 */
import { describe, expect, it } from 'vitest'
import { TIPE, kunciDariState, stateDariSoal, stateSoalKosong } from '../../../sections/question/tipeSoal.js'
import {
  TEKNIK,
  pilihanTeknikKoreksi,
  teknikKoreksiBawaan,
  teknikKoreksiDariState,
  teknikKoreksiSah,
  teknikKoreksiUntuk,
  teknikTerkunci,
} from '../../../sections/question/teknikKoreksi.js'

describe('tabel teknik koreksi', () => {
  it('tugas unggah hanya manual — tidak ada jawaban yang bisa dicocokkan mesin', () => {
    expect(teknikKoreksiUntuk(TIPE.tugasUnggah)).toEqual([TEKNIK.manual])
    expect(teknikTerkunci(TIPE.tugasUnggah)).toBe(true)
    expect(teknikKoreksiSah(TIPE.tugasUnggah, TEKNIK.otomatis)).toBe(false)
  })

  it('isian singkat dan uraian bisa otomatis teks atau manual', () => {
    for (const tipe of [TIPE.isianSingkat, TIPE.uraian]) {
      expect(teknikKoreksiUntuk(tipe)).toEqual([TEKNIK.otomatisTeks, TEKNIK.manual])
      expect(teknikKoreksiBawaan(tipe)).toBe(TEKNIK.otomatisTeks)
      // Teknik "otomatis" (kunci pasti) tidak masuk akal untuk soal mengarang.
      expect(teknikKoreksiSah(tipe, TEKNIK.otomatis)).toBe(false)
      expect(teknikKoreksiSah(tipe, TEKNIK.manual)).toBe(true)
    }
  })

  it('jenis objektif bisa otomatis atau manual, bawaannya otomatis', () => {
    const objektif = [
      TIPE.pilihanGanda,
      TIPE.benarSalah,
      TIPE.menjodohkan,
      TIPE.mengurutkan,
      TIPE.letakKata,
      TIPE.hubungKata,
      TIPE.pilihanGandaKompleks,
      TIPE.benarSalahMajemuk,
      TIPE.isianAngka,
      TIPE.pilihanGambar,
      TIPE.urutGambar,
      TIPE.susunHuruf,
      TIPE.isianRumpang,
      TIPE.klasifikasi,
      TIPE.tabelIsian,
      TIPE.garisBilangan,
      TIPE.hotspotGambar,
      TIPE.bacaJam,
      TIPE.tekaSilangMini,
    ]

    for (const tipe of objektif) {
      expect(teknikKoreksiUntuk(tipe)).toEqual([TEKNIK.otomatis, TEKNIK.manual])
      expect(teknikKoreksiBawaan(tipe)).toBe(TEKNIK.otomatis)
      // "Otomatis (teks)" hanya untuk jenis yang memang punya penilai teks.
      expect(teknikKoreksiSah(tipe, TEKNIK.otomatisTeks)).toBe(false)
    }
  })

  it('menandai pilihan bawaan dan memberi keterangan tiap pilihan', () => {
    const pilihan = pilihanTeknikKoreksi(TIPE.isianSingkat)

    expect(pilihan.map((satu) => satu.nilai)).toEqual([TEKNIK.otomatisTeks, TEKNIK.manual])
    expect(pilihan.map((satu) => satu.bawaan)).toEqual([true, false])
    expect(pilihan.every((satu) => (satu.label ?? '') !== '' && (satu.keterangan ?? '') !== '')).toBe(true)
  })

  it('nilai asing tidak dianggap sah', () => {
    expect(teknikKoreksiSah(TIPE.pilihanGanda, 'otomatis_banget')).toBe(false)
    expect(teknikKoreksiSah(TIPE.pilihanGanda, undefined)).toBe(false)
    expect(teknikKoreksiSah(TIPE.pilihanGanda, '')).toBe(false)
  })
})

describe('teknik koreksi pada state editor', () => {
  it('soal baru memakai bawaan jenis soalnya', () => {
    expect(stateSoalKosong().teknikKoreksi).toBe(TEKNIK.otomatis)
    expect(teknikKoreksiDariState({ tipe: TIPE.uraian })).toBe(TEKNIK.otomatisTeks)
  })

  it('menyimpan pilihan guru saat soal dibuka kembali', () => {
    const state = stateDariSoal({
      id: 5,
      subject_id: 2,
      tag_id: null,
      tipe: TIPE.pilihanGanda,
      konten: { teks: 'Berapa 2+2?', opsi: [{ id: 'A', teks: '3' }, { id: 'B', teks: '4' }] },
      kunci: { jawaban: 'B', teknik_koreksi: TEKNIK.manual },
      pembahasan: null,
      skor: 4,
      aktif: true,
    })

    expect(state.teknikKoreksi).toBe(TEKNIK.manual)
    expect(kunciDariState(state).teknik_koreksi).toBe(TEKNIK.manual)
  })

  it('soal lama tanpa bidang teknik kembali ke bawaan tanpa mengubah kunci', () => {
    const state = stateDariSoal({
      id: 6,
      subject_id: 2,
      tag_id: null,
      tipe: TIPE.isianSingkat,
      konten: { teks: 'Ibu kota Indonesia?' },
      kunci: { jawaban_baku: ['Jakarta'] },
      pembahasan: null,
      skor: 4,
      aktif: true,
    })

    expect(state.teknikKoreksi).toBe(TEKNIK.otomatisTeks)

    const kunci = kunciDariState(state)

    // Bawaan tidak ikut ditulis, jadi kunci soal lama tetap sama bentuknya.
    expect('teknik_koreksi' in kunci).toBe(false)
    expect(kunci.jawaban_baku).toEqual(['Jakarta'])
  })

  it('nilai teknik yang tidak dikenal dipulihkan ke bawaan', () => {
    const state = stateDariSoal({
      id: 7,
      subject_id: 2,
      tag_id: null,
      tipe: TIPE.uraian,
      konten: { teks: 'Jelaskan!' },
      kunci: { kata_kunci: [{ teks: 'karena' }], teknik_koreksi: 'otomatis' },
      pembahasan: null,
      skor: 4,
      aktif: true,
    })

    // 'otomatis' bukan teknik yang bisa dipakai uraian → kembali ke bawaan.
    expect(state.teknikKoreksi).toBe(TEKNIK.otomatisTeks)
    expect('teknik_koreksi' in kunciDariState(state)).toBe(false)
  })
})
