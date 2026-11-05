import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { ChevronDown, ChevronUp, Layers, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { useBoard, useCreateTask, useSetTaskGroup, useToggleDone } from '../../lib/tasks'
import { useCreateGroup, useDeleteGroup, useTaskGroups, useUpdateGroup } from '../../lib/taskGroups'
import { TASK_STATUS_COLOR } from '../../lib/ui'
import { AssigneeStack, DueBadge, PriorityPill } from '../../components/TaskCard'
import { TaskDoneCheck } from '../../components/TaskCheck'
import { QuickAddTask } from '../../components/QuickAddTask'
import { EmptyState, ErrorState, Skeleton } from '../../components/States'
import { useToast } from '../../components/Toast'
import { t } from '../../i18n/es'

/** Id del grupo "Sin grupo": no es una fila, es la ausencia de grupo. */
const SIN_GRUPO = '__none__'

/** Menú del grupo: renombrar, reordenar y eliminar. */
function GroupMenu({ group, canMoveUp, canMoveDown, onRename, onMove, onDelete }) {
  const [open, setOpen] = useState(false)
  const act = (fn) => () => {
    setOpen(false)
    fn()
  }
  return (
    <div className="card-menu checklist-menu" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <button
        type="button"
        className="card-menu-btn"
        aria-label={t.checklist.groupMenu(group.name)}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="menu-list" role="menu">
          <button type="button" role="menuitem" className="menu-item" onClick={act(onRename)}>
            <Pencil size={14} /> {t.checklist.rename}
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            disabled={!canMoveUp}
            onClick={act(() => onMove(-1))}
          >
            <ChevronUp size={14} /> {t.checklist.moveUp}
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            disabled={!canMoveDown}
            onClick={act(() => onMove(1))}
          >
            <ChevronDown size={14} /> {t.checklist.moveDown}
          </button>
          <button type="button" role="menuitem" className="menu-item danger" onClick={act(onDelete)}>
            <Trash2 size={14} /> {t.checklist.delete}
          </button>
        </div>
      )}
    </div>
  )
}

/** Menú "Mover a grupo…" de una fila de tarea. */
function MoveToGroupMenu({ task, groups, onMove }) {
  const [open, setOpen] = useState(false)
  const destinos = [
    ...groups.filter((g) => g.id !== task.groupId).map((g) => ({ id: g.id, name: g.name })),
    ...(task.groupId ? [{ id: null, name: t.tasks.noGroup }] : []),
  ]
  if (destinos.length === 0) return null
  return (
    <div className="card-menu" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <button
        type="button"
        className="card-menu-btn"
        aria-label={t.checklist.moveTo}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="menu-list" role="menu">
          <span className="menu-caption">{t.checklist.moveTo}</span>
          {destinos.map((d) => (
            <button
              key={d.id || SIN_GRUPO}
              type="button"
              role="menuitem"
              className="menu-item"
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                onMove(task, d)
              }}
            >
              <Layers size={14} /> {d.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Una fila de tarea del checklist: casilla + clave + título + metadatos. */
function TaskRow({ task, groups, onOpen, onToggle, onMoveGroup }) {
  const done = task.status === 'done'
  return (
    <li className={`check-row${done ? ' is-done' : ''}`}>
      <TaskDoneCheck task={task} onToggle={onToggle} />
      <button type="button" className="check-row-main" onClick={() => onOpen(task)} aria-label={t.checklist.openTask(task.ref)}>
        <span className="pill dark ref">{task.ref}</span>
        <span className="check-row-title">{task.title}</span>
      </button>
      <div className="check-row-meta">
        <span className={`pill ${TASK_STATUS_COLOR[task.status]}`}>
          <span className="dot" /> {t.taskStatus[task.status]}
        </span>
        <PriorityPill priority={task.priority} />
        <DueBadge task={task} />
        <AssigneeStack users={task.assignees} size={24} max={2} />
      </div>
      <MoveToGroupMenu task={task} groups={groups} onMove={onMoveGroup} />
    </li>
  )
}

/** Barra de avance del grupo (hechas / total). */
function Progress({ done, total }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)
  return (
    <div className="check-progress" title={t.checklist.progressLabel(done, total)}>
      <div
        className="check-bar"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t.checklist.progressLabel(done, total)}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
      <span className="check-count">{t.checklist.progress(done, total)}</span>
    </div>
  )
}

/** Una sección: un grupo con sus tareas, o "Sin grupo". */
function GroupSection({ group, tasks, groups, index, total, hideDone, actions }) {
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(group.name)
  const esSinGrupo = group.id === SIN_GRUPO
  // El avance siempre cuenta todas las tareas del grupo: "Ocultar completadas"
  // solo cambia lo que se pinta, no el progreso.
  const hechas = tasks.filter((x) => x.status === 'done').length
  const visibles = hideDone ? tasks.filter((x) => x.status !== 'done') : tasks

  async function submitName(e) {
    e.preventDefault()
    const limpio = name.trim()
    if (!limpio || limpio === group.name) {
      setRenaming(false)
      setName(group.name)
      return
    }
    if (await actions.onRename(group, limpio)) setRenaming(false)
    else setName(group.name)
  }

  return (
    <section className="check-group" aria-label={group.name}>
      <header className="check-group-head">
        {renaming ? (
          <form className="check-rename" onSubmit={submitName}>
            <input
              className="input"
              autoFocus
              maxLength={120}
              aria-label={t.checklist.groupName}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setRenaming(false)
                  setName(group.name)
                }
              }}
              onBlur={submitName}
            />
          </form>
        ) : (
          <h2 className="check-group-title">
            <Layers size={16} aria-hidden="true" />
            {group.name}
          </h2>
        )}
        <Progress done={hechas} total={tasks.length} />
        {!esSinGrupo && (
          <GroupMenu
            group={group}
            canMoveUp={index > 0}
            canMoveDown={index < total - 1}
            onRename={() => setRenaming(true)}
            onMove={(dir) => actions.onMove(group, dir)}
            onDelete={() => actions.onDelete(group, tasks.length)}
          />
        )}
      </header>

      {visibles.length === 0 ? (
        <p className="muted check-empty">{esSinGrupo ? t.checklist.ungroupedEmpty : t.checklist.groupEmpty}</p>
      ) : (
        <ul className="check-list">
          {visibles.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              groups={groups}
              onOpen={actions.onOpen}
              onToggle={actions.onToggle}
              onMoveGroup={actions.onMoveTask}
            />
          ))}
        </ul>
      )}
      <QuickAddTask
        extra={{ group_id: esSinGrupo ? null : group.id }}
        onCreate={actions.onCreate}
        label={t.checklist.addTask}
        ariaLabel={`${t.checklist.addTask}: ${group.name}`}
      />
    </section>
  )
}

/** Formulario para crear un grupo (en la barra de herramientas). */
function NewGroup({ onCreate }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    const ok = await onCreate(name.trim())
    setBusy(false)
    if (ok) {
      setName('')
      setOpen(false)
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-dark" onClick={() => setOpen(true)}>
        <Plus size={16} /> {t.checklist.newGroup}
      </button>
    )
  }
  return (
    <form className="check-new-group" onSubmit={submit}>
      <input
        className="input"
        autoFocus
        maxLength={120}
        placeholder={t.checklist.groupPlaceholder}
        aria-label={t.checklist.groupName}
        value={name}
        disabled={busy}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      />
      <button type="submit" className="btn btn-dark" disabled={busy || !name.trim()}>
        {busy ? t.common.saving : t.checklist.create}
      </button>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
        {t.common.cancel}
      </button>
    </form>
  )
}

/**
 * /projects/:key/checklist — agrupación de tareas tipo checklist: cada grupo
 * con su título, su avance y la casilla de cada tarea para completarla sin
 * salir de la vista. Las tareas sin grupo van al final.
 */
export function ChecklistView({ project }) {
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const board = useBoard(project.id)
  const groups = useTaskGroups(project.id)
  const [hideDone, setHideDone] = useState(false)

  const toggle = useToggleDone(project.key, { onRollback: () => toast.error(t.tasks.toggleFailed) })
  const create = useCreateTask(project.id, project.key)
  const createGroup = useCreateGroup(project.id)
  const updateGroup = useUpdateGroup(project.id)
  const deleteGroup = useDeleteGroup(project.id, project.key)
  const setTaskGroup = useSetTaskGroup(project.key)

  const items = useMemo(() => board.data?.items || [], [board.data])
  const lista = useMemo(() => groups.data || [], [groups.data])

  // Tareas por grupo, en el orden de creación (la clave WEB-12 numera el alta).
  const porGrupo = useMemo(() => {
    const mapa = new Map(lista.map((g) => [g.id, []]))
    const sueltas = []
    for (const task of [...items].sort((a, b) => a.number - b.number)) {
      if (task.groupId && mapa.has(task.groupId)) mapa.get(task.groupId).push(task)
      else sueltas.push(task)
    }
    return { mapa, sueltas }
  }, [items, lista])

  const openTask = (task) =>
    navigate(`/projects/${project.key}/tasks/${task.number}`, {
      state: { from: location.pathname + location.search, view: 'checklist' },
    })

  const actions = {
    onOpen: openTask,
    onToggle: (task, done) => {
      toggle.mutate({ task, done })
      toast.success(done ? t.tasks.doneToast(task.ref) : t.tasks.undoneToast(task.ref, t.taskStatus.todo))
    },
    onCreate: async (body) => {
      try {
        const { task } = await create.mutateAsync(body)
        toast.success(t.tasks.created(task.ref))
        return true
      } catch (err) {
        toast.error(err.fields ? Object.values(err.fields)[0] : err.message)
        return false
      }
    },
    onRename: async (group, name) => {
      try {
        await updateGroup.mutateAsync({ id: group.id, name })
        toast.success(t.checklist.renamed)
        return true
      } catch (err) {
        toast.error(err.fields ? Object.values(err.fields)[0] : err.message)
        return false
      }
    },
    // Reordena con la posición fraccional del backend: vecino de arriba y de abajo.
    onMove: async (group, dir) => {
      const i = lista.findIndex((g) => g.id === group.id)
      const destino = i + dir
      if (destino < 0 || destino >= lista.length) return
      const sinEl = lista.filter((g) => g.id !== group.id)
      const antes = dir < 0 ? sinEl[destino - 1] : sinEl[destino]
      const despues = dir < 0 ? sinEl[destino] : sinEl[destino + 1]
      try {
        await updateGroup.mutateAsync({
          id: group.id,
          beforeId: antes?.id || null,
          afterId: despues?.id || null,
        })
      } catch (err) {
        toast.error(err.message)
      }
    },
    onDelete: async (group, cuantas) => {
      if (!window.confirm(t.checklist.confirmDelete(group.name, cuantas))) return
      try {
        const res = await deleteGroup.mutateAsync(group.id)
        toast.success(t.checklist.deleted(res?.ungrouped || 0))
      } catch (err) {
        toast.error(err.message)
      }
    },
    onMoveTask: async (task, destino) => {
      try {
        await setTaskGroup.mutateAsync({ task, groupId: destino.id })
        toast.success(t.checklist.movedTo(task.ref, destino.name))
      } catch (err) {
        toast.error(err.fields ? Object.values(err.fields)[0] : err.message)
      }
    },
  }

  if (board.isPending || groups.isPending) {
    return (
      <div className="check-view" role="status" aria-label={t.common.loading}>
        {[0, 1].map((i) => (
          <Skeleton key={i} height={220} radius={24} />
        ))}
      </div>
    )
  }
  if (board.isError) return <ErrorState error={board.error} onRetry={() => board.refetch()} />
  if (groups.isError) return <ErrorState error={groups.error} onRetry={() => groups.refetch()} />

  return (
    <div>
      <div className="toolbar">
        <NewGroup onCreate={async (name) => {
          try {
            const group = await createGroup.mutateAsync(name)
            toast.success(t.checklist.created(group.name))
            return true
          } catch (err) {
            toast.error(err.fields ? Object.values(err.fields)[0] : err.message)
            return false
          }
        }}
        />
        <label className="check">
          <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
          {t.checklist.hideDone}
        </label>
      </div>

      {lista.length === 0 && porGrupo.sueltas.length === 0 ? (
        <EmptyState icon={Layers} color="bg-lilac" title={t.checklist.emptyTitle} body={t.checklist.emptyBody} />
      ) : (
        <div className="check-view">
          {lista.map((group, i) => (
            <GroupSection
              key={group.id}
              group={group}
              tasks={porGrupo.mapa.get(group.id) || []}
              groups={lista}
              index={i}
              total={lista.length}
              hideDone={hideDone}
              actions={actions}
            />
          ))}
          <GroupSection
            group={{ id: SIN_GRUPO, name: t.checklist.ungrouped }}
            tasks={porGrupo.sueltas}
            groups={lista}
            index={0}
            total={1}
            hideDone={hideDone}
            actions={actions}
          />
        </div>
      )}
    </div>
  )
}
