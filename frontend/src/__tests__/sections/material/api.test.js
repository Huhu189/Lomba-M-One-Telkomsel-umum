import { describe, expect, it } from 'vitest'
import {
  bolehDibuka,
  blokBerikutnya,
  potongBerkas,
  skemaBukaBlok,
  skemaLaporanMateri,
  skemaMateri,
  skemaRingkasanMateri,
  skemaUnggahan,
} from '../../../sections/material/api.js'

/**
 * Satu baris progres blok pada data uji.
 * @typedef {{
 *   block_id: number,
 *   urutan: number,
 *   tipe: string,
 *   tipe_label: string,
 *   wajib: boolean,
 *   status: string,
 *   status_label: string,
 *   skor: number,
 * }} BarisBlokUji
 */

/**
 * Ringkasan progres materi seperti dikirim server.
 * @param {BarisBlokUji[]} blok
 */
function ringkasan(blok) {
  return {
    materi: { id: 1, judul: 'Penjumlahan', deskripsi: null, mapel_nama: 'Matematika', tema_nama: 'Penjumlahan' },
    blok,
    jumlah_blok: blok.length,
    selesai_wajib: blok.filter((satu) => satu.wajib && satu.status === 'selesai').length,
    jumlah_wajib: blok.filter((satu) => satu.wajib).length,
    persen: 0,
  }
}

/**
 * @param {number} urutan
 * @param {boolean} wajib
 * @param {string} status
 * @returns {BarisBlokUji}
 */
function blok(urutan, wajib, status) {
  return {
    block_id: urutan,
    urutan,
    tipe: 'teks',
    tipe_label: 'Teks',
    wajib,
    status,
    status_label: status === 'selesai' ? 'Selesai' : 'Belum dibuka',
    skor: 0,
  }
}

describe('unggah materi guru', () => {
  it('memotong berkas sesuai ukuran potongan dari server', () => {
    const isi = new ArrayBuffer(2500)
    const potongan = potongBerkas(isi, 1000)

    expect(potongan).toHaveLength(3)
    expect(potongan[0].byteLength).toBe(1000)
    expect(potongan[2].byteLength).toBe(500)
    // Gabungan potongan harus utuh kembali (tidak ada byte yang hilang).
    expect(potongan.reduce((total, satu) => total + satu.byteLength, 0)).toBe(2500)
  })

  it('tetap mengirim satu potongan untuk berkas yang lebih kecil dari ukuran potongan', () => {
    expect(potongBerkas(new ArrayBuffer(10), 1024 * 1024)).toHaveLength(1)
  })

  it('memakai ukuran bawaan bila server tidak mengirim ukuran potongan', () => {
    expect(potongBerkas(new ArrayBuffer(1024 * 1024 + 1), 0)).toHaveLength(2)
  })

  it('membaca sesi unggah beserta jumlah potongan dari server', () => {
    const sesi = skemaUnggahan.parse({
      kode: 'kode-unggahan',
      nama_asli: 'peta.png',
      ekstensi: 'png',
      mime: 'image/png',
      kategori: 'umum',
      kategori_label: 'Berkas umum',
      tampil_langsung: true,
      ukuran: 2500,
      ukuran_manusia: '2.4 KiB',
      jumlah_potongan: 3,
      ukuran_potongan: 1000,
      hash: null,
      status: 'menunggu',
      status_label: 'Menunggu potongan',
      url: null,
    })

    expect(sesi.jumlah_potongan).toBe(3)
    expect(sesi.ukuran_potongan).toBe(1000)
    expect(sesi.tampil_langsung).toBe(true)
  })

  it('menerima berkas berisiko tanpa URL bertanda tangan sebelum digabung', () => {
    const sesi = skemaUnggahan.parse({
      kode: 'kode-berisiko',
      nama_asli: 'tugas.docx',
      ekstensi: 'upload',
      mime: 'application/octet-stream',
      kategori: 'berisiko',
      kategori_label: 'Berkas berisiko',
      tampil_langsung: false,
      ukuran: 100,
      ukuran_manusia: '100 B',
      jumlah_potongan: 1,
      ukuran_potongan: 1024,
      hash: null,
      status: 'menunggu',
      status_label: 'Menunggu potongan',
      url: null,
    })

    expect(sesi.tampil_langsung).toBe(false)
    expect(sesi.ekstensi).toBe('upload')
  })
})

describe('progres tema murid', () => {
  it('membaca ringkasan progres beserta status tiap bagian', () => {
    const data = skemaRingkasanMateri.parse(
      ringkasan([blok(1, true, 'selesai'), blok(2, true, 'belum')]),
    )

    expect(data.blok).toHaveLength(2)
    expect(data.blok[0].status).toBe('selesai')
    expect(data.jumlah_wajib).toBe(2)
  })

  it('menunjuk bagian wajib pertama yang belum selesai', () => {
    const data = ringkasan([blok(1, true, 'selesai'), blok(2, true, 'belum'), blok(3, false, 'belum')])

    expect(blokBerikutnya(data)?.urutan).toBe(2)
  })

  it('melewati bagian opsional yang belum selesai bila semua wajib sudah selesai', () => {
    const data = ringkasan([blok(1, true, 'selesai'), blok(2, false, 'belum')])

    expect(blokBerikutnya(data)?.urutan).toBe(2)
  })

  it('mengembalikan null bila seluruh bagian sudah selesai', () => {
    const data = ringkasan([blok(1, true, 'selesai')])

    expect(blokBerikutnya(data)).toBeNull()
  })

  it('menutup bagian berikutnya selama bagian wajib sebelumnya belum selesai', () => {
    const data = ringkasan([blok(1, true, 'belum'), blok(2, true, 'belum'), blok(3, false, 'belum')])

    // Bagian 2 masih tertutup karena bagian 1 wajib belum selesai.
    expect(bolehDibuka(data, data.blok[1])).toBe(false)
    // Bagian opsional setelah bagian wajib yang belum selesai juga tertutup.
    expect(bolehDibuka(data, data.blok[2])).toBe(false)

    const lanjut = ringkasan([blok(1, true, 'selesai'), blok(2, false, 'belum')])

    expect(bolehDibuka(lanjut, lanjut.blok[1])).toBe(true)
  })

  it('membaca hasil membuka blok kuis beserta attempt latihannya', () => {
    const data = skemaBukaBlok.parse({
      blok: {
        block_id: 2,
        urutan: 2,
        tipe: 'kuis',
        tipe_label: 'Kuis sisipan',
        wajib: true,
        status: 'dibuka',
        status_label: 'Sedang dibuka',
        skor: 0,
        kuis: { id: 9, judul: 'Latihan Penjumlahan', jumlah_soal: 3 },
      },
      attempt: {
        id: 21,
        quiz_id: 9,
        jenis: 'latihan',
        jenis_label: 'Latihan',
        status: 'berjalan',
        status_label: 'Berjalan',
        mulai_at: '2026-10-07T04:00:00+07:00',
        deadline_at: '2026-10-07T04:30:00+07:00',
        server_now: '2026-10-07T04:00:00+07:00',
        sisa_detik: 1800,
        terlambat: false,
        jumlah_soal: 3,
        skor: null,
        skor_maksimal: null,
        jumlah_benar: 0,
        dikumpulkan_at: null,
        soal: [],
        jawaban: [],
      },
    })

    expect(data.blok.kuis?.judul).toBe('Latihan Penjumlahan')
    expect(data.attempt?.jenis).toBe('latihan')
  })

  it('menerima blok teks tanpa attempt (bukan blok kuis)', () => {
    const data = skemaBukaBlok.parse({
      blok: {
        block_id: 1,
        urutan: 1,
        tipe: 'teks',
        tipe_label: 'Teks',
        wajib: true,
        status: 'dibuka',
        status_label: 'Sedang dibuka',
        skor: 0,
        teks: 'Bacalah dengan saksama.',
      },
      attempt: null,
    })

    expect(data.attempt).toBeNull()
    expect(data.blok.teks).toBe('Bacalah dengan saksama.')
  })
})

describe('kontrak materi & laporan guru', () => {
  it('membaca materi beserta urutan bloknya', () => {
    const data = skemaMateri.parse({
      id: 1,
      judul: 'Penjumlahan Dasar',
      deskripsi: null,
      status: 'publikasi',
      status_label: 'Terbit',
      subject_id: 2,
      class_id: 3,
      tag_id: 4,
      kelas_nama: '3A',
      jumlah_blok: 1,
      blok: [
        {
          block_id: 5,
          urutan: 1,
          tipe: 'kuis',
          tipe_label: 'Kuis sisipan',
          wajib: true,
          quiz_id: 9,
          kuis_judul: 'Latihan Penjumlahan',
        },
      ],
      unggahan: [],
    })

    expect(data.blok?.[0].quiz_id).toBe(9)
    expect(data.status).toBe('publikasi')
  })

  it('membaca laporan tema materi untuk guru', () => {
    const data = skemaLaporanMateri.parse({
      materi: { id: 1, judul: 'Penjumlahan', status: 'publikasi', kelas_nama: '3A' },
      ambang: { ambang_paham: 80, ambang_mulai_paham: 60, data_minimum: 3 },
      blok: [
        { block_id: 5, urutan: 1, tipe: 'kuis', tipe_label: 'Kuis sisipan', wajib: true, kuis_id: 9 },
      ],
      murid: [
        {
          murid_id: 7,
          nama: 'Ayu',
          blok_selesai: 1,
          jumlah_blok: 1,
          selesai_wajib: 1,
          jumlah_wajib: 1,
          skor_latihan: 4,
          skor_latihan_maksimal: 4,
          tema: [
            {
              tag_id: 4,
              tag_nama: 'Penjumlahan',
              jumlah_soal: 1,
              jumlah_benar: 1,
              persen: 100,
              tingkat: 'paham',
              tingkat_label: 'Paham',
            },
          ],
          blok: [
            {
              block_id: 5,
              urutan: 1,
              tipe: 'kuis',
              tipe_label: 'Kuis sisipan',
              wajib: true,
              status: 'selesai',
              status_label: 'Selesai',
              skor: 4,
              attempt_id: 21,
            },
          ],
        },
      ],
    })

    expect(data.murid[0].tema[0].tingkat_label).toBe('Paham')
    expect(data.murid[0].skor_latihan).toBe(4)
  })
})
