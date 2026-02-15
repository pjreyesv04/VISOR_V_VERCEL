import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const supabaseTarget =
    env.VITE_SUPABASE_URL || 'https://coxrhjgmjokqyjhmmhfx.supabase.co'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/supabase-proxy': {
          target: supabaseTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/supabase-proxy/, ''),
          ws: true,
        },
      },
    },
  }
})
