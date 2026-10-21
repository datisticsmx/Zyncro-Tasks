import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { router } from './router'
import { ME_KEY } from './lib/session'
import { ToastProvider } from './components/Toast'
import './index.css'
import './styles/projects.css'
import './styles/tasks.css'

const queryClient = new QueryClient({
  // Si cualquier consulta recibe 401 (sesión vencida o cerrada en otro lado),
  // se limpia el usuario y RequireAuth manda a /login.
  queryCache: new QueryCache({
    onError: (err, query) => {
      if (err.status === 401 && query.queryKey[0] !== ME_KEY[0]) queryClient.setQueryData(ME_KEY, null)
    },
  }),
  defaultOptions: {
    queries: {
      retry: (count, err) => err.status >= 500 && count < 2,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
)
