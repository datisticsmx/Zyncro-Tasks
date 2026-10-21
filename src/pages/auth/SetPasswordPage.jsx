import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Field, FormError } from '../../components/Field'
import { PasswordStrength } from '../../components/PasswordStrength'
import { Skeleton } from '../../components/States'
import { AuthLayout } from './AuthLayout'
import { t } from '../../i18n/es'

/**
 * /invite/:token (RF-AUTH-07) y /reset/:token (RF-AUTH-04): mismo formulario
 * de nueva contraseña con medidor de fuerza.
 */
export function SetPasswordPage({ type }) {
  const { token } = useParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)

  const info = useQuery({
    queryKey: ['auth-token', type, token],
    queryFn: () => api.get(`/auth/token/${type}/${encodeURIComponent(token)}`),
    retry: false,
  })
  const submit = useMutation({
    mutationFn: () =>
      api.post(type === 'invite' ? '/auth/accept-invite' : '/auth/reset', { token, password }),
  })

  const mismatch = touched && confirm && password !== confirm

  let body
  if (info.isPending) {
    body = (
      <div className="stack" style={{ gap: 14 }}>
        <Skeleton height={36} width="70%" />
        <Skeleton height={48} />
        <Skeleton height={48} />
      </div>
    )
  } else if (info.isError) {
    body = (
      <>
        <div className="form-error" role="alert">
          {t.auth.invalidLink}
        </div>
        <Link className="btn btn-dark btn-block" to="/login">
          {t.auth.backToLogin}
        </Link>
      </>
    )
  } else if (submit.isSuccess) {
    body = (
      <>
        <div className="form-ok" role="status">
          {t.auth.passwordSet}
        </div>
        <Link className="btn btn-dark btn-block" to="/login">
          {t.auth.login}
        </Link>
      </>
    )
  } else {
    body = (
      <>
        <header>
          <h1>{type === 'invite' ? t.auth.inviteTitle(info.data.name) : t.auth.resetTitle}</h1>
          <p className="muted">
            {type === 'invite' ? t.auth.inviteSubtitle : t.auth.resetSubtitle(info.data.name)}
          </p>
        </header>
        <FormError error={submit.error && !submit.error.fields ? submit.error : null} />
        <input type="email" autoComplete="username" value={info.data.email} readOnly hidden />
        <div className="field">
          <Field
            label={t.auth.newPassword}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={submit.error?.fields?.password}
            autoFocus
          />
          <PasswordStrength value={password} />
        </div>
        <Field
          label={t.auth.confirmPassword}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onBlur={() => setTouched(true)}
          error={mismatch ? t.auth.passwordsDontMatch : null}
        />
        <button
          className="btn btn-dark btn-block"
          type="submit"
          disabled={submit.isPending || password.length < 10 || password !== confirm}
        >
          {submit.isPending ? t.common.saving : t.auth.setPassword}
        </button>
      </>
    )
  }

  return (
    <AuthLayout>
      <form
        className="auth-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (password === confirm) submit.mutate()
        }}
      >
        {body}
      </form>
    </AuthLayout>
  )
}
