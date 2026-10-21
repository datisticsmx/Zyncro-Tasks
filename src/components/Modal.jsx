import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { t } from '../i18n/es'

/** Modal accesible: Escape cierra, foco atrapado dentro y devuelto al cerrar. */
export function Modal({ title, subtitle, onClose, children, footer }) {
  const ref = useRef(null)
  const titleId = useId()
  // Se captura en el primer render, antes de que un autoFocus mueva el foco.
  const [previo] = useState(() => document.activeElement)
  // El efecto corre solo al montar: si dependiera de onClose (casi siempre una
  // función nueva en cada render) el foco saltaría al primer campo al teclear.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const el = ref.current
    const focusables = () =>
      el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    // Foco inicial: el que ya tenga (autoFocus), si no el primer campo del
    // formulario, si no el primer elemento enfocable.
    if (!el.contains(document.activeElement)) {
      ;(el.querySelector('input:not([type=hidden]), select, textarea') || focusables()[0] || el).focus()
    }

    function onKey(e) {
      if (e.key === 'Escape') onCloseRef.current()
      if (e.key === 'Tab') {
        const list = Array.from(focusables()).filter((n) => !n.disabled)
        if (list.length === 0) return
        const first = list[0]
        const last = list[list.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      // Solo al desmontar de verdad (en StrictMode el efecto se re-ejecuta con
      // el DOM aún montado y no hay que robarle el foco al modal).
      setTimeout(() => {
        if (!el.isConnected) previo?.focus?.()
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref} tabIndex={-1}>
        <div className="modal-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn light" onClick={onClose} aria-label={t.common.close}>
            <X size={18} />
          </button>
        </div>
        {children}
        {footer && <div className="modal-actions">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
