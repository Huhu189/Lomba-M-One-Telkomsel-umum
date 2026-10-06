/**
 * Editor bank soal (slice 03 + 06).
 *
 * Bidang berubah mengikuti tipe soal (delapan tipe); validasi kelengkapan
 * dijalankan di klien (cermin registry backend) lalu pratinjau memakai renderer
 * yang sama dengan layar murid — jadi yang dilihat guru persis yang dilihat murid.
 */
import { useState } from 'react'
import Banner from '../../shared/ui/Banner.jsx'
import { Tombol } from '../../shared/ui/Tombol.jsx'
import RendererSoal from './render/RendererSoal.jsx'
import {
  DAFTAR_TIPE,
  MAKS_MATEMATIKA,
  MAKS_OPSI,
  MIN_ITEM,
  MIN_OPSI,
  TIPE,
  idBerikut,
  muatanDariState,
  stateDariSoal,
  stateSoalKosong,
} from './tipeSoal.js'
import { validasiSoal } from './validasi.js'

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
    <fieldset className="col-12">
      <legend className="h6 fw-semibold">{judul} (minimal {MIN_ITEM})</legend>

      <div className="row g-3">
        <div className="col-md-6">
          <h3 className="h6 fw-semibold teks-lembut">Kiri</h3>
          {state.kiri.map((satu, index) => (
            <div key={satu.id} className="d-flex flex-wrap align-items-center gap-2 mb-2">
              <span className="opsi-huruf">{satu.id}</span>
              <input
                className="form-control form-control-sm flex-grow-1"
                aria-label={`Teks kiri ${satu.id}`}
                value={satu.teks}
                onChange={(e) => ubahKiri(index, e.target.value)}
              />
              <select
                className="form-select form-select-sm jodoh-pilih"
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
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                disabled={state.kiri.length <= MIN_ITEM}
                onClick={() => hapusKiri(index)}
              >
                Hapus
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            disabled={state.kiri.length >= MAKS_OPSI}
            onClick={() => ubah({ kiri: [...state.kiri, { id: idBerikut('K', state.kiri), teks: '' }] })}
          >
            Tambah kiri
          </button>
        </div>

        <div className="col-md-6">
          <h3 className="h6 fw-semibold teks-lembut">Kanan</h3>
          {state.kanan.map((satu, index) => (
            <div key={satu.id} className="d-flex align-items-center gap-2 mb-2">
              <span className="opsi-huruf">{satu.id}</span>
              <input
                className="form-control form-control-sm"
                aria-label={`Teks kanan ${satu.id}`}
                value={satu.teks}
                onChange={(e) => ubahKanan(index, e.target.value)}
              />
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                disabled={state.kanan.length <= MIN_ITEM}
                onClick={() => hapusKanan(index)}
              >
                Hapus
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            disabled={state.kanan.length >= MAKS_OPSI}
            onClick={() => ubah({ kanan: [...state.kanan, { id: idBerikut('N', state.kanan), teks: '' }] })}
          >
            Tambah kanan
          </button>
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

  function kirim() {
    const temuan = validasiSoal(state)

    if (temuan.length > 0) {
      setGalat(temuan)
      return
    }

    setGalat([])
    onSimpan(muatanDariState(state))
  }

  return (
    <div className="kartu-soft p-4">
      <div className="d-flex flex-wrap align-items-baseline gap-2 mb-3">
        <h2 className="h6 fw-bold mb-0">{soal === null ? 'Tambah Soal' : `Ubah Soal #${soal.id}`}</h2>
        <span className="teks-lembut small">
          Objektif (dinilai pasti) atau bertingkat (isian singkat &amp; uraian, dikoreksi guru bila perlu).
        </span>
        {soal !== null && (
          <button type="button" className="btn btn-sm btn-outline-secondary ms-auto" onClick={onBatal}>
            Batal ubah
          </button>
        )}
      </div>

      {galat.length > 0 && (
        <div className="mb-3">
          <Banner jenis="salah" judul="Soal belum lengkap">
            <ul className="mb-0 ps-3">
              {galat.map((pesan) => (
                <li key={pesan}>{pesan}</li>
              ))}
            </ul>
          </Banner>
        </div>
      )}

      <div className="row g-3">
        <div className="col-sm-6 col-lg-4">
          <label className="form-label fw-semibold" htmlFor="soal-mapel">Mapel</label>
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

        <div className="col-sm-6 col-lg-4">
          <label className="form-label fw-semibold" htmlFor="soal-tag">Tag / tema (opsional)</label>
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

        <div className="col-sm-6 col-lg-4">
          <label className="form-label fw-semibold" htmlFor="soal-tipe">Tipe soal</label>
          <select
            id="soal-tipe"
            className="form-select"
            value={state.tipe}
            onChange={(e) => ubah({ tipe: e.target.value })}
          >
            {DAFTAR_TIPE.map((tipe) => (
              <option key={tipe.nilai} value={tipe.nilai}>
                {tipe.label}{tipe.objektif ? '' : ' (dinilai guru bila perlu)'}
              </option>
            ))}
          </select>
        </div>

        <div className="col-12">
          <label className="form-label fw-semibold" htmlFor="soal-teks">Isi soal</label>
          <textarea
            id="soal-teks"
            className="form-control"
            rows={3}
            value={state.teks}
            onChange={(e) => ubah({ teks: e.target.value })}
            placeholder="Tulis pertanyaan seperti kamu menjelaskannya ke murid…"
          />
        </div>

        {state.tipe === TIPE.pilihanGanda && (
          <fieldset className="col-12">
            <legend className="h6 fw-semibold">Opsi jawaban ({MIN_OPSI}–{MAKS_OPSI})</legend>

            {state.opsi.map((satu, index) => (
              <div key={satu.id} className="d-flex align-items-center gap-2 mb-2">
                <div className="form-check m-0">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="kunci-pilihan-ganda"
                    id={`kunci-${satu.id}`}
                    checked={state.jawaban === satu.id}
                    onChange={() => ubah({ jawaban: satu.id })}
                  />
                  <label className="form-check-label sr-saja" htmlFor={`kunci-${satu.id}`}>
                    Tandai opsi {satu.id} sebagai kunci
                  </label>
                </div>
                <span className="opsi-huruf">{satu.id}.</span>
                <input
                  className="form-control"
                  aria-label={`Teks opsi ${satu.id}`}
                  value={satu.teks}
                  onChange={(e) => ubahOpsi(index, e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  disabled={state.opsi.length <= MIN_OPSI}
                  onClick={() => hapusOpsi(index)}
                >
                  Hapus
                </button>
              </div>
            ))}

            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                disabled={state.opsi.length >= MAKS_OPSI}
                onClick={tambahOpsi}
              >
                Tambah opsi
              </button>
              <span className="teks-lembut small">Radio di kiri menandai kunci jawaban.</span>
            </div>
          </fieldset>
        )}

        {state.tipe === TIPE.benarSalah && (
          <fieldset className="col-12">
            <legend className="h6 fw-semibold">Pernyataan benar atau salah</legend>
            <div className="d-flex gap-3">
              {[
                { nilai: true, label: 'Benar', id: 'kunci-benar' },
                { nilai: false, label: 'Salah', id: 'kunci-salah' },
              ].map((pilihan) => (
                <div key={pilihan.id} className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="kunci-benar-salah"
                    id={pilihan.id}
                    checked={state.benar === pilihan.nilai}
                    onChange={() => ubah({ benar: pilihan.nilai })}
                  />
                  <label className="form-check-label" htmlFor={pilihan.id}>{pilihan.label}</label>
                </div>
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
          <fieldset className="col-12">
            <legend className="h6 fw-semibold">Kata + posisi (minimal {MIN_ITEM})</legend>
            <p className="teks-lembut small">
              Setiap kata wajib punya satu posisi. Penilaian otomatis: seluruh kata harus tepat.
            </p>

            <div className="row g-3">
              <div className="col-md-7">
                <h3 className="h6 fw-semibold teks-lembut">Kata</h3>
                {state.kata.map((satu, index) => (
                  <div key={satu.id} className="d-flex flex-wrap align-items-center gap-2 mb-2">
                    <span className="opsi-huruf">{satu.id}</span>
                    <input
                      className="form-control form-control-sm flex-grow-1"
                      aria-label={`Teks kata ${satu.id}`}
                      value={satu.teks}
                      onChange={(e) => ubahKata(index, e.target.value)}
                    />
                    <select
                      className="form-select form-select-sm jodoh-pilih"
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
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      disabled={state.kata.length <= MIN_ITEM}
                      onClick={() => hapusKata(index)}
                    >
                      Hapus
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  disabled={state.kata.length >= MAKS_OPSI}
                  onClick={() => ubah({ kata: [...state.kata, { id: idBerikut('W', state.kata), teks: '' }] })}
                >
                  Tambah kata
                </button>
              </div>

              <div className="col-md-5">
                <h3 className="h6 fw-semibold teks-lembut">Posisi</h3>
                {state.posisi.map((satu, index) => (
                  <div key={satu.id} className="d-flex align-items-center gap-2 mb-2">
                    <span className="opsi-huruf">{satu.id}</span>
                    <input
                      className="form-control form-control-sm"
                      aria-label={`Teks posisi ${satu.id}`}
                      value={satu.teks}
                      onChange={(e) => ubahPosisiKata(index, e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      disabled={state.posisi.length <= MIN_ITEM}
                      onClick={() => hapusPosisiKata(index)}
                    >
                      Hapus
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  disabled={state.posisi.length >= MAKS_OPSI}
                  onClick={() =>
                    ubah({ posisi: [...state.posisi, { id: idBerikut('P', state.posisi), teks: '' }] })
                  }
                >
                  Tambah posisi
                </button>
              </div>
            </div>
          </fieldset>
        )}

        {state.tipe === TIPE.isianSingkat && (
          <fieldset className="col-12">
            <legend className="h6 fw-semibold">Jawaban baku + sinonim</legend>
            <p className="teks-lembut small">
              Jawaban murid dinilai mirip (toleran salah ketik ringan). Pisahkan sinonim dengan koma.
            </p>

            {state.jawabanBaku.map((satu, index) => (
              <div key={index} className="row g-2 align-items-center mb-2">
                <div className="col-md-5">
                  <input
                    className="form-control"
                    aria-label={`Jawaban baku ${index + 1}`}
                    value={satu.teks}
                    onChange={(e) => ubahJawabanBaku(index, { teks: e.target.value })}
                    placeholder="Jawaban baku, mis. 12"
                  />
                </div>
                <div className="col-md-5">
                  <input
                    className="form-control"
                    aria-label={`Sinonim jawaban ${index + 1}`}
                    value={satu.sinonim}
                    onChange={(e) => ubahJawabanBaku(index, { sinonim: e.target.value })}
                    placeholder="Sinonim (opsional): dua belas, 12,0"
                  />
                </div>
                <div className="col-md-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    disabled={state.jawabanBaku.length <= 1}
                    onClick={() => hapusJawabanBaku(index)}
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}

            <div className="d-flex flex-wrap align-items-center gap-3">
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={tambahJawabanBaku}>
                Tambah jawaban
              </button>

              <div className="form-check m-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="soal-angka-persis"
                  checked={state.angkaPersis}
                  onChange={(e) => ubah({ angkaPersis: e.target.checked })}
                />
                <label className="form-check-label" htmlFor="soal-angka-persis">
                  Angka harus persis (12 dianggap beda dari 12,5)
                </label>
              </div>

              <div className="d-flex align-items-center gap-2">
                <label className="form-label fw-semibold mb-0" htmlFor="soal-ambang-isian">
                  Ambang mirip
                </label>
                <input
                  id="soal-ambang-isian"
                  className="form-control form-control-sm w-auto"
                  type="number"
                  step="0.05"
                  min="0.1"
                  max="1"
                  value={state.ambang}
                  onChange={(e) => ubah({ ambang: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="form-label fw-semibold" htmlFor="soal-negasi">
                Kata negasi yang membatalkan jawaban (opsional, pisah koma)
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
          <fieldset className="col-12">
            <legend className="h6 fw-semibold">Kata kunci penilaian</legend>
            <p className="teks-lembut small">
              Jawaban uraian dinilai dari kata kunci yang muncul. Bila belum yakin, soal masuk antrean
              koreksi guru.
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
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    disabled={state.kataKunci.length <= 1}
                    onClick={() => hapusKataKunci(index)}
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}

            <button type="button" className="btn btn-sm btn-outline-primary" onClick={tambahKataKunci}>
              Tambah kata kunci
            </button>

            <div className="row g-3 mt-1">
              <div className="col-md-4">
                <label className="form-label fw-semibold" htmlFor="soal-ambang-uraian">
                  Ambang lulus
                </label>
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
              <div className="col-md-8">
                <label className="form-label fw-semibold" htmlFor="soal-sinonim-uraian">
                  Sinonim kata kunci (opsional, tiap baris: kata = alias, alias)
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
          </fieldset>
        )}

        {state.tipe === TIPE.mengurutkan && (
          <fieldset className="col-12">
            <legend className="h6 fw-semibold">Item + nomor urut benar (minimal {MIN_ITEM})</legend>

            {state.item.map((satu, index) => (
              <div key={satu.id} className="d-flex align-items-center gap-2 mb-2">
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
                  className="form-control form-control-sm"
                  aria-label={`Teks item ${satu.id}`}
                  value={satu.teks}
                  onChange={(e) => ubahItem(index, e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  disabled={state.item.length <= MIN_ITEM}
                  onClick={() => hapusItem(index)}
                >
                  Hapus
                </button>
              </div>
            ))}

            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
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
            </button>
          </fieldset>
        )}

        <div className="col-sm-4">
          <label className="form-label fw-semibold" htmlFor="soal-skor">Skor</label>
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

        <div className="col-sm-4 d-flex align-items-end pb-2">
          <div className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              id="soal-aktif"
              checked={state.aktif}
              onChange={(e) => ubah({ aktif: e.target.checked })}
            />
            <label className="form-check-label" htmlFor="soal-aktif">Soal aktif</label>
          </div>
        </div>

        <div className="col-12">
          <label className="form-label fw-semibold" htmlFor="soal-pembahasan">Pembahasan (opsional)</label>
          <textarea
            id="soal-pembahasan"
            className="form-control"
            rows={2}
            maxLength={500}
            value={state.pembahasan}
            onChange={(e) => ubah({ pembahasan: e.target.value })}
            placeholder="Muncul setelah kuis selesai, tidak pernah ikut ke layar murid."
          />
        </div>

        <details className="col-12">
          <summary className="fw-semibold">Media &amp; MathML (opsional)</summary>
          <div className="row g-3 mt-1">
            <div className="col-md-6">
              <label className="form-label fw-semibold" htmlFor="soal-media">Alamat media</label>
              <input
                id="soal-media"
                className="form-control"
                value={state.media}
                onChange={(e) => ubah({ media: e.target.value })}
                placeholder="/media/gambar-soal.png"
              />
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold" htmlFor="soal-matematika">
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
        </details>
      </div>

      <div className="mt-4 d-flex flex-wrap gap-2 align-items-center">
        <Tombol memuat={sedangMenyimpan} teksMemuat="Menyimpan…" onClick={kirim}>
          {soal === null ? 'Simpan soal' : 'Perbarui soal'}
        </Tombol>
        {soal !== null && (
          <button type="button" className="btn btn-outline-secondary" onClick={onBatal}>
            Batal
          </button>
        )}
      </div>

      <hr className="my-4" />

      <section aria-label="Pratinjau soal">
        <h3 className="h6 fw-bold text-uppercase teks-lembut mb-3">Pratinjau (kunci ditandai)</h3>
        <RendererSoal
          tipe={state.tipe}
          konten={muatanDariState(state).konten}
          kunci={muatanDariState(state).kunci}
          nama={`pratinjau-${state.tipe}`}
          tampilkanKunci
        />
      </section>
    </div>
  )
}
