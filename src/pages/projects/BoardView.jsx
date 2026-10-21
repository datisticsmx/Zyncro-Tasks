import { memo, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MoreHorizontal, Plus } from 'lucide-react'
import { STATUSES, useBoard, useCreateTask, useMoveTask } from '../../lib/tasks'
import { TASK_STATUS_COLOR } from '../../lib/ui'
import { TaskCardBody } from '../../components/TaskCard'
import { ErrorState, Skeleton } from '../../components/States'
import { useToast } from '../../components/Toast'
import { t } from '../../i18n/es'

/** Agrupa la lista plana (ya ordenada por la API) en columnas de ids. */
function toColumns(items) {
  const cols = Object.fromEntries(STATUSES.map((s) => [s, []]))
  for (const task of items) cols[task.status]?.push(task.id)
  return cols
}

function findColumn(cols, id) {
  if (id in cols) return id
  return STATUSES.find((s) => cols[s].includes(id))
}

/** RNF-UX-02: alternativa de teclado al drag & drop. */
function MoveMenu({ task, onMove }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card-menu" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <button
        type="button"
        className="card-menu-btn"
        aria-label={t.tasks.moveMenu(task.ref)}
        aria-haspopup="menu"
        aria-expanded={open}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="menu-list" role="menu" onPointerDown={(e) => e.stopPropagation()}>
          <span className="menu-caption">{t.tasks.moveTo}</span>
          {STATUSES.filter((s) => s !== task.status).map((s) => (
            <button
              key={s}
              type="button"
              role="menuitem"
              className="menu-item"
              onKeyDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                onMove(task, s)
              }}
            >
              <span className={`dot-lg bg-${TASK_STATUS_COLOR[s]}`} /> {t.taskStatus[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const SortableCard = memo(function SortableCard({ task, onOpen, onMove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  return (
    <li
      ref={setNodeRef}
      className={`task-card${isDragging ? ' dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      aria-roledescription="tarjeta movible"
      onClick={() => onOpen(task)}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e)
        if (e.key === 'Enter' && !e.defaultPrevented) onOpen(task)
      }}
    >
      <TaskCardBody task={task} />
      <MoveMenu task={task} onMove={onMove} />
    </li>
  )
})

function QuickAdd({ status, onCreate }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    const ok = await onCreate({ title: title.trim(), status })
    setBusy(false)
    if (ok) setTitle('')
  }

  if (!open) {
    return (
      <button type="button" className="quick-add-btn" onClick={() => setOpen(true)}>
        <Plus size={16} /> {t.tasks.addTask}
      </button>
    )
  }
  return (
    <form className="quick-add" onSubmit={submit}>
      <input
        className="input"
        autoFocus
        maxLength={200}
        placeholder={t.tasks.newTaskPlaceholder}
        aria-label={`${t.tasks.addTask}: ${t.taskStatus[status]}`}
        value={title}
        disabled={busy}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        onBlur={() => !title && setOpen(false)}
      />
    </form>
  )
}

function Column({ status, ids, byId, onOpen, onMove, onCreate }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <section className={`board-col${isOver ? ' over' : ''}`} aria-label={t.taskStatus[status]}>
      <header className="board-col-head">
        <span className={`pill ${TASK_STATUS_COLOR[status]}`}>
          <span className="dot" /> {t.taskStatus[status]}
        </span>
        <span className="count">{ids.length}</span>
      </header>
      <QuickAdd status={status} onCreate={onCreate} />
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="board-list" ref={setNodeRef}>
          {ids.map((id) => (
            <SortableCard key={id} task={byId[id]} onOpen={onOpen} onMove={onMove} />
          ))}
          {ids.length === 0 && <li className="board-empty">{t.tasks.emptyColumn}</li>}
        </ul>
      </SortableContext>
    </section>
  )
}

/** /projects/:key/board — RF-VIEW-01 (CA-08). */
export function BoardView({ project }) {
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const board = useBoard(project.id)
  const move = useMoveTask(project.id, project.key, { onRollback: () => toast.error(t.tasks.moveFailed) })
  const create = useCreateTask(project.id, project.key)

  // Columnas durante el arrastre; fuera de él se derivan de la caché.
  const [dragCols, setDragCols] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const startCol = useRef(null)

  const items = useMemo(() => board.data?.items || [], [board.data])
  const byId = useMemo(() => Object.fromEntries(items.map((x) => [x.id, x])), [items])
  const derived = useMemo(() => toColumns(items), [items])
  const cols = dragCols || derived

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const openTask = (task) =>
    navigate(`/projects/${project.key}/tasks/${task.number}`, { state: { from: location.pathname + location.search } })

  function moveTo(task, status) {
    move.mutate({ task, status })
    toast.success(t.tasks.moved(task.ref, t.taskStatus[status]))
  }

  async function createTask(body) {
    try {
      const { task } = await create.mutateAsync(body)
      toast.success(t.tasks.created(task.ref))
      return true
    } catch (err) {
      toast.error(err.message)
      return false
    }
  }

  function onDragStart({ active }) {
    setActiveId(active.id)
    setDragCols(derived)
    startCol.current = findColumn(derived, active.id)
  }

  function onDragOver({ active, over }) {
    if (!over) return
    setDragCols((prev) => {
      const current = prev || derived
      const from = findColumn(current, active.id)
      const to = findColumn(current, over.id)
      if (!from || !to || from === to) return current
      const toIds = current[to]
      const overIndex = over.id in current ? toIds.length : toIds.indexOf(over.id)
      return {
        ...current,
        [from]: current[from].filter((id) => id !== active.id),
        [to]: [...toIds.slice(0, overIndex), active.id, ...toIds.slice(overIndex)],
      }
    })
  }

  function onDragEnd({ active, over }) {
    const current = dragCols || derived
    setActiveId(null)
    if (!over) {
      setDragCols(null)
      return
    }
    const col = findColumn(current, active.id)
    let ids = current[col]
    const overIndex = ids.indexOf(over.id)
    const activeIndex = ids.indexOf(active.id)
    if (overIndex !== -1 && overIndex !== activeIndex) ids = arrayMove(ids, activeIndex, overIndex)

    const idx = ids.indexOf(active.id)
    const original = derived[startCol.current] || []
    const unchanged = col === startCol.current && original.indexOf(active.id) === idx
    setDragCols(null)
    if (unchanged) return
    move.mutate({
      task: byId[active.id],
      status: col,
      beforeId: ids[idx - 1] || null,
      afterId: ids[idx + 1] || null,
    })
  }

  if (board.isPending) {
    return (
      <div className="board" role="status" aria-label={t.common.loading}>
        {STATUSES.map((s) => (
          <div key={s} className="board-col">
            <Skeleton height={28} width={110} radius={999} />
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={96} radius={18} style={{ marginTop: 10 }} />
            ))}
          </div>
        ))}
      </div>
    )
  }
  if (board.isError) return <ErrorState error={board.error} onRetry={() => board.refetch()} />

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null)
        setDragCols(null)
      }}
      accessibility={{
        screenReaderInstructions: {
          draggable: 'Presiona espacio para tomar la tarjeta, flechas para moverla y espacio para soltarla. Escape cancela.',
        },
      }}
    >
      <div className="board">
        {STATUSES.map((s) => (
          <Column
            key={s}
            status={s}
            ids={cols[s]}
            byId={byId}
            onOpen={openTask}
            onMove={moveTo}
            onCreate={createTask}
          />
        ))}
      </div>
      <DragOverlay>
        {activeId && byId[activeId] ? (
          <div className="task-card overlay">
            <TaskCardBody task={byId[activeId]} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
