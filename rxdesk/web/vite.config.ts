import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The admin web app. It reuses the desktop renderer screens (src/renderer) and shared code.
export default defineConfig({
  root: __dirname,
  envDir: __dirname,
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../src/shared'),
      '@renderer': resolve(__dirname, '../src/renderer/src')
    }
  },
  define: {
    'import.meta.env.VITE_RXDESK_WEB': JSON.stringify('1')
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000
  },
  server: { port: 5180 },
  preview: { port: 5181 }
})
