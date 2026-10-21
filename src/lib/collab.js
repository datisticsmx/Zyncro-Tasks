import { useQuery } from '@tanstack/react-query'
import { api, qs } from './api'

/**
 * Comentarios, adjuntos y bitácora comparten forma entre proyecto y tarea:
 * `scope` es 'projects' o 'tasks' y `id` el id (o clave/ref) del dueño.
 */
export const collabKeys = {
  comments: (scope, id) => ['comments', scope, id],
  attachments: (scope, id) => ['attachments', scope, id],
  activity: (scope, id) => ['activity', scope, id],
}

export function useComments(scope, id) {
  return useQuery({
    queryKey: collabKeys.comments(scope, id),
    queryFn: () => api.get(`/${scope}/${id}/comments${qs({ pageSize: 100 })}`),
  })
}

export function useAttachments(scope, id) {
  return useQuery({
    queryKey: collabKeys.attachments(scope, id),
    queryFn: () => api.get(`/${scope}/${id}/attachments`),
  })
}

export function useActivity(scope, id) {
  return useQuery({
    queryKey: collabKeys.activity(scope, id),
    queryFn: () => api.get(`/${scope}/${id}/activity${qs({ pageSize: 100 })}`),
  })
}

// Debe coincidir con RJBackend/src/zyncro/services/fileType.js (la validación real está allá).
export const ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.docx', '.xlsx', '.pptx',
  '.doc', '.xls', '.ppt', '.zip', '.txt', '.csv', '.md',
]
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

export function formatBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
