import { createBrowserRouter } from 'react-router'
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
          { path: '/projects/:key/tasks/:number', element: <ProjectWorkspace /> },
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
