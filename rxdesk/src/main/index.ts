import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import path from 'path'
import { UNLOCKED_METHODS } from '@shared/api'
import type { IpcResult } from '@shared/types'
import { handlers } from './handlers'
import { initLogger, log } from './logger'
import { openMainDatabase, runAutoBackup, state } from './state'
import { noteLocalChange, startSync } from './sync/service'

// Keep all data in %APPDATA%\RxDesk (never inside the install folder) so it
// survives updates and reinstalls.
app.setName('RxDesk')
if (process.env.RXDESK_DATA_DIR) app.setPath('userData', process.env.RXDESK_DATA_DIR)
else app.setPath('userData', path.join(app.getPath('appData'), 'RxDesk'))
if (process.platform === 'win32') app.setAppUserModelId('com.rxdesk.app')
// Date pickers show day/month/year (as clinics in the region expect), whatever the Windows locale.
app.commandLine.appendSwitch('lang', 'en-GB')

state.dataDir = app.getPath('userData')
state.dbPath = path.join(state.dataDir, 'rxdesk.db')
initLogger(path.join(state.dataDir, 'logs'))
log.info(`RxDesk ${app.getVersion()} starting`, { platform: process.platform, electron: process.versions.electron })

process.on('uncaughtException', (e) => log.error('Uncaught exception', e))
process.on('unhandledRejection', (e) => log.error('Unhandled rejection', e))

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const w = state.mainWindow
    if (w) {
      if (w.isMinimized()) w.restore()
      w.focus()
    }
  })
  app.whenReady().then(start)
}

function friendlyCode(e: unknown): string {
  const err = e as { code?: string; message?: string }
  if (err?.code && /^[A-Z_]+$/.test(err.code)) return err.code
  if (/SQLITE_BUSY|SQLITE_LOCKED/.test(err?.message ?? '')) return 'DB_BUSY'
  if (/SQLITE_/.test(err?.code ?? '')) return 'DB_ERROR'
  return 'UNKNOWN'
}

function registerIpc(): void {
  ipcMain.handle('api', async (event, method: string, args: unknown[]): Promise<IpcResult<unknown>> => {
    if (event.sender !== state.mainWindow?.webContents) return { ok: false, code: 'FORBIDDEN', message: 'Forbidden' }
    const [ns, fn] = String(method).split('.')
    const impl = (handlers as any)[ns]?.[fn]
    if (typeof impl !== 'function') return { ok: false, code: 'UNKNOWN_METHOD', message: method }
    if (state.locked && !UNLOCKED_METHODS.has(method)) return { ok: false, code: 'LOCKED', message: 'Locked' }
    if (!state.repo) return { ok: false, code: 'DB_ERROR', message: 'Database is not available' }
    try {
      const data = await impl(...(Array.isArray(args) ? args : []))
      if (ns !== 'sync') noteLocalChange()
      return { ok: true, data }
    } catch (e) {
      const code = friendlyCode(e)
      log.error(`API ${method} failed`, e)
      return { ok: false, code, message: (e as Error)?.message ?? String(e) }
    }
  })
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    title: 'RxDesk',
    backgroundColor: '#f4f6f9',
    icon: path.join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  })
  state.mainWindow = win
  win.once('ready-to-show', () => {
    win.maximize()
    win.show()
  })
  // Never open other windows or navigate away from the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url).catch(() => undefined)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(process.env.ELECTRON_RENDERER_URL ?? 'file://')) e.preventDefault()
  })
  win.webContents.on('render-process-gone', (_e, details) => log.error('Renderer process gone', details))
  win.webContents.on('before-input-event', (event, input) => {
    // Developer tools only in development (F12).
    if (input.type === 'keyDown' && input.key === 'F12' && !app.isPackaged) {
      win.webContents.toggleDevTools()
      event.preventDefault()
    }
  })
  win.on('closed', () => {
    state.mainWindow = null
  })

  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(path.join(__dirname, '../renderer/index.html'))
  return win
}

async function start(): Promise<void> {
  Menu.setApplicationMenu(null)
  try {
    openMainDatabase()
  } catch (e) {
    log.error('Could not open the database', e)
    const tooNew = (e as { code?: string }).code === 'DB_TOO_NEW'
    const choice = dialog.showMessageBoxSync({
      type: 'error',
      title: 'RxDesk',
      message: tooNew
        ? 'هذه البيانات تم إنشاؤها بإصدار أحدث من البرنامج. برجاء تحديث RxDesk.\n\nThis data was created by a newer version of RxDesk. Please update the app.'
        : 'تعذر فتح قاعدة البيانات.\n\nRxDesk could not open its database.',
      detail: `${(e as Error).message}\n\n${state.dbPath}`,
      buttons: ['Open data folder / فتح مجلد البيانات', 'Close / إغلاق'],
      defaultId: 1
    })
    if (choice === 0) await shell.openPath(state.dataDir)
    app.quit()
    return
  }
  registerIpc()
  createWindow()

  // Daily automatic backup: shortly after start, then check every hour.
  setTimeout(() => void runAutoBackup(), 15_000)
  setInterval(() => void runAutoBackup(), 60 * 60 * 1000)
  // Online sync (only does something after the doctor signed in).
  startSync()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}

app.on('window-all-closed', () => {
  try {
    state.repo?.db.close()
  } catch {
    /* ignore */
  }
  app.quit()
})
