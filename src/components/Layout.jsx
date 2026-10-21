import { useEffect, useRef, useState } from 'react'
import { NavLink, Link, Outlet } from 'react-router'
import { CheckSquare, ChevronDown, FolderKanban, LogOut, UserRound, Users } from 'lucide-react'
import { useLogout, useMe } from '../lib/session'
import { Avatar } from './Avatar'
import { GlobalSearch } from './GlobalSearch'
import { t } from '../i18n/es'

function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="10" y="10" width="20" height="20" rx="7" fill="#F7F38A" />
      <rect x="34" y="10" width="20" height="20" rx="7" fill="#C9A5F7" />
      <rect x="10" y="34" width="20" height="20" rx="7" fill="#FF8B7B" />
      <rect x="34" y="34" width="20" height="20" rx="7" fill="#9EF0A0" />
    </svg>
  )
}

function RailLink({ to, icon: Icon, label, end }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `rail-link${isActive ? ' active' : ''}`}>
      <Icon size={21} aria-hidden="true" />
      <span className="tip">{label}</span>
      <span className="sr-only">{label}</span>
    </NavLink>
  )
}

/** Barra de navegación amarilla (columna derecha de la inspo). */
function Rail({ isAdmin }) {
  return (
    <aside className="rail" aria-label="Navegación principal">
      <Link to="/" className="rail-logo" aria-label={t.app.name}>
        <Logo />
      </Link>
      <nav>
        <RailLink to="/" end icon={CheckSquare} label={t.nav.myTasks} />
        <RailLink to="/projects" icon={FolderKanban} label={t.nav.projects} />
        {isAdmin && <RailLink to="/admin/users" icon={Users} label={t.nav.users} />}
      </nav>
      <div className="grow" />
      <RailLink to="/profile" icon={UserRound} label={t.nav.profile} />
    </aside>
  )
}

function ProfileMenu({ user }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const logout = useLogout()

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="menu" ref={ref}>
      <button
        type="button"
        className="menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.nav.menu}
        onClick={() => setOpen((o) => !o)}
      >
        <Avatar user={user} size={36} />
        <span className="who">
          <strong>{user.name}</strong>
          <small>{t.roles[user.role]}</small>
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="menu-list" role="menu">
          <Link className="menu-item" role="menuitem" to="/profile" onClick={() => setOpen(false)}>
            <UserRound size={17} /> {t.nav.profile}
          </Link>
          <button
            type="button"
            className="menu-item danger"
            role="menuitem"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            <LogOut size={17} /> {t.nav.logout}
          </button>
        </div>
      )}
    </div>
  )
}

/** Barra superior: búsqueda global (RF-VIEW-04) y perfil. */
function Topbar({ user }) {
  return (
    <header className="topbar">
      <GlobalSearch />
      <div className="spacer" />
      <ProfileMenu user={user} />
    </header>
  )
}

export function AppLayout() {
  const { data: user } = useMe()
  return (
    <div className="shell">
      <div className="main-panel">
        <Topbar user={user} />
        <main className="page-outlet">
          <Outlet />
        </main>
      </div>
      <Rail isAdmin={user.role === 'admin'} />
    </div>
  )
}

export { Logo }
