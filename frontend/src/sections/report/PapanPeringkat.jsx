/**
 * Papan peringkat satu kuis (slice 05; aturan 14 Oktober 2026) — dipakai DUA
 * tempat dengan sumber yang sama:
 *
 * 1. halaman peringkat (`HalamanPeringkat.jsx`) untuk guru dan murid;
 * 2. panel "Papan peringkat" di perangkat murid (`presence/PanelPeringkatMurid.jsx`),
 *    yang tampil saat guru menyiarkannya lewat layar kelas.
 *
 * Karena komponennya satu, papan di HP murid tidak bisa "menjadi lebih terbuka"
 * daripada papan di halaman peringkatnya: nomor peringkat tetap hanya untuk N%
 * teratas dan jejak bonus tetap hanya muncul di layar guru. Yang membedakan
 * hanyalah `proyektor` (huruf besar untuk menghadap kelas) dan `ringkas`
 * (judul lebih kecil karena panel ditempel di layar ulangan).
 *
 * Kolom catatan bonus HANYA untuk guru, dan tertutup lagi begitu guru menyalakan
 * mode proyektor: di sinilah jejak bonus terbaca (siapa yang dibantu, berapa
 * tambahannya, berapa nilai dan peringkat aslinya).
 */
import Banner from '../../shared/ui/Banner.jsx'
import TabelData from '../../shared/ui/TabelData.jsx'
import { angkaRapi, angkaTampil, barisMilikSaya, catatanBonusBaris, ringkasAturanPapan } from './tampilan.js'

/**
 * @typedef {object} PropsPapan
 * @property {import('./api.js').DataPeringkat} data respons server (aturan keterbukaan sudah ikut)
 * @property {boolean} guru `data.guru` dari server, bukan dugaan dari peran di peramban
 * @property {boolean} [proyektor] mode huruf besar untuk papan tulis
 * @property {boolean} [ringkas] judul kecil — dipakai panel di perangkat murid
 * @property {import('react').ReactNode} [aksi] slot tombol di kanan judul (mis. mode proyektor)
 */

/**
 * @param {PropsPapan} props
 */
export default function PapanPeringkat({ data, guru, proyektor = false, ringkas = false, aksi = null }) {
  const aturan = ringkasAturanPapan(data)
  const detailSaya = data.detail_saya
  const sapaan = data.mode_tim ? 'Timmu' : 'Kamu'
  const judulTeks = (
    <>
      {data.mode_tim ? 'Peringkat tim · ' : 'Peringkat · '}
      {data.judul_kuis}
    </>
  )

  /** @type {import('../../shared/ui/TabelData.jsx').KolomTabel[]} */
  const kolom = [
    {
      kunci: 'peringkat',
      judul: '#',
      sel: (baris) => (
        <strong className={proyektor ? 'display-6 fw-bold' : undefined}>
          {baris.peringkat}
        </strong>
      ),
    },
    {
      kunci: 'nama',
      judul: data.mode_tim ? 'Tim' : 'Nama',
      sel: (baris) => {
        const milikku = barisMilikSaya(baris, data.peringkat_saya, data.mode_tim)
        return (
          <span className={proyektor ? 'fs-3 fw-semibold' : undefined}>
            {baris.nama}
            {data.mode_tim && <span className="badge-status lembut ms-2">tim</span>}
            {milikku && <span className="small ms-2">(kamu)</span>}
            {!proyektor && baris.anggota.length > 0 && (
              <div className="teks-lembut small">{baris.anggota.join(', ')}</div>
            )}
          </span>
        )
      },
    },
    {
      kunci: 'skor',
      judul: 'Skor',
      kelas: proyektor ? 'text-end fs-3' : 'text-end',
      // Selalu angka TAMPILAN, bukan nilai asli: papan guru dan papan murid
      // harus memperlihatkan angka yang sama.
      sel: (baris) => {
        const angka = angkaTampil(baris)
        return `${angkaRapi(angka.nilai)} / ${angkaRapi(angka.maksimal)} (${angkaRapi(angka.persen)}%)`
      },
    },
    {
      kunci: 'benar',
      judul: 'Benar',
      kelas: proyektor ? 'text-end fs-3' : 'text-end',
      sel: (baris) => `${baris.jumlah_benar} / ${baris.jumlah_soal}`,
    },
  ]

  if (guru && !proyektor) {
    kolom.push({
      kunci: 'catatan',
      judul: 'Catatan guru',
      sel: (baris) => {
        const catatan = catatanBonusBaris(baris)
        if (catatan === null) return <span className="teks-lembut small">—</span>

        return (
          <span className="small">
            <span className="badge-status peringatan me-2">dibantu</span>
            {catatan.teks}
            {catatan.peringkatAsli !== null && (
              <span className="teks-lembut"> · peringkat asli #{catatan.peringkatAsli}</span>
            )}
          </span>
        )
      },
    })
  }

  return (
    <>
      <div className="d-flex flex-wrap align-items-start gap-2">
        <div className="me-auto">
          {ringkas ? (
            <h2 className="h6 fw-bold mb-1">{judulTeks}</h2>
          ) : (
            <h1 className={proyektor ? 'display-6 fw-bold mb-1' : 'h5 fw-bold mb-1'}>{judulTeks}</h1>
          )}
          {!proyektor && (
            <p className="teks-lembut small mb-0">
              Dihitung dari <strong>nilai asli</strong> (percobaan pertama). Bila nilainya sama, yang
              lebih cepat mengumpulkan naik; bila masih sama, urut nama.
            </p>
          )}
        </div>

        {aksi}
      </div>

      {!proyektor && (
        <p className="teks-lembut small mt-2 mb-3">{aturan.catatanKeterbukaan}</p>
      )}

      {!data.tampil && (
        <Banner jenis="info" judul="Ranking sedang dimatikan guru">
          <p className="mb-0">
            {guru
              ? 'Murid tidak melihat peringkat sampai saklar ranking dinyalakan di pengaturan. Papan di bawah ini hanya untukmu.'
              : 'Gurumu mematikan tampilan peringkat untuk kelas ini.'}
          </p>
        </Banner>
      )}

      {aturan.bonusAktif && guru && aturan.catatanBonus !== null && !proyektor && (
        <p className="teks-lembut small mb-3">
          {aturan.catatanBonus} Tanda itu tidak ikut tampil di mode proyektor — papan yang
          diproyeksikan sama persis dengan yang dilihat murid.
        </p>
      )}

      {data.tampil && data.mode_tim && !proyektor && (
        <p className="teks-lembut small mb-0">
          Kuis ini mode tim: satu nilai untuk satu tim, jadi yang diperingkat adalah timnya.
        </p>
      )}

      {data.tampil && data.total === 0 && (
        <p className="text-body-secondary">
          {data.mode_tim
            ? 'Belum ada tim yang mengumpulkan ulangan ini.'
            : 'Belum ada murid yang mengumpulkan ulangan ini.'}
        </p>
      )}

      {data.peringkat.length > 0 && (
        <TabelData
          label="Peringkat ulangan"
          baris={data.peringkat}
          kunciBaris={(baris) => baris.attempt_id}
          // Baris milik murid sendiri tetap disorot seperti sebelumnya.
          // Baris berbantuan ditandai HANYA di layar kerja guru — di mode
          // proyektor papan itu dilihat seisi kelas, jadi jejaknya dibuang.
          kelasBaris={(baris) =>
            barisMilikSaya(baris, data.peringkat_saya, data.mode_tim)
              ? 'sorot-hangat'
              : guru && !proyektor && catatanBonusBaris(baris) !== null
                ? 'peringkat-dibantu'
                : undefined
          }
          kolom={kolom}
        />
      )}

      {data.tampil && data.total > 0 && !guru && detailSaya === null && (
        <p className="teks-lembut small">
          {sapaan} belum mengumpulkan ulangan ini, jadi belum masuk peringkat.
        </p>
      )}

      {data.tampil && !guru && detailSaya !== null && detailSaya.di_luar_terbuka && (
        <div className="border-top pt-3 mt-4">
          <h2 className="h6 fw-bold mb-1">
            {data.mode_tim ? 'Nomor peringkat timmu belum dibuka' : 'Nomor peringkatmu belum dibuka'}
          </h2>
          <p className="teks-lembut small mb-2">
            Nomor peringkat dibuka untuk {aturan.terbukaJumlah}{' '}
            {data.mode_tim ? 'tim teratas' : 'murid teratas'} dari {data.total} peserta. Gurumu tetap
            melihat seluruh papan, dan {data.mode_tim ? 'nilai timmu' : 'nilaimu'} tetap tercatat.
          </p>
          <p className="mb-0">
            {data.mode_tim ? 'Skor timmu:' : 'Skormu:'}{' '}
            <strong>
              {angkaRapi(angkaTampil(detailSaya).nilai)} / {angkaRapi(angkaTampil(detailSaya).maksimal)} (
              {angkaRapi(angkaTampil(detailSaya).persen)}%)
            </strong>
          </p>
        </div>
      )}

      {data.tampil && !guru && detailSaya !== null && !detailSaya.di_luar_terbuka && detailSaya.peringkat !== null && (
        <p className="teks-lembut small mb-0">
          {sapaan} di peringkat <strong>{detailSaya.peringkat}</strong> dari {data.total} peserta.
        </p>
      )}

      {guru && data.total > data.peringkat.length && (
        <p className="teks-lembut small mb-0">
          Menampilkan {data.peringkat.length} peringkat teratas dari {data.total} peserta.
        </p>
      )}
    </>
  )
}
