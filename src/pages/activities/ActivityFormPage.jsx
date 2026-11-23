import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Archive, ArrowLeft, Globe, Lock, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { api } from '../../lib/api'
import { projectKeys, useProject } from '../../lib/projects'
import { localToday } from '../../lib/tasks'
import { addDays, durationDays, suggestKey } from '../../lib/activities'
import { useMe } from '../../lib/session'
import { Field, FormError } from '../../components/Field'
import { UserPicker } from '../../components/UserPicker'
import { ErrorState, NoAccess, NotFound, SkeletonRows } from '../../components/States'
import { useToast } from '../../components/Toast'
import { t } from '../../i18n/es'

// Campos que viajan tal cual a la API (PATCH compara contra el original).
const FIELDS = ['key', 'name', 'status', 'description', 'start_date', 'end_date_tentative', 'visibility']

function toForm(a, me) {
  if (!a) {
    const today = localToday()
    return {
      key: '',
      name: '',
      status: 'active',
      description: '',
      start_date: today,
      end_date_tentative: addDays(today, 2),
      visibility: 'private',
      owner: me ? [me] : [],
      tasks: ['', '', ''],
    }
  }
  return {
    key: a.key,
    name: a.name,
    status: a.status,
    description: a.description || '',
    start_date: a.startDate || '',
    end_date_tentative: a.endDateTentative || '',
    visibility: a.visibility,
    owner: a.owner ? [a.owner] : [],
    tasks: [],
  }
}

const clean = (k, v) => (v === '' && !['key', 'name', 'description'].includes(k) ? null : v)

function ActivityForm({ activity }) {
  const isEdit = Boolean(activity)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const { data: me } = useMe()
  const [form, setForm] = useState(() => toForm(activity, me))
  // Mientras no se edite a mano, la clave se sugiere a partir del nombre.
  const [keyTouched, setKeyTouched] = useState(isEdit)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const taskRefs = useRef([])
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const fieldErrors = error?.fields || {}
  const ownerId = form.owner[0]?.id || null
  const days = durationDays(form.start_date, form.end_date_tentative)

  function setName(e) {
    const name = e.target.value
    setForm((f) => ({ ...f, name, key: keyTouched ? f.key : suggestKey(name) }))
  }

  function setTask(i, value) {
    setForm((f) => ({ ...f, tasks: f.tasks.map((x, j) => (j === i ? value : x)) }))
  }

  function addTask(after = form.tasks.length - 1) {
    setForm((f) => ({ ...f, tasks: [...f.tasks.slice(0, after + 1), '', ...f.tasks.slice(after + 1)] }))
    requestAnimationFrame(() => taskRefs.current[after + 1]?.focus())
  }

  async function create() {
    const body = Object.fromEntries(FIELDS.map((k) => [k, clean(k, form[k])]))
    body.type = 'activity'
    body.owner_id = ownerId
    const { project: created } = await api.post('/projects', body)

    // Tareas iniciales: asignadas al responsable y con límite al fin del periodo.
    const titles = form.tasks.map((x) => x.trim()).filter(Boolean)
    let failed = 0
    for (const title of titles) {
      try {
        await api.post(`/projects/${created.id}/tasks?today=${localToday()}`, {
          title,
          assignee_ids: ownerId ? [ownerId] : [],
          start_date: form.start_date || null,
          due_date: form.end_date_tentative || null,
        })
      } catch {
        failed += 1
      }
    }
    if (failed > 0) toast.error(t.activities.tasksFailed(failed))
    return titles.length > 0 ? (await api.get(`/projects/${created.id}`)).project : created
  }

  async function update() {
    const original = toForm(activity)
    const changes = {}
    for (const k of FIELDS) if (form[k] !== original[k]) changes[k] = clean(k, form[k])
    if (ownerId !== (activity.owner?.id || null)) changes.owner_id = ownerId
    if (Object.keys(changes).length === 0) return activity
    return (await api.patch(`/projects/${activity.id}`, changes)).project
  }

  async function onSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const a = isEdit ? await update() : await create()
      qc.setQueryData(projectKeys.detail(a.key), a)
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
      toast.success(isEdit ? t.common.saved : t.activities.created)
      navigate(`/activities/${a.key}`)
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  async function archiveToggle() {
    const status = activity.status === 'archived' ? 'active' : 'archived'
    try {
      const { project: a } = await api.patch(`/projects/${activity.id}`, { status })
      qc.setQueryData(projectKeys.detail(a.key), a)
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success(t.common.saved)
      navigate(`/activities/${a.key}`)
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function remove() {
    if (!window.confirm(t.activities.confirmDelete(activity.name))) return
    try {
      await api.del(`/projects/${activity.id}`)
      qc.removeQueries({ queryKey: projectKeys.detail(activity.key) })
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success(t.activities.deleted)
      navigate('/activities')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const keyLocked = isEdit && activity.hasTasks

  return (
    <form className="stack" onSubmit={onSubmit} noValidate>
      <FormError error={error && !error.fields ? error : null} />
      {error?.fields && (
        <div className="form-error" role="alert">
          {error.message}
        </div>
      )}

      <section className="card outlined form-grid">
        <h3>{t.activities.sectionGeneral}</h3>
        <div className="form-row">
          <Field
            label={t.activities.name}
            placeholder={t.activities.namePlaceholder}
            value={form.name}
            onChange={setName}
            error={fieldErrors.name}
            maxLength={200}
            autoFocus={!isEdit}
          />
          <Field
            label={t.projects.key}
            value={form.key}
            onChange={(e) => {
              setKeyTouched(true)
              setForm((f) => ({ ...f, key: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') }))
            }}
            error={fieldErrors.key}
            hint={keyLocked ? t.projects.keyLocked : t.activities.keyHint}
            disabled={keyLocked}
            maxLength={6}
            style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}
          />
        </div>
        {isEdit && activity.status !== 'archived' && (
          <Field label={t.projects.status} as="select" value={form.status} onChange={set('status')} error={fieldErrors.status}>
            {['not_started', 'active', 'paused', 'completed'].map((s) => (
              <option key={s} value={s}>
                {t.projectStatus[s]}
              </option>
            ))}
          </Field>
        )}
        <Field
          label={t.projects.description}
          as="textarea"
          optional
          rows={4}
          value={form.description}
          onChange={set('description')}
          hint={t.projects.descriptionHint}
          error={fieldErrors.description}
          className="input textarea"
        />
      </section>

      <section className="card outlined form-grid">
        <h3>{t.activities.sectionPeriod}</h3>
        <UserPicker
          label={t.activities.owner}
          value={form.owner}
          // Un solo responsable: elegir otro reemplaza al actual.
          onChange={(users) => setForm((f) => ({ ...f, owner: users.slice(-1) }))}
        />
        {fieldErrors.owner_id ? (
          <span className="field-error">{fieldErrors.owner_id}</span>
        ) : (
          <span className="field-hint">{t.activities.ownerHint}</span>
        )}
        <div className="form-row">
          <Field
            label={t.activities.start}
            type="date"
            value={form.start_date}
            onChange={set('start_date')}
            error={fieldErrors.start_date}
          />
          <Field
            label={t.activities.end}
            type="date"
            min={form.start_date || undefined}
            value={form.end_date_tentative}
            onChange={set('end_date_tentative')}
            error={fieldErrors.end_date_tentative}
            hint={days > 0 ? `${t.activities.duration}: ${t.activities.days(days)}` : t.activities.periodHint}
          />
        </div>
      </section>

      <section className="card outlined form-grid">
        <h3>{t.activities.sectionTasks}</h3>
        {isEdit ? (
          <p className="muted">
            {t.activities.tasksEditHint}{' '}
            <Link to={`/activities/${activity.key}`}>{t.projects.tasks(activity.stats.total)}</Link>
          </p>
        ) : (
          <>
            <p className="muted">{t.activities.tasksHint}</p>
            {form.tasks.map((title, i) => (
              <div className="activity-task-row" key={i}>
                <span className="num">{i + 1}.</span>
                <input
                  className="input"
                  ref={(el) => (taskRefs.current[i] = el)}
                  aria-label={t.activities.taskPlaceholder(i + 1)}
                  placeholder={t.activities.taskPlaceholder(i + 1)}
                  value={title}
                  maxLength={500}
                  onChange={(e) => setTask(i, e.target.value)}
                  onKeyDown={(e) => {
                    // Enter agrega la siguiente tarea en lugar de enviar el formulario.
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (title.trim()) addTask(i)
                    }
                  }}
                />
                <button
                  type="button"
                  className="icon-btn light"
                  aria-label={t.activities.removeTask}
                  onClick={() => setForm((f) => ({ ...f, tasks: f.tasks.filter((_, j) => j !== i) }))}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => addTask()}>
                <Plus size={16} /> {t.activities.addTask}
              </button>
            </div>
          </>
        )}
      </section>

      <section className="card outlined form-grid">
        <h3>{t.activities.sectionAccess}</h3>
        <div className="visibility-options" role="radiogroup" aria-label={t.activities.sectionAccess}>
          {['private', 'global'].map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={form.visibility === v}
              className={`visibility-option ${form.visibility === v ? (v === 'global' ? 'bg-cyan' : 'bg-lilac') : ''}`}
              onClick={() => setForm((f) => ({ ...f, visibility: v }))}
            >
              {v === 'global' ? <Globe size={20} /> : <Lock size={20} />}
              <strong>{t.visibility[v]}</strong>
              <span>{v === 'global' ? t.activities.globalHint : t.activities.privateHint}</span>
            </button>
          ))}
        </div>
        {fieldErrors.visibility && <span className="field-error">{fieldErrors.visibility}</span>}
      </section>

      <div className="form-actions">
        <Link className="btn btn-ghost" to={isEdit ? `/activities/${activity.key}` : '/activities'}>
          {t.common.cancel}
        </Link>
        <button className="btn btn-dark" type="submit" disabled={saving || !form.name.trim() || form.key.length < 2}>
          {saving ? t.common.saving : isEdit ? t.common.save : t.activities.create}
        </button>
      </div>

      {isEdit && me.role === 'admin' && (
        <section className="card danger-zone form-grid">
          <h3>{t.projects.dangerZone}</h3>
          <div className="danger-row">
            <p className="muted">{t.activities.archiveHint}</p>
            <button type="button" className="btn btn-ghost" onClick={archiveToggle}>
              {activity.status === 'archived' ? <RotateCcw size={16} /> : <Archive size={16} />}
              {activity.status === 'archived' ? t.activities.unarchive : t.activities.archive}
            </button>
          </div>
          <div className="danger-row">
            <p className="muted">{t.projects.deleteHint}</p>
            <button type="button" className="btn btn-danger" onClick={remove} disabled={!activity.permissions.canDelete}>
              <Trash2 size={16} /> {t.activities.delete}
            </button>
          </div>
        </section>
      )}
    </form>
  )
}

/** /activities/new y /activities/:key/settings */
export function ActivityFormPage() {
  const { key } = useParams()
  const activity = useProject(key)
  const isEdit = Boolean(key)

  let body
  if (!isEdit) body = <ActivityForm />
  else if (activity.isPending) body = <SkeletonRows rows={4} height={180} />
  else if (activity.isError)
    body = activity.error.status === 404 ? <NotFound /> : <ErrorState error={activity.error} onRetry={() => activity.refetch()} />
  else if (!activity.data.permissions.canEdit) body = <NoAccess />
  else body = <ActivityForm key={activity.data.updatedAt} activity={activity.data} />

  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <Link className="back-link" to={isEdit ? `/activities/${key}` : '/activities'}>
            <ArrowLeft size={16} /> {isEdit ? key : t.activities.title}
          </Link>
          <h1 style={{ marginTop: 8 }}>{isEdit ? t.activities.formEdit : t.activities.formNew}</h1>
        </div>
      </div>
      {body}
    </div>
  )
}
