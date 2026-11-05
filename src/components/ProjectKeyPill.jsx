import { isDarkColor, projectColor } from '../lib/projectColor'

/** Clave del proyecto pintada con su color principal. */
export function ProjectKeyPill({ project }) {
  const bg = projectColor(project)
  return (
    <span
      className="pill project-key-pill"
      style={{ background: bg, color: isDarkColor(bg) ? 'var(--text-on-dark)' : 'var(--ink)' }}
    >
      {project.key}
    </span>
  )
}
