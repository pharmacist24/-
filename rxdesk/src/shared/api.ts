import type {
  AppInfo,
  Condition,
  ConditionInput,
  AppSettings,
  BackupInfo,
  ClinicProfile,
  DosePhrase,
  Drug,
  DrugInput,
  Favorite,
  FavoriteInput,
  LayoutRecord,
  Patient,
  PatientInput,
  PatientListItem,
  Prescription,
  PrescriptionInput,
  PrescriptionListItem,
  PrinterInfo,
  PrintOptions,
  ReportSummary
} from './types'
import type { Layout, PaperPreset } from './layout/types'

export interface SetupPayload {
  profile: ClinicProfile
  language: 'ar' | 'en'
  paper: { preset: PaperPreset; widthMm: number; heightMm: number }
  pin: string
  samplePatients: boolean
}

export interface RestoreCandidate {
  path: string
  version: number
  patients: number
  prescriptions: number
  createdAt: string
}

/** Every call the renderer can make to the main process. */
export interface Api {
  app: {
    info(): Promise<AppInfo>
    openDataFolder(): Promise<void>
    openLogFile(): Promise<void>
    logError(message: string): Promise<void>
  }
  auth: {
    unlock(pin: string): Promise<boolean>
    lock(): Promise<void>
    setPin(currentPin: string, newPin: string): Promise<void>
  }
  settings: {
    get(): Promise<AppSettings>
    update(patch: Partial<AppSettings>): Promise<AppSettings>
    getProfile(): Promise<ClinicProfile>
    saveProfile(p: Partial<ClinicProfile>): Promise<ClinicProfile>
    completeSetup(payload: SetupPayload): Promise<AppSettings>
  }
  patients: {
    search(query: string, limit?: number): Promise<PatientListItem[]>
    get(id: number): Promise<Patient | null>
    save(p: PatientInput): Promise<Patient>
    delete(id: number): Promise<void>
  }
  rx: {
    save(p: PrescriptionInput): Promise<Prescription>
    get(id: number): Promise<Prescription | null>
    delete(id: number): Promise<void>
    list(opts?: { patientId?: number; from?: string; to?: string; limit?: number }): Promise<PrescriptionListItem[]>
    diagnoses(query: string): Promise<string[]>
  }
  drugs: {
    search(query: string): Promise<Drug[]>
    list(): Promise<Drug[]>
    save(d: DrugInput): Promise<Drug>
    delete(id: number): Promise<void>
  }
  phrases: {
    list(): Promise<DosePhrase[]>
    save(p: { id?: number; text: string }): Promise<DosePhrase>
    delete(id: number): Promise<void>
    reorder(ids: number[]): Promise<void>
  }
  conditions: {
    search(query: string): Promise<Condition[]>
    byNames(names: string[]): Promise<Condition[]>
    list(): Promise<Condition[]>
    save(c: ConditionInput): Promise<Condition>
    delete(id: number): Promise<void>
    resetBuiltins(): Promise<void>
  }
  favorites: {
    list(): Promise<Favorite[]>
    save(f: FavoriteInput): Promise<Favorite>
    delete(id: number): Promise<void>
  }
  layouts: {
    list(): Promise<LayoutRecord[]>
    save(rec: { id?: number; name: string; layout: Layout; isDefault?: boolean }): Promise<LayoutRecord>
    delete(id: number): Promise<void>
    setDefault(id: number): Promise<void>
    exportToFile(id: number): Promise<string | null>
    importFromFile(): Promise<LayoutRecord | null>
  }
  print: {
    printers(): Promise<PrinterInfo[]>
    print(html: string, opts: PrintOptions): Promise<void>
    pdf(html: string, opts: PrintOptions, suggestedName: string): Promise<string | null>
  }
  backup: {
    now(): Promise<BackupInfo | null>
    chooseFolder(): Promise<string | null>
    runAutoNow(): Promise<BackupInfo>
    listAuto(): Promise<BackupInfo[]>
    pickRestoreFile(): Promise<RestoreCandidate | null>
    restore(path: string): Promise<void>
  }
  exports: {
    patientsCsv(): Promise<string | null>
    prescriptionsCsv(): Promise<string | null>
  }
  reports: {
    summary(): Promise<ReportSummary>
  }
}

export type ApiNamespace = keyof Api

/** Methods allowed while the app is locked with a PIN. */
export const UNLOCKED_METHODS = new Set(['app.info', 'app.logError', 'auth.unlock', 'settings.get'])

export interface PreloadBridge {
  invoke(method: string, args: unknown[]): Promise<unknown>
  on(channel: 'db-replaced' | 'backup-failed' | 'locked', listener: (payload: unknown) => void): () => void
}
