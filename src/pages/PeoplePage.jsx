import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ExternalLink, UsersRound } from 'lucide-react'
import { api, qs } from '../lib/api'
import { useMe } from '../lib/session'
import { Avatar } from '../components/Avatar'
import { EmptyState, ErrorState, Skeleton } from '../components/States'
import { t } from '../i18n/es'

const PAGE_SIZE = 48

/**
 * GET /users ya responde a cualquier usuario con sesión: para un miembro
 * devuelve solo los activos y sin datos personales (nombre, rol, GitHub y
 * avatar), que es justo lo que se pinta aquí.
 */
function usePeople(filters) {
  return useQuery({
    queryKey: ['users', 'people', filters],
    queryFn: () => api.get(`/users${qs(filters)}`),
    placeholderData: keepPreviousData,
  })
}

/** Tarjeta de una persona: foto grande, nombre, rol y su GitHub. */
function PersonCard({ person, isMe }) {
  return (
    <article className={`person-card${isMe ? ' is-me' : ''}`}>
      <Avatar user={person} size={88} />
      <h2 className="person-name">{person.name}</h2>
      <span className={`pill ${person.role === 'admin' ? 'lilac' : ''}`}>{t.roles[person.role]}</span>
      {person.githubUrl ? (
        <a className="person-github" href={person.githubUrl} target="_blank" rel="noopener noreferrer">
          @{person.githubUsername} <ExternalLink size={12} aria-hidden="true" />
        </a>
      ) : (
        <span className="person-github dim">—</span>
      )}
      {isMe && <span className="person-me">{t.people.you}</span>}
    </article>
  )
}

/** /people — directorio del equipo (RF-USR-04 para cualquier usuario). */
export function PeoplePage() {
  const [params, setParams] = useSearchParams()
  const { data: me } = useMe()
  const [q, setQ] = useState(params.get('q') || '')

  const filters = {
    q: params.get('q') || '',
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

  // Búsqueda con rebote, igual que en la lista de tareas.
  useEffect(() => {
    const id = setTimeout(() => q.trim() !== filters.q && setParam('q', q.trim()), 300)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const people = usePeople(filters)
  const pages = people.data ? Math.max(1, Math.ceil(people.data.total / PAGE_SIZE)) : 1

  let content
  if (people.isPending) {
    content = (
      <div className="people-grid" role="status" aria-label={t.common.loading}>
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} height={232} radius={24} />
        ))}
      </div>
    )
  } else if (people.isError) {
    content = <ErrorState error={people.error} onRetry={() => people.refetch()} />
  } else if (people.data.items.length === 0) {
    content = (
      <EmptyState
        icon={UsersRound}
        color="bg-cyan"
        title={filters.q ? t.people.emptySearchTitle(filters.q) : t.people.emptyTitle}
        body={filters.q ? t.people.emptySearchBody : t.people.emptyBody}
      />
    )
  } else {
    content = (
      <>
        <div className="people-grid">
          {people.data.items.map((person) => (
            <PersonCard key={person.id} person={person} isMe={person.id === me.id} />
          ))}
        </div>
        {pages > 1 && (
          <div className="pager">
            <span className="muted">{t.common.pageOf(filters.page, pages)}</span>
            <button
              className="btn btn-ghost btn-sm"
              disabled={filters.page <= 1}
              onClick={() => setParam('page', String(filters.page - 1))}
            >
              {t.common.prev}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              disabled={filters.page >= pages}
              onClick={() => setParam('page', String(filters.page + 1))}
            >
              {t.common.next}
            </button>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{t.people.title}</h1>
          <p className="muted">
            {t.people.subtitle}
            {people.data ? ` · ${t.people.count(people.data.total)}` : ''}
          </p>
        </div>
      </div>

      <div className="toolbar">
        <input
          className="input"
          type="search"
          aria-label={t.people.search}
          placeholder={t.people.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {content}
    </div>
  )
}
