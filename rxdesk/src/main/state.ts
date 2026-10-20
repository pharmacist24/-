import { app, BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'
import type { Repo } from './db/repo'
import { openDatabase } from './db/database'
import { autoBackupName, createBackup, pruneAutoBackups, manualBackupName } from './services/backup'
import { log } from './logger'
import type { BackupInfo } from '@shared/types'
import { todayIso } from '@shared/text'

export const state: {
  dataDir: string
  dbPath: string
  repo: Repo | null
  mainWindow: BrowserWindow | null
  locked: boolean
} = { dataDir: '', dbPath: '', repo: null, mainWindow: null, locked: false }

export function defaultBackupFolder(): string {
  return path.join(state.dataDir, 'backups')
}

export function autoBackupFolder(): string {
  const configured = state.repo?.getSettings().autoBackup.folder
  return configured || defaultBackupFolder()
}

/** Opens the database, making a safety copy before any schema upgrade. */
export function openMainDatabase(): void {
  const result = openDatabase(state.dbPath, (fromVersion) => {
    const dest = path.join(defaultBackupFolder(), `pre-upgrade-v${fromVersion}-${Date.now()}.db`)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(state.dbPath, dest)
    log.info('Saved a copy of the database before upgrading it', dest)
  })
  state.repo = result.repo
  if (result.applied.length) log.info('Applied database migrations', result.applied)
  state.locked = result.repo.getSettings().pinEnabled
}

/** Replaces the live database with a validated file (used by restore). */
export async function replaceDatabase(candidate: string): Promise<void> {
  // Always keep a copy of the current data first.
  if (state.repo) {
    const safety = path.join(defaultBackupFolder(), 'before-restore-' + manualBackupName())
    await createBackup(state.repo, safety, app.getVersion())
    log.info('Safety backup before restore', safety)
    state.repo.db.close()
    state.repo = null
  }
  for (const ext of ['-wal', '-shm']) fs.rmSync(state.dbPath + ext, { force: true })
  fs.copyFileSync(candidate, state.dbPath)
  fs.rmSync(candidate, { force: true })
  openMainDatabase()
  state.locked = false
  state.mainWindow?.webContents.send('db-replaced')
}

let autoRunning = false

/** Daily automatic backup. Returns the created backup or null if nothing was done. */
export async function runAutoBackup(force = false): Promise<BackupInfo | null> {
  const repo = state.repo
  if (!repo || autoRunning) return null
  const settings = repo.getSettings()
  if (!force && (!settings.autoBackup.enabled || !settings.setupCompleted)) return null
  if (!force && settings.autoBackup.lastRunAt.slice(0, 10) === todayIso()) return null
  autoRunning = true
  try {
    let folder = autoBackupFolder()
    try {
      fs.mkdirSync(folder, { recursive: true })
      fs.accessSync(folder, fs.constants.W_OK)
    } catch {
      // e.g. the USB stick is not plugged in: fall back to the local folder so a backup still happens.
      log.warn('Backup folder not available, using default folder', folder)
      state.mainWindow?.webContents.send('backup-failed', { folder })
      folder = defaultBackupFolder()
    }
    const info = await createBackup(repo, path.join(folder, autoBackupName()), app.getVersion())
    pruneAutoBackups(folder, settings.autoBackup.keep)
    repo.updateSettings({ autoBackup: { ...settings.autoBackup, lastRunAt: todayIso() + 'T' + new Date().toTimeString().slice(0, 8) } })
    log.info('Automatic backup created', info.path)
    return info
  } catch (e) {
    log.error('Automatic backup failed', e)
    state.mainWindow?.webContents.send('backup-failed', { error: (e as Error).message })
    return null
  } finally {
    autoRunning = false
  }
}
