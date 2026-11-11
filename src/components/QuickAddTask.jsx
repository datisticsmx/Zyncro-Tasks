import { useState } from 'react'
import { Plus } from 'lucide-react'
import { t } from '../i18n/es'

/**
 * Alta rápida de tarea: un botón que abre un campo de título y crea la tarea
 * con lo que traiga `extra` (la columna en el tablero, el grupo en el
 * checklist, el estatus por defecto en la lista).
 *
 * `onCreate(body)` debe devolver true si se creó, para limpiar el campo.
 * `variant`: 'ghost' = botón ancho dentro de una columna · 'solid' = botón de
 * barra de herramientas, con Crear y Cancelar explícitos.
 */
export function QuickAddTask({
  onCreate,
  extra,
  label = t.tasks.addTask,
  ariaLabel,
  variant = 'ghost',
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const solid = variant === 'solid'

  async function submit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    const ok = await onCreate({ title: title.trim(), ...extra })
    setBusy(false)
    if (ok) setTitle('')
  }

  if (!open) {
    return (
      <button
        type="button"
        className={solid ? 'btn btn-dark quick-add-cta' : 'quick-add-btn'}
        onClick={() => setOpen(true)}
      >
        <Plus size={16} /> {label}
      </button>
    )
  }
  return (
    <form className={`quick-add${solid ? ' solid' : ''}`} onSubmit={submit}>
      <input
        className="input"
        autoFocus
        maxLength={500}
        placeholder={t.tasks.newTaskPlaceholder}
        aria-label={ariaLabel || label}
        value={title}
        disabled={busy}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        // Al salir sin escribir nada, se cierra solo.
        onBlur={() => !title && setOpen(false)}
      />
      {solid && (
        <>
          <button type="submit" className="btn btn-dark" disabled={busy || !title.trim()}>
            {busy ? t.common.saving : t.tasks.create}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setTitle('')
              setOpen(false)
            }}
          >
            {t.common.cancel}
          </button>
        </>
      )}
    </form>
  )
}
