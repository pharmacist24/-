import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import Database from 'better-sqlite3'
import { openDatabase } from '../src/main/db/database'
import { migrations } from '../src/main/db/migrations'
import type { Repo } from '../src/main/db/repo'
import { BUILTIN_CONDITIONS, SPECIALTIES } from '../src/shared/medical/conditions'

let dir: string
let repo: Repo

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rxdesk-cond-'))
  repo = openDatabase(path.join(dir, 't.db')).repo
})
afterEach(() => {
  repo.db.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('built-in condition library', () => {
  it('is well formed', () => {
    const keys = new Set<string>()
    for (const c of BUILTIN_CONDITIONS) {
      expect(keys.has(c.key), c.key).toBe(false)
      keys.add(c.key)
      expect(c.nameEn && c.nameAr && c.icd10, c.key).toBeTruthy()
      expect(c.options.length, c.key).toBeGreaterThan(0)
      for (const o of c.options) {
        expect(o.labelEn && o.labelAr, c.key).toBeTruthy()
        expect(o.items.length, c.key).toBeGreaterThan(0)
        for (const it of o.items) {
          expect(it.drugName, c.key).toBeTruthy()
          expect(it.dose, `${c.key} ${it.drugName}`).toBeTruthy()
          expect(it.frequency, `${c.key} ${it.drugName}`).toBeTruthy()
        }
      }
    }
    expect(BUILTIN_CONDITIONS.length).toBeGreaterThanOrEqual(70)
    for (const s of SPECIALTIES) expect(BUILTIN_CONDITIONS.filter((c) => c.specialty === s).length, s).toBeGreaterThanOrEqual(10)
    // every pediatric condition offers a child option
    for (const c of BUILTIN_CONDITIONS.filter((x) => x.specialty === 'pediatrics')) expect(c.options.some((o) => o.forChildren), c.key).toBe(true)
  })

  it('is seeded into a new database', () => {
    expect(repo.listConditions().length).toBe(BUILTIN_CONDITIONS.length)
  })

  it('searches English, Arabic, ICD code and keywords', () => {
    expect(repo.searchConditions('tonsil').map((c) => c.key)).toEqual(expect.arrayContaining(['strep_tonsillitis', 'p_tonsillitis']))
    expect(repo.searchConditions('التهاب اللوز').map((c) => c.key)).toContain('strep_tonsillitis')
    expect(repo.searchConditions('J03').map((c) => c.key)).toContain('strep_tonsillitis')
    expect(repo.searchConditions('ضغط')[0].key).toBe('hypertension')
    expect(repo.searchConditions('')).toEqual([])
  })

  it('finds conditions from diagnosis text, keeping order', () => {
    const r = repo.conditionsByNames(['Essential hypertension', 'unknown thing', 'التهاب اللوز الصديدي'])
    expect(r.map((c) => c.key)).toEqual(['hypertension', 'strep_tonsillitis'])
    expect(r[1].options[0].items[0].drugName).toBe('Amoxicillin')
  })

  it('edits, hides and restores', () => {
    const c = repo.searchConditions('tonsil').find((x) => x.key === 'strep_tonsillitis')!
    repo.saveCondition({ ...c, options: [{ ...c.options[0], labelEn: 'Mine', items: [{ ...c.options[0].items[0], strength: '1 g' }] }] })
    const edited = repo.conditionsByNames([c.nameEn])[0]
    expect(edited.options.length).toBe(1)
    expect(edited.options[0].items[0].strength).toBe('1 g')
    repo.deleteCondition(c.id)
    expect(repo.searchConditions('tonsil').map((x) => x.key)).not.toContain('strep_tonsillitis')
    const own = repo.saveCondition({ specialty: 'general', nameEn: 'My condition', nameAr: '', icd10: '', keywords: ['xyz'], options: [] })
    repo.resetBuiltinConditions()
    const restored = repo.searchConditions('tonsil').find((x) => x.key === 'strep_tonsillitis')!
    expect(restored.options.length).toBe(BUILTIN_CONDITIONS.find((x) => x.key === 'strep_tonsillitis')!.options.length)
    expect(repo.searchConditions('xyz')[0].id).toBe(own.id) // own diagnosis kept
    repo.deleteCondition(own.id)
    expect(repo.searchConditions('xyz')).toEqual([])
  })
})

describe('upgrade from version 1', () => {
  it('migrates an existing v1 database, keeps data and makes a safety copy', () => {
    const file = path.join(dir, 'old.db')
    const db = new Database(file)
    migrations[0].up(db)
    db.pragma('user_version = 1')
    db.prepare("INSERT INTO patients(name) VALUES('Old patient')").run()
    db.prepare("INSERT INTO settings(key, value) VALUES('app', ?)").run(JSON.stringify({ setupCompleted: true, rxForm: { medFields: [], showDiagnosis: false, showNotes: true } }))
    db.close()
    let backedUpFrom = 0
    const res = openDatabase(file, (v) => (backedUpFrom = v))
    expect({ prev: res.previousVersion, applied: res.applied, backedUpFrom }).toEqual({ prev: 1, applied: [2, 3], backedUpFrom: 1 })
    expect(res.repo.allPatients().map((p) => p.name)).toEqual(['Old patient'])
    expect(res.repo.listConditions().length).toBe(BUILTIN_CONDITIONS.length)
    // settings saved before the feature get the diagnosis box + panel turned on
    expect(res.repo.getSettings().rxForm).toMatchObject({ showDiagnosis: true, showSmartPanel: true })
    res.repo.db.close()
  })
})
