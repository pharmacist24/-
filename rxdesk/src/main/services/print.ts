import { app, BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'
import type { PrinterInfo, PrintOptions } from '@shared/types'
import { log } from '../logger'

// The renderer builds the final, fully paginated prescription HTML (fonts embedded,
// no scripts) using the shared layout engine. Here we only load that HTML into a
// hidden window and hand it to Chromium's printing / PDF pipeline, so the
// on-screen preview and the printed page come from exactly the same document.

async function loadHidden(html: string): Promise<{ win: BrowserWindow; cleanup: () => void }> {
  const dir = path.join(app.getPath('temp'), 'rxdesk-print')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `rx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.html`)
  fs.writeFileSync(file, html, 'utf8')
  const win = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: true }
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (e) => e.preventDefault())
  const cleanup = () => {
    if (!win.isDestroyed()) win.destroy()
    fs.rm(file, { force: true }, () => undefined)
  }
  try {
    await win.loadFile(file)
    // Wait until the embedded fonts are decoded so nothing prints in a fallback font.
    await win.webContents.executeJavaScript('document.fonts.ready.then(() => document.fonts.size)', true)
    await new Promise((r) => setTimeout(r, 50))
    return { win, cleanup }
  } catch (e) {
    cleanup()
    throw e
  }
}

export async function listPrinters(win: BrowserWindow): Promise<PrinterInfo[]> {
  const printers = await win.webContents.getPrintersAsync()
  return printers.map((p) => ({
    name: p.name,
    displayName: p.displayName || p.name,
    isDefault: !!(p as unknown as { isDefault?: boolean }).isDefault || (p.options as Record<string, string> | undefined)?.['printer-is-default'] === 'true'
  }))
}

export async function printHtml(html: string, opts: PrintOptions): Promise<void> {
  const { win, cleanup } = await loadHidden(html)
  try {
    await new Promise<void>((resolve, reject) => {
      win.webContents.print(
        {
          silent: opts.silent,
          printBackground: true,
          deviceName: opts.deviceName || undefined,
          copies: Math.max(1, opts.copies ?? 1),
          margins: { marginType: 'none' },
          // Chromium expects microns.
          pageSize: { width: Math.round(opts.widthMm * 1000), height: Math.round(opts.heightMm * 1000) }
        },
        (success, reason) => {
          if (success) resolve()
          else if (reason === 'cancelled' || reason === 'Print job canceled') {
            resolve()
          } else {
            reject(Object.assign(new Error(reason || 'Printing failed'), { code: 'PRINT_FAILED' }))
          }
        }
      )
    })
    log.info('Printed', { silent: opts.silent, printer: opts.deviceName || '(default)', copies: opts.copies })
  } finally {
    // Give the spooler a moment before destroying the window.
    setTimeout(cleanup, 1500)
  }
}

export async function htmlToPdf(html: string, opts: PrintOptions): Promise<Buffer> {
  const { win, cleanup } = await loadHidden(html)
  try {
    return await win.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      // Electron expects inches here.
      pageSize: { width: opts.widthMm / 25.4, height: opts.heightMm / 25.4 }
    })
  } finally {
    cleanup()
  }
}
