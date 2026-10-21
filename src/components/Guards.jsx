import { Navigate, Outlet, useLocation } from 'react-router'
import { WifiOff } from 'lucide-react'
import { useMe } from '../lib/session'
import { FullPageLoader, NoAccess } from './States'
import { t } from '../i18n/es'

/**
 * Sin conexión con el backend (reinicio, caída): no es lo mismo que no tener
 * sesión, así que no se manda a /login; se espera y se ofrece reintentar.
 */
function Reconnecting({ me }) {
  const gaveUp = me.isError
  return (
    <div className="full-loader">
      <div className="state" role="status" style={{ background: 'transparent' }}>
        {gaveUp ? (
          <div className="badge bg-coral">
            <WifiOff size={28} />
          </div>
        ) : (
          <div className="spinner" />
        )}
        <h3>{gaveUp ? t.connection.lostTitle : t.connection.reconnecting}</h3>
        <p>{t.connection.body}</p>
        {gaveUp && (
          <button type="button" className="btn btn-dark" onClick={() => me.refetch()}>
            {t.common.retry}
          </button>
        )}
      </div>
    </div>
  )
}

/** Rutas privadas: sin sesión (401) redirige a /login?next=<ruta>. */
export function RequireAuth() {
  const me = useMe()
  const location = useLocation()
  if (me.isPending) return me.failureCount > 0 ? <Reconnecting me={me} /> : <FullPageLoader />
  if (me.isError) return <Reconnecting me={me} />
  if (!me.data) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  return <Outlet />
}

/** La UI oculta lo que no aplica; la autorización real está en el backend. */
export function RequireAdmin() {
  const { data: user } = useMe()
  if (user?.role !== 'admin') return <NoAccess />
  return <Outlet />
}

/** Rutas públicas (login, invitación…): con sesión activa manda al inicio. */
export function PublicOnly() {
  const me = useMe()
  if (me.isPending) return me.failureCount > 0 ? <Reconnecting me={me} /> : <FullPageLoader />
  if (me.data) return <Navigate to="/" replace />
  return <Outlet />
}
