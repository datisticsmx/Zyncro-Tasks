import { useState } from 'react'
import { Link } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Field, FormError } from '../../components/Field'
import { AuthLayout } from './AuthLayout'
import { t } from '../../i18n/es'

/** RF-AUTH-04 sin SMTP: registra la solicitud; el link lo genera un Admin. */
export function ForgotPage() {
  const [email, setEmail] = useState('')
  const forgot = useMutation({ mutationFn: (body) => api.post('/auth/forgot', body) })

  return (
    <AuthLayout>
      <form
        className="auth-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          forgot.mutate({ email })
        }}
      >
        <header>
          <h1>{t.auth.forgotTitle}</h1>
          <p className="muted">{t.auth.forgotSubtitle}</p>
        </header>
        <FormError error={forgot.error} />
        {forgot.isSuccess ? (
          <div className="form-ok" role="status">
            {forgot.data.message}
          </div>
        ) : (
          <>
            <Field
              label={t.auth.email}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
            <button className="btn btn-dark btn-block" type="submit" disabled={forgot.isPending || !email}>
              {t.auth.forgotSend}
            </button>
          </>
        )}
        <Link className="link" to="/login">
          {t.auth.backToLogin}
        </Link>
      </form>
    </AuthLayout>
  )
}
