// Built-in starter library of common diagnoses and first-line treatment options.
//
// IMPORTANT: these are suggestions to save typing, not clinical decision support. The doctor reviews and
// edits every prescription; doses for children are written per kg and must be calculated for the patient.
// The list is copied into the database on install/upgrade and can be edited in Library → Diagnoses.

import type { MedicineItem } from '../types'

export type Specialty = 'general' | 'pediatrics' | 'dermatology' | 'internal'

export interface TreatmentOption {
  labelEn: string
  labelAr: string
  /** Option meant for children (doses per kg). */
  forChildren?: boolean
  items: MedicineItem[]
  advice?: string
  labs?: string
}

export interface ConditionDef {
  key: string
  specialty: Specialty
  nameEn: string
  nameAr: string
  icd10: string
  keywords: string[]
  options: TreatmentOption[]
}

/** One medicine line. */
const m = (drugName: string, form: string, strength: string, dose: string, frequency: string, duration: string, instructions = '', route = ''): MedicineItem => ({
  drugName,
  form,
  strength,
  dose,
  frequency,
  duration,
  instructions,
  route: route || (/cream|gel|ointment|lotion|shampoo|solution|powder/i.test(form) ? 'Topical' : /eye/i.test(form) ? 'Eye' : /ear/i.test(form) ? 'Ear' : /nasal/i.test(form) ? 'Nasal' : /inhaler/i.test(form) ? 'Inhalation' : 'Oral')
})

const L = {
  first: ['First line', 'الخط الأول'],
  pen: ['Penicillin allergy', 'حساسية البنسلين'],
  child: ['Child (dose by weight)', 'طفل (الجرعة حسب الوزن)'],
  symptoms: ['Symptom relief', 'علاج الأعراض'],
  severe: ['Severe / extensive', 'الحالات الشديدة / المنتشرة'],
  alt: ['Alternative', 'بديل'],
  maintain: ['Long-term', 'علاج طويل المدى']
} as const

const o = (label: keyof typeof L, items: MedicineItem[], extra: Partial<TreatmentOption> = {}): TreatmentOption => ({
  labelEn: L[label][0],
  labelAr: L[label][1],
  items,
  ...(label === 'child' ? { forChildren: true } : {}),
  ...extra
})

// Frequently reused lines
const paracetamol = m('Paracetamol', 'Tab', '500 mg', '1–2 tablets', 'every 6 hours when needed', '5 days', 'max 4 g/day')
const ibuprofen = m('Ibuprofen', 'Tab', '400 mg', '1 tablet', 'every 8 hours', '5 days', 'بعد الأكل')
const cetirizine = m('Cetirizine', 'Tab', '10 mg', '1 tablet', 'once daily at night', '7 days')
const paraSyrup = m('Paracetamol', 'Syrup', '120 mg/5 ml', '15 mg/kg per dose', 'every 6 hours when needed', '3–5 days', 'max 4 doses/day')
const ibuSyrup = m('Ibuprofen', 'Susp', '100 mg/5 ml', '10 mg/kg per dose', 'every 8 hours when needed', '3 days', 'بعد الأكل')

export const BUILTIN_CONDITIONS: ConditionDef[] = [
  // ------------------------------------------------------------------ general / family medicine
  {
    key: 'strep_tonsillitis', specialty: 'general', nameEn: 'Acute bacterial tonsillitis', nameAr: 'التهاب اللوز الصديدي', icd10: 'J03.9',
    keywords: ['tonsillitis', 'strep throat', 'pharyngitis', 'لوز', 'التهاب الحلق'],
    options: [
      o('first', [m('Amoxicillin', 'Cap', '500 mg', '1 capsule', 'every 12 hours', '10 days'), paracetamol], { advice: 'غرغرة بماء دافئ وملح، وسوائل دافئة' }),
      o('pen', [m('Azithromycin', 'Tab', '500 mg', '1 tablet', 'once daily', '5 days', 'قبل الأكل بساعة'), paracetamol]),
      o('child', [m('Amoxicillin', 'Susp', '250 mg/5 ml', '50 mg/kg/day divided', 'every 12 hours', '10 days'), paraSyrup])
    ]
  },
  {
    key: 'viral_pharyngitis', specialty: 'general', nameEn: 'Viral pharyngitis', nameAr: 'التهاب الحلق الفيروسي', icd10: 'J02.9',
    keywords: ['sore throat', 'pharyngitis', 'حلق', 'زور'],
    options: [o('symptoms', [paracetamol, m('Benzydamine', 'Mouthwash', '0.15%', '15 ml gargle', 'every 3 hours', '5 days')], { advice: 'لا يحتاج مضاد حيوي. راحة وسوائل دافئة' })]
  },
  {
    key: 'common_cold', specialty: 'general', nameEn: 'Common cold (URTI)', nameAr: 'نزلة برد', icd10: 'J00',
    keywords: ['urti', 'cold', 'coryza', 'رشح', 'زكام', 'برد'],
    options: [o('symptoms', [paracetamol, cetirizine, m('Sodium chloride 0.9%', 'Nasal spray', '0.9%', '2 sprays each nostril', 'four times daily', '5 days')], { advice: 'راحة وشرب سوائل دافئة بكثرة' })]
  },
  {
    key: 'influenza', specialty: 'general', nameEn: 'Influenza', nameAr: 'الإنفلونزا', icd10: 'J11.1',
    keywords: ['flu', 'influenza', 'انفلونزا', 'دور برد'],
    options: [
      o('symptoms', [paracetamol, cetirizine], { advice: 'راحة تامة وسوائل بكثرة' }),
      o('severe', [m('Oseltamivir', 'Cap', '75 mg', '1 capsule', 'every 12 hours', '5 days'), paracetamol], { advice: 'للحالات عالية الخطورة، ويفضل خلال 48 ساعة من بدء الأعراض' })
    ]
  },
  {
    key: 'sinusitis', specialty: 'general', nameEn: 'Acute sinusitis', nameAr: 'التهاب الجيوب الأنفية الحاد', icd10: 'J01.9',
    keywords: ['sinusitis', 'rhinosinusitis', 'جيوب'],
    options: [
      o('symptoms', [m('Sodium chloride 0.9%', 'Nasal spray', '0.9%', '2 sprays each nostril', 'four times daily', '7 days'), m('Xylometazoline', 'Nasal spray', '0.1%', '1 spray each nostril', 'three times daily', '3 days', 'لا تزيد عن 5 أيام'), paracetamol], { advice: 'استنشاق بخار ماء دافئ مرتين يومياً' }),
      o('first', [m('Amoxicillin/Clavulanate', 'Tab', '875/125 mg', '1 tablet', 'every 12 hours', '7 days', 'بعد الأكل'), m('Sodium chloride 0.9%', 'Nasal spray', '0.9%', '2 sprays each nostril', 'four times daily', '7 days')]),
      o('pen', [m('Doxycycline', 'Cap', '100 mg', '1 capsule', 'every 12 hours', '7 days', 'مع كوب ماء كامل')])
    ]
  },
  {
    key: 'otitis_media', specialty: 'general', nameEn: 'Acute otitis media', nameAr: 'التهاب الأذن الوسطى الحاد', icd10: 'H66.9',
    keywords: ['otitis media', 'ear infection', 'اذن وسطى'],
    options: [
      o('first', [m('Amoxicillin', 'Cap', '500 mg', '1 capsule', 'every 8 hours', '7 days'), paracetamol]),
      o('pen', [m('Azithromycin', 'Tab', '500 mg', '1 tablet', 'once daily', '3 days'), paracetamol])
    ]
  },
  {
    key: 'otitis_externa', specialty: 'general', nameEn: 'Otitis externa', nameAr: 'التهاب الأذن الخارجية', icd10: 'H60.9',
    keywords: ['swimmer ear', 'external ear', 'اذن خارجية'],
    options: [o('first', [m('Ciprofloxacin', 'Ear drops', '0.3%', '4 drops', 'every 12 hours', '7 days'), paracetamol], { advice: 'تجنب دخول الماء إلى الأذن' })]
  },
  {
    key: 'acute_bronchitis', specialty: 'general', nameEn: 'Acute bronchitis', nameAr: 'التهاب الشعب الهوائية الحاد', icd10: 'J20.9',
    keywords: ['bronchitis', 'cough', 'كحة', 'سعال', 'شعب'],
    options: [o('symptoms', [paracetamol, m('Dextromethorphan', 'Syrup', '15 mg/5 ml', '10 ml', 'every 8 hours when needed', '5 days', 'للكحة الجافة')], { advice: 'غالباً فيروسي ولا يحتاج مضاد حيوي. عسل وسوائل دافئة' })]
  },
  {
    key: 'pneumonia_cap', specialty: 'general', nameEn: 'Community-acquired pneumonia (mild, outpatient)', nameAr: 'التهاب رئوي بسيط', icd10: 'J18.9',
    keywords: ['pneumonia', 'cap', 'التهاب رئوي', 'رئة'],
    options: [
      o('first', [m('Amoxicillin', 'Cap', '500 mg', '2 capsules', 'every 8 hours', '5 days'), paracetamol], { labs: 'CBC, CRP, Chest X-ray' }),
      o('pen', [m('Doxycycline', 'Cap', '100 mg', '1 capsule', 'every 12 hours', '5 days', 'مع كوب ماء كامل'), paracetamol], { labs: 'CBC, CRP, Chest X-ray' })
    ]
  },
  {
    key: 'asthma_exacerbation', specialty: 'general', nameEn: 'Asthma exacerbation (mild)', nameAr: 'نوبة ربو بسيطة', icd10: 'J45.901',
    keywords: ['asthma', 'wheeze', 'ربو', 'أزمة', 'حساسية صدر'],
    options: [o('first', [m('Salbutamol', 'Inhaler', '100 mcg', '2–4 puffs', 'every 4–6 hours when needed', '7 days', 'with spacer'), m('Prednisolone', 'Tab', '5 mg', '8 tablets (40 mg)', 'once daily in the morning', '5 days', 'بعد الإفطار')], { advice: 'مراجعة فورية إذا زاد ضيق التنفس' })]
  },
  {
    key: 'allergic_rhinitis', specialty: 'general', nameEn: 'Allergic rhinitis', nameAr: 'حساسية الأنف', icd10: 'J30.4',
    keywords: ['hay fever', 'allergy nose', 'حساسية', 'عطس'],
    options: [o('first', [m('Cetirizine', 'Tab', '10 mg', '1 tablet', 'once daily', '14 days'), m('Fluticasone propionate', 'Nasal spray', '50 mcg', '2 sprays each nostril', 'once daily', '1 month')], { advice: 'تجنب مسببات الحساسية مثل الغبار والروائح النفاذة' })]
  },
  {
    key: 'allergic_conjunctivitis', specialty: 'general', nameEn: 'Allergic conjunctivitis', nameAr: 'حساسية العين', icd10: 'H10.1',
    keywords: ['eye allergy', 'itchy eyes', 'حساسية عين'],
    options: [o('first', [m('Olopatadine', 'Eye drops', '0.1%', '1 drop each eye', 'every 12 hours', '14 days'), cetirizine])]
  },
  {
    key: 'bacterial_conjunctivitis', specialty: 'general', nameEn: 'Bacterial conjunctivitis', nameAr: 'التهاب الملتحمة البكتيري', icd10: 'H10.9',
    keywords: ['pink eye', 'conjunctivitis', 'رمد', 'ملتحمة'],
    options: [
      o('first', [m('Chloramphenicol', 'Eye drops', '0.5%', '1 drop affected eye', 'four times daily', '5 days')], { advice: 'غسل اليدين جيداً وعدم مشاركة المناشف' }),
      o('alt', [m('Moxifloxacin', 'Eye drops', '0.5%', '1 drop affected eye', 'three times daily', '7 days')])
    ]
  },
  {
    key: 'gastroenteritis', specialty: 'general', nameEn: 'Acute gastroenteritis', nameAr: 'نزلة معوية حادة', icd10: 'A09',
    keywords: ['diarrhea', 'diarrhoea', 'vomiting', 'gastroenteritis', 'اسهال', 'إسهال', 'ترجيع', 'نزلة معوية'],
    options: [o('symptoms', [m('Oral rehydration salts', 'Sachet', '', '1 sachet in 200 ml water', 'after each loose stool', '3 days'), m('Ondansetron', 'Tab', '4 mg', '1 tablet', 'every 8 hours when needed', '2 days', 'للترجيع'), paracetamol], { advice: 'سوائل بكثرة وأكل خفيف. مراجعة فورية عند وجود دم أو جفاف شديد' })]
  },
  {
    key: 'gerd', specialty: 'general', nameEn: 'Gastro-oesophageal reflux (GERD)', nameAr: 'ارتجاع المريء', icd10: 'K21.9',
    keywords: ['reflux', 'heartburn', 'gerd', 'حموضة', 'ارتجاع', 'حرقان'],
    options: [o('first', [m('Omeprazole', 'Cap', '20 mg', '1 capsule', 'once daily', '4 weeks', 'قبل الإفطار بنصف ساعة'), m('Alginate/antacid', 'Susp', '', '10 ml', 'after meals and at bedtime when needed', '2 weeks')], { advice: 'تجنب الأكل قبل النوم بثلاث ساعات، ورفع رأس السرير' })]
  },
  {
    key: 'gastritis', specialty: 'general', nameEn: 'Gastritis / dyspepsia', nameAr: 'التهاب المعدة / عسر الهضم', icd10: 'K29.7',
    keywords: ['dyspepsia', 'gastritis', 'epigastric pain', 'معدة', 'عسر هضم'],
    options: [o('first', [m('Omeprazole', 'Cap', '20 mg', '1 capsule', 'once daily', '4 weeks', 'قبل الإفطار بنصف ساعة'), m('Domperidone', 'Tab', '10 mg', '1 tablet', 'three times daily when needed', '5 days', 'قبل الأكل')], { advice: 'تجنب المسكنات والقهوة والأكل الحار', labs: 'H. pylori stool antigen' })]
  },
  {
    key: 'h_pylori', specialty: 'general', nameEn: 'Helicobacter pylori infection', nameAr: 'جرثومة المعدة', icd10: 'B96.81',
    keywords: ['h pylori', 'helicobacter', 'جرثومة المعدة'],
    options: [
      o('first', [
        m('Omeprazole', 'Cap', '20 mg', '1 capsule', 'every 12 hours', '14 days', 'قبل الأكل'),
        m('Amoxicillin', 'Cap', '500 mg', '2 capsules', 'every 12 hours', '14 days', 'بعد الأكل'),
        m('Clarithromycin', 'Tab', '500 mg', '1 tablet', 'every 12 hours', '14 days', 'بعد الأكل')
      ], { labs: 'H. pylori stool antigen 4 weeks after treatment' }),
      o('pen', [
        m('Omeprazole', 'Cap', '20 mg', '1 capsule', 'every 12 hours', '14 days', 'قبل الأكل'),
        m('Bismuth subcitrate', 'Tab', '120 mg', '1 tablet', 'four times daily', '14 days'),
        m('Metronidazole', 'Tab', '500 mg', '1 tablet', 'three times daily', '14 days', 'بعد الأكل، ممنوع الكحول'),
        m('Tetracycline', 'Cap', '500 mg', '1 capsule', 'four times daily', '14 days')
      ])
    ]
  },
  {
    key: 'constipation', specialty: 'general', nameEn: 'Constipation', nameAr: 'الإمساك', icd10: 'K59.00',
    keywords: ['constipation', 'امساك', 'إمساك'],
    options: [o('first', [m('Lactulose', 'Syrup', '3.3 g/5 ml', '15 ml', 'once or twice daily', '2 weeks')], { advice: 'الإكثار من الألياف والخضروات وشرب الماء والمشي' })]
  },
  {
    key: 'ibs', specialty: 'general', nameEn: 'Irritable bowel syndrome', nameAr: 'القولون العصبي', icd10: 'K58.9',
    keywords: ['ibs', 'colon', 'قولون', 'انتفاخ', 'مغص'],
    options: [o('first', [m('Mebeverine', 'Tab', '135 mg', '1 tablet', 'three times daily', '2 weeks', 'قبل الأكل بعشرين دقيقة')], { advice: 'تقليل البقوليات والمقليات والمشروبات الغازية' })]
  },
  {
    key: 'hemorrhoids', specialty: 'general', nameEn: 'Haemorrhoids', nameAr: 'البواسير', icd10: 'K64.9',
    keywords: ['piles', 'hemorrhoids', 'بواسير'],
    options: [o('first', [m('Hydrocortisone/Lidocaine', 'Ointment', '', 'apply', 'twice daily and after each bowel motion', '7 days'), m('Lactulose', 'Syrup', '3.3 g/5 ml', '15 ml', 'once daily', '2 weeks')], { advice: 'جلوس في ماء دافئ مرتين يومياً، وأكل ألياف' })]
  },
  {
    key: 'uti_cystitis', specialty: 'general', nameEn: 'Uncomplicated cystitis (UTI)', nameAr: 'التهاب المثانة / البول', icd10: 'N30.00',
    keywords: ['uti', 'cystitis', 'urine infection', 'دايسيوريا', 'التهاب بول', 'حرقان بول', 'مثانة'],
    options: [
      o('first', [m('Nitrofurantoin', 'Cap', '100 mg', '1 capsule', 'every 12 hours', '5 days', 'مع الأكل')], { advice: 'شرب الماء بكثرة', labs: 'Urine analysis, Urine culture' }),
      o('alt', [m('Fosfomycin', 'Sachet', '3 g', '1 sachet in water', 'single dose', '1 day', 'على معدة فارغة قبل النوم')], { labs: 'Urine analysis' })
    ]
  },
  {
    key: 'pyelonephritis', specialty: 'general', nameEn: 'Acute pyelonephritis (outpatient)', nameAr: 'التهاب الكلى الحاد', icd10: 'N10',
    keywords: ['pyelonephritis', 'kidney infection', 'كلى', 'حوض الكلية'],
    options: [o('first', [m('Ciprofloxacin', 'Tab', '500 mg', '1 tablet', 'every 12 hours', '7 days'), paracetamol], { labs: 'Urine analysis, Urine culture, CBC, Serum creatinine' })]
  },
  {
    key: 'tension_headache', specialty: 'general', nameEn: 'Tension-type headache', nameAr: 'صداع التوتر', icd10: 'G44.209',
    keywords: ['headache', 'صداع'],
    options: [o('first', [m('Paracetamol', 'Tab', '500 mg', '2 tablets', 'every 6 hours when needed', '5 days', 'max 4 g/day'), m('Ibuprofen', 'Tab', '400 mg', '1 tablet', 'every 8 hours when needed', '5 days', 'بعد الأكل')], { advice: 'نوم كافٍ وتقليل الضغط وشرب الماء' })]
  },
  {
    key: 'migraine', specialty: 'general', nameEn: 'Migraine', nameAr: 'الصداع النصفي', icd10: 'G43.909',
    keywords: ['migraine', 'صداع نصفي', 'شقيقة'],
    options: [
      o('first', [m('Ibuprofen', 'Tab', '400 mg', '1–2 tablets', 'at onset, may repeat after 8 hours', '3 days', 'بعد الأكل'), m('Domperidone', 'Tab', '10 mg', '1 tablet', 'at onset when nauseated', '3 days')]),
      o('alt', [m('Sumatriptan', 'Tab', '50 mg', '1 tablet', 'at onset, may repeat after 2 hours', 'when needed', 'max 200 mg/day')])
    ]
  },
  {
    key: 'low_back_pain', specialty: 'general', nameEn: 'Acute low back pain', nameAr: 'ألم أسفل الظهر الحاد', icd10: 'M54.50',
    keywords: ['back pain', 'lumbago', 'ظهر', 'ديسك'],
    options: [o('first', [ibuprofen, m('Paracetamol', 'Tab', '500 mg', '2 tablets', 'every 8 hours when needed', '5 days')], { advice: 'الاستمرار في الحركة الخفيفة وتجنب حمل الأثقال، وكمادات دافئة' })]
  },
  {
    key: 'ankle_sprain', specialty: 'general', nameEn: 'Ankle sprain', nameAr: 'التواء الكاحل', icd10: 'S93.409A',
    keywords: ['sprain', 'التواء', 'كاحل', 'جزع'],
    options: [o('first', [ibuprofen, m('Diclofenac', 'Gel', '1%', 'apply thin layer', 'three times daily', '7 days')], { advice: 'راحة، ثلج 15 دقيقة كل 3 ساعات، رباط ضاغط، ورفع القدم' })]
  },
  {
    key: 'vertigo', specialty: 'general', nameEn: 'Vertigo', nameAr: 'الدوخة / الدوار', icd10: 'R42',
    keywords: ['dizziness', 'vertigo', 'دوخة', 'دوار'],
    options: [o('symptoms', [m('Dimenhydrinate', 'Tab', '50 mg', '1 tablet', 'every 8 hours when needed', '3 days', 'يسبب النعاس')], { advice: 'تجنب الحركة المفاجئة للرأس والقيادة' })]
  },

  // ------------------------------------------------------------------ pediatrics
  {
    key: 'p_fever', specialty: 'pediatrics', nameEn: 'Fever in a child', nameAr: 'سخونية عند الطفل', icd10: 'R50.9',
    keywords: ['fever', 'pyrexia', 'سخونة', 'حرارة', 'حمى'],
    options: [o('child', [paraSyrup, ibuSyrup], { advice: 'كمادات ماء فاتر، ملابس خفيفة، وسوائل بكثرة. مراجعة فورية إذا استمرت أكثر من 3 أيام' })]
  },
  {
    key: 'p_tonsillitis', specialty: 'pediatrics', nameEn: 'Tonsillitis in a child', nameAr: 'التهاب اللوز عند الطفل', icd10: 'J03.90',
    keywords: ['tonsillitis child', 'لوز اطفال'],
    options: [
      o('child', [m('Amoxicillin', 'Susp', '250 mg/5 ml', '50 mg/kg/day divided', 'every 12 hours', '10 days'), paraSyrup]),
      o('pen', [m('Azithromycin', 'Susp', '200 mg/5 ml', '12 mg/kg', 'once daily', '5 days'), paraSyrup], { forChildren: true })
    ]
  },
  {
    key: 'p_otitis_media', specialty: 'pediatrics', nameEn: 'Otitis media in a child', nameAr: 'التهاب الأذن الوسطى عند الطفل', icd10: 'H66.90',
    keywords: ['ear infection child', 'اذن اطفال'],
    options: [
      o('child', [m('Amoxicillin', 'Susp', '250 mg/5 ml', '80–90 mg/kg/day divided', 'every 12 hours', '7–10 days'), paraSyrup]),
      o('alt', [m('Amoxicillin/Clavulanate', 'Susp', '457 mg/5 ml', '90 mg/kg/day (amoxicillin) divided', 'every 12 hours', '10 days'), paraSyrup], { forChildren: true })
    ]
  },
  {
    key: 'p_gastroenteritis', specialty: 'pediatrics', nameEn: 'Diarrhoea in a child', nameAr: 'إسهال عند الطفل', icd10: 'A09',
    keywords: ['diarrhea child', 'اسهال اطفال', 'نزلة معوية اطفال'],
    options: [o('child', [m('Oral rehydration salts', 'Sachet', '', '10 ml/kg', 'after each loose stool', '3 days'), m('Zinc', 'Syrup', '20 mg/5 ml', '20 mg (10 mg if under 6 months)', 'once daily', '10 days')], { advice: 'استمرار الرضاعة والأكل. مراجعة فورية عند الخمول أو قلة البول أو وجود دم' })]
  },
  {
    key: 'p_cold', specialty: 'pediatrics', nameEn: 'Common cold in a child', nameAr: 'نزلة برد عند الطفل', icd10: 'J00',
    keywords: ['cold child', 'رشح اطفال', 'زكام اطفال'],
    options: [o('child', [m('Sodium chloride 0.9%', 'Nasal drops', '0.9%', '2 drops each nostril', 'four times daily', '5 days'), paraSyrup], { advice: 'شفط الأنف قبل الرضاعة، وسوائل دافئة' })]
  },
  {
    key: 'p_bronchiolitis', specialty: 'pediatrics', nameEn: 'Bronchiolitis', nameAr: 'التهاب الشعيبات الهوائية', icd10: 'J21.9',
    keywords: ['bronchiolitis', 'rsv', 'شعيبات'],
    options: [o('child', [m('Sodium chloride 0.9%', 'Nasal drops', '0.9%', '2 drops each nostril', 'before feeds', '7 days'), paraSyrup], { advice: 'رضعات صغيرة متكررة. مراجعة فورية عند صعوبة التنفس أو رفض الرضاعة' })]
  },
  {
    key: 'p_asthma', specialty: 'pediatrics', nameEn: 'Asthma attack in a child (mild)', nameAr: 'نوبة ربو بسيطة عند الطفل', icd10: 'J45.901',
    keywords: ['asthma child', 'wheezy child', 'ربو اطفال'],
    options: [o('child', [m('Salbutamol', 'Inhaler', '100 mcg', '2–4 puffs with spacer', 'every 4 hours when needed', '5 days'), m('Prednisolone', 'Syrup', '15 mg/5 ml', '1–2 mg/kg (max 40 mg)', 'once daily in the morning', '3 days')])]
  },
  {
    key: 'p_croup', specialty: 'pediatrics', nameEn: 'Croup', nameAr: 'الخانوق (الكروب)', icd10: 'J05.0',
    keywords: ['croup', 'barking cough', 'كحة نباحية'],
    options: [o('child', [m('Dexamethasone', 'Oral solution', '2 mg/5 ml', '0.15–0.6 mg/kg (max 10 mg)', 'single dose', '1 day'), paraSyrup], { advice: 'مراجعة فورية عند صعوبة التنفس أو الصوت المرتفع أثناء الراحة' })]
  },
  {
    key: 'p_diaper_rash', specialty: 'pediatrics', nameEn: 'Nappy (diaper) rash', nameAr: 'التسلخات (الحفاض)', icd10: 'L22',
    keywords: ['diaper rash', 'nappy rash', 'تسلخات', 'حفاض'],
    options: [
      o('child', [m('Zinc oxide', 'Cream', '', 'apply thick layer', 'at each nappy change', '7 days')], { advice: 'تغيير الحفاض كثيراً وترك الجلد يجف' }),
      o('alt', [m('Clotrimazole', 'Cream', '1%', 'apply thin layer', 'twice daily', '10 days', 'لو فطريات (كانديدا)')], { forChildren: true })
    ]
  },
  {
    key: 'p_oral_thrush', specialty: 'pediatrics', nameEn: 'Oral thrush', nameAr: 'فطريات الفم (القلاع)', icd10: 'B37.0',
    keywords: ['thrush', 'candida mouth', 'فطريات فم', 'قلاع'],
    options: [o('child', [m('Nystatin', 'Oral susp', '100,000 IU/ml', '1 ml', 'four times daily after feeds', '7 days')], { advice: 'تعقيم الببرونة والتيتينة' })]
  },
  {
    key: 'p_threadworms', specialty: 'pediatrics', nameEn: 'Threadworms (pinworms)', nameAr: 'الديدان الدبوسية', icd10: 'B80',
    keywords: ['worms', 'pinworm', 'ديدان', 'دود'],
    options: [o('child', [m('Mebendazole', 'Tab', '100 mg', '1 tablet', 'single dose, repeat after 2 weeks', '2 weeks', 'للأطفال فوق سنتين')], { advice: 'علاج كل أفراد الأسرة، وقص الأظافر وغسل اليدين' })]
  },
  {
    key: 'p_iron_deficiency', specialty: 'pediatrics', nameEn: 'Iron deficiency anaemia in a child', nameAr: 'أنيميا نقص الحديد عند الطفل', icd10: 'D50.9',
    keywords: ['anemia child', 'انيميا اطفال', 'فقر دم'],
    options: [o('child', [m('Ferrous sulfate', 'Drops', '', '3 mg/kg/day elemental iron', 'once daily', '3 months', 'بين الوجبات مع عصير')], { labs: 'CBC, Serum ferritin' })]
  },
  {
    key: 'p_uti', specialty: 'pediatrics', nameEn: 'Urinary tract infection in a child', nameAr: 'التهاب البول عند الطفل', icd10: 'N39.0',
    keywords: ['uti child', 'التهاب بول اطفال'],
    options: [o('child', [m('Cefixime', 'Susp', '100 mg/5 ml', '8 mg/kg', 'once daily', '7–10 days'), paraSyrup], { labs: 'Urine analysis, Urine culture' })]
  },
  {
    key: 'p_constipation', specialty: 'pediatrics', nameEn: 'Constipation in a child', nameAr: 'إمساك عند الطفل', icd10: 'K59.00',
    keywords: ['constipation child', 'امساك اطفال'],
    options: [o('child', [m('Lactulose', 'Syrup', '3.3 g/5 ml', '0.5–1 ml/kg/day', 'once or twice daily', '2 weeks')], { advice: 'سوائل وفواكه وخضار، وتعويد الطفل على الحمام بعد الأكل' })]
  },
  {
    key: 'p_chickenpox', specialty: 'pediatrics', nameEn: 'Chickenpox', nameAr: 'الجديري المائي', icd10: 'B01.9',
    keywords: ['varicella', 'chickenpox', 'جديري', 'عنقز'],
    options: [o('child', [m('Calamine', 'Lotion', '', 'apply', 'three times daily', '7 days'), m('Cetirizine', 'Syrup', '5 mg/5 ml', '2.5–5 ml by age', 'once daily at night', '7 days'), paraSyrup], { advice: 'لا تعطي أسبرين أو إيبوبروفين. قص الأظافر لمنع الهرش' })]
  },

  // ------------------------------------------------------------------ dermatology
  {
    key: 'tinea_corporis', specialty: 'dermatology', nameEn: 'Tinea corporis', nameAr: 'التينيا الجلدية (فطريات الجلد)', icd10: 'B35.4',
    keywords: ['ringworm', 'tinea', 'fungal', 'فطريات', 'تينيا'],
    options: [
      o('first', [m('Terbinafine', 'Cream', '1%', 'apply thin layer', 'twice daily', '2 weeks', 'على المكان المصاب وحوله')], { advice: 'الحفاظ على المكان جافاً ونظيفاً' }),
      o('severe', [m('Terbinafine', 'Tab', '250 mg', '1 tablet', 'once daily', '2 weeks'), m('Terbinafine', 'Cream', '1%', 'apply thin layer', 'twice daily', '2 weeks')], { labs: 'Liver function tests' })
    ]
  },
  {
    key: 'tinea_pedis', specialty: 'dermatology', nameEn: 'Tinea pedis (athlete’s foot)', nameAr: 'فطريات القدم', icd10: 'B35.3',
    keywords: ['athlete foot', 'فطريات القدم', 'بين الصوابع'],
    options: [o('first', [m('Terbinafine', 'Cream', '1%', 'apply between toes', 'twice daily', '2 weeks')], { advice: 'تجفيف ما بين الأصابع جيداً وتغيير الشراب يومياً' })]
  },
  {
    key: 'tinea_capitis', specialty: 'dermatology', nameEn: 'Tinea capitis', nameAr: 'فطريات فروة الرأس', icd10: 'B35.0',
    keywords: ['scalp ringworm', 'فطريات الرأس', 'قراع'],
    options: [
      o('child', [m('Griseofulvin', 'Susp', '125 mg/5 ml', '20–25 mg/kg/day', 'once daily with fatty food', '6–8 weeks'), m('Ketoconazole', 'Shampoo', '2%', 'apply, leave 5 minutes', 'twice weekly', '4 weeks')]),
      o('first', [m('Terbinafine', 'Tab', '250 mg', '1 tablet', 'once daily', '4 weeks'), m('Ketoconazole', 'Shampoo', '2%', 'apply, leave 5 minutes', 'twice weekly', '4 weeks')], { labs: 'Liver function tests' })
    ]
  },
  {
    key: 'onychomycosis', specialty: 'dermatology', nameEn: 'Onychomycosis (nail fungus)', nameAr: 'فطريات الأظافر', icd10: 'B35.1',
    keywords: ['nail fungus', 'فطريات الاظافر', 'ضوافر'],
    options: [o('first', [m('Terbinafine', 'Tab', '250 mg', '1 tablet', 'once daily', '6 weeks (fingernails) / 12 weeks (toenails)')], { labs: 'Liver function tests' })]
  },
  {
    key: 'pityriasis_versicolor', specialty: 'dermatology', nameEn: 'Pityriasis versicolor', nameAr: 'النخالية المبرقشة', icd10: 'B36.0',
    keywords: ['tinea versicolor', 'نخالية', 'بقع بيضاء'],
    options: [
      o('first', [m('Ketoconazole', 'Shampoo', '2%', 'apply to skin, rinse after 5 minutes', 'once daily', '5 days')], { advice: 'البقع قد تأخذ شهوراً لاستعادة لونها' }),
      o('severe', [m('Fluconazole', 'Cap', '150 mg', '2 capsules (300 mg)', 'once weekly', '2 weeks')])
    ]
  },
  {
    key: 'candidal_intertrigo', specialty: 'dermatology', nameEn: 'Candidal intertrigo', nameAr: 'فطريات الثنايا (كانديدا)', icd10: 'B37.2',
    keywords: ['intertrigo', 'candida skin', 'ثنايا'],
    options: [o('first', [m('Clotrimazole', 'Cream', '1%', 'apply thin layer', 'twice daily', '2 weeks')], { advice: 'الحفاظ على المكان جافاً وارتداء ملابس قطنية' })]
  },
  {
    key: 'acne', specialty: 'dermatology', nameEn: 'Acne vulgaris', nameAr: 'حب الشباب', icd10: 'L70.0',
    keywords: ['acne', 'pimples', 'حبوب', 'حب شباب'],
    options: [
      o('first', [m('Adapalene', 'Gel', '0.1%', 'apply thin layer', 'once daily at night', '3 months'), m('Benzoyl peroxide', 'Gel', '5%', 'apply thin layer', 'once daily in the morning', '3 months')], { advice: 'غسول لطيف مرتين يومياً وواقي شمس. التحسن يبدأ بعد 6–8 أسابيع' }),
      o('severe', [m('Doxycycline', 'Cap', '100 mg', '1 capsule', 'once daily', '3 months', 'مع كوب ماء كامل، تجنب الشمس'), m('Adapalene', 'Gel', '0.1%', 'apply thin layer', 'once daily at night', '3 months')], { advice: 'ممنوع أثناء الحمل' })
    ]
  },
  {
    key: 'rosacea', specialty: 'dermatology', nameEn: 'Rosacea', nameAr: 'الوردية', icd10: 'L71.9',
    keywords: ['rosacea', 'وردية', 'احمرار الوجه'],
    options: [o('first', [m('Metronidazole', 'Gel', '0.75%', 'apply thin layer', 'twice daily', '8 weeks')], { advice: 'تجنب الشمس والحرارة والأكل الحار، وواقي شمس يومي' })]
  },
  {
    key: 'atopic_eczema', specialty: 'dermatology', nameEn: 'Atopic eczema', nameAr: 'الإكزيما التأتبية', icd10: 'L20.9',
    keywords: ['eczema', 'atopic dermatitis', 'اكزيما', 'حساسية جلد'],
    options: [
      o('first', [m('Emollient', 'Cream', '', 'apply generously', 'twice daily and after bathing', 'continuous'), m('Hydrocortisone', 'Cream', '1%', 'apply thin layer', 'twice daily', '7 days', 'الوجه والأطفال'), cetirizine]),
      o('severe', [m('Mometasone furoate', 'Cream', '0.1%', 'apply thin layer', 'once daily', '2 weeks', 'ليس على الوجه'), m('Emollient', 'Cream', '', 'apply generously', 'twice daily', 'continuous')])
    ]
  },
  {
    key: 'contact_dermatitis', specialty: 'dermatology', nameEn: 'Contact dermatitis', nameAr: 'التهاب الجلد التماسي', icd10: 'L25.9',
    keywords: ['contact dermatitis', 'allergy skin', 'حساسية تلامسية'],
    options: [o('first', [m('Mometasone furoate', 'Cream', '0.1%', 'apply thin layer', 'once daily', '7–14 days'), cetirizine], { advice: 'تجنب المادة المسببة' })]
  },
  {
    key: 'seborrheic_dermatitis', specialty: 'dermatology', nameEn: 'Seborrhoeic dermatitis', nameAr: 'التهاب الجلد الدهني (القشرة)', icd10: 'L21.9',
    keywords: ['dandruff', 'seborrheic', 'قشرة', 'دهني'],
    options: [o('first', [m('Ketoconazole', 'Shampoo', '2%', 'apply, leave 5 minutes', 'twice weekly', '4 weeks'), m('Ketoconazole', 'Cream', '2%', 'apply thin layer to face', 'once daily', '2 weeks')])]
  },
  {
    key: 'psoriasis', specialty: 'dermatology', nameEn: 'Plaque psoriasis (mild)', nameAr: 'الصدفية البسيطة', icd10: 'L40.0',
    keywords: ['psoriasis', 'صدفية'],
    options: [o('first', [m('Calcipotriol/Betamethasone', 'Ointment', '50 mcg/0.5 mg', 'apply to plaques', 'once daily', '4 weeks'), m('Emollient', 'Cream', '', 'apply generously', 'twice daily', 'continuous')])]
  },
  {
    key: 'urticaria', specialty: 'dermatology', nameEn: 'Acute urticaria', nameAr: 'الأرتيكاريا (الحساسية الحادة)', icd10: 'L50.9',
    keywords: ['hives', 'urticaria', 'ارتيكاريا', 'حكة', 'هرش'],
    options: [
      o('first', [m('Cetirizine', 'Tab', '10 mg', '1 tablet', 'once daily (may increase to twice daily)', '2 weeks')], { advice: 'تجنب المسبب. مراجعة فورية عند تورم الشفاه أو صعوبة التنفس' }),
      o('severe', [m('Cetirizine', 'Tab', '10 mg', '1 tablet', 'twice daily', '2 weeks'), m('Prednisolone', 'Tab', '5 mg', '8 tablets (40 mg)', 'once daily in the morning', '3 days', 'بعد الإفطار')])
    ]
  },
  {
    key: 'scabies', specialty: 'dermatology', nameEn: 'Scabies', nameAr: 'الجرب', icd10: 'B86',
    keywords: ['scabies', 'جرب'],
    options: [
      o('first', [m('Permethrin', 'Cream', '5%', 'apply neck to toes, wash off after 8–12 hours', 'once, repeat after 7 days', '2 doses'), cetirizine], { advice: 'علاج كل المخالطين في نفس الوقت، وغسل الملابس والمفارش بماء ساخن' }),
      o('alt', [m('Ivermectin', 'Tab', '3 mg', '200 mcg/kg', 'single dose, repeat after 7 days', '2 doses', 'على معدة فارغة')], { advice: 'علاج كل المخالطين' })
    ]
  },
  {
    key: 'head_lice', specialty: 'dermatology', nameEn: 'Head lice', nameAr: 'قمل الرأس', icd10: 'B85.0',
    keywords: ['lice', 'قمل', 'صيبان'],
    options: [o('first', [m('Permethrin', 'Lotion', '1%', 'apply to dry hair, rinse after 10 minutes', 'once, repeat on day 9', '2 doses')], { advice: 'تمشيط الشعر بمشط القمل، وفحص باقي الأسرة' })]
  },
  {
    key: 'impetigo', specialty: 'dermatology', nameEn: 'Impetigo', nameAr: 'القوباء', icd10: 'L01.00',
    keywords: ['impetigo', 'قوباء', 'دمامل'],
    options: [
      o('first', [m('Fusidic acid', 'Cream', '2%', 'apply', 'three times daily', '7 days')], { advice: 'إزالة القشور بماء وصابون بلطف، وعدم مشاركة المناشف' }),
      o('severe', [m('Flucloxacillin', 'Cap', '500 mg', '1 capsule', 'every 6 hours', '7 days', 'قبل الأكل بساعة')]),
      o('pen', [m('Clarithromycin', 'Tab', '250 mg', '1 tablet', 'every 12 hours', '7 days')])
    ]
  },
  {
    key: 'cellulitis', specialty: 'dermatology', nameEn: 'Cellulitis', nameAr: 'التهاب النسيج الخلوي', icd10: 'L03.90',
    keywords: ['cellulitis', 'skin infection', 'التهاب جلد بكتيري'],
    options: [
      o('first', [m('Flucloxacillin', 'Cap', '500 mg', '1–2 capsules', 'every 6 hours', '7 days', 'قبل الأكل بساعة'), paracetamol], { advice: 'رفع الطرف المصاب. مراجعة فورية إذا انتشر الاحمرار أو ظهرت حرارة عالية', labs: 'CBC' }),
      o('pen', [m('Clarithromycin', 'Tab', '500 mg', '1 tablet', 'every 12 hours', '7 days'), paracetamol])
    ]
  },
  {
    key: 'herpes_labialis', specialty: 'dermatology', nameEn: 'Cold sores (herpes labialis)', nameAr: 'هربس الشفاه', icd10: 'B00.1',
    keywords: ['cold sore', 'herpes', 'هربس', 'حمو'],
    options: [o('first', [m('Aciclovir', 'Cream', '5%', 'apply', 'five times daily', '5 days', 'يبدأ عند أول إحساس بالوخز')])]
  },
  {
    key: 'herpes_zoster', specialty: 'dermatology', nameEn: 'Herpes zoster (shingles)', nameAr: 'الحزام الناري', icd10: 'B02.9',
    keywords: ['shingles', 'zoster', 'حزام ناري'],
    options: [
      o('first', [m('Valaciclovir', 'Tab', '1 g', '1 tablet', 'every 8 hours', '7 days'), paracetamol], { advice: 'يفضل البدء خلال 72 ساعة من ظهور الطفح' }),
      o('alt', [m('Aciclovir', 'Tab', '800 mg', '1 tablet', 'five times daily', '7 days'), paracetamol])
    ]
  },
  {
    key: 'warts', specialty: 'dermatology', nameEn: 'Common warts', nameAr: 'الثآليل (السنط)', icd10: 'B07.8',
    keywords: ['warts', 'سنط', 'ثآليل', 'ثؤلول'],
    options: [o('first', [m('Salicylic acid', 'Solution', '17%', 'apply to wart only', 'once daily at night', '12 weeks', 'برد الجلد الميت قبل الدهان')])]
  },
  {
    key: 'melasma', specialty: 'dermatology', nameEn: 'Melasma', nameAr: 'الكلف', icd10: 'L81.1',
    keywords: ['melasma', 'كلف', 'تصبغات'],
    options: [o('first', [m('Hydroquinone', 'Cream', '4%', 'apply thin layer to patches', 'once daily at night', '8 weeks'), m('Sunscreen SPF 50+', 'Cream', '', 'apply', 'every morning and every 3 hours outdoors', 'continuous')], { advice: 'واقي الشمس أهم جزء في العلاج' })]
  },
  {
    key: 'androgenetic_alopecia', specialty: 'dermatology', nameEn: 'Androgenetic alopecia', nameAr: 'الصلع الوراثي', icd10: 'L64.9',
    keywords: ['hair loss', 'alopecia', 'تساقط الشعر', 'صلع'],
    options: [o('first', [m('Minoxidil', 'Solution', '5% (men) / 2% (women)', '1 ml to scalp', 'twice daily', '6 months')], { advice: 'قد يزيد التساقط أول شهر ثم يتحسن', labs: 'CBC, Serum ferritin, TSH' })]
  },

  // ------------------------------------------------------------------ internal medicine
  {
    key: 'hypertension', specialty: 'internal', nameEn: 'Essential hypertension', nameAr: 'ارتفاع ضغط الدم', icd10: 'I10',
    keywords: ['hypertension', 'high blood pressure', 'htn', 'ضغط', 'ضغط عالي'],
    options: [
      o('first', [m('Amlodipine', 'Tab', '5 mg', '1 tablet', 'once daily', '30 days')], { advice: 'تقليل الملح، المشي 30 دقيقة يومياً، ومتابعة الضغط', labs: 'Serum creatinine, Potassium, Lipid profile, Fasting blood sugar' }),
      o('alt', [m('Losartan', 'Tab', '50 mg', '1 tablet', 'once daily', '30 days')], { labs: 'Serum creatinine, Potassium after 2 weeks' })
    ]
  },
  {
    key: 'type2_diabetes', specialty: 'internal', nameEn: 'Type 2 diabetes mellitus', nameAr: 'السكري من النوع الثاني', icd10: 'E11.9',
    keywords: ['diabetes', 'dm', 't2dm', 'sugar', 'سكر', 'سكري'],
    options: [
      o('first', [m('Metformin', 'Tab', '500 mg', '1 tablet', 'twice daily', '30 days', 'مع الأكل، تزاد تدريجياً')], { advice: 'نظام غذائي قليل السكريات، ومشي يومي', labs: 'HbA1c, Serum creatinine, Lipid profile, Urine albumin' }),
      o('alt', [m('Metformin', 'Tab', '1000 mg', '1 tablet', 'twice daily', '30 days', 'مع الأكل'), m('Gliclazide MR', 'Tab', '30 mg', '1 tablet', 'once daily', '30 days', 'مع الإفطار، احذر هبوط السكر')], { labs: 'HbA1c' })
    ]
  },
  {
    key: 'prediabetes', specialty: 'internal', nameEn: 'Prediabetes', nameAr: 'ما قبل السكري', icd10: 'R73.03',
    keywords: ['prediabetes', 'impaired glucose', 'ما قبل السكر'],
    options: [o('first', [m('Metformin', 'Tab', '500 mg', '1 tablet', 'once daily', '3 months', 'مع العشاء')], { advice: 'إنقاص الوزن 5–7% ومشي 150 دقيقة أسبوعياً', labs: 'HbA1c after 3 months' })]
  },
  {
    key: 'diabetic_neuropathy', specialty: 'internal', nameEn: 'Painful diabetic neuropathy', nameAr: 'التهاب الأعصاب السكري', icd10: 'E11.40',
    keywords: ['neuropathy', 'nerve pain', 'تنميل', 'اعصاب'],
    options: [o('first', [m('Pregabalin', 'Cap', '75 mg', '1 capsule', 'twice daily', '30 days', 'قد يسبب دوخة ونعاس')], { advice: 'فحص القدمين يومياً' })]
  },
  {
    key: 'dyslipidemia', specialty: 'internal', nameEn: 'Dyslipidaemia', nameAr: 'ارتفاع الدهون في الدم', icd10: 'E78.5',
    keywords: ['cholesterol', 'lipids', 'hyperlipidemia', 'كوليسترول', 'دهون'],
    options: [
      o('first', [m('Atorvastatin', 'Tab', '20 mg', '1 tablet', 'once daily at night', '30 days')], { advice: 'تقليل الدهون المشبعة والمقليات، ورياضة منتظمة', labs: 'Lipid profile and ALT after 3 months' }),
      o('severe', [m('Atorvastatin', 'Tab', '40 mg', '1 tablet', 'once daily at night', '30 days')], { labs: 'Lipid profile, ALT' })
    ]
  },
  {
    key: 'hypothyroidism', specialty: 'internal', nameEn: 'Hypothyroidism', nameAr: 'قصور الغدة الدرقية', icd10: 'E03.9',
    keywords: ['hypothyroid', 'thyroid', 'غدة', 'درقية', 'خمول الغدة'],
    options: [o('first', [m('Levothyroxine', 'Tab', '50 mcg', '1 tablet', 'once daily', '30 days', 'على الريق قبل الإفطار بنصف ساعة')], { labs: 'TSH after 6 weeks' })]
  },
  {
    key: 'iron_deficiency', specialty: 'internal', nameEn: 'Iron deficiency anaemia', nameAr: 'أنيميا نقص الحديد', icd10: 'D50.9',
    keywords: ['anemia', 'anaemia', 'iron', 'انيميا', 'فقر دم'],
    options: [o('first', [m('Ferrous sulfate', 'Tab', '325 mg', '1 tablet', 'once daily', '3 months', 'قبل الأكل بساعة مع عصير برتقال')], { advice: 'قد يسبب لون البراز الداكن', labs: 'CBC, Serum ferritin after 4 weeks' })]
  },
  {
    key: 'b12_deficiency', specialty: 'internal', nameEn: 'Vitamin B12 deficiency', nameAr: 'نقص فيتامين ب12', icd10: 'D51.9',
    keywords: ['b12', 'cobalamin', 'ب12'],
    options: [o('first', [m('Cyanocobalamin', 'Tab', '1000 mcg', '1 tablet', 'once daily', '3 months')], { labs: 'Serum B12, CBC after 3 months' })]
  },
  {
    key: 'vitamin_d_deficiency', specialty: 'internal', nameEn: 'Vitamin D deficiency', nameAr: 'نقص فيتامين د', icd10: 'E55.9',
    keywords: ['vitamin d', 'فيتامين د'],
    options: [o('first', [m('Cholecalciferol (Vitamin D3)', 'Cap', '50000 IU', '1 capsule', 'once weekly', '8 weeks', 'بعد الأكل')], { advice: 'التعرض للشمس 15 دقيقة يومياً', labs: '25-OH Vitamin D after 3 months' })]
  },
  {
    key: 'osteoporosis', specialty: 'internal', nameEn: 'Osteoporosis', nameAr: 'هشاشة العظام', icd10: 'M81.0',
    keywords: ['osteoporosis', 'هشاشة'],
    options: [o('maintain', [m('Alendronate', 'Tab', '70 mg', '1 tablet', 'once weekly', '3 months', 'على الريق مع كوب ماء كامل، والبقاء واقفاً 30 دقيقة'), m('Calcium + Vitamin D3', 'Tab', '600 mg/400 IU', '1 tablet', 'twice daily', '3 months', 'بعد الأكل')], { labs: 'Serum calcium, 25-OH Vitamin D' })]
  },
  {
    key: 'osteoarthritis', specialty: 'internal', nameEn: 'Knee osteoarthritis', nameAr: 'خشونة الركبة', icd10: 'M17.9',
    keywords: ['osteoarthritis', 'knee pain', 'خشونة', 'ركبة'],
    options: [o('first', [m('Paracetamol', 'Tab', '500 mg', '2 tablets', 'every 8 hours when needed', '2 weeks'), m('Diclofenac', 'Gel', '1%', 'apply to knee', 'three times daily', '2 weeks')], { advice: 'إنقاص الوزن وتمارين تقوية عضلات الفخذ' })]
  },
  {
    key: 'gout_acute', specialty: 'internal', nameEn: 'Acute gout', nameAr: 'نوبة النقرس الحادة', icd10: 'M10.9',
    keywords: ['gout', 'uric acid', 'نقرس', 'نقرص', 'حمض البوليك'],
    options: [
      o('first', [m('Colchicine', 'Tab', '500 mcg', '1 tablet', '2–4 times daily until pain settles', '5 days', 'max 6 mg per course')], { advice: 'راحة ورفع المفصل وثلج، وتقليل اللحوم الحمراء', labs: 'Serum uric acid, Serum creatinine' }),
      o('alt', [m('Naproxen', 'Tab', '500 mg', '1 tablet', 'every 12 hours', '5 days', 'بعد الأكل'), m('Omeprazole', 'Cap', '20 mg', '1 capsule', 'once daily', '5 days', 'قبل الإفطار')])
    ]
  },
  {
    key: 'gout_prevention', specialty: 'internal', nameEn: 'Gout prevention (hyperuricaemia)', nameAr: 'الوقاية من النقرس', icd10: 'E79.0',
    keywords: ['hyperuricemia', 'allopurinol', 'حمض البوليك'],
    options: [o('maintain', [m('Allopurinol', 'Tab', '100 mg', '1 tablet', 'once daily', '30 days', 'بعد الأكل، يبدأ بعد انتهاء النوبة')], { labs: 'Serum uric acid and creatinine after 4 weeks' })]
  },
  {
    key: 'peptic_ulcer', specialty: 'internal', nameEn: 'Peptic ulcer', nameAr: 'قرحة المعدة / الاثنا عشر', icd10: 'K27.9',
    keywords: ['ulcer', 'peptic', 'قرحة'],
    options: [o('first', [m('Omeprazole', 'Cap', '40 mg', '1 capsule', 'once daily', '8 weeks', 'قبل الإفطار بنصف ساعة')], { advice: 'إيقاف المسكنات (NSAIDs) والتدخين', labs: 'H. pylori stool antigen' })]
  },
  {
    key: 'copd_exacerbation', specialty: 'internal', nameEn: 'COPD exacerbation (mild)', nameAr: 'نوبة السدة الرئوية المزمنة', icd10: 'J44.1',
    keywords: ['copd', 'emphysema', 'سدة رئوية', 'انسداد رئوي'],
    options: [o('first', [m('Salbutamol', 'Inhaler', '100 mcg', '2 puffs', 'every 4–6 hours when needed', '7 days'), m('Prednisolone', 'Tab', '5 mg', '8 tablets (40 mg)', 'once daily', '5 days', 'بعد الإفطار'), m('Amoxicillin', 'Cap', '500 mg', '1 capsule', 'every 8 hours', '5 days', 'إذا كان البلغم صديدياً')], { advice: 'الإقلاع عن التدخين', labs: 'CBC, Chest X-ray' })]
  },
  {
    key: 'bph', specialty: 'internal', nameEn: 'Benign prostatic hyperplasia', nameAr: 'تضخم البروستاتا الحميد', icd10: 'N40.1',
    keywords: ['bph', 'prostate', 'بروستاتا'],
    options: [o('first', [m('Tamsulosin', 'Cap', '0.4 mg', '1 capsule', 'once daily', '30 days', 'بعد نفس الوجبة يومياً، قد يسبب دوخة عند الوقوف')], { labs: 'PSA, Urine analysis, Serum creatinine' })]
  }
]

export const SPECIALTIES: Specialty[] = ['general', 'pediatrics', 'dermatology', 'internal']
