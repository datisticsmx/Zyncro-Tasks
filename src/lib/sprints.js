/**
 * Sprints: trabajos cortos con su propia lista de actividades, responsables y
 * fechas de entrega. Son un modelo independiente de los proyectos en la API
 * (/sprints, /sprint-tasks); comparten con ellos solo los componentes de
 * tablero, lista y panel de tarea (ver lib/tracker.js).
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api, qs } from './api'
import { daysUntil } from './ui'

export const sprintKeys = {
  all: ['sprints'],
  list: (filters) => ['sprints', 'list', filters],
  detail: (ref) => ['sprints', 'detail', String(ref).toUpperCase()],
}

export function useSprints(filters) {
  return useQuery({
    queryKey: sprintKeys.list(filters),
    queryFn: () => api.get(`/sprints${qs({ ...filters, pageSize: 100 })}`),
    placeholderData: keepPreviousData,
  })
}

export function useSprint(ref) {
  return useQuery({
    queryKey: sprintKeys.detail(ref),
    queryFn: async () => (await api.get(`/sprints/${encodeURIComponent(ref)}`)).sprint,
    enabled: Boolean(ref),
  })
}

/** Columnas del dashboard, en orden. */
export const SPRINT_PHASES = [
  { id: 'overdue', color: 'coral' },
  { id: 'in_progress', color: 'lilac' },
  { id: 'upcoming', color: 'cyan' },
  { id: 'done', color: 'green' },
]

/**
 * En qué columna cae un sprint:
 *   done        → completado/archivado, o todas sus actividades hechas.
 *   overdue     → la fecha fin ya pasó.
 *   upcoming    → aún no empieza.
 *   in_progress → lo demás (incluye los que no tienen fechas).
 */
export function sprintPhase(s) {
  if (['completed', 'archived'].includes(s.status)) return 'done'
  if (s.stats.total > 0 && s.stats.done === s.stats.total) return 'done'
  if (s.endDate && daysUntil(s.endDate) < 0) return 'overdue'
  if (s.startDate && daysUntil(s.startDate) > 0) return 'upcoming'
  return 'in_progress'
}

/** Días de calendario que dura (inicio y fin incluidos), o null sin fechas. */
export function durationDays(start, end) {
  if (!start || !end) return null
  return daysUntil(end) - daysUntil(start) + 1
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
