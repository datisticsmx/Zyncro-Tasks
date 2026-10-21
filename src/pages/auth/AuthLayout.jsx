import { ArrowUpRight } from 'lucide-react'
import { Logo } from '../../components/Layout'
import { t } from '../../i18n/es'

const CARD_COLORS = ['bg-coral', 'bg-lilac', 'bg-cyan', 'bg-green']

/** Pantallas sin sesión: panel oscuro con tarjetas de color + formulario. */
export function AuthLayout({ children }) {
  return (
    <div className="auth">
      <section className="auth-hero" aria-hidden="true">
        <div className="auth-brand">
          <Logo size={34} /> {t.app.name}
        </div>
        <h1>{t.auth.heroTitle}</h1>
        <div className="auth-cards">
          {t.auth.heroCards.map((c, i) => (
            <div key={c.title} className={`color-card ${CARD_COLORS[i]}`}>
              <span className="meta">{c.meta}</span>
              <h3>{c.title}</h3>
              <span className="arrow">
                <ArrowUpRight size={18} />
              </span>
            </div>
          ))}
        </div>
      </section>
      <section className="auth-form-side">{children}</section>
    </div>
  )
}
