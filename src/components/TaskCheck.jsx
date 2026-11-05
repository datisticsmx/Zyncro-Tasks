import { t } from '../i18n/es'

/**
 * Casilla de "completada" de una tarea. Se usa en el tablero, la lista, la
 * vista Checklist, "Mis tareas" y el panel de tarea, así que vive dentro de
 * contenedores que a la vez son clicables, arrastrables o enlaces.
 *
 * El cambio lo maneja `onClick` con preventDefault (y no `onChange`): así la
 * casilla nunca dispara la acción del contenedor —abrir el panel, navegar al
 * enlace o empezar un arrastre— y su estado visible sale siempre de `checked`,
 * es decir del dato guardado (o de la actualización optimista). Si la API
 * falla, la casilla vuelve sola a su valor real.
 */
export function TaskCheck({ checked, onChange, label, size = 20, disabled = false }) {
  return (
    <input
      type="checkbox"
      className="task-check"
      checked={checked}
      disabled={disabled}
      readOnly
      aria-label={label}
      title={checked ? t.tasks.markUndone : t.tasks.markDone}
      style={{ width: size, height: size }}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        if (!disabled) onChange(!checked)
      }}
    />
  )
}

/** La misma casilla a partir de una tarea: `onToggle(task, done)`. */
export function TaskDoneCheck({ task, onToggle, size, disabled }) {
  return (
    <TaskCheck
      checked={task.status === 'done'}
      size={size}
      disabled={disabled}
      label={t.tasks.toggleDone(task.ref)}
      onChange={(done) => onToggle(task, done)}
    />
  )
}
