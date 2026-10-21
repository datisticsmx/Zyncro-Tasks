import { useId } from 'react'
import { t } from '../i18n/es'

/** Input con etiqueta, ayuda y error por campo (errores `fields` de la API). */
export function Field({ label, hint, error, optional, as = 'input', children, ...props }) {
  const id = useId()
  const hintId = `${id}-hint`
  const errId = `${id}-err`
  const describedBy = [hint && hintId, error && errId].filter(Boolean).join(' ') || undefined
  const Control = as

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label} {optional && <span className="opt">· {t.common.optional}</span>}
      </label>
      <Control
        id={id}
        className={as === 'select' ? 'select' : 'input'}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        {...props}
      >
        {children}
      </Control>
      {hint && !error && (
        <span id={hintId} className="field-hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={errId} className="field-error">
          {error}
        </span>
      )}
    </div>
  )
}

/** Mensaje general de error de un formulario a partir de un ApiError. */
export function FormError({ error }) {
  if (!error) return null
  return (
    <div className="form-error" role="alert">
      {error.message}
    </div>
  )
}
