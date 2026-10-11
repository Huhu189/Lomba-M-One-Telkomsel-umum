/**
 * Halaman pengaturan tiga lapis (slice 02, K-05).
 *
 * Siapa yang boleh menyentuh lapis mana diambil server: lingkup sekolah/kelas
 * hanya admin, lingkup kuis hanya pemilik kuisnya. Pilihan di halaman ini
 * mengikuti aturan itu supaya guru tidak disuguhi tombol yang pasti ditolak.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ambilKelas } from '../school/api.js'
import { ambilKuis } from '../quiz/api.js'
import { ambilPengaturan, simpanPengaturan } from './api.js'
import { pesanGalatApi } from '../auth/api.js'
import { useAuthStore } from '../auth/authStore.js'
import { tampilkanToast } from '../../shared/ui/toast.jsx'
import { Tombol } from '../../shared/ui/Tombol.jsx'
import { bacaLingkup, lingkupAwal, pilihanLingkup } from './lingkup.js'

export default function HalamanPengaturan() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const sebagaiAdmin = user?.role === 'admin'
  const [pilihan, setPilihan] = useState('')
  const [angkaDraft, setAngkaDraft] = useState(/** @type {Record<string, string>} */ ({}))
  const [sibukMassal, setSibukMassal] = useState(false)

  const daftarKelas = useQuery({ queryKey: ['kelas'], queryFn: ambilKelas })
  const daftarKuis = useQuery({ queryKey: ['kuis'], queryFn: ambilKuis })

  const opsi = pilihanLingkup({
    sebagaiAdmin,
    daftarKelas: daftarKelas.data ?? [],
    daftarKuis: (daftarKuis.data ?? []).map((kuis) => ({ id: kuis.id, judul: kuis.judul })),
  })

  // Nilai pilihan hanya boleh salah satu dari daftar; sebelum daftarnya tiba,
  // dipakai lingkup awal (sekolah untuk admin, kuis pertama untuk guru).
  const aktif = opsi.some((satu) => satu.nilai === pilihan) ? pilihan : lingkupAwal(opsi, sebagaiAdmin)
  const terpilih = bacaLingkup(aktif)

  const kelasId = terpilih?.kelasId ?? null
  const kuisId = terpilih?.kuisId ?? null

  const resolusi = useQuery({
    queryKey: ['pengaturan', kelasId, kuisId],
    queryFn: () => ambilPengaturan(kelasId, kuisId),
    enabled: terpilih !== null,
  })

  /**
   * Muatan satu kunci untuk lingkup yang sedang dipilih.
   * @param {{ kunci: string, nilai: boolean | number, terkunci: boolean }} muatan
   */
  function muatanSatu(muatan) {
    if (terpilih === null) throw new Error('Pilih lingkup pengaturan dulu.')

    return simpanPengaturan({
      lingkup: terpilih.lingkup,
      lingkup_id: terpilih.lingkupId ?? undefined,
      kunci: muatan.kunci,
      nilai: muatan.nilai,
      // Kunci hanya berlaku di lapis sekolah — lapis itu yang mengalahkan
      // lapis bawahnya.
      terkunci: terpilih.lingkup === 'sekolah' ? muatan.terkunci : false,
      kelas_id: kelasId ?? undefined,
      kuis_id: kuisId ?? undefined,
    })
  }

  const simpan = useMutation({
    mutationFn: muatanSatu,
    onSuccess: async () => {
      tampilkanToast('sukses', 'Pengaturan disimpan.')
      await queryClient.invalidateQueries({ queryKey: ['pengaturan'] })
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  /**
   * Nyalakan/matikan sekelompok saklar sekaligus (mis. semua jenis anti-cheat).
   *
   * API menyimpan per kunci, jadi dipanggil berurutan; saklar yang dikunci
   * sekolah dilewati saat lingkupnya bukan sekolah karena nilainya akan
   * diabaikan — lebih baik dilaporkan daripada disimpan tanpa efek. Satu toast
   * untuk seluruh kelompok supaya tidak membanjiri guru.
   *
   * @param {[string, import('./api.js').NilaiPengaturan][]} daftar
   * @param {boolean} nilai
   */
  async function simpanBanyak(daftar, nilai) {
    if (terpilih === null) return

    setSibukMassal(true)
    let diubah = 0
    let dilewati = 0

    try {
      for (const [kunci, info] of daftar) {
        if (info.terkunci && terpilih.lingkup !== 'sekolah') {
          dilewati += 1
          continue
        }

        await muatanSatu({ kunci, nilai, terkunci: info.terkunci })
        diubah += 1
      }

      const catatan = dilewati > 0 ? ` ${dilewati} dilewati karena dikunci sekolah.` : ''
      tampilkanToast('sukses', `${diubah} pengaturan ${nilai ? 'dinyalakan' : 'dimatikan'}.${catatan}`)
      await queryClient.invalidateQueries({ queryKey: ['pengaturan'] })
    } catch (galat) {
      tampilkanToast('salah', pesanGalatApi(galat))
    } finally {
      setSibukMassal(false)
    }
  }

  const data = resolusi.data
  const adaKuis = (daftarKuis.data ?? []).length > 0

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

          {!sebagaiAdmin && (
            <p className="teks-lembut small">
              Aturan sekolah dan kelas ditetapkan admin. Di sini kamu mengatur aturan{' '}
              <strong>per kuis</strong> milikmu sendiri.
            </p>
          )}

          <div className="mb-4" style={{ maxWidth: '24rem' }}>
            <label className="form-label fw-semibold" htmlFor="lingkup-pengaturan">Lingkup pengaturan</label>
            <select
              id="lingkup-pengaturan"
              className="form-select"
              value={aktif}
              disabled={opsi.length === 0}
              onChange={(e) => {
                setPilihan(e.target.value)
                setAngkaDraft({})
              }}
            >
              {opsi.length === 0 && <option value="">Belum ada lingkup yang bisa diatur</option>}
              {opsi.map((satu) => (
                <option key={satu.nilai} value={satu.nilai}>{satu.label}</option>
              ))}
            </select>
          </div>

          {!adaKuis && daftarKuis.isSuccess && (
            <p className="text-body-secondary">
              Kamu belum punya kuis untuk diatur. Buat kuis dulu di halaman Kuis.
            </p>
          )}

          {resolusi.isLoading && terpilih !== null && <p className="text-body-secondary">Memuat pengaturan…</p>}
          {resolusi.isError && <p className="status-salah">
            Gagal memuat pengaturan. Lingkup ini mungkin bukan milikmu.
          </p>}

          {data && Object.entries(kelompok).map(([namaKelompok, daftar]) => {
            // Saklar (boolean) bisa dinyalakan/dimatikan sekaligus; angka tidak.
            const saklar = daftar.filter(([, info]) => info.tipe === 'boolean')
            const hidup = saklar.filter(([, info]) => info.nilai).length

            return (
            <section key={namaKelompok} className="mb-4">
              <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                {/* Lencana di luar <h2>: di dalamnya ia ikut jadi HURUF BESAR semua. */}
                <div className="me-auto d-flex flex-wrap align-items-center gap-2">
                  <h2 className="h6 fw-bold text-uppercase text-body-secondary mb-0">{namaKelompok}</h2>
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
                        // Saklar yang dikunci sekolah tidak bisa diubah dari lapis
                        // bawah; mematikannya di sini hanya akan menyimpan nilai
                        // yang diabaikan, jadi tombolnya dimatikan saja.
                        disabled={simpan.isPending || sibukMassal || (info.terkunci && terpilih?.lingkup !== 'sekolah')}
                        onChange={(e) => simpan.mutate({ kunci, nilai: e.target.checked, terkunci: info.terkunci })}
                      />
                      <label className="form-check-label small" htmlFor={`set-${kunci}`}>
                        {info.nilai ? 'Aktif' : 'Nonaktif'}
                        {info.terkunci && terpilih?.lingkup !== 'sekolah' ? ' · dikunci sekolah' : ''}
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
                      <Tombol
                        ukuran="sedang"
                        memuat={simpan.isPending}
                        onClick={() => simpan.mutate({
                          kunci,
                          nilai: Number(angkaDraft[kunci] ?? info.nilai),
                          terkunci: info.terkunci,
                        })}
                      >
                        Simpan
                      </Tombol>
                    </div>
                  )}

                  {terpilih?.lingkup === 'sekolah' && (
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
            )
          })}
        </div>
      </div>
    </div>
  )
}
