import { contextBridge, ipcRenderer } from 'electron'
import type { PreloadBridge } from '../shared/api'

// Only a single, narrow channel is exposed to the page.
const bridge: PreloadBridge = {
  invoke: (method, args) => ipcRenderer.invoke('api', method, args),
  on: (channel, listener) => {
    const allowed = ['db-replaced', 'backup-failed', 'locked']
    if (!allowed.includes(channel)) return () => undefined
    const fn = (_e: unknown, payload: unknown) => listener(payload)
    ipcRenderer.on(channel, fn)
    return () => ipcRenderer.removeListener(channel, fn)
  }
}

contextBridge.exposeInMainWorld('rxdesk', bridge)
