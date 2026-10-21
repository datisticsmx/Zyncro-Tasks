import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { api } from './api'

export const ME_KEY = ['me']

/**
 * Usuario en sesión, o null si no hay sesión (solo con 401).
 *
 * Un error de red o 5xx NO significa "sin sesión" (p. ej. el backend se está
 * reiniciando): se reintenta con espera creciente hasta ~1 min antes de
 * rendirse, y mientras tanto las pantallas muestran "reconectando".
 */
export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        const { user } = await api.get('/me')
        return user
      } catch (err) {
        if (err.status === 401) return null
        throw err
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: (count) => count < 15,
    retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 5000),
  })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) => api.post('/auth/login', body),
    onSuccess: ({ user }) => {
      qc.clear()
      qc.setQueryData(ME_KEY, user)
    },
  })
}

export function useLogout() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSettled: () => {
      qc.clear()
      qc.setQueryData(ME_KEY, null)
      navigate('/login', { replace: true })
    },
  })
}
