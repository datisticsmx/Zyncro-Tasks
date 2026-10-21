import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, KeyRound, MoreHorizontal, ShieldCheck, UserPlus, UserRound, UserX, Users } from 'lucide-react'
import { api, qs } from '../lib/api'
import { useMe } from '../lib/session'
import { Avatar } from '../components/Avatar'
import { Field, FormError } from '../components/Field'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, SkeletonRows } from '../components/States'
import { useToast } from '../components/Toast'
import { t } from '../i18n/es'

const DATE_FMT = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' })

function statusOf(u) {
  if (!u.isActive) return 'inactive'
  return u.pendingInvite ? 'pending' : 'active'
}
const STATUS_PILL = { active: 'green', pending: 'yellow', inactive: 'coral' }

/** Muestra el link de invitación/reseteo para copiarlo (sin SMTP en v1). */
function LinkModal({ result, onClose }) {
  const [copied, setCopied] = useState(false)
  return (
    <Modal
      title={t.users.linkTitle(result.type)}
      subtitle={t.users.linkBody(result.type)}
      onClose={onClose}
      footer={
        <button className="btn btn-dark" type="button" onClick={onClose}>
          {t.common.close}
        </button>
      }
    >
      <div className="copy-box">
        <code>{result.link}</code>
        <button
          type="button"
          className="btn btn-yellow btn-sm"
          onClick={async () => {
            await navigator.clipboard.writeText(result.link)
            setCopied(true)
          }}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? t.common.copied : t.common.copy}
        </button>
      </div>
    </Modal>
  )
}

function InviteModal({ onClose, onCreated }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', email: '', role: 'member' })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const invite = useMutation({
    mutationFn: () => api.post('/users/invite', form),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      onCreated({ type: 'invite', link: data.link })
    },
  })
  const errors = invite.error?.fields || {}

  return (
    <Modal title={t.users.inviteTitle} subtitle={t.users.inviteSubtitle} onClose={onClose}>
      <form
        className="form-grid"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          invite.mutate()
        }}
      >
        <FormError error={invite.error && !invite.error.fields ? invite.error : null} />
        <Field label={t.profile.name} value={form.name} onChange={set('name')} error={errors.name} autoFocus />
        <Field label={t.profile.email} type="email" value={form.email} onChange={set('email')} error={errors.email} />
        <Field label={t.users.colRole} as="select" value={form.role} onChange={set('role')} error={errors.role}>
          <option value="member">{t.roles.member}</option>
          <option value="admin">{t.roles.admin}</option>
        </Field>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button type="submit" className="btn btn-dark" disabled={invite.isPending || !form.name || !form.email}>
            {t.users.inviteSend}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function RowActions({ user, isSelf, onLink }) {
  const qc = useQueryClient()
  const toast = useToast()
  // Posición fija calculada al abrir: la tabla tiene overflow (scroll en
  // móvil) y recortaría un menú con position: absolute.
  const [open, setOpen] = useState(null)

  useEffect(() => {
    if (!open) return undefined
    const close = () => setOpen(null)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const update = useMutation({
    mutationFn: (body) => api.patch(`/users/${user.id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success(t.common.saved)
    },
    onError: (err) => toast.error(err.message),
  })
  const link = useMutation({
    mutationFn: () => api.post(`/users/${user.id}/reset-link`),
    onSuccess: (data) => onLink(data),
    onError: (err) => toast.error(err.message),
  })

  const run = (fn) => () => {
    setOpen(null)
    fn()
  }

  return (
    <div className="menu" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(null)}>
      <button
        type="button"
        className="icon-btn light"
        aria-label={`${t.users.actions}: ${user.name}`}
        aria-haspopup="menu"
        aria-expanded={Boolean(open)}
        onClick={(e) => {
          if (open) return setOpen(null)
          const r = e.currentTarget.getBoundingClientRect()
          return setOpen({ top: r.bottom + 6, right: window.innerWidth - r.right })
        }}
        style={{ width: 38, height: 38 }}
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="menu-list" role="menu" style={{ position: 'fixed', top: open.top, right: open.right }}>
          {user.isActive && (
            <button type="button" role="menuitem" className="menu-item" onClick={run(() => link.mutate())}>
              <KeyRound size={16} /> {t.users.resetLink}
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={run(() => update.mutate({ role: user.role === 'admin' ? 'member' : 'admin' }))}
          >
            {user.role === 'admin' ? <UserRound size={16} /> : <ShieldCheck size={16} />}
            {user.role === 'admin' ? t.users.makeMember : t.users.makeAdmin}
          </button>
          {user.isActive ? (
            !isSelf && (
              <button
                type="button"
                role="menuitem"
                className="menu-item danger"
                onClick={run(() => {
                  if (window.confirm(t.users.confirmDeactivate(user.name))) update.mutate({ is_active: false })
                })}
              >
                <UserX size={16} /> {t.users.deactivate}
              </button>
            )
          ) : (
            <button type="button" role="menuitem" className="menu-item" onClick={run(() => update.mutate({ is_active: true }))}>
              <Check size={16} /> {t.users.activate}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** /admin/users — RF-USR-04..06 y alta por invitación. */
export function AdminUsersPage() {
  const { data: me } = useMe()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') || '')
  const [inviting, setInviting] = useState(false)
  const [linkResult, setLinkResult] = useState(null)

  const role = params.get('role') || ''
  const status = params.get('status') || ''
  const page = Number(params.get('page')) || 1
  const pageSize = 20

  function setParam(key, value) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  // Búsqueda con debounce, reflejada en la URL.
  useEffect(() => {
    const id = setTimeout(() => {
      if (q !== (params.get('q') || '')) setParam('q', q.trim())
    }, 300)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const users = useQuery({
    queryKey: ['users', { q: params.get('q') || '', role, status, page }],
    queryFn: () => api.get(`/users${qs({ q: params.get('q'), role, status, page, pageSize })}`),
    placeholderData: keepPreviousData,
  })

  const pages = users.data ? Math.max(1, Math.ceil(users.data.total / pageSize)) : 1

  let content
  if (users.isPending) content = <SkeletonRows rows={6} />
  else if (users.isError) content = <ErrorState error={users.error} onRetry={() => users.refetch()} />
  else if (users.data.items.length === 0)
    content = <EmptyState icon={Users} color="bg-cyan" title={t.users.emptyTitle} body={t.users.emptyBody} />
  else
    content = (
      <>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t.users.colUser}</th>
                <th scope="col">{t.users.colRole}</th>
                <th scope="col">{t.users.colStatus}</th>
                <th scope="col">{t.users.colLastLogin}</th>
                <th scope="col">
                  <span className="sr-only">{t.users.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.data.items.map((u) => {
                const st = statusOf(u)
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="user-cell">
                        <Avatar user={u} size={40} />
                        <div>
                          <strong>{u.name}</strong>
                          <small>{u.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`pill ${u.role === 'admin' ? 'dark' : ''}`}>{t.roles[u.role]}</span>
                    </td>
                    <td>
                      <span className={`pill ${STATUS_PILL[st]}`}>
                        <span className="dot" /> {t.users.status[st]}
                      </span>
                    </td>
                    <td className="muted">{u.lastLoginAt ? DATE_FMT.format(new Date(u.lastLoginAt)) : t.users.never}</td>
                    <td style={{ textAlign: 'right' }}>
                      <RowActions user={u} isSelf={u.id === me.id} onLink={setLinkResult} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="pager">
            <span className="muted">{t.common.pageOf(page, pages)}</span>
            <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setParam('page', String(page - 1))}>
              {t.common.prev}
            </button>
            <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setParam('page', String(page + 1))}>
              {t.common.next}
            </button>
          </div>
        )}
      </>
    )

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{t.users.title}</h1>
          <p className="muted">{t.users.subtitle}</p>
        </div>
        <button className="btn btn-dark" type="button" onClick={() => setInviting(true)}>
          <UserPlus size={18} /> {t.users.invite}
        </button>
      </div>

      <div className="toolbar">
        <label className="sr-only" htmlFor="users-q">
          {t.users.search}
        </label>
        <input
          id="users-q"
          className="input"
          type="search"
          placeholder={t.users.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="select" aria-label={t.users.colRole} value={role} onChange={(e) => setParam('role', e.target.value)}>
          <option value="">{t.users.allRoles}</option>
          <option value="admin">{t.roles.admin}</option>
          <option value="member">{t.roles.member}</option>
        </select>
        <select
          className="select"
          aria-label={t.users.colStatus}
          value={status}
          onChange={(e) => setParam('status', e.target.value)}
        >
          <option value="">{t.users.allStatus}</option>
          {Object.entries(t.users.status).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {content}

      {inviting && (
        <InviteModal
          onClose={() => setInviting(false)}
          onCreated={(r) => {
            setInviting(false)
            setLinkResult(r)
          }}
        />
      )}
      {linkResult && <LinkModal result={linkResult} onClose={() => setLinkResult(null)} />}
    </div>
  )
}
