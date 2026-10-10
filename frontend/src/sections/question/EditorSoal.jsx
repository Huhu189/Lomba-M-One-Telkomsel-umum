/**
 * Editor bank soal (slice 03 + 06) — papan desain 11.
 *
 * Tata letaknya tiga kartu bernomor di kolom utama (jenis soal → isi soal →
 * pengaturan) dengan sisi kanan yang mengikuti gulir berisi pratinjau dan daftar
 * kelengkapan. Bidang berubah mengikuti tipe soal (delapan tipe); validasi
 * kelengkapan dijalankan di klien (cermin registry backend) lalu pratinjau
 * memakai renderer yang sama dengan layar murid — jadi yang dilihat guru persis
 * yang dilihat murid.
 */
import { useState } from 'react'
import Banner from '../../shared/ui/Banner.jsx'
import { Tombol, TombolIkon } from '../../shared/ui/Tombol.jsx'
import { IkonTambah, IkonTongSampah } from '../../icons.jsx'
import RendererSoal from './render/RendererSoal.jsx'
import {
  DAFTAR_TIPE,
  MAKS_GAMBAR,
  MAKS_HURUF,
  MAKS_ITEM_KLASIFIKASI,
  MAKS_KOTAK,
  MAKS_LUBANG,
  MAKS_MATEMATIKA,
  MAKS_OPSI,
  MAKS_OPSI_KOMPLEKS,
  MAKS_PERNYATAAN,
  MAKS_PETUNJUK,
  MAKS_RENTANG_GARIS,
  MAKS_SEL,
  MIN_GAMBAR,
  MIN_HURUF,
  MIN_ITEM,
  MIN_KOTAK,
  MIN_OPSI,
  MIN_OPSI_KOMPLEKS,
  MIN_PERNYATAAN,
  TIPE,
  TIPE_TANPA_TEKS,
  idBerikut,
  muatanDariState,
  nomorLubangDariTeks,
  pisahKata,
  stateDariSoal,
  stateSoalKosong,
} from './tipeSoal.js'
import { kelengkapanSoal, siapSoal, validasiSoal } from './validasi.js'

/**
 * Fieldset pasangan kiri–kanan untuk menjodohkan & hubung kata. Backend memakai
 * satu penangan yang sama (PenanganHubungKata extends PenanganMenjodohkan), jadi
 * editornya pun satu — hanya nama kunci pemetaannya yang berbeda.
 * @param {{
 *   state: import('./tipeSoal.js').StateSoal,
 *   ubah: (perubahan: Partial<import('./tipeSoal.js').StateSoal>) => void,
 *   namaPeta: 'pasangan'|'sambungan',
 *   judul: string,
 * }} props
 */
function FieldsetPasangan({ state, ubah, namaPeta, judul }) {
  const peta = state[namaPeta]

  /** @param {Record<string, string>} baru */
  function simpanPeta(baru) {
    ubah(namaPeta === 'sambungan' ? { sambungan: baru } : { pasangan: baru })
  }

  /** @param {number} index @param {string} teks */
  function ubahKiri(index, teks) {
    ubah({ kiri: state.kiri.map((satu, posisi) => (posisi === index ? { ...satu, teks } : satu)) })
  }

  /** @param {number} index */
  function hapusKiri(index) {
    if (state.kiri.length <= MIN_ITEM) return
    const dibuang = state.kiri[index]
    const baru = { ...peta }
    delete baru[dibuang.id]
    simpanPeta(baru)
    ubah({ kiri: state.kiri.filter((_, posisi) => posisi !== index) })
  }

  /** @param {number} index @param {string} teks */
  function ubahKanan(index, teks) {
    ubah({ kanan: state.kanan.map((satu, posisi) => (posisi === index ? { ...satu, teks } : satu)) })
  }

  /** @param {number} index */
  function hapusKanan(index) {
    if (state.kanan.length <= MIN_ITEM) return
    const dibuang = state.kanan[index]
    simpanPeta(Object.fromEntries(Object.entries(peta).filter(([, ke]) => ke !== dibuang.id)))
    ubah({ kanan: state.kanan.filter((_, posisi) => posisi !== index) })
  }

  return (
    <fieldset className="mt-2">
      <legend className="fw-bold fs-6">
        {judul} (minimal {MIN_ITEM})
      </legend>

      <div className="row g-3">
        <div className="col-md-6">
          <h3 className="fw-bold fs-6 teks-lembut">Kiri</h3>
          {state.kiri.map((satu, index) => (
            <div key={satu.id} className="d-flex flex-wrap align-items-center gap-2 mb-2">
              <span className="kotak-huruf" aria-hidden="true">{satu.id}</span>
              <input
                className="form-control flex-grow-1"
                aria-label={`Teks kiri ${satu.id}`}
                value={satu.teks}
                onChange={(e) => ubahKiri(index, e.target.value)}
                placeholder="Contoh: Paru-paru"
              />
              <select
                className="form-select jodoh-pilih"
                aria-label={`Pasangan kiri ${satu.id}`}
                value={peta[satu.id] ?? ''}
                onChange={(e) => simpanPeta({ ...peta, [satu.id]: e.target.value })}
              >
                <option value="">Pasangan…</option>
                {state.kanan.map((pasang) => (
                  <option key={pasang.id} value={pasang.id}>
                    {pasang.id} — {pasang.teks || '(belum diisi)'}
                  </option>
                ))}
              </select>
              <TombolIkon
                label={`Hapus item kiri ${satu.id}`}
                ikon={IkonTongSampah}
                varian="bahaya"
                disabled={state.kiri.length <= MIN_ITEM}
                onClick={() => hapusKiri(index)}
              />
            </div>
          ))}
          <Tombol
            varian="tepi"
            ukuran="sedang"
            ikon={IkonTambah}
            disabled={state.kiri.length >= MAKS_OPSI}
            onClick={() => ubah({ kiri: [...state.kiri, { id: idBerikut('K', state.kiri), teks: '' }] })}
          >
            Tambah kiri
          </Tombol>
        </div>

        <div className="col-md-6">
          <h3 className="fw-bold fs-6 teks-lembut">Kanan</h3>
          {state.kanan.map((satu, index) => (
            <div key={satu.id} className="d-flex align-items-center gap-2 mb-2">
              <span className="kotak-huruf" aria-hidden="true">{satu.id}</span>
              <input
                className="form-control"
                aria-label={`Teks kanan ${satu.id}`}
                value={satu.teks}
                onChange={(e) => ubahKanan(index, e.target.value)}
                placeholder="Contoh: Alat pernapasan"
              />
              <TombolIkon
                label={`Hapus item kanan ${satu.id}`}
                ikon={IkonTongSampah}
                varian="bahaya"
                disabled={state.kanan.length <= MIN_ITEM}
                onClick={() => hapusKanan(index)}
              />
            </div>
          ))}
          <Tombol
            varian="tepi"
            ukuran="sedang"
            ikon={IkonTambah}
            disabled={state.kanan.length >= MAKS_OPSI}
            onClick={() => ubah({ kanan: [...state.kanan, { id: idBerikut('N', state.kanan), teks: '' }] })}
          >
            Tambah kanan
          </Tombol>
        </div>
      </div>
    </fieldset>
  )
}

/**
 * @param {{
 *   soal: import('./api.js').DataSoal | null,
 *   daftarMapel: { id: number, nama: string }[],
 *   daftarTag: import('./api.js').DataTag[],
 *   sedangMenyimpan: boolean,
 *   onSimpan: (muatan: import('./tipeSoal.js').MuatanSoal) => void,
 *   onBatal: () => void,
 * }} props
 */
export default function EditorSoal({
  soal,
  daftarMapel,
  daftarTag,
  sedangMenyimpan,
  onSimpan,
  onBatal,
}) {
  // Panggung (parent) memberi `key` per soal, jadi state selalu mulai bersih
  // saat guru berpindah soal — tanpa perlu effect penyusun ulang.
  const [state, setState] = useState(() => (soal === null ? stateSoalKosong() : stateDariSoal(soal)))
  const [galat, setGalat] = useState(/** @type {string[]} */ ([]))

  /**
   * @param {Partial<import('./tipeSoal.js').StateSoal>} perubahan
   */
  function ubah(perubahan) {
    setState((lama) => ({ ...lama, ...perubahan }))
  }

  /** @param {number} index @param {string} teks */
  function ubahOpsi(index, teks) {
    ubah({ opsi: state.opsi.map((satu, posisi) => (posisi === index ? { ...satu, teks } : satu)) })
  }

  function tambahOpsi() {
    if (state.opsi.length >= MAKS_OPSI) return
    ubah({ opsi: [...state.opsi, { id: idBerikut('O', state.opsi), teks: '' }] })
  }

  /** @param {number} index */
  function hapusOpsi(index) {
    if (state.opsi.length <= MIN_OPSI) return
    const sisa = state.opsi.filter((_, posisi) => posisi !== index)
    const jawaban = sisa.some((satu) => satu.id === state.jawaban) ? state.jawaban : (sisa[0]?.id ?? '')
    ubah({ opsi: sisa, jawaban })
  }

  /**
   * Ubah satu baris jawaban baku isian (teks dan/atau sinonimnya).
   * @param {number} index
   * @param {Partial<import('./tipeSoal.js').BarisIsian>} perubahan
   */
  function ubahJawabanBaku(index, perubahan) {
    ubah({
      jawabanBaku: state.jawabanBaku.map((satu, posisi) =>
        posisi === index ? { ...satu, ...perubahan } : satu,
      ),
    })
  }

  function tambahJawabanBaku() {
    ubah({ jawabanBaku: [...state.jawabanBaku, { teks: '', sinonim: '' }] })
  }

  /** @param {number} index */
  function hapusJawabanBaku(index) {
    if (state.jawabanBaku.length <= 1) return
    ubah({ jawabanBaku: state.jawabanBaku.filter((_, posisi) => posisi !== index) })
  }

  /**
   * Ubah satu baris kata kunci uraian.
   * @param {number} index
   * @param {Partial<import('./tipeSoal.js').BarisKataKunci>} perubahan
   */
  function ubahKataKunci(index, perubahan) {
    ubah({
      kataKunci: state.kataKunci.map((satu, posisi) =>
        posisi === index ? { ...satu, ...perubahan } : satu,
      ),
    })
  }

  function tambahKataKunci() {
    ubah({ kataKunci: [...state.kataKunci, { teks: '', bobot: '' }] })
  }

  /** @param {number} index */
  function hapusKataKunci(index) {
    if (state.kataKunci.length <= 1) return
    ubah({ kataKunci: state.kataKunci.filter((_, posisi) => posisi !== index) })
  }

  /** @param {number} index @param {string} teks */
  function ubahKata(index, teks) {
    ubah({ kata: state.kata.map((satu, posisi) => (posisi === index ? { ...satu, teks } : satu)) })
  }

  /** @param {number} index */
  function hapusKata(index) {
    if (state.kata.length <= MIN_ITEM) return
    const dibuang = state.kata[index]
    const penempatan = { ...state.penempatan }
    delete penempatan[dibuang.id]
    ubah({ kata: state.kata.filter((_, posisi) => posisi !== index), penempatan })
  }

  /** @param {number} index @param {string} teks */
  function ubahPosisiKata(index, teks) {
    ubah({ posisi: state.posisi.map((satu, posisi) => (posisi === index ? { ...satu, teks } : satu)) })
  }

  /** @param {number} index */
  function hapusPosisiKata(index) {
    if (state.posisi.length <= MIN_ITEM) return
    const dibuang = state.posisi[index]
    const sisa = state.posisi.filter((_, posisi) => posisi !== index)
    const penempatan = Object.fromEntries(
      Object.entries(state.penempatan).filter(([, ke]) => ke !== dibuang.id),
    )
    ubah({ posisi: sisa, penempatan })
  }

  /** @param {number} index @param {string} teks */
  function ubahItem(index, teks) {
    ubah({
      item: state.item.map((satu, posisi) => (posisi === index ? { ...satu, teks } : satu)),
    })
  }

  /** @param {number} index @param {string} posisi */
  function ubahPosisi(index, posisi) {
    ubah({
      item: state.item.map((satu, nomor) => (nomor === index ? { ...satu, posisi } : satu)),
    })
  }

  /** @param {number} index */
  function hapusItem(index) {
    if (state.item.length <= MIN_ITEM) return
    ubah({ item: state.item.filter((_, posisi) => posisi !== index) })
  }

  /**
   * Benar/salah majemuk: daftar pernyataan + kunci tiap baris.
   * @param {number} index
   * @param {string} teks
   */
  function ubahPernyataan(index, teks) {
    ubah({
      pernyataan: state.pernyataan.map((satu, posisi) => (posisi === index ? { ...satu, teks } : satu)),
    })
  }

  function tambahPernyataan() {
    ubah({ pernyataan: [...state.pernyataan, { id: idBerikut('P', state.pernyataan), teks: '' }] })
  }

  /** @param {number} index */
  function hapusPernyataan(index) {
    if (state.pernyataan.length <= MIN_PERNYATAAN) return
    const hilang = state.pernyataan[index]?.id ?? ''
    const kunci = { ...state.kunciPernyataan }
    delete kunci[hilang]
    ubah({ pernyataan: state.pernyataan.filter((_, posisi) => posisi !== index), kunciPernyataan: kunci })
  }

  /** @param {number} index @param {string} media */
  function ubahOpsiGambar(index, media) {
    ubah({
      opsiGambar: state.opsiGambar.map((satu, posisi) => (posisi === index ? { ...satu, media } : satu)),
    })
  }

  function tambahOpsiGambar() {
    ubah({ opsiGambar: [...state.opsiGambar, { id: idBerikut('G', state.opsiGambar), media: '' }] })
  }

  /** @param {number} index */
  function hapusOpsiGambar(index) {
    if (state.opsiGambar.length <= MIN_GAMBAR) return
    const sisa = state.opsiGambar.filter((_, posisi) => posisi !== index)
    const idSisa = sisa.map((satu) => satu.id)
    ubah({
      opsiGambar: sisa,
      jawabanGambar: idSisa.includes(state.jawabanGambar) ? state.jawabanGambar : (idSisa[0] ?? ''),
    })
  }

  /**
   * Urut gambar: item bergambar + nomor urut benar.
   * @param {number} index
   * @param {string} media
   * @param {string} posisi
   */
  function ubahItemGambar(index, media, posisi) {
    ubah({
      itemGambar: state.itemGambar.map((satu, nomor) =>
        nomor === index ? { ...satu, media, posisi } : satu,
      ),
    })
  }

  function tambahItemGambar() {
    ubah({
      itemGambar: [
        ...state.itemGambar,
        {
          id: idBerikut('U', state.itemGambar),
          media: '',
          posisi: String(state.itemGambar.length + 1),
        },
      ],
    })
  }

  /** @param {number} index */
  function hapusItemGambar(index) {
    if (state.itemGambar.length <= MIN_GAMBAR) return
    ubah({ itemGambar: state.itemGambar.filter((_, posisi) => posisi !== index) })
  }

  /** @param {string} id @param {boolean} dicentang */
  function ubahKunciKompleks(id, dicentang) {
    ubah({
      benarKompleks: dicentang
        ? [...state.benarKompleks.filter((satu) => satu !== id), id]
        : state.benarKompleks.filter((satu) => satu !== id),
    })
  }

  /**
   * Isian rumpang: jawaban diterima per penanda `{{n}}` di isi soal.
   * @param {number} nomor @param {string} teks
   */
  function ubahLubang(nomor, teks) {
    ubah({ lubang: { ...state.lubang, [String(nomor)]: teks } })
  }

  function tambahLubang() {
    const nomor = nomorLubangDariTeks(state.teks)
    if (nomor.length >= MAKS_LUBANG) return

    const berikut = String(nomor.length + 1)
    const teks = state.teks.trim()
    ubah({
      teks: teks === '' ? `{{${berikut}}}` : `${teks} {{${berikut}}}`,
      lubang: { ...state.lubang, [berikut]: '' },
    })
  }

  /**
   * Klasifikasi: daftar item, daftar kotak, dan peta item → kotak.
   * @param {number} index @param {string} teks
   */
  function ubahItemKlasifikasi(index, teks) {
    ubah({
      itemKlasifikasi: state.itemKlasifikasi.map((satu, nomor) =>
        nomor === index ? { ...satu, teks } : satu,
      ),
    })
  }

  function tambahItemKlasifikasi() {
    ubah({
      itemKlasifikasi: [...state.itemKlasifikasi, { id: idBerikut('I', state.itemKlasifikasi), teks: '' }],
    })
  }

  /** @param {number} index */
  function hapusItemKlasifikasi(index) {
    if (state.itemKlasifikasi.length <= MIN_ITEM) return

    const dibuang = state.itemKlasifikasi[index]
    const peta = { ...state.petaKlasifikasi }
    delete peta[dibuang.id]
    ubah({
      itemKlasifikasi: state.itemKlasifikasi.filter((_, posisi) => posisi !== index),
      petaKlasifikasi: peta,
    })
  }

  /** @param {number} index @param {string} teks */
  function ubahKotak(index, teks) {
    ubah({ kotak: state.kotak.map((satu, nomor) => (nomor === index ? { ...satu, teks } : satu)) })
  }

  function tambahKotak() {
    ubah({ kotak: [...state.kotak, { id: idBerikut('K', state.kotak), teks: '' }] })
  }

  /** @param {number} index */
  function hapusKotak(index) {
    if (state.kotak.length <= MIN_KOTAK) return

    const dibuang = state.kotak[index]
    const peta = Object.fromEntries(
      Object.entries(state.petaKlasifikasi).filter(([, ke]) => ke !== dibuang.id),
    )
    ubah({ kotak: state.kotak.filter((_, posisi) => posisi !== index), petaKlasifikasi: peta })
  }

  /** Jumlah kolom tabel dari teks kolom yang dipisah koma. */
  function jumlahKolomTabel() {
    return pisahKata(state.kolom).length
  }

  /**
   * Ubah daftar nama kolom; kolom baru langsung disiapkan sebagai sel kosong di
   * tiap baris supaya guru tidak menambah sel satu per satu.
   * @param {string} teks
   */
  function ubahKolom(teks) {
    const jumlah = pisahKata(teks).length
    const perluTambah = jumlah > 0 && state.barisTabel.some((baris) => baris.sel.length < jumlah)

    if (!perluTambah) {
      ubah({ kolom: teks })
      return
    }

    const dipakai = new Set(state.barisTabel.flatMap((baris) => baris.sel.map((sel) => sel.kode)))
    const barisTabel = state.barisTabel.map((baris) => {
      const sel = [...baris.sel]

      for (let posisi = sel.length; posisi < jumlah; posisi += 1) {
        let nomor = 1
        while (dipakai.has(`r${nomor}c${posisi + 1}`)) nomor += 1
        const kode = `r${nomor}c${posisi + 1}`
        dipakai.add(kode)
        sel.push({ kode, teks: '' })
      }

      return { ...baris, sel }
    })

    ubah({ kolom: teks, barisTabel })
  }

  function tambahBarisTabel() {
    const jumlah = jumlahKolomTabel()
    const totalSel = state.barisTabel.reduce((jumlahSel, baris) => jumlahSel + baris.sel.length, 0)
    if (jumlah === 0 || totalSel + jumlah > MAKS_SEL) return

    const dipakai = new Set(state.barisTabel.flatMap((baris) => baris.sel.map((sel) => sel.kode)))
    let nomor = 1
    while ([...Array(jumlah)].some((_, kolom) => dipakai.has(`r${nomor}c${kolom + 1}`))) nomor += 1

    ubah({
      barisTabel: [
        ...state.barisTabel,
        {
          id: idBerikut('R', state.barisTabel),
          sel: [...Array(jumlah)].map((_, kolom) => ({ kode: `r${nomor}c${kolom + 1}`, teks: '' })),
        },
      ],
    })
  }

  /** @param {number} index */
  function hapusBarisTabel(index) {
    if (state.barisTabel.length <= 1) return

    const sisa = state.barisTabel.filter((_, posisi) => posisi !== index)
    const kode = new Set(sisa.flatMap((baris) => baris.sel.map((sel) => sel.kode)))
    const kunciSel = Object.fromEntries(
      Object.entries(state.kunciSel).filter(([kodeSel]) => kode.has(kodeSel)),
    )
    ubah({ barisTabel: sisa, kunciSel })
  }

  /**
   * Teks satu sel tabel; sel tanpa teks dinilai murid.
   * @param {number} baris @param {number} kolom @param {string} teks
   */
  function ubahSelTabel(baris, kolom, teks) {
    ubah({
      barisTabel: state.barisTabel.map((satu, nomor) =>
        nomor === baris
          ? { ...satu, sel: satu.sel.map((sel, posisi) => (posisi === kolom ? { ...sel, teks } : sel)) }
          : satu,
      ),
    })
  }

  /** @param {string} kode @param {string} teks */
  function ubahKunciSel(kode, teks) {
    ubah({ kunciSel: { ...state.kunciSel, [kode]: teks } })
  }

  const kelengkapan = kelengkapanSoal(state)
  const siap = siapSoal(kelengkapan)
  const muatan = muatanDariState(state)

  function kirim() {
    const temuan = validasiSoal(state)

    if (temuan.length > 0) {
      setGalat(temuan)
      return
    }

    setGalat([])
    onSimpan(muatan)
  }

  return (
    <div className="row g-4 align-items-start">
      <div className="col-lg-8">
        <div className="d-flex flex-column gap-4">
          <section className="kartu-soft p-4" aria-labelledby="soal-judul-1">
            <h2 id="soal-judul-1" className="judul-bagian">1. Pilih jenis soal</h2>
            <p className="teks-lembut small">
              Enam tipe objektif dinilai pasti oleh server; isian singkat dan uraian bisa perlu
              koreksi guru.
            </p>

            <div role="radiogroup" aria-label="Jenis soal" className="d-flex flex-wrap gap-2">
              {DAFTAR_TIPE.map((tipe) => {
                const aktif = state.tipe === tipe.nilai

                return (
                  <button
                    key={tipe.nilai}
                    type="button"
                    role="radio"
                    aria-checked={aktif}
                    className="pil-tipe"
                    onClick={() => ubah({ tipe: tipe.nilai })}
                  >
                    {tipe.label}
                    {tipe.objektif ? '' : ' · perlu tinjau'}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="kartu-soft p-4" aria-labelledby="soal-judul-2">
            <h2 id="soal-judul-2" className="judul-bagian">2. Tulis soalnya</h2>

            <div className="row g-3">
              <div className="col-sm-6">
                <div className="bidang">
                  <label className="form-label" htmlFor="soal-mapel">Mapel</label>
                  <select
                    id="soal-mapel"
                    className="form-select"
                    value={state.subject_id}
                    onChange={(e) => ubah({ subject_id: e.target.value })}
                  >
                    <option value="">Pilih mapel…</option>
                    {daftarMapel.map((mapel) => (
                      <option key={mapel.id} value={String(mapel.id)}>{mapel.nama}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="col-sm-6">
                <div className="bidang">
                  <label className="form-label" htmlFor="soal-tag">
                    Tema (tag) <span className="teks-lembut fw-normal">opsional</span>
                  </label>
                  <select
                    id="soal-tag"
                    className="form-select"
                    value={state.tag_id}
                    onChange={(e) => ubah({ tag_id: e.target.value })}
                  >
                    <option value="">Tanpa tag</option>
                    {daftarTag.map((tag) => (
                      <option key={tag.id} value={String(tag.id)}>{tag.nama}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {state.tipe !== TIPE.susunHuruf && (
              <div className="bidang mt-3">
                <label className="form-label" htmlFor="soal-teks">
                  Isi soal
                  {TIPE_TANPA_TEKS.includes(state.tipe) && (
                    <span className="teks-lembut fw-normal"> opsional</span>
                  )}
                </label>
                <textarea
                  id="soal-teks"
                  className="form-control"
                  rows={3}
                  value={state.teks}
                  onChange={(e) => ubah({ teks: e.target.value })}
                  placeholder="Tulis pertanyaan dengan kalimat pendek dan jelas"
                />
                <span className="teks-lembut small">
                  {state.teks.trim().length} huruf. Untuk murid SD, usahakan satu kalimat.
                </span>
              </div>
            )}

            {state.tipe === TIPE.pilihanGanda && (
              <fieldset className="mt-3">
                <legend className="fw-bold fs-6">
                  Pilihan jawaban dan kunci ({MIN_OPSI}–{MAKS_OPSI})
                </legend>

                {state.opsi.map((satu, index) => (
                  <div key={satu.id} className="d-flex flex-wrap align-items-center gap-2 mb-2">
                    <span className="kotak-huruf" aria-hidden="true">{satu.id}</span>
                    <input
                      className="form-control flex-grow-1"
                      aria-label={`Teks opsi ${satu.id}`}
                      value={satu.teks}
                      onChange={(e) => ubahOpsi(index, e.target.value)}
                      placeholder="Tulis pilihan"
                    />
                    <label className="label-kunci" htmlFor={`kunci-${satu.id}`}>
                      <input
                        className="form-check-input"
                        type="radio"
                        name="kunci-pilihan-ganda"
                        id={`kunci-${satu.id}`}
                        checked={state.jawaban === satu.id}
                        onChange={() => ubah({ jawaban: satu.id })}
                      />
                      Kunci
                    </label>
                    <TombolIkon
                      label={`Hapus pilihan ${satu.id}`}
                      ikon={IkonTongSampah}
                      varian="bahaya"
                      disabled={state.opsi.length <= MIN_OPSI}
                      onClick={() => hapusOpsi(index)}
                    />
                  </div>
                ))}

                <Tombol
                  varian="tepi"
                  ukuran="sedang"
                  ikon={IkonTambah}
                  disabled={state.opsi.length >= MAKS_OPSI}
                  onClick={tambahOpsi}
                >
                  Tambah pilihan
                </Tombol>
              </fieldset>
            )}

            {state.tipe === TIPE.benarSalah && (
              <fieldset className="mt-3">
                <legend className="fw-bold fs-6">Pernyataan ini …</legend>
                <div role="radiogroup" aria-label="Kunci benar atau salah" className="d-flex flex-wrap gap-2">
                  {[
                    { nilai: true, label: 'Benar' },
                    { nilai: false, label: 'Salah' },
                  ].map((pilihan) => (
                    <button
                      key={pilihan.label}
                      type="button"
                      role="radio"
                      aria-checked={state.benar === pilihan.nilai}
                      className="pil-tipe"
                      onClick={() => ubah({ benar: pilihan.nilai })}
                    >
                      {pilihan.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {state.tipe === TIPE.menjodohkan && (
              <FieldsetPasangan
                state={state}
                ubah={ubah}
                namaPeta="pasangan"
                judul="Pasangan menjodohkan"
              />
            )}

            {state.tipe === TIPE.hubungKata && (
              <FieldsetPasangan
                state={state}
                ubah={ubah}
                namaPeta="sambungan"
                judul="Sambungan hubung kata"
              />
            )}

            {state.tipe === TIPE.letakKata && (
              <fieldset className="mt-3">
                <legend className="fw-bold fs-6">Kata + posisi (minimal {MIN_ITEM})</legend>
                <p className="teks-lembut small">
                  Setiap kata wajib punya satu posisi. Penilaian otomatis: seluruh kata harus tepat.
                </p>

                <div className="row g-3">
                  <div className="col-md-7">
                    <h3 className="fw-bold fs-6 teks-lembut">Kata</h3>
                    {state.kata.map((satu, index) => (
                      <div key={satu.id} className="d-flex flex-wrap align-items-center gap-2 mb-2">
                        <span className="kotak-huruf" aria-hidden="true">{satu.id}</span>
                        <input
                          className="form-control flex-grow-1"
                          aria-label={`Teks kata ${satu.id}`}
                          value={satu.teks}
                          onChange={(e) => ubahKata(index, e.target.value)}
                        />
                        <select
                          className="form-select jodoh-pilih"
                          aria-label={`Posisi kata ${satu.id}`}
                          value={state.penempatan[satu.id] ?? ''}
                          onChange={(e) =>
                            ubah({ penempatan: { ...state.penempatan, [satu.id]: e.target.value } })
                          }
                        >
                          <option value="">Posisi…</option>
                          {state.posisi.map((pasang) => (
                            <option key={pasang.id} value={pasang.id}>
                              {pasang.id} — {pasang.teks || '(belum diisi)'}
                            </option>
                          ))}
                        </select>
                        <TombolIkon
                          label={`Hapus kata ${satu.id}`}
                          ikon={IkonTongSampah}
                          varian="bahaya"
                          disabled={state.kata.length <= MIN_ITEM}
                          onClick={() => hapusKata(index)}
                        />
                      </div>
                    ))}
                    <Tombol
                      varian="tepi"
                      ukuran="sedang"
                      ikon={IkonTambah}
                      disabled={state.kata.length >= MAKS_OPSI}
                      onClick={() => ubah({ kata: [...state.kata, { id: idBerikut('W', state.kata), teks: '' }] })}
                    >
                      Tambah kata
                    </Tombol>
                  </div>

                  <div className="col-md-5">
                    <h3 className="fw-bold fs-6 teks-lembut">Posisi</h3>
                    {state.posisi.map((satu, index) => (
                      <div key={satu.id} className="d-flex align-items-center gap-2 mb-2">
                        <span className="kotak-huruf" aria-hidden="true">{satu.id}</span>
                        <input
                          className="form-control"
                          aria-label={`Teks posisi ${satu.id}`}
                          value={satu.teks}
                          onChange={(e) => ubahPosisiKata(index, e.target.value)}
                        />
                        <TombolIkon
                          label={`Hapus posisi ${satu.id}`}
                          ikon={IkonTongSampah}
                          varian="bahaya"
                          disabled={state.posisi.length <= MIN_ITEM}
                          onClick={() => hapusPosisiKata(index)}
                        />
                      </div>
                    ))}
                    <Tombol
                      varian="tepi"
                      ukuran="sedang"
                      ikon={IkonTambah}
                      disabled={state.posisi.length >= MAKS_OPSI}
                      onClick={() =>
                        ubah({ posisi: [...state.posisi, { id: idBerikut('P', state.posisi), teks: '' }] })
                      }
                    >
                      Tambah posisi
                    </Tombol>
                  </div>
                </div>
              </fieldset>
            )}

            {state.tipe === TIPE.isianSingkat && (
              <fieldset className="mt-3">
                <legend className="fw-bold fs-6">Jawaban baku dan sinonim</legend>
                <p className="teks-lembut small">
                  Jawaban murid dinilai mirip, jadi salah ketik ringan masih dimaafkan. Pisahkan
                  sinonim dengan koma.
                </p>

                {state.jawabanBaku.map((satu, index) => (
                  <div key={index} className="row g-2 align-items-center mb-2">
                    <div className="col-md-5">
                      <input
                        className="form-control"
                        aria-label={`Jawaban baku ${index + 1}`}
                        value={satu.teks}
                        onChange={(e) => ubahJawabanBaku(index, { teks: e.target.value })}
                        placeholder="Jawaban baku, mis. rambut hidung"
                      />
                    </div>
                    <div className="col-md-5">
                      <input
                        className="form-control"
                        aria-label={`Sinonim jawaban ${index + 1}`}
                        value={satu.sinonim}
                        onChange={(e) => ubahJawabanBaku(index, { sinonim: e.target.value })}
                        placeholder="Sinonim: rambut getar, silia"
                      />
                    </div>
                    <div className="col-md-2">
                      <TombolIkon
                        label={`Hapus jawaban baku ${index + 1}`}
                        ikon={IkonTongSampah}
                        varian="bahaya"
                        disabled={state.jawabanBaku.length <= 1}
                        onClick={() => hapusJawabanBaku(index)}
                      />
                    </div>
                  </div>
                ))}

                <div className="d-flex flex-wrap gap-2">
                  <Tombol varian="tepi" ukuran="sedang" ikon={IkonTambah} onClick={tambahJawabanBaku}>
                    Tambah jawaban
                  </Tombol>
                </div>

                <div className="d-flex flex-wrap align-items-center gap-3 mt-3">
                  <label className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="soal-angka-persis"
                      checked={state.angkaPersis}
                      onChange={(e) => ubah({ angkaPersis: e.target.checked })}
                    />
                    <span className="form-check-label">
                      Angka harus persis (12 dianggap beda dari 12,5)
                    </span>
                  </label>

                  <div className="d-flex align-items-center gap-2">
                    <label className="form-label fw-bold mb-0" htmlFor="soal-ambang-isian">
                      Kemiripan minimal
                    </label>
                    <input
                      id="soal-ambang-isian"
                      className="form-control w-auto"
                      type="number"
                      step="0.05"
                      min="0.1"
                      max="1"
                      value={state.ambang}
                      onChange={(e) => ubah({ ambang: e.target.value })}
                    />
                  </div>
                </div>

                <div className="bidang mt-3">
                  <label className="form-label" htmlFor="soal-negasi">
                    Kata negasi yang membatalkan jawaban <span className="teks-lembut fw-normal">opsional, pisah koma</span>
                  </label>
                  <input
                    id="soal-negasi"
                    className="form-control"
                    value={state.negasi}
                    onChange={(e) => ubah({ negasi: e.target.value })}
                    placeholder="bukan, tidak"
                  />
                </div>
              </fieldset>
            )}

            {state.tipe === TIPE.uraian && (
              <fieldset className="mt-3">
                <legend className="fw-bold fs-6">Kata kunci penilaian</legend>
                <p className="teks-lembut small">
                  Jawaban uraian dinilai dari kata kunci yang muncul. Bila belum yakin, soal masuk
                  antrean koreksi guru.
                </p>

                {state.kataKunci.map((satu, index) => (
                  <div key={index} className="row g-2 align-items-center mb-2">
                    <div className="col-md-7">
                      <input
                        className="form-control"
                        aria-label={`Kata kunci ${index + 1}`}
                        value={satu.teks}
                        onChange={(e) => ubahKataKunci(index, { teks: e.target.value })}
                        placeholder="mis. fotosintesis"
                      />
                    </div>
                    <div className="col-md-3">
                      <input
                        className="form-control"
                        type="number"
                        step="0.5"
                        min="0.5"
                        aria-label={`Bobot kata kunci ${index + 1}`}
                        value={satu.bobot}
                        onChange={(e) => ubahKataKunci(index, { bobot: e.target.value })}
                        placeholder="Bobot (opsional)"
                      />
                    </div>
                    <div className="col-md-2">
                      <TombolIkon
                        label={`Hapus kata kunci ${index + 1}`}
                        ikon={IkonTongSampah}
                        varian="bahaya"
                        disabled={state.kataKunci.length <= 1}
                        onClick={() => hapusKataKunci(index)}
                      />
                    </div>
                  </div>
                ))}

                <Tombol varian="tepi" ukuran="sedang" ikon={IkonTambah} onClick={tambahKataKunci}>
                  Tambah kata kunci
                </Tombol>

                <div className="row g-3 mt-3">
                  <div className="col-md-4">
                    <div className="bidang">
                      <label className="form-label" htmlFor="soal-ambang-uraian">Ambang lulus</label>
                      <input
                        id="soal-ambang-uraian"
                        className="form-control"
                        type="number"
                        step="0.05"
                        min="0.1"
                        max="1"
                        value={state.ambangLulus}
                        onChange={(e) => ubah({ ambangLulus: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="col-md-8">
                    <div className="bidang">
                      <label className="form-label" htmlFor="soal-sinonim-uraian">
                        Sinonim kata kunci <span className="teks-lembut fw-normal">tiap baris: kata = alias, alias</span>
                      </label>
                      <textarea
                        id="soal-sinonim-uraian"
                        className="form-control"
                        rows={2}
                        value={state.sinonimUraian}
                        onChange={(e) => ubah({ sinonimUraian: e.target.value })}
                        placeholder="fotosintesis = asimilasi"
                      />
                    </div>
                  </div>
                </div>
              </fieldset>
            )}

            {state.tipe === TIPE.mengurutkan && (
              <fieldset className="mt-3">
                <legend className="fw-bold fs-6">Item + nomor urut benar (minimal {MIN_ITEM})</legend>

                {state.item.map((satu, index) => (
                  <div key={satu.id} className="d-flex flex-wrap align-items-center gap-2 mb-2">
                    <input
                      className="form-control form-control-sm urut-posisi"
                      type="number"
                      min={1}
                      max={state.item.length}
                      aria-label={`Nomor urut item ${satu.id}`}
                      value={satu.posisi}
                      onChange={(e) => ubahPosisi(index, e.target.value)}
                    />
                    <input
                      className="form-control flex-grow-1"
                      aria-label={`Teks item ${satu.id}`}
                      value={satu.teks}
                      onChange={(e) => ubahItem(index, e.target.value)}
                    />
                    <TombolIkon
                      label={`Hapus item ${satu.id}`}
                      ikon={IkonTongSampah}
                      varian="bahaya"
                      disabled={state.item.length <= MIN_ITEM}
                      onClick={() => hapusItem(index)}
                    />
                  </div>
                ))}

                <Tombol
                  varian="tepi"
                  ukuran="sedang"
                  ikon={IkonTambah}
                  disabled={state.item.length >= MAKS_OPSI}
                  onClick={() =>
                    ubah({
                      item: [
                        ...state.item,
                        { id: idBerikut('I', state.item), teks: '', posisi: String(state.item.length + 1) },
                      ],
                    })
                  }
                >
                  Tambah item
                </Tombol>
              </fieldset>
            )}

            {state.tipe === TIPE.pilihanGandaKompleks && (
              <fieldset className="mt-3">
                <legend className="fw-bold fs-6">
                  Pilihan jawaban dan kunci ({MIN_OPSI_KOMPLEKS}–{MAKS_OPSI_KOMPLEKS})
                </legend>
                <p className="teks-lembut small">
                  Tandai SEMUA pilihan yang benar (boleh lebih dari satu). Sisakan minimal satu
                  pilihan yang bukan kunci.
                </p>

                {state.opsi.map((satu, index) => (
                  <div key={satu.id} className="d-flex flex-wrap align-items-center gap-2 mb-2">
                    <span className="kotak-huruf" aria-hidden="true">{satu.id}</span>
                    <input
                      className="form-control flex-grow-1"
                      aria-label={`Teks opsi ${satu.id}`}
                      value={satu.teks}
                      onChange={(e) => ubahOpsi(index, e.target.value)}
                      placeholder="Tulis pilihan"
                    />
                    <label className="label-kunci" htmlFor={`kunci-kompleks-${satu.id}`}>
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`kunci-kompleks-${satu.id}`}
                        checked={state.benarKompleks.includes(satu.id)}
                        onChange={(e) => ubahKunciKompleks(satu.id, e.target.checked)}
                      />
                      Kunci
                    </label>
                    <TombolIkon
                      label={`Hapus pilihan ${satu.id}`}
                      ikon={IkonTongSampah}
                      varian="bahaya"
                      disabled={state.opsi.length <= MIN_OPSI_KOMPLEKS}
                      onClick={() => hapusOpsi(index)}
                    />
                  </div>
                ))}

                <Tombol
                  varian="tepi"
                  ukuran="sedang"
                  ikon={IkonTambah}
                  disabled={state.opsi.length >= MAKS_OPSI_KOMPLEKS}
                  onClick={tambahOpsi}
                >
                  Tambah pilihan
                </Tombol>
              </fieldset>
            )}

            {state.tipe === TIPE.benarSalahMajemuk && (
              <fieldset className="mt-3">
                <legend className="fw-bold fs-6">
                  Pernyataan dan kunci ({MIN_PERNYATAAN}–{MAKS_PERNYATAAN})
                </legend>

                {state.pernyataan.map((satu, index) => (
                  <div key={satu.id} className="d-flex flex-wrap align-items-center gap-2 mb-2">
                    <span className="kotak-huruf" aria-hidden="true">{satu.id}</span>
                    <input
                      className="form-control flex-grow-1"
                      aria-label={`Teks pernyataan ${satu.id}`}
                      value={satu.teks}
                      onChange={(e) => ubahPernyataan(index, e.target.value)}
                      placeholder="Tulis pernyataan"
                    />
                    <div role="radiogroup" aria-label={`Kunci ${satu.id}`} className="d-flex gap-2">
                      {[
                        { nilai: true, label: 'Benar' },
                        { nilai: false, label: 'Salah' },
                      ].map((pilihan) => (
                        <button
                          key={pilihan.label}
                          type="button"
                          role="radio"
                          aria-checked={state.kunciPernyataan[satu.id] === pilihan.nilai}
                          className="pil-tipe"
                          onClick={() =>
                            ubah({ kunciPernyataan: { ...state.kunciPernyataan, [satu.id]: pilihan.nilai } })
                          }
                        >
                          {pilihan.label}
                        </button>
                      ))}
                    </div>
                    <TombolIkon
                      label={`Hapus pernyataan ${satu.id}`}
                      ikon={IkonTongSampah}
                      varian="bahaya"
                      disabled={state.pernyataan.length <= MIN_PERNYATAAN}
                      onClick={() => hapusPernyataan(index)}
                    />
                  </div>
                ))}

                <Tombol
                  varian="tepi"
                  ukuran="sedang"
                  ikon={IkonTambah}
                  disabled={state.pernyataan.length >= MAKS_PERNYATAAN}
                  onClick={tambahPernyataan}
                >
                  Tambah pernyataan
                </Tombol>
              </fieldset>
            )}

            {state.tipe === TIPE.isianAngka && (
              <fieldset className="mt-3">
                <legend className="fw-bold fs-6">Kunci angka dan toleransi</legend>
                <div className="row g-3">
                  <div className="col-sm-4">
                    <div className="bidang">
                      <label className="form-label" htmlFor="angka-satuan">Satuan (opsional)</label>
                      <input
                        id="angka-satuan"
                        className="form-control"
                        value={state.satuan}
                        onChange={(e) => ubah({ satuan: e.target.value })}
                        placeholder="cm"
                      />
                    </div>
                  </div>
                  <div className="col-sm-4">
                    <div className="bidang">
                      <label className="form-label" htmlFor="angka-nilai">Jawaban benar</label>
                      <input
                        id="angka-nilai"
                        className="form-control"
                        type="number"
                        step="any"
                        value={state.angkaNilai}
                        onChange={(e) => ubah({ angkaNilai: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="col-sm-4">
                    <div className="bidang">
                      <label className="form-label" htmlFor="angka-toleransi">Toleransi (≥ 0)</label>
                      <input
                        id="angka-toleransi"
                        className="form-control"
                        type="number"
                        min={0}
                        step="any"
                        value={state.angkaToleransi}
                        onChange={(e) => ubah({ angkaToleransi: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </fieldset>
            )}

            {state.tipe === TIPE.pilihanGambar && (
              <fieldset className="mt-3">
                <legend className="fw-bold fs-6">
                  Gambar pilihan dan kunci ({MIN_GAMBAR}–{MAKS_GAMBAR})
                </legend>

                {state.opsiGambar.map((satu, index) => (
                  <div key={satu.id} className="d-flex flex-wrap align-items-center gap-2 mb-2">
                    <span className="kotak-huruf" aria-hidden="true">{satu.id}</span>
                    <input
                      className="form-control flex-grow-1"
                      aria-label={`Alamat gambar ${satu.id}`}
                      value={satu.media}
                      onChange={(e) => ubahOpsiGambar(index, e.target.value)}
                      placeholder="/media/gambar.png"
                    />
                    <label className="label-kunci" htmlFor={`kunci-gambar-${satu.id}`}>
                      <input
                        className="form-check-input"
                        type="radio"
                        name="kunci-pilihan-gambar"
                        id={`kunci-gambar-${satu.id}`}
                        checked={state.jawabanGambar === satu.id}
                        onChange={() => ubah({ jawabanGambar: satu.id })}
                      />
                      Kunci
                    </label>
                    <TombolIkon
                      label={`Hapus gambar ${satu.id}`}
                      ikon={IkonTongSampah}
                      varian="bahaya"
                      disabled={state.opsiGambar.length <= MIN_GAMBAR}
                      onClick={() => hapusOpsiGambar(index)}
                    />
                  </div>
                ))}

                <Tombol
                  varian="tepi"
                  ukuran="sedang"
                  ikon={IkonTambah}
                  disabled={state.opsiGambar.length >= MAKS_GAMBAR}
                  onClick={tambahOpsiGambar}
                >
                  Tambah gambar
                </Tombol>
              </fieldset>
            )}

            {state.tipe === TIPE.urutGambar && (
              <fieldset className="mt-3">
                <legend className="fw-bold fs-6">
                  Gambar + nomor urut benar ({MIN_GAMBAR}–{MAKS_GAMBAR})
                </legend>

                {state.itemGambar.map((satu, index) => (
                  <div key={satu.id} className="d-flex flex-wrap align-items-center gap-2 mb-2">
                    <input
                      className="form-control form-control-sm urut-posisi"
                      type="number"
                      min={1}
                      max={state.itemGambar.length}
                      aria-label={`Nomor urut gambar ${satu.id}`}
                      value={satu.posisi}
                      onChange={(e) => ubahItemGambar(index, satu.media, e.target.value)}
                    />
                    <input
                      className="form-control flex-grow-1"
                      aria-label={`Alamat gambar ${satu.id}`}
                      value={satu.media}
                      onChange={(e) => ubahItemGambar(index, e.target.value, satu.posisi)}
                      placeholder="/media/gambar.png"
                    />
                    <TombolIkon
                      label={`Hapus gambar ${satu.id}`}
                      ikon={IkonTongSampah}
                      varian="bahaya"
                      disabled={state.itemGambar.length <= MIN_GAMBAR}
                      onClick={() => hapusItemGambar(index)}
                    />
                  </div>
                ))}

                <Tombol
                  varian="tepi"
                  ukuran="sedang"
                  ikon={IkonTambah}
                  disabled={state.itemGambar.length >= MAKS_GAMBAR}
                  onClick={tambahItemGambar}
                >
                  Tambah gambar
                </Tombol>
              </fieldset>
            )}

            {state.tipe === TIPE.susunHuruf && (
              <fieldset className="mt-3">
                <legend className="fw-bold fs-6">Petunjuk dan kata</legend>
                <div className="bidang">
                  <label className="form-label" htmlFor="susun-petunjuk">Petunjuk</label>
                  <input
                    id="susun-petunjuk"
                    className="form-control"
                    maxLength={MAKS_PETUNJUK}
                    value={state.petunjuk}
                    onChange={(e) => ubah({ petunjuk: e.target.value })}
                    placeholder="Nama hewan berkaki empat yang mengeong"
                  />
                </div>
                <div className="bidang mt-3">
                  <label className="form-label" htmlFor="susun-kata">
                    Kata ({MIN_HURUF}–{MAKS_HURUF} huruf, tanpa spasi)
                  </label>
                  <input
                    id="susun-kata"
                    className="form-control"
                    maxLength={MAKS_HURUF}
                    value={state.kataSusun}
                    onChange={(e) => ubah({ kataSusun: e.target.value })}
                    placeholder="kucing"
                  />
                  <span className="teks-lembut small">
                    Huruf akan diacak server; murid menyusunnya kembali menjadi kata ini.
                  </span>
                </div>
              </fieldset>
            )}

            {state.tipe === TIPE.isianRumpang && (
              <fieldset className="mt-3">
                <legend className="fw-bold fs-6">
                  Lubang dan jawaban diterima (maksimal {MAKS_LUBANG})
                </legend>
                <p className="teks-lembut small">
                  Tulis penanda {'{{1}}'}, {'{{2}}'}, … di isi soal, lalu isi jawaban yang diterima
                  untuk tiap lubang. Beberapa jawaban dipisah koma.
                </p>

                {nomorLubangDariTeks(state.teks).map((nomor) => (
                  <div key={nomor} className="d-flex flex-wrap align-items-center gap-2 mb-2">
                    <span className="kotak-huruf" aria-hidden="true">{`{{${nomor}}}`}</span>
                    <input
                      className="form-control flex-grow-1"
                      aria-label={`Jawaban diterima lubang ${nomor}`}
                      value={state.lubang[String(nomor)] ?? ''}
                      onChange={(e) => ubahLubang(nomor, e.target.value)}
                      placeholder="Jakarta, DKI Jakarta"
                    />
                  </div>
                ))}

                <Tombol
                  varian="tepi"
                  ukuran="sedang"
                  ikon={IkonTambah}
                  disabled={nomorLubangDariTeks(state.teks).length >= MAKS_LUBANG}
                  onClick={tambahLubang}
                >
                  Tambah lubang
                </Tombol>
              </fieldset>
            )}

            {state.tipe === TIPE.klasifikasi && (
              <>
                <fieldset className="mt-3">
                  <legend className="fw-bold fs-6">
                    Item dan kotaknya ({MIN_ITEM}–{MAKS_ITEM_KLASIFIKASI} item)
                  </legend>

                  {state.itemKlasifikasi.map((satu, index) => (
                    <div key={satu.id} className="d-flex flex-wrap align-items-center gap-2 mb-2">
                      <span className="kotak-huruf" aria-hidden="true">{satu.id}</span>
                      <input
                        className="form-control flex-grow-1"
                        aria-label={`Teks item ${satu.id}`}
                        value={satu.teks}
                        onChange={(e) => ubahItemKlasifikasi(index, e.target.value)}
                        placeholder="Contoh: kucing"
                      />
                      <select
                        className="form-select jodoh-pilih"
                        aria-label={`Kotak untuk item ${satu.id}`}
                        value={state.petaKlasifikasi[satu.id] ?? ''}
                        onChange={(e) =>
                          ubah({
                            petaKlasifikasi: { ...state.petaKlasifikasi, [satu.id]: e.target.value },
                          })
                        }
                      >
                        <option value="">Kotak…</option>
                        {state.kotak.map((kotak) => (
                          <option key={kotak.id} value={kotak.id}>
                            {kotak.id} — {kotak.teks || '(belum diisi)'}
                          </option>
                        ))}
                      </select>
                      <TombolIkon
                        label={`Hapus item ${satu.id}`}
                        ikon={IkonTongSampah}
                        varian="bahaya"
                        disabled={state.itemKlasifikasi.length <= MIN_ITEM}
                        onClick={() => hapusItemKlasifikasi(index)}
                      />
                    </div>
                  ))}

                  <Tombol
                    varian="tepi"
                    ukuran="sedang"
                    ikon={IkonTambah}
                    disabled={state.itemKlasifikasi.length >= MAKS_ITEM_KLASIFIKASI}
                    onClick={tambahItemKlasifikasi}
                  >
                    Tambah item
                  </Tombol>
                </fieldset>

                <fieldset className="mt-3">
                  <legend className="fw-bold fs-6">
                    Kotak / kategori ({MIN_KOTAK}–{MAKS_KOTAK})
                  </legend>

                  {state.kotak.map((satu, index) => (
                    <div key={satu.id} className="d-flex flex-wrap align-items-center gap-2 mb-2">
                      <span className="kotak-huruf" aria-hidden="true">{satu.id}</span>
                      <input
                        className="form-control flex-grow-1"
                        aria-label={`Label kotak ${satu.id}`}
                        value={satu.teks}
                        onChange={(e) => ubahKotak(index, e.target.value)}
                        placeholder="Contoh: Mamalia"
                      />
                      <TombolIkon
                        label={`Hapus kotak ${satu.id}`}
                        ikon={IkonTongSampah}
                        varian="bahaya"
                        disabled={state.kotak.length <= MIN_KOTAK}
                        onClick={() => hapusKotak(index)}
                      />
                    </div>
                  ))}

                  <Tombol
                    varian="tepi"
                    ukuran="sedang"
                    ikon={IkonTambah}
                    disabled={state.kotak.length >= MAKS_KOTAK}
                    onClick={tambahKotak}
                  >
                    Tambah kotak
                  </Tombol>
                </fieldset>
              </>
            )}

            {state.tipe === TIPE.tabelIsian && (
              <fieldset className="mt-3">
                <legend className="fw-bold fs-6">
                  Kolom, baris, dan jawaban sel (maksimal {MAKS_SEL} sel)
                </legend>

                <div className="bidang">
                  <label className="form-label" htmlFor="tabel-kolom">
                    Nama kolom (pisahkan dengan koma)
                  </label>
                  <input
                    id="tabel-kolom"
                    className="form-control"
                    value={state.kolom}
                    onChange={(e) => ubahKolom(e.target.value)}
                    placeholder="Soal, Hasil"
                  />
                </div>

                {jumlahKolomTabel() === 0 ? (
                  <p className="teks-lembut small mt-2">
                    Isi nama kolom dulu supaya sel tabel muncul.
                  </p>
                ) : (
                  <p className="teks-lembut small mt-2">
                    Sel yang dibiarkan kosong akan diisi murid; isi jawaban diterimanya (beberapa
                    jawaban dipisah koma).
                  </p>
                )}

                {state.barisTabel.map((baris, index) => (
                  <div key={baris.id} className="kartu-soft p-3 mt-3">
                    <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                      <span className="badge-status info">Baris {index + 1}</span>
                      <TombolIkon
                        label={`Hapus baris ${index + 1}`}
                        ikon={IkonTongSampah}
                        varian="bahaya"
                        disabled={state.barisTabel.length <= 1}
                        onClick={() => hapusBarisTabel(index)}
                      />
                    </div>

                    <div className="row g-2">
                      {baris.sel.map((sel, kolom) => (
                        <div key={sel.kode} className="col-md-6">
                          <div className="bidang">
                            <label className="form-label" htmlFor={`tabel-${sel.kode}`}>
                              {pisahKata(state.kolom)[kolom] ?? `Kolom ${kolom + 1}`}
                            </label>
                            <input
                              id={`tabel-${sel.kode}`}
                              className="form-control"
                              value={sel.teks}
                              onChange={(e) => ubahSelTabel(index, kolom, e.target.value)}
                              placeholder="Teks tabel (kosongkan agar murid mengisi)"
                            />
                            {sel.teks.trim() === '' && (
                              <input
                                className="form-control mt-2"
                                aria-label={`Jawaban diterima sel ${sel.kode}`}
                                value={state.kunciSel[sel.kode] ?? ''}
                                onChange={(e) => ubahKunciSel(sel.kode, e.target.value)}
                                placeholder="Jawaban diterima (pisah koma)"
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <Tombol
                  varian="tepi"
                  ukuran="sedang"
                  ikon={IkonTambah}
                  disabled={
                    jumlahKolomTabel() === 0 ||
                    state.barisTabel.reduce((jumlah, baris) => jumlah + baris.sel.length, 0) +
                      jumlahKolomTabel() >
                      MAKS_SEL
                  }
                  onClick={tambahBarisTabel}
                >
                  Tambah baris
                </Tombol>
              </fieldset>
            )}

            {state.tipe === TIPE.garisBilangan && (
              <fieldset className="mt-3">
                <legend className="fw-bold fs-6">
                  Rentang garis dan kunci nilai (rentang maksimal {MAKS_RENTANG_GARIS})
                </legend>

                <div className="row g-3">
                  <div className="col-sm-4">
                    <div className="bidang">
                      <label className="form-label" htmlFor="garis-min">Angka terkecil</label>
                      <input
                        id="garis-min"
                        className="form-control"
                        type="number"
                        step="any"
                        value={state.garisMin}
                        onChange={(e) => ubah({ garisMin: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="col-sm-4">
                    <div className="bidang">
                      <label className="form-label" htmlFor="garis-max">Angka terbesar</label>
                      <input
                        id="garis-max"
                        className="form-control"
                        type="number"
                        step="any"
                        value={state.garisMax}
                        onChange={(e) => ubah({ garisMax: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="col-sm-4">
                    <div className="bidang">
                      <label className="form-label" htmlFor="garis-langkah">Langkah tanda</label>
                      <input
                        id="garis-langkah"
                        className="form-control"
                        type="number"
                        step="any"
                        value={state.garisLangkah}
                        onChange={(e) => ubah({ garisLangkah: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="col-sm-6">
                    <div className="bidang">
                      <label className="form-label" htmlFor="garis-nilai">Jawaban benar</label>
                      <input
                        id="garis-nilai"
                        className="form-control"
                        type="number"
                        step="any"
                        value={state.garisNilai}
                        onChange={(e) => ubah({ garisNilai: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="col-sm-6">
                    <div className="bidang">
                      <label className="form-label" htmlFor="garis-toleransi">Toleransi (≥ 0)</label>
                      <input
                        id="garis-toleransi"
                        className="form-control"
                        type="number"
                        min={0}
                        step="any"
                        value={state.garisToleransi}
                        onChange={(e) => ubah({ garisToleransi: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </fieldset>
            )}
          </section>

          <section className="kartu-soft p-4" aria-labelledby="soal-judul-3">
            <h2 id="soal-judul-3" className="judul-bagian">3. Pengaturan soal</h2>

            <div className="row g-3 align-items-end">
              <div className="col-sm-4">
                <div className="bidang">
                  <label className="form-label" htmlFor="soal-skor">Skor</label>
                  <input
                    id="soal-skor"
                    className="form-control"
                    type="number"
                    min={1}
                    max={100}
                    value={state.skor}
                    onChange={(e) => ubah({ skor: e.target.value })}
                  />
                </div>
              </div>

              <div className="col-sm-8">
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="soal-aktif"
                    checked={state.aktif}
                    onChange={(e) => ubah({ aktif: e.target.checked })}
                  />
                  <label className="form-check-label" htmlFor="soal-aktif">
                    Soal aktif (soal nonaktif tidak bisa diterbitkan di dalam kuis)
                  </label>
                </div>
              </div>
            </div>

            <div className="bidang mt-3">
              <label className="form-label" htmlFor="soal-pembahasan">
                Pembahasan <span className="teks-lembut fw-normal">opsional, tampil setelah murid selesai</span>
              </label>
              <textarea
                id="soal-pembahasan"
                className="form-control"
                rows={2}
                maxLength={500}
                value={state.pembahasan}
                onChange={(e) => ubah({ pembahasan: e.target.value })}
                placeholder="Jelaskan jawabannya dengan bahasa sederhana"
              />
            </div>

            <details className="mt-3">
              <summary className="fw-bold">Media &amp; MathML (opsional)</summary>
              <div className="row g-3 mt-2">
                <div className="col-md-6">
                  <div className="bidang">
                    <label className="form-label" htmlFor="soal-media">Alamat media</label>
                    <input
                      id="soal-media"
                      className="form-control"
                      value={state.media}
                      onChange={(e) => ubah({ media: e.target.value })}
                      placeholder="/media/gambar-soal.png"
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="bidang">
                    <label className="form-label" htmlFor="soal-matematika">
                      MathML (maksimal {MAKS_MATEMATIKA} karakter)
                    </label>
                    <textarea
                      id="soal-matematika"
                      className="form-control"
                      rows={3}
                      value={state.matematika}
                      onChange={(e) => ubah({ matematika: e.target.value })}
                      placeholder="<math><mfrac><mn>1</mn><mn>2</mn></mfrac></math>"
                    />
                  </div>
                </div>
              </div>
            </details>

            {galat.length > 0 && (
              <div className="mt-3">
                <Banner jenis="salah" judul="Soal belum lengkap">
                  <ul className="mb-0 ps-3">
                    {galat.map((pesan) => (
                      <li key={pesan}>{pesan}</li>
                    ))}
                  </ul>
                </Banner>
              </div>
            )}
          </section>
        </div>
      </div>

      <aside className="col-lg-4 sisi-lengket" aria-label="Pratinjau dan kelengkapan">
        <div className="d-flex flex-column gap-4">
          <section className="kartu-soft p-4" aria-labelledby="soal-pratinjau">
            <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
              <h2 id="soal-pratinjau" className="judul-kecil flex-grow-1 mb-0">
                Pratinjau (kunci ditandai)
              </h2>
              <span className="badge-status info">Sama seperti layar murid</span>
            </div>

            <RendererSoal
              tipe={state.tipe}
              konten={muatan.konten}
              kunci={muatan.kunci}
              nama={`pratinjau-${state.tipe}`}
              tampilkanKunci
            />
          </section>

          <section className="kartu-soft p-4" aria-labelledby="soal-kelengkapan">
            <h2 id="soal-kelengkapan" className="judul-kecil">Kelengkapan</h2>

            <ul className="list-unstyled d-flex flex-column gap-2 mb-3">
              {kelengkapan.map((satu) => (
                <li key={satu.teks} className="d-flex align-items-center gap-2">
                  <span className={`badge-status ${satu.ok ? 'sukses' : 'peringatan'}`}>
                    {satu.ok ? 'Lengkap' : 'Belum'}
                  </span>
                  <span className="small">{satu.teks}</span>
                </li>
              ))}
            </ul>

            <div className="d-flex flex-wrap gap-2">
              <Tombol
                disabled={!siap}
                memuat={sedangMenyimpan}
                teksMemuat="Menyimpan…"
                onClick={kirim}
              >
                {soal === null ? 'Simpan soal' : 'Perbarui soal'}
              </Tombol>
              <Tombol varian="tepi" onClick={onBatal}>Batal</Tombol>
            </div>

            {!siap && (
              <p className="teks-lembut small mt-2 mb-0">
                Lengkapi butir yang masih “Belum” supaya soal bisa disimpan.
              </p>
            )}
          </section>
        </div>
      </aside>
    </div>
  )
}
