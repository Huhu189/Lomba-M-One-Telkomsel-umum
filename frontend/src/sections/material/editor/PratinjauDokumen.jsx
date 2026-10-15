/**
 * Pratinjau dokumen kantor di dalam halaman — materi **ditunjukkan**, bukan
 * disuruh diunduh (14 Oktober 2026).
 *
 * Sebelumnya Word/PowerPoint/Excel hanya muncul sebagai tombol "Buka dokumen".
 * Di ponsel itu berarti murid mengunduh berkasnya lebih dulu lalu mencarinya di
 * folder unduhan; yang diminta pemilik produk adalah membacanya langsung di
 * halaman. Berkas `.docx/.pptx/.xlsx` dibaca isinya di peramban (lihat
 * `pratinjauOOXML.js`), lalu digambar sederhana: paragraf, butir, tabel, gambar,
 * dan per lembar untuk Excel.
 *
 * Berkas kantor format lama (`.doc/.ppt/.xls`) atau berkas tanpa URL tetap
 * memakai tampilan lama: tombol "Buka dokumen" — supaya tidak ada materi yang
 * hilang dari layar murid.
 *
 * Tautan ke berkas aslinya selalu disediakan di bawah pratinjau: pratinjau ini
 * tidak menggambar tata letak, animasi, bagan, atau rumus.
 */
import { useEffect, useState } from 'react'
import Banner from '../../../shared/ui/Banner.jsx'
import { labelDokumen, namaBerkas } from '../berkas/sajianBerkas.js'
import { gambarDalam, jenisOOXML, tanpaIsi, uraiOOXML } from './pratinjauOOXML.js'

/**
 * @typedef {{
 *   url?: string|null,
 *   mime?: string|null,
 *   nama?: string|null,
 *   nama_asli?: string|null,
 * }} BerkasPratinjau
 * @typedef {{
 *   berkas: string|null,
 *   status: 'memuat'|'siap'|'galat',
 *   hasil: import('./pratinjauOOXML.js').HasilOOXML|null,
 *   urlGambar: Map<string, string>,
 * }} MuatanPratinjau
 */

/** @returns {MuatanPratinjau} */
function muatanKosong() {
  return { berkas: null, status: 'memuat', hasil: null, urlGambar: new Map() }
}

/**
 * URL objek untuk setiap gambar. Dibuat sekali per pembacaan; tanpa ini byte
 * gambar dikonversi ulang tiap gambar digambar.
 * @param {import('./pratinjauOOXML.js').HasilOOXML} hasil
 * @returns {Map<string, string>}
 */
function buatUrlGambar(hasil) {
  /** @type {Map<string, string>} */
  const peta = new Map()

  // jsdom/layanan tanpa URL objek: gambar dilewati, teksnya tetap tampil.
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return peta

  for (const gambar of gambarDalam(hasil)) {
    const byte = /** @type {BlobPart} */ (/** @type {unknown} */ (gambar.data))
    peta.set(gambar.kunci, URL.createObjectURL(new Blob([byte], { type: gambar.tipe })))
  }
  return peta
}

/**
 * @param {{ gambar?: import('./pratinjauOOXML.js').GambarBerkas|null, urlGambar: Map<string, string> }} props
 */
function Gambar({ gambar, urlGambar }) {
  if (gambar === null || gambar === undefined) return null
  const url = urlGambar.get(gambar.kunci)
  if (url === undefined) return null
  return (
    <img
      className="pd-gambar"
      src={url}
      alt={gambar.nama === '' ? 'Gambar materi' : gambar.nama}
      loading="lazy"
    />
  )
}

/**
 * @param {{ blok: import('./pratinjauOOXML.js').BlokDokumen[], urlGambar: Map<string, string> }} props
 */
function IsiWord({ blok, urlGambar }) {
  return (
    <div className="pd-isi">
      {blok.map((satu, indeks) => {
        if (satu.tipe === 'paragraf' && satu.poin === true) {
          // Butir berurutan digabung jadi satu daftar; yang bukan butir pertama
          // dilompati karena sudah ikut digambar di daftar sebelumnya.
          const sebelumnya = blok[indeks - 1]
          if (sebelumnya !== undefined && sebelumnya.tipe === 'paragraf' && sebelumnya.poin === true) {
            return null
          }

          /** @type {string[]} */
          const butir = []
          for (let i = indeks; i < blok.length; i += 1) {
            const lanjut = blok[i]
            if (lanjut === undefined || lanjut.tipe !== 'paragraf' || lanjut.poin !== true) break
            butir.push(lanjut.teks ?? '')
          }

          return (
            <ul className="pd-butir" key={indeks}>
              {butir.map((teks, i) => (
                <li key={i}>{teks}</li>
              ))}
            </ul>
          )
        }

        if (satu.tipe === 'paragraf') {
          return (
            <p className={satu.gaya === 'judul' ? 'pd-judul' : 'pd-paragraf'} key={indeks}>
              {satu.teks}
            </p>
          )
        }

        if (satu.tipe === 'tabel') {
          const baris = satu.baris ?? []
          return (
            <div className="pd-tabel-gulir" key={indeks}>
              <table className="table table-sm table-bordered mb-0">
                <tbody>
                  {baris.map((sel, i) => (
                    <tr key={i}>
                      {sel.map((isi, j) => (
                        <td key={j}>{isi}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }

        return <Gambar key={indeks} gambar={satu.gambar ?? null} urlGambar={urlGambar} />
      })}
    </div>
  )
}

/**
 * @param {{ slide: import('./pratinjauOOXML.js').SlideDokumen[], urlGambar: Map<string, string> }} props
 */
function IsiPowerpoint({ slide, urlGambar }) {
  return (
    <ol className="pd-slide">
      {slide.map((satu) => (
        <li className="pd-slide-satu" key={satu.nomor}>
          <p className="pd-slide-nomor">Slide {satu.nomor}</p>
          <p className="pd-slide-judul">{satu.judul === '' ? `Slide ${satu.nomor}` : satu.judul}</p>
          {satu.butir.length > 0 && (
            <ul className="pd-butir">
              {satu.butir.map((butir, i) => (
                <li key={i} style={{ marginLeft: `${butir.tingkat}rem` }}>
                  {butir.teks}
                </li>
              ))}
            </ul>
          )}
          {satu.gambar.map((gambar) => (
            <Gambar key={gambar.kunci} gambar={gambar} urlGambar={urlGambar} />
          ))}
        </li>
      ))}
    </ol>
  )
}

/**
 * @param {{ lembar: import('./pratinjauOOXML.js').LembarDokumen[] }} props
 */
function IsiExcel({ lembar }) {
  return (
    <div className="pd-isi">
      {lembar.map((satu, indeks) => (
        <section className="pd-lembar" key={indeks}>
          <p className="pd-lembar-nama">{satu.nama}</p>
          {satu.baris.length === 0 ? (
            <p className="small teks-lembut mb-0">Lembar ini tidak berisi teks.</p>
          ) : (
            <div className="pd-tabel-gulir">
              <table className="table table-sm table-bordered mb-0">
                <tbody>
                  {satu.baris.map((baris, i) => (
                    <tr key={i}>
                      {baris.map((sel, j) =>
                        i === 0 ? (
                          <th scope="col" key={j}>
                            {sel}
                          </th>
                        ) : (
                          <td key={j}>{sel}</td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {satu.terpotong && (
            <p className="small teks-lembut mb-0 mt-1">
              Sebagian baris/kolom tidak ikut ditampilkan agar halaman tetap ringan.
            </p>
          )}
        </section>
      ))}
    </div>
  )
}

/**
 * @param {{ berkas: BerkasPratinjau|null|undefined }} props
 */
export default function PratinjauDokumen({ berkas }) {
  const jenis = jenisOOXML(berkas)
  const url = berkas?.url ?? null
  const label = labelDokumen(berkas ?? {})
  const nama = namaBerkas(berkas ?? {})

  /**
   * Status disimpan bersama alamat yang sedang dibaca; alamat lain = muatan
   * lama, jadi statusnya diturunkan saat render (`memuat`) dan tidak perlu
   * `setState` sinkron di dalam efek.
   */
  const [muatan, setMuatan] = useState(muatanKosong)

  const siap = jenis !== null && url !== null
  const status = !siap ? 'menunggu' : muatan.berkas === url ? muatan.status : 'memuat'
  const hasil = siap && muatan.berkas === url ? muatan.hasil : null

  useEffect(() => {
    if (jenis === null || url === null) return

    let dibatalkan = false
    const pengendali = new AbortController()

    void (async () => {
      try {
        const tanggapan = await fetch(url, { signal: pengendali.signal })
        if (!tanggapan.ok) throw new Error(`Server menolak berkas (${tanggapan.status})`)

        const isi = await tanggapan.arrayBuffer()
        const terurai = await uraiOOXML(isi, jenis)
        if (dibatalkan) return

        setMuatan({ berkas: url, status: 'siap', hasil: terurai, urlGambar: buatUrlGambar(terurai) })
      } catch {
        if (dibatalkan) return
        setMuatan({ berkas: url, status: 'galat', hasil: null, urlGambar: new Map() })
      }
    })()

    return () => {
      dibatalkan = true
      pengendali.abort()
    }
  }, [jenis, url])

  // URL objek gambar pratinjau lama dilepas saat pratinjaunya berganti (atau
  // saat komponennya dilepas): tanpa ini memori gambar menumpuk tiap blok dibuka.
  useEffect(() => {
    const peta = muatan.urlGambar
    return () => {
      for (const alamat of peta.values()) URL.revokeObjectURL(alamat)
    }
  }, [muatan.urlGambar])


  // Bukan format yang bisa dibaca peramban (mis. `.doc` lama) atau berkasnya
  // belum jadi: tampilan lama yang dipakai supaya materinya tetap terjangkau.
  if (jenis === null || url === null) {
    return (
      <div>
        <a
          className="btn btn-tepi"
          href={url ?? '#'}
          target="_blank"
          rel="noreferrer"
          aria-disabled={url === null}
        >
          Buka dokumen {label} ({(nama || '').slice(0, 60)})
        </a>
        <p className="small teks-lembut mb-0 mt-2">
          Peramban tidak bisa menampilkan dokumen {label} langsung; berkasnya terbuka di aplikasi
          dokumenmu dengan nama aslinya.
        </p>
      </div>
    )
  }

  const kosong = hasil !== null && tanpaIsi(hasil)

  return (
    <section className="pratinjau-dokumen" aria-label={`Pratinjau ${label}`}>
      <div className="pratinjau-dokumen-kepala">
        <span className="pratinjau-dokumen-lencana">Pratinjau {label}</span>
        <span className="pratinjau-dokumen-nama text-truncate">{nama}</span>
      </div>

      {status === 'memuat' && (
        <p className="small teks-lembut mb-0">Menyiapkan pratinjau {label}…</p>
      )}

      {status === 'galat' && (
        <Banner jenis="peringatan" judul={`Pratinjau ${label} gagal dibuka`}>
          Berkasnya tidak terbaca di peramban ini. Buka berkas aslinya lewat tautan di bawah, ya.
        </Banner>
      )}

      {status === 'siap' && kosong && (
        <Banner jenis="peringatan" judul={`Pratinjau ${label} kosong`}>
          Isi berkas ini tidak terbaca sebagai teks, tabel, atau gambar — mungkin hanya berisi
          bentuk/bagan. Buka berkas aslinya lewat tautan di bawah.
        </Banner>
      )}        {status === 'siap' && hasil !== null && !kosong && (
        <>
          {hasil.jenis === 'word' && (
            <IsiWord blok={hasil.blok ?? []} urlGambar={muatan.urlGambar} />
          )}
          {hasil.jenis === 'powerpoint' && (
            <IsiPowerpoint slide={hasil.slide ?? []} urlGambar={muatan.urlGambar} />
          )}
          {hasil.jenis === 'excel' && <IsiExcel lembar={hasil.lembar ?? []} />}
        </>
      )}

      <p className="small teks-lembut mb-0 mt-2">
        Pratinjau sederhana: teks, tabel, dan gambar. Tata letak aslinya hanya tampak di berkas
        aslinya.{' '}
        <a className="taut-sentuh" href={url} target="_blank" rel="noreferrer">
          Buka {nama} di tab baru
        </a>
      </p>
    </section>
  )
}
