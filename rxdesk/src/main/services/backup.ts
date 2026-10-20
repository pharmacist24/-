import fs from 'fs'
import path from 'path'
import JSZip from 'jszip'
import type { Repo } from '../db/repo'
import { getVersion } from '../db/migrations'
import { inspectDatabaseFile } from '../db/database'
import type { BackupInfo } from '@shared/types'

// Backup files are .zip archives containing a consistent copy of the database
// (made with SQLite's online backup API) plus a small manifest.

export const AUTO_PREFIX = 'RxDesk-auto-'

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`
}

export function manualBackupName(d = new Date()): string {
  return `RxDesk-backup-${stamp(d)}.zip`
}

export function autoBackupName(d = new Date()): string {
  return `${AUTO_PREFIX}${stamp(d)}.zip`
}

export async function createBackup(repo: Repo, destFile: string, appVersion: string): Promise<BackupInfo> {
  const tmp = destFile + '.tmp-db'
  fs.mkdirSync(path.dirname(destFile), { recursive: true })
  try {
    await repo.db.backup(tmp)
    const zip = new JSZip()
    const counts = {
      patients: (repo.db.prepare('SELECT COUNT(*) AS c FROM patients').get() as { c: number }).c,
      prescriptions: (repo.db.prepare('SELECT COUNT(*) AS c FROM prescriptions').get() as { c: number }).c
    }
    const createdAt = new Date().toISOString()
    zip.file(
      'manifest.json',
      JSON.stringify({ app: 'RxDesk', appVersion, schemaVersion: getVersion(repo.db), createdAt, ...counts }, null, 2)
    )
    zip.file('rxdesk.db', fs.readFileSync(tmp))
    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })
    // Write to a temp name first so a half-written file never looks like a valid backup.
    fs.writeFileSync(destFile + '.partial', buf)
    fs.renameSync(destFile + '.partial', destFile)
    return { path: destFile, sizeBytes: buf.length, createdAt }
  } finally {
    fs.rmSync(tmp, { force: true })
  }
}

/** Extracts the database from a .zip backup (or copies a raw .db) into workDir and validates it. */
export async function prepareRestore(
  file: string,
  workDir: string
): Promise<{ dbPath: string; version: number; patients: number; prescriptions: number; createdAt: string }> {
  fs.mkdirSync(workDir, { recursive: true })
  const dbPath = path.join(workDir, 'restore-candidate.db')
  fs.rmSync(dbPath, { force: true })
  let createdAt = ''
  const head = Buffer.alloc(4)
  const fd = fs.openSync(file, 'r')
  fs.readSync(fd, head, 0, 4, 0)
  fs.closeSync(fd)
  if (head.toString('binary') === 'PK\u0003\u0004') {
    const zip = await JSZip.loadAsync(fs.readFileSync(file))
    const entry = zip.file('rxdesk.db')
    if (!entry) throw Object.assign(new Error('This zip file is not an RxDesk backup'), { code: 'BAD_BACKUP' })
    fs.writeFileSync(dbPath, await entry.async('nodebuffer'))
    try {
      createdAt = JSON.parse((await zip.file('manifest.json')?.async('string')) ?? '{}').createdAt ?? ''
    } catch {
      /* manifest is optional */
    }
  } else {
    fs.copyFileSync(file, dbPath)
  }
  try {
    const info = inspectDatabaseFile(dbPath)
    return { dbPath, ...info, createdAt: createdAt || fs.statSync(file).mtime.toISOString() }
  } catch (e) {
    fs.rmSync(dbPath, { force: true })
    throw Object.assign(new Error((e as Error).message || 'Invalid backup file'), { code: 'BAD_BACKUP' })
  }
}

/** Lists automatic backups in a folder, newest first. */
export function listAutoBackups(folder: string): BackupInfo[] {
  if (!folder || !fs.existsSync(folder)) return []
  return fs
    .readdirSync(folder)
    .filter((f) => f.startsWith(AUTO_PREFIX) && f.endsWith('.zip'))
    .sort()
    .reverse()
    .map((f) => {
      const full = path.join(folder, f)
      const st = fs.statSync(full)
      return { path: full, sizeBytes: st.size, createdAt: st.mtime.toISOString() }
    })
}

/** Deletes the oldest automatic backups so only `keep` remain. Never touches other files. */
export function pruneAutoBackups(folder: string, keep: number): string[] {
  const all = listAutoBackups(folder)
  const removed: string[] = []
  for (const b of all.slice(Math.max(1, keep))) {
    fs.rmSync(b.path, { force: true })
    removed.push(b.path)
  }
  return removed
}
