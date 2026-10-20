import type Database from 'better-sqlite3'

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
  }
]

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
