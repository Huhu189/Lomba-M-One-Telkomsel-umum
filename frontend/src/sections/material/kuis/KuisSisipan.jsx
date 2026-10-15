/**
 * Panel kuis sisipan (di dalam video maupun bagian kuis biasa).
 *
 * Dua tahap:
 *  1. Mengerjakan — **satu daftar soal yang bisa digulir** (15 Oktober 2026),
 *     dengan kemajuan tertulis dan satu tombol kumpulkan di bawah. Permintaan
 *     pemilik produk: *“jangan bersifat proses dengan tombol Berikutnya —
 *     jadikan scrollbar”*, jadi anak bebas melompat/mengulang soal ke mana pun
 *     tanpa harus menekan “Berikutnya” berulang kali. Soal tetap dirender oleh
 *     `RendererSoal` (semua jenis soal ikut jalan).
 *  2. Hasil — skor + bintang, lalu tab yang DIBUKA GURU per kuis: penjelasan
 *     guru, ringkasan soal, kartu ingat (tertaut ke ringkasan), dan papan
 *     peringkat latihan. Tab yang tidak dibuka tidak muncul sama sekali.
 *
 * Komponen ini tidak memanggil server untuk menilai: pengumpulan dikerjakan
 * induk (`onKumpulkan`). Kunci jawaban hanya datang lewat endpoint
 * ringkasan-kuis SESUDAH latihan dikumpulkan, dan bagian yang dikirim server
 * mengikuti saklar guru.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Banner from '../../../shared/ui/Banner.jsx'
import { Tombol } from '../../../shared/ui/Tombol.jsx'
import { IkonBintang, IkonCentang, IkonSilang } from '../../../icons.jsx'
import { pesanGalatApi } from '../../auth/api.js'
import RendererSoal from '../../question/render/RendererSoal.jsx'
import { ambilRingkasanKuis } from '../api.js'
import KartuIngat from '../perjalanan/KartuIngat.jsx'
import {
  adaLayarTambahan,
  bintangDariPersen,
  persenSkor,
  pesanCapaian,
  saklarSesudahKuis,
  statusRingkasan,
} from './ringkasanKuis.js'

const KELILING = 2 * Math.PI * 44

/**
 * Cincin skor + bintang. Angka selalu tertulis (tidak hanya warna/gambar).
 * @param {{ persen: number, skor: number, maksimal: number }} props
 */
function RingSkor({ persen, skor, maksimal }) {
  const bintang = bintangDariPersen(persen)

  return (
    <div className="ks-skor">
      <div className="ks-cincin" role="img" aria-label={`Skor ${skor} dari ${maksimal}, ${persen} persen`}>
        <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
          <circle className="ks-cincin-latar" cx="50" cy="50" r="44" />
          <circle
            className="ks-cincin-isi"
            cx="50"
            cy="50"
            r="44"
            strokeDasharray={`${(persen / 100) * KELILING} ${KELILING}`}
            transform="rotate(-90 50 50)"
          />
        </svg>
        <span className="ks-cincin-angka">
          <strong>{persen}</strong>
          <small>%</small>
        </span>
      </div>
      <div className="ks-bintang" role="img" aria-label={`${bintang} dari 3 bintang`}>
        {[1, 2, 3].map((nomor) => (
          <span key={nomor} className={`ks-bintang-satu${nomor <= bintang ? ' nyala' : ''}`}>
            <IkonBintang size={28} />
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * @param {{
 *   soal: Array<import('zod').infer<typeof import('../api.js').skemaBarisRingkasan>>,
 *   punyaKartu: boolean,
 *   terbuka: Set<number>,
 *   setTerbuka: (baru: Set<number>) => void,
 *   sorotId: number|null,
 *   onLihatKartu: (idSoal: number) => void,
 * }} props
 */
function DaftarRingkasan({ soal, punyaKartu, terbuka, setTerbuka, sorotId, onLihatKartu }) {
  const benar = soal.filter((satu) => satu.benar === true).length

  return (
    <div>
      <p className="small mb-2" aria-live="polite">
        <strong>{benar}</strong> dari {soal.length} soal benar
        {soal.length - benar > 0 ? ` · ${soal.length - benar} perlu diulang` : ' · semuanya tepat!'}
      </p>
      <ol className="ks-ringkasan">
        {soal.map((satu) => {
          const status = statusRingkasan(satu)
          const buka = terbuka.has(satu.question_id)

          return (
            <li key={satu.question_id} className={`ks-baris ${status.kunci}${sorotId === satu.question_id ? ' sorot' : ''}`}>
              <button
                type="button"
                className="ks-baris-kepala"
                aria-expanded={buka}
                aria-controls={`ks-rincian-${satu.question_id}`}
                onClick={() => {
                  const baru = new Set(terbuka)
                  if (buka) baru.delete(satu.question_id)
                  else baru.add(satu.question_id)
                  setTerbuka(baru)
                }}
              >
                <span className="ks-baris-nomor">{satu.nomor}</span>
                <span className="ks-baris-teks">{satu.teks}</span>
                <span className={`ks-lencana ${status.kunci}`}>
                  {status.kunci === 'benar' && <IkonCentang size={14} />}
                  {status.kunci === 'salah' && <IkonSilang size={14} />}
                  {status.label}
                </span>
              </button>

              {buka && (
                <div className="ks-baris-rincian" id={`ks-rincian-${satu.question_id}`}>
                  {satu.jawaban_benar !== null && (
                    <p className="mb-1">
                      <span className="ks-judul-kecil">Jawaban yang tepat</span>
                      <span className="ks-jawab">{satu.jawaban_benar}</span>
                    </p>
                  )}
                  {satu.pembahasan !== null && (
                    <p className="mb-1">
                      <span className="ks-judul-kecil">Pembahasan</span>
                      {satu.pembahasan}
                    </p>
                  )}
                  {satu.jawaban_benar === null && satu.pembahasan === null && (
                    <p className="small teks-lembut mb-1">Soal ini tidak punya ringkasan jawaban teks.</p>
                  )}
                  {punyaKartu && (satu.jawaban_benar !== null || satu.pembahasan !== null) && (
                    <button type="button" className="btn btn-tepi btn-sedang mt-1" onClick={() => onLihatKartu(satu.question_id)}>
                      Latih sebagai kartu
                    </button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/**
 * @param {{ papan: import('zod').infer<typeof import('../api.js').skemaPapanLatihan> }} props
 */
function PapanLatihan({ papan }) {
  const baris = [...papan.teratas, ...(papan.saya ? [papan.saya] : [])]

  return (
    <div>
      <p className="small teks-lembut mb-2">
        Peringkat latihan kuis ini — terpisah dari ranking ulangan resmi. {papan.peserta} teman sudah menyelesaikannya.
      </p>
      <ol className="ks-papan">
        {baris.map((satu, indeks) => (
          <li
            key={`${satu.peringkat}-${satu.nama}-${indeks}`}
            className={`ks-papan-baris${satu.saya ? ' saya' : ''}${papan.saya && satu === papan.saya ? ' terpisah' : ''}`}
          >
            <span className={`ks-papan-urut${satu.peringkat <= 3 ? ' juara' : ''}`} aria-label={`Peringkat ${satu.peringkat}`}>
              {satu.peringkat}
            </span>
            <span className="ks-papan-nama">
              {satu.nama}
              {satu.saya && <span className="ks-papan-kamu"> (kamu)</span>}
            </span>
            <span className="ks-papan-skor">
              {satu.skor}
              <small> / {papan.skor_maksimal}</small>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/**
 * @param {{
 *   attempt: import('../../attempt/api.js').DataAttempt,
 *   jawaban: Record<string, unknown>,
 *   onUbahJawaban: (idSoal: string, nilai: unknown) => void,
 *   hasil: import('../../attempt/api.js').DataHasil|null,
 *   galat?: string,
 *   sibuk?: boolean,
 *   onKumpulkan: () => void,
 *   onLewati?: () => void,
 *   materiId: number,
 *   blockId: number,
 *   tampilan?: Record<string, string|number>|null,
 *   judul?: string,
 *   catatan?: string,
 *   penjelasan?: import('react').ReactNode,
 *   labelLanjut: string,
 *   sibukLanjut?: boolean,
 *   onLanjut: () => void,
 * }} props
 */
export default function KuisSisipan({
  attempt,
  jawaban,
  onUbahJawaban,
  hasil,
  galat = '',
  sibuk = false,
  onKumpulkan,
  onLewati,
  materiId,
  blockId,
  tampilan,
  judul,
  catatan,
  penjelasan,
  labelLanjut,
  sibukLanjut = false,
  onLanjut,
}) {
  const [tab, setTab] = useState(/** @type {string|null} */ (null))
  const [penilaian, setPenilaian] = useState(/** @type {Record<number, 'ingat'|'belum'>} */ ({}))
  const [kartuAwal, setKartuAwal] = useState(/** @type {{ id: number|null, n: number }} */ ({ id: null, n: 0 }))
  const [terbuka, setTerbuka] = useState(/** @type {Set<number>|null} */ (null))
  const [sorotId, setSorotId] = useState(/** @type {number|null} */ (null))

  const saklar = saklarSesudahKuis(tampilan)
  const butuhServer = hasil !== null && adaLayarTambahan(saklar)

  const ringkasan = useQuery({
    queryKey: ['ringkasan-kuis', materiId, blockId, hasil?.id ?? null],
    queryFn: () => ambilRingkasanKuis(materiId, blockId),
    enabled: butuhServer,
    retry: false,
    staleTime: Infinity,
  })

  const terjawab = attempt.soal.filter((satu) => jawaban[String(satu.id)] !== undefined && jawaban[String(satu.id)] !== null).length
  const belum = attempt.soal.length - terjawab
  const persen = hasil ? persenSkor(hasil.skor, hasil.skor_maksimal) : 0

  // ---------------------------------------------------------------- hasil
  if (hasil !== null) {
    const data = ringkasan.data
    const punyaPenjelasan = Boolean(penjelasan)
    const daftarTab = [
      ...(punyaPenjelasan ? [{ id: 'penjelasan', label: 'Penjelasan' }] : []),
      ...(saklar.ringkasan ? [{ id: 'ringkasan', label: 'Ringkasan soal' }] : []),
      ...(saklar.kartu ? [{ id: 'kartu', label: 'Kartu ingat' }] : []),
      ...(saklar.papan ? [{ id: 'papan', label: 'Peringkat' }] : []),
    ]
    const tabAktif = daftarTab.find((satu) => satu.id === tab)?.id ?? daftarTab[0]?.id ?? null

    // Soal yang salah/kosong terbuka sendiri; sisanya tertutup.
    const terbukaSekarang =
      terbuka ??
      new Set((data?.soal ?? []).filter((satu) => satu.benar !== true).map((satu) => satu.question_id))

    function lihatKartu(/** @type {number} */ idSoal) {
      setKartuAwal((sebelum) => ({ id: idSoal, n: sebelum.n + 1 }))
      setTab('kartu')
    }

    function lihatRingkasan(/** @type {number} */ idSoal) {
      setTerbuka(new Set([...terbukaSekarang, idSoal]))
      setSorotId(idSoal)
      setTab('ringkasan')
    }

    return (
      <div className="ks ks-hasil">
        <div className="ks-hero">
          <RingSkor persen={persen} skor={hasil.skor ?? 0} maksimal={hasil.skor_maksimal ?? 0} />
          <div className="ks-hero-teks">
            <p className="ks-eyebrow">Latihan selesai</p>
            <h4 className="ks-hero-judul">
              Skor {hasil.skor ?? 0} dari {hasil.skor_maksimal ?? 0}
            </h4>
            <p className="mb-0">{pesanCapaian(persen)}</p>
            <p className="small teks-lembut mb-0 mt-1">
              {hasil.jumlah_benar} dari {hasil.jumlah_soal} soal benar · latihan tidak masuk ranking ulangan.
            </p>
          </div>
        </div>

        {daftarTab.length > 1 && (
          <div className="ks-tab" role="tablist" aria-label="Setelah kuis">
            {daftarTab.map((satu) => (
              <button
                key={satu.id}
                type="button"
                role="tab"
                id={`ks-tab-${satu.id}`}
                aria-selected={tabAktif === satu.id}
                aria-controls="ks-panel"
                tabIndex={tabAktif === satu.id ? 0 : -1}
                className={`ks-tab-satu${tabAktif === satu.id ? ' aktif' : ''}`}
                onClick={() => setTab(satu.id)}
                onKeyDown={(e) => {
                  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
                  e.preventDefault()
                  const arah = e.key === 'ArrowRight' ? 1 : -1
                  const posisi = daftarTab.findIndex((t) => t.id === satu.id)
                  setTab(daftarTab[(posisi + arah + daftarTab.length) % daftarTab.length].id)
                }}
              >
                {satu.label}
              </button>
            ))}
          </div>
        )}

        {tabAktif !== null && (
          <div
            className="ks-panel"
            id="ks-panel"
            role={daftarTab.length > 1 ? 'tabpanel' : undefined}
            aria-labelledby={daftarTab.length > 1 ? `ks-tab-${tabAktif}` : undefined}
          >
            {tabAktif === 'penjelasan' && penjelasan}

            {tabAktif !== 'penjelasan' && ringkasan.isLoading && <p className="teks-lembut mb-0">Menyiapkan ringkasan…</p>}
            {tabAktif !== 'penjelasan' && ringkasan.isError && (
              <Banner jenis="peringatan">{pesanGalatApi(ringkasan.error)}</Banner>
            )}

            {tabAktif === 'ringkasan' && data?.soal && (
              <DaftarRingkasan
                soal={data.soal}
                punyaKartu={saklar.kartu && (data.kartu?.length ?? 0) > 0}
                terbuka={terbukaSekarang}
                setTerbuka={setTerbuka}
                sorotId={sorotId}
                onLihatKartu={lihatKartu}
              />
            )}

            {tabAktif === 'kartu' && data?.kartu && (
              <KartuIngat
                key={kartuAwal.n}
                kartu={data.kartu}
                penilaian={penilaian}
                awalId={kartuAwal.id}
                onNilai={(id, nilai) => setPenilaian((sebelum) => ({ ...sebelum, [id]: nilai }))}
                onUlang={(ids) =>
                  setPenilaian((sebelum) => {
                    if (ids === null) return {}
                    const salinan = { ...sebelum }
                    for (const id of ids) delete salinan[id]
                    return salinan
                  })
                }
                onLihatRingkasan={saklar.ringkasan ? lihatRingkasan : undefined}
              />
            )}

            {tabAktif === 'papan' && data?.papan && <PapanLatihan papan={data.papan} />}
          </div>
        )}

        {galat && <Banner jenis="salah">{galat}</Banner>}

        <div className="ks-kaki">
          <Tombol memuat={sibukLanjut} onClick={onLanjut}>
            {labelLanjut}
          </Tombol>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------- mengerjakan
  return (
    <div className="ks">
      <header className="ks-kepala">
        <div>
          <p className="ks-eyebrow">Kuis sisipan{judul ? ` · ${judul}` : ''}</p>
          <p className="ks-kepala-info mb-0">
            {attempt.soal.length} soal · gulir untuk melihat semuanya
          </p>
        </div>
        <span className="ks-pil" aria-live="polite">
          {terjawab}/{attempt.soal.length} terjawab
        </span>
      </header>

      {catatan && <p className="ks-catatan">{catatan}</p>}

      <div
        className="progress ks-bar"
        role="progressbar"
        aria-label="Soal yang sudah dijawab"
        aria-valuemin={0}
        aria-valuemax={attempt.soal.length}
        aria-valuenow={terjawab}
      >
        <div className="progress-bar" style={{ width: `${(terjawab / Math.max(1, attempt.soal.length)) * 100}%` }} />
      </div>

      {/*
        Seluruh soal ada di satu daftar yang punya gulirannya sendiri
        (`.ks-daftar-soal`), jadi panelnya tidak memanjang mengikuti jumlah soal
        dan anak tidak perlu menekan “Berikutnya” untuk sampai ke soal terakhir.
        `tabIndex=0` + `role="region"` membuat wadah yang bisa digulir ini juga
        terjangkau papan ketik (bukan hanya tetikus).
      */}
      <div className="ks-daftar-soal" role="region" aria-label="Daftar soal latihan" tabIndex={0}>
        {attempt.soal.map((satu) => (
          <section key={satu.id} className="ks-soal" aria-labelledby={`ks-soal-${satu.id}`}>
            <div className="ks-soal-kepala">
              <strong id={`ks-soal-${satu.id}`}>Soal {satu.nomor}</strong>
              <span className="badge-status lembut">{satu.tipe_label}</span>
              {jawaban[String(satu.id)] !== undefined && jawaban[String(satu.id)] !== null && (
                <span className="ks-soal-terjawab">
                  <IkonCentang size={14} /> terjawab
                </span>
              )}
            </div>
            <RendererSoal
              tipe={satu.tipe}
              konten={satu.konten}
              nilai={jawaban[String(satu.id)]}
              onUbah={(nilai) => onUbahJawaban(String(satu.id), nilai)}
              dinonaktifkan={false}
              nama={`sisipan-${attempt.id}-soal-${satu.id}`}
            />
          </section>
        ))}
      </div>

      {galat && <Banner jenis="salah">{galat}</Banner>}

      <div className="ks-kaki">
        <Tombol memuat={sibuk} onClick={onKumpulkan}>
          Simpan jawaban &amp; kumpulkan
        </Tombol>
      </div>

      {belum > 0 && (
        <p className="small status-peringatan mt-2 mb-0" role="status">
          {belum} soal belum dijawab — kamu masih bisa menggulir daftarnya ke atas.
        </p>
      )}

      {onLewati && (
        <div className="mt-2">
          <Tombol varian="teks" onClick={onLewati}>
            Lewati kuis ini
          </Tombol>
        </div>
      )}
    </div>
  )
}
