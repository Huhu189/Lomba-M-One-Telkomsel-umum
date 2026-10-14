/**
 * Helper murni editor materi gaya video editor (non-linear timeline).
 *
 * Dipisah dari komponen supaya aturan urutan/klip/timeline bisa diuji tanpa DOM
 * dan dipakai bersama antara halaman daftar materi dan halaman editor.
 *
 * Model: setiap blok adalah satu KLIP di sebuah `track` (lapisan) dengan
 * `mulai_detik` dan `durasi_detik`. Klip pada track berbeda boleh tumpang tindih;
 * track bernomor lebih besar berada di atas (menutupi yang di bawah).
 */

/**
 * @typedef {'teks'|'media'|'kuis'} TipeBlok
 *
 * @typedef {{
 *   tipe: TipeBlok,
 *   wajib: boolean,
 *   teks: string,
 *   keterangan: string,
 *   unggahan_kode: string,
 *   quiz_id: number|string,
 *   track: number,
 *   mulai_detik: number,
 *   durasi_detik: number,
 *   fase: string,
 *   penjelasan_teks: string,
 *   penjelasan_kode: string,
 *   tampilan?: Record<string, string|number>,
 * }} BarisBlok
 */

/** Durasi bawaan satu klip (detik) — sama dengan bawaan server. */
export const DURASI_BAWAAN = 10

/**
 * Durasi klip terpendek yang diizinkan (detik). Klip boleh dipangkas sangat
 * tipis (0,1 detik) — batas ini juga yang dipakai server saat menyimpan.
 */
export const DURASI_MINIMUM = 0.1

/**
 * Panjang timeline minimal saat isinya masih kosong/kurang dari ini (detik).
 * Timeline mengikuti panjang isi sungguhan (mis. durasi video yang diunggah).
 */
export const TIMELINE_MINIMUM = 5

/** Jumlah track/lapisan bawaan yang selalu ditampilkan di timeline. */
export const JUMLAH_TRACK = 3

/**
 * Panjang maksimum teks penjelasan setelah kuis — sama dengan batas di server
 * (`MateriService::MAKS_PENJELASAN`), supaya ketikan yang kepanjangan tidak
 * diam-diam terpotong saat disimpan.
 */
export const MAKS_PENJELASAN = 5000

/** Track audio (paling bawah) selalu tersedia untuk komentar/narasi. */
export const TRACK_AUDIO = 'audio'

/** Tipe blok yang bisa disisipkan guru, lengkap dengan ikon timeline. */
export const TIPE_BLOK = /** @type {Array<{nilai: TipeBlok, label: string, ikon: string}>} */ ([
  { nilai: 'teks', label: 'Teks', ikon: '¶' },
  { nilai: 'media', label: 'Media', ikon: '▶' },
  { nilai: 'kuis', label: 'Kuis sisipan', ikon: '?' },
])

/**
 * Nama langkah perjalanan (pos) untuk klip ini. Kosong = pakai nama bawaan tema
 * (lihat `perjalanan.js`), jadi guru hanya perlu mengisi yang ingin diganti.
 * Dikirim ke server sebagai `fase`.
 */
export const FASE_KOSONG = ''

/**
 * Baris klip baru untuk satu tipe blok.
 * @param {TipeBlok} tipe
 * @param {Partial<BarisBlok>} [isi]
 * @returns {BarisBlok}
 */
export function blokBaru(tipe, isi) {
  return {
    tipe,
    wajib: true,
    teks: '',
    keterangan: '',
    unggahan_kode: '',
    quiz_id: '',
    track: 0,
    mulai_detik: 0,
    durasi_detik: DURASI_BAWAAN,
    fase: FASE_KOSONG,
    penjelasan_teks: '',
    penjelasan_kode: '',
    ...isi,
  }
}

/**
 * Baris klip dari data server (blok yang sudah tersimpan).
 * @param {Array<Record<string, unknown>>|undefined} blok
 * @returns {BarisBlok[]}
 */
export function dariServer(blok) {
  return (blok ?? []).map((satu, indeks) => {
    // Durasi nol/negatif berarti klip tak pernah aktif di timeline (jendelanya
    // kosong), sehingga pratinjau media tak pernah muncul — persis keluhan
    // "video tidak jalan". Perlakukan seperti durasi bawaan.
    const durasi = typeof satu.durasi_detik === 'number' && satu.durasi_detik > 0 ? satu.durasi_detik : DURASI_BAWAAN
    // Penjelasan setelah kuis (blok kuis); bentuk apa pun selain objek dibaca
    // sebagai belum diisi supaya data lama/null tidak menjatuhkan editor.
    const penjelasan =
      satu.penjelasan !== null && typeof satu.penjelasan === 'object'
        ? /** @type {Record<string, unknown>} */ (satu.penjelasan)
        : {}

    return {
      tipe: /** @type {TipeBlok} */ (String(satu.tipe ?? 'teks')),
      wajib: Boolean(satu.wajib),
      teks: typeof satu.teks === 'string' ? satu.teks : '',
      keterangan: typeof satu.keterangan === 'string' ? satu.keterangan : '',
      unggahan_kode: typeof satu.unggahan_kode === 'string' ? satu.unggahan_kode : '',
      quiz_id: typeof satu.quiz_id === 'number' ? satu.quiz_id : '',
      track: typeof satu.track === 'number' ? satu.track : 0,
      mulai_detik: typeof satu.mulai_detik === 'number' ? satu.mulai_detik : indeks * DURASI_BAWAAN,
      durasi_detik: durasi,
      fase: typeof satu.fase === 'string' ? satu.fase : FASE_KOSONG,
      penjelasan_teks: typeof penjelasan.teks === 'string' ? penjelasan.teks : '',
      penjelasan_kode: typeof penjelasan.unggahan_kode === 'string' ? penjelasan.unggahan_kode : '',
      tampilan:
        satu.tampilan && typeof satu.tampilan === 'object'
          ? /** @type {Record<string, string|number>} */ (satu.tampilan)
          : undefined,
    }
  })
}

/**
 * Ikon & label klip per tipe blok di timeline.
 * @param {TipeBlok} tipe
 * @returns {{ ikon: string, label: string }}
 */
export function ciriKlip(tipe) {
  const cocok = TIPE_BLOK.find((satu) => satu.nilai === tipe)
  return cocok === undefined ? { ikon: '•', label: 'Blok' } : { ikon: cocok.ikon, label: cocok.label }
}

/**
 * Ubah baris klip menjadi muatan yang diterima server (penempatan timeline
 * dikirim sebagai field tingkat atas, server menyimpannya di dalam `isi`).
 * @param {BarisBlok[]} blok
 * @returns {import('./api.js').MuatanBlok[]}
 */
export function muatanBlok(blok) {
  return blok.map((satu) => ({
    tipe: satu.tipe,
    wajib: satu.wajib,
    isi:
      satu.tipe === 'teks'
        ? { teks: satu.teks }
        : satu.tipe === 'media'
          ? { unggahan_kode: satu.unggahan_kode, keterangan: satu.keterangan }
          : penjelasanTerisi(satu)
            ? {
                penjelasan: {
                  teks: satu.penjelasan_teks.trim().slice(0, MAKS_PENJELASAN),
                  unggahan_kode: satu.penjelasan_kode === '' ? null : satu.penjelasan_kode,
                },
              }
            : undefined,
    quiz_id: satu.tipe === 'kuis' ? Number(satu.quiz_id) || null : null,
    track: Math.max(0, Math.round(satu.track)),
    mulai_detik: Math.max(0, satu.mulai_detik),
    durasi_detik: Math.max(DURASI_MINIMUM, satu.durasi_detik),
    // Nama pos hanya dikirim bila guru memang menggantinya.
    ...(satu.fase.trim() === '' ? {} : { fase: satu.fase.trim() }),
    // Hanya dikirim bila guru pernah mengaturnya; selalu dalam bentuk ternormalkan.
    ...(satu.tampilan !== undefined && satu.tipe !== 'teks' ? { tampilan: tampilanKlip(satu) } : {}),
  }))
}

/**
 * Apakah klip ini punya penjelasan setelah kuis (teks atau media). Klip kuis
 * tanpa keduanya tidak mengirim kunci `penjelasan` sama sekali, supaya materi
 * lama tidak ikut berubah saat disimpan ulang.
 *
 * @param {Pick<BarisBlok, 'penjelasan_teks'|'penjelasan_kode'>} satu
 * @returns {boolean}
 */
export function penjelasanTerisi(satu) {
  return satu.penjelasan_teks.trim() !== '' || satu.penjelasan_kode !== ''
}

/**
 * Pindahkan satu klip ke posisi lain (hasil drag di timeline). Mengembalikan
 * larik baru; bila tujuan di luar rentang, larik lama dikembalikan apa adanya.
 *
 * @param {BarisBlok[]} blok
 * @param {number} dari
 * @param {number} ke
 * @returns {BarisBlok[]}
 */
export function pindahBlok(blok, dari, ke) {
  if (dari === ke || dari < 0 || ke < 0 || dari >= blok.length || ke >= blok.length) {
    return blok
  }

  const salinan = [...blok]
  const [diangkat] = salinan.splice(dari, 1)
  salinan.splice(ke, 0, diangkat)

  return salinan
}

/**
 * Sisipkan satu klip baru pada posisi tertentu (default: di akhir) dan
 * kembalikan larik baru beserta indeks baris yang harus dipilih.
 *
 * @param {BarisBlok[]} blok
 * @param {BarisBlok} baris
 * @param {number} [posisi]
 * @returns {{ blok: BarisBlok[], indeks: number }}
 */
export function sisipBlok(blok, baris, posisi = blok.length) {
  const tujuan = Math.max(0, Math.min(posisi, blok.length))
  const salinan = [...blok]
  salinan.splice(tujuan, 0, baris)

  return { blok: salinan, indeks: tujuan }
}

/**
 * Nomor track/lapisan tertinggi yang dipakai klip (minimal JUMLAH_TRACK - 1).
 * @param {BarisBlok[]} blok
 * @returns {number}
 */
export function trackMaksimal(blok) {
  return blok.reduce((maks, satu) => Math.max(maks, satu.track), JUMLAH_TRACK - 1)
}

/**
 * Kelompokkan klip per track. Hasil selalu berisi track 0..trackMaksimal
 * (walau kosong) supaya garis track tetap tampil.
 *
 * @param {BarisBlok[]} blok
 * @returns {Array<{ track: number, klip: Array<{ baris: BarisBlok, indeks: number }> }>}
 */
export function susunTrack(blok) {
  const tertinggi = trackMaksimal(blok)
  /** @type {Array<{ track: number, klip: Array<{ baris: BarisBlok, indeks: number }> }>} */
  const hasil = []

  for (let track = 0; track <= tertinggi; track++) {
    const klip = blok
      .map((baris, indeks) => ({ baris, indeks }))
      .filter((satu) => satu.baris.track === track)
      .sort((a, b) => a.baris.mulai_detik - b.baris.mulai_detik)

    hasil.push({ track, klip })
  }

  return hasil
}

/**
 * Panjang total timeline (detik): titik akhir terjauh dari semua klip.
 *
 * Mengikuti isi sungguhan, bukan angka tetap: dulu hasilnya selalu dinaikkan ke
 * 60 detik sehingga tombol play menampilkan "01:00" walaupun videonya cuma 8
 * detik. Kini timeline berhenti tepat di ujung klip terakhir (dibulatkan 0,1
 * detik), dengan panjang minimum kecil untuk timeline yang masih kosong.
 *
 * @param {BarisBlok[]} blok
 * @returns {number}
 */
export function durasiTotal(blok) {
  const akhir = blok.reduce(
    (maks, satu) => Math.max(maks, satu.mulai_detik + satu.durasi_detik),
    0,
  )

  return Math.max(TIMELINE_MINIMUM, Math.round(akhir * 10) / 10)
}

/**
 * Ubah durasi satu klip (detik), dijepit ke durasi minimum dan dibulatkan ke
 * 0,1 detik supaya klip bisa dipendekkan sedikit demi sedikit dari inspector.
 * @param {BarisBlok[]} blok
 * @param {number} indeks
 * @param {number} durasiBaru
 * @returns {BarisBlok[]}
 */
export function setDurasi(blok, indeks, durasiBaru) {
  const durasi = Math.max(DURASI_MINIMUM, Math.round(durasiBaru * 10) / 10)

  return blok.map((satu, urutan) => (urutan === indeks ? { ...satu, durasi_detik: durasi } : satu))
}

/**
 * Klip yang tampil pada detik tertentu: klip pada track TERTINGGI yang rentang
 * waktunya memuat `detik` (jadi media bisa saling menimpa; yang atas menang).
 *
 * @param {BarisBlok[]} blok
 * @param {number} detik
 * @returns {BarisBlok|null}
 */
export function klipPada(blok, detik) {
  const cocok = blok.filter(
    (satu) => detik >= satu.mulai_detik && detik < satu.mulai_detik + satu.durasi_detik,
  )

  if (cocok.length === 0) return null

  return cocok.reduce((atas, satu) => (satu.track >= atas.track ? satu : atas))
}

/**
 * Geser titik mulai satu klip, dijepit agar tidak negatif (bulat ke 0,1 detik).
 * @param {BarisBlok[]} blok
 * @param {number} indeks
 * @param {number} mulaiBaru
 * @returns {BarisBlok[]}
 */
export function setMulai(blok, indeks, mulaiBaru) {
  const mulai = Math.max(0, Math.round(mulaiBaru * 10) / 10)

  return blok.map((satu, urutan) => (urutan === indeks ? { ...satu, mulai_detik: mulai } : satu))
}

/**
 * Pangkas sisi KIRI klip (gagang `|` kiri di timeline): titik mulai digeser,
 * sedangkan ujung kanannya tetap di tempat — jadi durasi ikut berubah.
 *
 * Beda dengan `setMulai()` yang menggeser klip tanpa mengubah durasinya. Dua
 * tindakan ini gampang tertukar, jadi keduanya dipisah sebagai fungsi sendiri.
 *
 * @param {BarisBlok[]} blok
 * @param {number} indeks
 * @param {number} detikBaru titik mulai yang diinginkan (detik)
 * @returns {BarisBlok[]}
 */
export function pangkasKiri(blok, indeks, detikBaru) {
  const baris = blok[indeks]
  if (baris === undefined) return blok

  const ujung = baris.mulai_detik + baris.durasi_detik
  const batas = Math.max(0, ujung - DURASI_MINIMUM)
  const mulai = Math.min(Math.max(0, Math.round(detikBaru * 10) / 10), batas)
  const durasi = Math.max(DURASI_MINIMUM, Math.round((ujung - mulai) * 10) / 10)

  return blok.map((satu, urutan) =>
    urutan === indeks ? { ...satu, mulai_detik: mulai, durasi_detik: durasi } : satu,
  )
}

/**
 * Pangkas sisi KANAN klip (gagang `|` kanan di timeline): titik mulai tetap,
 * ujung kanan digeser. Dibaca sebagai posisi ujung (bukan panjang), sesuai
 * gagang yang dipegang guru; durasinya tidak pernah lebih pendek dari minimum.
 *
 * @param {BarisBlok[]} blok
 * @param {number} indeks
 * @param {number} detikBaru posisi ujung kanan yang diinginkan (detik)
 * @returns {BarisBlok[]}
 */
export function pangkasKanan(blok, indeks, detikBaru) {
  const baris = blok[indeks]
  if (baris === undefined) return blok

  const durasi = Math.max(DURASI_MINIMUM, Math.round((detikBaru - baris.mulai_detik) * 10) / 10)

  return blok.map((satu, urutan) => (urutan === indeks ? { ...satu, durasi_detik: durasi } : satu))
}

/**
 * Format detik jadi mm:ss untuk kontrol playback dan penggaris.
 * @param {number} detik
 * @returns {string}
 */
export function formatWaktu(detik) {
  const total = Math.max(0, Math.round(detik))
  const menit = Math.floor(total / 60)
  const sisa = total % 60

  return `${String(menit).padStart(2, '0')}:${String(sisa).padStart(2, '0')}`
}

/**
 * Posisi media (detik) untuk satu klip pada playhead global.
 *
 * Dipakai pratinjau editor supaya media native ikut jam timeline: media mulai
 * dari 0 saat playhead menyentuh awal klip, dan tidak melampaui durasi klip.
 * Sebelum akhir klip, playhead di luar jendela klip, jadi offset dijepit ke
 * rentang [0, durasi].
 *
 * @param {number} detik posisi playhead global (detik)
 * @param {number} mulai detik awal klip
 * @param {number} durasi durasi klip (detik); <= 0 berarti tanpa batas
 * @returns {number}
 */
export function offsetMedia(detik, mulai, durasi) {
  const mulaiAman = Number.isFinite(mulai) ? Math.max(0, mulai) : 0
  const mentah = Math.max(0, detik - mulaiAman)

  return Number.isFinite(durasi) && durasi > 0 ? Math.min(mentah, durasi) : mentah
}

/* ------------------------------------------------------------------ *
 * Bingkai (rasio terkunci), penyesuaian media, dan kuis sisipan.
 * ------------------------------------------------------------------ */

/** Rasio bingkai pratinjau yang bisa dipilih guru. */
export const RASIO_CANVAS = [
  { nilai: '16:9', label: 'Horizontal 16:9' },
  { nilai: '9:16', label: 'Vertikal 9:16' },
  { nilai: '1:1', label: 'Kotak 1:1' },
  { nilai: '4:3', label: 'Klasik 4:3' },
]

export const RASIO_BAWAAN = '16:9'

/**
 * Rasio "a:b" jadi angka lebar/tinggi. Nilai tak sah jatuh ke 16:9.
 * @param {string|undefined|null} rasio
 * @returns {number}
 */
export function rasioAngka(rasio) {
  const [a, b] = String(rasio ?? '').split(':').map(Number)

  return a > 0 && b > 0 ? a / b : 16 / 9
}

/**
 * @param {unknown} nilai
 * @param {number} min
 * @param {number} maks
 * @param {number} bawaan
 */
function jepit(nilai, min, maks, bawaan) {
  const angka = Number(nilai)

  return Number.isFinite(angka) ? Math.min(maks, Math.max(min, angka)) : bawaan
}

/** Saklar layar sesudah kuis sisipan: ringkasan soal, kartu ingat, papan latihan. */
export const SAKLAR_SESUDAH_KUIS = /** @type {const} */ (['ringkasan', 'kartu', 'papan'])

/**
 * Pengaturan tampilan klip yang sudah dinormalkan (sama persis dengan yang
 * disimpan server, supaya "belum tersimpan" tidak menyala terus).
 *  - media: fit (contain = utuh, cover = penuhi bingkai/terpotong), fokus_x/y
 *    (0–100, titik yang dipertahankan saat terpotong), zoom (1–3).
 *  - kuis: mode (jeda = video berhenti, berjalan = video lanjut), tata
 *    (vertikal = panel di bawah, horizontal = panel di samping).
 *
 * @param {Pick<BarisBlok, 'tipe'> & { tampilan?: Record<string, string|number> }} satu
 * @returns {Record<string, string|number>}
 */
export function tampilanKlip(satu) {
  const t = satu.tampilan ?? {}

  if (satu.tipe === 'media') {
    return {
      fit: t.fit === 'cover' ? 'cover' : 'contain',
      fokus_x: Math.round(jepit(t.fokus_x, 0, 100, 50)),
      fokus_y: Math.round(jepit(t.fokus_y, 0, 100, 50)),
      zoom: Math.round(jepit(t.zoom, 1, 3, 1) * 100) / 100,
    }
  }

  if (satu.tipe === 'kuis') {
    const hasil = /** @type {Record<string, string|number>} */ ({
      mode: t.mode === 'berjalan' ? 'berjalan' : 'jeda',
      tata: t.tata === 'horizontal' ? 'horizontal' : 'vertikal',
    })

    // Saklar layar sesudah kuis hanya ikut bila guru pernah mengaturnya, supaya
    // kuis lama tidak berubah bentuk saat materi disimpan ulang (0/1, bawaan mati).
    for (const saklar of SAKLAR_SESUDAH_KUIS) {
      if (t[saklar] !== undefined) hasil[saklar] = t[saklar] === 1 || t[saklar] === '1' ? 1 : 0
    }

    return hasil
  }

  return {}
}

/**
 * Ubah sebagian pengaturan tampilan satu klip.
 * @param {BarisBlok[]} blok
 * @param {number} indeks
 * @param {Record<string, string|number>} ubah
 * @returns {BarisBlok[]}
 */
export function ubahTampilan(blok, indeks, ubah) {
  return blok.map((satu, urutan) =>
    urutan === indeks ? { ...satu, tampilan: { ...tampilanKlip(satu), ...ubah } } : satu,
  )
}

/**
 * Gaya CSS media di dalam bingkai: object-fit + titik fokus + zoom.
 * @param {Pick<BarisBlok, 'tipe'> & { tampilan?: Record<string, string|number> }} satu
 * @returns {import('react').CSSProperties}
 */
export function gayaMedia(satu) {
  const t = tampilanKlip(satu)
  const titik = `${t.fokus_x}% ${t.fokus_y}%`

  return {
    objectFit: /** @type {'contain'|'cover'} */ (t.fit),
    objectPosition: titik,
    transform: Number(t.zoom) > 1 ? `scale(${t.zoom})` : undefined,
    transformOrigin: titik,
  }
}

/**
 * Klip tampil di bingkai pada detik tertentu, TANPA kuis (kuis jadi lapisan
 * sendiri di atas media). Track tertinggi menang.
 * @param {BarisBlok[]} blok
 * @param {number} detik
 * @returns {BarisBlok|null}
 */
export function klipDasarPada(blok, detik) {
  return klipPada(
    blok.map((satu) => (satu.tipe === 'kuis' ? { ...satu, durasi_detik: 0 } : satu)),
    detik,
  )
}

/**
 * Kuis yang jendelanya memuat `detik`, urut dari track terendah.
 * @param {BarisBlok[]} blok
 * @param {number} detik
 * @returns {Array<{ baris: BarisBlok, indeks: number }>}
 */
export function kuisPadaWaktu(blok, detik) {
  return blok
    .map((baris, indeks) => ({ baris, indeks }))
    .filter(
      ({ baris }) =>
        baris.tipe === 'kuis' &&
        detik >= baris.mulai_detik &&
        detik < baris.mulai_detik + baris.durasi_detik,
    )
    .sort((a, b) => a.baris.track - b.baris.track)
}

/**
 * Kuis bermode "jeda" pertama yang titik mulainya terlewati/tersentuh saat
 * playhead maju dari `dari` ke `ke`, kecuali yang sudah dilewati.
 *
 * @param {BarisBlok[]} blok
 * @param {number} dari
 * @param {number} ke
 * @param {Set<number>} dilewati indeks kuis yang sudah dilanjutkan
 * @returns {{ baris: BarisBlok, indeks: number }|null}
 */
export function kuisJeda(blok, dari, ke, dilewati) {
  const kandidat = blok
    .map((baris, indeks) => ({ baris, indeks }))
    .filter(
      ({ baris, indeks }) =>
        baris.tipe === 'kuis' &&
        tampilanKlip(baris).mode === 'jeda' &&
        !dilewati.has(indeks) &&
        baris.mulai_detik >= dari &&
        baris.mulai_detik <= ke,
    )
    .sort((a, b) => a.baris.mulai_detik - b.baris.mulai_detik)

  return kandidat[0] ?? null
}

/**
 * Posisi X pointer → detik pada penggaris (dibulatkan 0,1 detik, dijepit).
 * @param {number} klienX
 * @param {{ left: number, width: number }} kotak
 * @param {number} total
 * @returns {number}
 */
export function detikDariX(klienX, kotak, total) {
  if (!(kotak.width > 0)) return 0

  const rasio = Math.min(1, Math.max(0, (klienX - kotak.left) / kotak.width))

  return Math.round(rasio * total * 10) / 10
}
