import { useState } from 'react'
import { avatarDataUri } from '../lib/avatar'

const COLORS = ['var(--yellow)', 'var(--lilac)', 'var(--coral)', 'var(--cyan)', 'var(--green)', 'var(--pink)']

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?'
}

function colorFor(seed = '') {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return COLORS[h % COLORS.length]
}

/**
 * RF-USR-03. Prioridad: foto propia → avatar diseñado → foto de GitHub →
 * iniciales. La API ya resuelve `avatar` (foto propia o de GitHub, o null si
 * hay avatar diseñado). Si una foto falla al cargar, cae a lo siguiente.
 */
export function Avatar({ user, size = 36 }) {
  const [failed, setFailed] = useState(false)
  const photo = !failed && user?.avatar
  const designed = !photo && user?.avatarConfig ? avatarDataUri(user.avatarConfig) : null
  const src = photo || designed
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.38, background: colorFor(user?.id || user?.name) }}
      title={user?.name}
    >
      {src ? (
        <img src={src} alt="" onError={() => setFailed(true)} referrerPolicy="no-referrer" />
      ) : (
        <span aria-hidden="true">{initials(user?.name)}</span>
      )}
      <span className="sr-only">{user?.name}</span>
    </span>
  )
}
