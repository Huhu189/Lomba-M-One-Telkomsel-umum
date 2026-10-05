/**
 * Isian formulir — label selalu terlihat, ikon opsional, bantuan, pesan galat
 * (ikon + teks), dan tombol lihat/sembunyikan untuk kata sandi.
 * Terhubung ke react-hook-form lewat {...register('nama')} (ref diteruskan).
 */
import { forwardRef, useId, useState } from 'react'
import { IkonMata, IkonMataTertutup, IkonPeringatan } from '../../icons.jsx'

/**
 * @typedef {{
 *   label: string,
 *   galat?: string,
 *   bantuan?: string,
 *   ikon?: import('react').ComponentType<{ size?: number, className?: string }>,
 *   type?: string,
 * } & Omit<import('react').InputHTMLAttributes<HTMLInputElement>, 'type'>} PropsIsian
 */

/** @type {import('react').ForwardRefExoticComponent<PropsIsian & import('react').RefAttributes<HTMLInputElement>>} */
const Isian = forwardRef(function Isian(
  { label, galat = '', bantuan = '', ikon: Ikon, type = 'text', id, className = '', ...sisa },
  ref,
) {
  const idOtomatis = useId()
  const idInput = id ?? `isian-${idOtomatis}`
  const idBantuan = `${idInput}-bantuan`
  const idGalat = `${idInput}-galat`
  const [terlihat, setTerlihat] = useState(false)

  const adalahSandi = type === 'password'
  const tipeNyata = adalahSandi && terlihat ? 'text' : type
  const describedBy =
    [galat ? idGalat : '', bantuan ? idBantuan : ''].filter(Boolean).join(' ') || undefined

  return (
    <div className="isian">
      <label className="isian-label" htmlFor={idInput}>
        {label}
      </label>
      <div className={`isian-kotak ${Ikon ? 'ada-ikon' : ''} ${adalahSandi ? 'ada-aksi' : ''}`}>
        {Ikon && <Ikon size={20} className="isian-ikon" />}
        <input
          ref={ref}
          id={idInput}
          type={tipeNyata}
          className={`form-control ${className}`.trim()}
          aria-invalid={galat ? true : undefined}
          aria-describedby={describedBy}
          {...sisa}
        />
        {adalahSandi && (
          <button
            type="button"
            className="isian-aksi"
            onClick={() => setTerlihat((t) => !t)}
            aria-label={terlihat ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
            aria-pressed={terlihat}
          >
            {terlihat ? <IkonMataTertutup size={22} /> : <IkonMata size={22} />}
          </button>
        )}
      </div>
      {bantuan && !galat && (
        <p className="isian-bantuan" id={idBantuan}>
          {bantuan}
        </p>
      )}
      {galat && (
        <p className="isian-galat" id={idGalat} role="alert">
          <IkonPeringatan size={18} />
          <span>{galat}</span>
        </p>
      )}
    </div>
  )
})

export default Isian
