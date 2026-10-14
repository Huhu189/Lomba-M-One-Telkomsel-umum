/**
 * Layar kelas untuk guru (slice 10) — layar kendali, bukan layar tontonan.
 *
 * Guru memilih satu keadaan (kosong / pengumuman / sorot soal / instruksi
 * setelah ulangan), lalu setiap perubahan langsung disiarkan ke perangkat murid
 * kelas itu lewat kanal kuis yang sama dengan Monitor Ulangan.
 *
 * Beberapa keputusan yang terlihat di layar ini:
 * - **tanpa kunci jawaban**: pratinjau dan payload sengaja tidak memuat kunci,
 *   karena layar kelas bisa terlihat dari arah mana pun;
 * - **keadaan penuh, bukan tambalan**: tombol "Kosongkan layar" mengembalikan
 *   perangkat murid ke tampilan ulangan biasa tanpa menghapus riwayat;
 * - **polling tetap jalan**: perubahan dari perangkat lain tetap terlihat walau
 *   SSE di perangkat guru tidak dipakai;
 * - **papan peringkat bukan jalur pintas** (14 Oktober 2026): mode itu tidak
 *   membawa isi papan dari sini; perangkat murid mengambil papan yang sama
 *   dengan halaman peringkatnya sendiri, jadi nomor di luar N% teratas tetap
 *   tertutup.
 */
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import Banner from '../../shared/ui/Banner.jsx'
import { TombolTaut } from '../../shared/ui/Tombol.jsx'
import { IkonPanahKiri } from '../../icons.jsx'
import { Tombol } from '../../shared/ui/Tombol.jsx'
import { tampilkanToast } from '../../shared/ui/toast.jsx'
import { pesanGalatApi } from '../auth/api.js'
import { RUTE, kunciKuisSah, ruteKuisDetail, ruteMonitorKuis } from '../../routes.js'
import { MODE_PERIANGKAT, bolehSimpan, butuhSoal, butuhTulisan, simpanLayar, tanpaTulisan } from './layar.js'
import useLayar from './useLayar.js'

export default function HalamanLayar() {
  const { slug } = useParams()
  const kunci = kunciKuisSah(slug)
  const klienQuery = useQueryClient()

  const { data, isLoading, isError, statusSse } = useLayar(kunci, { peran: 'guru' })
  const [draf, setDraf] = useState(/** @type {null | Record<string, any>} */ (null))

  // Sinkronisasi state turunan saat render: form hanya disegarkan ketika VERSI
  // keadaan berubah (perubahan dari perangkat lain), bukan pada setiap refetch —
  // kalau tidak, tulisan guru yang sedang diketik akan tertimpa.
  if (data !== undefined && (draf === null || draf.versi !== data.versi)) {
    setDraf({
      versi: data.versi,
      mode: data.mode,
      judul: data.judul ?? '',
      isi: data.isi ?? '',
      soalId: data.soal?.id ?? null,
    })
  }

  const simpan = useMutation({
    mutationFn: () => {
      const d = draf

      if (d === null) throw new Error('Layar kelas belum siap.')

      // Keadaan penuh dikirim apa adanya: server tidak menambal, jadi tulisan
      // yang dikosongkan guru memang ikut dikosongkan di perangkat murid.
      const judul = d.judul.trim()
      const isi = d.isi.trim()

      return simpanLayar(kunci, {
        mode: d.mode,
        judul: judul === '' ? null : judul,
        isi: isi === '' ? null : isi,
        question_id: butuhSoal(d.mode) ? d.soalId : null,
      })
    },
    onSuccess: (hasil) => {
      tampilkanToast('sukses', `Layar kelas diperbarui (${hasil.mode_label}).`)
      void klienQuery.invalidateQueries({ queryKey: ['layar', kunci] })
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  if (isLoading) {
    return <p className="text-body-secondary">Menyiapkan layar kelas…</p>
  }

  if (isError || data === undefined || draf === null) {
    return (
      <Banner jenis="salah" judul="Layar kelas belum bisa dibuka">
        <p className="mb-0">Halaman ini khusus guru pemilik kuis.</p>
      </Banner>
    )
  }

  const daftarMode = data.daftar_mode ?? []
  const daftarSoal = data.daftar_soal ?? []
  const terpilih = daftarSoal.find((satu) => satu.id === draf.soalId) ?? null
  const siapSimpan = bolehSimpan({
    mode: draf.mode,
    judul: draf.judul,
    isi: draf.isi,
    soalId: draf.soalId,
  })

  const lencanaSse =
    statusSse === 'hidup'
      ? { kelas: 'sukses', teks: 'Langsung (SSE)' }
      : { kelas: 'lembut', teks: 'Polling 5 detik' }

  /**
   * Ubah satu bidang draf tanpa menyentuh versi (versi = kunci penyegaran,
   * jadi form tidak ditimpa oleh data server yang baru tiba).
   *
   * @param {string} bidang
   * @param {unknown} nilai
   */
  function ubah(bidang, nilai) {
    setDraf((sebelum) => (sebelum === null ? sebelum : { ...sebelum, [bidang]: nilai }))
  }

  return (
    <div className="row justify-content-center">
      <div className="col-lg-10">
        <div className="kartu-soft p-4 p-md-5">
          <TombolTaut
            varian="tepi"
            ikon={IkonPanahKiri}
            className="mb-3"
            to={ruteKuisDetail(kunci)}
          >
            Kembali ke detail kuis
          </TombolTaut>

          <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
            <div className="me-auto">
              <h1 className="h5 fw-bold mb-1">Layar kelas · {data.judul_kuis ?? 'Ulangan'}</h1>
              <p className="teks-lembut small mb-0">
                {data.kelas_nama ?? '—'} · apa pun yang kamu pilih di sini langsung tampil di perangkat murid.
              </p>
            </div>
            <span className={`badge-status ${lencanaSse.kelas}`}>{lencanaSse.teks}</span>
          </div>

          <p className="small mb-3">
            <span className="badge-status lembut">Keadaan sekarang</span> {data.mode_label} · pembaruan ke-{data.versi}
          </p>

          {!data.aktif && (
            <Banner jenis="peringatan" judul="Layar guru sedang dimatikan">
              <p className="mb-0">
                Nyalakan kunci <strong>layar guru</strong> di{' '}
                <Link to={ruteKuisDetail(kunci)}>setelan ulangan kuis ini</Link> dulu (aturan sekolah dan
                kelas tetap berlaku di atasnya). Selama mati, murid tidak menerima apa pun dan
                perubahan ditolak server.
              </p>
            </Banner>
          )}

          <div className="row g-4">
            <div className="col-lg-7">
              <div className="kartu-lembut p-3">
                <label className="form-label fw-semibold" htmlFor="mode-layar">
                  Tampilkan apa di perangkat murid?
                </label>
                <select
                  id="mode-layar"
                  className="form-select mb-3"
                  value={draf.mode}
                  disabled={!data.aktif || simpan.isPending}
                  onChange={(e) => ubah('mode', e.target.value)}
                >
                  {daftarMode.map((mode) => (
                    <option key={mode.nilai} value={mode.nilai}>
                      {mode.label}
                    </option>
                  ))}
                </select>

                {butuhSoal(draf.mode) && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold" htmlFor="soal-layar">
                      Soal yang disorot
                    </label>
                    <select
                      id="soal-layar"
                      className="form-select"
                      value={draf.soalId ?? ''}
                      disabled={!data.aktif || simpan.isPending}
                      onChange={(e) => ubah('soalId', e.target.value === '' ? null : Number(e.target.value))}
                    >
                      <option value="">— pilih soal —</option>
                      {daftarSoal.map((soal) => (
                        <option key={soal.id} value={soal.id}>
                          Soal {soal.nomor} · {soal.ringkas === '' ? '(tanpa teks)' : soal.ringkas}
                        </option>
                      ))}
                    </select>
                    <p className="teks-lembut small mb-0 mt-1">
                      Isi soal ditampilkan utuh di perangkat murid — tanpa kunci jawaban.
                    </p>
                  </div>
                )}

                <div className="mb-3">
                  <label className="form-label fw-semibold" htmlFor="judul-layar">
                    Judul {butuhTulisan(draf.mode) ? '' : tanpaTulisan(draf.mode) ? '(tidak dipakai mode ini)' : '(opsional)'}
                  </label>
                  <input
                    id="judul-layar"
                    className="form-control"
                    value={draf.judul}
                    maxLength={data.maks_judul ?? 120}
                    disabled={!data.aktif || simpan.isPending || tanpaTulisan(draf.mode)}
                    onChange={(e) => ubah('judul', e.target.value)}
                    placeholder="mis. Sisa waktu 10 menit"
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold" htmlFor="isi-layar">
                    Isi {butuhTulisan(draf.mode) ? '' : tanpaTulisan(draf.mode) ? '(tidak dipakai mode ini)' : '(opsional)'}
                  </label>
                  <textarea
                    id="isi-layar"
                    className="form-control"
                    rows={3}
                    value={draf.isi}
                    maxLength={data.maks_isi ?? 1000}
                    disabled={!data.aktif || simpan.isPending || tanpaTulisan(draf.mode)}
                    onChange={(e) => ubah('isi', e.target.value)}
                    placeholder="Kalimat singkat; baris baru tetap dipertahankan."
                  />
                </div>

                <div className="d-flex flex-wrap gap-2">
                  <Tombol
                    memuat={simpan.isPending}
                    teksMemuat="Menyiarkan…"
                    disabled={!data.aktif || !siapSimpan}
                    onClick={() => simpan.mutate()}
                  >
                    Tampilkan di perangkat murid
                  </Tombol>
                  <Tombol
                    varian="tepi"
                    disabled={!data.aktif || simpan.isPending || draf.mode === 'kosong'}
                    onClick={() =>
                      // Keadaan penuh: mode kosong berarti tidak ada yang tampil,
                      // dan tulisan sebelumnya tidak dibiarkan menggantung.
                      setDraf({ ...draf, mode: 'kosong', judul: '', isi: '', soalId: null })
                    }
                  >
                    Kosongkan layar
                  </Tombol>
                </div>

                {!siapSimpan && data.aktif && (
                  <p className="status-salah small mb-0 mt-2">
                    {butuhSoal(draf.mode)
                      ? 'Pilih dulu soal yang mau disorot.'
                      : 'Tulis judul atau isi supaya murid tahu maksudnya.'}
                  </p>
                )}
              </div>
            </div>

            <div className="col-lg-5">
              <h2 className="h6 fw-bold">Yang dilihat murid</h2>

              {draf.mode === 'kosong' && (
                <p className="teks-lembut small">
                  Perangkat murid menampilkan ulangan seperti biasa — tidak ada tambahan apa pun.
                </p>
              )}

              {butuhTulisan(draf.mode) && (
                <Banner jenis={draf.mode === 'hasil' ? 'sukses' : 'info'} judul={draf.judul === '' ? '(tanpa judul)' : draf.judul}>
                  {draf.isi !== '' && (
                    <p className="mb-0" style={{ whiteSpace: 'pre-line' }}>
                      {draf.isi}
                    </p>
                  )}
                </Banner>
              )}

              {draf.mode === MODE_PERIANGKAT && (
                <div className="kartu-lembut p-3">
                  <p className="fw-semibold mb-1">Papan peringkat kelas</p>
                  <p className="teks-lembut small mb-0">
                    Papan yang tampil di perangkat murid <strong>sama persis</strong> dengan papan di
                    halaman peringkat miliknya: nomor peringkat hanya untuk N% teratas, dan yang di
                    bawahnya tetap melihat skornya sendiri.
                  </p>
                  <p className="teks-lembut small mb-0 mt-2">
                    Kalau ranking sedang dimatikan, murid melihat keterangan itu apa adanya — bukan papan
                    kosong tanpa penjelasan. Jejak bonus penyemangat tetap tidak ikut ke murid.
                  </p>
                </div>
              )}

              {butuhSoal(draf.mode) && (
                <div className="kartu-lembut p-3">
                  {terpilih === null ? (
                    <p className="teks-lembut small mb-0">Belum ada soal yang dipilih.</p>
                  ) : (
                    <>
                      <p className="fw-semibold mb-1">Soal nomor {terpilih.nomor}</p>
                      <p className="teks-lembut small mb-0">
                        {terpilih.ringkas === '' ? '(tanpa teks)' : terpilih.ringkas}
                      </p>
                      <p className="teks-lembut small mb-0 mt-2">
                        Soal lengkap (opsi & gambar) tampil di perangkat murid.
                      </p>
                    </>
                  )}
                </div>
              )}

              <p className="teks-lembut small mt-3 mb-0">
                Perangkat murid mengikuti layar ini otomatis; kalau koneksi langsungnya gagal, mereka tetap
                menyusul lewat pembaruan berkala.
              </p>

              <TombolTaut varian="tepi" className="mt-3" to={ruteMonitorKuis(data.kuis_id)}>
                Buka Monitor Ulangan
              </TombolTaut>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
