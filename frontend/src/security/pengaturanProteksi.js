/**
 * Saklar proteksi anti-cheat (slice 07).
 *
 * Semua saklar ditentukan **server** lewat pengaturan tiga lapis. Berkas ini
 * hanya menerjemahkan payload attempt menjadi nilai boolean yang aman, lalu
 * menurunkan preset `exam_mode` menjadi saklar efektif.
 *
 * Aturan yang dijaga: bila saklar induk atau semua saklar rinci mati, klien
 * tidak memasang sensor apa pun — artinya tidak ada satu pun permintaan ke
 * server yang lahir dari berkas ini.
 */
import { z } from 'zod'

/** Nama saklar rinci yang dikenali klien (harus sama dengan enum backend). */
export const SAKLAR_RINCI = /** @type {const} */ ([
  'block_paste',
  'block_right_click',
  'block_text_select',
  'block_print',
  'block_screenshot',
  'block_devtools',
  'detect_window_resize',
  'block_tab_switch',
  'focus_lock',
  'block_translate',
])

/** Saklar yang ikut menyala saat preset `exam_mode` dinyalakan (chunk anticheat). */
export const SAKLAR_PRESET_UJIAN = /** @type {const} */ ([
  'block_paste',
  'block_right_click',
  'block_text_select',
  'block_print',
  'block_tab_switch',
  'block_devtools',
])

const booleanAman = z.boolean().catch(false)

/**
 * Skema longgar: kunci yang hilang atau bertipe salah dianggap "mati".
 * Ini disengaja — payload dari luar tidak boleh membuat proteksi menyala
 * karena tebakan, dan juga tidak boleh membuat layar murid gagal dibuka.
 */
export const skemaProteksi = z
  .object({
    anti_cheat: booleanAman,
    exam_mode: booleanAman,
  })
  .catchall(booleanAman)

/**
 * @typedef {Record<string, boolean>} Proteksi
 */

/**
 * Normalisasi payload mentah menjadi peta boolean.
 *
 * @param {unknown} mentah
 * @returns {Proteksi}
 */
export function bacaProteksi(mentah) {
  const hasil = skemaProteksi.safeParse(mentah ?? {})

  // Selalu kembalikan peta LENGKAP: saklar yang tidak dikirim server berarti
  // "mati", bukan "tidak diketahui". Ini yang membuat pengecekan di klien
  // tidak pernah bergantung pada keberadaan sebuah kunci.
  /** @type {Record<string, boolean>} */
  const peta = {}

  for (const saklar of ['anti_cheat', 'exam_mode', ...SAKLAR_RINCI]) {
    peta[saklar] = hasil.success && hasil.data[saklar] === true
  }

  return peta
}

/**
 * Saklar efektif setelah preset diterapkan.
 *
 * Saklar induk mati berarti semuanya mati; preset ujian hanya menyalakan
 * kelompoknya, tidak mematikan saklar yang sudah dinyalakan guru.
 *
 * @param {unknown} mentah
 * @returns {Proteksi}
 */
export function proteksiEfektif(mentah) {
  const proteksi = bacaProteksi(mentah)

  if (proteksi.anti_cheat !== true) {
    return { ...proteksi, exam_mode: false }
  }

  if (proteksi.exam_mode !== true) {
    return proteksi
  }

  const hasil = { ...proteksi }

  for (const saklar of SAKLAR_PRESET_UJIAN) {
    hasil[saklar] = true
  }

  return hasil
}

/**
 * Apakah ada proteksi yang benar-benar aktif? Bila tidak, orkestrator tidak
 * memasang satu pun pendengar kejadian.
 *
 * @param {unknown} mentah
 * @returns {boolean}
 */
export function adaProteksiAktif(mentah) {
  const proteksi = proteksiEfektif(mentah)

  if (proteksi.anti_cheat !== true) {
    return false
  }

  return SAKLAR_RINCI.some((saklar) => proteksi[saklar] === true)
}
