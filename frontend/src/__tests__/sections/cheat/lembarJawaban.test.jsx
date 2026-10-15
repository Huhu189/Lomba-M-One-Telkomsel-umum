/**
 * Tes lembar jawaban murid di Monitor Ulangan.
 *
 * Yang dijaga di sini:
 * 1. jawaban pilihan ganda bisa DIBACA guru — id opsi (`B`) diterjemahkan jadi
 *    bunyi opsinya, karena `B` sendirian tidak berarti apa-apa di layar;
 * 2. soal yang belum dijawab tetap terhitung dan nomornya dirinci, supaya
 *    pertanyaan "anak ini sudah sampai mana?" punya jawaban;
 * 3. panelnya **tidak pernah** menampilkan kunci jawaban maupun nilai per soal —
 *    layar monitor terbuka di depan kelas.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import LembarJawaban from '../../../sections/cheat/komponen/LembarJawaban.jsx'
import {
  formatWaktuJawaban,
  jawabanTerbaca,
  progresLembar,
} from '../../../sections/cheat/lembarJawaban.js'

/**
 * Satu baris soal lembar jawaban (bentuknya sama dengan respons server).
 *
 * @param {number} nomor
 * @param {unknown} jawaban
 * @param {Record<string, unknown>} [tambahan]
 */
const soal = (nomor, jawaban, tambahan = {}) => ({
  question_id: nomor,
  nomor,
  tipe: 'pilihan_ganda',
  tipe_label: 'Pilihan ganda',
  teks: `Soal nomor ${nomor}`,
  opsi: [
    { id: 'A', teks: 'Salah' },
    { id: 'B', teks: 'Benar' },
  ],
  terjawab: jawaban !== null,
  jawaban,
  versi: 0,
  penjawab: null,
  diperbarui_at: jawaban === null ? null : new Date(2026, 9, 6, 7, 5, 9).toISOString(),
  ...tambahan,
})

/**
 * Lembar jawaban satu murid.
 *
 * @param {ReturnType<typeof soal>[]} daftar
 */
const lembar = (daftar) => ({
  attempt: {
    attempt_id: 9,
    student_id: 3,
    nama: 'Murid A',
    attempt_no: 1,
    status: 'berjalan',
    status_label: 'Berjalan',
    terjawab: daftar.filter((satu) => satu.terjawab).length,
    jumlah_soal: daftar.length,
    skor: null,
    deadline_at: null,
    dikumpulkan_at: null,
  },
  soal: daftar,
  server_now: new Date(2026, 9, 6, 7, 0, 0).toISOString(),
})

describe('jawabanTerbaca', () => {
  it('menerjemahkan id opsi menjadi bunyi opsinya', () => {
    expect(jawabanTerbaca(soal(1, 'B'))).toBe('B. Benar')
  })

  it('menyebut soal yang belum dijawab apa adanya', () => {
    expect(jawabanTerbaca(soal(2, null))).toBe('belum dijawab')
  })

  it('membaca pilihan banyak sebagai daftar opsi', () => {
    const baris = soal(3, ['A', 'B'], { tipe: 'pilihan_ganda_kompleks' })

    expect(jawabanTerbaca(baris)).toBe('A. Salah, B. Benar')
  })

  it('memakai ringkasan umum untuk tipe yang jawabannya bukan id opsi', () => {
    const isian = soal(4, 'Dua per tiga', { tipe: 'isian_singkat', opsi: undefined })

    expect(jawabanTerbaca(isian)).toBe('Dua per tiga')
  })

  it('memotong jawaban panjang dan tidak menelan batasnya', () => {
    const panjang = soal(5, 'a'.repeat(120), { tipe: 'uraian', opsi: undefined })
    const hasil = jawabanTerbaca(panjang, 40)

    expect(hasil).toHaveLength(40)
    expect(hasil.endsWith('…')).toBe(true)
  })
})

describe('progresLembar', () => {
  it('menghitung terjawab dan merinci nomor soal yang masih kosong', () => {
    const progres = progresLembar([soal(1, 'B'), soal(2, null), soal(3, null)])

    expect(progres.terjawab).toBe(1)
    expect(progres.jumlah).toBe(3)
    expect(progres.belum).toBe(2)
    expect(progres.nomorKosong).toEqual([2, 3])
  })
})

describe('formatWaktuJawaban', () => {
  it('memakai jam perangkat untuk waktu jawaban', () => {
    expect(formatWaktuJawaban(new Date(2026, 9, 6, 7, 5, 9).toISOString())).toBe('07:05:09')
  })

  it('menulis "—" bila soal belum pernah dijawab', () => {
    expect(formatWaktuJawaban(null)).toBe('—')
  })
})

describe('LembarJawaban', () => {
  it('menampilkan jawaban per soal beserta nomor yang masih kosong', () => {
    const html = renderToStaticMarkup(
      <LembarJawaban nama="Murid A" lembar={lembar([soal(1, 'B'), soal(2, null)])} onTutup={() => {}} onSegarkan={() => {}} />,
    )

    expect(html).toContain('Jawaban Murid A')
    expect(html).toContain('1 dari 2 soal sudah terjawab')
    expect(html).toContain('Belum dijawab: soal 2')
    expect(html).toContain('Soal 1')
    expect(html).toContain('B. Benar')
    expect(html).toContain('Kosong')
    expect(html).toContain('Terakhir diubah 07:05:09')
  })

  it('menegaskan kunci jawaban dan nilai per soal tidak ada di layar monitor', () => {
    const html = renderToStaticMarkup(
      <LembarJawaban nama="Murid A" lembar={lembar([soal(1, 'B')])} onTutup={() => {}} onSegarkan={() => {}} />,
    )

    expect(html).toContain('Kunci jawaban dan nilai per soal tidak ditampilkan di sini')
    // Tidak ada penanda kunci maupun angka nilai per soal di markup-nya.
    expect(html).not.toContain('badge-kunci')
    expect(html).not.toContain('skor_maksimal')
  })

  it('menjelaskan saat kuisnya belum punya soal', () => {
    const html = renderToStaticMarkup(
      <LembarJawaban nama="Murid A" lembar={lembar([])} onTutup={() => {}} onSegarkan={() => {}} />,
    )

    expect(html).toContain('Kuis ini belum punya soal')
  })

  it('menunggu dengan kerangka muat sebelum lembar pertama datang', () => {
    const html = renderToStaticMarkup(
      <LembarJawaban nama="Murid A" onTutup={() => {}} onSegarkan={() => {}} />,
    )

    expect(html).toContain('Memuat jawaban Murid A…')
    expect(html).toContain('Segarkan')
  })

  it('mengatakan apa adanya saat lembarnya gagal dimuat', () => {
    const html = renderToStaticMarkup(
      <LembarJawaban nama="Murid A" galat={new Error('403')} onTutup={() => {}} onSegarkan={() => {}} />,
    )

    expect(html).toContain('Lembar jawaban belum bisa dibuka')
    expect(html).not.toContain('Memuat jawaban')
  })
})
