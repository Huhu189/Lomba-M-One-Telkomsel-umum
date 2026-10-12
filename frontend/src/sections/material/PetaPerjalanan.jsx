/**
 * Peta perjalanan materi (layar murid + pratinjau editor).
 *
 * Latar panggung mengikuti prioritas: video yang diunggah guru bila ada →
 * adegan yang **digambar sendiri** (ilustrasi SVG beranimasi, lihat
 * `AdeganGunung.jsx`) → **gambar tema** berlisensi bebas dari
 * `frontend/public/tema/` (lihat `LISENSI.md` di folder itu). Bila tidak ada
 * yang bisa dipakai, panggung tampil sebagai latar **gradien** tenang, jadi
 * tidak pernah kosong.
 *
 * Catatan keputusan (bolak-balik, sengaja dicatat): awalnya peta tidak pernah
 * menggambar adegan sendiri dan hanya memakai media sungguhan → lalu adegan
 * `gunung` digambar sendiri sebagai SVG beranimasi (A.43) → lalu, atas
 * permintaan pemilik produk, tema `gunung` memakai **berkas gambar bergaya
 * grafik** (bukan foto realis): `public/tema/gunung.svg`. Berkas itu semula
 * berkas unduhan domain publik (A.45), lalu **diganti karya proyek ini** (A.46)
 * karena berkas unduhannya tersusun dari baji bersisi tegak sehingga terbaca
 * seperti tebing — pagar bentuknya ada di
 * `__tests__/theme/gunungLatar.test.js`. Jalur gambar-sendiri **tidak dihapus** — ia tetap tersedia untuk tema
 * yang belum punya berkas, dan bisa dipakai lagi untuk `gunung` cukup dengan
 * mengembalikan namanya ke `ADEGAN_DIGAMBAR`.
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
 * Gambar latar tiap **adegan** tema. Berkasnya ada di `frontend/public/tema/`
 * (lisensi bebas — lihat `LISENSI.md` di folder itu).
 *
 * `gunung` memakai berkas **bergaya grafik** (gambar rata, bukan foto realis)
 * atas permintaan pemilik produk — sekarang karya proyek ini (CC0), lihat
 * `LISENSI.md`.
 *
 * `pulau` dan `angkasa` juga karya proyek ini. Yang perlu diingat untuk
 * `angkasa`: latarnya **gelap**, jadi jalur petanya dipakai versi terang lewat
 * aturan `.jelajah[data-adegan='angkasa']` di `theme.css` — jalur pekat yang
 * dipakai latar terang tenggelam di langit malam.
 *
 * @type {Record<string, string>}
 */
export const FOTO_ADEgan = {
  gunung: '/tema/gunung.svg',
  // "Pelayaran Harta Karun" dan "Menjelajah Luar Angkasa": karya proyek ini
  // (CC0) yang digambar di repo, bukan berkas unduhan — lihat LISENSI.md.
  pulau: '/tema/pulau.svg',
  angkasa: '/tema/angkasa.svg',
}

/**
 * Nama adegan yang **digambar sendiri** (ilustrasi SVG beranimasi). Dipakai
 * sebelum berkas gambar: tidak bergantung pada berkas luar dan tetap tajam di
 * semua ukuran.
 *
 * Sekarang **kosong**: tema `gunung` memakai `public/tema/gunung.svg` (gambar
 * jadi dari domain publik). Daftar ini sengaja tetap ada — mekanisme gambar
 * tangan masih dipakai kalau nanti ada tema tanpa berkas, dan `'gunung'` cukup
 * dikembalikan ke sini untuk memakai gambar tangan lagi (berkasnya akan
 * kalah karena prioritas di atas).
 *
 * Adegannya ditulis sebagai JSX tetap di bawah, bukan komponen dari variabel —
 * aturan `react-hooks/static-components` menuntut identitas komponen yang stabil
 * antar-render.
 *
 * @type {readonly string[]}
 */
export const ADEGAN_DIGAMBAR = []

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
 * Penanda satu pos di peta: **kemah** (tenda) di jalur pendakian, bukan
 * bulatan berikon. Warnanya mengikuti warna pos itu (`--pos-warna` di
 * `theme.css`), pintunya lebih terang supaya terbaca sebagai tenda.
 *
 * Ikon fase (tenda/pohon/sungai/batu/kabut/bendera) **tidak lagi** ditempel di
 * dalam penanda: di ukuran penanda di peta ikon sekecil itu tidak terbaca dan
 * membuat tendanya penuh. Identitas pos tetap aman — warnanya berbeda per pos,
 * nomornya tertulis di bawah tenda, dan nama fasenya selalu tertulis di daftar
 * pos di bawah peta (juga di `aria-label` panggung).
 */
function KemahPos() {
  return (
    <svg className="jelajah-pos-kemah" viewBox="0 0 24 20" aria-hidden="true" focusable="false">
      <path className="jelajah-pos-kemah-atap" d="M12 1.4 22.5 18.6H1.5z" />
      <path className="jelajah-pos-kemah-pintu" d="M12 8.4 16.9 18.6H7.1z" />
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
  // Rute mengikuti adegan tema: pos berdiri di bentuk latarnya (lereng gunung,
  // dermaga/pulau, landasan/Bulan) — lihat `RUTE_TEMA` di perjalanan.js.
  const titik = titikJalur(langkah.length, perjalanan.adegan)
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
            <KemahPos />
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
