import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, qs } from './api'
import { trackerOf } from './tracker'

/** Fecha local del navegador (YYYY-MM-DD): define "hoy" y "vencida" (zona del usuario). */
export function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Orden de columnas de RF-TSK-02.
export const STATUSES = ['todo', 'in_progress', 'in_review', 'done', 'blocked']
export const PRIORITIES = ['urgent', 'high', 'medium', 'low']

/**
 * Las hooks reciben `kind` ('project' por defecto o 'sprint'): las tareas de
 * proyecto y las actividades de sprint tienen la misma forma pero viven en
 * APIs separadas (ver lib/tracker.js). board/list van por id (uuid, único en
 * ambos modelos); el detalle va por referencia, que sí puede repetirse
 * (WEB-3 de proyecto y WEB-3 de sprint), así que su llave incluye el kind.
 */
export const taskKeys = {
  all: ['tasks'],
  board: (containerId) => ['tasks', 'board', containerId],
  list: (containerId, filters) => ['tasks', 'list', containerId, filters],
  detail: (ref, kind = 'project') =>
    kind === 'sprint'
      ? ['tasks', 'detail', 'sprint', String(ref).toUpperCase()]
      : ['tasks', 'detail', String(ref).toUpperCase()],
  mine: ['tasks', 'mine'],
}

export function useBoard(projectId, kind = 'project') {
  const tr = trackerOf(kind)
  return useQuery({
    queryKey: taskKeys.board(projectId),
    queryFn: () => api.get(`${tr.api}/${projectId}/tasks${qs({ all: 1, today: localToday() })}`),
    enabled: Boolean(projectId),
  })
}

export function useTaskList(projectId, filters, kind = 'project') {
  const tr = trackerOf(kind)
  return useQuery({
    queryKey: taskKeys.list(projectId, filters),
    queryFn: () => api.get(`${tr.api}/${projectId}/tasks${qs({ ...filters, today: localToday() })}`),
    enabled: Boolean(projectId),
    placeholderData: keepPreviousData,
  })
}

export function useTask(ref, kind = 'project') {
  const tr = trackerOf(kind)
  return useQuery({
    queryKey: taskKeys.detail(ref, kind),
    queryFn: async () => (await api.get(`${tr.taskApi}/${encodeURIComponent(ref)}${qs({ today: localToday() })}`)).task,
    enabled: Boolean(ref),
  })
}

export function useMyTasks() {
  return useQuery({
    queryKey: taskKeys.mine,
    queryFn: () => api.get(`/me/tasks${qs({ today: localToday() })}`),
  })
}

export function useProjectPeople(projectId, kind = 'project') {
  const tr = trackerOf(kind)
  return useQuery({
    queryKey: [tr.scope, 'people', projectId],
    queryFn: async () => (await api.get(`${tr.api}/${projectId}/people`)).items,
    enabled: Boolean(projectId),
    staleTime: 60 * 1000,
  })
}

/**
 * Tras un cambio en una tarea: refresca tablero, listas, "mis tareas", grupos
 * y conteos. `containerKey` es la clave del proyecto (o del sprint, con
 * kind = 'sprint') para refrescar su detalle.
 */
export function invalidateTaskViews(qc, containerKey, kind = 'project') {
  qc.invalidateQueries({ queryKey: ['tasks', 'board'] })
  qc.invalidateQueries({ queryKey: ['tasks', 'list'] })
  qc.invalidateQueries({ queryKey: taskKeys.mine })
  // El progreso de cada grupo depende del estatus de sus tareas.
  qc.invalidateQueries({ queryKey: ['taskGroups'] })
  qc.invalidateQueries({ queryKey: ['projects', 'list'] })
  qc.invalidateQueries({ queryKey: ['sprints', 'list'] })
  qc.invalidateQueries({ queryKey: ['activity'] })
  if (containerKey) {
    qc.invalidateQueries({ queryKey: [trackerOf(kind).scope, 'detail', containerKey.toUpperCase()] })
  }
}

/**
 * Aplica un cambio parcial a una tarea en cualquier caché de tareas, sea su
 * forma { items: [...] } (tablero y listas), { groups: {...} } ("Mis tareas",
 * donde lo hecho desaparece) o la tarea suelta del detalle.
 */
function applyTaskPatch(data, id, patch) {
  if (!data || typeof data !== 'object') return data
  if (Array.isArray(data.items)) {
    return { ...data, items: data.items.map((x) => (x.id === id ? { ...x, ...patch } : x)) }
  }
  if (data.groups && typeof data.groups === 'object') {
    const groups = Object.fromEntries(
      Object.entries(data.groups).map(([k, list]) => [
        k,
        list.map((x) => (x.id === id ? { ...x, ...patch } : x)).filter((x) => x.status !== 'done'),
      ]),
    )
    return { ...data, groups, total: Object.values(groups).reduce((n, l) => n + l.length, 0) }
  }
  if (data.id === id) return { ...data, ...patch }
  return data
}

/**
 * Casilla de "completada": marca Hecho y, al desmarcar, devuelve la tarea a
 * Por hacer. Es una acción inmediata (no un formulario): se pinta al instante
 * en todas las vistas y, si la API falla, se revierte.
 */
export function useToggleDone(projectKey, { onRollback, kind = 'project' } = {}) {
  const qc = useQueryClient()
  return useMutation({
    // La URL sale de la tarea: en "Mis tareas" se mezclan proyectos y sprints.
    mutationFn: ({ task, done }) =>
      api.patch(`${trackerOf(task).taskApi}/${task.id}${qs({ today: localToday() })}`, {
        status: done ? 'done' : 'todo',
      }),
    onMutate: ({ task, done }) => {
      const snapshot = qc.getQueriesData({ queryKey: taskKeys.all })
      const patch = {
        status: done ? 'done' : 'todo',
        overdue: done ? false : task.overdue,
        completedAt: done ? new Date().toISOString() : null,
      }
      qc.setQueriesData({ queryKey: taskKeys.all }, (data) => applyTaskPatch(data, task.id, patch))
      return { snapshot }
    },
    onError: (err, vars, ctx) => {
      for (const [key, data] of ctx?.snapshot || []) qc.setQueryData(key, data)
      onRollback?.(err)
    },
    onSettled: () => invalidateTaskViews(qc, projectKey, kind),
  })
}

/** Mueve una tarea a otro grupo (o la saca, con `groupId` null). */
export function useSetTaskGroup(projectKey) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ task, groupId }) =>
      (await api.patch(`/tasks/${task.id}${qs({ today: localToday() })}`, { group_id: groupId })).task,
    onSuccess: () => invalidateTaskViews(qc, projectKey),
  })
}

export function useCreateTask(projectId, projectKey, kind = 'project') {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) => api.post(`${trackerOf(kind).api}/${projectId}/tasks${qs({ today: localToday() })}`, body),
    onSuccess: () => invalidateTaskViews(qc, projectKey, kind),
  })
}

/** Inserta `task` en la lista plana del tablero junto a sus vecinos (optimista). */
function placeInBoard(items, task, { beforeId, afterId }) {
  const rest = items.filter((x) => x.id !== task.id)
  let idx
  if (beforeId) idx = rest.findIndex((x) => x.id === beforeId) + 1
  else if (afterId) idx = rest.findIndex((x) => x.id === afterId)
  else {
    // Al final de su columna: después de la última tarjeta con ese estatus.
    const last = rest.map((x) => x.status).lastIndexOf(task.status)
    idx = last === -1 ? rest.length : last + 1
  }
  if (idx < 0) idx = rest.length
  return [...rest.slice(0, idx), task, ...rest.slice(idx)]
}

/**
 * RF-VIEW-01 / CA-08: mover con actualización optimista; si la API falla,
 * se restaura el tablero tal como estaba y se avisa.
 */
export function useMoveTask(projectId, projectKey, { onRollback, kind = 'project' } = {}) {
  const qc = useQueryClient()
  const key = taskKeys.board(projectId)
  const tr = trackerOf(kind)
  return useMutation({
    mutationFn: ({ task, status, beforeId, afterId }) =>
      api.patch(`${tr.taskApi}/${task.id}/move${qs({ today: localToday() })}`, { status, beforeId, afterId }),
    onMutate: async ({ task, status, beforeId, afterId }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData(key)
      if (previous) {
        const moved = { ...task, status, overdue: status === 'done' ? false : task.overdue }
        qc.setQueryData(key, { ...previous, items: placeInBoard(previous.items, moved, { beforeId, afterId }) })
      }
      return { previous }
    },
    onError: (err, vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous)
      onRollback?.(err)
    },
    onSuccess: ({ task }) => {
      qc.setQueryData(key, (data) =>
        data ? { ...data, items: data.items.map((x) => (x.id === task.id ? task : x)) } : data,
      )
      qc.invalidateQueries({ queryKey: taskKeys.detail(task.ref, kind) })
      qc.invalidateQueries({ queryKey: ['tasks', 'list'] })
      qc.invalidateQueries({ queryKey: taskKeys.mine })
      qc.invalidateQueries({ queryKey: [tr.scope, 'list'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
      if (projectKey) qc.invalidateQueries({ queryKey: [tr.scope, 'detail', projectKey.toUpperCase()] })
    },
  })
}
