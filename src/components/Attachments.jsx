import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Download, ExternalLink, File, FileArchive, FileImage, FileSpreadsheet, FileText, Paperclip, Trash2, Upload } from 'lucide-react'
import { api, uploadFile } from '../lib/api'
import { ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES, collabKeys, formatBytes, useAttachments } from '../lib/collab'
import { EmptyState, ErrorState, SkeletonRows } from './States'
import { useToast } from './Toast'
import { t } from '../i18n/es'

const DATE = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' })

function iconFor(mime) {
  if (mime.startsWith('image/')) return FileImage
  if (mime === 'application/pdf' || mime.startsWith('text/') || mime.includes('word')) return FileText
  if (mime.includes('sheet') || mime.includes('excel') || mime === 'text/csv') return FileSpreadsheet
  if (mime === 'application/zip') return FileArchive
  return File
}

const extOf = (name) => {
  const i = name.lastIndexOf('.')
  return i === -1 ? '' : name.slice(i).toLowerCase()
}

/** RF-ATT: subir (arrastrar o elegir), ver, descargar y borrar adjuntos. */
export function Attachments({ scope, id, onActivity }) {
  const qc = useQueryClient()
  const toast = useToast()
  const list = useAttachments(scope, id)
  const inputRef = useRef(null)
  const [uploads, setUploads] = useState([]) // { name, progress }
  const [over, setOver] = useState(false)

  const refresh = () => {
    qc.invalidateQueries({ queryKey: collabKeys.attachments(scope, id) })
    onActivity?.()
  }

  async function handleFiles(files) {
    for (const file of Array.from(files)) {
      // Validación rápida en el navegador; la definitiva (por contenido) la hace la API.
      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error(t.attachments.tooBig(file.name))
        continue
      }
      if (!ALLOWED_EXTENSIONS.includes(extOf(file.name))) {
        toast.error(t.attachments.badType(file.name))
        continue
      }
      const entry = { key: `${file.name}-${Date.now()}`, name: file.name, progress: 0 }
      setUploads((u) => [...u, entry])
      try {
        await uploadFile(`/${scope}/${id}/attachments`, file, (p) =>
          setUploads((u) => u.map((x) => (x.key === entry.key ? { ...x, progress: p } : x))),
        )
        toast.success(t.attachments.uploaded(file.name))
        refresh()
      } catch (err) {
        toast.error(err.fields?.file ? `${file.name}: ${err.fields.file}` : err.message)
      } finally {
        setUploads((u) => u.filter((x) => x.key !== entry.key))
      }
    }
  }

  async function remove(a) {
    if (!window.confirm(t.attachments.confirmDelete(a.name))) return
    try {
      await api.del(`/attachments/${a.id}`)
      toast.success(t.attachments.deleted)
      refresh()
    } catch (err) {
      toast.error(err.message)
    }
  }

  let content
  if (list.isPending) content = <SkeletonRows rows={2} height={64} />
  else if (list.isError) content = <ErrorState error={list.error} onRetry={() => list.refetch()} />
  else if (list.data.items.length === 0 && uploads.length === 0)
    content = <EmptyState icon={Paperclip} color="bg-cyan" title={t.attachments.emptyTitle} body={t.attachments.emptyBody} />
  else
    content = (
      <ul className="attachment-list">
        {uploads.map((u) => (
          <li key={u.key} className="attachment uploading">
            <span className="attachment-icon bg-yellow">
              <Upload size={18} />
            </span>
            <div className="attachment-main">
              <strong>{u.name}</strong>
              <div className="progress-track" aria-label={t.attachments.uploading(u.name)}>
                <span style={{ width: `${Math.round(u.progress * 100)}%` }} />
              </div>
            </div>
          </li>
        ))}
        {list.data.items.map((a) => {
          const Icon = iconFor(a.mimeType)
          return (
            <li key={a.id} className="attachment">
              {a.mimeType.startsWith('image/') ? (
                <a href={a.downloadUrl} target="_blank" rel="noopener noreferrer" className="attachment-thumb">
                  <img src={a.downloadUrl} alt={a.name} loading="lazy" />
                </a>
              ) : (
                <span className="attachment-icon bg-lilac">
                  <Icon size={18} />
                </span>
              )}
              <div className="attachment-main">
                <strong title={a.name}>{a.name}</strong>
                <span className="muted">
                  {formatBytes(a.size)} · {a.uploadedBy.name} · {DATE.format(new Date(a.createdAt))}
                </span>
              </div>
              <div className="attachment-actions">
                <a
                  className="icon-btn light"
                  href={a.downloadUrl}
                  target={a.previewable ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  aria-label={`${a.previewable ? t.attachments.open : t.attachments.download}: ${a.name}`}
                  title={a.previewable ? t.attachments.open : t.attachments.download}
                >
                  {a.previewable ? <ExternalLink size={16} /> : <Download size={16} />}
                </a>
                {a.permissions.canDelete && (
                  <button type="button" className="icon-btn light" onClick={() => remove(a)} aria-label={`${t.attachments.delete}: ${a.name}`}>
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    )

  return (
    <div className="collab">
      <div
        className={`dropzone${over ? ' over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          handleFiles(e.dataTransfer.files)
        }}
      >
        <Upload size={20} aria-hidden="true" />
        <span>
          {t.attachments.drop}{' '}
          <button type="button" className="link-btn strong" onClick={() => inputRef.current?.click()}>
            {t.attachments.choose}
          </button>
        </span>
        <span className="field-hint">{t.attachments.limits}</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept={ALLOWED_EXTENSIONS.join(',')}
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
      {content}
    </div>
  )
}
