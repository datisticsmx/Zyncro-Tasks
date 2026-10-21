import { useCallback, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate, useParams } from 'react-router'
import { Globe, KanbanSquare, LayoutDashboard, List, Lock, Settings, Trash2 } from 'lucide-react'
import { useProject } from '../../lib/projects'
import { useMe } from '../../lib/session'
import { TrashModal } from '../../components/TrashModal'
import { PROJECT_STATUS_COLOR } from '../../lib/ui'
import { ErrorState, NotFound, Skeleton } from '../../components/States'
import { BoardView } from './BoardView'
import { ListView } from './ListView'
import { TaskDrawer } from './TaskDrawer'
import { t } from '../../i18n/es'

/**
 * /projects/:key/board, /projects/:key/list y /projects/:key/tasks/:number.
 * El detalle de tarea es un panel sobre el tablero (o la lista, si se abrió
 * desde ahí) con URL propia.
 */
export function ProjectWorkspace({ view: routeView }) {
  const { key, number } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const project = useProject(key)
  const { data: me } = useMe()
  const [trashOpen, setTrashOpen] = useState(false)

  const view = routeView || location.state?.view || 'board'
  const from = location.state?.from
  const closeDrawer = useCallback(
    () => navigate(from || `/projects/${key}/${view}`),
    [navigate, from, key, view],
  )

  if (project.isPending) {
    return (
      <div className="page" role="status" aria-label={t.common.loading}>
        <Skeleton height={40} width="40%" />
        <Skeleton height={420} radius={24} style={{ marginTop: 24 }} />
      </div>
    )
  }
  if (project.isError) {
    if (project.error.status === 404) return <NotFound />
    return (
      <div className="page">
        <ErrorState error={project.error} onRetry={() => project.refetch()} />
      </div>
    )
  }
  const p = project.data

  return (
    <div className="page workspace">
      <div className="page-head">
        <div>
          <div className="pill-row">
            <span className="pill dark">{p.key}</span>
            <span className={`pill ${PROJECT_STATUS_COLOR[p.status]}`}>{t.projectStatus[p.status]}</span>
            <span className="pill">
              {p.visibility === 'global' ? <Globe size={12} /> : <Lock size={12} />} {t.visibility[p.visibility]}
            </span>
          </div>
          <h1 style={{ marginTop: 10 }}>{p.name}</h1>
        </div>
        <div className="head-actions">
          <nav className="segmented" aria-label={t.tasks.board}>
            <NavLink to={`/projects/${p.key}`} end>
              <LayoutDashboard size={14} /> {t.tasks.summary}
            </NavLink>
            <NavLink to={`/projects/${p.key}/board`} aria-current={view === 'board' ? 'page' : undefined}>
              <KanbanSquare size={14} /> {t.tasks.board}
            </NavLink>
            <NavLink to={`/projects/${p.key}/list`} aria-current={view === 'list' ? 'page' : undefined}>
              <List size={14} /> {t.tasks.list}
            </NavLink>
          </nav>
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
          {p.permissions.canEdit && (
            <Link className="icon-btn" to={`/projects/${p.key}/settings`} aria-label={t.projects.settings}>
              <Settings size={18} />
            </Link>
          )}
        </div>
      </div>

      {view === 'list' ? <ListView project={p} /> : <BoardView project={p} />}

      {trashOpen && <TrashModal project={p} onClose={() => setTrashOpen(false)} />}
      {number && <TaskDrawer key={number} project={p} number={number} onClose={closeDrawer} />}
    </div>
  )
}
