import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { Lock, MoreHorizontal } from 'lucide-react'
import { api } from '../../lib/api'
import { projectKeys } from '../../lib/projects'
import { useMe } from '../../lib/session'
import { PROJECT_STATUS_COLOR } from '../../lib/ui'
import { isDarkColor, projectColor } from '../../lib/projectColor'
import { DateBadge } from '../../components/TaskCard'
import { useToast } from '../../components/Toast'
import { t } from '../../i18n/es'

/** Columnas en el orden del ciclo de vida; "Archivado" solo si se pidió verlos. */
const STATUSES = ['not_started', 'active', 'paused', 'completed', 'archived']
const FINISHED = ['completed', 'archived']

/**
 * Mismas reglas que la API (PATCH /projects/:id): edita el creador o un Admin,
 * y archivar o des-archivar es solo de Admin.
 */
function canMove(p, me, to) {
  if (me.role !== 'admin' && !p.isCreator) return false
  if (me.role !== 'admin' && (to === 'archived' || p.status === 'archived')) return false
  return true
}

/** Alternativa de teclado al arrastre (RNF-UX-02), como en el tablero de tareas. */
function MoveMenu({ p, me, onMove }) {
  const [open, setOpen] = useState(false)
  const targets = STATUSES.filter((s) => s !== p.status && canMove(p, me, s))
  if (targets.length === 0) return null
  return (
    <div className="card-menu" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <button
        type="button"
        className="card-menu-btn"
        aria-label={t.projects.moveMenu(p.key)}
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
          {targets.map((s) => (
            <button
              key={s}
              type="button"
              role="menuitem"
              className="menu-item"
              onKeyDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                onMove(p, s)
              }}
            >
              <span className={`dot-lg bg-${PROJECT_STATUS_COLOR[s]}`} /> {t.projectStatus[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Tarjeta compacta con el color del proyecto. */
function ColumnCardBody({ p }) {
  return (
    <>
      <div className="pcol-card-top">
        <span className="pill dark">{p.key}</span>
        {p.visibility === 'private' && <Lock size={13} aria-label={t.visibility.private} />}
      </div>
      <strong className="pcol-card-name">{p.name}</strong>
      <span className="meta">{p.clientName || t.projects.noClient}</span>
      <div className="progress" aria-label={`${t.projects.progress}: ${p.stats.progress}%`}>
        <div className="progress-head">
          <span>{t.projects.tasks(p.stats.total)}</span>
          <strong>{p.stats.progress}%</strong>
        </div>
        <div className="progress-track">
          <span style={{ width: `${p.stats.progress}%` }} />
        </div>
      </div>
      {p.endDateTentative && (
        <DateBadge date={p.endDateTentative} finished={FINISHED.includes(p.status)} label={t.projects.end} />
      )}
    </>
  )
}

function ColumnCard({ p, me, onOpen, onMove }) {
  const movable = canMove(p, me, null)
  // Sin transform propio: mientras se arrastra se mueve la copia del DragOverlay.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: p.id, disabled: !movable })
  const color = projectColor(p)
  const classes = ['pcol-card', isDarkColor(color) && 'on-dark', isDragging && 'dragging', movable && 'movable']
  return (
    <li
      ref={setNodeRef}
      className={classes.filter(Boolean).join(' ')}
      style={{ background: color }}
      {...attributes}
      {...listeners}
      aria-roledescription={movable ? 'tarjeta movible' : undefined}
      title={movable ? undefined : t.projects.cantMove}
      onClick={() => onOpen(p)}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e)
        if (e.key === 'Enter' && !e.defaultPrevented) onOpen(p)
      }}
    >
      <ColumnCardBody p={p} />
      <MoveMenu p={p} me={me} onMove={onMove} />
    </li>
  )
}

function Column({ status, items, me, onOpen, onMove }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <section className={`board-col${isOver ? ' over' : ''}`} aria-label={t.projectStatus[status]}>
      <header className="board-col-head">
        <span className={`pill ${PROJECT_STATUS_COLOR[status]}`}>
          <span className="dot" /> {t.projectStatus[status]}
        </span>
        <span className="count">{items.length}</span>
      </header>
      <ul className="board-list" ref={setNodeRef}>
        {items.map((p) => (
          <ColumnCard key={p.id} p={p} me={me} onOpen={onOpen} onMove={onMove} />
        ))}
        {items.length === 0 && <li className="board-empty">{t.projects.emptyColumn}</li>}
      </ul>
    </section>
  )
}

/**
 * Vista "Columnas" de /projects: un tablero por estatus de proyecto. Arrastrar
 * una tarjeta a otra columna cambia su estatus (PATCH /projects/:id) con
 * actualización optimista; si la API lo rechaza, vuelve a su lugar.
 * `queryKey` es la llave del listado que se está mostrando.
 */
export function ProjectColumns({ items, queryKey, showArchived }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const { data: me } = useMe()
  const [activeId, setActiveId] = useState(null)

  const statuses = showArchived ? STATUSES : STATUSES.filter((s) => s !== 'archived')
  const byId = useMemo(() => Object.fromEntries(items.map((p) => [p.id, p])), [items])
  const columns = useMemo(() => {
    const cols = Object.fromEntries(STATUSES.map((s) => [s, []]))
    for (const p of items) cols[p.status]?.push(p)
    return cols
  }, [items])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )

  const move = useMutation({
    mutationFn: async ({ p, status }) => (await api.patch(`/projects/${p.id}`, { status })).project,
    onMutate: async ({ p, status }) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData(queryKey)
      qc.setQueryData(queryKey, (data) =>
        data ? { ...data, items: data.items.map((x) => (x.id === p.id ? { ...x, status } : x)) } : data,
      )
      return { previous }
    },
    onError: (err, vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKey, ctx.previous)
      toast.error(err.message || t.projects.moveFailed)
    },
    onSuccess: (project) => {
      qc.setQueryData(projectKeys.detail(project.key), project)
      toast.success(t.projects.moved(project.key, t.projectStatus[project.status]))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['projects', 'list'] }),
  })

  function moveTo(p, status) {
    if (p.status === status) return
    if (!canMove(p, me, status)) {
      toast.error(status === 'archived' || p.status === 'archived' ? t.projects.archiveOnlyAdmin : t.projects.cantMove)
      return
    }
    move.mutate({ p, status })
  }

  const open = (p) => navigate(`/projects/${p.key}`)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={({ active, over }) => {
        setActiveId(null)
        if (!over) return
        // `over` puede ser la columna o una tarjeta dentro de ella.
        const status = STATUSES.includes(over.id) ? over.id : byId[over.id]?.status
        if (status) moveTo(byId[active.id], status)
      }}
      accessibility={{
        screenReaderInstructions: {
          draggable: 'Presiona espacio para tomar el proyecto, flechas para moverlo y espacio para soltarlo. Escape cancela.',
        },
        // Los avisos por defecto de dnd-kit están en inglés y con ids.
        announcements: {
          onDragStart: ({ active }) => `Tomaste ${byId[active.id]?.key}.`,
          onDragOver: ({ active, over }) => {
            const s = over && (STATUSES.includes(over.id) ? over.id : byId[over.id]?.status)
            return s ? `${byId[active.id]?.key} sobre ${t.projectStatus[s]}.` : undefined
          },
          onDragEnd: ({ active, over }) => {
            const s = over && (STATUSES.includes(over.id) ? over.id : byId[over.id]?.status)
            return s ? `Soltaste ${byId[active.id]?.key} en ${t.projectStatus[s]}.` : `Soltaste ${byId[active.id]?.key}.`
          },
          onDragCancel: ({ active }) => `Se canceló mover ${byId[active.id]?.key}.`,
        },
      }}
    >
      <div className="board project-columns">
        {statuses.map((s) => (
          <Column key={s} status={s} items={columns[s]} me={me} onOpen={open} onMove={moveTo} />
        ))}
      </div>
      <DragOverlay>
        {activeId && byId[activeId] ? (
          <div
            className={`pcol-card overlay${isDarkColor(projectColor(byId[activeId])) ? ' on-dark' : ''}`}
            style={{ background: projectColor(byId[activeId]) }}
          >
            <ColumnCardBody p={byId[activeId]} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
