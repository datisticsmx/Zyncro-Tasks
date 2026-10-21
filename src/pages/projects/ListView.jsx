import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { ArrowDown, ArrowUp, ListChecks } from 'lucide-react'
import { PRIORITIES, STATUSES, useTaskList } from '../../lib/tasks'
import { TASK_STATUS_COLOR } from '../../lib/ui'
import { AssigneeStack, DueBadge, PriorityPill } from '../../components/TaskCard'
import { EmptyState, ErrorState, SkeletonRows } from '../../components/States'
import { t } from '../../i18n/es'

const PAGE_SIZE = 50

const COLUMNS = [
  { id: 'number', label: t.tasks.colRef, sortable: true },
  { id: 'title', label: t.tasks.colTitle },
  { id: 'status', label: t.tasks.colStatus, sortable: true },
  { id: 'priority', label: t.tasks.colPriority, sortable: true },
  { id: 'assignees', label: t.tasks.colAssignees },
  { id: 'due_date', label: t.tasks.colDue, sortable: true },
]

/** /projects/:key/list — RF-VIEW-02 con filtros y orden reflejados en la URL. */
export function ListView({ project }) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [q, setQ] = useState(params.get('q') || '')

  const filters = {
    status: params.get('status') || '',
    priority: params.get('priority') || '',
    assignee: params.get('assignee') || '',
    overdue: params.get('overdue') || '',
    q: params.get('q') || '',
    sort: params.get('sort') || 'due_date',
    dir: params.get('dir') || 'asc',
    page: Number(params.get('page')) || 1,
    pageSize: PAGE_SIZE,
  }

  function setParam(key, value) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  useEffect(() => {
    const id = setTimeout(() => q.trim() !== filters.q && setParam('q', q.trim()), 300)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  function toggleSort(col) {
    const next = new URLSearchParams(params)
    if (filters.sort === col) next.set('dir', filters.dir === 'asc' ? 'desc' : 'asc')
    else {
      next.set('sort', col)
      next.set('dir', 'asc')
    }
    next.delete('page')
    setParams(next, { replace: true })
  }

  const list = useTaskList(project.id, filters)
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1
  const open = (task) =>
    navigate(`/projects/${project.key}/tasks/${task.number}`, {
      state: { from: location.pathname + location.search, view: 'list' },
    })

  let content
  if (list.isPending) content = <SkeletonRows rows={8} />
  else if (list.isError) content = <ErrorState error={list.error} onRetry={() => list.refetch()} />
  else if (list.data.items.length === 0)
    content = <EmptyState icon={ListChecks} color="bg-cyan" title={t.tasks.emptyTitle} body={t.tasks.emptyBody} />
  else
    content = (
      <>
        <div className="table-wrap">
          <table className="table task-table">
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th
                    key={c.id}
                    scope="col"
                    aria-sort={
                      filters.sort === c.id ? (filters.dir === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                  >
                    {c.sortable ? (
                      <button type="button" className="th-sort" onClick={() => toggleSort(c.id)} aria-label={t.tasks.sortBy(c.label)}>
                        {c.label}
                        {filters.sort === c.id &&
                          (filters.dir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((task) => (
                <tr key={task.id} className="row-link" onClick={() => open(task)}>
                  <td>
                    <span className="pill dark ref">{task.ref}</span>
                  </td>
                  <td className="title-cell">
                    <button type="button" className="row-title" onClick={() => open(task)}>
                      {task.title}
                    </button>
                  </td>
                  <td>
                    <span className={`pill ${TASK_STATUS_COLOR[task.status]}`}>
                      <span className="dot" /> {t.taskStatus[task.status]}
                    </span>
                  </td>
                  <td>
                    <PriorityPill priority={task.priority} />
                  </td>
                  <td>
                    <AssigneeStack users={task.assignees} />
                    {task.assignees.length === 0 && <span className="muted">—</span>}
                  </td>
                  <td>
                    <DueBadge task={task} />
                    {!task.dueDate && <span className="muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="pager">
            <span className="muted">{t.common.pageOf(filters.page, pages)}</span>
            <button className="btn btn-ghost btn-sm" disabled={filters.page <= 1} onClick={() => setParam('page', String(filters.page - 1))}>
              {t.common.prev}
            </button>
            <button className="btn btn-ghost btn-sm" disabled={filters.page >= pages} onClick={() => setParam('page', String(filters.page + 1))}>
              {t.common.next}
            </button>
          </div>
        )}
      </>
    )

  return (
    <div>
      <div className="toolbar">
        <input
          className="input"
          type="search"
          aria-label={t.tasks.searchTitle}
          placeholder={t.tasks.searchTitle}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="select" aria-label={t.tasks.colStatus} value={filters.status} onChange={(e) => setParam('status', e.target.value)}>
          <option value="">{t.tasks.allStatus}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t.taskStatus[s]}
            </option>
          ))}
        </select>
        <select
          className="select"
          aria-label={t.tasks.colPriority}
          value={filters.priority}
          onChange={(e) => setParam('priority', e.target.value)}
        >
          <option value="">{t.tasks.allPriorities}</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {t.priority[p]}
            </option>
          ))}
        </select>
        <select
          className="select"
          aria-label={t.tasks.colAssignees}
          value={filters.assignee}
          onChange={(e) => setParam('assignee', e.target.value)}
        >
          <option value="">{t.tasks.anyAssignee}</option>
          <option value="me">{t.tasks.assignedToMe}</option>
          <option value="none">{t.tasks.unassigned}</option>
        </select>
        <label className="check">
          <input
            type="checkbox"
            checked={filters.overdue === '1'}
            onChange={(e) => setParam('overdue', e.target.checked ? '1' : '')}
          />
          {t.tasks.onlyOverdue}
        </label>
      </div>
      {content}
    </div>
  )
}
