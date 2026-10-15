/**
 * Editor bank soal (slice 03 + 06) — papan desain 11.
 *
 * Tata letaknya tiga kartu bernomor di kolom utama (jenis soal → isi soal →
 * pengaturan) dengan sisi kanan yang mengikuti gulir berisi pratinjau dan daftar
 * kelengkapan. Bidang berubah mengikuti tipe soal (22 tipe); validasi
 * kelengkapan dijalankan di klien (cermin registry backend) lalu pratinjau
 * memakai renderer yang sama dengan layar murid — jadi yang dilihat guru persis
 * yang dilihat murid.
 */
import { createElement, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { buatMapel } from '../../school/api.js'
import { pesanGalatApi } from '../../auth/api.js'
import { tampilkanToast } from '../../../shared/ui/toast.jsx'
import Banner from '../../../shared/ui/Banner.jsx'
import DialogKonfirmasi from '../../../shared/ui/DialogKonfirmasi.jsx'
import { Tombol, TombolIkon } from '../../../shared/ui/Tombol.jsx'
import {
  JUDUL_BELUM_TERSIMPAN,
  PESAN_BELUM_TERSIMPAN,
  usePenjagaSebelumTutup,
} from '../../../shared/penjagaPerubahan.js'
import { IkonTambah, IkonTipeIsianSingkat, IkonTongSampah } from '../../../icons.jsx'
import RendererSoal from '../render/RendererSoal.jsx'
import {
  DAFTAR_TIPE,
  JENIS_BERKAS_TUGAS,
  LABEL_TIPE,
  MAKS_AREA_HOTSPOT,
  MAKS_BUTIR_RUBRIK,
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
  MAKS_PETUNJUK_SILANG,
  MAKS_SEL,
  MAKS_SISI_SILANG,
  MIN_GAMBAR,
  MIN_HURUF,
  MIN_HURUF_SILANG,
  MIN_ITEM,
  MIN_KOTAK,
  MIN_OPSI,
  MIN_OPSI_KOMPLEKS,
  MIN_PERNYATAAN,
  TIPE,
  TIPE_TANPA_TEKS,
  barisSinonimUraian,
  centangJenisBerkas,
  hapusBarisSilang,
  hapusBarisSinonimUraian,
  hapusBarisTabel,
  hapusKolomSilang,
  hapusKolomTabel,
  idBerikut,
  geserBarisPosisi,
  ikonTipe,
  kolomTabel,
  kotakSilangDariGrid,
  lepasPasangan,
  muatanDariState,
  nomorLubangDariTeks,
  pasangkanKanan,
  pemakaiKanan,
  pilihanJenisBerkas,
  samakanPanjangSilang,
  selDariPetunjuk,
  stateDariSoal,
  stateSoalKosong,
  tambahBarisSilang,
  tambahBarisSinonimUraian,
  tambahBarisTabel,
  tambahKolomSilang,
  tambahKolomTabel,
  teksJenisBerkas,
  ubahBarisSinonimUraian,
  ubahKotakSilang,
} from '../tipeSoal.js'
import {
  pilihanTeknikKoreksi,
  teknikKoreksiBawaan,
  teknikKoreksiDariState,
  teknikKoreksiSah,
  teknikTerkunci,
} from '../teknikKoreksi.js'
import { kelengkapanSoal, siapSoal, validasiSoal } from '../validasi.js'
// Ringkasan kunci yang sama dipakai halaman Koreksi — satu cara membaca kunci
// untuk semua tipe soal, jadi guru melihat kesimpulan yang konsisten.
import { ringkasKunci } from '../../scoring/tampilan.js'

/**
 * Elemen ikon untuk satu jenis soal. Sengaja mengembalikan **elemen** (lewat
 * `createElement`) dan bukan komponen bernama besar, supaya ikon dinamis ini
 * tidak dibaca React Compiler sebagai komponen yang dibuat di dalam render.
 * @param {string} tipe
 * @param {number} ukuran
 * @returns {import('react').ReactNode}
 */
function ikonJenis(tipe, ukuran = 22) {
  return createElement(ikonTipe(tipe) ?? IkonTipeIsianSingkat, { size: ukuran })
}

/**
 * Fieldset pasangan kiri–kanan untuk menjodohkan & hubung kata. Backend memakai
 * satu penangan yang sama (PenanganHubungKata extends PenanganMenjodohkan), jadi
 * editornya pun satu — hanya nama kunci pemetaannya yang berbeda.
 * @param {{
 *   state: import('../tipeSoal.js').StateSoal,
 *   ubah: (perubahan: Partial<import('../tipeSoal.js').StateSoal>) => void,
 *   namaPeta: 'pasangan'|'sambungan',
 *   judul: string,
 * }} props
 */
/**
 * Tombol pengurut satu baris (▲ naik / ▼ turun).
 *
 * Guru menyusun urutannya dengan **memindahkan barisnya**, bukan mengetik angka
 * (14 Oktober 2026). Karena nomornya dihitung dari posisi baris, tidak mungkin
 * ada dua baris bernomor sama atau nomor yang terlewat; tombolnya mati di ujung
 * daftar supaya tidak ada baris yang diam-diam hilang saat ditekan.
 *
 * @param {{
 *   nama: string,
 *   index: number,
 *   jumlah: number,
 *   onGeser: (index: number, arah: number) => void,
 * }} props
 */
function PengurutBaris({ nama, index, jumlah, onGeser }) {
  return (
    <div className="pengurut" role="group" aria-label={`Urutan ${nama}`}>
      <Tombol
        varian="tepi"
        ukuran="sedang"
        className="pengurut-tombol"
        aria-label={`Naikkan ${nama} ke atas`}
        disabled={index === 0}
        onClick={() => onGeser(index, -1)}
      >
        ▲
      </Tombol>
      <Tombol
        varian="tepi"
        ukuran="sedang"
        className="pengurut-tombol"
        aria-label={`Turunkan ${nama} ke bawah`}
        disabled={index === jumlah - 1}
        onClick={() => onGeser(index, 1)}
      >
        ▼
      </Tombol>
    </div>
  )
}

/**
 * Penyusun pasangan (menjodohkan & hubung kata).
 *
 * 14 Oktober 2026 — pemilik produk: "menjodohkan layout-nya sangat jelek dan
 * gak berurutan dan sudah dipakai". Dua sebabnya diperbaiki di sini:
 *
 * 1. **Pemilih pasangan dipindah keluar dari baris yang sempit.** Dulu tiap
 *    baris memuat kode + isian teks + pemilih + tombol hapus berjejal dalam satu
 *    kolom setengah layar, sehingga isian teks dan pemilihnya sama-sama sempit.
 *    Sekarang kolom kiri/kanan hanya berisi itemnya, dan penyambungan dilakukan
 *    di papan tersendiri di bawahnya — satu baris per item kiri, urut dari atas.
 * 2. **Item kanan yang sudah dipakai tidak bisa dipilih lagi.** Dulu pilihan
 *    yang sudah terpakai tetap bisa dipilih, jadi guru baru tahu dari galat
 *    server ("sudah dipakai"). Sekarang opsi itu mati dan sebabnya tertulis
 *    beserta siapa pemakainya, dan ada penghitung "n dari m tersambung" supaya
 *    pasangan yang belum lengkap terlihat tanpa menunggu galat.
 *
 * @param {{
 *   state: import('../tipeSoal.js').StateSoal,
 *   ubah: (perubahan: Partial<import('../tipeSoal.js').StateSoal>) => void,
 *   namaPeta: 'pasangan'|'sambungan',
 *   judul: string,
 * }} props
 */
function FieldsetPasangan({ state, ubah, namaPeta, judul }) {
  const peta = state[namaPeta]
  // Siapa pemakai tiap item kanan — dipakai untuk mematikan opsi yang sudah
  // terpakai dan menyebut pemakainya di labelnya.
  const pemakai = pemakaiKanan(peta)
  const tersambung = state.kiri.filter((satu) => (peta[satu.id] ?? '') !== '').length

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

      <p className="teks-lembut small">
        Tulis item kiri dan kanan lebih dulu, lalu sambungkan pasangannya di papan bawah. Item kanan yang
        sudah dipakai tidak bisa dipilih dua kali.
      </p>

      <div className="row g-2">
        <div className="col-md-6">
          <h3 className="fw-bold fs-6 teks-lembut">Kiri</h3>
          {state.kiri.map((satu, index) => (
            <div key={satu.id} className="d-flex flex-wrap align-items-center gap-2 mb-1">
              <span className="kotak-huruf" aria-hidden="true">{satu.id}</span>
              <input
                className="form-control flex-grow-1"
                aria-label={`Teks kiri ${satu.id}`}
                value={satu.teks}
                onChange={(e) => ubahKiri(index, e.target.value)}
                placeholder="Contoh: Paru-paru"
              />
              <TombolIkon
                label={`Hapus item kiri ${satu.id}`}
                ikon={IkonTongSampah}
                className="editor-hapus"
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
            <div key={satu.id} className="d-flex align-items-center gap-2 mb-1">
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
                className="editor-hapus"
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

      {/*
        Papan penyambung: satu baris per item kiri, urut dari atas. Isinya
        disusun "kiri → kanan" supaya bentuk pasangannya terbaca sekali lihat,
        dan pemilihnya punya lebar sendiri (bukan berjejal di baris item).
      */}
      <div className="papan-jodoh mt-3">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
          <h3 className="fw-bold fs-6 teks-lembut mb-0">Sambungkan pasangan</h3>
          <span
            className={`badge-status ${tersambung === state.kiri.length ? 'sukses' : 'peringatan'}`}
            data-jodoh-tersambung={tersambung}
          >
            {tersambung} dari {state.kiri.length} tersambung
          </span>
        </div>

        {state.kiri.map((satu) => {
          const dipilih = peta[satu.id] ?? ''
          const terpilih = state.kanan.find((pasang) => pasang.id === dipilih)

          return (
            <div
              key={`jodoh-${satu.id}`}
              className={`baris-jodoh${dipilih === '' ? '' : ' tersambung'}`}
              data-jodoh={satu.id}
            >
              <span className="baris-jodoh-sisi">
                <span className="kotak-huruf" aria-hidden="true">{satu.id}</span>
                <span className="teks-patah">{satu.teks.trim() === '' ? '(belum diisi)' : satu.teks}</span>
              </span>
              <span className="baris-jodoh-panah" aria-hidden="true">→</span>
              <span className="baris-jodoh-sisi">
                {terpilih ? (
                  <>
                    <span className="kotak-huruf" aria-hidden="true">{terpilih.id}</span>
                    <span className="teks-patah">
                      {terpilih.teks.trim() === '' ? '(belum diisi)' : terpilih.teks}
                    </span>
                  </>
                ) : (
                  <span className="baris-jodoh-kosong">belum dipasangkan</span>
                )}
              </span>
              <select
                className="form-select jodoh-pilih"
                aria-label={`Pasangan kiri ${satu.id}`}
                value={dipilih}
                onChange={(e) => {
                  const nilai = e.target.value
                  simpanPeta(
                    nilai === '' ? lepasPasangan(peta, satu.id) : pasangkanKanan(peta, satu.id, nilai),
                  )
                }}
              >
                <option value="">Belum dipasangkan</option>
                {state.kanan.map((pasang) => {
                  const pemakaiLain = pemakai[pasang.id]
                  const sudahDipakai = pemakaiLain !== undefined && pemakaiLain !== satu.id

                  return (
                    <option key={pasang.id} value={pasang.id} disabled={sudahDipakai}>
                      {pasang.id} — {pasang.teks.trim() === '' ? '(belum diisi)' : pasang.teks}
                      {sudahDipakai ? ` (sudah dipakai ${pemakaiLain})` : ''}
                    </option>
                  )
                })}
              </select>
            </div>
          )
        })}

        {tersambung < state.kiri.length && (
          <p className="teks-lembut small mb-0 mt-2" role="status">
            Masih ada {state.kiri.length - tersambung} item kiri yang belum dipasangkan.
          </p>
        )}
      </div>
    </fieldset>
  )
}

/**
 * `mapelAwal` adalah mapel yang sudah dipilih di luar editor (mis. mapel kuis
 * yang sedang disusun). Soal baru mewarisinya supaya guru tidak ditanya dua
 * kali; soal yang sedang diubah tetap memakai mapelnya sendiri.
 *
 * @param {{
 *   soal: import('../api.js').DataSoal | null,
 *   daftarMapel: { id: number, nama: string }[],
 *   daftarTag: import('../api.js').DataTag[],
 *   sedangMenyimpan: boolean,
 *   onSimpan: (muatan: import('../tipeSoal.js').MuatanSoal, opsi?: { lanjut?: boolean }) => void,
 *   onBatal: () => void,
 *   onMapelDibuat?: () => void,
 *   mapelAwal?: string,
 *   jenisAwal?: string,
 *   tagAwal?: string,
 * }} props
 */
export default function EditorSoal({
  soal,
  daftarMapel,
  daftarTag,
  sedangMenyimpan,
  onSimpan,
  onBatal,
  onMapelDibuat,
  mapelAwal = '',
  jenisAwal = '',
  tagAwal = '',
}) {
  // Panggung (parent) memberi `key` per soal, jadi state selalu mulai bersih
  // saat guru berpindah soal — tanpa perlu effect penyusun ulang.
  const [state, setState] = useState(() =>
    soal === null
      ? {
          ...stateSoalKosong(),
          subject_id: mapelAwal,
          tag_id: tagAwal,
          // Jenis & mapel bekas soal sebelumnya diwarisi saat guru memilih
          // "simpan lalu buat soal berikutnya": menyusun satu bab soal jadi
          // tidak perlu memilih ulang hal yang sama puluhan kali.
          tipe: jenisAwal === '' ? stateSoalKosong().tipe : jenisAwal,
        }
      : stateDariSoal(soal),
  )
  const [galat, setGalat] = useState(/** @type {string[]} */ ([]))
  // Mapel baru bisa dibuat LANGSUNG dari sini (14 Oktober 2026). Sebelumnya,
  // bila sekolah belum punya mapel, guru terpaksa keluar ke halaman Mapel dulu
  // — soal tidak bisa disimpan karena mapelnya wajib, sehingga editor terasa
  // "tidak bisa dipakai" sampai data lain ditambahkan.
  const [mapelBaruTampil, setMapelBaruTampil] = useState(daftarMapel.length === 0)
  const [namaMapelBaru, setNamaMapelBaru] = useState('')
  const [kodeMapelBaru, setKodeMapelBaru] = useState('')
  const [galatMapelBaru, setGalatMapelBaru] = useState('')
  // "Simpan lalu buat soal berikutnya" — satu centang untuk menyusun rangkaian
  // soal tanpa keluar-masuk editor tiap nomor.
  const [lanjutSerupa, setLanjutSerupa] = useState(false)
  // Sebab tombol hapus tidak membuang apa pun (mis. pilihan sudah di batas
  // minimum). Diucapkan di barisnya supaya tombol itu tidak terasa rusak.
  const [pesanOpsi, setPesanOpsi] = useState('')
  // Sebab yang sama untuk tabel isian (batas sel, baris/kolom terakhir) dan
  // grid teka silang (batas sisi) — diucapkan di bawah alatnya.
  const [pesanTabel, setPesanTabel] = useState('')
  const [pesanSilang, setPesanSilang] = useState('')
  // Ada perubahan yang belum tersimpan? Dipakai penjaga "belum tersimpan"
  // (temuan K3): peramban diminta konfirmasi saat halaman ditutup/disegarkan,
  // dan tombol Batal menanyakan dulu sebelum membuang soal yang sedang ditulis.
  const [kotor, setKotor] = useState(false)
  const [dialogKeluar, setDialogKeluar] = useState(false)

  const tambahMapel = useMutation({
    mutationFn: async () =>
      buatMapel({
        nama: namaMapelBaru.trim(),
        kode: kodeMapelBaru.trim() === '' ? undefined : kodeMapelBaru.trim(),
      }),
    onSuccess: async (mapelJadi) => {
      // Mapel baru langsung dipakai soal yang sedang disusun — guru tidak perlu
      // memilihnya lagi dari daftar.
      ubah({ subject_id: String(mapelJadi.id) })
      setNamaMapelBaru('')
      setKodeMapelBaru('')
      setGalatMapelBaru('')
      setMapelBaruTampil(false)
      tampilkanToast('sukses', `Mapel “${mapelJadi.nama}” ditambahkan dan langsung dipakai soal ini.`)
      // Daftar mapel disegarkan pemanggil (halaman bank soal yang memegang
      // kuerinya) — editor tidak perlu tahu soal cache.
      onMapelDibuat?.()
    },
    onError: (error) => setGalatMapelBaru(pesanGalatApi(error)),
  })
  // Pemilih jenis soal dilipat jadi satu chip (13 Oktober 2026). Guru menulis
  // lebih cepat karena 22 petak tidak lagi mendorong pertanyaan & pilihannya ke
  // bawah; begitu satu jenis dipilih, daftarnya menutup sendiri.
  const jenisRef = useRef(/** @type {HTMLDetailsElement|null} */ (null))

  /**
   * Soal ini dipakai kuis yang sedang berjalan (12 Okt 2026).
   *
   * Isi soal tetap boleh diperbaiki — guru sering menemukan salah ketik saat
   * ulangan sudah jalan, dan perubahan langsung terlihat murid yang sedang
   * mengerjakan (layar pengerjaan memeriksa cap versi isi soal). Yang tidak
   * boleh berubah adalah kunci jawaban, skor, dan jenis soal, karena penilaian
   * attempt yang sedang berjalan memakai ketiganya.
   */
  const terkunci = soal?.terkunci === true

  /**
   * Pilihan jenis berkas tugas unggah yang tercentang, dibaca dari teks yang
   * tersimpan. Soal lama masih berisi teks bebas, jadi teksnya dicocokkan
   * dengan kata kunci tiap pilihan (lihat `JENIS_BERKAS_TUGAS`); teks yang
   * tidak dikenali jadi daftar kosong dan guru diminta memilih ulang.
   */
  const jenisBerkasTerpilih = pilihanJenisBerkas(state.jenisBerkas)

  /**
   * @param {Partial<import('../tipeSoal.js').StateSoal>} perubahan
   */
  function ubah(perubahan) {
    setKotor(true)
    setState((lama) => ({ ...lama, ...perubahan }))
  }

  /**
   * Ganti jenis soal **beserta** pilihan teknik koreksinya.
   *
   * Pilihan teknik berbeda per jenis (mis. "Otomatis (teks)" hanya ada untuk
   * isian singkat & uraian), jadi pilihan lama yang tidak lagi sah dikembalikan
   * ke bawaan jenis barunya. Tanpa ini, guru yang berpindah jenis hanya melihat
   * galat "teknik koreksi itu tidak tersedia" saat menyimpan — padahal yang
   * salah bukan pilihannya, hanya jenis soalnya yang berganti (14 Oktober 2026).
   *
   * @param {string} tipe
   */
  function gantiJenis(tipe) {
    setKotor(true)
    setState((lama) => ({
      ...lama,
      tipe,
      teknikKoreksi: teknikKoreksiSah(tipe, lama.teknikKoreksi)
        ? lama.teknikKoreksi
        : teknikKoreksiBawaan(tipe),
    }))
  }

  /** @param {number} index @param {string} teks */
  function ubahOpsi(index, teks) {
    ubah({ opsi: state.opsi.map((satu, posisi) => (posisi === index ? { ...satu, teks } : satu)) })
  }

  function tambahOpsi() {
    if (state.opsi.length >= MAKS_OPSI) return
    setPesanOpsi('')
    ubah({ opsi: [...state.opsi, { id: idBerikut('O', state.opsi), teks: '' }] })
  }

  /**
   * Buang satu pilihan jawaban.
   *
   * Di batas minimum tombolnya tetap **menjawab** (14 Oktober 2026): dulu ia
   * `disabled` dan fungsinya `return` diam-diam, jadi guru yang menekannya tidak
   * mendapat apa-apa — tombolnya terasa rusak sampai ia menambah pilihan lain.
   * Sekarang sebabnya diucapkan di barisnya, dan pilihan yang sudah ada tidak
   * ikut terbuang.
   *
   * @param {number} index
   */
  function hapusOpsi(index) {
    const minimum = state.tipe === TIPE.pilihanGandaKompleks ? MIN_OPSI_KOMPLEKS : MIN_OPSI

    if (state.opsi.length <= minimum) {
      const pesan =
        `Pilihan jawaban minimal ${minimum}. Tambah satu pilihan dulu (tombol “Tambah pilihan”), ` +
        'baru pilihan lain bisa dibuang.'
      setPesanOpsi(pesan)
      tampilkanToast('info', pesan)
      return
    }

    setPesanOpsi('')
    const sisa = state.opsi.filter((_, posisi) => posisi !== index)
    const jawaban = sisa.some((satu) => satu.id === state.jawaban) ? state.jawaban : (sisa[0]?.id ?? '')
    ubah({ opsi: sisa, jawaban })
  }

  /**
   * Ubah satu baris jawaban baku isian (teks dan/atau sinonimnya).
   * @param {number} index
   * @param {Partial<import('../tipeSoal.js').BarisIsian>} perubahan
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
   * @param {Partial<import('../tipeSoal.js').BarisKataKunci>} perubahan
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

  /**
   * Pindahkan baris item naik/turun. Urutan visual di sini **adalah** urutan
   * benar: nomor tiap baris dihitung sendiri (lihat `geserBarisPosisi`), jadi
   * tidak ada angka yang bisa tertukar atau terlewat (14 Oktober 2026).
   * @param {number} index
   * @param {number} arah
   */
  function geserItemUrut(index, arah) {
    ubah({ item: geserBarisPosisi(state.item, index, arah) })
  }

  /** @param {number} index @param {number} arah */
  function geserGambarUrut(index, arah) {
    ubah({ itemGambar: geserBarisPosisi(state.itemGambar, index, arah) })
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
   */
  function ubahMediaGambar(index, media) {
    ubah({
      itemGambar: state.itemGambar.map((satu, nomor) => (nomor === index ? { ...satu, media } : satu)),
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

  /**
   * Jumlah kolom tabel. Namanya diambil dari `state.kolom`, dan bila soal lama
   * belum menyimpan nama kolom, jumlahnya mengikuti sel terpanjang — supaya
   * tabel yang sudah punya sel tidak tampil kosong.
   */
  function jumlahKolomTabel() {
    const selTerpanjang = state.barisTabel.reduce((maks, baris) => Math.max(maks, baris.sel.length), 0)

    return Math.max(kolomTabel(state).length, selTerpanjang)
  }

  /**
   * Nama kolom yang tampil di kepala tabel. Kolom tanpa nama mendapat nama
   * bawaan, dan nama bawaan itu **ikut disimpan** begitu ada tindakan yang
   * menyentuh tabel (`ubahTabel`), jadi menyimpan tidak pernah gagal hanya
   * karena kepala tabel belum diberi nama.
   */
  function namaKolomTabel() {
    const daftar = kolomTabel(state)

    return [...Array(jumlahKolomTabel())].map((_, kolom) => daftar[kolom] ?? `Kolom ${kolom + 1}`)
  }

  /**
   * State tabel dengan nama kolom yang sudah dimaterialkan — semua tindakan
   * tabel lewat sini supaya nama bawaan tidak hilang lagi.
   */
  function stateTabel() {
    return { ...state, kolom: namaKolomTabel().join(', ') }
  }

  /**
   * Jalankan pembuat tabel murni; bila batasnya tercapai, sebabnya diucapkan di
   * bawah tabel — tombol yang tidak bereaksi lebih buruk daripada pesan jelas.
   * @param {{ kolom?: string, barisTabel?: any[], kunciSel?: Record<string, string> }|null} hasil
   * @param {string} sebab
   */
  function terapkanTabel(hasil, sebab) {
    if (hasil === null) {
      setPesanTabel(sebab)
      return
    }

    setPesanTabel('')
    ubah(hasil)
  }

  /** Jumlah sel seluruh tabel (batas server {MAKS_SEL}). */
  function jumlahSelTabel() {
    return state.barisTabel.reduce((jumlah, baris) => jumlah + baris.sel.length, 0)
  }

  function tambahKolomTabelBaru() {
    const hasil = tambahKolomTabel(stateTabel())

    if (hasil === null) {
      setPesanTabel(`Tabel isian maksimal ${MAKS_SEL} sel. Hapus baris atau kolom dulu.`)
      return
    }

    // Tabel tanpa baris tidak akan menampilkan sel apa pun, jadi kolom pertama
    // langsung disertai satu baris kosong.
    const digabung = { ...stateTabel(), ...hasil }
    const baris = digabung.barisTabel.length === 0 ? tambahBarisTabel(digabung) : null

    setPesanTabel('')
    ubah(baris === null ? hasil : { ...hasil, ...baris })
  }

  function tambahBarisTabelBaru() {
    terapkanTabel(
      tambahBarisTabel(stateTabel()),
      jumlahKolomTabel() === 0
        ? 'Tambah kolom dulu supaya barisnya punya sel.'
        : `Tabel isian maksimal ${MAKS_SEL} sel. Hapus baris atau kolom dulu.`,
    )
  }

  /** @param {number} kolom */
  function hapusKolomTabelKe(kolom) {
    terapkanTabel(hapusKolomTabel(stateTabel(), kolom), 'Tabel wajib punya minimal satu kolom.')
  }

  /** @param {number} index */
  function hapusBarisTabelKe(index) {
    terapkanTabel(hapusBarisTabel(state, index), 'Tabel wajib punya minimal satu baris.')
  }

  /**
   * Nama satu kolom. Koma dibuang dari namanya (nama kolom disimpan sebagai
   * teks berkoma), dan nama yang dikosongkan kembali ke nama bawaannya supaya
   * jumlah kolom tidak bergeser.
   * @param {number} kolom @param {string} teks
   */
  function ubahNamaKolom(kolom, teks) {
    const nama = namaKolomTabel()
    const bersih = teks.replace(/,/g, ' ').trimStart()

    if (kolom < 0 || kolom >= nama.length) return

    nama[kolom] = bersih.trim() === '' ? `Kolom ${kolom + 1}` : bersih
    setPesanTabel('')
    ubah({ kolom: nama.map((satu) => satu.trim()).join(', ') })
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

  /** Grid teka silang sebagai matriks kotak (lebar baris sudah disamakan). */
  function kotakSilang() {
    return samakanPanjangSilang(kotakSilangDariGrid(state.gridSilang))
  }

  /**
   * Isi satu kotak silang dari ketikan: `#` jadi kotak hitam, huruf jadi huruf
   * jawaban, dan apa pun yang lain jadi kotak kosong.
   * @param {string} teks
   * @returns {string}
   */
  function isiKotakSilang(teks) {
    const bersih = teks.replace(/\s+/g, '')

    if (bersih === '#') return '#'

    const huruf = bersih.slice(-1)

    return /[a-zA-Z]/.test(huruf) ? huruf : '.'
  }

  /** @param {number} baris @param {number} kolom @param {string} nilai */
  function ubahKotakGridSilang(baris, kolom, nilai) {
    setPesanSilang('')
    ubah({ gridSilang: ubahKotakSilang(state.gridSilang, baris, kolom, nilai) })
  }

  function tambahBarisGridSilang() {
    const baru = tambahBarisSilang(state.gridSilang)

    if (baru === null) {
      setPesanSilang(`Grid teka silang maksimal ${MAKS_SISI_SILANG} baris.`)
      return
    }

    setPesanSilang('')
    ubah({ gridSilang: baru })
  }

  function tambahKolomGridSilang() {
    const baru = tambahKolomSilang(state.gridSilang)

    if (baru === null) {
      setPesanSilang(
        kotakSilang().length === 0
          ? 'Tambah baris dulu supaya kolomnya punya kotak.'
          : `Grid teka silang maksimal ${MAKS_SISI_SILANG} kolom.`,
      )
      return
    }

    setPesanSilang('')
    ubah({ gridSilang: baru })
  }

  /** @param {number} index */
  function hapusBarisGridSilang(index) {
    const baru = hapusBarisSilang(state.gridSilang, index)

    if (baru === null) {
      setPesanSilang('Teka silang wajib punya minimal 2 baris.')
      return
    }

    setPesanSilang('')
    ubah({ gridSilang: baru })
  }

  /** @param {number} index */
  function hapusKolomGridSilang(index) {
    const baru = hapusKolomSilang(state.gridSilang, index)

    if (baru === null) {
      setPesanSilang('Teka silang wajib punya minimal 2 kolom.')
      return
    }

    setPesanSilang('')
    ubah({ gridSilang: baru })
  }

  /**
   * Sinonim uraian sebagai baris kata + alias; kolom kanan tetap satu-satunya
   * sumber data, jadi bentuk yang dikirim ke server tidak berubah.
   * @param {number} index @param {'kata'|'alias'} bidang @param {string} nilai
   */
  function ubahSinonimUraian(index, bidang, nilai) {
    ubah({ sinonimUraian: ubahBarisSinonimUraian(state.sinonimUraian, index, bidang, nilai) })
  }

  /**
   * Hotspot gambar: area yang bisa diketuk (persen dari gambar).
   * @param {number} index @param {'x'|'y'|'w'|'h'} bidang @param {string} nilai
   */
  function ubahAreaHotspot(index, bidang, nilai) {
    ubah({
      areaHotspot: state.areaHotspot.map((satu, nomor) => {
        if (nomor !== index) return satu

        return bidang === 'x'
          ? { ...satu, x: nilai }
          : bidang === 'y'
            ? { ...satu, y: nilai }
            : bidang === 'w'
              ? { ...satu, w: nilai }
              : { ...satu, h: nilai }
      }),
    })
  }

  function tambahAreaHotspot() {
    ubah({
      areaHotspot: [
        ...state.areaHotspot,
        { id: idBerikut('A', state.areaHotspot), x: '10', y: '10', w: '20', h: '20' },
      ],
    })
  }

  /** @param {number} index */
  function hapusAreaHotspot(index) {
    const dibuang = state.areaHotspot[index]

    ubah({
      areaHotspot: state.areaHotspot.filter((_, posisi) => posisi !== index),
      benarHotspot: state.benarHotspot.filter((satu) => satu !== dibuang.id),
    })
  }

  /** @param {string} id @param {boolean} dicentang */
  function tohAreaBenar(id, dicentang) {
    ubah({
      benarHotspot: dicentang
        ? [...state.benarHotspot.filter((satu) => satu !== id), id]
        : state.benarHotspot.filter((satu) => satu !== id),
    })
  }

  /**
   * Tugas unggah: butir rubrik penilaian yang dipakai guru saat mengoreksi.
   * @param {number} index @param {'butir'|'poin'} bidang @param {string} nilai
   */
  function ubahRubrik(index, bidang, nilai) {
    ubah({
      rubrik: state.rubrik.map((satu, nomor) =>
        nomor === index
          ? bidang === 'butir'
            ? { ...satu, butir: nilai }
            : { ...satu, poin: nilai }
          : satu,
      ),
    })
  }

  function tambahRubrik() {
    ubah({ rubrik: [...state.rubrik, { butir: '', poin: '1' }] })
  }

  /** @param {number} index */
  function hapusRubrik(index) {
    if (state.rubrik.length <= 1) return

    ubah({ rubrik: state.rubrik.filter((_, posisi) => posisi !== index) })
  }

  /**
   * Teka silang: satu petunjuk (nomor, teks, sel awal, dan panjangnya).
   * @param {number} index @param {'nomor'|'teks'|'mulai'|'panjang'} bidang @param {string} nilai
   */
  function ubahPetunjukSilang(index, bidang, nilai) {
    ubah({
      petunjukSilang: state.petunjukSilang.map((satu, nomor) => {
        if (nomor !== index) return satu

        return bidang === 'nomor'
          ? { ...satu, nomor: nilai }
          : bidang === 'teks'
            ? { ...satu, teks: nilai }
            : bidang === 'mulai'
              ? { ...satu, mulai: nilai }
              : { ...satu, panjang: nilai }
      }),
    })
  }

  /** @param {'mendatar'|'menurun'} arah */
  function tambahPetunjukSilang(arah) {
    const dalamArah = state.petunjukSilang.filter((satu) => satu.arah === arah)

    ubah({
      petunjukSilang: [
        ...state.petunjukSilang,
        { arah, nomor: String(dalamArah.length + 1), teks: '', mulai: '0,0', panjang: '3' },
      ],
    })
  }

  /** @param {number} index */
  function hapusPetunjukSilang(index) {
    ubah({ petunjukSilang: state.petunjukSilang.filter((_, posisi) => posisi !== index) })
  }

  /** @type {('x'|'y'|'w'|'h')[]} */
  const bidangArea = ['x', 'y', 'w', 'h']

  /** @type {('mendatar'|'menurun')[]} */
  const arahSilang = ['mendatar', 'menurun']

  const kelengkapan = kelengkapanSoal(state)
  const siap = siapSoal(kelengkapan)
  const muatan = muatanDariState(state)

  // Perubahan tertahan dihitung juga saat guru mengetik tanpa melewati `ubah()`
  // (mis. mapel baru dibuat dari dialog). Menyimpan menutup penjaganya.
  usePenjagaSebelumTutup(kotor && !sedangMenyimpan)

  /**
   * Bidang yang pertama kali perlu diperbaiki, dalam urutan yang paling mungkin
   * menjadi sebab tombol dulu terasa mati (temuan P4).
   *
   * @returns {{ id: string, pesan: string }|null}
   */
  function bidangKurang() {
    if (state.subject_id === '') return { id: 'soal-mapel', pesan: 'Pilih mapel dulu.' }
    if (state.teks.trim() === '' && !TIPE_TANPA_TEKS.includes(state.tipe)) {
      return { id: 'soal-teks', pesan: 'Isi soal masih kosong.' }
    }

    const skor = Number(state.skor)
    if (!Number.isInteger(skor) || skor < 1 || skor > 100) {
      return { id: 'soal-skor', pesan: 'Skor harus angka 1 sampai 100.' }
    }

    return null
  }

  /**
   * Simpan soal (temuan P4: tombol selalu bisa ditekan).
   *
   * Dulu tombolnya `disabled` sampai SEMUA butir kelengkapan hijau — termasuk
   * "Mapel dipilih" yang kolomnya ada di kartu 3 paling bawah, sementara guru
   * baru mengisi kartu 1–2. Guru menekan tombol abu-abu itu berulang kali tanpa
   * respons apa pun dan menyimpulkan editornya rusak. Sekarang tombolnya aktif:
   * bila ada yang kurang, editor menggulir ke kolom pertama yang bermasalah,
   * memberinya fokus (sekaligus sorotan), dan menyebut sebabnya.
   */
  function kirim() {
    const temuan = validasiSoal(state)

    if (temuan.length > 0) {
      setGalat(temuan)
      setKotor(true)

      const bidang = bidangKurang()
      const simpul = bidang === null ? null : document.getElementById(bidang.id)

      if (simpul !== null) {
        // `scrollIntoView` tidak ada di semua lingkungan (jsdom & webview tua),
        // jadi dipanggil hanya bila tersedia — fokus di bawah tetap jalan.
        if (typeof simpul.scrollIntoView === 'function') simpul.scrollIntoView({ block: 'center' })
        if (typeof simpul.focus === 'function') simpul.focus({ preventScroll: true })
      } else {
        const kartu = document.getElementById('soal-kelengkapan')
        if (kartu && typeof kartu.scrollIntoView === 'function') {
          kartu.scrollIntoView({ block: 'center' })
        }
      }

      return
    }

    setGalat([])
    setKotor(false)
    onSimpan(muatan, { lanjut: lanjutSerupa })
  }

  return (
    <div className="row g-3 align-items-start editor-soal">
      <div className="col-lg-8">
        <div className="d-flex flex-column gap-3">
          {terkunci && (
            <Banner jenis="info" judul="Kuis yang memakai soal ini sedang berjalan">
              <p className="mb-0">
                Isi soal masih boleh kamu perbaiki, dan perubahan langsung terlihat murid yang
                sedang mengerjakan. Yang belum bisa diubah sampai ulangannya selesai:{' '}
                <strong>kunci jawaban, skor, dan jenis soal</strong> — penilaian ulangan yang
                sedang berjalan memakai ketiganya.
              </p>
            </Banner>
          )}

          {/*
            Langkah pertama adalah JENIS soal — bukan satu formulir panjang
            (12 Oktober 2026, permintaan pemilik produk: "spesifik per soal,
            jangan dipaksa semua dalam isian"). Begitu tipe dipilih, bagian di
            bawahnya hanya menampilkan isian yang memang khusus untuk tipe itu.
          */}
          {/*
            Jenis soal tetap dipilih lebih dulu, tetapi 22 petaknya kini **dilipat
            jadi satu chip** (13 Oktober 2026). Dengan begitu pertanyaan dan
            pilihan jawabannya naik ke layar tanpa digeser — guru yang paling
            sering membuat pilihan ganda langsung bisa menulis. Chip menunjukkan
            jenis aktif; menekannya membuka 22 petak berikon, dan memilih satu
            petak menutupnya lagi.
          */}
          <section className="kartu-soft p-3" aria-labelledby="soal-judul-1">
            <h2 id="soal-judul-1" className="judul-bagian">1. Pilih jenis soal</h2>

            {terkunci ? (
              <>
                <p className="pemilih-jenis-terpilih mb-2">
                  <span className="petak-tipe-ikon" aria-hidden="true">
                    {ikonJenis(state.tipe, 20)}
                  </span>
                  {LABEL_TIPE[state.tipe] ?? state.tipe}
                  <span className="teks-lembut small"> · terkunci</span>
                </p>
                <p className="teks-lembut small mb-0">
                  Jenis soal tidak bisa diganti selama kuis berjalan: menggantinya berarti mengganti
                  kunci dan cara penilaian untuk murid yang sedang mengerjakan.
                </p>
              </>
            ) : (
              <details className="pemilih-jenis" ref={jenisRef}>
                <summary>
                  <span className="pemilih-jenis-terpilih">
                    <span className="petak-tipe-ikon" aria-hidden="true">
                      {ikonJenis(state.tipe, 20)}
                    </span>
                    {LABEL_TIPE[state.tipe] ?? state.tipe}
                  </span>
                  <span className="teks-lembut small">
                    Ketuk untuk ganti jenis soal ({DAFTAR_TIPE.length} jenis)
                  </span>
                </summary>

                <div role="radiogroup" aria-label="Jenis soal" className="petak-tipe">
                  {DAFTAR_TIPE.map((tipe) => {
                    const aktif = state.tipe === tipe.nilai

                    return (
                      <button
                        key={tipe.nilai}
                        type="button"
                        role="radio"
                        aria-checked={aktif}
                        className="petak-tipe-tombol"
                        onClick={() => {
                          gantiJenis(tipe.nilai)
                          if (jenisRef.current) jenisRef.current.open = false
                        }}
                      >
                        <span className="petak-tipe-ikon" aria-hidden="true">
                          {ikonJenis(tipe.nilai)}
                        </span>
                        <span className="petak-tipe-label">{tipe.label}</span>
                        {tipe.objektif ? null : <span className="petak-tipe-tanda">perlu tinjau</span>}
                      </button>
                    )
                  })}
                </div>
              </details>
            )}
          </section>

          {/*
            Kartu soal mengikuti pola "kartu pertanyaan": pertanyaan di paling
            atas, poin di kanan atas, lalu jawaban menempel langsung di bawahnya
            (13 Oktober 2026, permintaan pemilik produk). Mapel & tag pindah ke
            kartu Pengaturan supaya guru langsung menulis soal tanpa gangguan.
          */}
          <section className="kartu-soft p-3" aria-labelledby="soal-judul-2">
            <div className="d-flex flex-wrap align-items-end justify-content-between gap-3">
              <h2 id="soal-judul-2" className="judul-bagian mb-0">2. Tulis soalnya</h2>

              <div className="bidang poin-soal">
                <label className="form-label" htmlFor="soal-skor">Poin</label>
                <input
                  id="soal-skor"
                  className="form-control"
                  type="number"
                  min={1}
                  max={100}
                  value={state.skor}
                  disabled={terkunci}
                  aria-describedby={terkunci ? 'soal-skor-alasan' : undefined}
                  onChange={(e) => ubah({ skor: e.target.value })}
                />
                {terkunci && (
                  <span id="soal-skor-alasan" className="teks-lembut small">
                    Poin terkunci selama kuis berjalan.
                  </span>
                )}
              </div>
            </div>

            {state.tipe !== TIPE.susunHuruf && (
              <div className="bidang mt-2">
                <label className="form-label" htmlFor="soal-teks">
                  Pertanyaan
                  {TIPE_TANPA_TEKS.includes(state.tipe) && (
                    <span className="teks-lembut fw-normal"> opsional</span>
                  )}
                </label>
                <textarea
                  id="soal-teks"
                  className="form-control soal-teks-utama"
                  rows={3}
                  value={state.teks}
                  onChange={(e) => ubah({ teks: e.target.value })}
                  placeholder="Tulis pertanyaannya…"
                />
              </div>
            )}

            {state.tipe === TIPE.pilihanGanda && (
              <fieldset className="mt-3">
                <legend className="fw-bold fs-6">
                  Pilihan jawaban ({MIN_OPSI}–{MAKS_OPSI}) — tandai yang benar
                </legend>

                {state.opsi.map((satu, index) => (
                  <div
                    key={satu.id}
                    className={`baris-opsi${state.jawaban === satu.id ? ' kunci' : ''}`}
                  >
                    <label className="pilih-opsi" htmlFor={`kunci-${satu.id}`}>
                      <input
                        className="form-check-input"
                        type="radio"
                        name="kunci-pilihan-ganda"
                        id={`kunci-${satu.id}`}
                        checked={state.jawaban === satu.id}
                        onChange={() => ubah({ jawaban: satu.id })}
                        aria-label={`Tandai ${satu.id} sebagai jawaban benar`}
                      />
                      <span className="kotak-huruf" aria-hidden="true">{satu.id}</span>
                    </label>
                    <input
                      className="form-control flex-grow-1"
                      aria-label={`Teks opsi ${satu.id}`}
                      value={satu.teks}
                      onChange={(e) => ubahOpsi(index, e.target.value)}
                      placeholder={`Opsi ${index + 1}`}
                    />
                    <TombolIkon
                      label={`Hapus pilihan ${satu.id}`}
                      ikon={IkonTongSampah}
                      className="editor-hapus"
                      onClick={() => hapusOpsi(index)}
                    />
                  </div>
                ))}

                {pesanOpsi !== '' && (
                  <p className="baris-opsi-catatan mb-2" role="status">
                    <span aria-hidden="true">ℹ</span>
                    <span>{pesanOpsi}</span>
                  </p>
                )}

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
              <fieldset className="mt-2">
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
              <fieldset className="mt-2">
                <legend className="fw-bold fs-6">Kata + posisi (minimal {MIN_ITEM})</legend>
                <p className="teks-lembut small">Setiap kata wajib punya satu posisi.</p>

                <div className="row g-2">
                  <div className="col-md-7">
                    <h3 className="fw-bold fs-6 teks-lembut">Kata</h3>
                    {state.kata.map((satu, index) => (
                      <div key={satu.id} className="d-flex flex-wrap align-items-center gap-2 mb-1">
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
                          className="editor-hapus"
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
                      <div key={satu.id} className="d-flex align-items-center gap-2 mb-1">
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
                          className="editor-hapus"
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
              <fieldset className="mt-2">
                <legend className="fw-bold fs-6">Jawaban baku dan sinonim</legend>

                {state.jawabanBaku.map((satu, index) => (
                  <div key={index} className="row g-2 align-items-center mb-1">
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
                        className="editor-hapus"
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
              <fieldset className="mt-2">
                <legend className="fw-bold fs-6">Kata kunci penilaian</legend>

                {state.kataKunci.map((satu, index) => (
                  <div key={index} className="row g-2 align-items-center mb-1">
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
                        className="editor-hapus"
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
                  {/*
                    Sinonim disusun sebagai baris kata + alias (14 Oktober 2026);
                    teks "kata = alias" hanya bentuk simpannya, bukan cara guru
                    mengetiknya.
                  */}
                  <div className="col-md-8">
                    <h3 className="fw-bold fs-6 teks-lembut">Sinonim kata kunci</h3>

                    {barisSinonimUraian(state.sinonimUraian).length === 0 && (
                      <p className="teks-lembut small">
                        Belum ada sinonim. Tekan “Tambah sinonim” lalu tulis kata kunci dan ejaan
                        lain yang juga dianggap benar.
                      </p>
                    )}

                    {barisSinonimUraian(state.sinonimUraian).map((satu, index) => (
                      <div key={`sinonim-${index}`} className="d-flex flex-wrap align-items-center gap-2 mb-1">
                        <input
                          className="form-control form-control-sm sinonim-kata"
                          aria-label={`Kata kunci sinonim ${index + 1}`}
                          value={satu.kata}
                          onChange={(e) => ubahSinonimUraian(index, 'kata', e.target.value)}
                          placeholder="Kata kunci, mis. fotosintesis"
                        />
                        <span className="teks-lembut">=</span>
                        <input
                          className="form-control form-control-sm flex-grow-1"
                          aria-label={`Sinonim kata kunci ${index + 1}`}
                          value={satu.alias}
                          onChange={(e) => ubahSinonimUraian(index, 'alias', e.target.value)}
                          placeholder="Sinonim, mis. asimilasi (pisah koma)"
                        />
                        <TombolIkon
                          label={`Hapus sinonim ${index + 1}`}
                          ikon={IkonTongSampah}
                          className="editor-hapus"
                          onClick={() =>
                            ubah({ sinonimUraian: hapusBarisSinonimUraian(state.sinonimUraian, index) })
                          }
                        />
                      </div>
                    ))}

                    <Tombol
                      varian="tepi"
                      ukuran="sedang"
                      ikon={IkonTambah}
                      onClick={() =>
                        ubah({ sinonimUraian: tambahBarisSinonimUraian(state.sinonimUraian) })
                      }
                    >
                      Tambah sinonim
                    </Tombol>
                  </div>
                </div>
              </fieldset>
            )}

            {/*
              Mengurutkan digambar sebagai daftar yang **berurutan dari atas**
              (14 Oktober 2026, permintaan pemilik produk: "buat pengurutan
              urutan dll langsung visual gak perlu ketik lagi"). Dulu tiap baris
              punya kotak angka urut yang harus diketik — dua baris bisa bernomor
              sama dan nomor yang terlewat baru ketahuan dari galat server.
            */}
            {state.tipe === TIPE.mengurutkan && (
              <fieldset className="mt-2">
                <legend className="fw-bold fs-6">
                  Item dalam urutan yang benar ({MIN_ITEM}–{MAKS_OPSI})
                </legend>
                <p className="teks-lembut small">
                  Baris paling atas = paling awal. Pindahkan barisnya pakai tombol ▲/▼ — tidak ada nomor
                  yang perlu diketik. Murid menerima itemnya dalam urutan acak.
                </p>

                {state.item.map((satu, index) => (
                  <div key={satu.id} className="baris-urut">
                    <span className="kotak-huruf" aria-hidden="true">
                      {index + 1}
                    </span>
                    <input
                      className="form-control flex-grow-1"
                      aria-label={`Teks item ${satu.id}`}
                      value={satu.teks}
                      onChange={(e) => ubahItem(index, e.target.value)}
                    />
                    <PengurutBaris
                      nama={`item ${satu.id}`}
                      index={index}
                      jumlah={state.item.length}
                      onGeser={geserItemUrut}
                    />
                    <TombolIkon
                      label={`Hapus item ${satu.id}`}
                      ikon={IkonTongSampah}
                      className="editor-hapus"
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
                  Pilihan jawaban ({MIN_OPSI_KOMPLEKS}–{MAKS_OPSI_KOMPLEKS}) — tandai semua yang benar
                </legend>

                {state.opsi.map((satu, index) => (
                  <div
                    key={satu.id}
                    className={`baris-opsi${state.benarKompleks.includes(satu.id) ? ' kunci' : ''}`}
                  >
                    <label className="pilih-opsi" htmlFor={`kunci-kompleks-${satu.id}`}>
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`kunci-kompleks-${satu.id}`}
                        checked={state.benarKompleks.includes(satu.id)}
                        onChange={(e) => ubahKunciKompleks(satu.id, e.target.checked)}
                        aria-label={`Tandai ${satu.id} sebagai jawaban benar`}
                      />
                      <span className="kotak-huruf" aria-hidden="true">{satu.id}</span>
                    </label>
                    <input
                      className="form-control flex-grow-1"
                      aria-label={`Teks opsi ${satu.id}`}
                      value={satu.teks}
                      onChange={(e) => ubahOpsi(index, e.target.value)}
                      placeholder={`Opsi ${index + 1}`}
                    />
                    <TombolIkon
                      label={`Hapus pilihan ${satu.id}`}
                      ikon={IkonTongSampah}
                      className="editor-hapus"
                      onClick={() => hapusOpsi(index)}
                    />
                  </div>
                ))}

                {pesanOpsi !== '' && (
                  <p className="baris-opsi-catatan mb-2" role="status">
                    <span aria-hidden="true">ℹ</span>
                    <span>{pesanOpsi}</span>
                  </p>
                )}

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
              <fieldset className="mt-2">
                <legend className="fw-bold fs-6">
                  Pernyataan dan kunci ({MIN_PERNYATAAN}–{MAKS_PERNYATAAN})
                </legend>

                {state.pernyataan.map((satu, index) => (
                  <div key={satu.id} className="d-flex flex-wrap align-items-center gap-2 mb-1">
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
                      className="editor-hapus"
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
              <fieldset className="mt-2">
                <legend className="fw-bold fs-6">Kunci angka dan toleransi</legend>
                <div className="row g-2">
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
              <fieldset className="mt-2">
                <legend className="fw-bold fs-6">
                  Gambar pilihan dan kunci ({MIN_GAMBAR}–{MAKS_GAMBAR})
                </legend>

                {state.opsiGambar.map((satu, index) => (
                  <div key={satu.id} className="d-flex flex-wrap align-items-center gap-2 mb-1">
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
                      className="editor-hapus"
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
              <fieldset className="mt-2">
                <legend className="fw-bold fs-6">
                  Gambar dalam urutan yang benar ({MIN_GAMBAR}–{MAKS_GAMBAR})
                </legend>
                <p className="teks-lembut small">
                  Baris paling atas = paling awal. Pindahkan barisnya pakai tombol ▲/▼ — tidak ada nomor
                  yang perlu diketik. Murid menerima gambarnya dalam urutan acak.
                </p>

                {state.itemGambar.map((satu, index) => (
                  <div key={satu.id} className="baris-urut">
                    <span className="kotak-huruf" aria-hidden="true">
                      {index + 1}
                    </span>
                    <input
                      className="form-control flex-grow-1"
                      aria-label={`Alamat gambar ${satu.id}`}
                      value={satu.media}
                      onChange={(e) => ubahMediaGambar(index, e.target.value)}
                      placeholder="/media/gambar.png"
                    />
                    <PengurutBaris
                      nama={`gambar ${satu.id}`}
                      index={index}
                      jumlah={state.itemGambar.length}
                      onGeser={geserGambarUrut}
                    />
                    <TombolIkon
                      label={`Hapus gambar ${satu.id}`}
                      ikon={IkonTongSampah}
                      className="editor-hapus"
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
              <fieldset className="mt-2">
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
                </div>
              </fieldset>
            )}

            {state.tipe === TIPE.isianRumpang && (
              <fieldset className="mt-2">
                <legend className="fw-bold fs-6">
                  Lubang dan jawaban diterima (maksimal {MAKS_LUBANG})
                </legend>
                <p className="teks-lembut small">
                  Isi jawaban yang diterima untuk tiap lubang (beberapa jawaban dipisah koma).
                </p>

                {nomorLubangDariTeks(state.teks).map((nomor) => (
                  <div key={nomor} className="d-flex flex-wrap align-items-center gap-2 mb-1">
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
                <fieldset className="mt-2">
                  <legend className="fw-bold fs-6">
                    Item dan kotaknya ({MIN_ITEM}–{MAKS_ITEM_KLASIFIKASI} item)
                  </legend>

                  {state.itemKlasifikasi.map((satu, index) => (
                    <div key={satu.id} className="d-flex flex-wrap align-items-center gap-2 mb-1">
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
                        className="editor-hapus"
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

                <fieldset className="mt-2">
                  <legend className="fw-bold fs-6">
                    Kotak / kategori ({MIN_KOTAK}–{MAKS_KOTAK})
                  </legend>

                  {state.kotak.map((satu, index) => (
                    <div key={satu.id} className="d-flex flex-wrap align-items-center gap-2 mb-1">
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
                        className="editor-hapus"
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

            {/*
              Tabel isian disusun lewat grid (14 Oktober 2026). Sebelumnya nama
              kolom diketik sebagai teks berkoma dan tiap baris berupa kartu
              bertumpuk, sehingga guru tidak pernah melihat bentuk tabelnya dan
              jumlah kolom mudah meleset dari jumlah sel.
            */}
            {state.tipe === TIPE.tabelIsian && (
              <fieldset className="mt-2">
                <legend className="fw-bold fs-6">
                  Tabel {jumlahKolomTabel()} kolom × {state.barisTabel.length} baris
                  <span className="teks-lembut fw-normal">
                    {' '}
                    ({jumlahSelTabel()} dari maksimal {MAKS_SEL} sel)
                  </span>
                </legend>

                <p className="teks-lembut small">
                  Tulis bagian tabel yang sudah ada isinya (mis. soal atau judul). Sel yang dibiarkan
                  kosong jadi tempat murid mengisi — tulis jawaban yang diterima untuk sel itu.
                </p>

                <div className="d-flex flex-wrap gap-2 mb-2">
                  <Tombol
                    varian="tepi"
                    ukuran="sedang"
                    ikon={IkonTambah}
                    onClick={tambahKolomTabelBaru}
                  >
                    Tambah kolom
                  </Tombol>
                  <Tombol
                    varian="tepi"
                    ukuran="sedang"
                    ikon={IkonTambah}
                    onClick={tambahBarisTabelBaru}
                  >
                    Tambah baris
                  </Tombol>
                </div>

                {pesanTabel !== '' && <p className="status-salah small mb-2">{pesanTabel}</p>}

                <div className="tabel-editor-bungkus">
                  <table className="tabel-editor">
                    <thead>
                      <tr>
                        <th scope="col" className="tabel-editor-nomor">
                          <span className="sr-saja">Baris</span>
                        </th>
                        {namaKolomTabel().map((nama, kolom) => (
                          <th key={`kolom-${kolom}`} scope="col">
                            <input
                              className="form-control form-control-sm tabel-editor-kepala"
                              aria-label={`Nama kolom ${kolom + 1}`}
                              value={nama}
                              onChange={(e) => ubahNamaKolom(kolom, e.target.value)}
                              placeholder={`Kolom ${kolom + 1}`}
                            />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {state.barisTabel.map((baris, index) => (
                        <tr key={baris.id}>
                          <th scope="row" className="tabel-editor-nomor">
                            <span className="editor-grid-nomor">{index + 1}</span>
                            <TombolIkon
                              className="editor-hapus"
                              label={`Hapus baris ${index + 1}`}
                              ikon={IkonTongSampah}
                              onClick={() => hapusBarisTabelKe(index)}
                            />
                          </th>
                          {baris.sel.map((sel, kolom) => {
                            const kosong = sel.teks.trim() === ''
                            const adaKunci = (state.kunciSel[sel.kode] ?? '').trim() !== ''

                            return (
                              <td
                                key={sel.kode}
                                className={kosong && !adaKunci ? 'tabel-editor-sel perlu-kunci' : 'tabel-editor-sel'}
                              >
                                <input
                                  className="form-control form-control-sm"
                                  aria-label={`Teks baris ${index + 1} kolom ${kolom + 1}`}
                                  value={sel.teks}
                                  onChange={(e) => ubahSelTabel(index, kolom, e.target.value)}
                                  placeholder="Teks (kosongkan agar murid mengisi)"
                                />
                                {kosong && (
                                  <input
                                    className="form-control form-control-sm mt-1 tabel-editor-kunci"
                                    aria-label={`Jawaban diterima baris ${index + 1} kolom ${kolom + 1}`}
                                    value={state.kunciSel[sel.kode] ?? ''}
                                    onChange={(e) => ubahKunciSel(sel.kode, e.target.value)}
                                    placeholder="Jawaban diterima (pisah koma)"
                                  />
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                    {/*
                      Hapus kolom pindah ke baris kaki tabel (14 Oktober 2026,
                      permintaan pemilik produk: "tempat sampahnya sangat amat
                      jelek"). Dulu tiap kepala kolom memuat tombol merah 48 px
                      bertumpuk dengan nama kolomnya, jadi barisnya tertarik
                      tinggi. Sekarang semua tombol hapus memakai bentuk hantu
                      yang sama dengan gutter baris.
                    */}
                    {namaKolomTabel().length > 0 && (
                      <tfoot>
                        <tr>
                          <td className="editor-grid-hapus-label">
                            <span className="teks-lembut small">Hapus kolom</span>
                          </td>
                          {namaKolomTabel().map((_, kolom) => (
                            <td key={`hapus-kolom-${kolom}`} className="editor-grid-hapus-sel">
                              <TombolIkon
                                className="editor-hapus"
                                label={`Hapus kolom ${kolom + 1}`}
                                ikon={IkonTongSampah}
                                onClick={() => hapusKolomTabelKe(kolom)}
                              />
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {jumlahKolomTabel() === 0 && (
                  <p className="teks-lembut small">
                    Tabel ini belum punya kolom — tekan “Tambah kolom” untuk mulai menyusun.
                  </p>
                )}
              </fieldset>
            )}

            {state.tipe === TIPE.garisBilangan && (
              <fieldset className="mt-2">
                <legend className="fw-bold fs-6">
                  Rentang garis dan kunci nilai (rentang maksimal {MAKS_RENTANG_GARIS})
                </legend>

                <div className="row g-2">
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

            {state.tipe === TIPE.hotspotGambar && (
              <fieldset className="mt-2">
                <legend className="fw-bold fs-6">
                  Area yang bisa diketuk (maksimal {MAKS_AREA_HOTSPOT})
                </legend>
                <p className="teks-lembut small">
                  Tandai area yang benar dengan kotak centang Kunci.
                </p>

                {state.areaHotspot.map((satu, index) => (
                  <div key={satu.id} className="d-flex flex-wrap align-items-center gap-2 mb-1">
                    <span className="kotak-huruf" aria-hidden="true">{satu.id}</span>
                    {bidangArea.map((bidang) => (
                      <input
                        key={bidang}
                        className="form-control form-control-sm hotspot-bidang-input"
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        aria-label={`${bidang.toUpperCase()} area ${satu.id}`}
                        value={satu[bidang]}
                        onChange={(e) => ubahAreaHotspot(index, bidang, e.target.value)}
                        placeholder={bidang}
                      />
                    ))}
                    <label className="label-kunci" htmlFor={`kunci-area-${satu.id}`}>
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`kunci-area-${satu.id}`}
                        checked={state.benarHotspot.includes(satu.id)}
                        onChange={(e) => tohAreaBenar(satu.id, e.target.checked)}
                      />
                      Kunci
                    </label>
                    <TombolIkon
                      label={`Hapus area ${satu.id}`}
                      ikon={IkonTongSampah}
                      className="editor-hapus"
                      disabled={state.areaHotspot.length <= 1}
                      onClick={() => hapusAreaHotspot(index)}
                    />
                  </div>
                ))}

                <Tombol
                  varian="tepi"
                  ukuran="sedang"
                  ikon={IkonTambah}
                  disabled={state.areaHotspot.length >= MAKS_AREA_HOTSPOT}
                  onClick={tambahAreaHotspot}
                >
                  Tambah area
                </Tombol>
              </fieldset>
            )}

            {state.tipe === TIPE.bacaJam && (
              <fieldset className="mt-2">
                <legend className="fw-bold fs-6">Waktu yang benar</legend>
                <div className="row g-2">
                  <div className="col-sm-6">
                    <div className="bidang">
                      <label className="form-label" htmlFor="baca-jam-jam-kunci">Jam (0–11)</label>
                      <input
                        id="baca-jam-jam-kunci"
                        className="form-control"
                        type="number"
                        min={0}
                        max={11}
                        value={state.jamJam}
                        onChange={(e) => ubah({ jamJam: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="col-sm-6">
                    <div className="bidang">
                      <label className="form-label" htmlFor="baca-jam-menit-kunci">Menit (0–59)</label>
                      <input
                        id="baca-jam-menit-kunci"
                        className="form-control"
                        type="number"
                        min={0}
                        max={59}
                        value={state.jamMenit}
                        onChange={(e) => ubah({ jamMenit: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </fieldset>
            )}

            {state.tipe === TIPE.tugasUnggah && (
              <fieldset className="mt-2">
                <legend className="fw-bold fs-6">Berkas dan rubrik penilaian</legend>

                {/*
                  Jenis berkas dipilih dari daftar yang benar-benar dikenali
                  aplikasi (14 Oktober 2026, permintaan pemilik produk: "jangan
                  buat manual diketik, buat opsi banyak"). Dulu guru mengetik
                  teks bebas, sehingga jenis berkas yang ditulis bisa tidak
                  pernah cocok dengan yang bisa diunggah murid.
                */}
                <fieldset className="bidang">
                  <legend className="form-label">Jenis berkas yang boleh diunggah</legend>
                  <p className="teks-lembut small">
                    Pilih dari daftar — tidak ada yang perlu diketik. Pilih “Semua jenis berkas”
                    kalau tugasnya bebas.
                  </p>

                  <div className="pilihan-jenis-berkas">
                    {JENIS_BERKAS_TUGAS.map((satu) => (
                      <label key={satu.nilai} className="form-check" htmlFor={`tugas-jenis-${satu.nilai}`}>
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`tugas-jenis-${satu.nilai}`}
                          checked={jenisBerkasTerpilih.includes(satu.nilai)}
                          onChange={() =>
                            ubah({
                              jenisBerkas: teksJenisBerkas(
                                centangJenisBerkas(jenisBerkasTerpilih, satu.nilai),
                              ),
                            })
                          }
                        />
                        <span className="form-check-label">{satu.label}</span>
                      </label>
                    ))}
                  </div>

                  {jenisBerkasTerpilih.length === 0 && state.jenisBerkas.trim() !== '' && (
                    <p className="baris-opsi-catatan small mt-2 mb-0" role="status">
                      Soal ini dulu menyebut “{state.jenisBerkas.trim()}”. Pilih ulang jenis
                      berkasnya di atas supaya murid membaca aturan yang sama.
                    </p>
                  )}

                  {state.jenisBerkas.trim() !== '' && (
                    <p className="teks-lembut small mb-0 mt-2">
                      Murid membaca: <strong>{state.jenisBerkas}</strong>
                    </p>
                  )}
                </fieldset>

                {state.rubrik.map((satu, index) => (
                  <div key={`rubrik-${index}`} className="d-flex flex-wrap align-items-center gap-2 mb-1">
                    <input
                      className="form-control flex-grow-1"
                      aria-label={`Butir rubrik ${index + 1}`}
                      value={satu.butir}
                      onChange={(e) => ubahRubrik(index, 'butir', e.target.value)}
                      placeholder="Contoh: langkah pengerjaan lengkap"
                    />
                    <input
                      className="form-control form-control-sm rubrik-poin"
                      type="number"
                      min={1}
                      step={1}
                      aria-label={`Poin rubrik ${index + 1}`}
                      value={satu.poin}
                      onChange={(e) => ubahRubrik(index, 'poin', e.target.value)}
                    />
                    <TombolIkon
                      label={`Hapus butir rubrik ${index + 1}`}
                      ikon={IkonTongSampah}
                      className="editor-hapus"
                      disabled={state.rubrik.length <= 1}
                      onClick={() => hapusRubrik(index)}
                    />
                  </div>
                ))}

                <Tombol
                  varian="tepi"
                  ukuran="sedang"
                  ikon={IkonTambah}
                  disabled={state.rubrik.length >= MAKS_BUTIR_RUBRIK}
                  onClick={tambahRubrik}
                >
                  Tambah butir rubrik
                </Tombol>
              </fieldset>
            )}

            {/*
              Grid teka silang digambar sebagai kotak-kotak yang bisa diketik
              (14 Oktober 2026). Sebelumnya guru menulis grid sebagai teks
              ('kucing\n#n#i#t') sehingga bentuk teka silangnya hanya terlihat
              setelah disimpan.
            */}
            {state.tipe === TIPE.tekaSilangMini && (
              <fieldset className="mt-2">
                <legend className="fw-bold fs-6">
                  Grid teka silang
                  <span className="teks-lembut fw-normal">
                    {' '}
                    (maksimal {MAKS_SISI_SILANG} × {MAKS_SISI_SILANG})
                  </span>
                </legend>

                <p className="teks-lembut small">
                  Ketik huruf jawaban pada kotak yang diisi murid. Tekan tombol ■ di kotak untuk
                  menjadikannya kotak hitam penyekat, dan tekan ■ pada kotak hitam untuk
                  mengembalikannya jadi kotak huruf.
                </p>

                <div className="d-flex flex-wrap gap-2 mb-2">
                  <Tombol varian="tepi" ukuran="sedang" ikon={IkonTambah} onClick={tambahBarisGridSilang}>
                    Tambah baris
                  </Tombol>
                  <Tombol varian="tepi" ukuran="sedang" ikon={IkonTambah} onClick={tambahKolomGridSilang}>
                    Tambah kolom
                  </Tombol>
                </div>

                {pesanSilang !== '' && <p className="status-salah small mb-2">{pesanSilang}</p>}

                <div className="silang-editor-bungkus">
                  <table className="silang-editor">
                    <tbody>
                      {kotakSilang().map((baris, r) => (
                        <tr key={`baris-silang-${r}`}>
                          <th scope="row" className="silang-editor-nomor">
                            <span className="editor-grid-nomor">{r + 1}</span>
                            <TombolIkon
                              className="editor-hapus"
                              label={`Hapus baris ${r + 1}`}
                              ikon={IkonTongSampah}
                              onClick={() => hapusBarisGridSilang(r)}
                            />
                          </th>
                          {baris.map((isi, c) =>
                            isi === '#' ? (
                              <td key={`kotak-${r}-${c}`} className="silang-editor-sel hitam">
                                <button
                                  type="button"
                                  className="silang-editor-hitam"
                                  aria-label={`Kotak hitam baris ${r + 1} kolom ${c + 1} — kembalikan jadi kotak huruf`}
                                  onClick={() => ubahKotakGridSilang(r, c, '.')}
                                >
                                  ■
                                </button>
                              </td>
                            ) : (
                              <td key={`kotak-${r}-${c}`} className="silang-editor-sel">
                                <input
                                  className="silang-editor-isian"
                                  type="text"
                                  maxLength={1}
                                  aria-label={`Huruf jawaban baris ${r + 1} kolom ${c + 1}`}
                                  value={isi === '.' ? '' : isi}
                                  onChange={(e) => ubahKotakGridSilang(r, c, isiKotakSilang(e.target.value))}
                                />
                                <button
                                  type="button"
                                  className="silang-editor-hitam"
                                  aria-label={`Jadikan kotak hitam baris ${r + 1} kolom ${c + 1}`}
                                  onClick={() => ubahKotakGridSilang(r, c, '#')}
                                >
                                  ■
                                </button>
                              </td>
                            ),
                          )}
                        </tr>
                      ))}
                    </tbody>
                    {kotakSilang().length > 0 && (
                      <tfoot>
                        <tr>
                          <td className="editor-grid-hapus-label">
                            <span className="teks-lembut small">Hapus kolom</span>
                          </td>
                          {kotakSilang()[0].map((_, kolom) => (
                            <td key={`hapus-kolom-${kolom}`} className="editor-grid-hapus-sel">
                              <TombolIkon
                                className="editor-hapus"
                                label={`Hapus kolom ${kolom + 1}`}
                                ikon={IkonTongSampah}
                                onClick={() => hapusKolomGridSilang(kolom)}
                              />
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {kotakSilang().length === 0 && (
                  <p className="teks-lembut small">
                    Grid masih kosong — tekan “Tambah baris” untuk mulai menggambar teka silang.
                  </p>
                )}
              </fieldset>
            )}

            {state.tipe === TIPE.tekaSilangMini &&
              arahSilang.map((arah) => (
                <fieldset key={arah} className="mt-3">
                  <legend className="fw-bold fs-6">
                    Petunjuk {arah === 'mendatar' ? 'mendatar' : 'menurun'} (maksimal{' '}
                    {MAKS_PETUNJUK_SILANG})
                  </legend>

                  {state.petunjukSilang.map((satu, index) =>
                    satu.arah === arah ? (
                      <div key={`${arah}-${index}`} className="d-flex flex-wrap align-items-center gap-2 mb-1">
                        <input
                          className="form-control form-control-sm silang-nomor-input"
                          type="number"
                          min={1}
                          aria-label={`Nomor petunjuk ${arah} ${index + 1}`}
                          value={satu.nomor}
                          onChange={(e) => ubahPetunjukSilang(index, 'nomor', e.target.value)}
                        />
                        <input
                          className="form-control flex-grow-1"
                          aria-label={`Teks petunjuk ${arah} ${index + 1}`}
                          value={satu.teks}
                          onChange={(e) => ubahPetunjukSilang(index, 'teks', e.target.value)}
                          placeholder="Contoh: nama hewan mengeong"
                        />
                        <input
                          className="form-control form-control-sm silang-sel-input"
                          aria-label={`Sel awal petunjuk ${arah} ${index + 1}`}
                          value={satu.mulai}
                          onChange={(e) => ubahPetunjukSilang(index, 'mulai', e.target.value)}
                          placeholder="0,0"
                        />
                        <input
                          className="form-control form-control-sm silang-panjang-input"
                          type="number"
                          min={MIN_HURUF_SILANG}
                          aria-label={`Panjang petunjuk ${arah} ${index + 1}`}
                          value={satu.panjang}
                          onChange={(e) => ubahPetunjukSilang(index, 'panjang', e.target.value)}
                        />
                        <span className="teks-lembut small">
                          {selDariPetunjuk(satu.mulai, satu.panjang, arah).join(' → ')}
                        </span>
                        <TombolIkon
                          label={`Hapus petunjuk ${arah} ${index + 1}`}
                          ikon={IkonTongSampah}
                          className="editor-hapus"
                          onClick={() => hapusPetunjukSilang(index)}
                        />
                      </div>
                    ) : null,
                  )}

                  <Tombol
                    varian="tepi"
                    ukuran="sedang"
                    ikon={IkonTambah}
                    disabled={
                      state.petunjukSilang.filter((satu) => satu.arah === arah).length >=
                      MAKS_PETUNJUK_SILANG
                    }
                    onClick={() => tambahPetunjukSilang(arah)}
                  >
                    Tambah petunjuk {arah}
                  </Tombol>
                </fieldset>
              ))}
            {/*
              Kesimpulan kunci diletakkan di BAWAH soal (12 Oktober 2026): guru
              melihat satu kalimat "jawaban benar" untuk seluruh soal, tidak
              hanya tersebar di radio tiap opsi/barisnya.
            */}
            <div className="ringkas-kunci-soal mt-3" role="status">
              <span className="teks-lembut small d-block">Kunci jawaban soal ini</span>
              <strong>{ringkasKunci(muatan.kunci)}</strong>
              {(state.tipe === TIPE.pilihanGanda || state.tipe === TIPE.pilihanGandaKompleks) && (
                <span className="teks-lembut small d-block mt-1">
                  Tandai jawaban benar lewat lingkaran di kiri tiap pilihan — ringkasan di atas ikut
                  berubah.
                </span>
              )}
            </div>
          </section>

          <section className="kartu-soft p-3" aria-labelledby="soal-judul-3">
            <h2 id="soal-judul-3" className="judul-bagian">3. Pengaturan soal</h2>

            <div className="row g-3">
              <div className="col-sm-6">
                <div className="bidang">
                  <label className="form-label" htmlFor="soal-mapel">Mapel</label>
                  <div className="d-flex gap-2">
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
                    {/* Mapel baru dibuat di sini juga: tanpa ini, sekolah yang belum
                     * punya mapel terkunci dari menyimpan soal sama sekali. */}
                    <Tombol
                      varian="tepi"
                      ukuran="sedang"
                      onClick={() => setMapelBaruTampil((sebelum) => !sebelum)}
                    >
                      {mapelBaruTampil ? 'Tutup' : 'Mapel baru'}
                    </Tombol>
                  </div>

                  {daftarMapel.length === 0 && !mapelBaruTampil && (
                    <p className="teks-lembut small mb-0 mt-1">
                      Belum ada mapel di sekolah ini — tambahkan lewat tombol “Mapel baru”.
                    </p>
                  )}

                  {mapelBaruTampil && (
                    <div className="mapel-baru mt-2">
                      <p className="teks-lembut small mb-2">
                        {daftarMapel.length === 0
                          ? 'Belum ada mapel di sekolah ini. Buat satu di sini — mapelnya langsung dipakai soal ini.'
                          : 'Mapel yang dibuat di sini langsung dipakai soal ini.'}
                      </p>
                      <div className="row g-2">
                        <div className="col-8">
                          <input
                            id="mapel-baru-nama"
                            className="form-control form-control-sm"
                            placeholder="Nama mapel, mis. Matematika"
                            aria-label="Nama mapel baru"
                            value={namaMapelBaru}
                            onChange={(e) => setNamaMapelBaru(e.target.value)}
                          />
                        </div>
                        <div className="col-4">
                          <input
                            id="mapel-baru-kode"
                            className="form-control form-control-sm"
                            placeholder="Kode (opsional)"
                            aria-label="Kode mapel baru"
                            value={kodeMapelBaru}
                            onChange={(e) => setKodeMapelBaru(e.target.value)}
                          />
                        </div>
                      </div>
                      {galatMapelBaru !== '' && (
                        <p className="status-salah small mb-0 mt-1">{galatMapelBaru}</p>
                      )}
                      <div className="d-flex flex-wrap gap-2 mt-2">
                        <Tombol
                          ukuran="sedang"
                          memuat={tambahMapel.isPending}
                          disabled={namaMapelBaru.trim().length < 2}
                          onClick={() => tambahMapel.mutate()}
                        >
                          Simpan mapel
                        </Tombol>
                        <Tombol
                          varian="tepi"
                          ukuran="sedang"
                          onClick={() => {
                            setMapelBaruTampil(false)
                            setGalatMapelBaru('')
                          }}
                        >
                          Batal
                        </Tombol>
                      </div>
                    </div>
                  )}
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

            {/*
              Teknik koreksi (14 Oktober 2026): guru memilih cara soal ini dinilai.
              Pilihannya mengikuti jenis soal — lihat sections/question/teknikKoreksi.js
              — dan hasilnya ikut ke `kunci`, jadi tidak pernah sampai ke perangkat murid.
            */}
            <fieldset className="mt-3" data-teknik={teknikKoreksiDariState(state)}>
              <legend className="form-label mb-1">Teknik koreksi</legend>
              <p className="teks-lembut small mb-2">
                Cara jawaban murid dinilai. {teknikTerkunci(state.tipe)
                  ? 'Jenis soal ini hanya bisa dinilai manual.'
                  : 'Pilihan yang tersedia mengikuti jenis soal yang kamu pilih.'}
              </p>

              {pilihanTeknikKoreksi(state.tipe).map((satu) => (
                <div className="form-check mb-2" key={satu.nilai}>
                  <input
                    className="form-check-input"
                    type="radio"
                    name="teknik-koreksi"
                    id={`teknik-${satu.nilai}`}
                    value={satu.nilai}
                    checked={teknikKoreksiDariState(state) === satu.nilai}
                    disabled={terkunci || teknikTerkunci(state.tipe)}
                    onChange={() => ubah({ teknikKoreksi: satu.nilai })}
                  />
                  <label className="form-check-label" htmlFor={`teknik-${satu.nilai}`}>
                    <strong>{satu.label}</strong>
                    {satu.bawaan && <span className="badge-status lembut ms-2">bawaan</span>}
                    <span className="teks-lembut small d-block">{satu.keterangan}</span>
                  </label>
                </div>
              ))}

              {terkunci && (
                <p className="teks-lembut small mb-0">
                  Teknik koreksi terkunci selama kuis berjalan (sepakat dengan kunci jawaban dan skor).
                </p>
              )}
            </fieldset>

            <div className="form-check form-switch mt-3">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                id="soal-aktif"
                checked={state.aktif}
                disabled={terkunci}
                onChange={(e) => ubah({ aktif: e.target.checked })}
              />
              <label className="form-check-label" htmlFor="soal-aktif">
                Soal aktif (soal nonaktif tidak bisa diterbitkan di dalam kuis)
                {terkunci && (
                  <span className="teks-lembut">
                    {' '}
                    — tidak bisa dinonaktifkan saat kuis berjalan, karena jawaban murid yang
                    sedang mengerjakan akan ikut hilang.
                  </span>
                )}
              </label>
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
        <div className="d-flex flex-column gap-3">
          <section className="kartu-soft p-3" aria-labelledby="soal-pratinjau">
            <h2 id="soal-pratinjau" className="judul-kecil mb-2">Pratinjau</h2>

            <RendererSoal
              tipe={state.tipe}
              konten={muatan.konten}
              kunci={muatan.kunci}
              nama={`pratinjau-${state.tipe}`}
              tampilkanKunci
            />
          </section>

          <section className="kartu-soft p-3" aria-labelledby="soal-kelengkapan">
            <h2 id="soal-kelengkapan" className="judul-kecil">Kelengkapan</h2>

            <ul className="list-unstyled d-flex flex-column gap-2 mb-3">
              {kelengkapan.map((satu) => {
                // Butir yang belum lengkap bisa diketuk untuk melompat ke
                // kolomnya (temuan P4) — daftar ini tadinya cuma bacaan, jadi
                // guru harus mencari sendiri di mana yang kurang.
                const tujuan = satu.ok ? null : idBidangKelengkapan(satu.teks)

                return (
                  <li key={satu.teks} className="d-flex align-items-center gap-2">
                    <span className={`badge-status ${satu.ok ? 'sukses' : 'peringatan'}`}>
                      {satu.ok ? 'Lengkap' : 'Belum'}
                    </span>
                    {tujuan === null ? (
                      <span className="small">{satu.teks}</span>
                    ) : (
                      <Tombol
                        varian="teks"
                        className="p-0 text-start"
                        data-lompat-kelengkapan={tujuan}
                        onClick={() => {
                          const simpul = document.getElementById(tujuan)
                          if (simpul && typeof simpul.scrollIntoView === 'function') {
                            simpul.scrollIntoView({ block: 'center' })
                          }
                          if (simpul && typeof simpul.focus === 'function') {
                            simpul.focus({ preventScroll: true })
                          }
                        }}
                      >
                        <span className="small">{satu.teks} · perbaiki</span>
                      </Tombol>
                    )}
                  </li>
                )
              })}
            </ul>

            {soal === null && (
              /* Menyusun satu bab berisi belasan soal: setelah tersimpan, guru
               * sering langsung menulis soal berikutnya dengan jenis & mapel yang
               * sama. Centang ini melewati pemilihan ulang itu. */
              <div className="form-check form-switch mb-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="soal-lanjut-serupa"
                  checked={lanjutSerupa}
                  onChange={(e) => setLanjutSerupa(e.target.checked)}
                />
                <label className="form-check-label small" htmlFor="soal-lanjut-serupa">
                  Setelah tersimpan, langsung buat soal berikutnya dengan jenis &amp; mapel yang sama
                </label>
              </div>
            )}

            <div className="d-flex flex-wrap gap-2">
              <Tombol
                memuat={sedangMenyimpan}
                teksMemuat="Menyimpan…"
                onClick={kirim}
              >
                {soal === null ? (lanjutSerupa ? 'Simpan & lanjut' : 'Simpan soal') : 'Perbarui soal'}
              </Tombol>
              <Tombol
                varian="tepi"
                onClick={() => (kotor ? setDialogKeluar(true) : onBatal())}
              >
                Batal
              </Tombol>
            </div>

            {!siap && (
              <p className="teks-lembut small mt-2 mb-0">
                Tombol Simpan tetap bisa ditekan: kalau ada yang kurang, editor menggulir ke kolomnya
                dan menyebut sebabnya.
              </p>
            )}
          </section>
        </div>
      </aside>

      {/* Penjaga "belum tersimpan" (temuan K3): keluar dengan perubahan yang
       * belum disimpan selalu lewat konfirmasi, bukan langsung dibuang. */}
      <DialogKonfirmasi
        buka={dialogKeluar}
        judul={JUDUL_BELUM_TERSIMPAN}
        labelYa="Buang perubahan"
        bahaya
        onYa={() => {
          setDialogKeluar(false)
          onBatal()
        }}
        onBatal={() => setDialogKeluar(false)}
      >
        <p className="mb-0">{PESAN_BELUM_TERSIMPAN}</p>
      </DialogKonfirmasi>
    </div>
  )
}

/**
 * Kolom yang dituju satu butir kelengkapan (temuan P4).
 *
 * Hanya butir yang kolomnya punya id di editor yang bisa diketuk; sisanya
 * (mis. kelengkapan grid teka silang) tetap tampil sebagai teks — lebih baik
 * tidak bisa diketuk daripada menggulir ke tempat yang salah.
 *
 * @param {string} teks
 * @returns {string|null}
 */
function idBidangKelengkapan(teks) {
  if (teks === 'Mapel dipilih') return 'soal-mapel'
  if (teks === 'Isi soal terisi') return 'soal-teks'
  if (teks === 'Skor angka 1 sampai 100') return 'soal-skor'
  if (teks.startsWith('Template MathML')) return 'soal-matematika'

  return null
}
