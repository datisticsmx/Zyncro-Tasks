import { useCallback, useState } from 'react'
import { Link, useLocation, useMatch, useNavigate, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Calendar, CalendarRange, KanbanSquare, List, Settings, Trash2, UserRound, UsersRound } from 'lucide-react'
import { useSprint, durationDays } from '../../lib/sprints'
import { useMe } from '../../lib/session'
import { PROJECT_STATUS_COLOR, formatDate, formatRange } from '../../lib/ui'
import { Avatar } from '../../components/Avatar'
import { AssigneeStack, DateBadge } from '../../components/TaskCard'
import { Markdown } from '../../components/Markdown'
import { ErrorState, NotFound, Skeleton } from '../../components/States'
import { Comments } from '../../components/Comments'
import { Attachments } from '../../components/Attachments'
import { ActivityFeed } from '../../components/ActivityFeed'
import { TrashModal } from '../../components/TrashModal'
import { BoardView } from '../projects/BoardView'
import { ListView } from '../projects/ListView'
import { TaskDrawer } from '../projects/TaskDrawer'
import { t } from '../../i18n/es'

const TABS = ['summary', 'comments', 'attachments', 'activity']

/** Actividades del sprint: lista o tablero (mismas vistas que en proyectos). */
function SprintTasks({ s }) {
  const [view, setView] = useState('list')
  return (
    <section className="card outlined project-tasks">
      <div className="project-tasks-head">
        <h3>
          {t.sprints.tasksTitle} <span className="muted">{t.sprints.tasksCount(s.stats.total)}</span>
        </h3>
        <div className="segmented" role="group" aria-label={t.sprints.tasksTitle}>
          <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>
            <List size={14} /> {t.tasks.list}
          </button>
          <button type="button" aria-pressed={view === 'board'} onClick={() => setView('board')}>
            <KanbanSquare size={14} /> {t.tasks.board}
          </button>
        </div>
      </div>
      {view === 'list' ? <ListView project={s} /> : <BoardView project={s} />}
    </section>
  )
}

function Summary({ s }) {
  const days = durationDays(s.startDate, s.endDate)
  const finished = ['completed', 'archived'].includes(s.status)
  return (
    <div className="project-layout">
      <div className="stack">
        <section className="card outlined">
          <h3 style={{ marginBottom: 14 }}>{t.projects.description}</h3>
          {s.description ? <Markdown>{s.description}</Markdown> : <p className="muted">{t.sprints.noDescription}</p>}
        </section>
        <section className="card outlined">
          <div className="progress big">
            <div className="progress-head">
              <span>
                {t.sprints.progress} · {t.sprints.tasksDone(s.stats.done, s.stats.total)}
              </span>
              <strong>{s.stats.progress}%</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${s.stats.progress}%` }} />
            </div>
          </div>
        </section>
      </div>

      <div className="stack">
        <section className="card dark">
          <h3 style={{ marginBottom: 12 }}>{t.projects.details}</h3>
          <div className="info-row">
            <UserRound size={17} aria-hidden="true" />
            <span className="info-label">{t.sprints.owner}</span>
            <span className="info-value">{s.owner?.name || t.sprints.noOwner}</span>
          </div>
          <div className="info-row">
            <UsersRound size={17} aria-hidden="true" />
            <span className="info-label">{t.sprints.participants}</span>
            <span className="info-value">
              {s.members.length > 0 ? s.members.map((m) => m.name).join(', ') : t.sprints.noParticipants}
            </span>
          </div>
          <div className="info-row">
            <Calendar size={17} aria-hidden="true" />
            <span className="info-label">{t.sprints.start}</span>
            <span className="info-value">{formatDate(s.startDate) || '—'}</span>
          </div>
          <div className="info-row">
            <Calendar size={17} aria-hidden="true" />
            <span className="info-label">{t.sprints.end}</span>
            <span className="info-value">
              {s.endDate ? <DateBadge date={s.endDate} finished={finished} label={t.sprints.end} /> : '—'}
            </span>
          </div>
          <div className="info-row">
            <CalendarRange size={17} aria-hidden="true" />
            <span className="info-label">{t.sprints.duration}</span>
            <span className="info-value">{days ? t.sprints.days(days) : '—'}</span>
          </div>
          {s.createdBy && (
            <div className="info-row">
              <UserRound size={17} aria-hidden="true" />
              <span className="info-label">{t.projects.createdBy}</span>
              <span className="info-value">{s.createdBy.name}</span>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

/**
 * /sprints/:key — resumen del sprint con sus actividades.
 * /sprints/:key/tasks/:number — lo mismo con el panel de la actividad abierto.
 */
export function SprintPage() {
  const { key } = useParams()
  // Ruta hija sin elemento: así la página no se desmonta al abrir/cerrar el
  // panel y conserva la pestaña y la vista (lista/tablero) elegidas.
  const number = useMatch('/sprints/:key/tasks/:number')?.params.number
  const location = useLocation()
  const navigate = useNavigate()
  const sprint = useSprint(key)
  const { data: me } = useMe()
  const [tab, setTab] = useState('summary')
  const [trashOpen, setTrashOpen] = useState(false)
  const qc = useQueryClient()
  const refreshActivity = () => qc.invalidateQueries({ queryKey: ['activity'] })

  const from = location.state?.from
  const closeDrawer = useCallback(() => navigate(from || `/sprints/${key}`), [navigate, from, key])

  if (sprint.isPending) {
    return (
      <div className="page" role="status" aria-label={t.common.loading}>
        <Skeleton height={20} width={120} />
        <Skeleton height={40} width="45%" style={{ marginTop: 12 }} />
        <Skeleton height={320} radius={24} style={{ marginTop: 28 }} />
      </div>
    )
  }
  if (sprint.isError) {
    if (sprint.error.status === 404) return <NotFound />
    return (
      <div className="page">
        <ErrorState error={sprint.error} onRetry={() => sprint.refetch()} />
      </div>
    )
  }
  const s = sprint.data

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link className="back-link" to="/sprints">
            <ArrowLeft size={16} /> {t.sprints.title}
          </Link>
          <div className="pill-row" style={{ marginTop: 10 }}>
            <span className="pill dark">{s.key}</span>
            <span className={`pill ${PROJECT_STATUS_COLOR[s.status]}`}>{t.projectStatus[s.status]}</span>
          </div>
          <h1 style={{ marginTop: 10 }}>{s.name}</h1>
          <div className="sprint-meta-row">
            <span className="who">
              {s.owner ? (
                <>
                  <Avatar user={s.owner} size={28} /> {s.owner.name}
                </>
              ) : (
                t.sprints.noOwner
              )}
            </span>
            <span>{formatRange(s.startDate, s.endDate, t.sprints.noPeriod)}</span>
            {s.members.length > 0 && <AssigneeStack users={s.members} size={26} max={5} />}
          </div>
        </div>
        <div className="head-actions">
          {me.role === 'admin' && (
            <button
              type="button"
              className="icon-btn light"
              onClick={() => setTrashOpen(true)}
              aria-label={t.trash.open}
              title={t.trash.open}
            >
              <Trash2 size={18} />
            </button>
          )}
          {s.permissions.canEdit && (
            <Link className="btn btn-dark" to={`/sprints/${s.key}/settings`}>
              <Settings size={18} /> {t.projects.settings}
            </Link>
          )}
        </div>
      </div>

      <div className="segmented tabs" role="tablist">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
          >
            {t.sprints.tabs[id]}
          </button>
        ))}
      </div>

      <div role="tabpanel" style={{ marginTop: 22 }}>
        {tab === 'summary' && (
          <>
            <Summary s={s} />
            <SprintTasks s={s} />
          </>
        )}
        {tab === 'comments' && <Comments scope="sprints" id={s.id} onActivity={refreshActivity} />}
        {tab === 'attachments' && <Attachments scope="sprints" id={s.id} onActivity={refreshActivity} />}
        {tab === 'activity' && <ActivityFeed scope="sprints" id={s.id} />}
      </div>

      {trashOpen && <TrashModal project={s} onClose={() => setTrashOpen(false)} />}
      {number && <TaskDrawer key={number} project={s} number={number} onClose={closeDrawer} />}
    </div>
  )
}
