import { useQuery } from '@tanstack/react-query'
import { Globe, Lock, UsersRound } from 'lucide-react'
import { api } from './api'

/** Notas tipo post-it (GET /notes devuelve solo las que el usuario puede ver). */
export const NOTES_KEY = ['notes']

export function useNotes() {
  return useQuery({
    queryKey: NOTES_KEY,
    queryFn: async () => (await api.get('/notes')).items,
  })
}

// Deben coincidir con RJBackend/src/zyncro/services/notes.js.
export const NOTE_COLORS = ['yellow', 'lilac', 'coral', 'cyan', 'green', 'pink']
export const NOTE_VISIBILITIES = ['global', 'selected', 'private']
export const NOTE_MAX_BODY = 2000
export const NOTE_MAX_FILES = 10

export const VISIBILITY_ICON = { global: Globe, selected: UsersRound, private: Lock }
