/**
 * Panel riwayat jawaban di layar pengerjaan (sistem luring).
 *
 * Tujuannya satu: murid bisa MEMBUKTIKAN sendiri bahwa pekerjaannya ada di
 * perangkat — soal nomor berapa, jam berapa (menurut perkiraan jam server),
 * dan apakah jawabannya sudah diterima server atau masih menunggu koneksi.
 * Tanpa ini, saat koneksi putus murid hanya melihat banner dan harus percaya.
 *
 * Riwayat ini alat kerja, bukan arsip: hilang begitu jawaban dikumpulkan.
 */
import { STATUS_TERKIRIM, formatWaktuRiwayat } from './riwayatJawaban.js'

/**
 * @param {{
 *   entri: import('./riwayatJawaban.js').EntriRiwayat[],
 *   tertunda: number,
 *   aktif: boolean,
 *   luring: boolean,
 *   onNyalakan: (aktif: boolean) => void,
 * }} props
 */
export default function RiwayatJawaban({ entri, tertunda, aktif, luring, onNyalakan }) {
  // Terbaru di atas: yang baru saja diketik murid paling ingin ia lihat.
  const terbaru = [...entri].reverse()

  return (
    <details className="kartu-soft p-3 mb-4" data-riwayat={entri.length} data-tertunda={tertunda}>
      <summary className="fw-bold">
        Riwayat jawaban
        <span className="badge-status lembut ms-2">{entri.length} tercatat</span>
        {tertunda > 0 && (
          <span className="badge-status peringatan ms-1" data-tertunda-badge>
            {tertunda} menunggu terkirim
          </span>
        )}
      </summary>

      {!aktif && (
        <p className="teks-lembut small mt-3 mb-0">
          Riwayat lokal dimatikan di perangkat ini. Jawabanmu tetap disimpan sebagai cadangan dan
          dikirim ke server; hanya daftar riwayatnya yang tidak dicatat.
        </p>
      )}

      {aktif && terbaru.length === 0 && (
        <p className="teks-lembut small mt-3 mb-0">
          Belum ada jawaban yang tercatat. Setiap isian yang kamu simpan akan muncul di sini.
        </p>
      )}

      {aktif && terbaru.length > 0 && (
        <ul className="list-unstyled mb-0 mt-3" data-daftar-riwayat>
          {terbaru.map((satu, indeks) => (
            <li
              key={`${satu.soal_id}-${satu.at}`}
              className={`d-flex flex-wrap align-items-baseline gap-2 py-2${
                indeks === terbaru.length - 1 ? '' : ' border-bottom'
              }`}
            >
              <span className="fw-semibold">Soal {satu.nomor}</span>
              <span className="teks-patah flex-grow-1">{satu.ringkas}</span>
              <span className="teks-lembut small">{formatWaktuRiwayat(satu.server_at)}</span>
              <span className={`badge-status ${satu.status === STATUS_TERKIRIM ? 'sukses' : 'peringatan'}`}>
                {satu.status === STATUS_TERKIRIM ? 'tersimpan di server' : 'di perangkat ini'}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="form-check form-switch mt-3">
        <input
          className="form-check-input"
          type="checkbox"
          role="switch"
          id="riwayat-lokal"
          checked={aktif}
          onChange={(e) => onNyalakan(e.target.checked)}
        />
        <label className="form-check-label" htmlFor="riwayat-lokal">
          Simpan riwayat jawaban di perangkat ini
        </label>
      </div>

      <p className="teks-lembut small mb-0 mt-2">
        {luring
          ? 'Koneksi sedang putus: semua jawaban baru tersimpan di perangkat ini dan akan terkirim sendiri begitu koneksi kembali.'
          : 'Riwayat ini hanya ada di perangkat ini dan dihapus setelah jawaban dikumpulkan.'}
      </p>
    </details>
  )
}
