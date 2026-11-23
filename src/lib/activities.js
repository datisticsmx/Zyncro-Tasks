/**
 * Actividades: "mini proyectos" de un par de días, normalmente a cargo de una
 * persona y con una lista de tareas. En la API son proyectos con
 * type = 'activity' y un responsable (owner_id), así que reutilizan tareas,
 * tablero, checklist, comentarios y adjuntos.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api, qs } from './api'
import { daysUntil } from './ui'

export const activityKeys = {
  all: ['projects', 'list', 'activities'],
  list: (filters) => ['projects', 'list', 'activities', filters],
}

export function useActivities(filters) {
  return useQuery({
    queryKey: activityKeys.list(filters),
    queryFn: () => api.get(`/projects${qs({ ...filters, type: 'activity', pageSize: 100 })}`),
    placeholderData: keepPreviousData,
  })
}

/** Columnas del dashboard, en orden. */
export const ACTIVITY_PHASES = [
  { id: 'overdue', color: 'coral' },
  { id: 'in_progress', color: 'lilac' },
  { id: 'upcoming', color: 'cyan' },
  { id: 'done', color: 'green' },
]

/**
 * En qué columna cae una actividad:
 *   done        → completada/archivada, o todas sus tareas hechas.
 *   overdue     → la fecha fin ya pasó.
 *   upcoming    → aún no empieza.
 *   in_progress → lo demás (incluye las que no tienen fechas).
 */
export function activityPhase(a) {
  if (['completed', 'archived'].includes(a.status)) return 'done'
  if (a.stats.total > 0 && a.stats.done === a.stats.total) return 'done'
  if (a.endDateTentative && daysUntil(a.endDateTentative) < 0) return 'overdue'
  if (a.startDate && daysUntil(a.startDate) > 0) return 'upcoming'
  return 'in_progress'
}

/** Días de calendario que dura (inicio y fin incluidos), o null sin fechas. */
export function durationDays(start, end) {
  if (!start || !end) return null
  return daysUntil(end) - daysUntil(start) + 1
}

/** 'YYYY-MM-DD' + n días. */
export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d + n)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * Clave sugerida (2–6 letras) a partir del nombre: iniciales de las palabras
 * o, con una sola palabra, sus primeras letras. Sin acentos ni números.
 */
export function suggestKey(name) {
  const words = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  // Sin conectores cortos ("de", "la"…), salvo que sea todo lo que hay.
  const long = words.filter((w) => !STOPWORDS.has(w))
  const pick = long.length > 0 ? long : words
  if (pick.length === 0) return ''
  if (pick.length === 1) return pick[0].slice(0, 4).padEnd(2, 'X')
  return pick
    .map((w) => w[0])
    .join('')
    .slice(0, 6)
}

const STOPWORDS = new Set(['DE', 'DEL', 'LA', 'LAS', 'EL', 'LOS', 'Y', 'E', 'EN', 'A', 'AL', 'PARA', 'POR', 'CON', 'UN', 'UNA'])
