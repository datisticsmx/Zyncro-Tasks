import { Navigate, createBrowserRouter } from 'react-router'
import { PublicOnly, RequireAdmin, RequireAuth } from './components/Guards'
import { AppLayout } from './components/Layout'
import { NotFound } from './components/States'
import { LoginPage } from './pages/auth/LoginPage'
import { ForgotPage } from './pages/auth/ForgotPage'
import { SetPasswordPage } from './pages/auth/SetPasswordPage'
import { HomePage } from './pages/HomePage'
import { ProjectsPage } from './pages/projects/ProjectsPage'
import { ProjectPage } from './pages/projects/ProjectPage'
import { ProjectFormPage } from './pages/projects/ProjectFormPage'
import { ProjectWorkspace } from './pages/projects/ProjectWorkspace'
import { SprintsPage } from './pages/sprints/SprintsPage'
import { SprintPage } from './pages/sprints/SprintPage'
import { SprintFormPage } from './pages/sprints/SprintFormPage'
import { PeoplePage } from './pages/PeoplePage'
import { NotesPage } from './pages/NotesPage'
import { ProfilePage } from './pages/ProfilePage'
import { AdminUsersPage } from './pages/AdminUsersPage'

/** Rutas de la sección 6. */
export const router = createBrowserRouter([
  {
    element: <PublicOnly />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/forgot', element: <ForgotPage /> },
    ],
  },
  // Accesibles con o sin sesión (un Admin puede abrir el link para probarlo).
  { path: '/invite/:token', element: <SetPasswordPage type="invite" /> },
  { path: '/reset/:token', element: <SetPasswordPage type="reset" /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: '/projects', element: <ProjectsPage /> },
          // caseSensitive: un proyecto con clave NEW sigue siendo /projects/NEW.
          { path: '/projects/new', caseSensitive: true, element: <ProjectFormPage /> },
          { path: '/projects/:key', element: <ProjectPage /> },
          { path: '/projects/:key/settings', element: <ProjectFormPage /> },
          { path: '/projects/:key/board', element: <ProjectWorkspace view="board" /> },
          { path: '/projects/:key/list', element: <ProjectWorkspace view="list" /> },
          { path: '/projects/:key/checklist', element: <ProjectWorkspace view="checklist" /> },
          { path: '/projects/:key/tasks/:number', element: <ProjectWorkspace /> },
          { path: '/sprints', element: <SprintsPage /> },
          { path: '/sprints/new', caseSensitive: true, element: <SprintFormPage /> },
          {
            path: '/sprints/:key',
            element: <SprintPage />,
            // Sin elemento propio: SprintPage abre el panel de la actividad
            // sobre sí misma (useMatch) sin desmontarse.
            children: [{ path: 'tasks/:number', element: null }],
          },
          { path: '/sprints/:key/settings', element: <SprintFormPage /> },
          // La pantalla se llamaba "Actividades".
          { path: '/activities/*', element: <Navigate to="/sprints" replace /> },
          { path: '/notes', element: <NotesPage /> },
          { path: '/people', element: <PeoplePage /> },
          { path: '/profile', element: <ProfilePage /> },
          {
            element: <RequireAdmin />,
            children: [{ path: '/admin/users', element: <AdminUsersPage /> }],
          },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
])
