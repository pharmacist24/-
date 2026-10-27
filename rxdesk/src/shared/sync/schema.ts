// Which local tables are synced and how. Used by the local migration (triggers) and the sync engine.

export type SyncTableName = 'patients' | 'drugs' | 'dose_phrases' | 'favorites' | 'conditions' | 'layouts' | 'prescriptions'

export interface SyncTableSpec {
  name: SyncTableName
  /** Columns that never leave the PC. */
  localOnly?: string[]
  /** Only changes to these columns mark the row for upload (default: any column). */
  watchColumns?: string[]
  /** A second unique column: a downloaded row with the same value takes over the local row. */
  naturalKey?: { column: string; nocase?: boolean }
  /** Integer links to other synced tables, sent as the other row's uid. */
  refs?: { column: string; table: SyncTableName; as: string }[]
  /** Child rows sent inside the parent record. */
  child?: { table: string; fk: string; as: string; orderBy: string }
  /** Only one row may have this flag set. */
  exclusiveFlag?: string
}

/** Order matters: rows are applied in this order (patients before their prescriptions). */
export const SYNC_TABLES: SyncTableSpec[] = [
  { name: 'patients' },
  {
    name: 'drugs',
    localOnly: ['use_count', 'last_used_at'],
    watchColumns: ['name', 'search_name', 'form', 'strength', 'dose', 'frequency', 'duration', 'route', 'instructions'],
    naturalKey: { column: 'name', nocase: true }
  },
  { name: 'dose_phrases' },
  { name: 'favorites' },
  {
    name: 'conditions',
    naturalKey: { column: 'key' },
    child: { table: 'condition_options', fk: 'condition_id', as: 'options', orderBy: 'position, id' }
  },
  { name: 'layouts', exclusiveFlag: 'is_default' },
  {
    name: 'prescriptions',
    refs: [{ column: 'patient_id', table: 'patients', as: 'patient_uid' }],
    child: { table: 'prescription_items', fk: 'prescription_id', as: 'items', orderBy: 'position, id' }
  }
]

/** Columns managed by sync itself (never part of the record data). */
export const SYNC_COLUMNS = ['id', 'uid', 'dirty', 'changed_at']

export const NOW_SQL = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`

export const NEW_UUID_SQL = `lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' ||
  substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))`

/** uid given to a new local row. Conditions use their key so the built-in library has the same uid on every PC. */
function uidExpr(t: SyncTableSpec): string {
  return t.name === 'conditions' ? `'cond:' || NEW.key` : NEW_UUID_SQL
}

const NOT_APPLYING = 'NOT EXISTS (SELECT 1 FROM sync_apply)'

/**
 * SQLite triggers: every local insert/update marks the row "dirty" (a change counter) and stamps changed_at;
 * deletes are written to sync_deletes. While the sync engine writes downloaded rows it puts a row in
 * sync_apply, which turns the triggers off.
 */
export function syncTriggersSql(): string {
  const out: string[] = []
  for (const t of SYNC_TABLES) {
    const n = t.name
    out.push(`
      CREATE TRIGGER sync_ins_${n} AFTER INSERT ON ${n} WHEN ${NOT_APPLYING}
      BEGIN
        UPDATE ${n} SET uid = COALESCE(NEW.uid, ${uidExpr(t)}), dirty = dirty + 1, changed_at = ${NOW_SQL} WHERE rowid = NEW.rowid;
        DELETE FROM sync_deletes WHERE tbl = '${n}' AND uid = (SELECT uid FROM ${n} WHERE rowid = NEW.rowid);
      END;
      CREATE TRIGGER sync_upd_${n} AFTER UPDATE ${t.watchColumns ? 'OF ' + t.watchColumns.join(', ') + ' ' : ''}ON ${n} WHEN ${NOT_APPLYING}
      BEGIN
        UPDATE ${n} SET dirty = dirty + 1, changed_at = ${NOW_SQL} WHERE rowid = NEW.rowid;
      END;
      CREATE TRIGGER sync_del_${n} AFTER DELETE ON ${n} WHEN ${NOT_APPLYING} AND OLD.uid IS NOT NULL
      BEGIN
        INSERT OR REPLACE INTO sync_deletes(tbl, uid, deleted_at) VALUES ('${n}', OLD.uid, ${NOW_SQL});
      END;`)
    if (t.child) {
      const c = t.child
      const touch = (ref: string) => `UPDATE ${n} SET dirty = dirty + 1, changed_at = ${NOW_SQL} WHERE id = ${ref};`
      out.push(`
      CREATE TRIGGER sync_child_ins_${c.table} AFTER INSERT ON ${c.table} WHEN ${NOT_APPLYING}
      BEGIN ${touch('NEW.' + c.fk)} END;
      CREATE TRIGGER sync_child_upd_${c.table} AFTER UPDATE ON ${c.table} WHEN ${NOT_APPLYING}
      BEGIN ${touch('NEW.' + c.fk)} ${touch('OLD.' + c.fk)} END;
      CREATE TRIGGER sync_child_del_${c.table} AFTER DELETE ON ${c.table} WHEN ${NOT_APPLYING}
      BEGIN ${touch('OLD.' + c.fk)} END;`)
    }
  }
  return out.join('\n')
}

/** Settings that travel with the clinic. Device things (printer, PIN, backup folder) stay on the PC. */
export const SHARED_APP_SETTINGS = ['language', 'printLanguage', 'copies', 'silentPrint', 'rxForm'] as const
