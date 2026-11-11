import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Paperclip, Undo2, X } from 'lucide-react'
import { api, uploadFile } from '../lib/api'
import { ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES, formatBytes } from '../lib/collab'
import { NOTES_KEY, NOTE_COLORS, NOTE_MAX_BODY, NOTE_MAX_FILES, NOTE_VISIBILITIES, VISIBILITY_ICON } from '../lib/notes'
import { useProjects } from '../lib/projects'
import { Modal } from './Modal'
import { UserPicker } from './UserPicker'
import { FormError } from './Field'
import { useToast } from './Toast'
import { t } from '../i18n/es'

const extOf = (name) => {
  const i = name.lastIndexOf('.')
  return i === -1 ? '' : name.slice(i).toLowerCase()
}

const draftOf = (note) => ({
  body: note?.body ?? '',
  color: note?.color ?? 'yellow',
  visibility: note?.visibility ?? 'global',
  recipients: note?.recipients ?? [],
  projectId: note?.project?.id ?? '',
  removed: [], // ids de adjuntos existentes que se quitarán al guardar
  files: [], // File nuevos que se subirán al guardar
})

/**
 * Crear o editar una nota. Todo es borrador local (texto, color, alcance,
 * proyecto y también los archivos por agregar o quitar): nada se envía hasta
 * "Guardar", y cerrar con cambios pendientes pide confirmación.
 */
export function NoteModal({ note, onClose }) {
  const qc = useQueryClient()
  const toast = useToast()
  const fileRef = useRef(null)
  const [initial] = useState(() => draftOf(note))
  const [draft, setDraft] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const projects = useProjects({ pageSize: 100 })

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))
  const fields = error?.fields || {}
  const existing = note?.attachments ?? []
  const fileCount = existing.length - draft.removed.length + draft.files.length

  const dirty =
    draft.body !== initial.body ||
    draft.color !== initial.color ||
    draft.visibility !== initial.visibility ||
    draft.projectId !== initial.projectId ||
    draft.removed.length > 0 ||
    draft.files.length > 0 ||
    draft.recipients.map((u) => u.id).join() !== initial.recipients.map((u) => u.id).join()

  function close() {
    if (saving) return
    if (dirty && !window.confirm(t.notes.confirmDiscard)) return
    onClose()
  }

  function addFiles(list) {
    const ok = []
    let room = NOTE_MAX_FILES - fileCount
    for (const file of Array.from(list)) {
      // Validación rápida en el navegador; la definitiva (por contenido) la hace la API.
      if (file.size > MAX_UPLOAD_BYTES) toast.error(t.attachments.tooBig(file.name))
      else if (!ALLOWED_EXTENSIONS.includes(extOf(file.name))) toast.error(t.attachments.badType(file.name))
      else if (room <= 0) toast.error(t.notes.tooManyFiles(NOTE_MAX_FILES))
      else {
        ok.push(file)
        room -= 1
      }
    }
    if (ok.length) set({ files: [...draft.files, ...ok] })
  }

  const toggleRemoved = (id) =>
    set({ removed: draft.removed.includes(id) ? draft.removed.filter((x) => x !== id) : [...draft.removed, id] })

  async function save(e) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)
    const payload = {
      body: draft.body,
      color: draft.color,
      visibility: draft.visibility,
      recipientIds: draft.visibility === 'selected' ? draft.recipients.map((u) => u.id) : [],
      projectId: draft.projectId || null,
    }
    let saved
    try {
      saved = note ? await api.patch(`/notes/${note.id}`, payload) : await api.post('/notes', payload)
    } catch (err) {
      setError(err)
      setSaving(false)
      return
    }
    // La nota ya quedó guardada; un archivo que falle se avisa aparte.
    const failed = []
    for (const id of draft.removed) {
      try {
        await api.del(`/attachments/${id}`)
      } catch {
        failed.push(existing.find((a) => a.id === id)?.name)
      }
    }
    for (const file of draft.files) {
      try {
        await uploadFile(`/notes/${saved.note.id}/attachments`, file)
      } catch (err) {
        failed.push(err.fields?.file ? `${file.name} (${err.fields.file})` : file.name)
      }
    }
    await qc.invalidateQueries({ queryKey: NOTES_KEY })
    if (failed.length) toast.error(t.notes.filesFailed(failed.filter(Boolean).join(', ')))
    else toast.success(note ? t.common.saved : t.notes.created)
    onClose()
  }

  return (
    <Modal title={note ? t.notes.editTitle : t.notes.newTitle} onClose={close}>
      <form className="note-form" onSubmit={save}>
        <div className="field">
          <label className="sr-only" htmlFor="note-body">
            {t.notes.body}
          </label>
          <textarea
            id="note-body"
            className={`note-input bg-${draft.color}`}
            placeholder={t.notes.bodyPlaceholder}
            value={draft.body}
            maxLength={NOTE_MAX_BODY}
            autoFocus
            aria-invalid={fields.body ? 'true' : undefined}
            onChange={(e) => set({ body: e.target.value })}
          />
          <div className="note-form-row">
            <div className="swatches" role="radiogroup" aria-label={t.notes.color}>
              {NOTE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={draft.color === c}
                  aria-label={t.notes.colors[c]}
                  title={t.notes.colors[c]}
                  className={`swatch bg-${c}`}
                  onClick={() => set({ color: c })}
                >
                  {draft.color === c && <Check size={16} />}
                </button>
              ))}
            </div>
            <span className="field-hint">
              {draft.body.length}/{NOTE_MAX_BODY}
            </span>
          </div>
          {fields.body && <span className="field-error">{fields.body}</span>}
        </div>

        <div className="field">
          <span className="field-label">{t.notes.whoSees}</span>
          <div className="note-visibility" role="radiogroup" aria-label={t.notes.whoSees}>
            {NOTE_VISIBILITIES.map((v) => {
              const Icon = VISIBILITY_ICON[v]
              return (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={draft.visibility === v}
                  className="note-visibility-option"
                  onClick={() => set({ visibility: v })}
                >
                  <Icon size={18} aria-hidden="true" />
                  <strong>{t.notes.visibility[v]}</strong>
                </button>
              )
            })}
          </div>
          <span className="field-hint">{t.notes.visibilityHint[draft.visibility]}</span>
        </div>

        {draft.visibility === 'selected' && (
          <div>
            <UserPicker label={t.notes.recipients} value={draft.recipients} onChange={(recipients) => set({ recipients })} />
            {fields.recipientIds && <span className="field-error">{fields.recipientIds}</span>}
          </div>
        )}

        <div className="field">
          <label className="field-label" htmlFor="note-project">
            {t.notes.about}
          </label>
          <select
            id="note-project"
            className="select"
            value={draft.projectId}
            onChange={(e) => set({ projectId: e.target.value })}
          >
            <option value="">{t.notes.general}</option>
            {/* El proyecto actual de la nota aunque no venga en la lista (p. ej. archivado). */}
            {note?.project && !projects.data?.items.some((p) => p.id === note.project.id) && (
              <option value={note.project.id}>
                {note.project.key} · {note.project.name}
              </option>
            )}
            {projects.data?.items.map((p) => (
              <option key={p.id} value={p.id}>
                {p.key} · {p.name}
              </option>
            ))}
          </select>
          {fields.projectId ? (
            <span className="field-error">{fields.projectId}</span>
          ) : (
            draft.projectId && <span className="field-hint">{t.notes.projectHint}</span>
          )}
        </div>

        <div className="field">
          <span className="field-label">
            {t.notes.files} <span className="opt">· {t.common.optional}</span>
          </span>
          {(existing.length > 0 || draft.files.length > 0) && (
            <ul className="note-files">
              {existing.map((a) => {
                const gone = draft.removed.includes(a.id)
                return (
                  <li key={a.id} className={gone ? 'removed' : ''}>
                    <Paperclip size={15} aria-hidden="true" />
                    <span className="name" title={a.name}>
                      {a.name}
                    </span>
                    <span className="muted">{gone ? t.notes.willRemove : formatBytes(a.size)}</span>
                    <button
                      type="button"
                      className="chip-x"
                      onClick={() => toggleRemoved(a.id)}
                      aria-label={`${gone ? t.notes.keepFile : t.notes.removeFile}: ${a.name}`}
                      title={gone ? t.notes.keepFile : t.notes.removeFile}
                    >
                      {gone ? <Undo2 size={14} /> : <X size={14} />}
                    </button>
                  </li>
                )
              })}
              {draft.files.map((f, i) => (
                <li key={`${f.name}-${i}`}>
                  <Paperclip size={15} aria-hidden="true" />
                  <span className="name" title={f.name}>
                    {f.name}
                  </span>
                  <span className="muted">{formatBytes(f.size)}</span>
                  <button
                    type="button"
                    className="chip-x"
                    onClick={() => set({ files: draft.files.filter((_, j) => j !== i) })}
                    aria-label={`${t.notes.removeFile}: ${f.name}`}
                    title={t.notes.removeFile}
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => fileRef.current?.click()}
              disabled={fileCount >= NOTE_MAX_FILES}
            >
              <Paperclip size={15} /> {t.notes.attach}
            </button>
          </div>
          <span className="field-hint">{t.attachments.limits}</span>
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            accept={ALLOWED_EXTENSIONS.join(',')}
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

        {error && !error.fields && <FormError error={error} />}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={close} disabled={saving}>
            {t.common.cancel}
          </button>
          <button type="submit" className="btn btn-dark" disabled={saving || !draft.body.trim() || (note && !dirty)}>
            {saving ? t.common.saving : note ? t.notes.saveChanges : t.notes.stick}
          </button>
        </div>
      </form>
    </Modal>
  )
}
