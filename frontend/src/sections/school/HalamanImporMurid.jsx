/**
 * Halaman impor murid dari CSV (slice 02).
 * Menampilkan laporan per baris: berapa sukses, berapa gagal, baris mana yang gagal.
 */
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { imporMurid } from './api.js'
import { ringkasLaporanImpor } from './validasi.js'
import { pesanGalatApi } from '../auth/api.js'
import TabelData from '../../shared/ui/TabelData.jsx'
import { TombolTaut } from '../../shared/ui/Tombol.jsx'
import { tampilkanToast } from '../../shared/ui/toast.jsx'
import { RUTE } from '../../routes.js'

/** @typedef {import('./api.js').LaporanImpor} LaporanImpor */

export default function HalamanImporMurid() {
  const queryClient = useQueryClient()
  const [berkas, setBerkas] = useState(/** @type {File | null} */ (null))
  const [laporan, setLaporan] = useState(/** @type {LaporanImpor | null} */ (null))

  const impor = useMutation({
    mutationFn: async (/** @type {File} */ berkasTerpilih) => imporMurid(berkasTerpilih),
    onSuccess: async (hasil) => {
      setLaporan(hasil.laporan)
      tampilkanToast(
        hasil.laporan.gagal > 0 ? 'peringatan' : 'sukses',
        hasil.message,
      )
      await queryClient.invalidateQueries({ queryKey: ['murid'] })
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  const ringkasan = laporan ? ringkasLaporanImpor(laporan) : null

  return (
    <div className="row justify-content-center">
      <div className="col-lg-8">
        <div className="kartu-soft p-4 p-md-5">
          <h1 className="h5 fw-bold mb-1">Impor Murid dari CSV</h1>
          <p className="text-body-secondary">
            Kolom wajib: <code>nama</code>, <code>email</code>, <code>kelas</code>.
            Kolom opsional: <code>nis</code>, <code>nisn</code>, <code>kata_sandi</code>.
            Maksimal 100 galat dilaporkan; baris valid lain tetap diproses.
          </p>

          <form
            className="d-flex flex-wrap align-items-end gap-3 mb-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (berkas) impor.mutate(berkas)
            }}
          >
            <div className="flex-grow-1">
              <label className="form-label fw-semibold" htmlFor="berkas-murid">Berkas CSV</label>
              <input
                id="berkas-murid"
                type="file"
                accept=".csv,text/csv"
                className="form-control"
                onChange={(e) => setBerkas(e.target.files?.[0] ?? null)}
              />
            </div>
            <button type="submit" className="btn btn-aksen" disabled={!berkas || impor.isPending}>
              {impor.isPending ? 'Mengimpor…' : 'Impor'}
            </button>
          </form>

          {ringkasan && (
            <div role={laporan && laporan.gagal > 0 ? 'alert' : 'status'}>
              <p className="fw-semibold mb-2">{ringkasan.ringkasan}</p>

              {ringkasan.galat.length > 0 && (
                <TabelData
                  label="Baris yang gagal diimpor"
                  baris={ringkasan.galat}
                  kunciBaris={(galat) => galat.baris}
                  kolom={[
                    {
                      kunci: 'baris',
                      judul: 'Baris',
                      sel: (galat) => <strong>{galat.baris}</strong>,
                    },
                    { kunci: 'pesan', judul: 'Pesan' },
                  ]}
                />
              )}

              {laporan && laporan.gagal > 0 && (
                <p className="status-salah small">
                  Perbaiki baris di atas lalu impor ulang berkas yang sudah dibetulkan.
                </p>
              )}
            </div>
          )}

          <TombolTaut varian="tepi" to={RUTE.murid}>Kembali ke daftar murid</TombolTaut>
        </div>
      </div>
    </div>
  )
}
