import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ArrowUpRight, FolderKanban, Globe, Lock, Plus } from 'lucide-react'
import { useProjects } from '../../lib/projects'
import { PROJECT_STATUS_COLOR, formatDate } from '../../lib/ui'
import { Avatar } from '../../components/Avatar'
import { DateBadge } from '../../components/TaskCard'
import { EmptyState, ErrorState, Skeleton } from '../../components/States'
import { t } from '../../i18n/es'

// Proyectos terminados: su fecha fin ya no es una alerta.
const FINISHED = ['completed', 'archived']

function ProjectCard({ p }) {
  const color = PROJECT_STATUS_COLOR[p.status]
  return (
    <Link to={`/projects/${p.key}`} className={`project-card bg-${color}`}>
      <div className="project-card-top">
        <span className="pill dark">{p.key}</span>
        <span className="pill light">
          {p.visibility === 'global' ? <Globe size={12} /> : <Lock size={12} />}
          {t.visibility[p.visibility]}
        </span>
      </div>
      <span className="arrow" aria-hidden="true">
        <ArrowUpRight size={18} />
      </span>
      <span className="meta">{p.clientName || t.projects.noClient}</span>
      <h3>{p.name}</h3>
      <div className="project-dates">
        {!p.startDate && !p.endDateTentative && <span className="meta">{t.projects.noDates}</span>}
        {p.startDate && <span className="meta">{formatDate(p.startDate)} →</span>}
        <DateBadge date={p.endDateTentative} finished={FINISHED.includes(p.status)} label={t.projects.end} />
      </div>

      <div className="progress" aria-label={`${t.projects.progress}: ${p.stats.progress}%`}>
        <div className="progress-head">
          <span>{t.projects.tasks(p.stats.total)}</span>
          <strong>{p.stats.progress}%</strong>
        </div>
        <div className="progress-track">
          <span style={{ width: `${p.stats.progress}%` }} />
        </div>
      </div>

      <div className="project-card-foot">
        <span className="pill light">{t.projectStatus[p.status]}</span>
        {p.visibility === 'global' ? (
          <span className="meta">{t.projects.everyone}</span>
        ) : (
          <span className="avatar-stack">
            {p.members.map((m) => (
              <Avatar key={m.id} user={m} size={30} />
            ))}
            {p.memberCount > p.members.length && (
              <span className="avatar more" style={{ width: 30, height: 30, fontSize: 11 }}>
                +{p.memberCount - p.members.length}
              </span>
            )}
          </span>
        )}
      </div>
    </Link>
  )
}

/** /projects — RF-PRJ-11 con filtros reflejados en la URL. */
export function ProjectsPage() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') || '')
  const [client, setClient] = useState(params.get('client') || '')

  const filters = {
    q: params.get('q') || '',
    client: params.get('client') || '',
    status: params.get('status') || '',
    mine: params.get('mine') || '',
    includeArchived: params.get('includeArchived') || '',
  }

  function setParam(key, value) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  // Texto libre con debounce.
  useEffect(() => {
    const id = setTimeout(() => {
      if (q.trim() !== filters.q) setParam('q', q.trim())
      if (client.trim() !== filters.client) setParam('client', client.trim())
    }, 300)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, client])

  const projects = useProjects(filters)

  let content
  if (projects.isPending) {
    content = (
      <div className="project-grid" role="status" aria-label={t.common.loading}>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} height={250} radius={24} />
        ))}
      </div>
    )
  } else if (projects.isError) {
    content = <ErrorState error={projects.error} onRetry={() => projects.refetch()} />
  } else if (projects.data.items.length === 0) {
    content = (
      <EmptyState
        icon={FolderKanban}
        color="bg-lilac"
        title={t.projects.emptyTitle}
        body={t.projects.emptyBody}
        action={
          <Link className="btn btn-dark" to="/projects/new">
            <Plus size={18} /> {t.projects.new}
          </Link>
        }
      />
    )
  } else {
    content = (
      <div className="project-grid">
        {projects.data.items.map((p) => (
          <ProjectCard key={p.id} p={p} />
        ))}
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{t.projects.title}</h1>
          <p className="muted">{t.projects.subtitle}</p>
        </div>
        <Link className="btn btn-dark" to="/projects/new">
          <Plus size={18} /> {t.projects.new}
        </Link>
      </div>

      <div className="toolbar">
        <div className="segmented" role="group" aria-label={t.projects.mine}>
          <button type="button" aria-pressed={!filters.mine} onClick={() => setParam('mine', '')}>
            {t.projects.all}
          </button>
          <button type="button" aria-pressed={Boolean(filters.mine)} onClick={() => setParam('mine', '1')}>
            {t.projects.mine}
          </button>
        </div>
        <input
          className="input"
          type="search"
          aria-label={t.projects.search}
          placeholder={t.projects.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <input
          className="input"
          type="search"
          aria-label={t.projects.clientFilter}
          placeholder={t.projects.clientFilter}
          value={client}
          onChange={(e) => setClient(e.target.value)}
        />
        <select
          className="select"
          aria-label={t.projects.status}
          value={filters.status}
          onChange={(e) => setParam('status', e.target.value)}
        >
          <option value="">{t.projects.allStatus}</option>
          {Object.entries(t.projectStatus).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <label className="check">
          <input
            type="checkbox"
            checked={Boolean(filters.includeArchived)}
            onChange={(e) => setParam('includeArchived', e.target.checked ? '1' : '')}
          />
          {t.projects.showArchived}
        </label>
      </div>

      {content}
    </div>
  )
}
