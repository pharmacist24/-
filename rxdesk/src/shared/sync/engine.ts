// Offline-first sync between the local SQLite database and the online copy.
// No Electron or Node imports: the desktop main process, the admin web app (SQLite in the browser)
// and the unit tests all use this file.
//
// One sync round:
//   1. pull   - download every online change since the last cursor and apply it locally
//               (newest edit wins when the same record was changed on both sides)
//   2. settings - three-way merge of the shared settings (per group)
//   3. push   - upload local changes (dirty rows) and deletions
import { SHARED_APP_SETTINGS, SYNC_COLUMNS, SYNC_TABLES, type SyncTableSpec } from './schema'

export interface SqlStatement {
  run(...params: unknown[]): { changes: number }
  get(...params: unknown[]): unknown
  all(...params: unknown[]): unknown[]
}

/** The subset of better-sqlite3 the engine needs (also implemented over sql.js in the web app). */
export interface SqlDb {
  prepare(sql: string): SqlStatement
  exec(sql: string): void
  transaction<T>(fn: () => T): () => T
}

export interface RemoteRow {
  tbl: string
  uid: string
  data: Record<string, unknown>
  deleted: boolean
  updated_at: string
  updated_by: string
  seq?: number
}

/** The online side. SupabaseRemote implements it; tests use an in-memory fake. */
export interface Remote {
  /** Rows of this clinic with seq > since, ordered by seq. */
  pull(since: number, limit: number): Promise<RemoteRow[]>
  /** Upsert rows (an older updated_at never replaces a newer one). */
  push(rows: RemoteRow[]): Promise<void>
}

export interface SyncResult {
  pulled: number
  pushed: number
  skipped: number
  settingsChanged: boolean
  /** True when downloaded rows changed the local data (screens should refresh). */
  localChanged: boolean
}

type Row = Record<string, any>

const PAGE = 1000
const SETTINGS_TBL = 'settings'
const SETTINGS_UID = 'settings'

function time(iso: string | undefined | null): number {
  const t = Date.parse(iso ?? '')
  return isNaN(t) ? 0 : t
}

function iso(t: string): string {
  const n = time(t)
  return n ? new Date(n).toISOString() : new Date().toISOString()
}

/** JSON with sorted keys, for comparing values. */
export function stableJson(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(stableJson).join(',') + ']'
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return '{' + Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + stableJson(o[k])).join(',') + '}'
  }
  return JSON.stringify(v ?? null)
}

const same = (a: unknown, b: unknown) => stableJson(a) === stableJson(b)

function chunks<T>(items: T[], maxCount: number, maxBytes: number): T[][] {
  const out: T[][] = []
  let cur: T[] = []
  let size = 0
  for (const it of items) {
    const s = JSON.stringify(it).length
    if (cur.length && (cur.length >= maxCount || size + s > maxBytes)) {
      out.push(cur)
      cur = []
      size = 0
    }
    cur.push(it)
    size += s
  }
  if (cur.length) out.push(cur)
  return out
}

export class SyncEngine {
  private running: Promise<SyncResult> | null = null
  private columnsCache = new Map<string, string[]>()

  constructor(
    private db: SqlDb,
    private remote: Remote,
    private deviceId: string,
    /** false for the admin web app: its starter data is never uploaded into a clinic. */
    private uploadStarterData = true
  ) {}

  // ------------------------------------------------------------------ state
  static getState(db: SqlDb, key: string): string | null {
    const r = db.prepare('SELECT value FROM sync_state WHERE key = ?').get(key) as Row | undefined
    return r ? (r.value as string) : null
  }

  static setState(db: SqlDb, key: string, value: string | null): void {
    if (value === null) db.prepare('DELETE FROM sync_state WHERE key = ?').run(key)
    else db.prepare('INSERT INTO sync_state(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
  }

  /**
   * Called when a clinic is linked. Linking the PC to a different clinic than before starts over:
   * everything local is uploaded to the new clinic and its data downloaded.
   */
  static bindClinic(db: SqlDb, clinicId: string): void {
    const prev = SyncEngine.getState(db, 'clinic_id')
    if (prev === clinicId) return
    db.transaction(() => {
      if (prev) {
        for (const t of SYNC_TABLES) db.prepare(`UPDATE ${t.name} SET dirty = 1 WHERE uid IS NOT NULL`).run()
        db.prepare('DELETE FROM sync_deletes').run()
      }
      SyncEngine.setState(db, 'cursor', '0')
      SyncEngine.setState(db, 'settings_base', null)
      SyncEngine.setState(db, 'clinic_id', clinicId)
    })()
  }

  /**
   * Starter data of a new database (sample drugs, layouts, phrases) is not marked for upload:
   * on first sync it is uploaded only if the clinic has nothing online yet, otherwise it is replaced
   * by the clinic's online data.
   */
  static markAllClean(db: SqlDb): void {
    db.transaction(() => {
      db.prepare('INSERT INTO sync_apply(x) VALUES(1)').run()
      for (const t of SYNC_TABLES) db.prepare(`UPDATE ${t.name} SET dirty = 0`).run()
      db.prepare('DELETE FROM sync_apply').run()
    })()
  }

  /**
   * First sync: a brand-new clinic receives this PC's starter data; an empty PC joining a clinic
   * that already has data drops its starter data and takes the clinic's.
   */
  private prepareFirst(mode: 'upload' | 'drop'): void {
    const db = this.db
    db.transaction(() => {
      db.prepare('INSERT INTO sync_apply(x) VALUES(1)').run()
      for (const t of SYNC_TABLES) {
        const builtin = t.name === 'conditions' ? ' AND NOT (is_builtin = 1 AND hidden = 0)' : ''
        if (mode === 'drop') db.prepare(`DELETE FROM ${t.name} WHERE dirty = 0${builtin}`).run()
        else db.prepare(`UPDATE ${t.name} SET dirty = 1 WHERE dirty = 0${builtin}`).run()
      }
      db.prepare('DELETE FROM sync_apply').run()
    })()
  }

  /** Number of local changes waiting to be uploaded. */
  static pendingCount(db: SqlDb): number {
    let n = (db.prepare('SELECT COUNT(*) AS c FROM sync_deletes').get() as Row).c as number
    for (const t of SYNC_TABLES) n += (db.prepare(`SELECT COUNT(*) AS c FROM ${t.name} WHERE dirty > 0`).get() as Row).c as number
    return n
  }

  private columns(table: string): string[] {
    let c = this.columnsCache.get(table)
    if (!c) {
      c = (this.db.prepare(`PRAGMA table_info(${table})`).all() as Row[]).map((r) => r.name as string)
      this.columnsCache.set(table, c)
    }
    return c
  }

  /** Runs one sync round. Concurrent calls share the round in progress. */
  sync(): Promise<SyncResult> {
    if (!this.running) {
      this.running = this.round().finally(() => {
        this.running = null
      })
    }
    return this.running
  }

  private async round(): Promise<SyncResult> {
    const result: SyncResult = { pulled: 0, pushed: 0, skipped: 0, settingsChanged: false, localChanged: false }
    const cursor = Number(SyncEngine.getState(this.db, 'cursor') ?? '0') || 0
    // A PC with no patients that downloads a clinic for the first time takes the online copy as it is.
    const fresh = cursor === 0 && (this.db.prepare('SELECT COUNT(*) AS c FROM patients').get() as Row).c === 0

    // 1. pull
    const latest = new Map<string, RemoteRow>()
    let since = cursor
    for (;;) {
      const page = await this.remote.pull(since, PAGE)
      for (const r of page) latest.set(r.tbl + '\u0000' + r.uid, r)
      if (page.length) since = Math.max(since, ...page.map((r) => Number(r.seq ?? 0)))
      if (page.length < PAGE) break
    }
    const rows = [...latest.values()]
    if (cursor === 0) {
      const remoteEmpty = !rows.some((r) => r.tbl !== SETTINGS_TBL && !r.deleted)
      if (remoteEmpty && this.uploadStarterData) this.prepareFirst('upload')
      else if (fresh) this.prepareFirst('drop')
    }
    const remoteSettings = rows.find((r) => r.tbl === SETTINGS_TBL && r.uid === SETTINGS_UID)
    this.apply(rows.filter((r) => r.tbl !== SETTINGS_TBL), fresh, result)
    SyncEngine.setState(this.db, 'cursor', String(since))
    result.pulled = rows.length

    // 2. settings
    await this.syncSettings(remoteSettings, fresh, result)

    // 3. push
    result.pushed += await this.push()
    return result
  }

  // ------------------------------------------------------------------ pull
  private apply(rows: RemoteRow[], fresh: boolean, result: SyncResult): void {
    const order = new Map(SYNC_TABLES.map((t, i) => [t.name as string, i]))
    rows.sort((a, b) => (order.get(a.tbl) ?? 99) - (order.get(b.tbl) ?? 99) || Number(a.seq ?? 0) - Number(b.seq ?? 0))
    this.db.transaction(() => {
      this.db.prepare('INSERT INTO sync_apply(x) VALUES(1)').run()
      try {
        for (const r of rows) {
          const spec = SYNC_TABLES.find((t) => t.name === r.tbl)
          if (!spec) continue
          const changed = this.applyRow(spec, r, fresh)
          if (changed === 'skipped') result.skipped++
          else if (changed) result.localChanged = true
        }
      } finally {
        this.db.prepare('DELETE FROM sync_apply').run()
      }
    })()
  }

  /** Returns true if the local database changed, 'skipped' if the row could not be applied. */
  private applyRow(t: SyncTableSpec, r: RemoteRow, fresh: boolean): boolean | 'skipped' {
    const db = this.db
    const rTime = time(r.updated_at)
    const local = db.prepare(`SELECT id, dirty, changed_at FROM ${t.name} WHERE uid = ?`).get(r.uid) as Row | undefined
    const tomb = db.prepare('SELECT deleted_at FROM sync_deletes WHERE tbl = ? AND uid = ?').get(t.name, r.uid) as Row | undefined
    const localWins = (changedAt: string) => !fresh && time(changedAt) > rTime

    if (r.deleted) {
      if (tomb) db.prepare('DELETE FROM sync_deletes WHERE tbl = ? AND uid = ?').run(t.name, r.uid)
      if (!local) return false
      if (local.dirty > 0 && localWins(local.changed_at)) return false
      db.prepare(`DELETE FROM ${t.name} WHERE id = ?`).run(local.id)
      return true
    }

    if (tomb) {
      if (localWins(tomb.deleted_at) || time(tomb.deleted_at) === rTime) return false
      db.prepare('DELETE FROM sync_deletes WHERE tbl = ? AND uid = ?').run(t.name, r.uid)
    }
    if (local) {
      if (local.dirty > 0 && (localWins(local.changed_at) || time(local.changed_at) === rTime)) return false
      if (local.dirty === 0 && time(local.changed_at) === rTime) return false
    }

    // Build the column values.
    const cols = this.columns(t.name)
    const values: Row = {}
    for (const [k, v] of Object.entries(r.data ?? {})) {
      if (SYNC_COLUMNS.includes(k) || t.localOnly?.includes(k) || !cols.includes(k)) continue
      if (t.child && k === t.child.as) continue
      values[k] = v === null || v === undefined ? '' : typeof v === 'boolean' ? (v ? 1 : 0) : typeof v === 'object' ? JSON.stringify(v) : v
    }
    for (const ref of t.refs ?? []) {
      const target = db.prepare(`SELECT id FROM ${ref.table} WHERE uid = ?`).get(String(r.data?.[ref.as] ?? '')) as Row | undefined
      if (!target) return 'skipped'
      values[ref.column] = target.id
    }
    values.dirty = 0
    values.changed_at = iso(r.updated_at)

    let id: number
    if (local) {
      id = local.id
      this.update(t.name, id, values)
    } else {
      const twin = t.naturalKey ? this.findTwin(t, values[t.naturalKey.column]) : undefined
      if (twin) {
        // Same drug name / condition key created on two PCs: keep one record (the online one).
        id = twin.id
        if (twin.uid && twin.uid !== r.uid) {
          db.prepare('INSERT OR REPLACE INTO sync_deletes(tbl, uid, deleted_at) VALUES(?, ?, ?)').run(t.name, twin.uid, values.changed_at)
        }
        this.update(t.name, id, { ...values, uid: r.uid })
      } else {
        const all: Row = { ...values, uid: r.uid }
        const keys = Object.keys(all)
        const res = db.prepare(`INSERT INTO ${t.name}(${keys.join(', ')}) VALUES(${keys.map(() => '?').join(', ')})`).run(...keys.map((k) => all[k]))
        id = Number((res as unknown as { lastInsertRowid: number }).lastInsertRowid)
      }
    }

    if (t.child) this.writeChildren(t, id, r.data?.[t.child.as])
    if (t.exclusiveFlag && Number(values[t.exclusiveFlag]) === 1) {
      db.prepare(`UPDATE ${t.name} SET ${t.exclusiveFlag} = 0 WHERE id != ?`).run(id)
    }
    return true
  }

  private findTwin(t: SyncTableSpec, value: unknown): Row | undefined {
    if (value === undefined || value === '') return undefined
    const k = t.naturalKey!
    return this.db.prepare(`SELECT id, uid FROM ${t.name} WHERE ${k.column} = ?${k.nocase ? ' COLLATE NOCASE' : ''}`).get(value) as Row | undefined
  }

  private update(table: string, id: number, values: Row): void {
    const keys = Object.keys(values)
    this.db.prepare(`UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => values[k]), id)
  }

  private writeChildren(t: SyncTableSpec, parentId: number, items: unknown): void {
    const c = t.child!
    const cols = this.columns(c.table).filter((k) => k !== 'id' && k !== c.fk)
    this.db.prepare(`DELETE FROM ${c.table} WHERE ${c.fk} = ?`).run(parentId)
    if (!Array.isArray(items)) return
    items.forEach((raw, i) => {
      const it = (raw ?? {}) as Row
      const v: Row = { [c.fk]: parentId }
      for (const k of cols) {
        if (!(k in it)) continue
        const x = it[k]
        v[k] = x === null || x === undefined ? '' : typeof x === 'boolean' ? (x ? 1 : 0) : typeof x === 'object' ? JSON.stringify(x) : x
      }
      if (cols.includes('position') && v.position === undefined) v.position = i
      const keys = Object.keys(v)
      this.db.prepare(`INSERT INTO ${c.table}(${keys.join(', ')}) VALUES(${keys.map(() => '?').join(', ')})`).run(...keys.map((k) => v[k]))
    })
  }

  // ------------------------------------------------------------------ push
  /** The record sent online for a local row. */
  recordFor(t: SyncTableSpec, row: Row): Record<string, unknown> {
    const data: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row)) {
      if (SYNC_COLUMNS.includes(k) || t.localOnly?.includes(k)) continue
      if (t.refs?.some((r) => r.column === k)) continue
      data[k] = v
    }
    for (const ref of t.refs ?? []) {
      const target = this.db.prepare(`SELECT uid FROM ${ref.table} WHERE id = ?`).get(row[ref.column]) as Row | undefined
      data[ref.as] = target?.uid ?? ''
    }
    if (t.child) {
      const c = t.child
      data[c.as] = (this.db.prepare(`SELECT * FROM ${c.table} WHERE ${c.fk} = ? ORDER BY ${c.orderBy}`).all(row.id) as Row[]).map((it) => {
        const { id: _id, [c.fk]: _fk, ...rest } = it
        return rest
      })
    }
    return data
  }

  private async push(): Promise<number> {
    type Sent = { row: RemoteRow; table: string; dirty?: number; deletedAt?: string }
    const sent: Sent[] = []
    for (const t of SYNC_TABLES) {
      for (const row of this.db.prepare(`SELECT * FROM ${t.name} WHERE dirty > 0`).all() as Row[]) {
        sent.push({
          table: t.name,
          dirty: row.dirty,
          row: { tbl: t.name, uid: row.uid, data: this.recordFor(t, row), deleted: false, updated_at: iso(row.changed_at), updated_by: this.deviceId }
        })
      }
    }
    for (const d of this.db.prepare('SELECT tbl, uid, deleted_at FROM sync_deletes').all() as Row[]) {
      sent.push({
        table: d.tbl,
        deletedAt: d.deleted_at,
        row: { tbl: d.tbl, uid: d.uid, data: {}, deleted: true, updated_at: iso(d.deleted_at), updated_by: this.deviceId }
      })
    }
    // Deletions first, so a record deleted and re-created with the same uid ends up present.
    sent.sort((a, b) => Number(!a.row.deleted) - Number(!b.row.deleted))
    for (const batch of chunks(sent, 200, 1_500_000)) {
      await this.remote.push(batch.map((s) => s.row))
      // Clear the flags, but only for rows that did not change again while uploading.
      this.db.transaction(() => {
        this.db.prepare('INSERT INTO sync_apply(x) VALUES(1)').run()
        try {
          for (const s of batch) {
            if (s.deletedAt !== undefined) {
              this.db.prepare('DELETE FROM sync_deletes WHERE tbl = ? AND uid = ? AND deleted_at = ?').run(s.table, s.row.uid, s.deletedAt)
            } else {
              this.db.prepare(`UPDATE ${s.table} SET dirty = 0 WHERE uid = ? AND dirty = ?`).run(s.row.uid, s.dirty)
            }
          }
        } finally {
          this.db.prepare('DELETE FROM sync_apply').run()
        }
      })()
    }
    return sent.length
  }

  // ------------------------------------------------------------------ settings
  private readKey(key: string): Row {
    const r = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as Row | undefined
    try {
      return r ? (JSON.parse(r.value) ?? {}) : {}
    } catch {
      return {}
    }
  }

  private writeKey(key: string, value: unknown): void {
    this.db
      .prepare('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, JSON.stringify(value))
  }

  /** The shared part of the settings, split into groups that merge independently. */
  localSettings(): Record<string, unknown> {
    const app = this.readKey('app')
    const out: Record<string, unknown> = { profile: this.readKey('profile') }
    for (const k of SHARED_APP_SETTINGS) if (app[k] !== undefined) out[k] = app[k]
    return out
  }

  private async syncSettings(remoteRow: RemoteRow | undefined, fresh: boolean, result: SyncResult): Promise<void> {
    const local = this.localSettings()
    const baseRaw = SyncEngine.getState(this.db, 'settings_base')
    const base = baseRaw ? (JSON.parse(baseRaw) as Record<string, unknown>) : null
    const remote = remoteRow && !remoteRow.deleted ? remoteRow.data : null
    const groups = new Set([...Object.keys(local), ...Object.keys(remote ?? {}), ...Object.keys(base ?? {})])
    const merged: Record<string, unknown> = {}
    let needPush: boolean
    if (!base) {
      // First sync of this PC: the online settings win; with none online the PC's settings are uploaded.
      for (const g of groups) merged[g] = remote && g in remote ? remote[g] : local[g]
      // A PC that was never set up (e.g. the admin web app) does not upload its default settings.
      needPush = remote ? !same(merged, remote) : !!this.readKey('app').setupCompleted
    } else {
      for (const g of groups) {
        const b = base[g]
        const l = local[g]
        const r = remote ? remote[g] : b
        // Changed only here -> keep ours; changed online (or on both sides) -> take the online value.
        merged[g] = !same(l, b) && same(r, b) ? l : r
      }
      needPush = !same(merged, remote ?? base)
    }
    for (const g of Object.keys(merged)) if (merged[g] === undefined) delete merged[g]

    if (!same(merged, local)) {
      this.db.transaction(() => {
        const app = this.readKey('app')
        for (const k of SHARED_APP_SETTINGS) if (merged[k] !== undefined) app[k] = merged[k]
        if (fresh && remote && remote.profile) app.setupCompleted = true
        this.writeKey('app', app)
        if (merged.profile !== undefined) this.writeKey('profile', merged.profile)
      })()
      result.settingsChanged = true
      result.localChanged = true
    } else if (fresh && remote && remote.profile && !this.readKey('app').setupCompleted) {
      this.writeKey('app', { ...this.readKey('app'), setupCompleted: true })
      result.settingsChanged = true
    }
    if (needPush) {
      await this.remote.push([
        { tbl: SETTINGS_TBL, uid: SETTINGS_UID, data: merged, deleted: false, updated_at: new Date().toISOString(), updated_by: this.deviceId }
      ])
      result.pushed++
    }
    SyncEngine.setState(this.db, 'settings_base', stableJson(merged))
  }
}
