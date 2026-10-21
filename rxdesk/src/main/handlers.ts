import { app, BrowserWindow, dialog, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import type { Api, SetupPayload } from '@shared/api'
import { AppError } from './db/repo'
import { seedSamplePatients } from './db/seed'
import { blankLayout, normalizeLayout, sampleA4Layout, sampleA5Layout } from '@shared/layout/defaults'
import { createBackup, listAutoBackups, manualBackupName, prepareRestore } from './services/backup'
import { hashPin, isValidPin, PinThrottle, verifyPin } from './services/pin'
import { htmlToPdf, listPrinters, printHtml } from './services/print'
import { toCsv } from './services/csv'
import { formatAge, genderText, todayIso } from '@shared/text'
import { log, getLogFile } from './logger'
import { state, replaceDatabase, runAutoBackup, autoBackupFolder } from './state'

type Handlers = { [N in keyof Api]: { [M in keyof Api[N]]: Api[N][M] } }

const throttle = new PinThrottle()
const repo = () => state.repo!
const win = () => state.mainWindow!

function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'file'
}

export const handlers: Handlers = {
  app: {
    async info() {
      return {
        version: app.getVersion(),
        dataDir: state.dataDir,
        dbPath: state.dbPath,
        logPath: getLogFile(),
        locked: state.locked
      }
    },
    async openDataFolder() {
      await shell.openPath(state.dataDir)
    },
    async openLogFile() {
      await shell.openPath(getLogFile())
    },
    async logError(message: string) {
      log.error('[renderer]', String(message).slice(0, 4000))
    }
  },

  auth: {
    async unlock(pin: string) {
      const wait = throttle.check()
      if (wait > 0) throw new AppError('PIN_WAIT', String(Math.ceil(wait / 1000)))
      const ok = verifyPin(String(pin), repo().getSecret('pin'))
      if (ok) {
        throttle.success()
        state.locked = false
      } else {
        throttle.fail()
        log.warn('Wrong PIN entered')
      }
      return ok
    },
    async lock() {
      if (repo().getSettings().pinEnabled) state.locked = true
    },
    async setPin(currentPin: string, newPin: string) {
      const settings = repo().getSettings()
      if (settings.pinEnabled && !verifyPin(String(currentPin), repo().getSecret('pin'))) {
        throw new AppError('PIN_WRONG', 'The current PIN is not correct')
      }
      if (!newPin) {
        repo().setSecret('pin', '')
        repo().updateSettings({ pinEnabled: false })
        return
      }
      if (!isValidPin(newPin)) throw new AppError('PIN_FORMAT', 'PIN must be 4 to 8 digits')
      repo().setSecret('pin', hashPin(newPin))
      repo().updateSettings({ pinEnabled: true })
    }
  },

  settings: {
    async get() {
      return repo().getSettings()
    },
    async update(patch) {
      // These are changed only through their dedicated flows.
      const { pinEnabled: _p, setupCompleted: _s, ...rest } = patch
      return repo().updateSettings(rest)
    },
    async getProfile() {
      return repo().getProfile()
    },
    async saveProfile(p) {
      return repo().saveProfile(p)
    },
    async completeSetup(payload: SetupPayload) {
      const r = repo()
      if (payload.pin && !isValidPin(payload.pin)) throw new AppError('PIN_FORMAT', 'PIN must be 4 to 8 digits')
      r.db.transaction(() => {
        r.saveProfile(payload.profile)
        // Make the doctor's chosen paper size the default layout.
        const { preset, widthMm, heightMm } = payload.paper
        const layouts = r.listLayouts()
        let target = layouts.find((l) => l.layout.paper.preset === preset && preset !== 'custom')
        if (!target) {
          // Start from the closest built-in design, scaled to the chosen page.
          const base = blankLayout(preset, { widthMm, heightMm })
          const src = base.paper.widthMm >= 180 ? sampleA4Layout() : sampleA5Layout()
          const sx = base.paper.widthMm / src.paper.widthMm
          const sy = base.paper.heightMm / src.paper.heightMm
          base.marginsMm = src.marginsMm
          base.elements = src.elements.map((e) => ({ ...e, x: e.x * sx, y: e.y * sy, w: e.w * sx, h: e.h * sy }))
          const name = preset === 'custom' ? `Custom ${widthMm}×${heightMm} mm` : preset
          target = r.saveLayout({ name, layout: base })
        }
        r.setDefaultLayout(target.id)
        if (payload.samplePatients) seedSamplePatients(r)
        if (payload.pin) r.setSecret('pin', hashPin(payload.pin))
        r.updateSettings({
          language: payload.language,
          printLanguage: payload.language,
          pinEnabled: !!payload.pin,
          setupCompleted: true
        })
      })()
      log.info('First-run setup completed')
      return r.getSettings()
    }
  },

  patients: {
    async search(q, limit) {
      return repo().searchPatients(q, limit)
    },
    async get(id) {
      return repo().getPatient(id)
    },
    async save(p) {
      return repo().savePatient(p)
    },
    async delete(id) {
      repo().deletePatient(id)
    }
  },

  rx: {
    async save(p) {
      return repo().savePrescription(p)
    },
    async get(id) {
      return repo().getPrescription(id)
    },
    async delete(id) {
      repo().deletePrescription(id)
    },
    async list(opts) {
      return repo().listPrescriptions(opts)
    },
    async diagnoses(q) {
      return repo().diagnosisSuggestions(q)
    }
  },

  drugs: {
    async search(q) {
      return repo().searchDrugs(q)
    },
    async list() {
      return repo().listDrugs()
    },
    async save(d) {
      return repo().saveDrug(d)
    },
    async delete(id) {
      repo().deleteDrug(id)
    }
  },

  phrases: {
    async list() {
      return repo().listDosePhrases()
    },
    async save(p) {
      return repo().saveDosePhrase(p)
    },
    async delete(id) {
      repo().deleteDosePhrase(id)
    },
    async reorder(ids) {
      repo().reorderDosePhrases(ids)
    }
  },

  conditions: {
    async search(q) {
      return repo().searchConditions(q)
    },
    async byNames(names) {
      return repo().conditionsByNames(Array.isArray(names) ? names.map(String) : [])
    },
    async list() {
      return repo().listConditions()
    },
    async save(c) {
      return repo().saveCondition(c)
    },
    async delete(id) {
      repo().deleteCondition(id)
    },
    async resetBuiltins() {
      repo().resetBuiltinConditions()
    }
  },

  favorites: {
    async list() {
      return repo().listFavorites()
    },
    async save(f) {
      return repo().saveFavorite(f)
    },
    async delete(id) {
      repo().deleteFavorite(id)
    }
  },

  layouts: {
    async list() {
      return repo().listLayouts()
    },
    async save(rec) {
      return repo().saveLayout(rec)
    },
    async delete(id) {
      repo().deleteLayout(id)
    },
    async setDefault(id) {
      repo().setDefaultLayout(id)
    },
    async exportToFile(id) {
      const rec = repo().getLayout(id)
      if (!rec) throw new AppError('NOT_FOUND', 'Layout not found')
      const res = await dialog.showSaveDialog(win(), {
        defaultPath: safeFileName(rec.name) + '.rxlayout',
        filters: [{ name: 'RxDesk layout', extensions: ['rxlayout'] }]
      })
      if (res.canceled || !res.filePath) return null
      const payload = { format: 'rxdesk-layout', formatVersion: 1, name: rec.name, exportedAt: new Date().toISOString(), layout: rec.layout }
      fs.writeFileSync(res.filePath, JSON.stringify(payload, null, 2), 'utf8')
      return res.filePath
    },
    async importFromFile() {
      const res = await dialog.showOpenDialog(win(), {
        properties: ['openFile'],
        filters: [{ name: 'RxDesk layout', extensions: ['rxlayout', 'json'] }]
      })
      if (res.canceled || !res.filePaths[0]) return null
      let parsed: any
      try {
        parsed = JSON.parse(fs.readFileSync(res.filePaths[0], 'utf8'))
      } catch {
        throw new AppError('BAD_LAYOUT', 'This file is not a valid layout file')
      }
      if (parsed?.format !== 'rxdesk-layout' || !parsed.layout) throw new AppError('BAD_LAYOUT', 'This file is not a valid layout file')
      const existing = new Set(repo().listLayouts().map((l) => l.name))
      let name = String(parsed.name || 'Imported layout').slice(0, 80)
      for (let i = 2; existing.has(name); i++) name = `${String(parsed.name || 'Imported layout').slice(0, 76)} (${i})`
      return repo().saveLayout({ name, layout: normalizeLayout(parsed.layout) })
    }
  },

  print: {
    async printers() {
      return listPrinters(win())
    },
    async print(html, opts) {
      await printHtml(html, opts)
    },
    async pdf(html, opts, suggestedName) {
      const res = await dialog.showSaveDialog(win(), {
        defaultPath: path.join(app.getPath('documents'), safeFileName(suggestedName) + '.pdf'),
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      })
      if (res.canceled || !res.filePath) return null
      const buf = await htmlToPdf(html, opts)
      fs.writeFileSync(res.filePath, buf)
      shell.openPath(res.filePath).catch(() => undefined)
      return res.filePath
    }
  },

  backup: {
    async now() {
      const res = await dialog.showSaveDialog(win(), {
        defaultPath: path.join(app.getPath('documents'), manualBackupName()),
        filters: [{ name: 'RxDesk backup', extensions: ['zip'] }]
      })
      if (res.canceled || !res.filePath) return null
      const info = await createBackup(repo(), res.filePath, app.getVersion())
      log.info('Manual backup created', info.path)
      return info
    },
    async chooseFolder() {
      const res = await dialog.showOpenDialog(win(), { properties: ['openDirectory', 'createDirectory'] })
      if (res.canceled || !res.filePaths[0]) return null
      return res.filePaths[0]
    },
    async runAutoNow() {
      const info = await runAutoBackup(true)
      if (!info) throw new AppError('BACKUP_FAILED', 'Backup failed')
      return info
    },
    async listAuto() {
      return listAutoBackups(autoBackupFolder())
    },
    async pickRestoreFile() {
      const res = await dialog.showOpenDialog(win(), {
        properties: ['openFile'],
        filters: [{ name: 'RxDesk backup', extensions: ['zip', 'db'] }]
      })
      if (res.canceled || !res.filePaths[0]) return null
      const info = await prepareRestore(res.filePaths[0], path.join(app.getPath('temp'), 'rxdesk-restore'))
      return { path: res.filePaths[0], version: info.version, patients: info.patients, prescriptions: info.prescriptions, createdAt: info.createdAt }
    },
    async restore(file) {
      const prepared = await prepareRestore(file, path.join(app.getPath('temp'), 'rxdesk-restore'))
      await replaceDatabase(prepared.dbPath)
      log.info('Database restored from', file)
    }
  },

  exports: {
    async patientsCsv() {
      const res = await dialog.showSaveDialog(win(), {
        defaultPath: path.join(app.getPath('documents'), `RxDesk-patients-${todayIso()}.csv`),
        filters: [{ name: 'CSV (Excel)', extensions: ['csv'] }]
      })
      if (res.canceled || !res.filePath) return null
      const lang = repo().getSettings().language
      const rows = repo().allPatients().map((p) => ({
        ...p,
        age: formatAge(p.birthDate, lang),
        genderText: genderText(p.gender, lang)
      }))
      const headers = lang === 'ar'
        ? ['رقم', 'الاسم', 'تاريخ الميلاد', 'السن', 'النوع', 'الهاتف', 'الوزن', 'الحساسية', 'الأمراض المزمنة', 'ملاحظات', 'تاريخ الإضافة']
        : ['ID', 'Name', 'Birth date', 'Age', 'Gender', 'Phone', 'Weight', 'Allergies', 'Chronic diseases', 'Notes', 'Created']
      fs.writeFileSync(
        res.filePath,
        toCsv(headers, rows as any, ['id', 'name', 'birthDate', 'age', 'genderText', 'phone', 'weight', 'allergies', 'chronicDiseases', 'notes', 'createdAt']),
        'utf8'
      )
      return res.filePath
    },
    async prescriptionsCsv() {
      const res = await dialog.showSaveDialog(win(), {
        defaultPath: path.join(app.getPath('documents'), `RxDesk-prescriptions-${todayIso()}.csv`),
        filters: [{ name: 'CSV (Excel)', extensions: ['csv'] }]
      })
      if (res.canceled || !res.filePath) return null
      const lang = repo().getSettings().language
      const keys = ['prescription_id', 'date', 'patient_name', 'phone', 'diagnosis', 'line', 'drug_name', 'form', 'strength', 'dose', 'frequency', 'duration', 'route', 'instructions', 'notes', 'lab_tests', 'next_visit']
      const headers = lang === 'ar'
        ? ['رقم الروشتة', 'التاريخ', 'المريض', 'الهاتف', 'التشخيص', 'السطر', 'الدواء', 'الشكل', 'التركيز', 'الجرعة', 'التكرار', 'المدة', 'طريقة الاستخدام', 'تعليمات', 'ملاحظات', 'تحاليل', 'الإعادة']
        : ['Prescription', 'Date', 'Patient', 'Phone', 'Diagnosis', 'Line', 'Drug', 'Form', 'Strength', 'Dose', 'Frequency', 'Duration', 'Route', 'Instructions', 'Advice', 'Lab tests', 'Next visit']
      fs.writeFileSync(res.filePath, toCsv(headers, repo().exportPrescriptionRows(), keys), 'utf8')
      return res.filePath
    }
  },

  reports: {
    async summary() {
      return repo().report()
    }
  }
}

export function findWindow(): BrowserWindow | null {
  return state.mainWindow && !state.mainWindow.isDestroyed() ? state.mainWindow : null
}
