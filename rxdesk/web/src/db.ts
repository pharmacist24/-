import type { SqlJsStatic } from 'sql.js'
import { migrate } from '../../src/main/db/migrations'
import { Repo } from '../../src/main/db/repo'
import { seedReferenceData } from '../../src/main/db/seed'
import { SyncEngine, type SqlDb } from '@shared/sync/engine'
import { BrowserSqlite } from './sqlite'

/** A fresh in-memory clinic database with the same schema as the desktop app. */
export function createBrowserRepo(SQL: SqlJsStatic): Repo {
  const db = new BrowserSqlite(new SQL.Database())
  db.pragma('foreign_keys = ON')
  migrate(db as never)
  const repo = new Repo(db as never)
  seedReferenceData(repo)
  SyncEngine.markAllClean(db as unknown as SqlDb)
  return repo
}
