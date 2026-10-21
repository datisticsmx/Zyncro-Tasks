import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { api } from '../lib/api'
import { ME_KEY, useMe } from '../lib/session'
import { Avatar } from '../components/Avatar'
import { AvatarEditor } from '../components/AvatarEditor'
import { Field, FormError } from '../components/Field'
import { PasswordStrength } from '../components/PasswordStrength'
import { useToast } from '../components/Toast'
import { t } from '../i18n/es'

const toForm = (u) => ({
  name: u.name,
  birth_date: u.birthDate || '',
  github_username: u.githubUsername || '',
  avatar_url: u.avatarUrl || '',
})

/** Envía solo lo que cambió; vacío = null (campo opcional borrado). */
function diff(form, original) {
  const out = {}
  for (const [k, v] of Object.entries(form)) {
    if (v !== original[k]) out[k] = v === '' && k !== 'name' ? null : v
  }
  return out
}

function ProfileForm({ user }) {
  const qc = useQueryClient()
  const toast = useToast()
  const original = toForm(user)
  const [form, setForm] = useState(original)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = useMutation({
    mutationFn: (body) => api.patch('/me', body),
    onSuccess: ({ user: updated }) => {
      qc.setQueryData(ME_KEY, updated)
      setForm(toForm(updated))
      toast.success(t.common.saved)
    },
  })
  const changes = diff(form, original)
  const errors = save.error?.fields || {}

  return (
    <form
      className="card outlined form-grid"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate(changes)
      }}
    >
      <FormError error={save.error && !save.error.fields ? save.error : null} />
      <div className="form-row">
        <Field label={t.profile.name} value={form.name} onChange={set('name')} error={errors.name} />
        <Field label={t.profile.email} value={user.email} disabled hint={t.profile.emailHint} />
      </div>
      <div className="form-row">
        <Field
          label={t.profile.birthDate}
          type="date"
          optional
          value={form.birth_date}
          onChange={set('birth_date')}
          hint={t.profile.birthDateHint}
          error={errors.birth_date}
          max={new Date().toISOString().slice(0, 10)}
        />
        <Field
          label={t.profile.github}
          optional
          value={form.github_username}
          onChange={set('github_username')}
          error={errors.github_username}
          placeholder="usuario"
          autoComplete="off"
        />
      </div>
      <Field
        label={t.profile.avatarUrl}
        type="url"
        optional
        value={form.avatar_url}
        onChange={set('avatar_url')}
        hint={t.profile.avatarHint}
        error={errors.avatar_url}
        placeholder="https://"
      />
      <div>
        <button className="btn btn-dark" type="submit" disabled={save.isPending || Object.keys(changes).length === 0}>
          {save.isPending ? t.common.saving : t.common.save}
        </button>
      </div>
    </form>
  )
}

function PasswordForm() {
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const change = useMutation({
    mutationFn: () => api.patch('/me/password', { current_password: current, new_password: next }),
    onSuccess: () => {
      setCurrent('')
      setNext('')
      toast.success(t.profile.passwordChanged)
    },
  })
  const errors = change.error?.fields || {}

  return (
    <form
      className="card dark form-grid"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        change.mutate()
      }}
    >
      <header>
        <h3>{t.profile.passwordTitle}</h3>
        <p style={{ color: 'var(--text-on-dark-2)', marginTop: 4, fontSize: 13 }}>{t.profile.passwordSubtitle}</p>
      </header>
      <Field
        label={<span style={{ color: 'var(--text-on-dark)' }}>{t.profile.currentPassword}</span>}
        type="password"
        autoComplete="current-password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        error={errors.current_password}
      />
      <div className="field">
        <Field
          label={<span style={{ color: 'var(--text-on-dark)' }}>{t.auth.newPassword}</span>}
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          error={errors.new_password}
        />
        <PasswordStrength value={next} />
      </div>
      <div>
        <button className="btn btn-yellow" type="submit" disabled={change.isPending || !current || next.length < 10}>
          {t.profile.changePassword}
        </button>
      </div>
    </form>
  )
}

export function ProfilePage() {
  const { data: user } = useMe()
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{t.profile.title}</h1>
          <p className="muted">{t.profile.subtitle}</p>
        </div>
      </div>
      <div className="profile-grid">
        <div className="card outlined profile-id">
          <Avatar user={user} size={104} />
          <h2>{user.name}</h2>
          <span className="pill lilac">{t.roles[user.role]}</span>
          <span className="muted" style={{ fontSize: 14 }}>
            {user.email}
          </span>
          {user.githubUrl && (
            <a className="link" href={user.githubUrl} target="_blank" rel="noreferrer noopener">
              github.com/{user.githubUsername} <ExternalLink size={13} aria-hidden="true" />
            </a>
          )}
        </div>
        <div className="stack">
          <AvatarEditor key={`avatar-${user.updatedAt}`} user={user} />
          {/* key: al guardar se re-monta con los datos del servidor */}
          <ProfileForm key={user.updatedAt} user={user} />
          <PasswordForm />
        </div>
      </div>
    </div>
  )
}
