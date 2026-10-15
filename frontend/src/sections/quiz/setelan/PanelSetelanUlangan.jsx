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
import { ambilPengaturan, simpanPengaturan } from '../../settings/api.js'
import { pesanGalatApi } from '../../auth/api.js'
import { useAuthStore } from '../../auth/authStore.js'
import { tampilkanToast } from '../../../shared/ui/toast.jsx'
import Banner from '../../../shared/ui/Banner.jsx'
import Skeleton from '../../../shared/ui/Skeleton.jsx'

/**
 * @param {{ kuisId: number }} props
 */
export default function PanelSetelanUlangan({ kuisId }) {
  const queryClient = useQueryClient()
  const peran = useAuthStore((s) => s.user?.role ?? '')
  const [angkaDraft, setAngkaDraft] = useState(/** @type {Record<string, string>} */ ({}))

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

  const data = resolusi.data

  /**
   * Boleh mengubah atau tidak — dibaca dari SERVER (`boleh_ubah`), bukan ditebak
   * dari peran klien.
   *
   * Sebelumnya panel ini selalu menampilkan saklar yang bisa ditekan, walau
   * pemakainya (mis. kepala sekolah) tidak berhak menyimpannya: setiap tik
   * berakhir 403 tanpa satu pun nilai tersimpan. Guru yang mencobanya karena itu
   * wajar bertanya "apakah setelannya masuk?" — dan jawabannya tidak. Sekarang
   * saklarnya dimatikan beserta sebabnya, jadi tidak ada lagi panel yang menjanjikan
   * sesuatu yang server tolak.
   */
  const bolehUbah = data?.boleh_ubah !== false

  /** Hanya setelan yang ditawarkan ke guru; sisanya tetap berlaku dengan nilai bawaan. */
  const peta = Object.fromEntries(
    Object.entries(data?.pengaturan ?? {}).filter(([, info]) => info.tampil !== false),
  )

  if (resolusi.isPending) return <Skeleton judul baris={4} label="Memuat setelan ulangan…" />

  if (resolusi.isError) {
    return (
      <p className="status-salah mb-0">
        Gagal memuat setelan ulangan ini. Kuis ini mungkin bukan milikmu.
      </p>
    )
  }

  const nonaktif = simpan.isPending || !bolehUbah

  /**
   * Dipanggil sebagai fungsi (bukan komponen) supaya kotak angka tidak kehilangan
   * fokus.
   *
   * Satu baris saklar: judul, penjelasan singkat, saklar di kanan.
   *
   * @param {string} kunci
   * @param {boolean} [anak] baris menjorok di bawah saklar induknya
   */
  function saklar(kunci, anak = false) {
    const info = peta[kunci]
    if (!info) return null
    const dikunci = info.terkunci
    const teks = TEKS[kunci] ?? { judul: info.label, ket: '' }

    return (
      <div className={`setelan-baris ${anak ? 'setelan-anak' : ''}`}>
        <label className="setelan-teks" htmlFor={`set-${kunci}`}>
          <span className="fw-semibold">{teks.judul}</span>
          {teks.ket && <span className="small teks-lembut d-block">{teks.ket}</span>}
          {dikunci && <span className="badge-status lembut mt-1">Dikunci sekolah</span>}
        </label>
        <div className="form-check form-switch m-0">
          <input
            className="form-check-input"
            type="checkbox"
            role="switch"
            id={`set-${kunci}`}
            aria-label={`${teks.judul}: ${info.nilai ? 'aktif' : 'nonaktif'}`}
            checked={Boolean(info.nilai)}
            disabled={nonaktif || dikunci}
            onChange={(e) => simpan.mutate({ kunci, nilai: e.target.checked, terkunci: false })}
          />
        </div>
      </div>
    )
  }

  /**
   * Satu baris angka; tersimpan saat kotak ditinggalkan atau Enter ditekan.
   *
   * @param {string} kunci
   * @param {string} [satuan] satuan yang ditulis di kanan kotak (mis. "kali")
   * @param {number} [maks] batas atas yang juga dijaga di sisi klien
   */
  function angka(kunci, satuan = '', maks) {
    const info = peta[kunci]
    if (!info) return null
    const teks = TEKS[kunci] ?? { judul: info.label, ket: '' }
    const nilaiTampil = angkaDraft[kunci] ?? String(info.nilai)

    function simpanAngka() {
      if (angkaDraft[kunci] === undefined) return
      let hasil = Math.max(0, Math.floor(Number(angkaDraft[kunci])))
      if (!Number.isFinite(hasil)) hasil = Number(info.nilai)
      if (maks !== undefined) hasil = Math.min(maks, hasil)
      setAngkaDraft((lama) => {
        const baru = { ...lama }
        delete baru[kunci]
        return baru
      })
      if (hasil !== Number(info.nilai)) simpan.mutate({ kunci, nilai: hasil, terkunci: false })
    }

    return (
      <div className="setelan-baris setelan-anak">
        <label className="setelan-teks" htmlFor={`set-${kunci}`}>
          <span className="fw-semibold">{teks.judul}</span>
          {teks.ket && <span className="small teks-lembut d-block">{teks.ket}</span>}
          {info.terkunci && <span className="badge-status lembut mt-1">Dikunci sekolah</span>}
        </label>
        <div className="input-group input-group-sm setelan-angka">
          <input
            id={`set-${kunci}`}
            type="number"
            min={0}
            max={maks}
            inputMode="numeric"
            className="form-control"
            value={nilaiTampil}
            disabled={nonaktif || info.terkunci}
            onChange={(e) => setAngkaDraft({ ...angkaDraft, [kunci]: e.target.value })}
            onBlur={simpanAngka}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
          {satuan && <span className="input-group-text">{satuan}</span>}
        </div>
      </div>
    )
  }

  // Setelan lanjutan yang disembunyikan tetapi masih menyimpang dari bawaan
  // (mis. diaktifkan guru sebelum panel disederhanakan): beri tahu dan sediakan
  // jalan mengembalikannya, supaya tidak ada aturan "gaib" yang tak bisa dimatikan.
  const lanjutanAktif = Object.entries(data?.pengaturan ?? {}).filter(
    ([, info]) => info.tampil === false && info.tipe === 'boolean' && info.nilai !== info.bawaan && !info.terkunci,
  )

  async function kembalikanLanjutan() {
    try {
      for (const [kunci, info] of lanjutanAktif) {
        await muatanSatu({ kunci, nilai: Boolean(info.bawaan), terkunci: false })
      }
      tampilkanToast('sukses', 'Setelan lanjutan dikembalikan ke bawaan.')
      await queryClient.invalidateQueries({ queryKey: ['pengaturan'] })
    } catch (galat) {
      tampilkanToast('salah', pesanGalatApi(galat))
    }
  }

  const retryAktif = Boolean(peta.retry?.nilai)
  const antiCheatAktif = Boolean(peta.anti_cheat?.nilai)

  return (
    <div className="setelan-panel">
      {!bolehUbah && (
        <Banner jenis="info" judul="Hanya bisa dibaca">
          {peran === 'admin'
            ? 'Kepala sekolah hanya melihat: setelan ulangan diubah guru pemilik kuis ini.'
            : 'Setelan ulangan hanya bisa diubah guru pemilik kuis ini.'}
        </Banner>
      )}

      {bolehUbah && lanjutanAktif.length > 0 && (
        <Banner jenis="info" judul={`${lanjutanAktif.length} setelan lanjutan masih aktif`}>
          Kuis ini masih memakai {lanjutanAktif.length} aturan rinci yang tidak lagi ditampilkan di
          panel (misalnya blokir klik kanan atau bonus semangat).{' '}
          <button type="button" className="btn btn-link p-0 align-baseline" disabled={nonaktif} onClick={() => void kembalikanLanjutan()}>
            Kembalikan ke bawaan
          </button>
        </Banner>
      )}

      <section className="setelan-kartu">
        <h3 className="setelan-judul">Pengerjaan</h3>
        {saklar('retry')}
        {retryAktif && angka('batas_percobaan', 'kali', 50)}
        {saklar('remedial')}
        {saklar('mode_tim')}
        {saklar('izinkan_tamu')}
        {peta.izinkan_tamu?.nilai && (
          <p className="small teks-lembut setelan-catatan">
            Pintu tamu baru terbuka setelah kuis diterbitkan.
          </p>
        )}
      </section>

      <section className="setelan-kartu">
        <h3 className="setelan-judul">Hasil &amp; tampilan</h3>
        {saklar('ranking')}
        {saklar('layar_guru')}
        {angka('ambang_paham', '%', 100)}
      </section>

      <section className="setelan-kartu">
        <h3 className="setelan-judul">Anti-cheat</h3>
        {saklar('anti_cheat')}
        {antiCheatAktif && (
          <>
            {saklar('block_paste', true)}
            {saklar('block_tab_switch', true)}
            {saklar('block_devtools', true)}
          </>
        )}
      </section>

      <p className="small teks-lembut mb-0">
        Perubahan tersimpan otomatis. Setelan yang dikunci sekolah tidak bisa diubah di sini.
      </p>
    </div>
  )
}

/**
 * Judul & penjelasan singkat tiap setelan yang ditawarkan.
 *
 * @type {Record<string, { judul: string, ket: string }>}
 */
const TEKS = {
  retry: { judul: 'Boleh mengulang', ket: 'Murid bisa mengerjakan lagi setelah selesai.' },
  batas_percobaan: { judul: 'Batas percobaan', ket: 'Jumlah maksimal pengerjaan per murid.' },
  remedial: { judul: 'Remedial', ket: 'Tawarkan soal remedial untuk yang belum paham.' },
  mode_tim: { judul: 'Mode tim', ket: 'Murid mengerjakan berkelompok.' },
  izinkan_tamu: { judul: 'Siswa tamu', ket: 'Boleh ikut tanpa akun, cukup menulis nama.' },
  ranking: { judul: 'Tampilkan peringkat', ket: 'Papan peringkat terlihat di kelas.' },
  layar_guru: { judul: 'Layar guru', ket: 'Tampilan pantau untuk diproyeksikan.' },
  ambang_paham: { judul: 'Batas paham', ket: 'Nilai minimal agar dianggap paham.' },
  anti_cheat: { judul: 'Aktifkan anti-cheat', ket: 'Pantau dan batasi perilaku mencurigakan saat ujian.' },
  block_paste: { judul: 'Blokir tempel jawaban', ket: '' },
  block_tab_switch: { judul: 'Catat pindah tab', ket: '' },
  block_devtools: { judul: 'Deteksi alat pengembang', ket: '' },
}
