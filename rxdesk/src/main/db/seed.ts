import type { Repo } from './repo'
import type { DrugInput, MedicineItem } from '@shared/types'
import { sampleA4Layout, sampleA5Layout } from '@shared/layout/defaults'
import { birthDateFromAge, todayIso } from '@shared/text'

export const SEED_DRUGS: DrugInput[] = [
  { name: 'Augmentin', form: 'Tab', strength: '1 g', dose: '1 tablet', frequency: 'every 12 hours', duration: '7 days', route: 'Oral', instructions: 'بعد الأكل' },
  { name: 'Amoxicillin', form: 'Cap', strength: '500 mg', dose: '1 capsule', frequency: 'every 8 hours', duration: '7 days', route: 'Oral', instructions: '' },
  { name: 'Azithromycin', form: 'Tab', strength: '500 mg', dose: '1 tablet', frequency: 'once daily', duration: '3 days', route: 'Oral', instructions: 'قبل الأكل بساعة' },
  { name: 'Ciprofloxacin', form: 'Tab', strength: '500 mg', dose: '1 tablet', frequency: 'every 12 hours', duration: '5 days', route: 'Oral', instructions: '' },
  { name: 'Cefixime', form: 'Cap', strength: '400 mg', dose: '1 capsule', frequency: 'once daily', duration: '7 days', route: 'Oral', instructions: '' },
  { name: 'Paracetamol', form: 'Tab', strength: '500 mg', dose: '1-2 tablets', frequency: 'every 6 hours when needed', duration: '', route: 'Oral', instructions: 'عند اللزوم' },
  { name: 'Ibuprofen', form: 'Tab', strength: '400 mg', dose: '1 tablet', frequency: 'every 8 hours', duration: '5 days', route: 'Oral', instructions: 'بعد الأكل' },
  { name: 'Diclofenac Potassium', form: 'Tab', strength: '50 mg', dose: '1 tablet', frequency: 'twice daily', duration: '5 days', route: 'Oral', instructions: 'بعد الأكل' },
  { name: 'Omeprazole', form: 'Cap', strength: '20 mg', dose: '1 capsule', frequency: 'once daily', duration: '14 days', route: 'Oral', instructions: 'قبل الإفطار بنصف ساعة' },
  { name: 'Pantoprazole', form: 'Tab', strength: '40 mg', dose: '1 tablet', frequency: 'once daily', duration: '30 days', route: 'Oral', instructions: 'قبل الأكل' },
  { name: 'Domperidone', form: 'Tab', strength: '10 mg', dose: '1 tablet', frequency: 'three times daily', duration: '5 days', route: 'Oral', instructions: 'قبل الأكل' },
  { name: 'Metformin', form: 'Tab', strength: '500 mg', dose: '1 tablet', frequency: 'twice daily', duration: '30 days', route: 'Oral', instructions: 'مع الأكل' },
  { name: 'Amlodipine', form: 'Tab', strength: '5 mg', dose: '1 tablet', frequency: 'once daily', duration: '30 days', route: 'Oral', instructions: '' },
  { name: 'Atorvastatin', form: 'Tab', strength: '20 mg', dose: '1 tablet', frequency: 'once daily at night', duration: '30 days', route: 'Oral', instructions: '' },
  { name: 'Cetirizine', form: 'Tab', strength: '10 mg', dose: '1 tablet', frequency: 'once daily at night', duration: '7 days', route: 'Oral', instructions: '' },
  { name: 'Loratadine', form: 'Syrup', strength: '5 mg/5 ml', dose: '5 ml', frequency: 'once daily', duration: '5 days', route: 'Oral', instructions: '' },
  { name: 'Salbutamol', form: 'Inhaler', strength: '100 mcg', dose: '2 puffs', frequency: 'every 6 hours when needed', duration: '', route: 'Inhalation', instructions: '' },
  { name: 'Fluconazole', form: 'Cap', strength: '150 mg', dose: '1 capsule', frequency: 'once weekly', duration: '4 weeks', route: 'Oral', instructions: '' },
  { name: 'Terbinafine', form: 'Cream', strength: '1%', dose: 'thin layer', frequency: 'twice daily', duration: '4 weeks', route: 'Topical', instructions: 'على المكان المصاب' },
  { name: 'Vitamin D3', form: 'Cap', strength: '50000 IU', dose: '1 capsule', frequency: 'once weekly', duration: '8 weeks', route: 'Oral', instructions: 'بعد الأكل' },
  { name: 'Ferrous Sulfate', form: 'Tab', strength: '325 mg', dose: '1 tablet', frequency: 'once daily', duration: '3 months', route: 'Oral', instructions: 'قبل الأكل بساعة مع عصير برتقال' },
  { name: 'Hydrocortisone', form: 'Cream', strength: '1%', dose: 'thin layer', frequency: 'twice daily', duration: '7 days', route: 'Topical', instructions: '' }
]

export const SEED_PHRASES = [
  '1 tablet twice daily after food',
  '1 tablet once daily before breakfast',
  '1 tablet every 8 hours',
  '1 capsule every 12 hours',
  '5 ml three times daily',
  'Apply thin layer twice daily',
  'قرص واحد مرتين يومياً بعد الأكل',
  'قرص واحد يومياً قبل الإفطار',
  'معلقة صغيرة ٣ مرات يومياً',
  'دهان مرتين يومياً على المكان المصاب',
  'عند اللزوم',
  'قبل النوم'
]

const item = (drugName: string, rest: Partial<MedicineItem>): MedicineItem => ({
  drugName,
  form: '',
  strength: '',
  dose: '',
  frequency: '',
  duration: '',
  route: '',
  instructions: '',
  ...rest
})

/** Seeds the reference data that every new install gets (drugs, phrases, templates, layouts). */
export function seedReferenceData(repo: Repo): void {
  repo.db.transaction(() => {
    for (const d of SEED_DRUGS) if (!repo.getDrugByName(d.name)) repo.saveDrug(d)
    if (repo.listDosePhrases().length === 0) for (const p of SEED_PHRASES) repo.saveDosePhrase({ text: p })
    if (repo.listFavorites().length === 0) {
      repo.saveFavorite({
        name: 'Tinea treatment',
        diagnosis: 'Tinea corporis',
        notes: 'الحفاظ على المكان جافاً ونظيفاً',
        items: [
          item('Terbinafine', { form: 'Cream', strength: '1%', dose: 'thin layer', frequency: 'twice daily', duration: '4 weeks', route: 'Topical', instructions: 'على المكان المصاب' }),
          item('Fluconazole', { form: 'Cap', strength: '150 mg', dose: '1 capsule', frequency: 'once weekly', duration: '4 weeks', route: 'Oral' }),
          item('Cetirizine', { form: 'Tab', strength: '10 mg', dose: '1 tablet', frequency: 'once daily at night', duration: '7 days', route: 'Oral' })
        ]
      })
      repo.saveFavorite({
        name: 'Common cold / Flu',
        diagnosis: 'Upper respiratory tract infection',
        notes: 'راحة وشرب سوائل دافئة بكثرة',
        items: [
          item('Paracetamol', { form: 'Tab', strength: '500 mg', dose: '1-2 tablets', frequency: 'every 6 hours when needed', route: 'Oral', instructions: 'عند اللزوم' }),
          item('Cetirizine', { form: 'Tab', strength: '10 mg', dose: '1 tablet', frequency: 'once daily at night', duration: '5 days', route: 'Oral' })
        ]
      })
    }
    if (repo.listLayouts().length === 0) {
      repo.saveLayout({ name: 'A5 – عربي (قائمة)', layout: sampleA5Layout(), isDefault: true })
      repo.saveLayout({ name: 'A4 – Bilingual (table)', layout: sampleA4Layout() })
    }
  })()
}

/** Optional sample patients (offered in the setup wizard) so the doctor can try the app. */
export function seedSamplePatients(repo: Repo): void {
  if (repo.countPatients() > 0) return
  repo.db.transaction(() => {
    const a = repo.savePatient({
      name: 'أحمد محمد علي',
      birthDate: birthDateFromAge(45),
      birthDateEstimated: true,
      gender: 'male',
      phone: '01001234567',
      weight: '82 kg',
      allergies: 'Penicillin',
      chronicDiseases: 'Hypertension',
      notes: 'مريض تجريبي'
    })
    const b = repo.savePatient({
      name: 'فاطمة حسن إبراهيم',
      birthDate: birthDateFromAge(31),
      birthDateEstimated: true,
      gender: 'female',
      phone: '01112223344',
      weight: '64 kg',
      allergies: '',
      chronicDiseases: '',
      notes: 'مريضة تجريبية'
    })
    const c = repo.savePatient({
      name: 'يوسف خالد',
      birthDate: birthDateFromAge(6),
      birthDateEstimated: true,
      gender: 'male',
      phone: '01223334455',
      weight: '21 kg',
      allergies: 'Sulfa',
      chronicDiseases: 'Asthma',
      notes: 'طفل - مريض تجريبي'
    })
    const today = todayIso()
    repo.savePrescription({
      patientId: a.id,
      date: today,
      diagnosis: 'Essential hypertension',
      notes: 'تقليل الملح في الطعام وممارسة المشي يومياً',
      nextVisit: '',
      labTests: 'Lipid profile, Serum creatinine',
      items: [
        item('Amlodipine', { form: 'Tab', strength: '5 mg', dose: '1 tablet', frequency: 'once daily', duration: '30 days', route: 'Oral' }),
        item('Atorvastatin', { form: 'Tab', strength: '20 mg', dose: '1 tablet', frequency: 'once daily at night', duration: '30 days', route: 'Oral' })
      ]
    })
    repo.savePrescription({
      patientId: b.id,
      date: today,
      diagnosis: 'Tinea corporis',
      notes: 'الحفاظ على المكان جافاً ونظيفاً',
      nextVisit: '',
      labTests: '',
      items: repo.listFavorites().find((f) => f.name === 'Tinea treatment')?.items ?? []
    })
    repo.savePrescription({
      patientId: c.id,
      date: today,
      diagnosis: 'Acute tonsillitis',
      notes: 'مشروبات دافئة',
      nextVisit: '',
      labTests: '',
      items: [
        item('Amoxicillin', { form: 'Syrup', strength: '250 mg/5 ml', dose: '5 ml', frequency: 'every 8 hours', duration: '7 days', route: 'Oral' }),
        item('Paracetamol', { form: 'Syrup', strength: '120 mg/5 ml', dose: '10 ml', frequency: 'every 6 hours when needed', route: 'Oral', instructions: 'عند ارتفاع الحرارة' })
      ]
    })
  })()
}
