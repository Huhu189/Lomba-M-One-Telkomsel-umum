import { describe, expect, it } from 'vitest'
import {
  bolehSimpan,
  butuhSoal,
  butuhTulisan,
  ringkasLayar,
  skemaLayar,
} from '../../../sections/presence/layar.js'

/** Keadaan layar seperti dikirim server untuk murid (tanpa bahan pengendali). */
function layarMurid(/** @type {Record<string, unknown>} */ ubah) {
  return {
    kuis_id: 7,
    aktif: true,
    mode: 'kosong',
    mode_label: 'Kosong (ulangan biasa)',
    judul: null,
    isi: null,
    soal: null,
    versi: 0,
    diperbarui_at: null,
    ...ubah,
  }
}

describe('skema layar', () => {
  it('menerima keadaan murid tanpa bahan pengendali guru', () => {
    const data = skemaLayar.parse(layarMurid({}))

    expect(data.mode).toBe('kosong')
    expect(data.daftar_soal).toBeUndefined()
    expect(data.daftar_mode).toBeUndefined()
  })

  it('menerima keadaan guru lengkap dengan daftar soal dan daftar mode', () => {
    const data = skemaLayar.parse(
      layarMurid({
        mode: 'soal',
        mode_label: 'Sorot satu soal',
        judul: 'Bahas nomor 2',
        versi: 3,
        soal: {
          id: 12,
          nomor: 2,
          tipe: 'pilihan_ganda',
          tipe_label: 'Pilihan ganda',
          konten: { teks: 'Hasil dari 7 x 8?', opsi: [{ id: 'a', teks: '56' }] },
          skor: 10,
        },
        diubah_oleh: 4,
        kelas_nama: '6A',
        judul_kuis: 'Ulangan Matematika',
        maks_judul: 120,
        maks_isi: 1000,
        daftar_soal: [{ id: 12, nomor: 2, ringkas: 'Hasil dari 7 x 8?' }],
        daftar_mode: [
          { nilai: 'kosong', label: 'Kosong (ulangan biasa)' },
          { nilai: 'soal', label: 'Sorot satu soal' },
        ],
      }),
    )

    expect(data.soal?.nomor).toBe(2)
    expect(data.daftar_soal).toHaveLength(1)
    expect(data.daftar_mode).toHaveLength(2)
  })

  it('menolak soal yang tidak punya nomor (bentuk server berubah)', () => {
    const hasil = skemaLayar.safeParse(
      layarMurid({
        mode: 'soal',
        soal: { id: 12, tipe: 'pilihan_ganda', tipe_label: 'Pilihan ganda', konten: {}, skor: 10 },
      }),
    )

    expect(hasil.success).toBe(false)
  })

  it('membuang kolom asing dari server, termasuk bila ada kunci jawaban nyasar', () => {
    const data = skemaLayar.parse(
      layarMurid({
        soal: {
          id: 12,
          nomor: 2,
          tipe: 'pilihan_ganda',
          tipe_label: 'Pilihan ganda',
          konten: { teks: '?' },
          skor: 10,
          kunci: { jawaban: 'a' },
        },
      }),
    )

    // Zod membuang kolom yang tidak dikenal, jadi kunci tidak pernah ikut
    // dipakai komponen mana pun walau server keliru mengirimnya.
    expect(data.soal).not.toHaveProperty('kunci')
  })
})

describe('ringkasLayar', () => {
  it('menyebut layar yang dimatikan pengaturan', () => {
    expect(ringkasLayar(skemaLayar.parse(layarMurid({ aktif: false })))).toBe('Layar guru dimatikan di pengaturan')
  })

  it('meringkas pengumuman dan sorotan soal', () => {
    const pengumuman = skemaLayar.parse(
      layarMurid({ mode: 'pengumuman', mode_label: 'Pengumuman singkat', judul: 'Sisa 10 menit' }),
    )
    expect(ringkasLayar(pengumuman)).toBe('Pengumuman singkat: Sisa 10 menit')

    const soal = skemaLayar.parse(
      layarMurid({
        mode: 'soal',
        mode_label: 'Sorot satu soal',
        soal: { id: 1, nomor: 4, tipe: 'uraian', tipe_label: 'Uraian', konten: {}, skor: 5 },
      }),
    )
    expect(ringkasLayar(soal)).toBe('Sorotan soal nomor 4')
  })

  it('menandai sorotan soal yang belum dipilih, bukan menampilkan nomor kosong', () => {
    expect(ringkasLayar(skemaLayar.parse(layarMurid({ mode: 'soal', mode_label: 'Sorot satu soal' })))).toBe(
      'Sorotan soal (belum dipilih)',
    )
  })
})

describe('aturan form layar guru', () => {
  it('hanya mode soal yang butuh soal dan hanya pengumuman/hasil yang butuh tulisan', () => {
    expect(butuhSoal('soal')).toBe(true)
    expect(butuhSoal('pengumuman')).toBe(false)
    expect(butuhTulisan('pengumuman')).toBe(true)
    expect(butuhTulisan('hasil')).toBe(true)
    expect(butuhTulisan('kosong')).toBe(false)
  })

  it('menahan simpan sampai bahan yang wajib terisi', () => {
    expect(bolehSimpan({ mode: 'kosong', judul: '', isi: '', soalId: null })).toBe(true)
    expect(bolehSimpan({ mode: 'soal', judul: '', isi: '', soalId: null })).toBe(false)
    expect(bolehSimpan({ mode: 'soal', judul: '', isi: '', soalId: 5 })).toBe(true)
    expect(bolehSimpan({ mode: 'pengumuman', judul: '   ', isi: '', soalId: null })).toBe(false)
    expect(bolehSimpan({ mode: 'pengumuman', judul: '', isi: 'Sisa 5 menit', soalId: null })).toBe(true)
  })
})
