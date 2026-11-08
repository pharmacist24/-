// Must stay first: gives the Windows 7 build (Node 16) the fetch API. No effect on newer Electron.
import './sync/polyfill'
import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import path from 'path'
import { UNLOCKED_METHODS } from '@shared/api'
import type { IpcResult } from '@shared/types'
import { handlers } from './handlers'
import { initLogger, log } from './logger'
import { openMainDatabase, runAutoBackup, state } from './state'
import { noteLocalChange, startSync } from './sync/service'
import { applyGraphicsMode, isSafeGraphics, markWindowShown, reportStartupError, restartInSafeGraphics, wasWindowShown } from './startup'

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
applyGraphicsMode()
log.info(`RxDesk ${app.getVersion()} starting`, {
  platform: process.platform,
  windows: process.platform === 'win32' ? require('os').release() : undefined,
  electron: process.versions.electron,
  arch: process.arch,
  safeGraphics: isSafeGraphics()
})

// Before the window is on screen, an error must never leave the user with nothing: show it and stop.
process.on('uncaughtException', (e) => {
  log.error('Uncaught exception', e)
  if (!wasWindowShown()) {
    reportStartupError('Unexpected error while starting', e)
    app.exit(1)
  }
})
process.on('unhandledRejection', (e) => log.error('Unhandled rejection', e))

// GPU process crashes (broken graphics drivers): restart once with graphics acceleration off.
app.on('child-process-gone', (_e, details) => {
  if (details.type !== 'GPU' || details.reason === 'clean-exit' || details.reason === 'killed') return
  log.error('GPU process gone', details)
  restartInSafeGraphics('GPU process ' + details.reason, (m, x) => log.warn(m, x))
})

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
  app.whenReady()
    .then(start)
    .catch((e) => {
      log.error('Start-up failed', e)
      reportStartupError('Start-up failed', e)
      app.exit(1)
    })
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
  const reveal = () => {
    if (win.isDestroyed() || win.isVisible()) return
    win.maximize()
    win.show()
    markWindowShown()
  }
  win.once('ready-to-show', reveal)
  // If the page never reports it is ready (slow PC, graphics trouble), show the window anyway.
  setTimeout(reveal, 10_000)
  // Never open other windows or navigate away from the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url).catch(() => undefined)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(process.env.ELECTRON_RENDERER_URL ?? 'file://')) e.preventDefault()
  })
  win.webContents.on('render-process-gone', (_e, details) => {
    log.error('Renderer process gone', details)
    if (details.reason === 'clean-exit' || win.isDestroyed()) return
    // Crashed before anything was shown: most often a graphics problem -> safe graphics mode.
    if (!wasWindowShown() && restartInSafeGraphics('page ' + details.reason, (m, x) => log.warn(m, x))) return
    const choice = dialog.showMessageBoxSync(win, {
      type: 'error',
      title: 'RxDesk',
      message: 'توقفت شاشة RxDesk بشكل غير متوقع. بياناتك محفوظة.\nThe RxDesk screen stopped unexpectedly. Your data is safe.',
      detail: `${details.reason} (${details.exitCode})`,
      buttons: ['Reload / إعادة التحميل', 'Close / إغلاق'],
      defaultId: 0
    })
    if (choice === 0) win.reload()
    else app.quit()
  })
  win.webContents.on('did-fail-load', (_e, code, description, url) => {
    log.error('Page failed to load', { code, description, url })
    reportStartupError('The app screen could not be loaded', new Error(`${description} (${code}) ${url}`))
  })
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
