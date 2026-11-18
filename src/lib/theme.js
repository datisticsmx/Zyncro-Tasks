import { useCallback, useState } from 'react'

/**
 * Temas visuales. Solo cambian la apariencia: se guardan en este navegador
 * (localStorage), no viajan al servidor y no afectan a nadie más.
 *
 * El tema activo vive en <html data-theme="…">; las reglas están en
 * src/styles/themes.css. index.html lo aplica antes de pintar para que no
 * haya un parpadeo del tema anterior al recargar.
 */

export const STORAGE_KEY = 'zyncro.theme'
export const DEFAULT_THEME = 'zyncro'

export const THEMES = [
  {
    id: 'zyncro',
    name: 'Zyncro',
    tagline: 'El de siempre, en claro.',
    paper: '#ffffff',
    rail: ['#f7f38a', '#f7f38a'],
    bars: ['#c9a5f7', '#ff8b7b', '#7fe3f0'],
  },
  {
    id: 'gta6',
    name: 'GTA VI',
    tagline: 'Vice City: neón sobre morado.',
    paper: '#180c27',
    rail: ['#ff3da6', '#ff7a3d'],
    bars: ['#ffc24a', '#5de3f0', '#d49bff'],
  },
]

export const isTheme = (id) => THEMES.some((theme) => theme.id === id)

export function readTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return isTheme(saved) ? saved : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME // modo privado o storage bloqueado
  }
}

/** Pinta el tema y lo recuerda. Devuelve el que quedó activo. */
export function applyTheme(id) {
  const theme = isTheme(id) ? id : DEFAULT_THEME
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* sin storage el tema dura lo que la pestaña */
  }
  return theme
}

export function useTheme() {
  const [theme, setTheme] = useState(readTheme)
  const choose = useCallback((id) => setTheme(applyTheme(id)), [])
  return [theme, choose]
}
