import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CalendarCheck, CalendarClock, CalendarX2, ListChecks, Plus, Zap } from 'lucide-react'
import { ACTIVITY_PHASES, activityPhase, durationDays, useActivities } from '../../lib/activities'
import { formatRange } from '../../lib/ui'
import { Avatar } from '../../components/Avatar'
import { DateBadge } from '../../components/TaskCard'
import { EmptyState, ErrorState, Skeleton } from '../../components/States'
import { t } from '../../i18n/es'

const PHASE_ICON = { overdue: CalendarX2, in_progress: Zap, upcoming: CalendarClock, done: CalendarCheck }

function ActivityCard({ a }) {
  const days = durationDays(a.startDate, a.endDateTentative)
  const finished = ['completed', 'archived'].includes(a.status)
  return (
    <Link to={`/activities/${a.key}`} className={`activity-card${a.status === 'archived' ? ' is-archived' : ''}`}>
      <div className="activity-card-top">
        <span className="pill dark">{a.key}</span>
        {a.endDateTentative && <DateBadge date={a.endDateTentative} finished={finished} label={t.activities.end} />}
      </div>
      <h3>{a.name}</h3>
      <span className="meta">
        {formatRange(a.startDate, a.endDateTentative, t.activities.noPeriod)}
        {days ? ` · ${t.activities.days(days)}` : ''}
      </span>
      <div className="progress" aria-label={`${t.activities.progress}: ${a.stats.progress}%`}>
        <div className="progress-head">
          <span>{t.activities.tasksDone(a.stats.done, a.stats.total)}</span>
          <strong>{a.stats.progress}%</strong>
        </div>
        <div className="progress-track">
          <span style={{ width: `${a.stats.progress}%` }} />
        </div>
      </div>
      <div className="activity-card-owner">
        {a.owner ? (
          <>
            <Avatar user={a.owner} size={26} />
            <span>{a.owner.name}</span>
          </>
        ) : (
          <span className="muted">{t.activities.noOwner}</span>
        )}
      </div>
    </Link>
  )
}

/** /activities — dashboard de Actividades agrupadas por momento (vencidas, en curso, próximas, completadas). */
export function ActivitiesPage() {
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

  const activities = useActivities(filters)
  const items = activities.data?.items

  // Responsables presentes en el listado (para el filtro, en memoria).
  const owners = useMemo(() => {
    const map = new Map()
    for (const a of items || []) if (a.owner) map.set(a.owner.id, a.owner)
    return [...map.values()].sort((x, y) => x.name.localeCompare(y.name))
  }, [items])

  const groups = useMemo(() => {
    const g = Object.fromEntries(ACTIVITY_PHASES.map((p) => [p.id, []]))
    for (const a of items || []) {
      if (owner && a.owner?.id !== owner) continue
      g[activityPhase(a)].push(a)
    }
    // Lo más urgente primero: por fecha fin (sin fecha al final).
    for (const list of Object.values(g)) {
      list.sort((x, y) => (x.endDateTentative || '9999').localeCompare(y.endDateTentative || '9999'))
    }
    return g
  }, [items, owner])

  const visibleTotal = Object.values(groups).reduce((n, l) => n + l.length, 0)

  let content
  if (activities.isPending) {
    content = (
      <div className="mytasks-grid" role="status" aria-label={t.common.loading}>
        {ACTIVITY_PHASES.map((p) => (
          <Skeleton key={p.id} height={260} radius={24} />
        ))}
      </div>
    )
  } else if (activities.isError) {
    content = <ErrorState error={activities.error} onRetry={() => activities.refetch()} />
  } else if (visibleTotal === 0) {
    content = (
      <EmptyState
        icon={ListChecks}
        color="bg-yellow"
        title={t.activities.emptyTitle}
        body={t.activities.emptyBody}
        action={
          <Link className="btn btn-dark" to="/activities/new">
            <Plus size={18} /> {t.activities.new}
          </Link>
        }
      />
    )
  } else {
    content = (
      <div className="mytasks-grid">
        {ACTIVITY_PHASES.map(({ id, color }) => (
          <section key={id} className="mytasks-group" aria-labelledby={`ph-${id}`}>
            <header className={`mytasks-head bg-${color}`}>
              <h2 id={`ph-${id}`}>{t.activities.phases[id]}</h2>
              <span className="count">{groups[id].length}</span>
            </header>
            {groups[id].length === 0 ? (
              <p className="muted mytasks-empty">{t.activities.phaseEmpty}</p>
            ) : (
              <ul className="activity-list">
                {groups[id].map((a) => (
                  <li key={a.id}>
                    <ActivityCard a={a} />
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
          <h1>{t.activities.title}</h1>
          <p className="muted">{t.activities.subtitle}</p>
          {items && <p className="muted">{t.activities.total(visibleTotal)}</p>}
        </div>
        <div className="head-actions activities-head">
          {items && (
            <div className="hero-counts">
              {ACTIVITY_PHASES.map(({ id, color }) => {
                const Icon = PHASE_ICON[id]
                return (
                  <div key={id} className={`hero-count bg-${color}`}>
                    <Icon size={18} aria-hidden="true" />
                    <strong>{groups[id].length}</strong>
                    <span>{t.activities.phases[id]}</span>
                  </div>
                )
              })}
            </div>
          )}
          <Link className="btn btn-dark" to="/activities/new">
            <Plus size={18} /> {t.activities.new}
          </Link>
        </div>
      </div>

      <div className="toolbar">
        <div className="segmented" role="group" aria-label={t.activities.mine}>
          <button type="button" aria-pressed={!filters.mine} onClick={() => setParam('mine', '')}>
            {t.activities.all}
          </button>
          <button type="button" aria-pressed={Boolean(filters.mine)} onClick={() => setParam('mine', '1')}>
            {t.activities.mine}
          </button>
        </div>
        <input
          className="input"
          type="search"
          aria-label={t.activities.search}
          placeholder={t.activities.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="select"
          aria-label={t.activities.ownerFilter}
          value={owner}
          onChange={(e) => setParam('owner', e.target.value)}
        >
          <option value="">{t.activities.anyOwner}</option>
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
          {t.activities.showArchived}
        </label>
      </div>

      {content}
    </div>
  )
}
