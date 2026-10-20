import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import Database from 'better-sqlite3'
import { inspectDatabaseFile, openDatabase } from '../src/main/db/database'
import { LATEST_VERSION, migrate, migrations } from '../src/main/db/migrations'
import { Repo } from '../src/main/db/repo'
import { seedSamplePatients, SEED_DRUGS } from '../src/main/db/seed'
import { sampleA4Layout } from '../src/shared/layout/defaults'

let dir: string
let repo: Repo

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rxdesk-test-'))
  repo = openDatabase(path.join(dir, 'test.db')).repo
})

afterEach(() => {
  repo.db.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('migrations', () => {
  it('creates a fresh database at the latest version with seed data', () => {
    expect(repo.db.pragma('user_version', { simple: true })).toBe(LATEST_VERSION)
    expect(repo.listDrugs().length).toBe(SEED_DRUGS.length)
    expect(repo.listDrugs().length).toBeGreaterThanOrEqual(20)
    expect(repo.listLayouts().length).toBe(2)
    expect(repo.listLayouts().filter((l) => l.isDefault).length).toBe(1)
    expect(repo.listDosePhrases().length).toBeGreaterThan(5)
    expect(repo.listFavorites().length).toBe(2)
  })

  it('is idempotent when reopened', () => {
    const file = path.join(dir, 'test.db')
    repo.db.close()
    const again = openDatabase(file)
    expect(again.applied).toEqual([])
    expect(again.repo.listLayouts().length).toBe(2)
    repo = again.repo
  })

  it('refuses a database from a newer app version', () => {
    const db = new Database(':memory:')
    db.pragma(`user_version = ${LATEST_VERSION + 5}`)
    expect(() => migrate(db)).toThrow(/newer/)
    db.close()
  })

  it('migration versions are strictly increasing', () => {
    migrations.forEach((m, i) => expect(m.version).toBe(i + 1))
  })

  it('inspects a database file', () => {
    seedSamplePatients(repo)
    repo.db.pragma('wal_checkpoint(TRUNCATE)')
    const info = inspectDatabaseFile(path.join(dir, 'test.db'))
    expect(info.version).toBe(LATEST_VERSION)
    expect(info.patients).toBe(3)
    expect(info.prescriptions).toBe(3)
  })
})

describe('settings & profile', () => {
  it('returns defaults and merges updates', () => {
    expect(repo.getSettings().setupCompleted).toBe(false)
    const s = repo.updateSettings({ language: 'en', copies: 99, autoBackup: { keep: 0 } as any })
    expect(s.language).toBe('en')
    expect(s.copies).toBe(20)
    expect(s.autoBackup.keep).toBe(14)
    expect(s.autoBackup.enabled).toBe(true)
    repo.saveProfile({ doctorNameAr: 'د. سامي' })
    expect(repo.getProfile().doctorNameAr).toBe('د. سامي')
    expect(repo.getProfile().clinicName).toBe('')
  })
})

describe('patients', () => {
  it('validates, creates and updates', () => {
    expect(() => repo.savePatient({ name: '  ' } as any)).toThrow()
    const p = repo.savePatient({ name: 'محمد أحمد', phone: '010-555 1234' } as any)
    expect(p.id).toBeGreaterThan(0)
    const u = repo.savePatient({ ...p, weight: '70 kg' })
    expect(u.weight).toBe('70 kg')
    expect(repo.getPatient(p.id)!.phone).toBe('010-555 1234')
  })

  it('searches by normalised Arabic name and by phone', () => {
    repo.savePatient({ name: 'أحمد محمود', phone: '01001112222' } as any)
    repo.savePatient({ name: 'فاطمة الزهراء', phone: '01234567890' } as any)
    expect(repo.searchPatients('احمد').map((p) => p.name)).toEqual(['أحمد محمود'])
    expect(repo.searchPatients('محمود احمد').length).toBe(1) // any word order
    expect(repo.searchPatients('فاطمه').length).toBe(1) // ة == ه
    expect(repo.searchPatients('4567').map((p) => p.name)).toEqual(['فاطمة الزهراء'])
    expect(repo.searchPatients('').length).toBe(2)
    expect(repo.searchPatients('100%').length).toBe(0) // LIKE wildcards are escaped
  })
})

describe('prescriptions', () => {
  it('saves items in order, learns new drugs and lists history', () => {
    const p = repo.savePatient({ name: 'Test Patient', birthDate: '1990-01-01', gender: 'female' } as any)
    const rx = repo.savePrescription({
      patientId: p.id,
      date: '2026-01-15',
      diagnosis: 'Tonsillitis',
      notes: 'Rest',
      nextVisit: '2026-01-22',
      labTests: '',
      items: [
        { drugName: 'Augmentin', form: 'Tab', strength: '1 g', dose: '1', frequency: 'bid', duration: '7d', route: '', instructions: '' },
        { drugName: '  ', form: '', strength: '', dose: '', frequency: '', duration: '', route: '', instructions: '' },
        { drugName: 'Brand New Drug', form: 'Syrup', strength: '', dose: '5 ml', frequency: '', duration: '', route: '', instructions: '' }
      ]
    })
    expect(rx.items.map((i) => i.drugName)).toEqual(['Augmentin', 'Brand New Drug'])
    expect(rx.patient.name).toBe('Test Patient')
    expect(rx.patient.ageText).toMatch(/36/)
    expect(repo.getDrugByName('brand new drug')!.form).toBe('Syrup')
    expect(repo.getDrugByName('Augmentin')!.useCount).toBe(1)
    expect(repo.searchDrugs('aug')[0].name).toBe('Augmentin')

    const edited = repo.savePrescription({ ...rx, items: [rx.items[1], rx.items[0]] })
    expect(edited.id).toBe(rx.id)
    expect(edited.items.map((i) => i.drugName)).toEqual(['Brand New Drug', 'Augmentin'])
    expect(repo.getDrugByName('Augmentin')!.useCount).toBe(1) // editing does not double count

    const hist = repo.listPrescriptions({ patientId: p.id })
    expect(hist.length).toBe(1)
    expect(hist[0].drugsSummary).toBe('Brand New Drug, Augmentin')
    expect(repo.diagnosisSuggestions('ton')).toEqual(['Tonsillitis'])

    repo.deletePatient(p.id)
    expect(repo.getPrescription(rx.id)).toBeNull() // cascade
  })

  it('requires an existing patient', () => {
    expect(() => repo.savePrescription({ patientId: 999, date: '', diagnosis: '', notes: '', nextVisit: '', labTests: '', items: [] })).toThrow(/patient/)
  })
})

describe('library', () => {
  it('manages drugs, phrases and favorites', () => {
    expect(() => repo.saveDrug({ name: 'augmentin' } as any)).toThrow(/exists/)
    const d = repo.saveDrug({ name: 'Zinc', form: 'Tab' } as any)
    repo.saveDrug({ ...d, strength: '50 mg' })
    expect(repo.getDrugByName('zinc')!.strength).toBe('50 mg')
    repo.deleteDrug(d.id)
    expect(repo.getDrugByName('zinc')).toBeNull()

    const ph = repo.saveDosePhrase({ text: 'Twice daily' })
    const ids = repo.listDosePhrases().map((p) => p.id)
    repo.reorderDosePhrases([ph.id, ...ids.filter((i) => i !== ph.id)])
    expect(repo.listDosePhrases()[0].text).toBe('Twice daily')

    const fav = repo.saveFavorite({ name: 'Set', diagnosis: '', notes: '', items: [{ drugName: 'X' } as any, { drugName: '' } as any] })
    expect(fav.items.length).toBe(1)
    repo.deleteFavorite(fav.id)
  })
})

describe('layouts', () => {
  it('keeps exactly one default and protects the last layout', () => {
    const all = repo.listLayouts()
    const created = repo.saveLayout({ name: 'Mine', layout: sampleA4Layout(), isDefault: true })
    expect(repo.getDefaultLayout()!.id).toBe(created.id)
    expect(repo.listLayouts().filter((l) => l.isDefault).length).toBe(1)
    repo.deleteLayout(created.id)
    expect(repo.listLayouts().filter((l) => l.isDefault).length).toBe(1)
    repo.deleteLayout(all[1].id)
    expect(() => repo.deleteLayout(all[0].id)).toThrow()
  })

  it('round-trips layout JSON', () => {
    const l = sampleA4Layout()
    const saved = repo.saveLayout({ name: 'RT', layout: l })
    expect(saved.layout.elements.length).toBe(l.elements.length)
    expect(saved.layout.paper.widthMm).toBe(210)
  })
})

describe('reports & export', () => {
  it('counts prescriptions and top drugs', () => {
    seedSamplePatients(repo)
    const r = repo.report()
    expect(r.totalPatients).toBe(3)
    expect(r.totalPrescriptions).toBe(3)
    expect(r.today).toBe(3)
    expect(r.perDay.length).toBe(1)
    expect(r.topDrugs.length).toBeGreaterThan(0)
    expect(repo.exportPrescriptionRows().length).toBeGreaterThanOrEqual(7)
  })
})
