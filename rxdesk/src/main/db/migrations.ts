import type Database from 'better-sqlite3'
import { BUILTIN_CONDITIONS } from '@shared/medical/conditions'
import { normalizeForSearch } from '@shared/text'
import { NEW_UUID_SQL, NOW_SQL, SYNC_TABLES, syncTriggersSql } from '@shared/sync/schema'

// Versioned schema migrations. NEVER edit a migration that has shipped:
// add a new entry with the next version number instead.
// The current version is stored in SQLite's PRAGMA user_version.

export interface Migration {
  version: number
  name: string
  up: (db: Database.Database) => void
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial schema',
    up: (db) => {
      db.exec(`
        CREATE TABLE settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE patients (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          search_name TEXT NOT NULL DEFAULT '',
          birth_date TEXT NOT NULL DEFAULT '',
          birth_date_estimated INTEGER NOT NULL DEFAULT 0,
          gender TEXT NOT NULL DEFAULT '',
          phone TEXT NOT NULL DEFAULT '',
          phone_digits TEXT NOT NULL DEFAULT '',
          weight TEXT NOT NULL DEFAULT '',
          allergies TEXT NOT NULL DEFAULT '',
          chronic_diseases TEXT NOT NULL DEFAULT '',
          notes TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
        );
        CREATE INDEX idx_patients_search ON patients(search_name);
        CREATE INDEX idx_patients_phone ON patients(phone_digits);

        CREATE TABLE prescriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          date TEXT NOT NULL,
          diagnosis TEXT NOT NULL DEFAULT '',
          notes TEXT NOT NULL DEFAULT '',
          next_visit TEXT NOT NULL DEFAULT '',
          lab_tests TEXT NOT NULL DEFAULT '',
          patient_snapshot TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
        );
        CREATE INDEX idx_rx_patient ON prescriptions(patient_id, date);
        CREATE INDEX idx_rx_date ON prescriptions(date);

        CREATE TABLE prescription_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          prescription_id INTEGER NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
          position INTEGER NOT NULL,
          drug_name TEXT NOT NULL,
          form TEXT NOT NULL DEFAULT '',
          strength TEXT NOT NULL DEFAULT '',
          dose TEXT NOT NULL DEFAULT '',
          frequency TEXT NOT NULL DEFAULT '',
          duration TEXT NOT NULL DEFAULT '',
          route TEXT NOT NULL DEFAULT '',
          instructions TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX idx_items_rx ON prescription_items(prescription_id, position);
        CREATE INDEX idx_items_drug ON prescription_items(drug_name COLLATE NOCASE);

        CREATE TABLE drugs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE COLLATE NOCASE,
          search_name TEXT NOT NULL DEFAULT '',
          form TEXT NOT NULL DEFAULT '',
          strength TEXT NOT NULL DEFAULT '',
          dose TEXT NOT NULL DEFAULT '',
          frequency TEXT NOT NULL DEFAULT '',
          duration TEXT NOT NULL DEFAULT '',
          route TEXT NOT NULL DEFAULT '',
          instructions TEXT NOT NULL DEFAULT '',
          use_count INTEGER NOT NULL DEFAULT 0,
          last_used_at TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE dose_phrases (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          text TEXT NOT NULL,
          position INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE favorites (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          diagnosis TEXT NOT NULL DEFAULT '',
          notes TEXT NOT NULL DEFAULT '',
          items TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE layouts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          is_default INTEGER NOT NULL DEFAULT 0,
          data TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
        );
      `)
    }
  },
  {
    version: 2,
    name: 'condition library (diagnoses + treatment options)',
    up: (db) => {
      db.exec(`
        CREATE TABLE conditions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL UNIQUE,
          specialty TEXT NOT NULL DEFAULT 'other',
          name_en TEXT NOT NULL DEFAULT '',
          name_ar TEXT NOT NULL DEFAULT '',
          icd10 TEXT NOT NULL DEFAULT '',
          keywords TEXT NOT NULL DEFAULT '[]',
          search_text TEXT NOT NULL DEFAULT '',
          is_builtin INTEGER NOT NULL DEFAULT 0,
          hidden INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE condition_options (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          condition_id INTEGER NOT NULL REFERENCES conditions(id) ON DELETE CASCADE,
          position INTEGER NOT NULL DEFAULT 0,
          label_en TEXT NOT NULL DEFAULT '',
          label_ar TEXT NOT NULL DEFAULT '',
          for_children INTEGER NOT NULL DEFAULT 0,
          items TEXT NOT NULL DEFAULT '[]',
          advice TEXT NOT NULL DEFAULT '',
          labs TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX idx_condition_options ON condition_options(condition_id, position);
      `)
      seedBuiltinConditions(db)
    }
  },
  {
    version: 3,
    name: 'medicine site (eye)',
    up: (db) => {
      db.exec(`ALTER TABLE prescription_items ADD COLUMN site TEXT NOT NULL DEFAULT ''`)
    }
  },
  {
    version: 4,
    name: 'online sync (uid, dirty flags, delete log)',
    up: (db) => {
      db.exec(`
        CREATE TABLE sync_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE sync_deletes (tbl TEXT NOT NULL, uid TEXT NOT NULL, deleted_at TEXT NOT NULL, PRIMARY KEY (tbl, uid));
        CREATE TABLE sync_apply (x INTEGER);
      `)
      for (const t of SYNC_TABLES) {
        db.exec(`
          ALTER TABLE ${t.name} ADD COLUMN uid TEXT;
          ALTER TABLE ${t.name} ADD COLUMN dirty INTEGER NOT NULL DEFAULT 0;
          ALTER TABLE ${t.name} ADD COLUMN changed_at TEXT NOT NULL DEFAULT '';
        `)
      }
      // Existing rows: give them ids and mark them for upload. The built-in condition library is
      // the same on every PC, so untouched built-in rows are not uploaded.
      db.exec(`
        UPDATE conditions SET uid = 'cond:' || key;
        UPDATE conditions SET dirty = 1 WHERE is_builtin = 0 OR hidden = 1;
      `)
      for (const t of SYNC_TABLES) {
        if (t.name !== 'conditions') db.exec(`UPDATE ${t.name} SET uid = ${NEW_UUID_SQL}, dirty = 1`)
        db.exec(`
          UPDATE ${t.name} SET changed_at = ${NOW_SQL};
          CREATE UNIQUE INDEX idx_${t.name}_uid ON ${t.name}(uid);
          CREATE INDEX idx_${t.name}_dirty ON ${t.name}(dirty) WHERE dirty > 0;
        `)
      }
      db.exec(syncTriggersSql())
    }
  }
]

export function conditionSearchText(c: { nameEn: string; nameAr: string; icd10: string; keywords: string[] }): string {
  return normalizeForSearch([c.nameEn, c.nameAr, c.icd10, ...c.keywords].join(' | '))
}

/** Inserts (or re-inserts) the built-in condition library. Existing built-in rows with the same key are replaced. */
export function seedBuiltinConditions(db: Database.Database): void {
  const del = db.prepare('DELETE FROM conditions WHERE key = ?')
  const ins = db.prepare(
    `INSERT INTO conditions(key, specialty, name_en, name_ar, icd10, keywords, search_text, is_builtin, hidden)
     VALUES(?, ?, ?, ?, ?, ?, ?, 1, 0)`
  )
  const opt = db.prepare(
    `INSERT INTO condition_options(condition_id, position, label_en, label_ar, for_children, items, advice, labs)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?)`
  )
  for (const c of BUILTIN_CONDITIONS) {
    del.run(c.key)
    const id = Number(ins.run(c.key, c.specialty, c.nameEn, c.nameAr, c.icd10, JSON.stringify(c.keywords), conditionSearchText(c)).lastInsertRowid)
    c.options.forEach((o, i) => opt.run(id, i, o.labelEn, o.labelAr, o.forChildren ? 1 : 0, JSON.stringify(o.items), o.advice ?? '', o.labs ?? ''))
  }
}

export const LATEST_VERSION = migrations[migrations.length - 1].version

export function getVersion(db: Database.Database): number {
  return db.pragma('user_version', { simple: true }) as number
}

/** Runs all pending migrations, each inside its own transaction. Returns versions applied. */
export function migrate(db: Database.Database): number[] {
  const current = getVersion(db)
  if (current > LATEST_VERSION) {
    const err = new Error(
      `Database version ${current} is newer than this app supports (${LATEST_VERSION}). Please update RxDesk.`
    )
    ;(err as Error & { code?: string }).code = 'DB_TOO_NEW'
    throw err
  }
  const applied: number[] = []
  for (const m of migrations) {
    if (m.version <= current) continue
    db.transaction(() => {
      m.up(db)
      db.pragma(`user_version = ${m.version}`)
    })()
    applied.push(m.version)
  }
  return applied
}
