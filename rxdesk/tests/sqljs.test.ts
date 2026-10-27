import { describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import initSqlJs from 'sql.js'
import { createBrowserRepo } from '../web/src/db'
import { openDatabase } from '../src/main/db/database'
import { SyncEngine, type Remote, type RemoteRow, type SqlDb } from '../src/shared/sync/engine'

class MemRemote implements Remote {
  rows = new Map<string, RemoteRow>()
  seq = 0
  async pull(since: number, limit: number) {
    return [...this.rows.values()].filter((r) => r.seq! > since).sort((a, b) => a.seq! - b.seq!).slice(0, limit).map((r) => structuredClone(r))
  }
  async push(rows: RemoteRow[]) {
    for (const r of rows) {
      const old = this.rows.get(r.tbl + r.uid)
      if (old && Date.parse(r.updated_at) < Date.parse(old.updated_at)) continue
      this.rows.set(r.tbl + r.uid, { ...structuredClone(r), seq: ++this.seq })
    }
  }
}

describe('browser database (sql.js)', () => {
  it('runs the desktop repo and syncs with a desktop database', async () => {
    const SQL = await initSqlJs()
    const web = createBrowserRepo(SQL)
    expect(web.listDrugs().length).toBeGreaterThan(10)
    expect(web.listConditions().length).toBeGreaterThan(50)
    const p = web.savePatient({ name: 'Web patient', birthDate: '', birthDateEstimated: false, gender: '', phone: '', weight: '', allergies: '', chronicDiseases: '', notes: '' })
    expect(web.searchPatients('web')[0].id).toBe(p.id)
    expect(web.report().totalPatients).toBe(1)

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rxdesk-sqljs-'))
    const desk = openDatabase(path.join(dir, 'd.db')).repo
    try {
      const pd = desk.savePatient({ name: 'Desk patient', birthDate: '', birthDateEstimated: false, gender: '', phone: '', weight: '', allergies: '', chronicDiseases: '', notes: '' })
      desk.savePrescription({ patientId: pd.id, date: '2026-10-20', diagnosis: 'Dry eye', notes: '', nextVisit: '', labTests: '', items: [{ drugName: 'Systane', form: '', strength: '', dose: 'قطرة واحدة', frequency: '', duration: '', route: '', instructions: '', site: 'العينين' }] })
      desk.updateSettings({ setupCompleted: true })
      const remote = new MemRemote()
      SyncEngine.bindClinic(desk.db as unknown as SqlDb, 'c')
      await new SyncEngine(desk.db as unknown as SqlDb, remote, 'desk').sync()

      const admin = createBrowserRepo(SQL)
      SyncEngine.bindClinic(admin.db as unknown as SqlDb, 'c')
      const ew = new SyncEngine(admin.db as unknown as SqlDb, remote, 'web', false)
      await ew.sync()
      expect(admin.searchPatients('').map((x) => x.name)).toEqual(['Desk patient'])
      expect(admin.listDrugs().length).toBe(desk.listDrugs().length)
      const rx = admin.listPrescriptions({})[0]
      expect(admin.getPrescription(rx.id)!.items[0].site).toBe('العينين')
      expect(admin.report().totalPrescriptions).toBe(1)

      // Admin adds a drug and a dose choice; the desktop receives them.
      admin.saveDrug({ name: 'Admin drug', form: 'Drops', strength: '', dose: '', frequency: '', duration: '', route: '', instructions: '' })
      admin.updateSettings({ rxForm: { ...admin.getSettings().rxForm, lists: { ...admin.getSettings().rxForm.lists, amount: ['قطرتين'] } } })
      await ew.sync()
      await new SyncEngine(desk.db as unknown as SqlDb, remote, 'desk').sync()
      expect(desk.getDrugByName('Admin drug')?.form).toBe('Drops')
      expect(desk.getSettings().rxForm.lists.amount).toEqual(['قطرتين'])
    } finally {
      desk.db.close()
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
