import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Calendar, CalendarRange, Globe, Lock, Settings, UserRound } from 'lucide-react'
import { useProject } from '../../lib/projects'
import { durationDays } from '../../lib/activities'
import { PROJECT_STATUS_COLOR, formatDate, formatRange } from '../../lib/ui'
import { Avatar } from '../../components/Avatar'
import { DateBadge } from '../../components/TaskCard'
import { Markdown } from '../../components/Markdown'
import { ErrorState, NotFound, Skeleton } from '../../components/States'
import { Comments } from '../../components/Comments'
import { Attachments } from '../../components/Attachments'
import { ActivityFeed } from '../../components/ActivityFeed'
import { ProjectKeyPill } from '../../components/ProjectKeyPill'
import { TasksSection } from '../projects/ProjectPage'
import { t } from '../../i18n/es'

const TABS = ['summary', 'comments', 'attachments', 'activity']

function Summary({ a }) {
  const days = durationDays(a.startDate, a.endDateTentative)
  const finished = ['completed', 'archived'].includes(a.status)
  return (
    <div className="project-layout">
      <div className="stack">
        <section className="card outlined">
          <h3 style={{ marginBottom: 14 }}>{t.projects.description}</h3>
          {a.description ? <Markdown>{a.description}</Markdown> : <p className="muted">{t.activities.noDescription}</p>}
        </section>
        <section className="card outlined">
          <div className="progress big">
            <div className="progress-head">
              <span>
                {t.activities.progress} · {t.activities.tasksDone(a.stats.done, a.stats.total)}
              </span>
              <strong>{a.stats.progress}%</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${a.stats.progress}%` }} />
            </div>
          </div>
        </section>
      </div>

      <div className="stack">
        <section className="card dark">
          <h3 style={{ marginBottom: 12 }}>{t.projects.details}</h3>
          <div className="info-row">
            <UserRound size={17} aria-hidden="true" />
            <span className="info-label">{t.activities.owner}</span>
            <span className="info-value">{a.owner?.name || t.activities.noOwner}</span>
          </div>
          <div className="info-row">
            <Calendar size={17} aria-hidden="true" />
            <span className="info-label">{t.activities.start}</span>
            <span className="info-value">{formatDate(a.startDate) || '—'}</span>
          </div>
          <div className="info-row">
            <Calendar size={17} aria-hidden="true" />
            <span className="info-label">{t.activities.end}</span>
            <span className="info-value">
              {a.endDateTentative ? (
                <DateBadge date={a.endDateTentative} finished={finished} label={t.activities.end} />
              ) : (
                '—'
              )}
            </span>
          </div>
          <div className="info-row">
            <CalendarRange size={17} aria-hidden="true" />
            <span className="info-label">{t.activities.duration}</span>
            <span className="info-value">{days ? t.activities.days(days) : '—'}</span>
          </div>
          {a.createdBy && (
            <div className="info-row">
              <UserRound size={17} aria-hidden="true" />
              <span className="info-label">{t.projects.createdBy}</span>
              <span className="info-value">{a.createdBy.name}</span>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

/** /activities/:key — resumen de la actividad con sus tareas. */
export function ActivityPage() {
  const { key } = useParams()
  const activity = useProject(key)
  const [tab, setTab] = useState('summary')
  const qc = useQueryClient()
  const refreshActivity = () => qc.invalidateQueries({ queryKey: ['activity'] })

  if (activity.isPending) {
    return (
      <div className="page" role="status" aria-label={t.common.loading}>
        <Skeleton height={20} width={120} />
        <Skeleton height={40} width="45%" style={{ marginTop: 12 }} />
        <Skeleton height={320} radius={24} style={{ marginTop: 28 }} />
      </div>
    )
  }
  if (activity.isError) {
    if (activity.error.status === 404) return <NotFound />
    return (
      <div className="page">
        <ErrorState error={activity.error} onRetry={() => activity.refetch()} />
      </div>
    )
  }
  const a = activity.data
  // Un proyecto normal abierto con esta ruta va a su propia pantalla.
  if (a.type && a.type !== 'activity') return <Navigate to={`/projects/${a.key}`} replace />

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link className="back-link" to="/activities">
            <ArrowLeft size={16} /> {t.activities.title}
          </Link>
          <div className="pill-row" style={{ marginTop: 10 }}>
            <ProjectKeyPill project={a} />
            <span className={`pill ${PROJECT_STATUS_COLOR[a.status]}`}>{t.projectStatus[a.status]}</span>
            <span className="pill">
              {a.visibility === 'global' ? <Globe size={12} /> : <Lock size={12} />} {t.visibility[a.visibility]}
            </span>
          </div>
          <h1 style={{ marginTop: 10 }}>{a.name}</h1>
          <div className="activity-meta-row">
            <span className="who">
              {a.owner ? (
                <>
                  <Avatar user={a.owner} size={28} /> {a.owner.name}
                </>
              ) : (
                t.activities.noOwner
              )}
            </span>
            <span>{formatRange(a.startDate, a.endDateTentative, t.activities.noPeriod)}</span>
          </div>
        </div>
        <div className="head-actions">
          {a.permissions.canEdit && (
            <Link className="btn btn-dark" to={`/activities/${a.key}/settings`}>
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
            {t.projects.tabs[id]}
          </button>
        ))}
      </div>

      <div role="tabpanel" style={{ marginTop: 22 }}>
        {tab === 'summary' && (
          <>
            <Summary a={a} />
            <TasksSection p={a} />
          </>
        )}
        {tab === 'comments' && <Comments scope="projects" id={a.id} onActivity={refreshActivity} />}
        {tab === 'attachments' && <Attachments scope="projects" id={a.id} onActivity={refreshActivity} />}
        {tab === 'activity' && <ActivityFeed scope="projects" id={a.id} />}
      </div>
    </div>
  )
}
