import type { AppSettings, ClinicProfile, MedicineItem, RxFormSettings, RxMedField } from './types'

export const ALL_RX_MED_FIELDS: RxMedField[] = ['form', 'strength', 'frequency', 'duration', 'route', 'instructions']

/** Simple screen: drug name + one dose line, diagnosis with treatment suggestions, advice box. */
export const SIMPLE_RX_FORM: RxFormSettings = {
  medFields: [],
  showDiagnosis: true,
  showNotes: true,
  showLabTests: false,
  showNextVisit: false,
  showSidePanel: false,
  showSmartPanel: true
}

/** Detailed screen: every field and section. */
export const DETAILED_RX_FORM: RxFormSettings = {
  medFields: [...ALL_RX_MED_FIELDS],
  showDiagnosis: true,
  showNotes: true,
  showLabTests: true,
  showNextVisit: true,
  showSidePanel: true,
  showSmartPanel: true
}

export const DEFAULT_SETTINGS: AppSettings = {
  setupCompleted: false,
  language: 'ar',
  printLanguage: 'ar',
  defaultPrinter: '',
  silentPrint: false,
  copies: 1,
  autoBackup: { enabled: true, folder: '', keep: 14, lastRunAt: '' },
  pinEnabled: false,
  rxForm: SIMPLE_RX_FORM
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

/** Quick suggestions shown in the medicine row fields (the doctor can always type anything). */
export const FREQUENCY_SUGGESTIONS = [
  'once daily',
  'twice daily',
  'three times daily',
  'four times daily',
  'every 6 hours',
  'every 8 hours',
  'every 12 hours',
  'once daily at night',
  'once weekly',
  'when needed',
  'مرة يومياً',
  'مرتين يومياً',
  '3 مرات يومياً',
  'كل 8 ساعات',
  'كل 12 ساعة',
  'عند اللزوم'
]

export const DURATION_SUGGESTIONS = [
  '3 days',
  '5 days',
  '7 days',
  '10 days',
  '14 days',
  '1 month',
  '3 months',
  'continuous',
  '3 أيام',
  '5 أيام',
  'أسبوع',
  'أسبوعين',
  'شهر',
  'مستمر'
]

export const INSTRUCTION_SUGGESTIONS = [
  'after food',
  'before food',
  'with food',
  'at bedtime',
  'on empty stomach',
  'بعد الأكل',
  'قبل الأكل',
  'مع الأكل',
  'على الريق',
  'قبل النوم',
  'عند اللزوم'
]
