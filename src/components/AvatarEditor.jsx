import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Shuffle, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { ME_KEY } from '../lib/session'
import { AVATAR_OPTIONS, avatarDataUri, randomAvatar } from '../lib/avatar'
import { useToast } from './Toast'
import { t } from '../i18n/es'

// Pestañas → partes que se editan en cada una.
const TABS = {
  face: ['baseColor', 'ears', 'nose'],
  hair: ['hair', 'hairColor'],
  eyes: ['eyes', 'eyebrows'],
  mouth: ['mouth'],
  facialHair: ['facialHair'],
  glasses: ['glasses', 'glassesColor'],
  earrings: ['earrings', 'earringColor'],
  shirt: ['shirt', 'shirtColor'],
  background: ['backgroundColor'],
}

const isColor = (part) => /Color$/.test(part)

/** Cuadrícula de miniaturas: cada opción se ve aplicada al avatar actual. */
function OptionGrid({ part, draft, onPick }) {
  const label = t.avatar.parts[part]
  return (
    <fieldset className="avatar-part">
      <legend>{label}</legend>
      {isColor(part) ? (
        <div className="swatches" role="radiogroup" aria-label={label}>
          {AVATAR_OPTIONS[part].map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={draft[part] === c}
              aria-label={`${label} #${c}`}
              className="swatch"
              style={{ background: `#${c}` }}
              onClick={() => onPick(part, c)}
            >
              {draft[part] === c && <Check size={14} />}
            </button>
          ))}
        </div>
      ) : (
        <div className="avatar-options" role="radiogroup" aria-label={label}>
          {AVATAR_OPTIONS[part].map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={draft[part] === value}
              className="avatar-option"
              title={t.avatar.values[value] || value}
              onClick={() => onPick(part, value)}
            >
              <img src={avatarDataUri({ ...draft, [part]: value })} alt="" />
              <span>{t.avatar.values[value] || value}</span>
            </button>
          ))}
        </div>
      )}
    </fieldset>
  )
}

/**
 * Editor de avatar (Mi perfil). Borrador local con Guardar/Cancelar, como el
 * resto de formularios de edición.
 */
export function AvatarEditor({ user }) {
  const qc = useQueryClient()
  const toast = useToast()
  const saved = user.avatarConfig
  const [draft, setDraft] = useState(() => saved || randomAvatar())
  const [tab, setTab] = useState('face')
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)

  const save = useMutation({
    mutationFn: (avatar_config) => api.patch('/me', { avatar_config }),
    onSuccess: ({ user: updated }, cfg) => {
      qc.setQueryData(ME_KEY, updated)
      // Los avatares aparecen en tablero, listas y proyectos: que se refresquen.
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success(cfg ? t.avatar.saved : t.avatar.removed)
      if (!cfg) setDraft(randomAvatar())
    },
    onError: (err) => toast.error(err.fields ? Object.values(err.fields)[0] : err.message),
  })

  const pickPart = (part, value) => setDraft((d) => ({ ...d, [part]: value }))

  return (
    <section className="card outlined avatar-editor">
      <header>
        <h3>{t.avatar.title}</h3>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          {t.avatar.subtitle}
        </p>
      </header>

      <div className="avatar-editor-body">
        <div className="avatar-stage">
          <img className="avatar-preview" src={avatarDataUri(draft)} alt={t.avatar.title} />
          <div className="avatar-stage-actions">
            <button type="button" className="btn btn-yellow btn-sm" onClick={() => setDraft(randomAvatar())}>
              <Shuffle size={15} /> {t.avatar.random}
            </button>
            {saved && (
              <button type="button" className="btn btn-ghost btn-sm" disabled={save.isPending} onClick={() => save.mutate(null)}>
                <Trash2 size={15} /> {t.avatar.remove}
              </button>
            )}
          </div>
          {user.avatarUrl && <p className="avatar-note">{t.avatar.photoWins}</p>}
        </div>

        <div className="avatar-controls">
          <div className="segmented tabs" role="tablist" aria-label={t.avatar.title}>
            {Object.keys(TABS).map((id) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} aria-pressed={tab === id} onClick={() => setTab(id)}>
                {t.avatar.tabs[id]}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="avatar-panel">
            {TABS[tab].map((part) => (
              <OptionGrid key={part} part={part} draft={draft} onPick={pickPart} />
            ))}
          </div>
        </div>
      </div>

      <footer className={`avatar-footer${dirty ? ' dirty' : ''}`}>
        <span className="avatar-footer-note" aria-live="polite">
          {dirty ? t.avatar.unsaved : t.tasks.noChanges}
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={!dirty || save.isPending}
          onClick={() => setDraft(saved || randomAvatar())}
        >
          {t.common.cancel}
        </button>
        <button type="button" className="btn btn-dark btn-sm" disabled={!dirty || save.isPending} onClick={() => save.mutate(draft)}>
          {save.isPending ? t.common.saving : t.avatar.save}
        </button>
      </footer>
      <p className="avatar-credit">
        <a href="https://www.dicebear.com/styles/micah/" target="_blank" rel="noopener noreferrer">
          {t.avatar.credit}
        </a>
      </p>
    </section>
  )
}
