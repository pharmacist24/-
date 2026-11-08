// Windows 7 build: the same source as the main app (../src), packaged with Electron 22,
// the last Electron that runs on Windows 7. See DECISIONS.md.
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const src = resolve(__dirname, '../src')
const shared = resolve(src, 'shared')
const win7 = { 'import.meta.env.VITE_RXDESK_WIN7': JSON.stringify('1') }

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': shared } },
    define: win7,
    build: { outDir: resolve(__dirname, 'out/main'), rollupOptions: { input: resolve(src, 'main/index.ts') } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': shared } },
    build: { outDir: resolve(__dirname, 'out/preload'), rollupOptions: { input: resolve(src, 'preload/index.ts') } }
  },
  renderer: {
    root: resolve(src, 'renderer'),
    resolve: { alias: { '@renderer': resolve(src, 'renderer/src'), '@shared': shared } },
    plugins: [react()],
    define: win7,
    build: {
      outDir: resolve(__dirname, 'out/renderer'),
      chunkSizeWarningLimit: 4000,
      rollupOptions: { input: resolve(src, 'renderer/index.html') }
    }
  }
})
