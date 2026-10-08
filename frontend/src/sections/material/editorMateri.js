/**
 * Helper murni editor materi gaya video editor.
 *
 * Dipisah dari komponen supaya aturan urutan/klip bisa diuji tanpa DOM dan
 * dipakai bersama antara halaman daftar materi dan halaman editor.
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
 * }} BarisBlok
 */

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
 * Baris editor baru untuk satu tipe blok.
 * @param {TipeBlok} tipe
 * @returns {BarisBlok}
 */
export function blokBaru(tipe) {
  return { tipe, wajib: true, teks: '', keterangan: '', unggahan_kode: '', quiz_id: '' }
}

/**
 * Baris editor dari data server (blok yang sudah tersimpan).
 * @param {Array<Record<string, unknown>>|undefined} blok
 * @returns {BarisBlok[]}
 */
export function dariServer(blok) {
  return (blok ?? []).map((satu) => ({
    tipe: /** @type {TipeBlok} */ (String(satu.tipe ?? 'teks')),
    wajib: Boolean(satu.wajib),
    teks: typeof satu.teks === 'string' ? satu.teks : '',
    keterangan: typeof satu.keterangan === 'string' ? satu.keterangan : '',
    unggahan_kode: typeof satu.unggahan_kode === 'string' ? satu.unggahan_kode : '',
    quiz_id: typeof satu.quiz_id === 'number' ? satu.quiz_id : '',
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
 * Ubah baris editor menjadi muatan yang diterima server.
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
  }))
}

/**
 * Pindahkan satu klip ke posisi lain (hasil drag di timeline). Mengembalikan
 * larik baru; bila tujuan di luar rentang, larik lama dikembalikan apa adanya
 * supaya pemanggil tidak perlu memeriksa sendiri.
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
 * Sisipkan satu blok baru pada posisi tertentu (default: di akhir) dan
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
