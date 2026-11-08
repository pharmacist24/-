// Start-up safety: RxDesk must never "install but not open" without telling the user why.
//  - Graphics safe mode: some PCs (old or broken graphics drivers, and the Windows 7 build's older Chromium on
//    new Windows) crash Chromium's GPU or page process at start. Then RxDesk restarts itself with graphics
//    acceleration turned off and remembers that choice for this PC (file `safe-graphics` in the data folder).
//  - Any start-up error is shown in a dialog and written to `startup-error.txt` in the data folder.
import { app, dialog, shell } from 'electron'
import fs from 'fs'
import os from 'os'
import path from 'path'

const WIN7_BUILD = import.meta.env.VITE_RXDESK_WIN7 === '1'
let safe = false
let windowShown = false

const flagFile = () => path.join(app.getPath('userData'), 'safe-graphics')

function windowsMajor(): number {
  return process.platform === 'win32' ? Number(os.release().split('.')[0]) || 0 : 0
}

/** Must run before the app is ready (after userData is set). */
export function applyGraphicsMode(): void {
  // The Windows 7 build (Electron 22) crashes its GPU/page process on current Windows: start it safe there.
  const win7BuildOnNewWindows = WIN7_BUILD && windowsMajor() >= 10
  safe = win7BuildOnNewWindows || process.argv.includes('--safe-graphics') || fs.existsSync(flagFile())
  if (!safe) return
  app.disableHardwareAcceleration()
  app.commandLine.appendSwitch('disable-gpu')
  app.commandLine.appendSwitch('disable-gpu-compositing')
  if (WIN7_BUILD && windowsMajor() >= 10) app.commandLine.appendSwitch('no-sandbox')
}

export function isSafeGraphics(): boolean {
  return safe
}

export function markWindowShown(): void {
  windowShown = true
}

/**
 * Called when the GPU or page process crashes. Before the window has been shown (or in normal mode) this switches
 * to graphics safe mode and restarts RxDesk. Returns false if already in safe mode (the caller shows an error).
 */
export function restartInSafeGraphics(reason: string, log: (msg: string, extra?: unknown) => void): boolean {
  if (safe) return false
  try {
    fs.mkdirSync(path.dirname(flagFile()), { recursive: true })
    fs.writeFileSync(flagFile(), `${new Date().toISOString()} ${reason}\n`)
  } catch {
    /* still restart with the command-line switch */
  }
  log('Graphics problem: restarting in safe graphics mode', reason)
  const args = process.argv.slice(1).filter((a) => a !== '--safe-graphics')
  app.relaunch({ args: [...args, '--safe-graphics'] })
  app.exit(0)
  return true
}

/** Shows a start-up error to the user and writes it next to the data so it can be sent to support. */
export function reportStartupError(title: string, err: unknown): void {
  const message = (err as Error)?.stack ?? String(err)
  let file = ''
  try {
    file = path.join(app.getPath('userData'), 'startup-error.txt')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, `${new Date().toISOString()}\nRxDesk ${app.getVersion()} (Electron ${process.versions.electron}, Windows ${os.release()})\n${title}\n\n${message}\n`)
  } catch {
    file = ''
  }
  try {
    const choice = dialog.showMessageBoxSync({
      type: 'error',
      title: 'RxDesk',
      message: `تعذر تشغيل RxDesk.\nRxDesk could not start.\n\n${title}`,
      detail: `${(err as Error)?.message ?? String(err)}${file ? `\n\n${file}` : ''}`,
      buttons: ['Open data folder / فتح مجلد البيانات', 'Close / إغلاق'],
      defaultId: 1
    })
    if (choice === 0) void shell.openPath(app.getPath('userData'))
  } catch {
    /* no UI available */
  }
}

export function wasWindowShown(): boolean {
  return windowShown
}
