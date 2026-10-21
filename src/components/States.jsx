import { AlertTriangle, Lock, SearchX } from 'lucide-react'
import { Link } from 'react-router'
import { t } from '../i18n/es'

export function FullPageLoader() {
  return (
    <div className="full-loader" role="status">
      <div className="spinner" />
      <span className="sr-only">{t.common.loading}</span>
    </div>
  )
}

export function Skeleton({ height = 16, width = '100%', radius, style }) {
  return <div className="skeleton" style={{ height, width, borderRadius: radius, ...style }} aria-hidden="true" />
}

/** Varias filas de skeleton para listas y tablas. */
export function SkeletonRows({ rows = 5, height = 52 }) {
  return (
    <div className="stack" style={{ gap: 10 }} role="status" aria-label={t.common.loading}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={height} radius={16} />
      ))}
    </div>
  )
}

export function EmptyState({ icon: Icon = SearchX, color = 'bg-yellow', title, body, action }) {
  return (
    <div className="state">
      <div className={`badge ${color}`}>
        <Icon size={28} />
      </div>
      <h3>{title}</h3>
      {body && <p>{body}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="state" role="alert">
      <div className="badge bg-coral">
        <AlertTriangle size={28} />
      </div>
      <h3>{t.common.errorTitle}</h3>
      <p>{error?.message || t.common.errorGeneric}</p>
      {onRetry && (
        <button type="button" className="btn btn-dark" onClick={onRetry}>
          {t.common.retry}
        </button>
      )}
    </div>
  )
}

export function NoAccess() {
  return (
    <div className="page">
      <EmptyState icon={Lock} color="bg-lilac" title={t.common.noAccessTitle} body={t.common.noAccessBody} />
    </div>
  )
}

export function NotFound() {
  return (
    <div className="page">
      <EmptyState
        icon={SearchX}
        color="bg-cyan"
        title={t.common.notFoundTitle}
        body={t.common.notFoundBody}
        action={
          <Link className="btn btn-dark" to="/">
            {t.common.backHome}
          </Link>
        }
      />
    </div>
  )
}
