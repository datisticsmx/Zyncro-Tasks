/** Colores de la paleta (inspo) por estatus. El color se reserva para estatus y prioridad. */

export const PROJECT_STATUS_COLOR = {
  active: 'lilac',
  paused: 'yellow',
  completed: 'green',
  archived: 'gray',
}

export const TASK_STATUS_COLOR = {
  todo: 'cyan',
  in_progress: 'lilac',
  in_review: 'yellow',
  done: 'green',
  blocked: 'coral',
}

export const PRIORITY_COLOR = { urgent: 'coral', high: 'yellow', medium: 'cyan', low: 'green' }

const DATE_FMT = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

/** 'YYYY-MM-DD' (fecha de calendario) → "15 dic 2026", sin pasar por zonas horarias. */
export function formatDate(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  return DATE_FMT.format(new Date(y, m - 1, d))
}

/** Días de calendario desde hoy (zona del navegador) hasta `iso`; negativo si ya pasó. */
export function daysUntil(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const now = new Date()
  const hoy = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((Date.UTC(y, m - 1, d) - hoy) / 864e5)
}

/**
 * Color de una fecha de vencimiento según los días restantes:
 *   5 o más → blanco · 3–4 → amarillo · 0–2 (incluye hoy) → naranja · vencida → rojo.
 * Lo ya terminado (tarea en Hecho, proyecto completado/archivado) no se colorea.
 */
export function dueTone(iso, { finished = false } = {}) {
  if (!iso || finished) return { tone: 'none', days: null }
  const days = daysUntil(iso)
  if (days < 0) return { tone: 'overdue', days }
  if (days <= 2) return { tone: 'near', days }
  if (days <= 4) return { tone: 'soon', days }
  return { tone: 'ok', days }
}

export function formatRange(start, end, empty) {
  if (!start && !end) return empty
  if (start && end) return `${formatDate(start)} → ${formatDate(end)}`
  return start ? `${formatDate(start)} →` : `→ ${formatDate(end)}`
}
