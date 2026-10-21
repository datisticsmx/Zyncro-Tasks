import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useLogin } from '../../lib/session'
import { Field, FormError } from '../../components/Field'
import { AuthLayout } from './AuthLayout'
import { t } from '../../i18n/es'

/** Solo rutas internas en ?next= para no abrir un redirect a otro sitio. */
function safeNext(next) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const login = useLogin()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  function onSubmit(e) {
    e.preventDefault()
    login.mutate(
      { email, password },
      { onSuccess: () => navigate(safeNext(params.get('next')), { replace: true }) },
    )
  }

  return (
    <AuthLayout>
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <header>
          <h1>{t.auth.loginTitle}</h1>
          <p className="muted">{t.auth.loginSubtitle}</p>
        </header>
        <FormError error={login.error} />
        <Field
          label={t.auth.email}
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
        <Field
          label={t.auth.password}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="btn btn-dark btn-block" type="submit" disabled={login.isPending || !email || !password}>
          {login.isPending ? t.auth.loggingIn : t.auth.login}
        </button>
        <Link className="link" to="/forgot">
          {t.auth.forgot}
        </Link>
      </form>
    </AuthLayout>
  )
}
