// One open clinic in the admin web app: an in-browser copy of its database kept in sync with Supabase.
import initSqlJs, { type SqlJsStatic } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { SyncEngine, type SqlDb } from '@shared/sync/engine'
import { SupabaseRemote } from '@shared/sync/supabaseRemote'
import type { SyncStatus } from '@shared/types'
import type { Repo } from '../../src/main/db/repo'
import { createBrowserRepo } from './db'
import { supabase } from './cloud'
import { emit, setClinicRepo, setSyncStatusSource } from './bridge'

let sqlPromise: Promise<SqlJsStatic> | null = null
const sql = () => (sqlPromise ??= initSqlJs({ locateFile: () => wasmUrl }))

export type SaveState = 'idle' | 'saving' | 'error'

export class ClinicSession {
  repo!: Repo
  private engine!: SyncEngine
  private timer: ReturnType<typeof setTimeout> | null = null
  private poll: ReturnType<typeof setInterval> | null = null
  private dirty = false
  state: SaveState = 'idle'
  lastError = ''
  lastSyncAt = ''
  onState: (s: ClinicSession) => void = () => undefined

  constructor(
    public clinicId: string,
    public clinicName: string
  ) {}

  /** Downloads the clinic and makes it the target of every screen call. */
  async open(): Promise<void> {
    this.repo = createBrowserRepo(await sql())
    const db = this.repo.db as unknown as SqlDb
    SyncEngine.bindClinic(db, this.clinicId)
    this.engine = new SyncEngine(db, new SupabaseRemote(supabase, this.clinicId), 'web', false)
    await this.engine.sync()
    this.lastSyncAt = new Date().toISOString()
    setClinicRepo(this.repo, () => this.changed())
    setSyncStatusSource(() => this.status())
    // Pick up changes made on the clinic's PC while the page is open.
    this.poll = setInterval(() => void this.run(), 30_000)
  }

  close(): void {
    if (this.timer) clearTimeout(this.timer)
    if (this.poll) clearInterval(this.poll)
    setClinicRepo(null, () => undefined)
    try {
      this.repo?.db.close()
    } catch {
      /* ignore */
    }
  }

  /** True while changes are not yet online. */
  hasUnsaved(): boolean {
    return this.dirty || this.state === 'saving' || (this.repo ? SyncEngine.pendingCount(this.repo.db as unknown as SqlDb) > 0 : false)
  }

  status(): SyncStatus {
    return {
      signedIn: true,
      email: '',
      clinicName: this.clinicName,
      syncing: this.state === 'saving',
      online: navigator.onLine,
      lastSyncAt: this.lastSyncAt,
      lastError: this.lastError,
      pending: this.repo ? SyncEngine.pendingCount(this.repo.db as unknown as SqlDb) : 0
    }
  }

  private changed(): void {
    this.dirty = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.run(), 800)
  }

  async run(): Promise<void> {
    this.dirty = false
    this.state = 'saving'
    this.onState(this)
    try {
      const res = await this.engine.sync()
      this.state = 'idle'
      this.lastError = ''
      this.lastSyncAt = new Date().toISOString()
      if (res.localChanged) emit('sync-status', { ...this.status(), changed: true })
    } catch (e) {
      this.state = 'error'
      this.lastError = (e as Error).message
      // Retry a little later.
      if (this.timer) clearTimeout(this.timer)
      this.timer = setTimeout(() => void this.run(), 10_000)
    }
    this.onState(this)
  }
}
