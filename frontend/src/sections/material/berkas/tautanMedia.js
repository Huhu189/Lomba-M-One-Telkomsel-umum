/**
 * Tautan media materi (cermin **klien** dari `Registry\TautanMedia` di server,
 * 14 Oktober 2026).
 *
 * Guru boleh menyelipkan klip media tanpa mengunggah berkas: cukup menempelkan
 * tautan (YouTube, Google Drive, atau berkas media yang bisa dibuka publik).
 * Berkas ini hanya untuk **tampilan & pesan galat ramah** di editor — yang
 * menentukan boleh-tidaknya sebuah tautan tetap server (`SinkronBlokRequest` +
 * `Registry\TautanMedia`), dan alamat sematan `youtube-nocookie.com` /
 * `drive.google.com` **selalu dihitung server**, tidak pernah dari klien.
 *
 * Karena itu aturannya di sini dijaga kembar dengan server: kalau salah satu
 * berubah, ubah keduanya (dan tes `tautanMedia.test.js` ikut merah bila tidak).
 */

/** Panjang maksimum tautan yang boleh disimpan — sama dengan server. */
export const MAKS_TAUTAN = 500

/** Mime yang dikenali dari ekstensi berkas tautan langsung. */
const MIME = /** @type {Record<string, string>} */ ({
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  oga: 'audio/ogg',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  pdf: 'application/pdf',
})

/** Host sematan yang diizinkan (bingkai di halaman murid) — sama dengan server. */
export const HOST_SEMATAN = ['www.youtube-nocookie.com', 'drive.google.com']

/**
 * Parameter pemutaran otomatis untuk bingkai YouTube.
 *
 * - `autoplay=1` : video langsung jalan, tombol logo YouTube tidak perlu ditekan.
 * - `mute=1`     : peramban (Chrome/Safari/Firefox) hanya mengizinkan autoplay
 *                  yang andal bila awalnya tanpa suara; murid tinggal menyalakan
 *                  suara dari kontrol pemutar. Ubah ke `'0'` bila ingin mencoba
 *                  berbunyi (akan diblokir sebagian peramban).
 * - `playsinline`: di iOS video tetap di dalam bingkai, tidak memaksa layar penuh.
 * - `rel=0`      : saran video di akhir hanya dari kanal yang sama.
 */
const PARAMETER_YOUTUBE = /** @type {Record<string, string>} */ ({
  autoplay: '1',
  mute: '1',
  playsinline: '1',
  rel: '0',
})

/**
 * Ubah alamat sematan **yang sudah dihitung server** menjadi alamat yang
 * langsung memutar video. Hanya menambah parameter pada host YouTube yang
 * diizinkan (`HOST_SEMATAN`); host dan jalurnya tidak pernah diubah, jadi
 * aturan "klien tidak menyusun alamat bingkai sendiri" tetap berlaku.
 *
 * Google Drive TIDAK punya parameter autoplay resmi (pemutarnya hidup di dalam
 * bingkai lintas-origin), jadi alamatnya dikembalikan apa adanya.
 *
 * @param {string|null|undefined} sematan
 * @returns {string|undefined}
 */
export function sematanOtomatis(sematan) {
  if (sematan === null || sematan === undefined || sematan === '') return undefined

  /** @type {URL} */
  let alamat

  try {
    alamat = new URL(sematan)
  } catch {
    return sematan
  }

  if (alamat.protocol !== 'https:' || alamat.hostname !== 'www.youtube-nocookie.com') return sematan

  for (const [kunci, nilai] of Object.entries(PARAMETER_YOUTUBE)) {
    alamat.searchParams.set(kunci, nilai)
  }

  return alamat.toString()
}

/**
 * Apakah tautan ini boleh disimpan? Hanya **https**, host publik ber titik,
 * tanpa kredensial, dan bukan alamat mesin lokal (sama dengan aturan server).
 *
 * @param {string} tautan
 * @returns {boolean}
 */
export function amanTautan(tautan) {
  const bersih = tautan.trim()

  if (bersih === '' || bersih.length > MAKS_TAUTAN) return false

  /** @type {URL} */
  let alamat

  try {
    alamat = new URL(bersih)
  } catch {
    return false
  }

  if (alamat.protocol !== 'https:') return false
  if (alamat.username !== '' || alamat.password !== '') return false
  if (!alamat.hostname.includes('.') || alamat.hostname.endsWith('.local')) return false

  // Alamat IP privat/terpesan (10.x, 192.168.x, 169.254.x, ::1, …) ditolak.
  if (/^[\d.]+$/.test(alamat.hostname) || alamat.hostname.includes(':')) {
    const oktet = alamat.hostname.split('.').map(Number)

    if (oktet.length === 4 && oktet.every((angka) => Number.isInteger(angka))) {
      const [a, b] = oktet

      return !(a === 10 || a === 127 || a === 0 || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31))
    }

    return false
  }

  return true
}

/**
 * ID video YouTube dari bentuk alamat yang lazim dipakai guru.
 * @param {string} tautan
 * @returns {string|null}
 */
function idYoutube(tautan) {
  /** @type {URL} */
  let alamat

  try {
    alamat = new URL(tautan.trim())
  } catch {
    return null
  }

  const host = alamat.hostname.toLowerCase()
  const potongan = alamat.pathname.split('/').filter((satu) => satu !== '')
  /** @type {string|null} */
  let kandidat = null

  if (host === 'youtu.be' || host === 'www.youtu.be') {
    kandidat = potongan[0] ?? null
  } else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) {
    if (potongan.length > 1 && ['embed', 'shorts', 'live', 'v'].includes(potongan[0])) {
      kandidat = potongan[1]
    } else if (alamat.searchParams.has('v')) {
      kandidat = alamat.searchParams.get('v')
    }
  }

  return kandidat !== null && /^[A-Za-z0-9_-]{11}$/.test(kandidat) ? kandidat : null
}

/**
 * ID berkas Google Drive dari `/file/d/{id}/…` atau `?id={id}`.
 * @param {string} tautan
 * @returns {string|null}
 */
function idDrive(tautan) {
  /** @type {URL} */
  let alamat

  try {
    alamat = new URL(tautan.trim())
  } catch {
    return null
  }

  if (!['drive.google.com', 'docs.google.com'].includes(alamat.hostname.toLowerCase())) return null

  const dariJalur = /\/d\/([A-Za-z0-9_-]{10,})/.exec(alamat.pathname)
  const kandidat = dariJalur?.[1] ?? alamat.searchParams.get('id')

  return kandidat !== null && kandidat !== undefined && /^[A-Za-z0-9_-]{10,}$/.test(kandidat) ? kandidat : null
}

/**
 * Mime berkas media dari ekstensi tautan; `null` bila bukan berkas media.
 * @param {string} tautan
 * @returns {string|null}
 */
export function mimeTautan(tautan) {
  let jalur = ''

  try {
    jalur = new URL(tautan.trim()).pathname
  } catch {
    return null
  }

  const ekstensi = decodeURIComponent(jalur).toLowerCase().split('.').pop() ?? ''

  return MIME[ekstensi] ?? null
}

/**
 * Jenis tautan: `youtube`, `drive`, `berkas`, atau `lain`.
 * @param {string} tautan
 * @returns {'youtube'|'drive'|'berkas'|'lain'}
 */
export function jenisTautan(tautan) {
  if (idYoutube(tautan) !== null) return 'youtube'
  if (idDrive(tautan) !== null) return 'drive'

  return mimeTautan(tautan) === null ? 'lain' : 'berkas'
}

/**
 * Nama yang ditampilkan guru: nama berkasnya bila ada, atau hostnya.
 * @param {string} tautan
 * @returns {string}
 */
export function namaTautan(tautan) {
  try {
    const alamat = new URL(tautan.trim())
    const nama = decodeURIComponent(alamat.pathname).split('/').filter(Boolean).pop() ?? ''

    return nama.includes('.') ? nama.slice(0, 120) : alamat.hostname.slice(0, 120)
  } catch {
    return 'Tautan media'
  }
}

/**
 * Label jenis tautan untuk guru & murid.
 * @param {string} jenis
 * @returns {string}
 */
export function labelTautan(jenis) {
  if (jenis === 'youtube') return 'Video YouTube'
  if (jenis === 'drive') return 'Berkas Google Drive'
  if (jenis === 'berkas') return 'Berkas tautan'

  return 'Tautan media'
}

/**
 * Pesan galat ramah untuk tautan yang belum boleh disimpan; `''` bila tautannya
 * sudah benar (tombolnya boleh hidup).
 * @param {string} tautan
 * @returns {string}
 */
export function pesanGalatTautan(tautan) {
  if (tautan.trim() === '') return 'Tempelkan alamat medianya dulu.'

  let alamat

  try {
    alamat = new URL(tautan.trim())
  } catch {
    return 'Alamatnya belum berbentuk tautan yang benar (contoh: https://www.youtube.com/watch?v=…).'
  }

  if (alamat.protocol !== 'https:') return 'Alamatnya harus dimulai dengan https:// (http diblokir peramban di halaman sekolah).'
  if (amanTautan(tautan)) return ''

  return 'Alamat lokal atau alamat bersandi tidak boleh dipakai untuk media materi.'
}

/**
 * Alamat bingkai untuk **pratinjau di editor guru** — kembaran
 * `Registry\TautanMedia::sematan()` di server. Hanya dua host yang mungkin
 * (lihat `HOST_SEMATAN`); di halaman murid alamat bingkai tetap dihitung server.
 *
 * @param {string} tautan
 * @returns {string|null}
 */
export function sematanPratinjau(tautan) {
  if (!amanTautan(tautan)) return null

  const yt = idYoutube(tautan)
  if (yt !== null) return `https://www.youtube-nocookie.com/embed/${yt}`

  const drive = idDrive(tautan)
  if (drive !== null) return `https://drive.google.com/file/d/${drive}/preview`

  return null
}
