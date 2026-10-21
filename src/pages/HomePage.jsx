import { Link } from 'react-router'
import { CalendarCheck, CalendarClock, CalendarDays, CalendarX2, CheckSquare } from 'lucide-react'
import { useMe } from '../lib/session'
import { useMyTasks } from '../lib/tasks'
import { TaskCardBody } from '../components/TaskCard'
import { EmptyState, ErrorState, Skeleton } from '../components/States'
import { t } from '../i18n/es'

const DATE_FMT = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })

const GROUPS = [
  { id: 'overdue', color: 'coral', icon: CalendarX2 },
  { id: 'today', color: 'yellow', icon: CalendarCheck },
  { id: 'upcoming', color: 'lilac', icon: CalendarDays },
  { id: 'no_date', color: 'cyan', icon: CalendarClock },
]

/** "/" — Mis tareas (RF-VIEW-03, CA-12). */
export function HomePage() {
  const { data: user } = useMe()
  const mine = useMyTasks()
  const fecha = DATE_FMT.format(new Date())
  const hoy = fecha.charAt(0).toUpperCase() + fecha.slice(1)

  let content
  if (mine.isPending) {
    content = (
      <div className="mytasks-grid" role="status" aria-label={t.common.loading}>
        {GROUPS.map((g) => (
          <Skeleton key={g.id} height={260} radius={24} />
        ))}
      </div>
    )
  } else if (mine.isError) {
    content = <ErrorState error={mine.error} onRetry={() => mine.refetch()} />
  } else if (mine.data.total === 0) {
    content = <EmptyState icon={CheckSquare} color="bg-green" title={t.myTasks.emptyTitle} body={t.myTasks.emptyBody} />
  } else {
    content = (
      <div className="mytasks-grid">
        {GROUPS.map(({ id, color }) => {
          const items = mine.data.groups[id]
          return (
            <section key={id} className="mytasks-group" aria-labelledby={`g-${id}`}>
              <header className={`mytasks-head bg-${color}`}>
                <h2 id={`g-${id}`}>{t.myTasks.groups[id]}</h2>
                <span className="count">{items.length}</span>
              </header>
              {items.length === 0 ? (
                <p className="muted mytasks-empty">{t.myTasks.groupEmpty}</p>
              ) : (
                <ul className="board-list">
                  {items.map((task) => (
                    <li key={task.id}>
                      <Link
                        className="task-card"
                        to={`/projects/${task.projectKey}/tasks/${task.number}`}
                        state={{ from: '/' }}
                      >
                        <TaskCardBody task={task} showProject />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    )
  }

  const counts = mine.data?.groups
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="muted">{hoy}</p>
          <h1>{t.greeting(user.name)}</h1>
          {mine.data && <p className="muted">{t.myTasks.open(mine.data.total)}</p>}
        </div>
        {counts && (
          <div className="hero-counts">
            {GROUPS.map(({ id, color, icon: Icon }) => (
              <div key={id} className={`hero-count bg-${color}`}>
                <Icon size={18} aria-hidden="true" />
                <strong>{counts[id].length}</strong>
                <span>{t.myTasks.groups[id]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {content}
    </div>
  )
}
