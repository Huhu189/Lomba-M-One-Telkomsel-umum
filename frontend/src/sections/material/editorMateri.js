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
 * }} BarisBlok
 */

/** Durasi bawaan satu klip (detik) — sama dengan bawaan server. */
export const DURASI_BAWAAN = 10

/** Jumlah track/lapisan bawaan yang selalu ditampilkan di timeline. */
export const JUMLAH_TRACK = 3

/** Track audio (paling bawah) selalu tersedia untuk komentar/narasi. */
export const TRACK_AUDIO = 'audio'

/** Tipe blok yang bisa disisipkan guru, lengkap dengan ikon timeline. */
export const TIPE_BLOK = /** @type {Array<{nilai: TipeBlok, label: string, ikon: string}>} */ ([
  { nilai: 'teks', label: 'Teks', ikon: '¶' },
  { nilai: 'media', label: 'Media', ikon: '▶' },
  { nilai: 'kuis', label: 'Kuis sisipan', ikon: '?' },
])

/**
 * Daftar template materi. SENGAJA dikosongkan dulu: guru menyusun dari nol,
 * panel template hanya menampilkan keadaan kosong sampai template disiapkan.
 * @type {Array<{ id: string, nama: string, deskripsi: string }>}
 */
export const TEMPLATE_MATERI = []

/** Apakah sudah ada template yang bisa dipakai? */
export function adaTemplate() {
  return TEMPLATE_MATERI.length > 0
}

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
    ...isi,
  }
}

/**
 * Baris klip dari data server (blok yang sudah tersimpan).
 * @param {Array<Record<string, unknown>>|undefined} blok
 * @returns {BarisBlok[]}
 */
export function dariServer(blok) {
  return (blok ?? []).map((satu, indeks) => ({
    tipe: /** @type {TipeBlok} */ (String(satu.tipe ?? 'teks')),
    wajib: Boolean(satu.wajib),
    teks: typeof satu.teks === 'string' ? satu.teks : '',
    keterangan: typeof satu.keterangan === 'string' ? satu.keterangan : '',
    unggahan_kode: typeof satu.unggahan_kode === 'string' ? satu.unggahan_kode : '',
    quiz_id: typeof satu.quiz_id === 'number' ? satu.quiz_id : '',
    track: typeof satu.track === 'number' ? satu.track : 0,
    mulai_detik: typeof satu.mulai_detik === 'number' ? satu.mulai_detik : indeks * DURASI_BAWAAN,
    durasi_detik: typeof satu.durasi_detik === 'number' ? satu.durasi_detik : DURASI_BAWAAN,
  }))
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
          : undefined,
    quiz_id: satu.tipe === 'kuis' ? Number(satu.quiz_id) || null : null,
    track: Math.max(0, Math.round(satu.track)),
    mulai_detik: Math.max(0, satu.mulai_detik),
    durasi_detik: Math.max(0.5, satu.durasi_detik),
  }))
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
 * @param {BarisBlok[]} blok
 * @returns {number}
 */
export function durasiTotal(blok) {
  const akhir = blok.reduce(
    (maks, satu) => Math.max(maks, satu.mulai_detik + satu.durasi_detik),
    0,
  )

  // Minimal satu menit supaya penggaris tetap punya ukuran yang masuk akal.
  return Math.max(60, Math.ceil(akhir))
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
