import { History } from 'lucide-react'
import { useActivity } from '../lib/collab'
import { formatDate } from '../lib/ui'
import { Avatar } from './Avatar'
import { EmptyState, ErrorState, SkeletonRows } from './States'
import { t } from '../i18n/es'

const DATETIME = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' })

/** Valor legible de un campo cambiado. */
function show(field, value) {
  if (value === null || value === undefined || value === '') return '—'
  if (field === 'status') return t.taskStatus[value] || t.projectStatus[value] || value
  if (field === 'priority') return t.priority[value] || value
  if (field === 'visibility') return t.visibility[value] || value
  if (/date/.test(field)) return formatDate(value)
  return String(value)
}

/**
 * RF-ACT-02: actor, acción, entidad y valor anterior → nuevo.
 * En la bitácora de una tarea (`inTask`) no se repite la clave de la tarea.
 */
function describe(item, users, inTask) {
  const p = item.payload || {}
  const ref = !inTask && item.task ? <strong>{item.task.ref}</strong> : null
  const who = (id) => <strong>{users[id]?.name || t.activity.someone}</strong>
  const changes = (c) =>
    Object.entries(c || {})
      .map(([f, v]) => (v.changed ? t.activity.fields[f] || f : `${t.activity.fields[f] || f}: ${show(f, v.from)} → ${show(f, v.to)}`))
      .join(' · ')

  switch (item.action) {
    case 'project.created':
      return <>creó el proyecto</>
    case 'project.updated':
      return <>actualizó el proyecto ({changes(p.changes)})</>
    case 'project.member_added':
      return <>agregó a {who(p.user_id)} como miembro</>
    case 'project.member_removed':
      return <>quitó a {who(p.user_id)} de los miembros</>
    case 'project.repo_added':
      return <>agregó el repositorio <strong>{p.repo?.label}</strong></>
    case 'project.repo_removed':
      return <>quitó el repositorio <strong>{p.repo?.label}</strong></>
    case 'task.created':
      return <>creó {ref || 'la tarea'}{!inTask && p.title ? <> «{p.title}»</> : null}</>
    case 'task.updated':
      return <>editó {ref || 'la tarea'} ({changes(p.changes)})</>
    case 'task.status_changed':
      return (
        <>
          movió {ref || 'la tarea'} de <strong>{show('status', p.from)}</strong> a <strong>{show('status', p.to)}</strong>
        </>
      )
    case 'task.assigned':
      return <>asignó {ref ? <>{ref} </> : null}a {who(p.user_id)}</>
    case 'task.unassigned':
      return (
        <>
          desasignó a {who(p.user_id)}{ref ? <> de {ref}</> : null}
          {p.reason === 'lost_project_access' ? ' (perdió acceso al proyecto)' : ''}
        </>
      )
    case 'task.deleted':
      return <>eliminó {ref || 'la tarea'}</>
    case 'task.restored':
      return <>restauró {ref || 'la tarea'}</>
    case 'attachment.added':
      return <>adjuntó <strong>{p.name}</strong>{ref ? <> en {ref}</> : null}</>
    case 'attachment.deleted':
      return <>borró el adjunto <strong>{p.name}</strong>{ref ? <> de {ref}</> : null}</>
    case 'comment.deleted':
      return <>borró un comentario{ref ? <> en {ref}</> : null}</>
    default:
      return <>{item.action}</>
  }
}

/** Bitácora de un proyecto (incluye sus tareas) o de una tarea. */
export function ActivityFeed({ scope, id }) {
  const feed = useActivity(scope, id)
  if (feed.isPending) return <SkeletonRows rows={4} height={44} />
  if (feed.isError) return <ErrorState error={feed.error} onRetry={() => feed.refetch()} />
  if (feed.data.items.length === 0) {
    return <EmptyState icon={History} color="bg-green" title={t.activity.emptyTitle} body={t.activity.emptyBody} />
  }
  return (
    <ol className="activity-list">
      {feed.data.items.map((item) => (
        <li key={item.id} className="activity-item">
          <Avatar user={item.actor} size={30} />
          <div>
            <p>
              <strong>{item.actor.name}</strong> {describe(item, feed.data.users, scope === 'tasks')}
            </p>
            <time className="muted" dateTime={item.createdAt}>
              {DATETIME.format(new Date(item.createdAt))}
            </time>
          </div>
        </li>
      ))}
    </ol>
  )
}
