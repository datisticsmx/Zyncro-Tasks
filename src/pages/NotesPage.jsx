import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Paperclip, Pencil, Plus, StickyNote, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { NOTES_KEY, NOTE_VISIBILITIES, VISIBILITY_ICON, useNotes } from '../lib/notes'
import { Avatar } from '../components/Avatar'
import { NoteModal } from '../components/NoteModal'
import { ProjectKeyPill } from '../components/ProjectKeyPill'
import { EmptyState, ErrorState, Skeleton } from '../components/States'
import { useToast } from '../components/Toast'
import { t } from '../i18n/es'

const DATE = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' })

/** Minúsculas y sin acentos, para que "reunion" encuentre "Reunión". */
const fold = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** Todo el texto visible de la nota: cuerpo, autor, proyecto, destinatarios y nombres de archivo. */
const haystack = (n) =>
  fold(
    [
      n.body,
      n.author.name,
      n.project && `${n.project.key} ${n.project.name}`,
      ...n.recipients.map((u) => u.name),
      ...n.attachments.map((a) => a.name),
    ]
      .filter(Boolean)
      .join('\n'),
  )

function NoteCard({ note, onEdit, onDelete }) {
  const Icon = VISIBILITY_ICON[note.visibility]
  const scope =
    note.visibility === 'selected'
      ? t.notes.sharedWith(note.recipients.map((u) => u.name).join(', '))
      : t.notes.visibility[note.visibility]
  return (
    <li className={`note bg-${note.color}`}>
      <div className="note-top">
        <span className="note-scope" title={scope}>
          <Icon size={14} aria-hidden="true" />
          {t.notes.visibility[note.visibility]}
        </span>
        {note.project && (
          <Link to={`/projects/${note.project.key}`} title={note.project.name} className="note-project">
            <ProjectKeyPill project={note.project} />
          </Link>
        )}
        <span className="note-actions">
          {note.permissions.canEdit && (
            <button type="button" className="note-btn" onClick={() => onEdit(note)} aria-label={t.notes.edit} title={t.notes.edit}>
              <Pencil size={15} />
            </button>
          )}
          {note.permissions.canDelete && (
            <button type="button" className="note-btn" onClick={() => onDelete(note)} aria-label={t.notes.delete} title={t.notes.delete}>
              <Trash2 size={15} />
            </button>
          )}
        </span>
      </div>
      <p className="note-body">{note.body}</p>
      {note.attachments.length > 0 && (
        <ul className="note-attachments">
          {note.attachments.map((a) => (
            <li key={a.id}>
              <a href={a.downloadUrl} target={a.previewable ? '_blank' : undefined} rel="noopener noreferrer" title={a.name}>
                <Paperclip size={13} aria-hidden="true" />
                <span>{a.name}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <div className="note-foot">
        <Avatar user={note.author} size={24} />
        <span className="who">{note.author.name}</span>
        <time dateTime={note.createdAt}>{DATE.format(new Date(note.createdAt))}</time>
      </div>
    </li>
  )
}

/** "/notes" — muro de notas tipo post-it. */
export function NotesPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const notes = useNotes()
  const [scope, setScope] = useState('all')
  const [project, setProject] = useState('all') // 'all' | 'general' | id de proyecto
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null) // null | 'new' | nota

  const items = useMemo(() => notes.data ?? [], [notes.data])
  // Solo los proyectos que tienen alguna nota, para el filtro.
  const projects = useMemo(() => {
    const map = new Map()
    for (const n of items) if (n.project) map.set(n.project.id, n.project)
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key))
  }, [items])
  // Cada palabra debe aparecer en la nota (en cualquier orden).
  const words = fold(q).split(/\s+/).filter(Boolean)
  const shown = items.filter((n) => {
    if (scope !== 'all' && n.visibility !== scope) return false
    if (project !== 'all' && (project === 'general' ? n.project : n.project?.id !== project)) return false
    if (words.length === 0) return true
    const text = haystack(n)
    return words.every((w) => text.includes(w))
  })

  async function remove(note) {
    if (!window.confirm(t.notes.confirmDelete)) return
    try {
      await api.del(`/notes/${note.id}`)
      toast.success(t.notes.deleted)
      qc.invalidateQueries({ queryKey: NOTES_KEY })
    } catch (err) {
      toast.error(err.message)
    }
  }

  const newButton = (
    <button type="button" className="btn btn-dark" onClick={() => setEditing('new')}>
      <Plus size={18} /> {t.notes.new}
    </button>
  )

  let content
  if (notes.isPending) {
    content = (
      <div className="note-wall" role="status" aria-label={t.common.loading}>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} height={200} radius={6} />
        ))}
      </div>
    )
  } else if (notes.isError) {
    content = <ErrorState error={notes.error} onRetry={() => notes.refetch()} />
  } else if (items.length === 0) {
    content = <EmptyState icon={StickyNote} color="bg-yellow" title={t.notes.emptyTitle} body={t.notes.emptyBody} action={newButton} />
  } else if (shown.length === 0) {
    content = <EmptyState icon={StickyNote} color="bg-cyan" title={t.notes.noMatchTitle} body={t.notes.noMatchBody} />
  } else {
    content = (
      <ul className="note-wall">
        {shown.map((n) => (
          <NoteCard key={n.id} note={n} onEdit={setEditing} onDelete={remove} />
        ))}
      </ul>
    )
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{t.notes.title}</h1>
          <p className="muted">{t.notes.subtitle}</p>
        </div>
        {newButton}
      </div>

      {items.length > 0 && (
        <div className="toolbar note-toolbar">
          <input
            className="input"
            type="search"
            aria-label={t.notes.search}
            placeholder={t.notes.search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="segmented" role="group" aria-label={t.notes.whoSees}>
            {['all', ...NOTE_VISIBILITIES].map((s) => (
              <button key={s} type="button" aria-pressed={scope === s} onClick={() => setScope(s)}>
                {s === 'all' ? t.notes.filterAll : t.notes.visibility[s]}
              </button>
            ))}
          </div>
          <select className="select" aria-label={t.notes.about} value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="all">{t.notes.filterAnyProject}</option>
            <option value="general">{t.notes.filterGeneral}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.key} · {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {content}

      {editing && <NoteModal note={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
