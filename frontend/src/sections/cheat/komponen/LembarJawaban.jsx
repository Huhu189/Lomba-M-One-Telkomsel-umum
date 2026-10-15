/**
 * Panel lembar jawaban satu murid di Monitor Ulangan (15 Oktober 2026).
 *
 * Guru melihat siapa yang berhenti di soal berapa dari tabel monitor, lalu
 * membuka panel ini untuk membaca tulisan anak itu **tanpa pindah halaman dan
 * tanpa berjalan ke mejanya**. Panelnya disegarkan mengikuti irama monitor
 * (polling/SSE), jadi jawaban yang baru masuk muncul sendiri.
 *
 * Yang **tidak** ada di sini sengaja: kunci jawaban dan nilai per soal. Layar
 * monitor terbuka di depan kelas; kalau kuncinya ikut di sini, satu layar guru
 * yang terlihat anak-anak membatalkan seluruh ulangan. Nilai per soal punya
 * halamannya sendiri (koreksi manual), lengkap dengan alasan tiap perubahan.
 */
import Banner from '../../../shared/ui/Banner.jsx'
import KosongData from '../../../shared/ui/KosongData.jsx'
import Skeleton from '../../../shared/ui/Skeleton.jsx'
import { Tombol } from '../../../shared/ui/Tombol.jsx'
import { IkonPerisai } from '../../../icons.jsx'
import { formatWaktuJawaban, jawabanTerbaca, progresLembar } from '../lembarJawaban.js'

/** Jumlah nomor soal kosong yang dirinci sebelum disingkat "…". */
const NOMOR_DITAMPILKAN = 12

/**
 * @param {{
 *   nama: string,
 *   lembar?: import('../api.js').DataLembarJawaban,
 *   memuat?: boolean,
 *   galat?: unknown,
 *   onTutup: () => void,
 *   onSegarkan: () => void,
 * }} props
 */
export default function LembarJawaban({ nama, lembar, memuat = false, galat, onTutup, onSegarkan }) {
  // Sebelum lembar pertama datang angkanya nol, bukan `null`: bagian yang
  // memakainya baru tampil setelah datanya ada, dan angka kosong membuat baris
  // di bawahnya tidak perlu tahu apa pun soal keadaan pemuatan.
  /** @type {{ terjawab: number, jumlah: number, belum: number, nomorKosong: number[] }} */
  const progres =
    lembar === undefined
      ? { terjawab: 0, jumlah: 0, belum: 0, nomorKosong: [] }
      : progresLembar(lembar.soal)
  const nomorTampil = progres.nomorKosong.slice(0, NOMOR_DITAMPILKAN)

  return (
    <section className="kartu-soft p-3 mb-4" aria-label={`Lembar jawaban ${nama}`}>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <h2 className="judul-bagian mb-0">Jawaban {nama}</h2>

        {lembar !== undefined && (
          <>
            <span className="badge-status lembut">{lembar.attempt.status_label}</span>
            <span className="teks-lembut small">Percobaan ke-{lembar.attempt.attempt_no}</span>
          </>
        )}

        <div className="ms-auto d-flex gap-2">
          <Tombol varian="tepi" ukuran="sedang" memuat={memuat} onClick={onSegarkan}>
            Segarkan
          </Tombol>
          <Tombol varian="teks" onClick={onTutup}>
            Tutup
          </Tombol>
        </div>
      </div>

      {galat !== undefined && galat !== null ? (
        <Banner jenis="salah" judul="Lembar jawaban belum bisa dibuka">
          <p className="mb-0">
            Mungkin kuisnya bukan milikmu, sesimu berakhir, atau koneksinya sedang putus. Coba
            “Segarkan” sebentar lagi.
          </p>
        </Banner>
      ) : lembar === undefined ? (
        <Skeleton baris={4} label={`Memuat jawaban ${nama}…`} />
      ) : lembar.soal.length === 0 ? (
        <KosongData judul="Kuis ini belum punya soal" ikon={IkonPerisai}>
          Belum ada yang bisa dijawab murid, jadi belum ada lembar jawaban.
        </KosongData>
      ) : (
        <>
          <p className="teks-lembut small mb-2">
            {progres.terjawab} dari {progres.jumlah} soal sudah terjawab.
            {progres.belum > 0 && (
              <>
                {' '}
                Belum dijawab: soal {nomorTampil.join(', ')}
                {progres.belum > nomorTampil.length
                  ? ` dan ${progres.belum - nomorTampil.length} lainnya`
                  : ''}
                .
              </>
            )}
          </p>

          <ol className="list-unstyled mb-0">
            {lembar.soal.map((satu) => (
              <li key={satu.question_id} className="border-top py-2">
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <strong className="small">Soal {satu.nomor}</strong>
                  <span className="teks-lembut small">{satu.tipe_label}</span>
                  <span className={`badge-status ${satu.terjawab ? 'info' : 'lembut'} ms-auto`}>
                    {satu.terjawab ? 'Terjawab' : 'Kosong'}
                  </span>
                </div>

                {satu.teks !== '' && <p className="teks-lembut small mb-1">{satu.teks}</p>}

                <p className={satu.terjawab ? 'fw-semibold mb-1' : 'teks-lembut mb-1'}>
                  {jawabanTerbaca(satu)}
                </p>

                <p className="teks-lembut small mb-0">
                  {satu.terjawab ? `Terakhir diubah ${formatWaktuJawaban(satu.diperbarui_at)}` : 'Belum ada jawaban tersimpan'}
                  {satu.penjawab !== null && satu.penjawab !== undefined
                    ? ` · ditulis ${satu.penjawab}`
                    : ''}
                  {satu.versi > 0 ? ` · sudah diubah ${satu.versi} kali` : ''}
                </p>
              </li>
            ))}
          </ol>

          <p className="teks-lembut small mt-2 mb-0">
            Kunci jawaban dan nilai per soal tidak ditampilkan di sini — nilai diubah lewat halaman
            koreksi manual, supaya setiap perubahan tercatat.
          </p>
        </>
      )}
    </section>
  )
}
