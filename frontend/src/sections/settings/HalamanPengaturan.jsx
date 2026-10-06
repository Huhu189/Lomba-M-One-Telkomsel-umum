/**
 * Halaman pengaturan tiga lapis (slice 02).
 * Guru/admin memilih lingkup (sekolah atau kelas) lalu mengubah nilai;
 * murid melihat nilai yang berlaku (resolusi kuis > kelas > sekolah).
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ambilKelas } from '../school/api.js'
import { ambilPengaturan, simpanPengaturan } from './api.js'
import { pesanGalatApi } from '../auth/api.js'
import { tampilkanToast } from '../../shared/ui/toast.jsx'

export default function HalamanPengaturan() {
  const queryClient = useQueryClient()
  const [lingkupKelas, setLingkupKelas] = useState('')
  const [angkaDraft, setAngkaDraft] = useState(/** @type {Record<string, string>} */ ({}))

  const kelasId = lingkupKelas ? Number(lingkupKelas) : null
  const daftarKelas = useQuery({ queryKey: ['kelas'], queryFn: ambilKelas })
  const resolusi = useQuery({
    queryKey: ['pengaturan', kelasId],
    queryFn: () => ambilPengaturan(kelasId),
  })

  const simpan = useMutation({
    mutationFn: async (/** @type {{ kunci: string, nilai: boolean | number, terkunci: boolean }} */ muatan) =>
      simpanPengaturan({
        lingkup: kelasId === null ? 'sekolah' : 'kelas',
        lingkup_id: kelasId ?? undefined,
        kunci: muatan.kunci,
        nilai: muatan.nilai,
        terkunci: kelasId === null ? muatan.terkunci : false,
        kelas_id: kelasId ?? undefined,
      }),
    onSuccess: async () => {
      tampilkanToast('sukses', 'Pengaturan disimpan.')
      await queryClient.invalidateQueries({ queryKey: ['pengaturan'] })
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  const data = resolusi.data

  /** @type {Record<string, [string, import('./api.js').NilaiPengaturan][]>} */
  const kelompok = {}
  if (data) {
    for (const entri of Object.entries(data.pengaturan)) {
      const info = entri[1]
      if (!kelompok[info.kelompok]) kelompok[info.kelompok] = []
      kelompok[info.kelompok].push(entri)
    }
  }

  return (
    <div className="row justify-content-center">
      <div className="col-lg-9">
        <div className="kartu-soft p-4 p-md-5">
          <h1 className="h5 fw-bold mb-1">Pengaturan Tiga Lapis</h1>
          <p className="text-body-secondary">
            Nilai berlaku mengikuti urutan <strong>kuis → kelas → sekolah</strong>. Bila sekolah
            mengunci sebuah pengaturan, nilai sekolah menang dan lapis bawah diabaikan.
          </p>

          <div className="mb-4" style={{ maxWidth: '20rem' }}>
            <label className="form-label fw-semibold" htmlFor="lingkup-pengaturan">Lingkup pengaturan</label>
            <select
              id="lingkup-pengaturan"
              className="form-select"
              value={lingkupKelas}
              onChange={(e) => {
                setLingkupKelas(e.target.value)
                setAngkaDraft({})
              }}
            >
              <option value="">Sekolah (berlaku umum)</option>
              {(daftarKelas.data ?? []).map((kelas) => (
                <option key={kelas.id} value={String(kelas.id)}>Kelas {kelas.nama}</option>
              ))}
            </select>
          </div>

          {resolusi.isLoading && <p className="text-body-secondary">Memuat pengaturan…</p>}
          {resolusi.isError && <p className="status-salah">Gagal memuat pengaturan.</p>}

          {data && Object.entries(kelompok).map(([namaKelompok, daftar]) => (
            <section key={namaKelompok} className="mb-4">
              <h2 className="h6 fw-bold text-uppercase text-body-secondary mb-3">{namaKelompok}</h2>

              {daftar.map(([kunci, info]) => (
                <div key={kunci} className="d-flex flex-wrap align-items-center gap-3 border-bottom py-3">
                  <div className="me-auto">
                    <span className="fw-semibold d-block">{info.label}</span>
                    <span className="text-body-secondary small">
                      Sumber: {info.sumber}
                      {info.terkunci ? ' · dikunci sekolah' : ''}
                    </span>
                  </div>

                  {info.tipe === 'boolean' && (
                    <div className="form-check form-switch m-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        id={`set-${kunci}`}
                        checked={Boolean(info.nilai)}
                        disabled={simpan.isPending}
                        onChange={(e) => simpan.mutate({ kunci, nilai: e.target.checked, terkunci: info.terkunci })}
                      />
                      <label className="form-check-label small" htmlFor={`set-${kunci}`}>
                        {info.nilai ? 'Aktif' : 'Nonaktif'}
                      </label>
                    </div>
                  )}

                  {info.tipe === 'integer' && (
                    <div className="d-flex align-items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        aria-label={`Nilai ${info.label}`}
                        className="form-control form-control-sm"
                        style={{ width: '6rem' }}
                        value={angkaDraft[kunci] ?? String(info.nilai)}
                        disabled={simpan.isPending}
                        onChange={(e) => setAngkaDraft({ ...angkaDraft, [kunci]: e.target.value })}
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        disabled={simpan.isPending}
                        onClick={() => simpan.mutate({
                          kunci,
                          nilai: Number(angkaDraft[kunci] ?? info.nilai),
                          terkunci: info.terkunci,
                        })}
                      >
                        Simpan
                      </button>
                    </div>
                  )}

                  {kelasId === null && (
                    <div className="form-check m-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`kunci-${kunci}`}
                        checked={info.terkunci}
                        disabled={simpan.isPending}
                        onChange={(e) => simpan.mutate({ kunci, nilai: info.nilai, terkunci: e.target.checked })}
                      />
                      <label className="form-check-label small" htmlFor={`kunci-${kunci}`}>
                        Kunci di sekolah
                      </label>
                    </div>
                  )}
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
