import { useRef } from 'react'
import { Check } from 'lucide-react'
import { THEMES, useTheme } from '../lib/theme'
import { t } from '../i18n/es'

/** Miniatura del tema: panel, barra lateral y tres tarjetas. */
function ThemeChip({ theme }) {
  return (
    <span className="theme-chip" style={{ background: theme.paper }} aria-hidden="true">
      {theme.bars.map((color, i) => (
        <i key={color + i} style={{ background: color }} />
      ))}
      <b style={{ background: `linear-gradient(180deg, ${theme.rail[0]}, ${theme.rail[1]})` }} />
    </span>
  )
}

/**
 * Selector de tema (RF-PROF). Es un radiogroup: las flechas cambian de tema
 * igual que en un grupo de radios nativo.
 */
export function ThemePicker() {
  const [current, choose] = useTheme()
  const groupRef = useRef(null)

  const onKeyDown = (e) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key]
    if (!step) return
    e.preventDefault()
    const i = THEMES.findIndex((theme) => theme.id === current)
    const next = THEMES[(i + step + THEMES.length) % THEMES.length]
    choose(next.id)
    groupRef.current?.querySelector(`[data-theme-id="${next.id}"]`)?.focus()
  }

  return (
    <section className="card outlined theme-picker" aria-labelledby="themes-title">
      <h3 id="themes-title">{t.profile.themesTitle}</h3>
      <p className="muted">{t.profile.themesSubtitle}</p>
      <div className="theme-options" role="radiogroup" aria-labelledby="themes-title" ref={groupRef} onKeyDown={onKeyDown}>
        {THEMES.map((theme) => {
          const active = theme.id === current
          return (
            <button
              key={theme.id}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              data-theme-id={theme.id}
              className={`theme-option${active ? ' selected' : ''}`}
              onClick={() => choose(theme.id)}
            >
              <ThemeChip theme={theme} />
              <span className="theme-meta">
                <strong>{theme.name}</strong>
                <small>{theme.tagline}</small>
              </span>
              <span className="theme-tick">{active && <Check size={15} aria-hidden="true" />}</span>
            </button>
          )
        })}
      </div>
      <p className="field-hint">{t.profile.themesHint}</p>
    </section>
  )
}
