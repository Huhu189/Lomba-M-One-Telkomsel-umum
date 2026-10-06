/**
 * Props bersama seluruh renderer soal objektif.
 *
 * Renderer dipakai tiga tempat: editor guru (pratinjau + kunci), layar murid
 * (tanpa kunci), dan nanti layar pengerjaan (slice 04) yang mengisi `nilai`.
 *
 * @typedef {{
 *   konten: Record<string, unknown>,
 *   kunci?: Record<string, unknown>,
 *   nilai?: unknown,
 *   onUbah?: (nilai: unknown) => void,
 *   dinonaktifkan?: boolean,
 *   tampilkanKunci?: boolean,
 *   nama?: string,
 * }} PropsSoal
 */

export {}
