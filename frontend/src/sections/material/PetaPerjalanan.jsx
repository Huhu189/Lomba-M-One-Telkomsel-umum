/**
 * Peta perjalanan materi (layar murid + pratinjau editor).
 *
 * Latar panggung mengikuti prioritas: video yang diunggah guru bila ada →
 * adegan yang **digambar sendiri** (ilustrasi SVG beranimasi, mis. puncak gunung
 * dilihat dari bawah — lihat `AdeganGunung.jsx`) → foto tema berlisensi bebas
 * (lihat `frontend/public/tema/LISENSI.md`). Bila tidak ada yang bisa dipakai,
 * panggung tampil sebagai latar **gradien** tenang, jadi tidak pernah kosong.
 *
 * Catatan keputusan: dulu peta sengaja tidak pernah menggambar adegan sendiri
 * dan hanya memakai media sungguhan. Itu diubah atas permintaan pemilik produk:
 * adegan `gunung` kini ilustrasi beranimasi bersudut pandang mendongak, bukan
 * foto gunung sungguhan.
 *
 * Materi bertema "tanpa peta" tidak menggambar panggung sama sekali (lihat
 * `tanpaPeta`): yang tampil hanya bilah kemajuan dan daftar bagian, karena
 * memang tidak ada pos maupun tingkat yang bisa ditunjukkan.
 *
 * Peta bukan satu-satunya cara membaca data: di bawahnya selalu ada daftar pos
 * dalam bentuk teks (selesai / sedang ditempuh / belum dibuka), sehingga murid
 * dengan pembaca layar atau layar sempit tetap mendapat informasi yang sama
 * persis — bukan versi ringkas yang bisa berbeda.
 */
import { useState } from 'react'
import AdeganGunung from './AdeganGunung.jsx'
import { labelPerjalanan, titikJalur, tanpaPeta } from './perjalanan.js'

/**
 * Foto latar tiap **adegan** tema. Berkasnya ada di `frontend/public/tema/`
 * (lisensi bebas — lihat `LISENSI.md` di folder itu).
 *
 * Sengaja kosong sekarang: adegan `gunung` sudah digambar sendiri (lihat
 * `ADEGAN_DIGAMBAR`), jadi tidak ada lagi gambar pihak lain di repo. Jalur ini
 * tetap ada untuk tema berikutnya yang memang memakai foto.
 *
 * @type {Record<string, string>}
 */
export const FOTO_ADEgan = {}

/**
 * Nama adegan yang **digambar sendiri** (ilustrasi SVG beranimasi). Dipakai
 * sebelum foto: tidak bergantung pada berkas luar dan tetap tajam di semua
 * ukuran.
 *
 * Adegannya ditulis sebagai JSX tetap di bawah, bukan komponen dari variabel —
 * aturan `react-hooks/static-components` menuntut identitas komponen yang stabil
 * antar-render.
 *
 * @type {readonly string[]}
 */
export const ADEGAN_DIGAMBAR = ['gunung']

/**
 * Foto latar untuk satu nama adegan, atau `null` bila tidak ada.
 * @param {string|undefined|null} adegan
 * @returns {string|null}
 */
export function fotoAdegan(adegan) {
  return (adegan && FOTO_ADEgan[adegan]) || null
}

/**
 * Apakah satu nama adegan punya ilustrasi yang digambar sendiri.
 * @param {string|undefined|null} adegan
 * @returns {boolean}
 */
export function adeganDigambar(adegan) {
  return typeof adegan === 'string' && ADEGAN_DIGAMBAR.includes(adegan)
}

/** Label singkat status pos untuk teks (bukan hanya warna). */
const LABEL_STATUS = {
  selesai: 'sudah dilewati',
  dibuka: 'sedang ditempuh',
  belum: 'belum dibuka',
}

/**
 * Ikon kecil tiap jenis pos. Semuanya dekoratif — teksnya selalu ada di daftar.
 * @param {{ ikon: string }} props
 */
function IkonPos({ ikon }) {
  const isi = {
    tenda: <path d="M6 1 11 11H1zM6 5 4.2 11h3.6z" />,
    pohon: <path d="M6 0.5 9.2 6H2.8zM6 4.5 10.4 10H1.6zM5.4 10h1.2v1.6H5.4z" />,
    sungai: <path d="M0.8 3.4c2-2 3.6-2 5.4 0s3.4 2 5 0v1.8c-1.6 2-3.4 2-5.2 0s-3.2-2-5.2 0zM0.8 7.2c2-2 3.6-2 5.4 0s3.4 2 5 0v1.8c-1.6 2-3.4 2-5.2 0s-3.2-2-5.2 0z" />,
    batu: <path d="M1.4 10.4 3.4 3.6l4.2-1.8 3.2 4-2.4 4.6z" />,
    kabut: <path d="M1 3.6h10v1.4H1zM2.6 6.2h8.8v1.4H2.6zM0.6 8.8h9.6v1.4H0.6z" />,
    bendera: <path d="M3 1h1.4v10H3zM4.4 1.6h6l-2 2 2 2h-6z" />,
  }[ikon]

  return (
    <svg className="jelajah-pos-ikon" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      {isi ?? <circle cx="6" cy="6" r="3.2" />}
    </svg>
  )
}

/**
 * Daftar pos sebagai teks: statusnya selalu tertulis, bukan hanya warna.
 * Dipakai peta bertema maupun daftar bagian materi tanpa peta.
 *
 * @param {{ langkah: import('./perjalanan.js').DataLangkah[], posisi: number }} props
 */
function DaftarLangkah({ langkah, posisi }) {
  return (
    <ol className="jelajah-daftar list-unstyled mb-0">
      {langkah.map((satu) => {
        const status = satu.selesai ? 'selesai' : satu.nomor === posisi ? 'dibuka' : 'belum'

        return (
          <li key={satu.nomor} className="jelajah-daftar-baris" data-status={status}>
            <span className="jelajah-daftar-nomor">{satu.nomor}</span>
            <span className="flex-grow-1">
              {satu.nama}
              {satu.wajib ? '' : ' (opsional)'}
            </span>
            <span className="small teks-lembut">{LABEL_STATUS[status]}</span>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Materi tanpa peta: tidak ada pos, tingkat, atau adegan — yang tampil hanya
 * kemajuan bagian wajib dan daftar bagiannya.
 *
 * @param {{
 *   perjalanan: import('./perjalanan.js').DataPerjalanan,
 *   ringkas?: boolean,
 *   judul?: string,
 * }} props
 */
function TanpaPeta({ perjalanan, ringkas = false, judul }) {
  return (
    <section className="jelajah" data-adegan="polos" data-tanpa="true">
      <header className="jelajah-kepala">
        <div>
          <p className="jelajah-label mb-0">Bagian materi</p>
          <h3 className="jelajah-nama h6 fw-bold mb-0">{judul ?? 'Tanpa peta perjalanan'}</h3>
        </div>
      </header>

      <p className="jelajah-ringkas small mb-1">
        {perjalanan.selesai}/{perjalanan.total} {perjalanan.satuan} wajib selesai ·{' '}
        {perjalanan.persen}%
      </p>
      <div className="progress jelajah-bilah" role="progressbar" aria-valuenow={perjalanan.persen}>
        <div className="progress-bar" style={{ width: `${perjalanan.persen}%` }} />
      </div>

      {!ringkas && <DaftarLangkah langkah={perjalanan.langkah} posisi={perjalanan.posisi} />}
    </section>
  )
}

/**
 * @param {{
 *   perjalanan: import('./perjalanan.js').DataPerjalanan,
 *   ringkas?: boolean,
 *   judul?: string,
 * }} props
 */
export default function PetaPerjalanan({ perjalanan, ringkas = false, judul }) {
  // Foto bisa gagal dimuat (berkas dihapus, luring sebelum cache terisi); bila
  // itu terjadi latar gradien yang dipakai, bukan panggung kosong.
  const [fotoGagal, setFotoGagal] = useState(false)

  if (tanpaPeta(perjalanan)) {
    return <TanpaPeta perjalanan={perjalanan} ringkas={ringkas} judul={judul} />
  }

  const langkah = perjalanan.langkah
  const titik = titikJalur(langkah.length)
  const posAktif = langkah.find((satu) => satu.nomor === perjalanan.posisi)
  const tingkat = perjalanan.tingkat
  const video = perjalanan.video_url
  // Adegan yang digambar sendiri tidak pernah "gagal dimuat", jadi tidak perlu
  // menunggu `fotoGagal`; video guru tetap yang paling diprioritaskan.
  const adaGambar = !video && adeganDigambar(perjalanan.adegan)
  const foto = video || adaGambar || fotoGagal ? null : fotoAdegan(perjalanan.adegan)
  const latar = video ? 'video' : adaGambar ? 'ilustrasi' : foto !== null ? 'foto' : 'gradien'

  return (
    <section className="jelajah" data-adegan={perjalanan.adegan} data-latar={latar}>
      <header className="jelajah-kepala">
        <div>
          <p className="jelajah-label mb-0">Tema perjalanan</p>
          <h3 className="jelajah-nama h6 fw-bold mb-0">{judul ?? perjalanan.nama}</h3>
        </div>
        <p className="jelajah-tingkat mb-0">
          <span className="jelajah-lencana">Tingkat {tingkat.nomor}</span>
          <span className="small fw-semibold">{tingkat.nama}</span>
        </p>
      </header>

      <div
        className="jelajah-panggung"
        role="img"
        aria-label={`Peta perjalanan ${perjalanan.nama}. ${labelPerjalanan(perjalanan)}`}
      >
        {video ? (
          <video
            className="jelajah-video"
            src={video}
            muted
            loop
            autoPlay
            playsInline
            preload="metadata"
            aria-hidden="true"
            tabIndex={-1}
          />
        ) : adeganDigambar(perjalanan.adegan) ? (
          <AdeganGunung />
        ) : (
          foto !== null && (
            <img
              className="jelajah-foto"
              src={foto}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              onError={() => setFotoGagal(true)}
            />
          )
        )}

        {titik.length > 1 && (
          <svg
            className="jelajah-jalur"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            {/* Satu garis per ruas pos: ruas yang sudah dilewati digambar penuh,
                sisanya putus-putus. Lebih mudah dibaca daripada dash-offset. */}
            {titik.slice(1).map((satu, indeks) => (
              <line
                key={`ruas-${indeks}`}
                className="jelajah-ruas"
                data-status={langkah[indeks]?.selesai ? 'dilewati' : 'belum'}
                x1={titik[indeks].x}
                y1={titik[indeks].y}
                x2={satu.x}
                y2={satu.y}
              />
            ))}
          </svg>
        )}

        {langkah.map((satu, indeks) => (
          <span
            key={satu.nomor}
            className="jelajah-pos"
            data-warna={satu.warna}
            data-status={satu.selesai ? 'selesai' : satu.nomor === perjalanan.posisi ? 'dibuka' : 'belum'}
            data-jenis={satu.wajib ? 'wajib' : 'opsional'}
            style={{ left: `${titik[indeks]?.x ?? 50}%`, top: `${titik[indeks]?.y ?? 50}%` }}
          >
            <IkonPos ikon={satu.ikon} />
            <span className="jelajah-pos-nomor">{satu.nomor}</span>
          </span>
        ))}

        {posAktif && (
          <span
            className="jelajah-penanda"
            style={{
              left: `${titik[(posAktif.nomor ?? 1) - 1]?.x ?? 50}%`,
              top: `${titik[(posAktif.nomor ?? 1) - 1]?.y ?? 50}%`,
            }}
          >
            <span className="jelajah-penanda-orang" aria-hidden="true" />
            <span className="visually-hidden">Posisi kamu: {posAktif.nama}</span>
          </span>
        )}
      </div>

      <p className="jelajah-ringkas small mb-1">
        {labelPerjalanan(perjalanan)} · {perjalanan.selesai}/{perjalanan.total} {perjalanan.satuan} wajib
        selesai · {perjalanan.persen}%
      </p>
      <div className="progress jelajah-bilah" role="progressbar" aria-valuenow={perjalanan.persen}>
        <div className="progress-bar" style={{ width: `${perjalanan.persen}%` }} />
      </div>

      {perjalanan.tingkat_berikut && (
        <p className="jelajah-catatan small mb-0">
          {perjalanan.tingkat_berikut.sisa}% lagi untuk tingkat{' '}
          <strong>{perjalanan.tingkat_berikut.nama}</strong>.
        </p>
      )}
      {perjalanan.tuntas && (
        <p className="jelajah-catatan small mb-0">
          {perjalanan.total} {perjalanan.satuan} wajib sudah selesai — {perjalanan.nama} tuntas.
        </p>
      )}

      {!ringkas && <DaftarLangkah langkah={langkah} posisi={perjalanan.posisi} />}
    </section>
  )
}
