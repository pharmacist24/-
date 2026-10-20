// Text helpers shared between processes.

/**
 * Normalise text for searching: lower-case, strip Arabic diacritics and tatweel,
 * unify common Arabic letter variants and convert Arabic-Indic digits.
 */
export function normalizeForSearch(input: string): string {
  if (!input) return ''
  return input
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '') // harakat, superscript alef, tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\s+/g, ' ')
    .trim()
}

/** Keep only digits (used to match phone numbers). */
export function digitsOnly(input: string): string {
  return normalizeForSearch(input).replace(/\D/g, '')
}

export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Birth date estimated from an age in years (keeps today's month/day). */
export function birthDateFromAge(years: number, now: Date = new Date()): string {
  const d = new Date(now.getFullYear() - Math.max(0, Math.floor(years)), now.getMonth(), now.getDate())
  return todayIso(d)
}

export interface Age {
  years: number
  months: number
  days: number
}

export function ageFromBirthDate(birthDate: string, on: Date = new Date()): Age | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null
  const [y, m, d] = birthDate.split('-').map(Number)
  const birth = new Date(y, m - 1, d)
  if (isNaN(birth.getTime()) || birth > on) return null
  let years = on.getFullYear() - birth.getFullYear()
  let months = on.getMonth() - birth.getMonth()
  let days = on.getDate() - birth.getDate()
  if (days < 0) {
    months -= 1
    days += new Date(on.getFullYear(), on.getMonth(), 0).getDate()
  }
  if (months < 0) {
    years -= 1
    months += 12
  }
  return { years, months, days }
}

/** Human readable age, e.g. "35 years", "8 months", "12 days" (or Arabic). */
export function formatAge(birthDate: string, lang: 'ar' | 'en', on: Date = new Date()): string {
  const age = ageFromBirthDate(birthDate, on)
  if (!age) return ''
  if (lang === 'ar') {
    if (age.years >= 2) return `${age.years} سنة`
    if (age.years === 1) return age.months ? `سنة و ${age.months} شهر` : 'سنة'
    if (age.months >= 1) return `${age.months} شهر`
    return `${age.days} يوم`
  }
  if (age.years >= 2) return `${age.years} years`
  if (age.years === 1) return age.months ? `1 year ${age.months} m` : '1 year'
  if (age.months >= 1) return `${age.months} month${age.months > 1 ? 's' : ''}`
  return `${age.days} day${age.days === 1 ? '' : 's'}`
}

export function formatDate(iso: string, lang: 'ar' | 'en'): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso || ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  // Day/Month/Year is what clinics in the region expect in both languages.
  return lang === 'ar' ? `${d}/${m}/${y}` : `${d}/${m}/${y}`
}

export function genderText(g: string, lang: 'ar' | 'en'): string {
  if (g === 'male') return lang === 'ar' ? 'ذكر' : 'Male'
  if (g === 'female') return lang === 'ar' ? 'أنثى' : 'Female'
  return ''
}

/** Split a free text list such as "Penicillin, sulfa، aspirin" into tokens. */
export function splitList(input: string): string[] {
  return (input || '')
    .split(/[,،;\n\/]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// Small built-in map of drug classes so an allergy to a class also warns for its members.
// It is only a helper for a non-blocking warning, not a clinical database.
const DRUG_CLASSES: Record<string, string[]> = {
  penicillin: [
    'penicillin', 'amoxicillin', 'amoxil', 'ampicillin', 'augmentin', 'amoxiclav', 'co-amoxiclav',
    'flucloxacillin', 'cloxacillin', 'piperacillin', 'tazocin', 'benzathine', 'unasyn', 'sultamicillin',
    'hibiotic', 'curam', 'megamox'
  ],
  cephalosporin: [
    'cef', 'ceph', 'cefalexin', 'cephalexin', 'cefuroxime', 'zinnat', 'ceftriaxone', 'rocephin',
    'cefixime', 'suprax', 'cefadroxil', 'cefotaxime', 'cefpodoxime', 'cefdinir', 'cefaclor'
  ],
  sulfa: ['sulfa', 'sulpha', 'sulfamethoxazole', 'co-trimoxazole', 'septrin', 'bactrim', 'sulfasalazine'],
  nsaid: [
    'nsaid', 'ibuprofen', 'brufen', 'diclofenac', 'voltaren', 'cataflam', 'naproxen', 'ketoprofen',
    'meloxicam', 'piroxicam', 'celecoxib', 'etoricoxib', 'aspirin', 'ketorolac', 'indomethacin', 'mefenamic'
  ],
  aspirin: ['aspirin', 'acetylsalicylic', 'aspocid'],
  macrolide: ['macrolide', 'azithromycin', 'zithromax', 'clarithromycin', 'klacid', 'erythromycin'],
  quinolone: ['quinolone', 'ciprofloxacin', 'cipro', 'levofloxacin', 'tavanic', 'moxifloxacin', 'ofloxacin', 'norfloxacin'],
  tetracycline: ['tetracycline', 'doxycycline', 'minocycline'],
  codeine: ['codeine', 'opioid', 'tramadol', 'morphine'],
  paracetamol: ['paracetamol', 'acetaminophen', 'panadol', 'adol', 'cetal']
}

// Arabic allergy words mapped to the English class keys above.
const ARABIC_ALLERGY_WORDS: Record<string, string> = {
  'بنسلين': 'penicillin',
  'البنسلين': 'penicillin',
  'سلفا': 'sulfa',
  'السلفا': 'sulfa',
  'اسبرين': 'aspirin',
  'الاسبرين': 'aspirin',
  'مسكنات': 'nsaid',
  'باراسيتامول': 'paracetamol',
  'سيفالوسبورين': 'cephalosporin',
  'كودايين': 'codeine'
}

/**
 * Returns the allergy entries (as typed by the user) that match the drug name.
 * Matching is case-insensitive substring in both directions plus a small drug-class map.
 */
export function findAllergyMatches(drugName: string, allergies: string): string[] {
  const drug = normalizeForSearch(drugName)
  if (drug.length < 3) return []
  const matches: string[] = []
  for (const raw of splitList(allergies)) {
    let a = normalizeForSearch(raw)
    if (a.length < 3) continue
    a = ARABIC_ALLERGY_WORDS[a] ?? a
    let hit = drug.includes(a) || a.includes(drug.split(' ')[0])
    if (!hit) {
      for (const [cls, members] of Object.entries(DRUG_CLASSES)) {
        const allergyIsClass = cls === a || members.some((m) => m.length >= 4 && a.includes(m))
        if (allergyIsClass && members.some((m) => drug.includes(m))) {
          hit = true
          break
        }
      }
    }
    if (hit) matches.push(raw)
  }
  return matches
}

export function escapeHtml(input: string): string {
  return (input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
