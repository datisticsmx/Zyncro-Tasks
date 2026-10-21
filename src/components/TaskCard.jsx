import { CalendarClock, CornerDownRight } from 'lucide-react'
import { Avatar } from './Avatar'
import { PRIORITY_COLOR, dueTone, formatDate } from '../lib/ui'
import { t } from '../i18n/es'

/**
 * Fecha de vencimiento con color según los días restantes (ver dueTone).
 * Se usa en tablero, lista, Mis tareas, panel de tarea y proyectos.
 */
export function DateBadge({ date, finished = false, label = t.tasks.due }) {
  if (!date) return null
  const { tone, days } = dueTone(date, { finished })
  const hint = tone === 'none' ? label : t.dates.relative(days)
  return (
    <span className={`pill due due-${tone}`} title={`${label}: ${hint}`}>
      <CalendarClock size={12} aria-hidden="true" />
      {formatDate(date)}
      <span className="sr-only"> ({hint})</span>
    </span>
  )
}

export function DueBadge({ task }) {
  return <DateBadge date={task.dueDate} finished={task.status === 'done'} />
}

export function PriorityPill({ priority }) {
  return (
    <span className={`pill ${PRIORITY_COLOR[priority]}`}>
      <span className="dot" aria-hidden="true" />
      {t.priority[priority]}
    </span>
  )
}

export function AssigneeStack({ users, size = 26, max = 3 }) {
  if (!users?.length) return null
  return (
    <span className="avatar-stack" aria-label={users.map((u) => u.name).join(', ')}>
      {users.slice(0, max).map((u) => (
        <Avatar key={u.id} user={u} size={size} />
      ))}
      {users.length > max && (
        <span className="avatar more" style={{ width: size, height: size, fontSize: 10 }}>
          +{users.length - max}
        </span>
      )}
    </span>
  )
}

/** Contenido de una tarjeta (tablero y "Mis tareas"). */
export function TaskCardBody({ task, showProject = false }) {
  return (
    <>
      <div className="task-card-top">
        <span className="pill dark ref">{task.ref}</span>
        <PriorityPill priority={task.priority} />
      </div>
      <p className="task-card-title">{task.title}</p>
      {showProject && (
        <span className="task-card-project">
          <CornerDownRight size={12} aria-hidden="true" /> {task.projectName}
        </span>
      )}
      <div className="task-card-foot">
        <DueBadge task={task} />
        <AssigneeStack users={task.assignees} />
      </div>
    </>
  )
}
