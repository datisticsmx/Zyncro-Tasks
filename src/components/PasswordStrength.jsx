import { scorePassword } from '../lib/password'
import { t } from '../i18n/es'

export function PasswordStrength({ value }) {
  const score = scorePassword(value)
  return (
    <div className="field" aria-live="polite">
      <div className="strength" data-score={score} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <span className="field-hint">
        {value ? t.auth.strength[score] : t.auth.minLength}
      </span>
    </div>
  )
}
