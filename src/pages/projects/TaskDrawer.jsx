import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Eye, Pencil, Trash2, X } from 'lucide-react'
import { api } from '../../lib/api'
import { PRIORITIES, STATUSES, invalidateTaskViews, localToday, taskKeys, useProjectPeople, useTask } from '../../lib/tasks'
import { TASK_STATUS_COLOR, dueTone } from '../../lib/ui'
import { Markdown } from '../../components/Markdown'
import { DateBadge } from '../../components/TaskCard'
import { UserPicker } from '../../components/UserPicker'
import { EmptyState, Skeleton } from '../../components/States'
import { Comments } from '../../components/Comments'
import { Attachments } from '../../components/Attachments'
import { ActivityFeed } from '../../components/ActivityFeed'
import { useToast } from '../../components/Toast'
import { t } from '../../i18n/es'

const DATETIME = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' })

const FIELDS = ['title', 'description', 'status', 'priority', 'start_date', 'due_date']

/** Borrador editable a partir de la tarea guardada. */
function toDraft(task) {
  return {
    title: task.title,
    description: task.description || '',
    status: task.status,
    priority: task.priority,
    start_date: task.startDate || '',
    due_date: task.dueDate || '',
    assignees: task.assignees,
  }
}

/** Qué cambió respecto a lo guardado: campos para PATCH y si cambian asignados. */
function diffDraft(draft, task) {
  const original = toDraft(task)
  const changes = {}
  for (const k of FIELDS) {
    const a = k === 'title' ? draft[k].trim() : draft[k]
    if (a !== original[k]) changes[k] = (k === 'start_date' || k === 'due_date') && a === '' ? null : a
  }
  const ids = (list) => list.map((u) => u.id).sort().join()
  const assigneesChanged = ids(draft.assignees) !== ids(original.assignees)
  return { changes, assigneesChanged, dirty: Object.keys(changes).length > 0 || assigneesChanged }
}

/**
 * Cuerpo del panel. Los cambios se acumulan en un borrador local y solo se
 * envían con "Guardar cambios"; "Cancelar" vuelve a lo guardado.
 */
function DrawerBody({ task, project, onClose, dirtyRef }) {
  const qc = useQueryClient()
  const toast = useToast()
  const people = useProjectPeople(project.id)
  const [draft, setDraft] = useState(() => toDraft(task))
  const [editingDesc, setEditingDesc] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [tab, setTab] = useState('comments')
  const refreshActivity = () => qc.invalidateQueries({ queryKey: ['activity'] })

  const { changes, assigneesChanged, dirty } = diffDraft(draft, task)
  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty, dirtyRef])

  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }))

  function cancel() {
    setDraft(toDraft(task))
    setEditingDesc(false)
    setFieldErrors({})
  }

  async function save() {
    if (!draft.title.trim()) {
      setFieldErrors({ title: t.tasks.titleRequired })
      return
    }
    setSaving(true)
    setFieldErrors({})
    let latest = task
    try {
      if (Object.keys(changes).length > 0) {
        latest = (await api.patch(`/tasks/${task.id}?today=${localToday()}`, changes)).task
      }
      if (assigneesChanged) {
        latest = (
          await api.put(`/tasks/${task.id}/assignees?today=${localToday()}`, {
            user_ids: draft.assignees.map((u) => u.id),
          })
        ).task
      }
      qc.setQueryData(taskKeys.detail(latest.ref), latest)
      invalidateTaskViews(qc, project.key)
      setDraft(toDraft(latest))
      setEditingDesc(false)
      toast.success(t.common.saved)
    } catch (err) {
      if (err.fields) setFieldErrors(err.fields)
      toast.error(err.fields ? Object.values(err.fields)[0] : err.message)
      // Si una parte sí se guardó (p. ej. campos y no asignados), refresca lo guardado.
      if (latest !== task) qc.setQueryData(taskKeys.detail(latest.ref), latest)
      invalidateTaskViews(qc, project.key)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!window.confirm(t.tasks.confirmDelete(task.ref))) return
    try {
      await api.del(`/tasks/${task.id}`)
      qc.removeQueries({ queryKey: taskKeys.detail(task.ref) })
      invalidateTaskViews(qc, project.key)
      toast.success(t.tasks.deleted(task.ref))
      dirtyRef.current = false
      onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const dueToneDraft = dueTone(draft.due_date, { finished: draft.status === 'done' }).tone

  return (
    <>
      <div className="drawer-content">
        <div className="field">
          <textarea
            className="drawer-title"
            aria-label={t.tasks.title}
            aria-invalid={fieldErrors.title ? 'true' : undefined}
            rows={1}
            maxLength={200}
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value.replace(/\n/g, '') }))}
            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
          />
          {fieldErrors.title && <span className="field-error">{fieldErrors.title}</span>}
        </div>

        <div className="drawer-fields">
          <label className="drawer-field">
            <span>{t.tasks.status}</span>
            <select className={`select pill-select bg-${TASK_STATUS_COLOR[draft.status]}`} value={draft.status} onChange={set('status')}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t.taskStatus[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="drawer-field">
            <span>{t.tasks.priority}</span>
            <select className="select" value={draft.priority} onChange={set('priority')}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {t.priority[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="drawer-field">
            <span>{t.tasks.start}</span>
            <input
              className="input"
              type="date"
              value={draft.start_date}
              max={draft.due_date || undefined}
              onChange={set('start_date')}
              aria-invalid={fieldErrors.start_date ? 'true' : undefined}
            />
            {fieldErrors.start_date && <span className="field-error">{fieldErrors.start_date}</span>}
          </label>
          <label className="drawer-field">
            <span>
              {t.tasks.due} <DateBadge date={draft.due_date} finished={draft.status === 'done'} />
            </span>
            <input
              className={`input due-input due-${dueToneDraft}`}
              type="date"
              value={draft.due_date}
              min={draft.start_date || undefined}
              onChange={set('due_date')}
              aria-invalid={fieldErrors.due_date ? 'true' : undefined}
            />
            {fieldErrors.due_date && <span className="field-error">{fieldErrors.due_date}</span>}
          </label>
        </div>

        <div className="drawer-section">
          <UserPicker
            label={t.tasks.assignees}
            value={draft.assignees}
            options={people.data || []}
            onChange={(assignees) => setDraft((d) => ({ ...d, assignees }))}
          />
          {fieldErrors.assignee_ids && <span className="field-error">{fieldErrors.assignee_ids}</span>}
        </div>

        <div className="drawer-section">
          <div className="drawer-section-head">
            <h3>{t.tasks.description}</h3>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingDesc((v) => !v)}>
              {editingDesc ? <Eye size={14} /> : <Pencil size={14} />}
              {editingDesc ? t.tasks.preview : t.tasks.editDescription}
            </button>
          </div>
          {editingDesc ? (
            <>
              <textarea
                className="input textarea"
                autoFocus
                rows={8}
                value={draft.description}
                aria-label={t.tasks.description}
                onChange={set('description')}
              />
              <span className="field-hint">{t.projects.descriptionHint}</span>
            </>
          ) : draft.description ? (
            <Markdown>{draft.description}</Markdown>
          ) : (
            <p className="muted">{t.tasks.noDescription}</p>
          )}
        </div>

        <div className="drawer-meta">
          {task.createdBy && (
            <span>
              {t.tasks.createdBy} <strong>{task.createdBy.name}</strong> · {DATETIME.format(new Date(task.createdAt))}
            </span>
          )}
          {task.completedAt && (
            <span>
              {t.tasks.completedAt}: {DATETIME.format(new Date(task.completedAt))}
            </span>
          )}
        </div>

        <div className="segmented tabs" role="tablist" style={{ marginTop: 8 }}>
          {Object.entries(t.tasks.tabs).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} aria-pressed={tab === id} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        {tab === 'comments' && <Comments scope="tasks" id={task.id} onActivity={refreshActivity} />}
        {tab === 'attachments' && <Attachments scope="tasks" id={task.id} onActivity={refreshActivity} />}
        {tab === 'activity' && <ActivityFeed scope="tasks" id={task.id} />}

        {task.permissions?.canDelete && (
          <div className="drawer-danger">
            <button type="button" className="btn btn-danger btn-sm" onClick={remove}>
              <Trash2 size={15} /> {t.tasks.delete}
            </button>
          </div>
        )}
      </div>

      <footer className={`drawer-footer${dirty ? ' dirty' : ''}`}>
        <span className="drawer-footer-note" aria-live="polite">
          {dirty ? t.tasks.unsaved : t.tasks.noChanges}
        </span>
        <button type="button" className="btn btn-ghost" onClick={cancel} disabled={!dirty || saving}>
          {t.common.cancel}
        </button>
        <button type="button" className="btn btn-dark" onClick={save} disabled={!dirty || saving}>
          {saving ? t.common.saving : t.tasks.saveChanges}
        </button>
      </footer>
    </>
  )
}

/** /projects/:key/tasks/:number — panel lateral con URL propia (sección 6). */
export function TaskDrawer({ project, number, onClose }) {
  const ref = `${project.key}-${number}`
  const task = useTask(ref)
  const panelRef = useRef(null)
  const titleId = useId()
  const dirtyRef = useRef(false)

  // Con cambios sin guardar, pide confirmación antes de cerrar.
  const requestClose = useRef(() => {})
  useEffect(() => {
    requestClose.current = () => {
      if (dirtyRef.current && !window.confirm(t.tasks.discardChanges)) return
      onClose()
    }
  })

  // Solo al montar: si dependiera de onClose (nuevo en cada render) robaría
  // el foco de los campos mientras se escribe.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !e.defaultPrevented && requestClose.current()
    document.addEventListener('keydown', onKey)
    panelRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  let body
  if (task.isPending) {
    body = (
      <div className="drawer-content">
        <Skeleton height={40} />
        <Skeleton height={120} radius={18} />
        <Skeleton height={200} radius={18} />
      </div>
    )
  } else if (task.isError) {
    body = (
      <div className="drawer-content">
        <EmptyState title={t.common.notFoundTitle} body={task.error.status === 404 ? t.tasks.notFound : task.error.message} />
      </div>
    )
  } else {
    // key: tras guardar (o si cambia en otro lado) el borrador parte de lo guardado.
    body = (
      <DrawerBody
        key={`${task.data.id}-${task.data.updatedAt}`}
        task={task.data}
        project={project}
        onClose={onClose}
        dirtyRef={dirtyRef}
      />
    )
  }

  return createPortal(
    <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && requestClose.current()}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panelRef} tabIndex={-1}>
        <header className="drawer-head">
          <span id={titleId} className="pill dark ref">
            {ref}
          </span>
          <span className="muted" style={{ fontSize: 13 }}>
            {project.name}
          </span>
          <button
            type="button"
            className="icon-btn light"
            onClick={() => requestClose.current()}
            aria-label={t.tasks.closePanel}
            style={{ marginLeft: 'auto' }}
          >
            <X size={18} />
          </button>
        </header>
        {body}
      </aside>
    </div>,
    document.body,
  )
}
