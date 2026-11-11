import { PROJECT_STATUS_COLOR } from './ui'

/** Colores preestablecidos para proyectos: la paleta de tarjetas (inspo). */
export const PROJECT_COLORS = [
  { id: 'lilac', hex: '#c9a5f7', label: 'Lila' },
  { id: 'yellow', hex: '#f7f38a', label: 'Amarillo' },
  { id: 'coral', hex: '#ff8b7b', label: 'Coral' },
  { id: 'cyan', hex: '#7fe3f0', label: 'Cian' },
  { id: 'green', hex: '#9ef0a0', label: 'Verde' },
  { id: 'pink', hex: '#f7a8cf', label: 'Rosa' },
]

export const DEFAULT_PROJECT_COLOR = PROJECT_COLORS[0].hex

const STATUS_HEX = {
  cyan: '#7fe3f0',
  lilac: '#c9a5f7',
  yellow: '#f7f38a',
  green: '#9ef0a0',
  gray: '#d9d9de',
}

/** Nombre del preset si el hex coincide ("Coral"), si no el hex. */
export function colorLabel(hex) {
  return PROJECT_COLORS.find((c) => c.hex === hex)?.label || hex
}

/** Color principal del proyecto; sin color propio, el de su estatus (comportamiento anterior). */
export function projectColor(p) {
  return p?.color || STATUS_HEX[PROJECT_STATUS_COLOR[p?.status]] || STATUS_HEX.lilac
}

/** true si el fondo es oscuro y el texto debe ir claro (luminancia relativa WCAG). */
export function isDarkColor(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return false
  const n = parseInt(m[1], 16)
  const lin = (c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
  // Por encima del cruce teórico (~0.18): los tonos medios (rojo, verde, gris)
  // se leen mejor con texto blanco. Los presets (L ≥ 0.4) quedan con negro.
  return L < 0.3
}
