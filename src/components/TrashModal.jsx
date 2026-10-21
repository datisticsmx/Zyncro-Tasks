import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RotateCcw, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { invalidateTaskViews } from '../lib/tasks'
import { Modal } from './Modal'
import { EmptyState, ErrorState, SkeletonRows } from './States'
import { useToast } from './Toast'
import { t } from '../i18n/es'

const DATETIME = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' })

/** RF-TSK-09: papelera del proyecto (solo Admin), restaurable 30 días. */
export function TrashModal({ project, onClose }) {
  const qc = useQueryClient()
  const toast = useToast()
  const trash = useQuery({
    queryKey: ['tasks', 'trash', project.id],
    queryFn: () => api.get(`/projects/${project.id}/tasks/deleted`),
  })

  async function restore(task) {
    try {
      await api.post(`/tasks/${task.id}/restore`)
      toast.success(t.trash.restored(task.ref))
      qc.invalidateQueries({ queryKey: ['tasks', 'trash', project.id] })
      invalidateTaskViews(qc, project.key)
    } catch (err) {
      toast.error(err.message)
    }
  }

  let content
  if (trash.isPending) content = <SkeletonRows rows={3} height={56} />
  else if (trash.isError) content = <ErrorState error={trash.error} onRetry={() => trash.refetch()} />
  else if (trash.data.items.length === 0)
    content = <EmptyState icon={Trash2} color="bg-green" title={t.trash.emptyTitle} body={t.trash.emptyBody} />
  else
    content = (
      <ul className="trash-list">
        {trash.data.items.map((task) => (
          <li key={task.id}>
            <span className="pill dark ref">{task.ref}</span>
            <div className="trash-main">
              <strong>{task.title}</strong>
              <span className="muted">
                {t.trash.deletedAt}: {DATETIME.format(new Date(task.deletedAt))}
              </span>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => restore(task)}>
              <RotateCcw size={15} /> {t.trash.restore}
            </button>
          </li>
        ))}
      </ul>
    )

  return (
    <Modal title={t.trash.title} subtitle={t.trash.subtitle} onClose={onClose}>
      {content}
    </Modal>
  )
}
