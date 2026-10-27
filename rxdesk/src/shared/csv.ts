import type { Lang, Patient } from './types'
import { formatAge, genderText } from './text'

// CSV export that opens correctly in Excel (UTF-8 BOM so Arabic shows properly).

export function toCsv(headers: string[], rows: Record<string, unknown>[], keys: string[]): string {
  const cell = (v: unknown): string => {
    let s = v === null || v === undefined ? '' : String(v)
    // Prevent spreadsheet formula injection from free text fields.
    if (/^[=@\t\r]/.test(s) || /^[+\-][^\d\s]/.test(s)) s = "'" + s
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.map(cell).join(',')]
  for (const r of rows) lines.push(keys.map((k) => cell(r[k])).join(','))
  return '\uFEFF' + lines.join('\r\n') + '\r\n'
}

export function patientsCsv(patients: Patient[], lang: Lang): string {
  const rows = patients.map((p) => ({ ...p, age: formatAge(p.birthDate, lang), genderText: genderText(p.gender, lang) }))
  const headers = lang === 'ar'
    ? ['رقم', 'الاسم', 'تاريخ الميلاد', 'السن', 'النوع', 'الهاتف', 'الوزن', 'الحساسية', 'الأمراض المزمنة', 'ملاحظات', 'تاريخ الإضافة']
    : ['ID', 'Name', 'Birth date', 'Age', 'Gender', 'Phone', 'Weight', 'Allergies', 'Chronic diseases', 'Notes', 'Created']
  return toCsv(headers, rows as unknown as Record<string, unknown>[], ['id', 'name', 'birthDate', 'age', 'genderText', 'phone', 'weight', 'allergies', 'chronicDiseases', 'notes', 'createdAt'])
}

export function prescriptionsCsv(rows: Record<string, unknown>[], lang: Lang): string {
  const keys = ['prescription_id', 'date', 'patient_name', 'phone', 'diagnosis', 'line', 'drug_name', 'form', 'strength', 'dose', 'frequency', 'duration', 'route', 'instructions', 'notes', 'lab_tests', 'next_visit']
  const headers = lang === 'ar'
    ? ['رقم الروشتة', 'التاريخ', 'المريض', 'الهاتف', 'التشخيص', 'السطر', 'الدواء', 'الشكل', 'التركيز', 'الجرعة', 'التكرار', 'المدة', 'طريقة الاستخدام', 'تعليمات', 'ملاحظات', 'تحاليل', 'الإعادة']
    : ['Prescription', 'Date', 'Patient', 'Phone', 'Diagnosis', 'Line', 'Drug', 'Form', 'Strength', 'Dose', 'Frequency', 'Duration', 'Route', 'Instructions', 'Advice', 'Lab tests', 'Next visit']
  return toCsv(headers, rows, keys)
}
