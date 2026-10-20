import type { AppSettings, ClinicProfile, MedicineItem } from './types'

export const DEFAULT_SETTINGS: AppSettings = {
  setupCompleted: false,
  language: 'ar',
  printLanguage: 'ar',
  defaultPrinter: '',
  silentPrint: false,
  copies: 1,
  autoBackup: { enabled: true, folder: '', keep: 14, lastRunAt: '' },
  pinEnabled: false
}

export const EMPTY_PROFILE: ClinicProfile = {
  doctorNameAr: '',
  doctorNameEn: '',
  specialtyAr: '',
  specialtyEn: '',
  clinicName: '',
  address: '',
  phones: '',
  licenseNumber: '',
  logo: ''
}

export const EMPTY_ITEM: MedicineItem = {
  drugName: '',
  form: '',
  strength: '',
  dose: '',
  frequency: '',
  duration: '',
  route: '',
  instructions: ''
}

export const DRUG_FORMS = [
  'Tab',
  'Cap',
  'Syrup',
  'Susp',
  'Drops',
  'Cream',
  'Ointment',
  'Gel',
  'Lotion',
  'Inj',
  'Amp',
  'Vial',
  'Supp',
  'Spray',
  'Inhaler',
  'Sachet',
  'Eye drops',
  'Ear drops',
  'Patch',
  'Mouthwash'
]

export const ROUTES = ['Oral', 'Topical', 'IM', 'IV', 'SC', 'Inhalation', 'Rectal', 'Eye', 'Ear', 'Nasal', 'Vaginal']
