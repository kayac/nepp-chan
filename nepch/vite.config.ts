import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: '.',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    watch: {
      ignored: ['**/e2etest/test-results/**', '**/local.db*'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:4112',
        changeOrigin: true,
      },
    },
  },
})
