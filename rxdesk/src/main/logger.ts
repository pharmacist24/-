import fs from 'fs'
import path from 'path'

// Very small file logger: one text file, rotated when it grows past 2 MB.
let logFile = ''
const MAX_BYTES = 2 * 1024 * 1024

export function initLogger(dir: string): string {
  fs.mkdirSync(dir, { recursive: true })
  logFile = path.join(dir, 'rxdesk.log')
  try {
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > MAX_BYTES) {
      fs.renameSync(logFile, path.join(dir, 'rxdesk.old.log'))
    }
  } catch {
    /* ignore rotation problems */
  }
  return logFile
}

export function getLogFile(): string {
  return logFile
}

function write(level: string, parts: unknown[]): void {
  const text = parts
    .map((p) => (p instanceof Error ? `${p.message}\n${p.stack ?? ''}` : typeof p === 'string' ? p : safeJson(p)))
    .join(' ')
  const line = `${new Date().toISOString()} [${level}] ${text}\n`
  if (process.env.NODE_ENV !== 'production') process.stdout.write(line)
  if (!logFile) return
  try {
    fs.appendFileSync(logFile, line, 'utf8')
  } catch {
    /* the log must never crash the app */
  }
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

export const log = {
  info: (...p: unknown[]) => write('INFO', p),
  warn: (...p: unknown[]) => write('WARN', p),
  error: (...p: unknown[]) => write('ERROR', p)
}
