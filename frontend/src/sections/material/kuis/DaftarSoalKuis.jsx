/**
 * Daftar soal sebuah kuis — **persis isi bank soalnya** (15 Oktober 2026).
 *
 * Kenapa ada: panel klip kuis dulu hanya menulis "judul (3 soal)". Guru yang
 * memasang kuis dari bank soal jadi tidak bisa memastikan apa yang sebenarnya
 * akan dikerjakan murid tanpa keluar ke menu Kuis — dan kuis berisi satu soal
 * terlihat sama saja dengan kuis berisi sepuluh soal. Sekarang tiap soal muncul
 * sebagai satu baris: jenis, pertanyaannya, dan kuncinya bila ringkas.
 *
 * Datanya dari endpoint guru yang sudah ada (`GET /v1/kuis/{id}` lewat
 * `ambilKuisDetail`) — bukan dari daftar kuis di editor, yang memang tidak
 * memuat soal. Jadi yang ditampilkan adalah susunan soal yang TERSIMPAN.
 */
import { useQuery } from '@tanstack/react-query'
import { ambilKuisDetail } from '../../quiz/api.js'
import { teksAman } from '../../question/tipeSoal.js'

/**
 * Ringkas kunci jawaban sebaris; `''` untuk jenis yang jawabannya panjang
 * (menjodohkan, mengurutkan, letak kata, klasifikasi, tabel isian).
 * @param {Record<string, unknown>} kunci
 * @returns {string}
 */
export function ringkasKunci(kunci) {
  if (Array.isArray(kunci.jawaban_baku)) {
    return kunci.jawaban_baku.filter((satu) => String(satu).trim() !== '').slice(0, 3).join(' / ')
  }

  if (typeof kunci.jawaban === 'string' || typeof kunci.jawaban === 'number') {
    return String(kunci.jawaban)
  }

  if (typeof kunci.benar === 'boolean') {
    return kunci.benar ? 'Benar' : 'Salah'
  }

  if (Array.isArray(kunci.benar)) {
    return kunci.benar.map((satu) => String(satu)).join(', ')
  }

  return ''
}

/**
 * @param {{ kuisId: number, kelas?: string }} props
 */
export default function DaftarSoalKuis({ kuisId, kelas = '' }) {
  const sah = Number.isInteger(kuisId) && kuisId > 0

  const detail = useQuery({
    queryKey: ['kuis-detail', kuisId],
    queryFn: () => ambilKuisDetail(kuisId),
    enabled: sah,
  })

  if (!sah) return null

  if (detail.isLoading) {
    return <p className="small teks-lembut mb-2">Memuat soal kuis…</p>
  }

  if (detail.isError) {
    return (
      <p className="small teks-lembut mb-2">
        Soal kuis ini tidak bisa dimuat di sini. Buka menu Kuis untuk memeriksanya.
      </p>
    )
  }

  const soal = detail.data?.soal ?? []

  if (soal.length === 0) {
    return (
      <p className="small teks-lembut mb-2">
        Kuis ini belum punya soal, jadi murid tidak akan bisa mengerjakannya. Tambahkan soalnya di menu
        Kuis.
      </p>
    )
  }

  return (
    <div className="nle-soal-kuis mb-2">
      <p className="small teks-lembut mb-1">
        {soal.length} soal di kuis ini — inilah yang dikerjakan murid
        {kelas === '' ? '' : ` kelas ${kelas}`}, urut seperti di bawah.
      </p>
      <ol className="list-unstyled mb-0">
        {soal.map((satu, urutan) => {
          const kunci = ringkasKunci(/** @type {Record<string, unknown>} */ (satu.kunci ?? {}))
          const teks = teksAman(satu.konten?.teks).trim()
          const pembahasan = typeof satu.pembahasan === 'string' ? satu.pembahasan.trim() : ''

          return (
            <li key={satu.id} className="py-1 border-bottom">
              <span className="badge-status lembut me-2">{satu.tipe_label}</span>
              <span className="small">
                {soal.length > 1 ? `${urutan + 1}. ` : ''}
                {teks.length > 110 ? `${teks.slice(0, 110)}…` : teks || '(tanpa teks)'}
              </span>
              {kunci !== '' && <span className="d-block small teks-lembut">Kunci: {kunci}</span>}
              {pembahasan !== '' && (
                <span className="d-block small teks-lembut">
                  Pembahasan: {pembahasan.length > 90 ? `${pembahasan.slice(0, 90)}…` : pembahasan}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
