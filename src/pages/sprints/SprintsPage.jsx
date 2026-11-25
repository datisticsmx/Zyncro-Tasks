import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CalendarCheck, CalendarClock, CalendarX2, Plus, Timer, Zap } from 'lucide-react'
import { SPRINT_PHASES, durationDays, sprintPhase, useSprints } from '../../lib/sprints'
import { formatRange } from '../../lib/ui'
import { Avatar } from '../../components/Avatar'
import { AssigneeStack, DateBadge } from '../../components/TaskCard'
import { EmptyState, ErrorState, Skeleton } from '../../components/States'
import { t } from '../../i18n/es'

const PHASE_ICON = { overdue: CalendarX2, in_progress: Zap, upcoming: CalendarClock, done: CalendarCheck }

function SprintCard({ s }) {
  const days = durationDays(s.startDate, s.endDate)
  const finished = ['completed', 'archived'].includes(s.status)
  return (
    <Link to={`/sprints/${s.key}`} className={`sprint-card${s.status === 'archived' ? ' is-archived' : ''}`}>
      <div className="sprint-card-top">
        <span className="pill dark">{s.key}</span>
        {s.endDate && <DateBadge date={s.endDate} finished={finished} label={t.sprints.end} />}
      </div>
      <h3>{s.name}</h3>
      <span className="meta">
        {formatRange(s.startDate, s.endDate, t.sprints.noPeriod)}
        {days ? ` · ${t.sprints.days(days)}` : ''}
      </span>
      <div className="progress" aria-label={`${t.sprints.progress}: ${s.stats.progress}%`}>
        <div className="progress-head">
          <span>{t.sprints.tasksDone(s.stats.done, s.stats.total)}</span>
          <strong>{s.stats.progress}%</strong>
        </div>
        <div className="progress-track">
          <span style={{ width: `${s.stats.progress}%` }} />
        </div>
      </div>
      <div className="sprint-card-owner">
        {s.owner ? (
          <>
            <Avatar user={s.owner} size={26} />
            <span>{s.owner.name}</span>
          </>
        ) : (
          <span className="muted">{t.sprints.noOwner}</span>
        )}
        <span className="sprint-card-members">
          <AssigneeStack users={s.members} size={22} />
        </span>
      </div>
    </Link>
  )
}

/** /sprints — dashboard de Sprints agrupados por momento (vencidos, en curso, próximos, completados). */
export function SprintsPage() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') || '')
  const owner = params.get('owner') || ''

  const filters = {
    q: params.get('q') || '',
    mine: params.get('mine') || '',
    includeArchived: params.get('includeArchived') || '',
  }

  function setParam(key, value) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  useEffect(() => {
    const id = setTimeout(() => {
      if (q.trim() !== filters.q) setParam('q', q.trim())
    }, 300)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const sprints = useSprints(filters)
  const items = sprints.data?.items

  // Responsables presentes en el listado (para el filtro, en memoria).
  const owners = useMemo(() => {
    const map = new Map()
    for (const s of items || []) if (s.owner) map.set(s.owner.id, s.owner)
    return [...map.values()].sort((x, y) => x.name.localeCompare(y.name))
  }, [items])

  const groups = useMemo(() => {
    const g = Object.fromEntries(SPRINT_PHASES.map((p) => [p.id, []]))
    for (const s of items || []) {
      if (owner && s.owner?.id !== owner) continue
      g[sprintPhase(s)].push(s)
    }
    // Lo más urgente primero: por fecha fin (sin fecha al final).
    for (const list of Object.values(g)) {
      list.sort((x, y) => (x.endDate || '9999').localeCompare(y.endDate || '9999'))
    }
    return g
  }, [items, owner])

  const visibleTotal = Object.values(groups).reduce((n, l) => n + l.length, 0)

  let content
  if (sprints.isPending) {
    content = (
      <div className="mytasks-grid" role="status" aria-label={t.common.loading}>
        {SPRINT_PHASES.map((p) => (
          <Skeleton key={p.id} height={260} radius={24} />
        ))}
      </div>
    )
  } else if (sprints.isError) {
    content = <ErrorState error={sprints.error} onRetry={() => sprints.refetch()} />
  } else if (visibleTotal === 0) {
    content = (
      <EmptyState
        icon={Timer}
        color="bg-yellow"
        title={t.sprints.emptyTitle}
        body={t.sprints.emptyBody}
        action={
          <Link className="btn btn-dark" to="/sprints/new">
            <Plus size={18} /> {t.sprints.new}
          </Link>
        }
      />
    )
  } else {
    content = (
      <div className="mytasks-grid">
        {SPRINT_PHASES.map(({ id, color }) => (
          <section key={id} className="mytasks-group" aria-labelledby={`ph-${id}`}>
            <header className={`mytasks-head bg-${color}`}>
              <h2 id={`ph-${id}`}>{t.sprints.phases[id]}</h2>
              <span className="count">{groups[id].length}</span>
            </header>
            {groups[id].length === 0 ? (
              <p className="muted mytasks-empty">{t.sprints.phaseEmpty}</p>
            ) : (
              <ul className="sprint-list">
                {groups[id].map((s) => (
                  <li key={s.id}>
                    <SprintCard s={s} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{t.sprints.title}</h1>
          <p className="muted">{t.sprints.subtitle}</p>
          {items && <p className="muted">{t.sprints.total(visibleTotal)}</p>}
        </div>
        <div className="head-actions sprints-head">
          {items && (
            <div className="hero-counts">
              {SPRINT_PHASES.map(({ id, color }) => {
                const Icon = PHASE_ICON[id]
                return (
                  <div key={id} className={`hero-count bg-${color}`}>
                    <Icon size={18} aria-hidden="true" />
                    <strong>{groups[id].length}</strong>
                    <span>{t.sprints.phases[id]}</span>
                  </div>
                )
              })}
            </div>
          )}
          <Link className="btn btn-dark" to="/sprints/new">
            <Plus size={18} /> {t.sprints.new}
          </Link>
        </div>
      </div>

      <div className="toolbar">
        <div className="segmented" role="group" aria-label={t.sprints.mine}>
          <button type="button" aria-pressed={!filters.mine} onClick={() => setParam('mine', '')}>
            {t.sprints.all}
          </button>
          <button type="button" aria-pressed={Boolean(filters.mine)} onClick={() => setParam('mine', '1')}>
            {t.sprints.mine}
          </button>
        </div>
        <input
          className="input"
          type="search"
          aria-label={t.sprints.search}
          placeholder={t.sprints.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="select"
          aria-label={t.sprints.ownerFilter}
          value={owner}
          onChange={(e) => setParam('owner', e.target.value)}
        >
          <option value="">{t.sprints.anyOwner}</option>
          {owners.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <label className="check">
          <input
            type="checkbox"
            checked={Boolean(filters.includeArchived)}
            onChange={(e) => setParam('includeArchived', e.target.checked ? '1' : '')}
          />
          {t.sprints.showArchived}
        </label>
      </div>

      {content}
    </div>
  )
}
