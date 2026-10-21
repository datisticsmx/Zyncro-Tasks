import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import {
  Calendar,
  ExternalLink,
  FolderGit2,
  Globe,
  KanbanSquare,
  List,
  Lock,
  Rocket,
  Server,
  Settings,
} from 'lucide-react'
import { useProject } from '../../lib/projects'
import { PROJECT_STATUS_COLOR, TASK_STATUS_COLOR, formatDate } from '../../lib/ui'
import { Avatar } from '../../components/Avatar'
import { DateBadge } from '../../components/TaskCard'
import { Markdown } from '../../components/Markdown'
import { ErrorState, NotFound, Skeleton } from '../../components/States'
import { Comments } from '../../components/Comments'
import { Attachments } from '../../components/Attachments'
import { ActivityFeed } from '../../components/ActivityFeed'
import { t } from '../../i18n/es'

const TABS = [{ id: 'summary' }, { id: 'comments' }, { id: 'attachments' }, { id: 'activity' }]

function ProjectSkeleton() {
  return (
    <div className="page" role="status" aria-label={t.common.loading}>
      <Skeleton height={20} width={120} />
      <Skeleton height={40} width="45%" style={{ marginTop: 12 }} />
      <div className="project-layout" style={{ marginTop: 28 }}>
        <Skeleton height={320} radius={24} />
        <Skeleton height={320} radius={24} />
      </div>
    </div>
  )
}

function LinkRow({ icon: Icon, label, href }) {
  return (
    <div className="info-row">
      <Icon size={17} aria-hidden="true" />
      <span className="info-label">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="info-value link-light">
          {href.replace(/^https:\/\//, '')} <ExternalLink size={12} aria-hidden="true" />
        </a>
      ) : (
        <span className="info-value dim">—</span>
      )}
    </div>
  )
}

function Summary({ p }) {
  return (
    <div className="project-layout">
      <div className="stack">
        <section className="card outlined">
          <h3 style={{ marginBottom: 14 }}>{t.projects.description}</h3>
          {p.description ? <Markdown>{p.description}</Markdown> : <p className="muted">{t.projects.noDescription}</p>}
        </section>

        <section className="card outlined">
          <h3 style={{ marginBottom: 14 }}>{t.projects.byStatus}</h3>
          <div className="status-grid">
            {Object.entries(p.stats.byStatus).map(([s, n]) => (
              <div key={s} className={`status-tile bg-${TASK_STATUS_COLOR[s]}`}>
                <span className="meta">{t.taskStatus[s]}</span>
                <strong>{n}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="stack">
        <section className="card dark">
          <h3 style={{ marginBottom: 12 }}>{t.projects.details}</h3>
          <div className="info-row">
            <Calendar size={17} aria-hidden="true" />
            <span className="info-label">{t.projects.start}</span>
            <span className="info-value">{formatDate(p.startDate) || '—'}</span>
          </div>
          <div className="info-row">
            <Calendar size={17} aria-hidden="true" />
            <span className="info-label">{t.projects.end}</span>
            <span className="info-value">
              {p.endDateTentative ? (
                <DateBadge
                  date={p.endDateTentative}
                  finished={['completed', 'archived'].includes(p.status)}
                  label={t.projects.end}
                />
              ) : (
                '—'
              )}
            </span>
          </div>
          <LinkRow icon={Rocket} label={t.projects.production} href={p.urlProduction} />
          <LinkRow icon={Server} label={t.projects.staging} href={p.urlStaging} />

          <h4 className="dark-subtitle">{t.projects.repositories}</h4>
          {p.repositories.length === 0 && <p className="dim">{t.projects.noRepos}</p>}
          {p.repositories.map((r) => (
            <LinkRow key={r.id} icon={FolderGit2} label={r.label} href={r.url} />
          ))}
        </section>

        <section className="card outlined">
          <div className="progress big">
            <div className="progress-head">
              <span>{t.projects.progress}</span>
              <strong>{p.stats.progress}%</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${p.stats.progress}%` }} />
            </div>
          </div>
        </section>

        <section className="card outlined">
          <h3 style={{ marginBottom: 14 }}>{t.projects.members}</h3>
          {p.visibility === 'global' ? (
            <p className="muted">{t.projects.everyone}</p>
          ) : p.members.length === 0 ? (
            <p className="muted">{t.projects.noMembers}</p>
          ) : (
            <ul className="member-list">
              {p.members.map((m) => (
                <li key={m.id}>
                  <Avatar user={m} size={34} /> {m.name}
                </li>
              ))}
            </ul>
          )}
          {p.createdBy && (
            <p className="muted" style={{ marginTop: 14, fontSize: 13 }}>
              {t.projects.createdBy}: <strong>{p.createdBy.name}</strong>
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

/** /projects/:key — resumen con pestañas (sección 6). */
export function ProjectPage() {
  const { key } = useParams()
  const project = useProject(key)
  const [tab, setTab] = useState('summary')
  const qc = useQueryClient()
  const refreshActivity = () => qc.invalidateQueries({ queryKey: ['activity'] })

  if (project.isPending) return <ProjectSkeleton />
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
    <div className="page">
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
          <p className="muted">{p.clientName || t.projects.noClient}</p>
        </div>
        <div className="head-actions">
          <Link className="btn btn-yellow" to={`/projects/${p.key}/board`}>
            <KanbanSquare size={18} /> {t.projects.board}
          </Link>
          <Link className="btn btn-ghost" to={`/projects/${p.key}/list`}>
            <List size={18} /> {t.projects.list}
          </Link>
          {p.permissions.canEdit && (
            <Link className="btn btn-dark" to={`/projects/${p.key}/settings`}>
              <Settings size={18} /> {t.projects.settings}
            </Link>
          )}
        </div>
      </div>

      <div className="segmented tabs" role="tablist">
        {TABS.map(({ id }) => (
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
        {tab === 'summary' && <Summary p={p} />}
        {tab === 'comments' && <Comments scope="projects" id={p.id} onActivity={refreshActivity} />}
        {tab === 'attachments' && <Attachments scope="projects" id={p.id} onActivity={refreshActivity} />}
        {tab === 'activity' && <ActivityFeed scope="projects" id={p.id} />}
      </div>
    </div>
  )
}
