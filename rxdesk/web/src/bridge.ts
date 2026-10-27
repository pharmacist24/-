// The web app's stand-in for the desktop main process: window.rxdesk.invoke('ns.fn', args) runs the
// same Repo code against the selected clinic's in-browser database. Files are downloaded/picked in
// the browser and printing uses the browser's print dialog (which can also save as PDF).
import type { Api, PreloadBridge } from '@shared/api'
import type { IpcResult, SyncStatus } from '@shared/types'
import { normalizeLayout } from '@shared/layout/defaults'
import { patientsCsv, prescriptionsCsv } from '@shared/csv'
import { drugsXlsxBytes, planImport, readDrugBytes, TEMPLATE_ROWS } from '@shared/drugsSheet'
import { todayIso } from '@shared/text'
import { AppError, type Repo } from '../../src/main/db/repo'

type Handlers = { [N in keyof Api]: { [M in keyof Api[N]]: Api[N][M] } }

let repo: Repo | null = null
let onWrite: () => void = () => undefined
const r = () => {
  if (!repo) throw new AppError('DB_ERROR', 'No clinic is open')
  return repo
}

export function setClinicRepo(next: Repo | null, afterWrite: () => void): void {
  repo = next
  onWrite = afterWrite
}

// ------------------------------------------------------------------ browser files
function download(bytes: Uint8Array | string, name: string, type: string): string {
  const blob = new Blob([bytes as BlobPart], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
  return name
}

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.style.display = 'none'
    input.addEventListener('change', () => {
      resolve(input.files?.[0] ?? null)
      input.remove()
    })
    input.addEventListener('cancel', () => {
      resolve(null)
      input.remove()
    })
    document.body.appendChild(input)
    input.click()
  })
}

const pickedFiles = new Map<string, File>()

function printHtml(html: string): Promise<void> {
  return new Promise((resolve) => {
    const frame = document.createElement('iframe')
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
    frame.srcdoc = html
    frame.onload = () => {
      const w = frame.contentWindow!
      // Wait for fonts and images inside the document before printing.
      const go = () => {
        w.focus()
        w.print()
        setTimeout(() => frame.remove(), 1000)
        resolve()
      }
      const fonts = (w.document as Document & { fonts?: FontFaceSet }).fonts
      if (fonts?.ready) fonts.ready.then(() => setTimeout(go, 150))
      else setTimeout(go, 300)
    }
    document.body.appendChild(frame)
  })
}

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const notOnWeb = async () => {
  throw new AppError('FORBIDDEN', 'Not available in the web app')
}

let syncStatus: () => SyncStatus = () => ({ signedIn: true, email: '', clinicName: '', syncing: false, online: true, lastSyncAt: '', lastError: '', pending: 0 })
export function setSyncStatusSource(fn: () => SyncStatus): void {
  syncStatus = fn
}

export const handlers: Handlers = {
  app: {
    async info() {
      return { version: 'web', dataDir: '', dbPath: '', logPath: '', locked: false }
    },
    async openDataFolder() {},
    async openLogFile() {},
    async logError(message: string) {
      console.error('[rxdesk]', message)
    }
  },
  auth: {
    async unlock() {
      return true
    },
    async lock() {},
    setPin: notOnWeb
  },
  settings: {
    async get() {
      return r().getSettings()
    },
    async update(patch) {
      // The PIN and the "setup done" flag belong to each PC.
      const { pinEnabled: _p, setupCompleted: _s, defaultPrinter: _d, autoBackup: _a, ...rest } = patch
      return r().updateSettings(rest)
    },
    async getProfile() {
      return r().getProfile()
    },
    async saveProfile(p) {
      return r().saveProfile(p)
    },
    completeSetup: notOnWeb
  },
  patients: {
    async search(q, limit) {
      return r().searchPatients(q, limit)
    },
    async get(id) {
      return r().getPatient(id)
    },
    async save(p) {
      return r().savePatient(p)
    },
    async delete(id) {
      r().deletePatient(id)
    }
  },
  rx: {
    async save(p) {
      return r().savePrescription(p)
    },
    async get(id) {
      return r().getPrescription(id)
    },
    async delete(id) {
      r().deletePrescription(id)
    },
    async list(opts) {
      return r().listPrescriptions(opts)
    },
    async diagnoses(q) {
      return r().diagnosisSuggestions(q)
    }
  },
  drugs: {
    async search(q) {
      return r().searchDrugs(q)
    },
    async list() {
      return r().listDrugs()
    },
    async save(d) {
      return r().saveDrug(d)
    },
    async delete(id) {
      r().deleteDrug(id)
    },
    async exportXlsx() {
      return download(await drugsXlsxBytes(r().listDrugs(), { withUseCount: true }), `RxDesk-drugs-${todayIso()}.xlsx`, XLSX)
    },
    async templateXlsx() {
      return download(await drugsXlsxBytes(TEMPLATE_ROWS), 'RxDesk-drugs-template.xlsx', XLSX)
    },
    async previewImport() {
      const file = await pickFile('.xlsx,.csv')
      if (!file) return null
      const read = await readSheet(file)
      const plan = planImport(read.rows, (n) => r().getDrugByName(n))
      const token = file.name + '#' + Date.now()
      pickedFiles.set(token, file)
      return { file: token, newCount: plan.newCount, updateCount: plan.updateCount, sameCount: plan.sameCount, duplicates: plan.duplicates, skipped: read.skipped, sample: plan.rows.slice(0, 50) }
    },
    async applyImport(token) {
      const file = pickedFiles.get(token)
      if (!file) throw new AppError('BAD_FILE', 'Pick the file again')
      const read = await readSheet(file)
      const plan = planImport(read.rows, (n) => r().getDrugByName(n))
      pickedFiles.delete(token)
      return r().importDrugs(plan.rows)
    }
  },
  phrases: {
    async list() {
      return r().listDosePhrases()
    },
    async save(p) {
      return r().saveDosePhrase(p)
    },
    async delete(id) {
      r().deleteDosePhrase(id)
    },
    async reorder(ids) {
      r().reorderDosePhrases(ids)
    }
  },
  conditions: {
    async search(q) {
      return r().searchConditions(q)
    },
    async byNames(names) {
      return r().conditionsByNames(Array.isArray(names) ? names.map(String) : [])
    },
    async list() {
      return r().listConditions()
    },
    async save(c) {
      return r().saveCondition(c)
    },
    async delete(id) {
      r().deleteCondition(id)
    },
    async resetBuiltins() {
      r().resetBuiltinConditions()
    }
  },
  favorites: {
    async list() {
      return r().listFavorites()
    },
    async save(f) {
      return r().saveFavorite(f)
    },
    async delete(id) {
      r().deleteFavorite(id)
    }
  },
  layouts: {
    async list() {
      return r().listLayouts()
    },
    async save(rec) {
      return r().saveLayout(rec)
    },
    async delete(id) {
      r().deleteLayout(id)
    },
    async setDefault(id) {
      r().setDefaultLayout(id)
    },
    async exportToFile(id) {
      const rec = r().getLayout(id)
      if (!rec) throw new AppError('NOT_FOUND', 'Layout not found')
      const payload = { format: 'rxdesk-layout', formatVersion: 1, name: rec.name, exportedAt: new Date().toISOString(), layout: rec.layout }
      return download(JSON.stringify(payload, null, 2), rec.name.replace(/[\\/:*?"<>|]+/g, '-') + '.rxlayout', 'application/json')
    },
    async importFromFile() {
      const file = await pickFile('.rxlayout,.json')
      if (!file) return null
      let parsed: any
      try {
        parsed = JSON.parse(await file.text())
      } catch {
        throw new AppError('BAD_LAYOUT', 'This file is not a valid layout file')
      }
      if (parsed?.format !== 'rxdesk-layout' || !parsed.layout) throw new AppError('BAD_LAYOUT', 'This file is not a valid layout file')
      const existing = new Set(r().listLayouts().map((l) => l.name))
      let name = String(parsed.name || 'Imported layout').slice(0, 80)
      for (let i = 2; existing.has(name); i++) name = `${String(parsed.name || 'Imported layout').slice(0, 76)} (${i})`
      return r().saveLayout({ name, layout: normalizeLayout(parsed.layout) })
    }
  },
  print: {
    async printers() {
      return []
    },
    async print(html) {
      await printHtml(html)
    },
    async pdf(html) {
      // The browser's print dialog offers "Save as PDF".
      await printHtml(html)
      return null
    }
  },
  backup: {
    now: notOnWeb,
    chooseFolder: notOnWeb,
    runAutoNow: notOnWeb,
    listAuto: async () => [],
    pickRestoreFile: notOnWeb,
    restore: notOnWeb
  },
  exports: {
    async patientsCsv() {
      return download(patientsCsv(r().allPatients(), r().getSettings().language), `RxDesk-patients-${todayIso()}.csv`, 'text/csv')
    },
    async prescriptionsCsv() {
      return download(prescriptionsCsv(r().exportPrescriptionRows(), r().getSettings().language), `RxDesk-prescriptions-${todayIso()}.csv`, 'text/csv')
    }
  },
  reports: {
    async summary() {
      return r().report()
    }
  },
  sync: {
    async status() {
      return syncStatus()
    },
    signIn: notOnWeb,
    signOut: notOnWeb,
    async now() {
      onWrite()
      return syncStatus()
    }
  }
}

async function readSheet(file: File) {
  try {
    return await readDrugBytes(await file.arrayBuffer(), file.name)
  } catch {
    throw new AppError('BAD_FILE', 'This file could not be read')
  }
}

const WRITES = /\.(save|delete|update|saveProfile|reorder|setDefault|resetBuiltins|applyImport|importFromFile)$/

type Listener = (payload: unknown) => void
const listeners = new Map<string, Set<Listener>>()

export function emit(channel: string, payload: unknown): void {
  listeners.get(channel)?.forEach((l) => l(payload))
}

export const bridge: PreloadBridge = {
  async invoke(method, args) {
    const [ns, fn] = String(method).split('.')
    const impl = (handlers as any)[ns]?.[fn]
    if (typeof impl !== 'function') return { ok: false, code: 'UNKNOWN_METHOD', message: method } satisfies IpcResult<unknown>
    try {
      const data = await impl(...(Array.isArray(args) ? args : []))
      if (WRITES.test(method)) onWrite()
      return { ok: true, data }
    } catch (e) {
      const code = (e as { code?: string }).code
      console.error(`[rxdesk] ${method} failed`, e)
      return { ok: false, code: code && /^[A-Z_]+$/.test(code) ? code : 'UNKNOWN', message: (e as Error)?.message ?? String(e) }
    }
  },
  on(channel, listener) {
    if (!listeners.has(channel)) listeners.set(channel, new Set())
    listeners.get(channel)!.add(listener)
    return () => listeners.get(channel)?.delete(listener)
  }
}
