import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, ChevronUp, GripVertical, Paperclip, Pencil, Plus, StickyNote, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { NOTES_KEY, NOTE_VISIBILITIES, VISIBILITY_ICON, useNoteOrder, useNotes } from '../lib/notes'
import { useMe } from '../lib/session'
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

/**
 * ¿El texto no cabe en el alto fijo de la nota? Se mide solo con la nota
 * recortada (expandida conserva el último valor, para poder contraerla) y se
 * vuelve a medir si cambia el tamaño (ventana, fuente).
 */
function useOverflow(ref, { enabled, deps }) {
  const [overflows, setOverflows] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !enabled) return undefined
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 1)
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps])
  return overflows
}

function NoteCard({ note, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const bodyRef = useRef(null)
  const bodyOverflows = useOverflow(bodyRef, { enabled: !expanded, deps: [note.body, note.attachments.length] })
  // Recortada caben 2 archivos; con más también se ofrece "Ver más".
  const canExpand = bodyOverflows || note.attachments.length > 2

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: note.id })
  const style = { transform: CSS.Translate.toString(transform), transition }
  // Solo se arrastra desde el asa (mouse, touch y teclado): el resto de la
  // nota queda libre para seleccionar texto, abrir adjuntos, etc.

  const Icon = VISIBILITY_ICON[note.visibility]
  const scope =
    note.visibility === 'selected'
      ? t.notes.sharedWith(note.recipients.map((u) => u.name).join(', '))
      : t.notes.visibility[note.visibility]
  return (
    <li ref={setNodeRef} style={style} className={`note-item${isDragging ? ' dragging' : ''}`}>
      <div className={`note bg-${note.color}${expanded ? ' expanded' : ''}`}>
      <div className="note-top">
        <button
          type="button"
          className="note-btn note-grip"
          aria-label={t.notes.move}
          title={t.notes.move}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={15} />
        </button>
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
      <p className="note-body" ref={bodyRef}>
        {note.body}
      </p>
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
      {canExpand && (
        <button type="button" className="note-more" aria-expanded={expanded} onClick={() => setExpanded((x) => !x)}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? t.notes.showLess : t.notes.showMore}
        </button>
      )}
      <div className="note-foot">
        <Avatar user={note.author} size={24} />
        <span className="who">{note.author.name}</span>
        <time dateTime={note.createdAt}>{DATE.format(new Date(note.createdAt))}</time>
      </div>
      </div>
    </li>
  )
}

/** "/notes" — muro de notas tipo post-it. */
export function NotesPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const notes = useNotes()
  const { data: me } = useMe()
  const [scope, setScope] = useState('all')
  const [project, setProject] = useState('all') // 'all' | 'general' | id de proyecto
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null) // null | 'new' | nota

  const loaded = useMemo(() => notes.data ?? [], [notes.data])
  // Orden propio de cada persona (arrastrando las notas).
  const [items, moveNote] = useNoteOrder(me.id, loaded)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => over && moveNote(active.id, over.id)}
      >
        <SortableContext items={shown.map((n) => n.id)} strategy={rectSortingStrategy}>
          <ul className="note-wall">
            {shown.map((n) => (
              <NoteCard key={n.id} note={n} onEdit={setEditing} onDelete={remove} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
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
