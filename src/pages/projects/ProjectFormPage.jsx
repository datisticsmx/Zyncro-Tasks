import { useEffect, useId, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Archive, ArrowLeft, Globe, Lock, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import { projectKeys, useClientNames, useProject } from '../../lib/projects'
import { useMe } from '../../lib/session'
import { Field, FormError } from '../../components/Field'
import { UserPicker } from '../../components/UserPicker'
import { ErrorState, NoAccess, NotFound, SkeletonRows } from '../../components/States'
import { useToast } from '../../components/Toast'
import { t } from '../../i18n/es'

const FIELDS = [
  'key',
  'name',
  'client_name',
  'status',
  'description',
  'url_production',
  'url_staging',
  'start_date',
  'end_date_tentative',
  'visibility',
]

function toForm(p) {
  if (!p) {
    return {
      key: '',
      name: '',
      client_name: '',
      status: 'active',
      description: '',
      url_production: '',
      url_staging: '',
      start_date: '',
      end_date_tentative: '',
      visibility: 'private',
      members: [],
      repos: [],
    }
  }
  return {
    key: p.key,
    name: p.name,
    client_name: p.clientName || '',
    status: p.status,
    description: p.description || '',
    url_production: p.urlProduction || '',
    url_staging: p.urlStaging || '',
    start_date: p.startDate || '',
    end_date_tentative: p.endDateTentative || '',
    visibility: p.visibility,
    members: p.members,
    repos: p.repositories.map((r) => ({ ...r })),
  }
}

/** Campos opcionales vacíos viajan como null. */
const clean = (k, v) => (v === '' && !['key', 'name', 'description'].includes(k) ? null : v)

/** Autocompletado de cliente con nombres ya usados (RF-PRJ-05). */
function ClientField({ value, onChange, error }) {
  const listId = useId()
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), 250)
    return () => clearTimeout(id)
  }, [value])
  const names = useClientNames(debounced.trim())
  return (
    <>
      <Field
        label={t.projects.client}
        optional
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={listId}
        hint={t.projects.clientHint}
        error={error}
        autoComplete="off"
        maxLength={150}
      />
      <datalist id={listId}>
        {(names.data || []).map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
    </>
  )
}

function ProjectForm({ project }) {
  const isEdit = Boolean(project)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const { data: me } = useMe()
  const [form, setForm] = useState(() => toForm(project))
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  // Al agregar una fila de repositorio, el foco va a su etiqueta.
  const [focusRepo, setFocusRepo] = useState(-1)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const fieldErrors = error?.fields || {}

  async function save() {
    const original = toForm(project)
    if (!isEdit) {
      const body = Object.fromEntries(FIELDS.map((k) => [k, clean(k, form[k])]))
      body.repositories = form.repos.filter((r) => r.label || r.url).map(({ label, url }) => ({ label, url }))
      body.member_ids = form.members.map((m) => m.id)
      const { project: created } = await api.post('/projects', body)
      return created
    }

    let latest = project
    let unassigned = 0
    const changes = {}
    for (const k of FIELDS) if (form[k] !== original[k]) changes[k] = clean(k, form[k])
    if (Object.keys(changes).length > 0) latest = (await api.patch(`/projects/${project.id}`, changes)).project

    const ids = form.members.map((m) => m.id).sort()
    const prevIds = original.members.map((m) => m.id).sort()
    if (ids.join() !== prevIds.join()) {
      const res = await api.put(`/projects/${project.id}/members`, { user_ids: ids })
      latest = res.project
      unassigned = res.unassigned
    }

    const keep = new Set(form.repos.filter((r) => r.id).map((r) => r.id))
    for (const r of original.repos) {
      if (!keep.has(r.id)) latest = (await api.del(`/projects/${project.id}/repositories/${r.id}`)).project
    }
    for (const r of form.repos.filter((x) => !x.id && (x.label || x.url))) {
      try {
        latest = (await api.post(`/projects/${project.id}/repositories`, { label: r.label, url: r.url })).project
      } catch (err) {
        // Los errores de un repo se muestran en el bloque de repositorios.
        if (err instanceof ApiError && err.fields) {
          throw new ApiError(err.status, { ...err, message: err.message, fields: { repositories: `${r.url}: ${Object.values(err.fields)[0]}` } })
        }
        throw err
      }
    }
    if (unassigned > 0) toast.success(t.projects.unassignedNotice(unassigned))
    return latest
  }

  async function onSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const p = await save()
      qc.setQueryData(projectKeys.detail(p.key), p)
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['client-names'] })
      toast.success(isEdit ? t.common.saved : t.projects.created)
      navigate(`/projects/${p.key}`)
    } catch (err) {
      setError(err)
      // Si algo sí se guardó antes del error, refresca el detalle.
      if (isEdit) qc.invalidateQueries({ queryKey: projectKeys.detail(project.key) })
    } finally {
      setSaving(false)
    }
  }

  async function archiveToggle() {
    const status = project.status === 'archived' ? 'active' : 'archived'
    try {
      const { project: p } = await api.patch(`/projects/${project.id}`, { status })
      qc.setQueryData(projectKeys.detail(p.key), p)
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success(t.common.saved)
      navigate(`/projects/${p.key}`)
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function remove() {
    if (!window.confirm(t.projects.confirmDelete(project.name))) return
    try {
      await api.del(`/projects/${project.id}`)
      qc.removeQueries({ queryKey: projectKeys.detail(project.key) })
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success(t.projects.deleted)
      navigate('/projects')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const keyLocked = isEdit && project.hasTasks

  return (
    <form className="stack" onSubmit={onSubmit} noValidate>
      <FormError error={error && !error.fields ? error : null} />
      {error?.fields && (
        <div className="form-error" role="alert">
          {error.message}
        </div>
      )}

      <section className="card outlined form-grid">
        <h3>{t.projects.sectionGeneral}</h3>
        <div className="form-row">
          <Field label={t.projects.name} value={form.name} onChange={set('name')} error={fieldErrors.name} maxLength={200} autoFocus={!isEdit} />
          <Field
            label={t.projects.key}
            value={form.key}
            onChange={(e) => setForm((f) => ({ ...f, key: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') }))}
            error={fieldErrors.key}
            hint={keyLocked ? t.projects.keyLocked : t.projects.keyHint}
            disabled={keyLocked}
            maxLength={6}
            style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}
          />
        </div>
        <div className="form-row">
          <ClientField
            value={form.client_name}
            onChange={(v) => setForm((f) => ({ ...f, client_name: v }))}
            error={fieldErrors.client_name}
          />
          {isEdit && project.status !== 'archived' && (
            <Field label={t.projects.status} as="select" value={form.status} onChange={set('status')} error={fieldErrors.status}>
              {['active', 'paused', 'completed'].map((s) => (
                <option key={s} value={s}>
                  {t.projectStatus[s]}
                </option>
              ))}
            </Field>
          )}
        </div>
        <Field
          label={t.projects.description}
          as="textarea"
          optional
          rows={6}
          value={form.description}
          onChange={set('description')}
          hint={t.projects.descriptionHint}
          error={fieldErrors.description}
          className="input textarea"
        />
      </section>

      <section className="card outlined form-grid">
        <h3>{t.projects.sectionEnvs}</h3>
        <div className="form-row">
          <Field
            label={t.projects.urlProduction}
            type="url"
            optional
            placeholder="https://"
            value={form.url_production}
            onChange={set('url_production')}
            error={fieldErrors.url_production}
          />
          <Field
            label={t.projects.urlStaging}
            type="url"
            optional
            placeholder="https://"
            value={form.url_staging}
            onChange={set('url_staging')}
            error={fieldErrors.url_staging}
          />
        </div>
        <div className="form-row">
          <Field label={t.projects.start} type="date" optional value={form.start_date} onChange={set('start_date')} error={fieldErrors.start_date} />
          <Field
            label={t.projects.end}
            type="date"
            optional
            min={form.start_date || undefined}
            value={form.end_date_tentative}
            onChange={set('end_date_tentative')}
            error={fieldErrors.end_date_tentative}
          />
        </div>
      </section>

      <section className="card outlined form-grid">
        <h3>{t.projects.sectionRepos}</h3>
        {fieldErrors.repositories && <span className="field-error">{fieldErrors.repositories}</span>}
        {form.repos.map((r, i) => (
          <div className="repo-row" key={r.id || `new-${i}`}>
            <input
              className="input"
              aria-label={t.projects.repoLabel}
              placeholder={t.projects.repoLabel}
              value={r.label}
              disabled={Boolean(r.id)}
              maxLength={60}
              autoFocus={i === focusRepo}
              onChange={(e) =>
                setForm((f) => ({ ...f, repos: f.repos.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) }))
              }
            />
            <input
              className="input"
              type="url"
              aria-label={t.projects.repoUrl}
              placeholder="https://github.com/…"
              value={r.url}
              disabled={Boolean(r.id)}
              onChange={(e) =>
                setForm((f) => ({ ...f, repos: f.repos.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) }))
              }
            />
            <button
              type="button"
              className="icon-btn light"
              aria-label={t.projects.removeRepo}
              onClick={() => setForm((f) => ({ ...f, repos: f.repos.filter((_, j) => j !== i) }))}
            >
              <X size={16} />
            </button>
          </div>
        ))}
        <div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={form.repos.length >= 20}
            onClick={() => {
              setFocusRepo(form.repos.length)
              setForm((f) => ({ ...f, repos: [...f.repos, { label: '', url: '' }] }))
            }}
          >
            <Plus size={16} /> {t.projects.addRepo}
          </button>
        </div>
      </section>

      <section className="card outlined form-grid">
        <h3>{t.projects.sectionAccess}</h3>
        <div className="visibility-options" role="radiogroup" aria-label={t.projects.sectionAccess}>
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
              <span>{t.visibilityHint[v]}</span>
            </button>
          ))}
        </div>
        {fieldErrors.visibility && <span className="field-error">{fieldErrors.visibility}</span>}
        {form.visibility === 'private' ? (
          <UserPicker
            label={t.projects.members}
            value={form.members}
            onChange={(members) => setForm((f) => ({ ...f, members }))}
          />
        ) : (
          <p className="muted">{t.projects.membersGlobalNote}</p>
        )}
        {fieldErrors.member_ids && <span className="field-error">{fieldErrors.member_ids}</span>}
      </section>

      <div className="form-actions">
        <Link className="btn btn-ghost" to={isEdit ? `/projects/${project.key}` : '/projects'}>
          {t.common.cancel}
        </Link>
        <button className="btn btn-dark" type="submit" disabled={saving || !form.name.trim() || form.key.length < 2}>
          {saving ? t.common.saving : isEdit ? t.common.save : t.projects.create}
        </button>
      </div>

      {isEdit && me.role === 'admin' && (
        <section className="card danger-zone form-grid">
          <h3>{t.projects.dangerZone}</h3>
          <div className="danger-row">
            <p className="muted">{t.projects.archiveHint}</p>
            <button type="button" className="btn btn-ghost" onClick={archiveToggle}>
              {project.status === 'archived' ? <RotateCcw size={16} /> : <Archive size={16} />}
              {project.status === 'archived' ? t.projects.unarchive : t.projects.archive}
            </button>
          </div>
          <div className="danger-row">
            <p className="muted">{t.projects.deleteHint}</p>
            <button type="button" className="btn btn-danger" onClick={remove} disabled={!project.permissions.canDelete}>
              <Trash2 size={16} /> {t.projects.delete}
            </button>
          </div>
        </section>
      )}
    </form>
  )
}

/** /projects/new y /projects/:key/settings */
export function ProjectFormPage() {
  const { key } = useParams()
  const project = useProject(key)
  const isEdit = Boolean(key)

  let body
  if (!isEdit) body = <ProjectForm />
  else if (project.isPending) body = <SkeletonRows rows={4} height={180} />
  else if (project.isError)
    body = project.error.status === 404 ? <NotFound /> : <ErrorState error={project.error} onRetry={() => project.refetch()} />
  else if (!project.data.permissions.canEdit) body = <NoAccess />
  else body = <ProjectForm key={project.data.updatedAt} project={project.data} />

  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <Link className="back-link" to={isEdit ? `/projects/${key}` : '/projects'}>
            <ArrowLeft size={16} /> {isEdit ? key : t.projects.title}
          </Link>
          <h1 style={{ marginTop: 8 }}>{isEdit ? t.projects.formEdit : t.projects.formNew}</h1>
        </div>
      </div>
      {body}
    </div>
  )
}
