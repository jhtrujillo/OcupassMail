import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: '../public',
    emptyOutDir: true
  },
  server: {
    proxy: {
      '/backend/api': {
        target: 'http://localhost:8888/22.advantagewebmail',
        changeOrigin: true
      }
    }
  }
})
