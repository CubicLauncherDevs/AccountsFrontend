import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_AUTH_API_URL || 'https://auth.cubiclauncher.org'
  return {
    plugins: [vue(), vueDevTools()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api(?=\/|$)/, ''),
          configure(proxy) {
            // The dev server makes a server-to-server request; the browser stays
            // on localhost. Production still uses the Worker's exact CORS allowlist.
            proxy.on('proxyReq', (request) => {
              request.removeHeader('origin')
            })
          },
        },
      },
    },
  }
})
