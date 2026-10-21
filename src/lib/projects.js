import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { api, qs } from './api'

export const projectKeys = {
  all: ['projects'],
  list: (filters) => ['projects', 'list', filters],
  detail: (ref) => ['projects', 'detail', String(ref).toUpperCase()],
}

export function useProjects(filters) {
  return useQuery({
    queryKey: projectKeys.list(filters),
    queryFn: () => api.get(`/projects${qs(filters)}`),
    placeholderData: keepPreviousData,
  })
}

export function useProject(ref) {
  return useQuery({
    queryKey: projectKeys.detail(ref),
    queryFn: async () => (await api.get(`/projects/${encodeURIComponent(ref)}`)).project,
    enabled: Boolean(ref),
  })
}

export function useClientNames(q) {
  return useQuery({
    queryKey: ['client-names', q],
    queryFn: async () => (await api.get(`/projects/client-names${qs({ q })}`)).items,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  })
}

/**
 * Tras cualquier cambio: guarda el detalle devuelto por la API (por clave,
 * que es como lo piden las pantallas) e invalida los listados.
 */
export function useProjectMutation(fn, options = {}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    ...options,
    onSuccess: (data, vars, ctx) => {
      if (data?.project) qc.setQueryData(projectKeys.detail(data.project.key), data.project)
      qc.invalidateQueries({ queryKey: ['projects', 'list'] })
      qc.invalidateQueries({ queryKey: ['client-names'] })
      options.onSuccess?.(data, vars, ctx)
    },
  })
}
