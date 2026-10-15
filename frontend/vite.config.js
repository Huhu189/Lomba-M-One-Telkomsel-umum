
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import compression from 'vite-plugin-compression'

export default defineConfig({
  plugins: [
    react(),
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024,
      deleteOriginFile: false,
    }),
  ],

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: false,
      },
      '/sanctum': {
        target: 'http://localhost:8000',
        changeOrigin: false,
      },
      '/sse': {
        target: 'http://localhost:4000',
      },
    },
  },

  test: {
    environment: 'node',
  },
})
