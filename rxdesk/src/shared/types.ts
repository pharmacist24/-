// Shared data types used by the main process, preload and renderer.

export type Lang = 'ar' | 'en'
export type Gender = 'male' | 'female' | ''

export interface ClinicProfile {
  doctorNameAr: string
  doctorNameEn: string
  specialtyAr: string
  specialtyEn: string
  clinicName: string
  address: string
  phones: string
  licenseNumber: string
  /** Logo as a data URL (image/png or image/jpeg), or empty string. */
  logo: string
}

export interface AutoBackupSettings {
  enabled: boolean
  folder: string
  keep: number
  lastRunAt: string
}

export interface AppSettings {
  setupCompleted: boolean
  language: Lang
  /** Language used for generated words on the printout (e.g. "years", "Male"). */
  printLanguage: Lang
  defaultPrinter: string
  silentPrint: boolean
  copies: number
  autoBackup: AutoBackupSettings
  pinEnabled: boolean
}

export interface Patient {
  id: number
  name: string
  /** ISO date yyyy-mm-dd, or '' if unknown */
  birthDate: string
  /** true if birthDate was calculated from an age the user typed */
  birthDateEstimated: boolean
  gender: Gender
  phone: string
  weight: string
  allergies: string
  chronicDiseases: string
  notes: string
  createdAt: string
  updatedAt: string
}

export type PatientInput = Omit<Patient, 'id' | 'createdAt' | 'updatedAt'> & { id?: number }

export interface PatientListItem extends Patient {
  prescriptionCount: number
  lastVisit: string
}

export interface MedicineItem {
  drugName: string
  form: string
  strength: string
  dose: string
  frequency: string
  duration: string
  route: string
  instructions: string
}

export interface PatientSnapshot {
  name: string
  ageText: string
  gender: Gender
  weight: string
}

export interface Prescription {
  id: number
  patientId: number
  /** ISO date yyyy-mm-dd */
  date: string
  diagnosis: string
  notes: string
  nextVisit: string
  labTests: string
  items: MedicineItem[]
  patient: PatientSnapshot
  createdAt: string
  updatedAt: string
}

export type PrescriptionInput = Omit<Prescription, 'id' | 'createdAt' | 'updatedAt' | 'patient'> & {
  id?: number
}

export interface PrescriptionListItem {
  id: number
  patientId: number
  patientName: string
  date: string
  diagnosis: string
  drugCount: number
  drugsSummary: string
}

export interface Drug {
  id: number
  name: string
  form: string
  strength: string
  dose: string
  frequency: string
  duration: string
  route: string
  instructions: string
  useCount: number
}

export type DrugInput = Omit<Drug, 'id' | 'useCount'> & { id?: number }

export interface DosePhrase {
  id: number
  text: string
  position: number
}

export interface Favorite {
  id: number
  name: string
  diagnosis: string
  notes: string
  items: MedicineItem[]
}

export type FavoriteInput = Omit<Favorite, 'id'> & { id?: number }

export interface LayoutRecord {
  id: number
  name: string
  isDefault: boolean
  layout: import('./layout/types').Layout
  updatedAt: string
}

export interface ReportSummary {
  totalPatients: number
  totalPrescriptions: number
  today: number
  thisMonth: number
  perDay: { day: string; prescriptions: number; patients: number }[]
  perMonth: { month: string; prescriptions: number; patients: number }[]
  topDrugs: { name: string; count: number }[]
}

export interface BackupInfo {
  path: string
  sizeBytes: number
  createdAt: string
}

export interface PrintOptions {
  silent: boolean
  deviceName?: string
  copies?: number
  /** Paper size in millimetres. */
  widthMm: number
  heightMm: number
}

export interface PrinterInfo {
  name: string
  displayName: string
  isDefault: boolean
}

export interface AppInfo {
  version: string
  dataDir: string
  dbPath: string
  logPath: string
  locked: boolean
}

/** Result wrapper returned over IPC so errors can be shown as friendly messages. */
export type IpcResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string }
