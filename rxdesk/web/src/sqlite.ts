// A small better-sqlite3-compatible wrapper over sql.js (SQLite compiled to WebAssembly), so the
// desktop Repo, migrations and sync engine run unchanged in the browser.
import type { Database as SqlJsDatabase, SqlValue } from 'sql.js'

type Params = unknown[]

function bindable(params: Params): SqlValue[] | Record<string, SqlValue> {
  const conv = (v: unknown): SqlValue => {
    if (v === undefined || v === null) return null
    if (typeof v === 'boolean') return v ? 1 : 0
    if (typeof v === 'bigint') return Number(v)
    return v as SqlValue
  }
  if (params.length === 1 && params[0] && typeof params[0] === 'object' && !Array.isArray(params[0]) && !(params[0] instanceof Uint8Array)) {
    const o = params[0] as Record<string, unknown>
    const out: Record<string, SqlValue> = {}
    for (const [k, v] of Object.entries(o)) {
      out['@' + k] = conv(v)
      out[':' + k] = conv(v)
      out['$' + k] = conv(v)
    }
    return out
  }
  return params.map(conv)
}

class Statement {
  constructor(
    private owner: BrowserSqlite,
    private sql: string
  ) {}

  private exec<T>(params: Params, fn: (st: ReturnType<SqlJsDatabase['prepare']>) => T): T {
    const st = this.owner.raw.prepare(this.sql)
    try {
      const b = bindable(params)
      // sql.js ignores named parameters that the statement does not use.
      if (!Array.isArray(b) || b.length) st.bind(b)
      return fn(st)
    } finally {
      st.free()
    }
  }

  run(...params: Params): { changes: number; lastInsertRowid: number } {
    return this.exec(params, (st) => {
      st.step()
      const changes = this.owner.raw.getRowsModified()
      const r = this.owner.raw.exec('SELECT last_insert_rowid()')
      return { changes, lastInsertRowid: Number(r[0]?.values[0]?.[0] ?? 0) }
    })
  }

  get(...params: Params): Record<string, unknown> | undefined {
    return this.exec(params, (st) => (st.step() ? (st.getAsObject() as Record<string, unknown>) : undefined))
  }

  all(...params: Params): Record<string, unknown>[] {
    return this.exec(params, (st) => {
      const out: Record<string, unknown>[] = []
      while (st.step()) out.push(st.getAsObject() as Record<string, unknown>)
      return out
    })
  }
}

export class BrowserSqlite {
  private depth = 0

  constructor(public raw: SqlJsDatabase) {}

  prepare(sql: string): Statement {
    return new Statement(this, sql)
  }

  exec(sql: string): this {
    this.raw.exec(sql)
    return this
  }

  pragma(source: string, opts: { simple?: boolean } = {}): unknown {
    const res = this.raw.exec(`PRAGMA ${source}`)
    if (!res.length) return opts.simple ? undefined : []
    const { columns, values } = res[0]
    if (opts.simple) return values[0]?.[0]
    return values.map((v) => Object.fromEntries(columns.map((c, i) => [c, v[i]])))
  }

  /** Same semantics as better-sqlite3: nested calls use savepoints. */
  transaction<A extends unknown[], T>(fn: (...args: A) => T): (...args: A) => T {
    return (...args: A) => {
      const sp = `sp${this.depth}`
      this.raw.exec(this.depth === 0 ? 'BEGIN' : `SAVEPOINT ${sp}`)
      this.depth++
      try {
        const out = fn(...args)
        this.depth--
        this.raw.exec(this.depth === 0 ? 'COMMIT' : `RELEASE ${sp}`)
        return out
      } catch (e) {
        this.depth--
        this.raw.exec(this.depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${sp}; RELEASE ${sp}`)
        throw e
      }
    }
  }

  close(): void {
    this.raw.close()
  }
}
