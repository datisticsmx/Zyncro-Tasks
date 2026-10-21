import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, Pencil, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { collabKeys, useComments } from '../lib/collab'
import { Avatar } from './Avatar'
import { Markdown } from './Markdown'
import { EmptyState, ErrorState, SkeletonRows } from './States'
import { useToast } from './Toast'
import { t } from '../i18n/es'

const DATETIME = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' })

function CommentItem({ comment, onChanged }) {
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.body)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      await api.patch(`/comments/${comment.id}`, { body: draft })
      setEditing(false)
      onChanged()
    } catch (err) {
      toast.error(err.fields?.body || err.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!window.confirm(t.comments.confirmDelete)) return
    try {
      await api.del(`/comments/${comment.id}`)
      toast.success(t.comments.deleted)
      onChanged()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <li className="comment">
      <Avatar user={comment.author} size={34} />
      <div className="comment-main">
        <div className="comment-head">
          <strong>{comment.author.name}</strong>
          <span className="muted">{DATETIME.format(new Date(comment.createdAt))}</span>
          {comment.editedAt && (
            <span className="muted" title={DATETIME.format(new Date(comment.editedAt))}>
              · {t.comments.edited}
            </span>
          )}
          {!editing && (comment.permissions.canEdit || comment.permissions.canDelete) && (
            <span className="comment-actions">
              {comment.permissions.canEdit && (
                <button type="button" className="link-btn" onClick={() => setEditing(true)}>
                  <Pencil size={13} /> {t.comments.edit}
                </button>
              )}
              {comment.permissions.canDelete && (
                <button type="button" className="link-btn danger" onClick={remove}>
                  <Trash2 size={13} /> {t.comments.delete}
                </button>
              )}
            </span>
          )}
        </div>
        {editing ? (
          <div className="comment-edit">
            <textarea
              className="input textarea"
              rows={4}
              autoFocus
              maxLength={10000}
              value={draft}
              aria-label={t.comments.edit}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setDraft(comment.body)
                  setEditing(false)
                }}
              >
                {t.common.cancel}
              </button>
              <button type="button" className="btn btn-dark btn-sm" disabled={busy || !draft.trim() || draft === comment.body} onClick={save}>
                {busy ? t.common.saving : t.common.save}
              </button>
            </div>
          </div>
        ) : (
          <div className="comment-body">
            <Markdown>{comment.body}</Markdown>
          </div>
        )}
      </div>
    </li>
  )
}

/** RF-CMT: hilo de comentarios de un proyecto o una tarea. */
export function Comments({ scope, id, onActivity }) {
  const qc = useQueryClient()
  const toast = useToast()
  const list = useComments(scope, id)
  const [body, setBody] = useState('')

  const refresh = () => {
    qc.invalidateQueries({ queryKey: collabKeys.comments(scope, id) })
    onActivity?.()
  }

  const send = useMutation({
    mutationFn: () => api.post(`/${scope}/${id}/comments`, { body }),
    onSuccess: () => {
      setBody('')
      refresh()
    },
    onError: (err) => toast.error(err.fields?.body || err.message),
  })

  let content
  if (list.isPending) content = <SkeletonRows rows={3} height={70} />
  else if (list.isError) content = <ErrorState error={list.error} onRetry={() => list.refetch()} />
  else if (list.data.items.length === 0)
    content = <EmptyState icon={MessageSquare} color="bg-lilac" title={t.comments.emptyTitle} body={t.comments.emptyBody} />
  else
    content = (
      <ul className="comment-list">
        {list.data.items.map((c) => (
          <CommentItem key={`${c.id}-${c.editedAt}`} comment={c} onChanged={refresh} />
        ))}
      </ul>
    )

  return (
    <div className="collab">
      {content}
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault()
          if (body.trim()) send.mutate()
        }}
      >
        <textarea
          className="input textarea"
          rows={3}
          maxLength={10000}
          placeholder={t.comments.placeholder}
          aria-label={t.comments.placeholder}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && body.trim()) {
              e.preventDefault()
              send.mutate()
            }
          }}
        />
        <div className="composer-foot">
          <span className="field-hint">{t.comments.shortcut}</span>
          <button type="submit" className="btn btn-dark btn-sm" disabled={send.isPending || !body.trim()}>
            {send.isPending ? t.comments.sending : t.comments.send}
          </button>
        </div>
      </form>
    </div>
  )
}
