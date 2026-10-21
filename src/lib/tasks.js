import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, qs } from './api'

/** Fecha local del navegador (YYYY-MM-DD): define "hoy" y "vencida" (zona del usuario). */
export function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Orden de columnas de RF-TSK-02.
export const STATUSES = ['todo', 'in_progress', 'in_review', 'done', 'blocked']
export const PRIORITIES = ['urgent', 'high', 'medium', 'low']

export const taskKeys = {
  all: ['tasks'],
  board: (projectId) => ['tasks', 'board', projectId],
  list: (projectId, filters) => ['tasks', 'list', projectId, filters],
  detail: (ref) => ['tasks', 'detail', String(ref).toUpperCase()],
  mine: ['tasks', 'mine'],
}

export function useBoard(projectId) {
  return useQuery({
    queryKey: taskKeys.board(projectId),
    queryFn: () => api.get(`/projects/${projectId}/tasks${qs({ all: 1, today: localToday() })}`),
    enabled: Boolean(projectId),
  })
}

export function useTaskList(projectId, filters) {
  return useQuery({
    queryKey: taskKeys.list(projectId, filters),
    queryFn: () => api.get(`/projects/${projectId}/tasks${qs({ ...filters, today: localToday() })}`),
    enabled: Boolean(projectId),
    placeholderData: keepPreviousData,
  })
}

export function useTask(ref) {
  return useQuery({
    queryKey: taskKeys.detail(ref),
    queryFn: async () => (await api.get(`/tasks/${encodeURIComponent(ref)}${qs({ today: localToday() })}`)).task,
    enabled: Boolean(ref),
  })
}

export function useMyTasks() {
  return useQuery({
    queryKey: taskKeys.mine,
    queryFn: () => api.get(`/me/tasks${qs({ today: localToday() })}`),
  })
}

export function useProjectPeople(projectId) {
  return useQuery({
    queryKey: ['projects', 'people', projectId],
    queryFn: async () => (await api.get(`/projects/${projectId}/people`)).items,
    enabled: Boolean(projectId),
    staleTime: 60 * 1000,
  })
}

/** Tras un cambio en una tarea: refresca tablero, listas, "mis tareas" y conteos del proyecto. */
export function invalidateTaskViews(qc, projectKey) {
  qc.invalidateQueries({ queryKey: ['tasks', 'board'] })
  qc.invalidateQueries({ queryKey: ['tasks', 'list'] })
  qc.invalidateQueries({ queryKey: taskKeys.mine })
  qc.invalidateQueries({ queryKey: ['projects', 'list'] })
  qc.invalidateQueries({ queryKey: ['activity'] })
  if (projectKey) qc.invalidateQueries({ queryKey: ['projects', 'detail', projectKey.toUpperCase()] })
}

export function useCreateTask(projectId, projectKey) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) => api.post(`/projects/${projectId}/tasks${qs({ today: localToday() })}`, body),
    onSuccess: () => invalidateTaskViews(qc, projectKey),
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
export function useMoveTask(projectId, projectKey, { onRollback } = {}) {
  const qc = useQueryClient()
  const key = taskKeys.board(projectId)
  return useMutation({
    mutationFn: ({ task, status, beforeId, afterId }) =>
      api.patch(`/tasks/${task.id}/move${qs({ today: localToday() })}`, { status, beforeId, afterId }),
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
      qc.invalidateQueries({ queryKey: taskKeys.detail(task.ref) })
      qc.invalidateQueries({ queryKey: ['tasks', 'list'] })
      qc.invalidateQueries({ queryKey: taskKeys.mine })
      qc.invalidateQueries({ queryKey: ['projects', 'list'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
      if (projectKey) qc.invalidateQueries({ queryKey: ['projects', 'detail', projectKey.toUpperCase()] })
    },
  })
}
