import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import Database from 'better-sqlite3'
import { openDatabase } from '../src/main/db/database'
import { migrate } from '../src/main/db/migrations'
import { Repo } from '../src/main/db/repo'
import { SyncEngine, type Remote, type RemoteRow, type SqlDb } from '../src/shared/sync/engine'

/** In-memory copy of public.sync_rows with the same rules as the server trigger. */
class FakeRemote implements Remote {
  rows = new Map<string, RemoteRow>()
  seq = 0
  failNextPush = false
  pushes = 0

  async pull(since: number, limit: number): Promise<RemoteRow[]> {
    return [...this.rows.values()]
      .filter((r) => (r.seq ?? 0) > since)
      .sort((a, b) => a.seq! - b.seq!)
      .slice(0, limit)
      .map((r) => JSON.parse(JSON.stringify(r)))
  }

  async push(rows: RemoteRow[]): Promise<void> {
    if (this.failNextPush) {
      this.failNextPush = false
      throw new Error('network down')
    }
    this.pushes++
    for (const r of rows) {
      const key = r.tbl + '/' + r.uid
      const old = this.rows.get(key)
      if (old && Date.parse(r.updated_at) < Date.parse(old.updated_at)) continue
      this.rows.set(key, { ...JSON.parse(JSON.stringify(r)), seq: ++this.seq })
    }
  }

  live(tbl: string): RemoteRow[] {
    return [...this.rows.values()].filter((r) => r.tbl === tbl && !r.deleted)
  }
}

let dir: string
const opened: Repo[] = []

function newPc(name: string): Repo {
  const repo = openDatabase(path.join(dir, name + '.db')).repo
  opened.push(repo)
  return repo
}

function engine(repo: Repo, remote: Remote, device: string, uploadStarter = true): SyncEngine {
  SyncEngine.bindClinic(repo.db as unknown as SqlDb, 'clinic-1')
  return new SyncEngine(repo.db as unknown as SqlDb, remote, device, uploadStarter)
}

const tick = () => new Promise((r) => setTimeout(r, 5))

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rxdesk-sync-'))
})

afterEach(() => {
  for (const r of opened.splice(0)) r.db.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('local migration v4', () => {
  it('gives every row a uid, keeps starter data clean and marks edits dirty', () => {
    const repo = newPc('a')
    const db = repo.db
    const missing = db.prepare('SELECT COUNT(*) AS c FROM drugs WHERE uid IS NULL').get() as { c: number }
    expect(missing.c).toBe(0)
    expect(SyncEngine.pendingCount(db as unknown as SqlDb)).toBe(0)
    const cond = db.prepare('SELECT uid, key FROM conditions LIMIT 1').get() as { uid: string; key: string }
    expect(cond.uid).toBe('cond:' + cond.key)

    const p = repo.savePatient({ name: 'Ahmed', birthDate: '', birthDateEstimated: false, gender: 'male', phone: '', weight: '', allergies: '', chronicDiseases: '', notes: '' })
    const row = db.prepare('SELECT uid, dirty, changed_at FROM patients WHERE id = ?').get(p.id) as { uid: string; dirty: number; changed_at: string }
    expect(row.uid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(row.dirty).toBeGreaterThan(0)
    expect(row.changed_at).toMatch(/Z$/)

    // Using a drug (use_count) does not mark it for upload; editing it does.
    const d = repo.listDrugs()[0]
    db.prepare('UPDATE drugs SET use_count = use_count + 1 WHERE id = ?').run(d.id)
    expect((db.prepare('SELECT dirty FROM drugs WHERE id = ?').get(d.id) as { dirty: number }).dirty).toBe(0)
    repo.saveDrug({ ...d, form: 'Syrup' })
    expect((db.prepare('SELECT dirty FROM drugs WHERE id = ?').get(d.id) as { dirty: number }).dirty).toBe(1)

    // Editing a prescription's items marks the prescription.
    const rx = repo.savePrescription({ patientId: p.id, date: '2026-10-01', diagnosis: '', notes: '', nextVisit: '', labTests: '', items: [{ drugName: 'X', form: '', strength: '', dose: '', frequency: '', duration: '', route: '', instructions: '' }] })
    db.prepare('UPDATE prescriptions SET dirty = 0 WHERE id = ?').run(rx.id)
    db.prepare("UPDATE prescription_items SET dose = '1' WHERE prescription_id = ?").run(rx.id)
    expect((db.prepare('SELECT dirty FROM prescriptions WHERE id = ?').get(rx.id) as { dirty: number }).dirty).toBeGreaterThan(0)

    // Deletes are logged.
    repo.deletePatient(p.id)
    const tombs = db.prepare('SELECT tbl FROM sync_deletes ORDER BY tbl').all() as { tbl: string }[]
    expect(tombs.map((t) => t.tbl)).toEqual(['patients', 'prescriptions'])
  })

  it('upgrades an existing v3 database and marks its data for upload', async () => {
    const file = path.join(dir, 'old.db')
    const raw = new Database(file)
    raw.pragma('foreign_keys = ON')
    // Bring a database to v3 only.
    const { migrations } = await import('../src/main/db/migrations')
    for (const m of migrations.filter((m) => m.version <= 3)) {
      raw.transaction(() => {
        m.up(raw)
        raw.pragma(`user_version = ${m.version}`)
      })()
    }
    raw.prepare("INSERT INTO patients(name) VALUES ('Old patient')").run()
    raw.prepare("INSERT INTO drugs(name) VALUES ('Old drug')").run()
    migrate(raw)
    const p = raw.prepare('SELECT uid, dirty FROM patients').get() as { uid: string; dirty: number }
    expect(p.uid).toBeTruthy()
    expect(p.dirty).toBe(1)
    // Built-in conditions are identical everywhere and are not uploaded.
    expect((raw.prepare('SELECT COUNT(*) AS c FROM conditions WHERE dirty > 0').get() as { c: number }).c).toBe(0)
    raw.close()
  })
})

describe('sync engine', () => {
  it('uploads a PC, downloads it on a second PC and syncs edits and deletes both ways', async () => {
    const remote = new FakeRemote()
    const a = newPc('a')
    const p = a.savePatient({ name: 'Mona', birthDate: '1990-01-01', birthDateEstimated: false, gender: 'female', phone: '0100', weight: '', allergies: 'penicillin', chronicDiseases: '', notes: '' })
    a.savePrescription({ patientId: p.id, date: '2026-10-02', diagnosis: 'Conjunctivitis', notes: '', nextVisit: '', labTests: '', items: [{ drugName: 'Tobradex', form: 'Drops', strength: '', dose: 'قطرة واحدة', frequency: '4 مرات يومياً', duration: '', route: '', instructions: '', site: 'العين اليمنى' }] })
    a.saveProfile({ doctorNameAr: 'د. منى' })
    a.updateSettings({ setupCompleted: true, rxForm: { ...a.getSettings().rxForm, lists: { ...a.getSettings().rxForm.lists, eye: ['يمين', 'يسار'] } } })
    const ea = engine(a, remote, 'device:a')
    const r1 = await ea.sync()
    expect(r1.pushed).toBeGreaterThan(2)
    expect(SyncEngine.pendingCount(a.db as unknown as SqlDb)).toBe(0)
    expect(remote.live('patients').length).toBe(1)
    expect(remote.live('drugs').length).toBeGreaterThan(10) // starter drugs of a brand-new clinic are uploaded
    const rxRow = remote.live('prescriptions')[0]
    expect(rxRow.data.patient_uid).toBe(remote.live('patients')[0].uid)
    expect((rxRow.data.items as { site: string }[])[0].site).toBe('العين اليمنى')

    // Second, empty PC of the same clinic: downloads everything and does not duplicate starter data.
    const b = newPc('b')
    const eb = engine(b, remote, 'device:b')
    await eb.sync()
    expect(b.searchPatients('').map((x) => x.name)).toEqual(['Mona'])
    expect(b.listDrugs().length).toBe(a.listDrugs().length)
    expect(b.listLayouts().length).toBe(a.listLayouts().length)
    expect(b.listDosePhrases().length).toBe(a.listDosePhrases().length)
    const bp = b.searchPatients('')[0]
    const brx = b.listPrescriptions({ patientId: bp.id })
    expect(brx.length).toBe(1)
    expect(b.getPrescription(brx[0].id)!.items[0].site).toBe('العين اليمنى')
    expect(b.getProfile().doctorNameAr).toBe('د. منى')
    expect(b.getSettings().rxForm.lists.eye).toEqual(['يمين', 'يسار'])
    expect(b.getSettings().setupCompleted).toBe(true)
    expect(SyncEngine.pendingCount(b.db as unknown as SqlDb)).toBe(0)

    // Edit on B -> A; delete on A -> B.
    await tick()
    b.savePatient({ ...bp, phone: '0111' })
    b.saveDrug({ name: 'New drug from B', form: 'Tab', strength: '', dose: '', frequency: '', duration: '', route: '', instructions: '' })
    await eb.sync()
    await ea.sync()
    expect(a.getPatient(p.id)!.phone).toBe('0111')
    expect(a.listDrugs().find((d) => d.name === 'New drug from B')).toBeTruthy()

    a.deletePatient(p.id)
    await ea.sync()
    await eb.sync()
    expect(b.searchPatients('').length).toBe(0)
    expect(b.listPrescriptions({}).length).toBe(0)
    expect(remote.live('patients').length).toBe(0)
  })

  it('newest edit wins when both PCs change the same record', async () => {
    const remote = new FakeRemote()
    const a = newPc('a')
    const p = a.savePatient({ name: 'Sara', birthDate: '', birthDateEstimated: false, gender: '', phone: '', weight: '', allergies: '', chronicDiseases: '', notes: '' })
    const ea = engine(a, remote, 'device:a')
    await ea.sync()
    const b = newPc('b')
    const eb = engine(b, remote, 'device:b')
    await eb.sync()
    const bp = b.searchPatients('')[0]

    a.savePatient({ ...a.getPatient(p.id)!, notes: 'older edit on A' })
    await tick()
    b.savePatient({ ...bp, notes: 'newer edit on B' })
    await ea.sync() // A uploads first
    await eb.sync() // B's newer edit wins
    await ea.sync()
    expect(a.getPatient(p.id)!.notes).toBe('newer edit on B')
    expect(b.getPatient(bp.id)!.notes).toBe('newer edit on B')
  })

  it('merges settings per group (prescription screen from the web, profile on the PC)', async () => {
    const remote = new FakeRemote()
    const a = newPc('a')
    a.updateSettings({ setupCompleted: true, copies: 1 })
    const ea = engine(a, remote, 'device:a')
    await ea.sync()

    // The admin (web) changes the dose lists and copies; the doctor changes the profile meanwhile.
    const web = newPc('web')
    const ew = engine(web, remote, 'web', false)
    await ew.sync()
    web.updateSettings({ copies: 3, rxForm: { ...web.getSettings().rxForm, lists: { amount: ['1'], frequency: ['2'], eye: ['3'] } } })
    a.saveProfile({ clinicName: 'Eye Center' })
    await ew.sync()
    await ea.sync()
    await ew.sync()
    expect(a.getSettings().copies).toBe(3)
    expect(a.getSettings().rxForm.lists.amount).toEqual(['1'])
    expect(a.getProfile().clinicName).toBe('Eye Center')
    expect(web.getProfile().clinicName).toBe('Eye Center')
    // Device settings stay on the PC.
    expect(a.getSettings().setupCompleted).toBe(true)
  })

  it('the web app never uploads its starter data', async () => {
    const remote = new FakeRemote()
    const web = newPc('web')
    const ew = engine(web, remote, 'web', false)
    await ew.sync()
    expect(remote.rows.size).toBe(0)
    expect(web.listDrugs().length).toBe(0)
    // Built-in diagnoses stay available.
    expect(web.listConditions().length).toBeGreaterThan(50)
  })

  it('matches drugs by name instead of duplicating them', async () => {
    const remote = new FakeRemote()
    const a = newPc('a')
    a.savePatient({ name: 'P1', birthDate: '', birthDateEstimated: false, gender: '', phone: '', weight: '', allergies: '', chronicDiseases: '', notes: '' })
    a.saveDrug({ name: 'Zyrtec', form: 'Tab', strength: '10 mg', dose: '', frequency: '', duration: '', route: '', instructions: '' })
    const b = newPc('b')
    b.savePatient({ name: 'P2', birthDate: '', birthDateEstimated: false, gender: '', phone: '', weight: '', allergies: '', chronicDiseases: '', notes: '' })
    b.saveDrug({ name: 'zyrtec', form: 'Syrup', strength: '', dose: '', frequency: '', duration: '', route: '', instructions: '' })
    const ea = engine(a, remote, 'device:a')
    const eb = engine(b, remote, 'device:b')
    await ea.sync()
    await eb.sync()
    await ea.sync()
    await eb.sync()
    const online = remote.live('drugs').filter((d) => String(d.data.name).toLowerCase() === 'zyrtec')
    expect(online.length).toBe(1)
    expect(a.listDrugs().filter((d) => d.name.toLowerCase() === 'zyrtec').length).toBe(1)
    expect(b.listDrugs().filter((d) => d.name.toLowerCase() === 'zyrtec').length).toBe(1)
    expect(a.searchPatients('').length).toBe(2)
    expect(b.searchPatients('').length).toBe(2)
  })

  it('keeps changes made during a failed upload and sends them next time', async () => {
    const remote = new FakeRemote()
    const a = newPc('a')
    const ea = engine(a, remote, 'device:a')
    await ea.sync()
    a.savePatient({ name: 'Offline patient', birthDate: '', birthDateEstimated: false, gender: '', phone: '', weight: '', allergies: '', chronicDiseases: '', notes: '' })
    remote.failNextPush = true
    await expect(ea.sync()).rejects.toThrow('network down')
    expect(SyncEngine.pendingCount(a.db as unknown as SqlDb)).toBe(1)
    await ea.sync()
    expect(SyncEngine.pendingCount(a.db as unknown as SqlDb)).toBe(0)
    expect(remote.live('patients').map((r) => r.data.name)).toEqual(['Offline patient'])
  })

  it('a default layout set online becomes the only default', async () => {
    const remote = new FakeRemote()
    const a = newPc('a')
    a.updateSettings({ setupCompleted: true })
    const ea = engine(a, remote, 'device:a')
    await ea.sync()
    const web = newPc('web')
    const ew = engine(web, remote, 'web', false)
    await ew.sync()
    const other = web.listLayouts().find((l) => !l.isDefault)!
    web.setDefaultLayout(other.id)
    await ew.sync()
    await ea.sync()
    const defs = a.listLayouts().filter((l) => l.isDefault)
    expect(defs.length).toBe(1)
    expect(defs[0].name).toBe(other.name)
  })
})
