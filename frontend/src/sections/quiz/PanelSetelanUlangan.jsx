/**
 * Panel setelan **satu ulangan** di halaman detail/kelola kuis.
 *
 * Sebelum 13 Oktober 2026 panel ini tinggal di halaman /pengaturan dengan pemilih
 * ulangan: guru harus memilih ulangannya dulu, padahal yang sedang ia kerjakan
 * sudah jelas. Sekarang panelnya menyatu dengan kuisnya — tidak ada lingkup yang
 * bisa salah pilih, dan halaman /pengaturan kembali jadi setelan akun.
 *
 * Lapis sekolah dan kelas tetap berlaku di server (resolusi tiga lapis) dan tetap
 * bisa **mengunci** sebuah nilai: nilai yang dikunci dilaporkan apa adanya
 * ("dikunci sekolah") dan saklarnya dimatikan, karena mengubahnya di sini hanya
 * akan menyimpan angka yang diabaikan.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ambilPengaturan, simpanPengaturan } from '../settings/api.js'
import { KUNCI_TAMU } from './setelanSesi.js'
import { pesanGalatApi } from '../auth/api.js'
import { tampilkanToast } from '../../shared/ui/toast.jsx'
import Skeleton from '../../shared/ui/Skeleton.jsx'
import { Tombol } from '../../shared/ui/Tombol.jsx'

/**
 * @param {{ kuisId: number }} props
 */
export default function PanelSetelanUlangan({ kuisId }) {
  const queryClient = useQueryClient()
  const [angkaDraft, setAngkaDraft] = useState(/** @type {Record<string, string>} */ ({}))
  const [sibukMassal, setSibukMassal] = useState(false)

  const resolusi = useQuery({
    queryKey: ['pengaturan', kuisId],
    queryFn: () => ambilPengaturan(null, kuisId),
    enabled: Number.isInteger(kuisId) && kuisId > 0,
  })

  /**
   * Muatan satu kunci untuk kuis ini.
   * @param {{ kunci: string, nilai: boolean | number, terkunci: boolean }} muatan
   */
  function muatanSatu(muatan) {
    return simpanPengaturan({
      lingkup: 'kuis',
      lingkup_id: kuisId,
      kunci: muatan.kunci,
      nilai: muatan.nilai,
      // Tidak ada yang bisa dikunci dari lapis kuis; nilai yang sudah dikunci
      // sekolah dilaporkan apa adanya dan tidak diubah (lihat simpanBanyak).
      terkunci: false,
      kuis_id: kuisId,
    })
  }

  const simpan = useMutation({
    mutationFn: muatanSatu,
    onSuccess: async () => {
      tampilkanToast('sukses', 'Setelan ulangan disimpan.')
      await queryClient.invalidateQueries({ queryKey: ['pengaturan'] })
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  /**
   * Nyalakan/matikan sekelompok saklar sekaligus (mis. semua jenis anti-cheat).
   *
   * API menyimpan per kunci, jadi dipanggil berurutan; saklar yang dikunci
   * sekolah dilewati karena nilainya akan diabaikan — lebih baik dilaporkan
   * daripada disimpan tanpa efek. Satu toast untuk seluruh kelompok supaya tidak
   * membanjiri guru.
   *
   * @param {[string, import('../settings/api.js').NilaiPengaturan][]} daftar
   * @param {boolean} nilai
   */
  async function simpanBanyak(daftar, nilai) {
    setSibukMassal(true)
    let diubah = 0
    let dilewati = 0

    try {
      for (const [kunci, info] of daftar) {
        if (info.terkunci) {
          dilewati += 1
          continue
        }

        await muatanSatu({ kunci, nilai, terkunci: info.terkunci })
        diubah += 1
      }

      const catatan = dilewati > 0 ? ` ${dilewati} dilewati karena dikunci sekolah.` : ''
      tampilkanToast('sukses', `${diubah} setelan ${nilai ? 'dinyalakan' : 'dimatikan'}.${catatan}`)
      await queryClient.invalidateQueries({ queryKey: ['pengaturan'] })
    } catch (galat) {
      tampilkanToast('salah', pesanGalatApi(galat))
    } finally {
      setSibukMassal(false)
    }
  }

  const data = resolusi.data

  /** @type {Record<string, [string, import('../settings/api.js').NilaiPengaturan][]>} */
  const kelompok = {}
  if (data) {
    for (const entri of Object.entries(data.pengaturan)) {
      const info = entri[1]
      if (!kelompok[info.kelompok]) kelompok[info.kelompok] = []
      kelompok[info.kelompok].push(entri)
    }
  }

  if (resolusi.isPending) return <Skeleton judul baris={4} label="Memuat setelan ulangan…" />

  if (resolusi.isError) {
    return (
      <p className="status-salah mb-0">
        Gagal memuat setelan ulangan ini. Kuis ini mungkin bukan milikmu.
      </p>
    )
  }

  return (
    <div>
      {Object.entries(kelompok).map(([namaKelompok, daftar]) => {
        // Saklar (boolean) bisa dinyalakan/dimatikan sekaligus; angka tidak.
        const saklar = daftar.filter(([, info]) => info.tipe === 'boolean')
        const hidup = saklar.filter(([, info]) => info.nilai).length

        return (
          <section key={namaKelompok} className="mb-4">
            <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
              {/* Lencana di luar <h3>: di dalamnya ia ikut jadi HURUF BESAR semua. */}
              <div className="me-auto d-flex flex-wrap align-items-center gap-2">
                <h3 className="h6 fw-bold text-uppercase text-body-secondary mb-0">{namaKelompok}</h3>
                {saklar.length > 0 && (
                  <span className="badge-status lembut">
                    {hidup}/{saklar.length} aktif
                  </span>
                )}
              </div>

              {saklar.length > 1 && (
                <div className="d-flex gap-1">
                  <Tombol
                    varian="tepi"
                    ukuran="sedang"
                    memuat={sibukMassal}
                    onClick={() => void simpanBanyak(saklar, true)}
                  >
                    Nyalakan semua
                  </Tombol>
                  <Tombol
                    varian="tepi"
                    ukuran="sedang"
                    memuat={sibukMassal}
                    onClick={() => void simpanBanyak(saklar, false)}
                  >
                    Matikan semua
                  </Tombol>
                </div>
              )}
            </div>

            {daftar.map(([kunci, info]) => (
              <div key={kunci} className="d-flex flex-wrap align-items-center gap-3 border-bottom py-3">
                <div className="me-auto">
                  <span className="fw-semibold d-block">{info.label}</span>
                  <span className="text-body-secondary small">
                    Sumber: {info.sumber}
                    {info.terkunci && <span className="badge-status lembut ms-1">dikunci sekolah</span>}
                  </span>
                </div>

                {/*
                  Saklar setelan (termasuk "Izinkan siswa tamu"). Dua hal yang
                  membuatnya tidak bergeser saat disentuh — dulu teks labelnya
                  berubah panjang ("Aktif" → "Nonaktif") dan barisnya ikut
                  membungkus, sehingga saklarnya seperti melompat:
                  1. lebar bloknya tetap (`.saklar-setelan`) dan teksnya diberi
                     lebar minimum, jadi panjang teks tidak menggeser apa pun;
                  2. keterangan "dikunci sekolah" dipindah ke teks sumber di
                     sebelah kiri — bukan lagi ikut mengubah lebar label.
                */}
                {info.tipe === 'boolean' && (
                  <div className="form-check form-switch m-0 saklar-setelan">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id={`set-${kunci}`}
                      aria-label={`${info.label}: ${info.nilai ? 'aktif' : 'nonaktif'}`}
                      checked={Boolean(info.nilai)}
                      disabled={simpan.isPending || sibukMassal || info.terkunci}
                      onChange={(e) => simpan.mutate({ kunci, nilai: e.target.checked, terkunci: info.terkunci })}
                    />
                    <label className="form-check-label small" htmlFor={`set-${kunci}`}>
                      <span className="saklar-setelan-teks">{info.nilai ? 'Aktif' : 'Nonaktif'}</span>
                    </label>
                  </div>
                )}

                {/*
                  Pintu tamu dijelaskan di tempatnya (14 Oktober 2026).

                  Guru yang sudah menyalakan "Izinkan siswa tamu" masih melihat
                  muridnya "dipaksa masuk": pintu tamu memang baru terbuka untuk
                  kuis yang **sudah diterbitkan** (`TamuService::kuisTerbuka`),
                  dan saklar ini tidak mengatakan itu. Catatan ini dipasang persis
                  di bawah saklarnya supaya sebabnya ketemu tanpa bertanya.
                */}
                {kunci === KUNCI_TAMU && (
                  <p className="small teks-lembut mb-0 w-100">
                    {info.nilai
                      ? 'Murid tanpa akun cukup menulis namanya di halaman masuk — atau langsung dari tautan ulangan yang kamu bagikan. Pintunya baru terbuka setelah kuis ini diterbitkan; kuis draf belum membuka pintu tamu.'
                      : 'Selama mati, murid tanpa akun tidak bisa ikut. Pintu tamu juga hanya berlaku untuk kuis yang sudah diterbitkan.'}
                  </p>
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
                      disabled={simpan.isPending || info.terkunci}
                      onChange={(e) => setAngkaDraft({ ...angkaDraft, [kunci]: e.target.value })}
                    />
                    <Tombol
                      ukuran="sedang"
                      memuat={simpan.isPending}
                      disabled={info.terkunci}
                      onClick={() =>
                        simpan.mutate({
                          kunci,
                          nilai: Number(angkaDraft[kunci] ?? info.nilai),
                          terkunci: info.terkunci,
                        })
                      }
                    >
                      Simpan
                    </Tombol>
                  </div>
                )}
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}
