/**
 * Tautan media & drag-and-drop berkas di editor materi (14 Oktober 2026).
 *
 * Dua hal yang dijaga di sini:
 *
 * 1. **Aturan tautan** (`sections/material/berkas/tautanMedia.js`) harus kembar dengan
 *    `Registry\TautanMedia` di server — kelas PHP-nya diuji terpisah di
 *    `backend/tests/Unit/TautanMediaTest.php` dengan daftar alamat yang sama.
 *    Editor hanya memakai cermin ini untuk pesan galat ramah; yang memutuskan
 *    tetap server.
 * 2. **Keputusan saat berkas dijatuhkan** (`rencanaLepasBerkas`): di klip = tukar,
 *    di tempat lain = klip baru, lebih dari satu berkas = ditolak dengan pesan
 *    — bukan diam-diam mengunggah yang pertama.
 */
import { describe, expect, it } from 'vitest'
import {
  amanTautan,
  jenisTautan,
  labelTautan,
  mimeTautan,
  namaTautan,
  pesanGalatTautan,
  sematanOtomatis,
} from '../../../sections/material/berkas/tautanMedia.js'
import { blokBaru, dariServer, muatanBlok, rencanaLepasBerkas } from '../../../sections/material/editor/editorMateri.js'

describe('aturan tautan (cermin server)', () => {
  it('menerima alamat https publik', () => {
    expect(amanTautan('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
    expect(amanTautan('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view')).toBe(true)
    expect(amanTautan('https://sekolah.example.test/materi/pecahan.mp4')).toBe(true)
  })

  it('menolak http, skema aneh, alamat bersandi, dan alamat mesin lokal', () => {
    const ditolak = [
      'http://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'https://murid:rahasia@www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://localhost/video.mp4',
      'https://127.0.0.1/video.mp4',
      'https://192.168.1.10/video.mp4',
      'https://10.0.0.5/video.mp4',
      'https://169.254.169.254/latest/meta-data',
      'https://server-sekolah.local/video.mp4',
      'https://tanpa-titik/video.mp4',
      '',
      '   ',
      `https://www.youtube.com/watch?v=${'a'.repeat(600)}`,
    ]

    for (const tautan of ditolak) {
      expect(amanTautan(tautan), `seharusnya ditolak: ${tautan}`).toBe(false)
    }
  })

  it('mengenali jenis tautan seperti server', () => {
    expect(jenisTautan('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube')
    expect(jenisTautan('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube')
    expect(jenisTautan('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('youtube')
    // Bukan 11 karakter → bukan ID → tidak dianggap YouTube.
    expect(jenisTautan('https://www.youtube.com/watch?v=pendek')).toBe('lain')
    expect(jenisTautan('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view')).toBe('drive')
    expect(jenisTautan('https://sekolah.example.test/materi/pecahan.mp4')).toBe('berkas')
    expect(jenisTautan('https://sekolah.example.test/bank-soal/artikel')).toBe('lain')
  })

  it('membaca mime dari ekstensi dan nama yang ditampilkan', () => {
    expect(mimeTautan('https://sekolah.example.test/materi/pecahan.mp4')).toBe('video/mp4')
    expect(mimeTautan('https://sekolah.example.test/materi/poster.PNG')).toBe('image/png')
    expect(mimeTautan('https://sekolah.example.test/bank-soal/artikel')).toBe(null)
    expect(namaTautan('https://sekolah.example.test/materi/pecahan%20kelas%204.mp4')).toBe(
      'pecahan kelas 4.mp4',
    )
    expect(namaTautan('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('www.youtube.com')
    expect(labelTautan('youtube')).toBe('Video YouTube')
    expect(labelTautan('drive')).toBe('Berkas Google Drive')
  })

  it('memberi pesan galat yang menyebut sebabnya, bukan diam', () => {
    expect(pesanGalatTautan('')).toContain('Tempelkan')
    expect(pesanGalatTautan('bukan tautan')).toContain('belum berbentuk tautan')
    expect(pesanGalatTautan('http://www.youtube.com/watch?v=dQw4w9WgXcQ')).toContain('https')
    expect(pesanGalatTautan('https://192.168.1.10/video.mp4')).toContain('lokal')
    // Tautan yang benar tidak punya pesan galat — tombolnya boleh hidup.
    expect(pesanGalatTautan('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('')
  })
})

describe('berkas yang dijatuhkan di editor', () => {
  it('menukar berkas klip tepat di bawah seretan', () => {
    expect(rencanaLepasBerkas(2, 1)).toEqual({ aksi: 'tukar', indeks: 2, pesan: '' })
  })

  it('membuat klip baru bila dijatuhkan bukan di klip', () => {
    expect(rencanaLepasBerkas(null, 1)).toEqual({ aksi: 'tambah', indeks: null, pesan: '' })
  })

  it('menolak seretan tanpa berkas dan lebih dari satu berkas — dengan pesan', () => {
    const kosong = rencanaLepasBerkas(null, 0)
    const banyak = rencanaLepasBerkas(null, 3)

    expect(kosong.aksi).toBe('tolak')
    expect(kosong.pesan).not.toBe('')
    expect(banyak.aksi).toBe('tolak')
    expect(banyak.pesan).toContain('3 berkas')
  })
})

describe('klip media bersumber tautan', () => {
  it('mengirim tautan ke server dan mengosongkannya saat klip tidak memakai tautan', () => {
    const tautan = blokBaru('media', { tautan: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
    const berkas = blokBaru('media', { unggahan_kode: 'KODE-1' })

    expect(muatanBlok([tautan])[0].isi).toEqual({
      unggahan_kode: '',
      keterangan: '',
      tautan: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    })
    // Klip tanpa tautan mengirim `null` — server membacanya sebagai "tidak diisi".
    expect(muatanBlok([berkas])[0].isi).toEqual({
      unggahan_kode: 'KODE-1',
      keterangan: '',
      tautan: null,
    })
  })

  it('membaca tautan dari data server dan menyisipkan klip baru lewat tautan', () => {
    const [baris] = dariServer([
      {
        block_id: 9,
        urutan: 0,
        tipe: 'media',
        wajib: true,
        tautan: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view',
        track: 0,
        mulai_detik: 0,
        durasi_detik: 12,
      },
    ])

    expect(baris.tautan).toBe('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view')
    expect(baris.unggahan_kode).toBe('')
    // Klip baru dari tautan: sumbernya tautan, bukan berkas unggahan.
    const baru = blokBaru('media', { tautan: 'https://sekolah.example.test/materi/pecahan.mp4' })

    expect(baru.tautan).toBe('https://sekolah.example.test/materi/pecahan.mp4')
    expect(baru.unggahan_kode).toBe('')
  })
})

describe('sematanOtomatis', () => {
  it('menambah parameter autoplay hanya pada bingkai YouTube', () => {
    const alamat = new URL(sematanOtomatis('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ') ?? '')

    expect(`${alamat.origin}${alamat.pathname}`).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(alamat.searchParams.get('autoplay')).toBe('1')
    expect(alamat.searchParams.get('mute')).toBe('1')
    expect(alamat.searchParams.get('playsinline')).toBe('1')
  })

  it('membiarkan Drive dan host lain apa adanya (tidak ada autoplay resmi)', () => {
    const drive = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/preview'

    expect(sematanOtomatis(drive)).toBe(drive)
    expect(sematanOtomatis('https://contoh.example.test/embed/x')).toBe('https://contoh.example.test/embed/x')
  })

  it('mengembalikan undefined untuk nilai kosong', () => {
    expect(sematanOtomatis(null)).toBeUndefined()
    expect(sematanOtomatis('')).toBeUndefined()
  })
})
