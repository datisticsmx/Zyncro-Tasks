import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Globe, Lock, UsersRound } from 'lucide-react'
import { api } from './api'

/**
 * Orden del muro de notas, propio de cada persona (las notas son compartidas,
 * así que mover una no debe reacomodar el muro de los demás). La API no guarda
 * posición: el orden vive en este navegador, por usuario. Las notas que aún no
 * están en el orden guardado (nuevas) van al principio, en el orden de la API.
 */
const orderKey = (userId) => `zyncro:notes-order:${userId}`

function readOrder(userId) {
  try {
    const raw = JSON.parse(localStorage.getItem(orderKey(userId)) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export function useNoteOrder(userId, items) {
  const [saved, setSaved] = useState(() => readOrder(userId))

  const ordered = useMemo(() => {
    const byId = new Map(items.map((n) => [n.id, n]))
    const known = new Set(saved)
    const fresh = items.filter((n) => !known.has(n.id))
    return [...fresh, ...saved.filter((id) => byId.has(id)).map((id) => byId.get(id))]
  }, [items, saved])

  /** Pone `activeId` en el lugar de `overId` (sobre el orden completo, aunque haya filtros). */
  const move = useCallback(
    (activeId, overId) => {
      const ids = ordered.map((n) => n.id)
      const from = ids.indexOf(activeId)
      const to = ids.indexOf(overId)
      if (from < 0 || to < 0 || from === to) return
      ids.splice(to, 0, ids.splice(from, 1)[0])
      setSaved(ids)
      try {
        localStorage.setItem(orderKey(userId), JSON.stringify(ids))
      } catch {
        // Sin almacenamiento (modo privado): el orden dura hasta recargar.
      }
    },
    [ordered, userId],
  )

  return [ordered, move]
}

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
