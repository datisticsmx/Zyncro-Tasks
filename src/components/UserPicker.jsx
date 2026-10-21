import { useEffect, useId, useRef, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { api, qs } from '../lib/api'
import { Avatar } from './Avatar'
import { t } from '../i18n/es'

/**
 * Selector de personas: chips con los elegidos + buscador sobre la lista
 * básica de usuarios activos (GET /users). `value` es una lista de usuarios
 * básicos ({ id, name, avatar }). Con `options` filtra esa lista en memoria
 * en lugar de consultar la API (p. ej. las personas con acceso al proyecto).
 */
export function UserPicker({ value, onChange, label, disabled, options: localOptions }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const listId = useId()
  const pickerRef = useRef(null)
  const inputRef = useRef(null)

  // Cierra al hacer clic fuera (el blur no basta: al elegir, el botón de la
  // opción desaparece y el foco se pierde sin evento útil).
  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => !pickerRef.current?.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function pick(u) {
    onChange([...value, u])
    setQ('')
    setOpen(false)
    inputRef.current?.focus()
  }

  const users = useQuery({
    queryKey: ['users', 'basic', q],
    // status=active: a un Admin la API le devuelve también inactivos y pendientes.
    queryFn: () => api.get(`/users${qs({ q, status: 'active', pageSize: 20 })}`),
    enabled: open && !localOptions,
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  })
  const elegidos = new Set(value.map((u) => u.id))
  const fuente = localOptions
    ? localOptions.filter((u) => u.name.toLowerCase().includes(q.trim().toLowerCase()))
    : users.data?.items || []
  const opciones = fuente.filter((u) => !elegidos.has(u.id))

  return (
    <div className="field">
      {label && <span className="field-label">{label}</span>}
      <div className="chips">
        {value.map((u) => (
          <span key={u.id} className="chip">
            <Avatar user={u} size={26} />
            {u.name}
            {!disabled && (
              <button
                type="button"
                className="chip-x"
                aria-label={t.projects.removeMember(u.name)}
                onClick={() => onChange(value.filter((x) => x.id !== u.id))}
              >
                <X size={14} />
              </button>
            )}
          </span>
        ))}
      </div>
      {!disabled && (
        <div className="picker" ref={pickerRef}>
          <Plus size={16} aria-hidden="true" className="picker-icon" />
          <input
            className="input"
            type="search"
            placeholder={t.projects.searchPeople}
            aria-label={t.projects.addMember}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            ref={inputRef}
            value={q}
            onClick={() => setOpen(true)}
            onChange={(e) => {
              setQ(e.target.value)
              setOpen(true)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && open) {
                // Que no cierre también el panel o modal que lo contiene.
                e.preventDefault()
                e.stopPropagation()
              }
              if (e.key === 'Escape' || e.key === 'Tab') setOpen(false)
              if (e.key === 'ArrowDown') setOpen(true)
              if (e.key === 'Enter') {
                e.preventDefault()
                if (open && opciones[0]) pick(opciones[0])
              }
            }}
          />
          {open && opciones.length > 0 && (
            <ul className="picker-list" id={listId} role="listbox">
              {opciones.map((u) => (
                <li key={u.id} role="option" aria-selected="false">
                  <button
                    type="button"
                    onClick={() => pick(u)}
                  >
                    <Avatar user={u} size={28} /> {u.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
