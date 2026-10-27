import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { getVersion, LATEST_VERSION, migrate } from './migrations'
import { Repo } from './repo'
import { seedReferenceData } from './seed'
import { SyncEngine } from '@shared/sync/engine'

export interface OpenResult {
  repo: Repo
  created: boolean
  applied: number[]
  previousVersion: number
}

/** Opens (or creates) the database file, applies migrations and seeds reference data on first run. */
export function openDatabase(file: string, beforeMigrate?: (fromVersion: number) => void): OpenResult {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const created = !fs.existsSync(file)
  const db = new Database(file)
  try {
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    db.pragma('synchronous = NORMAL')
    const previousVersion = getVersion(db)
    if (previousVersion > 0 && previousVersion < LATEST_VERSION && beforeMigrate) beforeMigrate(previousVersion)
    const applied = migrate(db)
    const repo = new Repo(db)
    if (previousVersion === 0) {
      seedReferenceData(repo)
      SyncEngine.markAllClean(db)
    }
    return { repo, created, applied, previousVersion }
  } catch (e) {
    db.close()
    throw e
  }
}

/**
 * Checks that a file is a valid RxDesk database that this version can open.
 * Returns its schema version or throws.
 */
export function inspectDatabaseFile(file: string): { version: number; patients: number; prescriptions: number } {
  const db = new Database(file, { readonly: true, fileMustExist: true })
  try {
    const integrity = db.pragma('quick_check', { simple: true })
    if (integrity !== 'ok') throw new Error('The backup file is damaged')
    const version = getVersion(db)
    if (version < 1) throw new Error('This file is not an RxDesk backup')
    if (version > LATEST_VERSION) throw new Error('This backup was made by a newer RxDesk version. Please update first.')
    const count = (t: string) => (db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get() as { c: number }).c
    return { version, patients: count('patients'), prescriptions: count('prescriptions') }
  } finally {
    db.close()
  }
}
