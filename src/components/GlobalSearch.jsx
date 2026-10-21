import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { FolderKanban, Search } from 'lucide-react'
import { api, qs } from '../lib/api'
import { localToday } from '../lib/tasks'
import { t } from '../i18n/es'

/** RF-VIEW-04: tareas por título o clave (WEB-12) y proyectos por nombre. */
export function GlobalSearch() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef(null)
  const listId = useId()

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 250)
    return () => clearTimeout(id)
  }, [q])

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => !boxRef.current?.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const results = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => api.get(`/search${qs({ q: debounced, today: localToday() })}`),
    enabled: debounced.length >= 2,
    placeholderData: keepPreviousData,
  })

  const items = results.data
    ? [
        ...results.data.tasks.map((x) => ({
          type: 'task',
          id: x.id,
          label: x.title,
          meta: `${x.ref} · ${x.projectName}`,
          to: `/projects/${x.projectKey}/tasks/${x.number}`,
        })),
        ...results.data.projects.map((p) => ({
          type: 'project',
          id: p.id,
          label: p.name,
          meta: p.key,
          to: `/projects/${p.key}`,
        })),
      ]
    : []

  function go(item) {
    setOpen(false)
    setQ('')
    navigate(item.to)
  }

  const showList = open && debounced.length >= 2

  return (
    <div className="search" role="search" ref={boxRef}>
      <Search size={18} aria-hidden="true" />
      <label className="sr-only" htmlFor="global-search">
        {t.nav.search}
      </label>
      <input
        id="global-search"
        className="input"
        type="search"
        placeholder={t.nav.search}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && items[active] ? `${listId}-${active}` : undefined}
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((i) => Math.min(i + 1, items.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter' && items[active]) {
            e.preventDefault()
            go(items[active])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      {showList && (
        <ul className="search-results" id={listId} role="listbox">
          {items.length === 0 && !results.isFetching && <li className="search-empty">{t.search.noResults(debounced)}</li>}
          {items.map((item, i) => (
            <li
              key={`${item.type}-${item.id}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                go(item)
              }}
            >
              <span className={`search-icon ${item.type === 'task' ? 'bg-yellow' : 'bg-lilac'}`}>
                {item.type === 'task' ? <Search size={14} /> : <FolderKanban size={14} />}
              </span>
              <span className="search-text">
                <strong>{item.label}</strong>
                <small>
                  {item.type === 'task' ? t.search.tasks : t.search.projects} · {item.meta}
                </small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
