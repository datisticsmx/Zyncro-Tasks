import process from 'node:process'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      // El front y la API comparten origen: la cookie de sesión (SameSite=Lax,
      // Path=/api/zyncro) solo viaja así. En producción lo hace un rewrite.
      proxy: {
        '/api/zyncro': {
          target: env.ZYNCRO_API_TARGET || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  }
})
