import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Archive, ArrowLeft, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { api } from '../../lib/api'
import { localToday } from '../../lib/tasks'
import { durationDays, sprintKeys, suggestKey, useSprint } from '../../lib/sprints'
import { useMe } from '../../lib/session'
import { Field, FormError } from '../../components/Field'
import { UserPicker } from '../../components/UserPicker'
import { ErrorState, NoAccess, NotFound, SkeletonRows } from '../../components/States'
import { useToast } from '../../components/Toast'
import { t } from '../../i18n/es'

// Campos que viajan tal cual a la API (PATCH compara contra el original).
const FIELDS = ['key', 'name', 'status', 'description', 'start_date', 'end_date']

/** 'YYYY-MM-DD' + n días. */
function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d + n)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function toForm(s, me) {
  if (!s) {
    const today = localToday()
    return {
      key: '',
      name: '',
      status: 'active',
      description: '',
      start_date: today,
      end_date: addDays(today, 4),
      owner: me ? [me] : [],
      members: [],
      tasks: ['', '', ''],
    }
  }
  return {
    key: s.key,
    name: s.name,
    status: s.status,
    description: s.description || '',
    start_date: s.startDate || '',
    end_date: s.endDate || '',
    owner: s.owner ? [s.owner] : [],
    members: s.members,
    tasks: [],
  }
}

const clean = (k, v) => (v === '' && !['key', 'name', 'description'].includes(k) ? null : v)
const idsOf = (list) => list.map((u) => u.id).sort().join()

function SprintForm({ sprint }) {
  const isEdit = Boolean(sprint)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const { data: me } = useMe()
  const [form, setForm] = useState(() => toForm(sprint, me))
  // Mientras no se edite a mano, la clave se sugiere a partir del nombre.
  const [keyTouched, setKeyTouched] = useState(isEdit)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const taskRefs = useRef([])
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const fieldErrors = error?.fields || {}
  const ownerId = form.owner[0]?.id || null
  const days = durationDays(form.start_date, form.end_date)

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
    body.owner_id = ownerId
    body.member_ids = form.members.map((u) => u.id)
    const { sprint: created } = await api.post('/sprints', body)

    // Actividades iniciales: asignadas al responsable y con entrega al fin del periodo.
    const titles = form.tasks.map((x) => x.trim()).filter(Boolean)
    let failed = 0
    for (const title of titles) {
      try {
        await api.post(`/sprints/${created.id}/tasks?today=${localToday()}`, {
          title,
          assignee_ids: ownerId ? [ownerId] : [],
          start_date: form.start_date || null,
          due_date: form.end_date || null,
        })
      } catch {
        failed += 1
      }
    }
    if (failed > 0) toast.error(t.sprints.tasksFailed(failed))
    return titles.length > 0 ? (await api.get(`/sprints/${created.id}`)).sprint : created
  }

  async function update() {
    const original = toForm(sprint)
    const changes = {}
    for (const k of FIELDS) if (form[k] !== original[k]) changes[k] = clean(k, form[k])
    if (ownerId !== (sprint.owner?.id || null)) changes.owner_id = ownerId
    let latest = sprint
    if (Object.keys(changes).length > 0) latest = (await api.patch(`/sprints/${sprint.id}`, changes)).sprint
    if (idsOf(form.members) !== idsOf(sprint.members)) {
      latest = (await api.put(`/sprints/${sprint.id}/members`, { user_ids: form.members.map((u) => u.id) })).sprint
    }
    return latest
  }

  async function onSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const s = isEdit ? await update() : await create()
      qc.setQueryData(sprintKeys.detail(s.key), s)
      qc.invalidateQueries({ queryKey: sprintKeys.all })
      qc.invalidateQueries({ queryKey: ['tasks'] })
      toast.success(isEdit ? t.common.saved : t.sprints.created)
      navigate(`/sprints/${s.key}`)
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  async function archiveToggle() {
    const status = sprint.status === 'archived' ? 'active' : 'archived'
    try {
      const { sprint: s } = await api.patch(`/sprints/${sprint.id}`, { status })
      qc.setQueryData(sprintKeys.detail(s.key), s)
      qc.invalidateQueries({ queryKey: sprintKeys.all })
      qc.invalidateQueries({ queryKey: ['tasks', 'mine'] })
      toast.success(t.common.saved)
      navigate(`/sprints/${s.key}`)
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function remove() {
    if (!window.confirm(t.sprints.confirmDelete(sprint.name))) return
    try {
      await api.del(`/sprints/${sprint.id}`)
      qc.removeQueries({ queryKey: sprintKeys.detail(sprint.key) })
      qc.invalidateQueries({ queryKey: sprintKeys.all })
      toast.success(t.sprints.deleted)
      navigate('/sprints')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const keyLocked = isEdit && sprint.hasTasks

  return (
    <form className="stack" onSubmit={onSubmit} noValidate>
      <FormError error={error && !error.fields ? error : null} />
      {error?.fields && (
        <div className="form-error" role="alert">
          {error.message}
        </div>
      )}

      <section className="card outlined form-grid">
        <h3>{t.sprints.sectionGeneral}</h3>
        <div className="form-row">
          <Field
            label={t.sprints.name}
            placeholder={t.sprints.namePlaceholder}
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
            hint={keyLocked ? t.sprints.keyLocked : t.sprints.keyHint}
            disabled={keyLocked}
            maxLength={6}
            style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}
          />
        </div>
        {isEdit && sprint.status !== 'archived' && (
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
        <h3>{t.sprints.sectionPeople}</h3>
        <UserPicker
          label={t.sprints.owner}
          value={form.owner}
          // Un solo responsable: elegir otro reemplaza al actual.
          onChange={(users) => setForm((f) => ({ ...f, owner: users.slice(-1) }))}
        />
        {fieldErrors.owner_id ? (
          <span className="field-error">{fieldErrors.owner_id}</span>
        ) : (
          <span className="field-hint">{t.sprints.ownerHint}</span>
        )}
        <UserPicker
          label={t.sprints.participants}
          value={form.members}
          onChange={(members) => setForm((f) => ({ ...f, members }))}
        />
        {fieldErrors.member_ids ? (
          <span className="field-error">{fieldErrors.member_ids}</span>
        ) : (
          <span className="field-hint">{t.sprints.participantsHint}</span>
        )}
      </section>

      <section className="card outlined form-grid">
        <h3>{t.sprints.sectionPeriod}</h3>
        <div className="form-row">
          <Field
            label={t.sprints.start}
            type="date"
            value={form.start_date}
            onChange={set('start_date')}
            error={fieldErrors.start_date}
          />
          <Field
            label={t.sprints.end}
            type="date"
            min={form.start_date || undefined}
            value={form.end_date}
            onChange={set('end_date')}
            error={fieldErrors.end_date}
            hint={days > 0 ? `${t.sprints.duration}: ${t.sprints.days(days)}` : t.sprints.periodHint}
          />
        </div>
      </section>

      <section className="card outlined form-grid">
        <h3>{t.sprints.sectionTasks}</h3>
        {isEdit ? (
          <p className="muted">
            {t.sprints.tasksEditHint}{' '}
            <Link to={`/sprints/${sprint.key}`}>{t.sprints.tasksCount(sprint.stats.total)}</Link>
          </p>
        ) : (
          <>
            <p className="muted">{t.sprints.tasksHint}</p>
            {form.tasks.map((title, i) => (
              <div className="sprint-task-row" key={i}>
                <span className="num">{i + 1}.</span>
                <input
                  className="input"
                  ref={(el) => (taskRefs.current[i] = el)}
                  aria-label={t.sprints.taskPlaceholder(i + 1)}
                  placeholder={t.sprints.taskPlaceholder(i + 1)}
                  value={title}
                  maxLength={500}
                  onChange={(e) => setTask(i, e.target.value)}
                  onKeyDown={(e) => {
                    // Enter agrega la siguiente actividad en lugar de enviar el formulario.
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (title.trim()) addTask(i)
                    }
                  }}
                />
                <button
                  type="button"
                  className="icon-btn light"
                  aria-label={t.sprints.removeTask}
                  onClick={() => setForm((f) => ({ ...f, tasks: f.tasks.filter((_, j) => j !== i) }))}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => addTask()}>
                <Plus size={16} /> {t.sprints.addTask}
              </button>
            </div>
          </>
        )}
      </section>

      <div className="form-actions">
        <Link className="btn btn-ghost" to={isEdit ? `/sprints/${sprint.key}` : '/sprints'}>
          {t.common.cancel}
        </Link>
        <button className="btn btn-dark" type="submit" disabled={saving || !form.name.trim() || form.key.length < 2}>
          {saving ? t.common.saving : isEdit ? t.common.save : t.sprints.create}
        </button>
      </div>

      {isEdit && (
        <section className="card danger-zone form-grid">
          <h3>{t.projects.dangerZone}</h3>
          <div className="danger-row">
            <p className="muted">{t.sprints.archiveHint}</p>
            <button type="button" className="btn btn-ghost" onClick={archiveToggle}>
              {sprint.status === 'archived' ? <RotateCcw size={16} /> : <Archive size={16} />}
              {sprint.status === 'archived' ? t.sprints.unarchive : t.sprints.archive}
            </button>
          </div>
          <div className="danger-row">
            <p className="muted">{t.sprints.deleteHint}</p>
            <button type="button" className="btn btn-danger" onClick={remove} disabled={!sprint.permissions.canDelete}>
              <Trash2 size={16} /> {t.sprints.delete}
            </button>
          </div>
        </section>
      )}
    </form>
  )
}

/** /sprints/new y /sprints/:key/settings */
export function SprintFormPage() {
  const { key } = useParams()
  const sprint = useSprint(key)
  const isEdit = Boolean(key)

  let body
  if (!isEdit) body = <SprintForm />
  else if (sprint.isPending) body = <SkeletonRows rows={4} height={180} />
  else if (sprint.isError)
    body = sprint.error.status === 404 ? <NotFound /> : <ErrorState error={sprint.error} onRetry={() => sprint.refetch()} />
  else if (!sprint.data.permissions.canEdit) body = <NoAccess />
  else body = <SprintForm key={sprint.data.updatedAt} sprint={sprint.data} />

  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <Link className="back-link" to={isEdit ? `/sprints/${key}` : '/sprints'}>
            <ArrowLeft size={16} /> {isEdit ? key : t.sprints.title}
          </Link>
          <h1 style={{ marginTop: 8 }}>{isEdit ? t.sprints.formEdit : t.sprints.formNew}</h1>
        </div>
      </div>
      {body}
    </div>
  )
}
