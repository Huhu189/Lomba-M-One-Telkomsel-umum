/**
 * Media pendukung soal: gambar opsional + MathML native.
 *
 * MathML diubah dari untai menjadi elemen React lewat DOMParser + daftar putih
 * tag/atribut — tanpa dangerouslySetInnerHTML (aturan react/no-danger).
 */
import { Fragment, createElement } from 'react'
import { teksAman } from '../tipeSoal.js'

/** Elemen MathML yang boleh dirender. */
const TAGS_MATHML = new Set([
  'math',
  'mrow',
  'mi',
  'mn',
  'mo',
  'mtext',
  'ms',
  'mspace',
  'msup',
  'msub',
  'msubsup',
  'mfrac',
  'msqrt',
  'mroot',
  'mfenced',
  'mtable',
  'mlabeledtr',
  'mtr',
  'mtd',
  'munder',
  'mover',
  'munderover',
  'mmultiscripts',
  'mprescripts',
  'none',
  'mstyle',
  'mpadded',
  'mphantom',
  'menclose',
  'semantics',
  'annotation',
])

/** Atribut MathML yang diteruskan apa adanya. */
const ATRIBUT_MATHML = new Set([
  'display',
  'mathvariant',
  'mathsize',
  'mathcolor',
  'mathbackground',
  'stretchy',
  'fence',
  'separator',
  'separators',
  'linethickness',
  'notation',
  'columnalign',
  'rowalign',
  'columnspacing',
  'rowspacing',
  'columnlines',
  'rowlines',
  'width',
  'height',
  'depth',
  'scriptlevel',
  'movablelimits',
  'accent',
  'accentunder',
  'form',
  'open',
  'close',
  'minsize',
  'maxsize',
  'largeop',
  'symmetric',
])

/**
 * Ubah simpul DOM hasil parse menjadi elemen React.
 * @param {Node} simpul
 * @returns {import('react').ReactNode}
 */
function elemenDariSimpul(simpul) {
  if (simpul.nodeType === 3) return simpul.textContent
  if (simpul.nodeType !== 1) return null

  const elemen = /** @type {Element} */ (simpul)
  const nama = elemen.tagName.toLowerCase()

  if (!TAGS_MATHML.has(nama)) return elemen.textContent

  /** @type {Record<string, string>} */
  const sifat = {}
  for (const atribut of Array.from(elemen.attributes)) {
    if (ATRIBUT_MATHML.has(atribut.name)) sifat[atribut.name] = atribut.value
  }

  const anak = Array.from(elemen.childNodes).map((isi, nomor) => (
    <Fragment key={nomor}>{elemenDariSimpul(isi)}</Fragment>
  ))

  return createElement(nama, sifat, ...anak)
}

/**
 * Ubah untai MathML menjadi elemen React. `null` bila tidak ada MathML atau
 * DOMParser tidak tersedia (lingkungan tanpa DOM).
 * @param {string} teks
 * @returns {import('react').ReactNode|null}
 */
export function mathmlKeElemen(teks) {
  if (typeof DOMParser === 'undefined') return null

  const dokumen = new DOMParser().parseFromString(teks, 'text/html')
  const akar = dokumen.querySelector('math')

  return akar === null ? null : elemenDariSimpul(akar)
}

/**
 * Cadangan saat MathML tidak bisa dirender: buang tag, sisakan teksnya.
 * @param {string} teks
 * @returns {string}
 */
export function teksTanpaTag(teks) {
  return teks.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** @param {{ konten: Record<string, unknown> }} props */
export default function MediaSoal({ konten }) {
  const media = teksAman(konten.media).trim()
  const matematika = teksAman(konten.matematika).trim()
  const elemen = matematika === '' ? null : mathmlKeElemen(matematika)

  return (
    <>
      {media !== '' && (
        <img className="media-soal" src={media} alt="Media pendukung soal" loading="lazy" />
      )}

      {elemen !== null && <div className="mathml-soal">{elemen}</div>}

      {matematika !== '' && elemen === null && (
        <p className="mathml-soal teks-lembut small mb-0">{teksTanpaTag(matematika)}</p>
      )}
    </>
  )
}
