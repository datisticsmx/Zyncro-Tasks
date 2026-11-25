/**
 * Proyectos y Sprints son modelos independientes en la API, pero sus tareas
 * tienen la misma forma, así que tablero, lista, panel de tarea, comentarios,
 * adjuntos y bitácora se reutilizan. Este módulo dice a qué API y a qué ruta
 * pertenece cada cosa según su `kind`:
 *
 *   'project' (o sin kind) → /projects, /tasks, /comments
 *   'sprint'               → /sprints, /sprint-tasks, /sprint-comments
 *
 * La API marca con `kind: 'sprint'` los sprints, sus actividades y sus
 * comentarios; lo que no trae `kind` es de proyecto.
 */

const PROJECT = {
  kind: 'project',
  api: '/projects',
  taskApi: '/tasks',
  commentApi: '/comments',
  route: '/projects',
  scope: 'projects',
  taskScope: 'tasks',
}

const SPRINT = {
  kind: 'sprint',
  api: '/sprints',
  taskApi: '/sprint-tasks',
  commentApi: '/sprint-comments',
  route: '/sprints',
  scope: 'sprints',
  taskScope: 'sprint-tasks',
}

/** Acepta 'sprint' / 'project' o cualquier objeto con `kind`. */
export function trackerOf(x) {
  const kind = typeof x === 'string' ? x : x?.kind
  return kind === 'sprint' ? SPRINT : PROJECT
}

/** Contenedor de una tarea (proyecto o sprint): clave, nombre y ruta. */
export function taskContainer(task) {
  const tr = trackerOf(task)
  const key = tr.kind === 'sprint' ? task.sprintKey : task.projectKey
  const name = tr.kind === 'sprint' ? task.sprintName : task.projectName
  return { kind: tr.kind, key, name, taskPath: `${tr.route}/${key}/tasks/${task.number}` }
}
