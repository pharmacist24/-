import type Database from 'better-sqlite3'
import type {
  AppSettings,
  ClinicProfile,
  DosePhrase,
  Drug,
  DrugInput,
  Favorite,
  FavoriteInput,
  LayoutRecord,
  MedicineItem,
  Patient,
  PatientInput,
  PatientListItem,
  PatientSnapshot,
  Prescription,
  PrescriptionInput,
  PrescriptionListItem,
  ReportSummary
} from '@shared/types'
import type { Layout } from '@shared/layout/types'
import { ALL_RX_MED_FIELDS, DEFAULT_SETTINGS, EMPTY_PROFILE } from '@shared/defaults'
import { digitsOnly, formatAge, normalizeForSearch, todayIso } from '@shared/text'
import { normalizeLayout } from '@shared/layout/defaults'

type Row = Record<string, any>

export class AppError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message)
  }
}

function rowToPatient(r: Row): Patient {
  return {
    id: r.id,
    name: r.name,
    birthDate: r.birth_date,
    birthDateEstimated: !!r.birth_date_estimated,
    gender: r.gender,
    phone: r.phone,
    weight: r.weight,
    allergies: r.allergies,
    chronicDiseases: r.chronic_diseases,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

function rowToDrug(r: Row): Drug {
  return {
    id: r.id,
    name: r.name,
    form: r.form,
    strength: r.strength,
    dose: r.dose,
    frequency: r.frequency,
    duration: r.duration,
    route: r.route,
    instructions: r.instructions,
    useCount: r.use_count
  }
}

function cleanItem(i: Partial<MedicineItem>): MedicineItem {
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  return {
    drugName: s(i.drugName),
    form: s(i.form),
    strength: s(i.strength),
    dose: s(i.dose),
    frequency: s(i.frequency),
    duration: s(i.duration),
    route: s(i.route),
    instructions: s(i.instructions)
  }
}

function cleanRxForm(f: AppSettings['rxForm']): AppSettings['rxForm'] {
  const fields = Array.isArray(f.medFields) ? f.medFields : []
  return {
    medFields: ALL_RX_MED_FIELDS.filter((x) => fields.includes(x)),
    showDiagnosis: !!f.showDiagnosis,
    showNotes: !!f.showNotes,
    showLabTests: !!f.showLabTests,
    showNextVisit: !!f.showNextVisit,
    showSidePanel: !!f.showSidePanel
  }
}

/** Escape LIKE wildcards. */
function likeEscape(s: string): string {
  return s.replace(/[\\%_]/g, (c) => '\\' + c)
}

/** All database access goes through this class. It has no Electron dependency. */
export class Repo {
  constructor(public db: Database.Database) {}

  // ---------------------------------------------------------------- settings
  private getKey<T>(key: string, fallback: T): T {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as Row | undefined
    if (!row) return fallback
    try {
      return JSON.parse(row.value) as T
    } catch {
      return fallback
    }
  }

  private setKey(key: string, value: unknown): void {
    this.db
      .prepare('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, JSON.stringify(value))
  }

  getSettings(): AppSettings {
    const s = this.getKey<Partial<AppSettings>>('app', {})
    return {
      ...DEFAULT_SETTINGS,
      ...s,
      autoBackup: { ...DEFAULT_SETTINGS.autoBackup, ...(s.autoBackup ?? {}) },
      rxForm: cleanRxForm({ ...DEFAULT_SETTINGS.rxForm, ...(s.rxForm ?? {}) })
    }
  }

  updateSettings(patch: Partial<AppSettings>): AppSettings {
    const current = this.getSettings()
    const next: AppSettings = {
      ...current,
      ...patch,
      autoBackup: { ...current.autoBackup, ...(patch.autoBackup ?? {}) },
      rxForm: cleanRxForm({ ...current.rxForm, ...(patch.rxForm ?? {}) })
    }
    next.copies = Math.min(20, Math.max(1, Math.round(Number(next.copies) || 1)))
    next.autoBackup.keep = Math.min(365, Math.max(1, Math.round(Number(next.autoBackup.keep) || 14)))
    this.setKey('app', next)
    return next
  }

  getProfile(): ClinicProfile {
    return { ...EMPTY_PROFILE, ...this.getKey<Partial<ClinicProfile>>('profile', {}) }
  }

  saveProfile(p: Partial<ClinicProfile>): ClinicProfile {
    const next = { ...this.getProfile(), ...p }
    this.setKey('profile', next)
    return next
  }

  getSecret(key: string): string {
    return this.getKey<string>('secret.' + key, '')
  }

  setSecret(key: string, value: string): void {
    if (!value) this.db.prepare('DELETE FROM settings WHERE key = ?').run('secret.' + key)
    else this.setKey('secret.' + key, value)
  }

  // ---------------------------------------------------------------- patients
  savePatient(input: PatientInput): Patient {
    const name = (input.name ?? '').trim()
    if (!name) throw new AppError('VALIDATION', 'Patient name is required')
    const values = {
      name,
      search_name: normalizeForSearch(name),
      birth_date: input.birthDate ?? '',
      birth_date_estimated: input.birthDateEstimated ? 1 : 0,
      gender: input.gender ?? '',
      phone: (input.phone ?? '').trim(),
      phone_digits: digitsOnly(input.phone ?? ''),
      weight: (input.weight ?? '').trim(),
      allergies: (input.allergies ?? '').trim(),
      chronic_diseases: (input.chronicDiseases ?? '').trim(),
      notes: (input.notes ?? '').trim()
    }
    let id = input.id
    if (id) {
      const res = this.db
        .prepare(
          `UPDATE patients SET name=@name, search_name=@search_name, birth_date=@birth_date,
           birth_date_estimated=@birth_date_estimated, gender=@gender, phone=@phone, phone_digits=@phone_digits,
           weight=@weight, allergies=@allergies, chronic_diseases=@chronic_diseases, notes=@notes,
           updated_at=datetime('now','localtime') WHERE id=@id`
        )
        .run({ ...values, id })
      if (res.changes === 0) throw new AppError('NOT_FOUND', 'Patient not found')
    } else {
      const res = this.db
        .prepare(
          `INSERT INTO patients(name, search_name, birth_date, birth_date_estimated, gender, phone, phone_digits,
           weight, allergies, chronic_diseases, notes)
           VALUES(@name, @search_name, @birth_date, @birth_date_estimated, @gender, @phone, @phone_digits,
           @weight, @allergies, @chronic_diseases, @notes)`
        )
        .run(values)
      id = Number(res.lastInsertRowid)
    }
    return this.getPatient(id)!
  }

  getPatient(id: number): Patient | null {
    const r = this.db.prepare('SELECT * FROM patients WHERE id = ?').get(id) as Row | undefined
    return r ? rowToPatient(r) : null
  }

  deletePatient(id: number): void {
    this.db.prepare('DELETE FROM patients WHERE id = ?').run(id)
  }

  /** Search by name (Arabic-normalised, any word order) or phone digits. Empty query = recent patients. */
  searchPatients(query: string, limit = 50): PatientListItem[] {
    const q = normalizeForSearch(query ?? '')
    const digits = q.replace(/\D/g, '')
    const where: string[] = []
    const params: unknown[] = []
    if (q) {
      const words = q.split(' ').filter(Boolean)
      const nameCond = words.map(() => "p.search_name LIKE ? ESCAPE '\\'").join(' AND ')
      params.push(...words.map((w) => `%${likeEscape(w)}%`))
      if (digits.length >= 3 && digits.length === q.replace(/[\s+\-()]/g, '').length) {
        where.push(`((${nameCond}) OR p.phone_digits LIKE ? ESCAPE '\\')`)
        params.push(`%${likeEscape(digits)}%`)
      } else {
        where.push(`(${nameCond})`)
      }
    }
    const sql = `
      SELECT p.*, COUNT(r.id) AS rx_count, COALESCE(MAX(r.date), '') AS last_visit,
        CASE WHEN p.search_name LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END AS starts_rank
      FROM patients p LEFT JOIN prescriptions r ON r.patient_id = p.id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      GROUP BY p.id
      ORDER BY ${q ? 'starts_rank, ' : ''} MAX(COALESCE(MAX(r.created_at), ''), p.updated_at) DESC, p.id DESC
      LIMIT ?`
    const rows = this.db.prepare(sql).all(`${likeEscape(q)}%`, ...params, limit) as Row[]
    return rows.map((r) => ({ ...rowToPatient(r), prescriptionCount: r.rx_count, lastVisit: r.last_visit }))
  }

  countPatients(): number {
    return (this.db.prepare('SELECT COUNT(*) AS c FROM patients').get() as Row).c
  }

  allPatients(): Patient[] {
    return (this.db.prepare('SELECT * FROM patients ORDER BY name').all() as Row[]).map(rowToPatient)
  }

  // ---------------------------------------------------------------- drugs
  searchDrugs(query: string, limit = 15): Drug[] {
    const q = normalizeForSearch(query ?? '')
    if (!q) {
      return (this.db
        .prepare('SELECT * FROM drugs ORDER BY use_count DESC, name LIMIT ?')
        .all(limit) as Row[]).map(rowToDrug)
    }
    return (this.db
      .prepare(
        `SELECT *, CASE WHEN search_name LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END AS rank FROM drugs
         WHERE search_name LIKE ? ESCAPE '\\' ORDER BY rank, use_count DESC, name LIMIT ?`
      )
      .all(`${likeEscape(q)}%`, `%${likeEscape(q)}%`, limit) as Row[]).map(rowToDrug)
  }

  listDrugs(): Drug[] {
    return (this.db.prepare('SELECT * FROM drugs ORDER BY name COLLATE NOCASE').all() as Row[]).map(rowToDrug)
  }

  getDrugByName(name: string): Drug | null {
    const r = this.db.prepare('SELECT * FROM drugs WHERE name = ? COLLATE NOCASE').get(name.trim()) as Row | undefined
    return r ? rowToDrug(r) : null
  }

  saveDrug(input: DrugInput): Drug {
    const name = (input.name ?? '').trim()
    if (!name) throw new AppError('VALIDATION', 'Drug name is required')
    const v = {
      name,
      search_name: normalizeForSearch(name),
      form: (input.form ?? '').trim(),
      strength: (input.strength ?? '').trim(),
      dose: (input.dose ?? '').trim(),
      frequency: (input.frequency ?? '').trim(),
      duration: (input.duration ?? '').trim(),
      route: (input.route ?? '').trim(),
      instructions: (input.instructions ?? '').trim()
    }
    const existing = this.getDrugByName(name)
    if (existing && existing.id !== input.id) throw new AppError('DUPLICATE', 'A drug with this name already exists')
    if (input.id) {
      this.db
        .prepare(
          `UPDATE drugs SET name=@name, search_name=@search_name, form=@form, strength=@strength, dose=@dose,
           frequency=@frequency, duration=@duration, route=@route, instructions=@instructions WHERE id=@id`
        )
        .run({ ...v, id: input.id })
      return rowToDrug(this.db.prepare('SELECT * FROM drugs WHERE id = ?').get(input.id) as Row)
    }
    const res = this.db
      .prepare(
        `INSERT INTO drugs(name, search_name, form, strength, dose, frequency, duration, route, instructions)
         VALUES(@name, @search_name, @form, @strength, @dose, @frequency, @duration, @route, @instructions)`
      )
      .run(v)
    return rowToDrug(this.db.prepare('SELECT * FROM drugs WHERE id = ?').get(res.lastInsertRowid) as Row)
  }

  deleteDrug(id: number): void {
    this.db.prepare('DELETE FROM drugs WHERE id = ?').run(id)
  }

  /** Called when a prescription is saved: adds unknown drugs to the library and bumps usage counts. */
  private learnDrugs(items: MedicineItem[]): void {
    const now = new Date().toISOString()
    for (const it of items) {
      if (!it.drugName) continue
      const existing = this.getDrugByName(it.drugName)
      if (existing) {
        this.db.prepare('UPDATE drugs SET use_count = use_count + 1, last_used_at = ? WHERE id = ?').run(now, existing.id)
      } else {
        const d = this.saveDrug({
          name: it.drugName,
          form: it.form,
          strength: it.strength,
          dose: it.dose,
          frequency: it.frequency,
          duration: it.duration,
          route: it.route,
          instructions: it.instructions
        })
        this.db.prepare('UPDATE drugs SET use_count = 1, last_used_at = ? WHERE id = ?').run(now, d.id)
      }
    }
  }

  // ---------------------------------------------------------------- dose phrases
  listDosePhrases(): DosePhrase[] {
    return this.db.prepare('SELECT id, text, position FROM dose_phrases ORDER BY position, id').all() as DosePhrase[]
  }

  saveDosePhrase(p: { id?: number; text: string }): DosePhrase {
    const text = (p.text ?? '').trim()
    if (!text) throw new AppError('VALIDATION', 'Phrase text is required')
    if (p.id) {
      this.db.prepare('UPDATE dose_phrases SET text = ? WHERE id = ?').run(text, p.id)
      return this.db.prepare('SELECT id, text, position FROM dose_phrases WHERE id = ?').get(p.id) as DosePhrase
    }
    const pos = (this.db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS p FROM dose_phrases').get() as Row).p
    const res = this.db.prepare('INSERT INTO dose_phrases(text, position) VALUES(?, ?)').run(text, pos)
    return { id: Number(res.lastInsertRowid), text, position: pos }
  }

  deleteDosePhrase(id: number): void {
    this.db.prepare('DELETE FROM dose_phrases WHERE id = ?').run(id)
  }

  reorderDosePhrases(ids: number[]): void {
    const stmt = this.db.prepare('UPDATE dose_phrases SET position = ? WHERE id = ?')
    this.db.transaction(() => ids.forEach((id, i) => stmt.run(i + 1, id)))()
  }

  // ---------------------------------------------------------------- favorites
  listFavorites(): Favorite[] {
    return (this.db.prepare('SELECT * FROM favorites ORDER BY name COLLATE NOCASE').all() as Row[]).map((r) => ({
      id: r.id,
      name: r.name,
      diagnosis: r.diagnosis,
      notes: r.notes,
      items: JSON.parse(r.items || '[]')
    }))
  }

  saveFavorite(f: FavoriteInput): Favorite {
    const name = (f.name ?? '').trim()
    if (!name) throw new AppError('VALIDATION', 'Template name is required')
    const items = (f.items ?? []).map(cleanItem).filter((i) => i.drugName)
    const params = { name, diagnosis: (f.diagnosis ?? '').trim(), notes: (f.notes ?? '').trim(), items: JSON.stringify(items) }
    let id = f.id
    if (id) {
      this.db.prepare('UPDATE favorites SET name=@name, diagnosis=@diagnosis, notes=@notes, items=@items WHERE id=@id').run({ ...params, id })
    } else {
      id = Number(this.db.prepare('INSERT INTO favorites(name, diagnosis, notes, items) VALUES(@name, @diagnosis, @notes, @items)').run(params).lastInsertRowid)
    }
    return { id, name, diagnosis: params.diagnosis, notes: params.notes, items }
  }

  deleteFavorite(id: number): void {
    this.db.prepare('DELETE FROM favorites WHERE id = ?').run(id)
  }

  // ---------------------------------------------------------------- prescriptions
  private snapshotFor(patient: Patient, date: string): PatientSnapshot {
    const lang = this.getSettings().printLanguage
    const on = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(date + 'T12:00:00') : new Date()
    return {
      name: patient.name,
      ageText: formatAge(patient.birthDate, lang, on),
      gender: patient.gender,
      weight: patient.weight
    }
  }

  savePrescription(input: PrescriptionInput): Prescription {
    const patient = this.getPatient(input.patientId)
    if (!patient) throw new AppError('VALIDATION', 'Please select a patient')
    const items = (input.items ?? []).map(cleanItem).filter((i) => i.drugName)
    const date = /^\d{4}-\d{2}-\d{2}$/.test(input.date ?? '') ? input.date : todayIso()
    const values = {
      patient_id: patient.id,
      date,
      diagnosis: (input.diagnosis ?? '').trim(),
      notes: (input.notes ?? '').trim(),
      next_visit: (input.nextVisit ?? '').trim(),
      lab_tests: (input.labTests ?? '').trim(),
      patient_snapshot: JSON.stringify(this.snapshotFor(patient, date))
    }
    const save = this.db.transaction(() => {
      let id = input.id
      if (id) {
        const res = this.db
          .prepare(
            `UPDATE prescriptions SET patient_id=@patient_id, date=@date, diagnosis=@diagnosis, notes=@notes,
             next_visit=@next_visit, lab_tests=@lab_tests, patient_snapshot=@patient_snapshot,
             updated_at=datetime('now','localtime') WHERE id=@id`
          )
          .run({ ...values, id })
        if (res.changes === 0) throw new AppError('NOT_FOUND', 'Prescription not found')
        this.db.prepare('DELETE FROM prescription_items WHERE prescription_id = ?').run(id)
      } else {
        id = Number(
          this.db
            .prepare(
              `INSERT INTO prescriptions(patient_id, date, diagnosis, notes, next_visit, lab_tests, patient_snapshot)
               VALUES(@patient_id, @date, @diagnosis, @notes, @next_visit, @lab_tests, @patient_snapshot)`
            )
            .run(values).lastInsertRowid
        )
        this.learnDrugs(items)
      }
      const ins = this.db.prepare(
        `INSERT INTO prescription_items(prescription_id, position, drug_name, form, strength, dose, frequency, duration, route, instructions)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      items.forEach((it, i) =>
        ins.run(id, i, it.drugName, it.form, it.strength, it.dose, it.frequency, it.duration, it.route, it.instructions)
      )
      if (input.id) {
        // Edited prescription: make sure any newly typed drug is learned too.
        for (const it of items) if (!this.getDrugByName(it.drugName)) this.learnDrugs([it])
      }
      return id
    })
    return this.getPrescription(save())!
  }

  getPrescription(id: number): Prescription | null {
    const r = this.db.prepare('SELECT * FROM prescriptions WHERE id = ?').get(id) as Row | undefined
    if (!r) return null
    const items = (this.db
      .prepare('SELECT * FROM prescription_items WHERE prescription_id = ? ORDER BY position')
      .all(id) as Row[]).map((i) => ({
      drugName: i.drug_name,
      form: i.form,
      strength: i.strength,
      dose: i.dose,
      frequency: i.frequency,
      duration: i.duration,
      route: i.route,
      instructions: i.instructions
    }))
    let patient: PatientSnapshot = { name: '', ageText: '', gender: '', weight: '' }
    try {
      patient = { ...patient, ...JSON.parse(r.patient_snapshot) }
    } catch {
      /* keep empty snapshot */
    }
    return {
      id: r.id,
      patientId: r.patient_id,
      date: r.date,
      diagnosis: r.diagnosis,
      notes: r.notes,
      nextVisit: r.next_visit,
      labTests: r.lab_tests,
      items,
      patient,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }
  }

  deletePrescription(id: number): void {
    this.db.prepare('DELETE FROM prescriptions WHERE id = ?').run(id)
  }

  listPrescriptions(opts: { patientId?: number; from?: string; to?: string; limit?: number } = {}): PrescriptionListItem[] {
    const where: string[] = []
    const params: unknown[] = []
    if (opts.patientId) {
      where.push('r.patient_id = ?')
      params.push(opts.patientId)
    }
    if (opts.from) {
      where.push('r.date >= ?')
      params.push(opts.from)
    }
    if (opts.to) {
      where.push('r.date <= ?')
      params.push(opts.to)
    }
    params.push(opts.limit ?? 500)
    const rows = this.db
      .prepare(
        `SELECT r.id, r.patient_id, p.name AS patient_name, r.date, r.diagnosis,
           (SELECT COUNT(*) FROM prescription_items i WHERE i.prescription_id = r.id) AS drug_count,
           (SELECT GROUP_CONCAT(drug_name, ', ') FROM (SELECT drug_name FROM prescription_items i
              WHERE i.prescription_id = r.id ORDER BY position)) AS drugs
         FROM prescriptions r JOIN patients p ON p.id = r.patient_id
         ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
         ORDER BY r.date DESC, r.id DESC LIMIT ?`
      )
      .all(...params) as Row[]
    return rows.map((r) => ({
      id: r.id,
      patientId: r.patient_id,
      patientName: r.patient_name,
      date: r.date,
      diagnosis: r.diagnosis,
      drugCount: r.drug_count,
      drugsSummary: r.drugs ?? ''
    }))
  }

  /** Previous diagnoses for autocomplete, most used first. */
  diagnosisSuggestions(query: string, limit = 10): string[] {
    const q = (query ?? '').trim()
    const rows = this.db
      .prepare(
        `SELECT diagnosis, COUNT(*) AS c FROM prescriptions WHERE diagnosis <> '' AND diagnosis LIKE ? ESCAPE '\\'
         GROUP BY diagnosis COLLATE NOCASE ORDER BY c DESC, MAX(id) DESC LIMIT ?`
      )
      .all(`%${likeEscape(q)}%`, limit) as Row[]
    return rows.map((r) => r.diagnosis)
  }

  // ---------------------------------------------------------------- layouts
  listLayouts(): LayoutRecord[] {
    return (this.db.prepare('SELECT * FROM layouts ORDER BY is_default DESC, name COLLATE NOCASE').all() as Row[]).map(
      (r) => ({
        id: r.id,
        name: r.name,
        isDefault: !!r.is_default,
        layout: normalizeLayout(JSON.parse(r.data)),
        updatedAt: r.updated_at
      })
    )
  }

  getLayout(id: number): LayoutRecord | null {
    return this.listLayouts().find((l) => l.id === id) ?? null
  }

  getDefaultLayout(): LayoutRecord | null {
    const all = this.listLayouts()
    return all.find((l) => l.isDefault) ?? all[0] ?? null
  }

  saveLayout(rec: { id?: number; name: string; layout: Layout; isDefault?: boolean }): LayoutRecord {
    const name = (rec.name ?? '').trim()
    if (!name) throw new AppError('VALIDATION', 'Layout name is required')
    const data = JSON.stringify(normalizeLayout(rec.layout))
    const id = this.db.transaction(() => {
      let id = rec.id
      if (id) {
        this.db
          .prepare("UPDATE layouts SET name = ?, data = ?, updated_at = datetime('now','localtime') WHERE id = ?")
          .run(name, data, id)
      } else {
        id = Number(this.db.prepare('INSERT INTO layouts(name, data) VALUES(?, ?)').run(name, data).lastInsertRowid)
      }
      const hasDefault = (this.db.prepare('SELECT COUNT(*) AS c FROM layouts WHERE is_default = 1').get() as Row).c > 0
      if (rec.isDefault || !hasDefault) this.setDefaultLayout(id)
      return id
    })()
    return this.getLayout(id)!
  }

  setDefaultLayout(id: number): void {
    this.db.transaction(() => {
      this.db.prepare('UPDATE layouts SET is_default = 0').run()
      this.db.prepare('UPDATE layouts SET is_default = 1 WHERE id = ?').run(id)
    })()
  }

  deleteLayout(id: number): void {
    const count = (this.db.prepare('SELECT COUNT(*) AS c FROM layouts').get() as Row).c
    if (count <= 1) throw new AppError('LAST_LAYOUT', 'You need at least one layout')
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM layouts WHERE id = ?').run(id)
      const hasDefault = (this.db.prepare('SELECT COUNT(*) AS c FROM layouts WHERE is_default = 1').get() as Row).c > 0
      if (!hasDefault) {
        const first = this.db.prepare('SELECT id FROM layouts ORDER BY id LIMIT 1').get() as Row
        this.setDefaultLayout(first.id)
      }
    })()
  }

  // ---------------------------------------------------------------- reports
  report(now: Date = new Date()): ReportSummary {
    const today = todayIso(now)
    const month = today.slice(0, 7)
    const from30 = todayIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29))
    const from12 = todayIso(new Date(now.getFullYear(), now.getMonth() - 11, 1))
    const one = (sql: string, ...p: unknown[]) => (this.db.prepare(sql).get(...p) as Row).c as number
    const perDay = this.db
      .prepare(
        `SELECT date AS day, COUNT(*) AS prescriptions, COUNT(DISTINCT patient_id) AS patients
         FROM prescriptions WHERE date >= ? GROUP BY date ORDER BY date`
      )
      .all(from30) as ReportSummary['perDay']
    const perMonth = this.db
      .prepare(
        `SELECT substr(date, 1, 7) AS month, COUNT(*) AS prescriptions, COUNT(DISTINCT patient_id) AS patients
         FROM prescriptions WHERE date >= ? GROUP BY month ORDER BY month`
      )
      .all(from12) as ReportSummary['perMonth']
    const topDrugs = this.db
      .prepare(
        `SELECT MIN(drug_name) AS name, COUNT(*) AS count FROM prescription_items
         GROUP BY drug_name COLLATE NOCASE ORDER BY count DESC, name LIMIT 20`
      )
      .all() as ReportSummary['topDrugs']
    return {
      totalPatients: one('SELECT COUNT(*) AS c FROM patients'),
      totalPrescriptions: one('SELECT COUNT(*) AS c FROM prescriptions'),
      today: one('SELECT COUNT(*) AS c FROM prescriptions WHERE date = ?', today),
      thisMonth: one("SELECT COUNT(*) AS c FROM prescriptions WHERE substr(date, 1, 7) = ?", month),
      perDay,
      perMonth,
      topDrugs
    }
  }

  /** Flat rows for CSV export. */
  exportPrescriptionRows(): Row[] {
    return this.db
      .prepare(
        `SELECT r.id AS prescription_id, r.date, p.name AS patient_name, p.phone, r.diagnosis,
           i.position + 1 AS line, i.drug_name, i.form, i.strength, i.dose, i.frequency, i.duration, i.route,
           i.instructions, r.notes, r.lab_tests, r.next_visit
         FROM prescriptions r JOIN patients p ON p.id = r.patient_id
         LEFT JOIN prescription_items i ON i.prescription_id = r.id
         ORDER BY r.date, r.id, i.position`
      )
      .all() as Row[]
  }
}
