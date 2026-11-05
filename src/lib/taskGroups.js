/**
 * Grupos de tareas ("checklists") de un proyecto: /projects/:id/task-groups
 * y /task-groups/:id. Un grupo junta N tareas bajo un título y lleva su
 * progreso (hechas / total); las tareas sin grupo caen en "Sin grupo".
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import { invalidateTaskViews } from './tasks'

export const groupKeys = {
  all: ['taskGroups'],
  list: (projectId) => ['taskGroups', projectId],
}

export function useTaskGroups(projectId) {
  return useQuery({
    queryKey: groupKeys.list(projectId),
    queryFn: async () => (await api.get(`/projects/${projectId}/task-groups`)).items,
    enabled: Boolean(projectId),
  })
}

/** Refresca los grupos (su progreso depende del estatus de las tareas). */
export function invalidateGroups(qc, projectId) {
  qc.invalidateQueries({ queryKey: projectId ? groupKeys.list(projectId) : groupKeys.all })
}

export function useCreateGroup(projectId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name) => (await api.post(`/projects/${projectId}/task-groups`, { name })).group,
    onSuccess: () => invalidateGroups(qc, projectId),
  })
}

/** Renombrar (`{ name }`) o reordenar (`{ beforeId, afterId }`). */
export function useUpdateGroup(projectId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }) => (await api.patch(`/task-groups/${id}`, body)).group,
    onSuccess: () => invalidateGroups(qc, projectId),
  })
}

/** Elimina el grupo; sus tareas quedan en "Sin grupo" (no se borran). */
export function useDeleteGroup(projectId, projectKey) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.del(`/task-groups/${id}`),
    onSuccess: () => {
      invalidateGroups(qc, projectId)
      invalidateTaskViews(qc, projectKey)
    },
  })
}
