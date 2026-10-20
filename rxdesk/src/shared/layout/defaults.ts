import {
  ALL_MEDICINE_COLUMNS,
  FONT_FAMILIES,
  LAYOUT_VERSION,
  PAPER_SIZES,
  type ElementType,
  type Layout,
  type LayoutElement,
  type MedicinesOptions,
  type PaperPreset,
  type TextStyle
} from './types'

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export const DEFAULT_STYLE: TextStyle = {
  fontFamily: 'Cairo',
  fontSizePt: 11,
  bold: false,
  italic: false,
  color: '#111111',
  align: 'start',
  direction: 'auto',
  lineHeight: 1.35
}

export const DEFAULT_MEDICINES: MedicinesOptions = {
  style: 'list',
  columns: ['number', 'drug', 'dose', 'frequency', 'duration', 'instructions'],
  showHeader: true,
  headerLabels: {},
  rowGapMm: 2.5,
  showRxSymbol: true,
  drugBold: true,
  detailFontSizePt: 10,
  borders: true
}

const LABELS: Record<string, { ar: string; en: string }> = {
  patientName: { ar: 'الاسم:', en: 'Name:' },
  patientAge: { ar: 'السن:', en: 'Age:' },
  patientGender: { ar: 'النوع:', en: 'Sex:' },
  patientWeight: { ar: 'الوزن:', en: 'Weight:' },
  date: { ar: 'التاريخ:', en: 'Date:' },
  diagnosis: { ar: 'التشخيص:', en: 'Diagnosis:' },
  notes: { ar: 'تعليمات:', en: 'Advice:' },
  labTests: { ar: 'التحاليل المطلوبة:', en: 'Lab tests:' },
  nextVisit: { ar: 'موعد الإعادة:', en: 'Next visit:' },
  signature: { ar: 'التوقيع', en: 'Signature' },
  prescriptionId: { ar: 'رقم:', en: 'No.:' },
  licenseNumber: { ar: 'رقم الترخيص:', en: 'License No.:' },
  clinicPhone: { ar: 'ت:', en: 'Tel:' },
  pageNumber: { ar: 'صفحة', en: 'Page' }
}

export function defaultLabel(type: ElementType, lang: 'ar' | 'en'): string {
  return LABELS[type]?.[lang] ?? ''
}

const DEFAULT_SIZE: Partial<Record<ElementType, [number, number]>> = {
  logo: [22, 22],
  medicines: [120, 90],
  line: [100, 1],
  rect: [60, 30],
  qr: [18, 18],
  signature: [50, 14],
  notes: [120, 14],
  labTests: [120, 10],
  text: [60, 8]
}

/** Creates a new element with sensible defaults for its type. */
export function createElement(
  type: ElementType,
  partial: Partial<LayoutElement> = {},
  lang: 'ar' | 'en' = 'ar'
): LayoutElement {
  const [w, h] = DEFAULT_SIZE[type] ?? [60, 7]
  const lastPageOnly: ElementType[] = ['notes', 'labTests', 'nextVisit', 'signature']
  const hasLabel = type in LABELS && type !== 'clinicPhone' && type !== 'licenseNumber'
  const el: LayoutElement = {
    id: uid(),
    type,
    x: 10,
    y: 10,
    w,
    h,
    pages: lastPageOnly.includes(type) ? 'last' : 'all',
    style: { ...DEFAULT_STYLE, ...(type === 'doctorNameEn' || type === 'specialtyEn' ? { fontFamily: 'Roboto', direction: 'ltr' } : {}) },
    label: { show: hasLabel, text: defaultLabel(type, lang) },
    ...partial
  }
  if (partial.style) el.style = { ...DEFAULT_STYLE, ...partial.style }
  if (type === 'medicines') el.medicines = { ...DEFAULT_MEDICINES, ...(partial.medicines ?? {}) }
  if (type === 'line') {
    el.strokeWidthMm = partial.strokeWidthMm ?? 0.4
    el.strokeColor = partial.strokeColor ?? '#333333'
  }
  if (type === 'rect') {
    el.strokeWidthMm = partial.strokeWidthMm ?? 0.3
    el.strokeColor = partial.strokeColor ?? '#333333'
    el.fillColor = partial.fillColor ?? 'transparent'
    el.radiusMm = partial.radiusMm ?? 2
  }
  if (type === 'text' && el.text === undefined) el.text = lang === 'ar' ? 'نص' : 'Text'
  if (type === 'logo') el.fit = partial.fit ?? 'contain'
  return el
}

export function blankLayout(preset: PaperPreset = 'A5', custom?: { widthMm: number; heightMm: number }): Layout {
  const size = preset === 'custom' ? custom ?? { widthMm: 148, heightMm: 210 } : PAPER_SIZES[preset]
  return {
    version: LAYOUT_VERSION,
    paper: { preset, ...size },
    marginsMm: { top: 8, right: 8, bottom: 8, left: 8 },
    offsetMm: { x: 0, y: 0 },
    background: { dataUrl: '', print: false, opacity: 1 },
    grid: { sizeMm: 2, snap: true, show: true },
    direction: 'rtl',
    elements: []
  }
}

const st = (s: Partial<TextStyle>): TextStyle => ({ ...DEFAULT_STYLE, ...s })

/** Built-in A5 layout: Arabic labels, numbered list of medicines. */
export function sampleA5Layout(): Layout {
  const L = blankLayout('A5')
  const e = (type: ElementType, p: Partial<LayoutElement>) => createElement(type, p, 'ar')
  L.elements = [
    e('doctorNameAr', { x: 84, y: 7, w: 56, h: 9, style: st({ fontSizePt: 15, bold: true, color: '#0b3d6b' }) }),
    e('specialtyAr', { x: 84, y: 16, w: 56, h: 7, style: st({ fontSizePt: 10, color: '#333333' }) }),
    e('logo', { x: 64, y: 6, w: 20, h: 19 }),
    e('doctorNameEn', { x: 8, y: 7, w: 56, h: 9, style: st({ fontFamily: 'Roboto', fontSizePt: 13, bold: true, direction: 'ltr', color: '#0b3d6b' }) }),
    e('specialtyEn', { x: 8, y: 16, w: 56, h: 7, style: st({ fontFamily: 'Roboto', fontSizePt: 9, direction: 'ltr', color: '#333333' }) }),
    e('line', { x: 8, y: 27, w: 132, h: 1, strokeWidthMm: 0.5, strokeColor: '#0b3d6b' }),
    e('patientName', { x: 58, y: 30, w: 82, h: 7 }),
    e('date', { x: 8, y: 30, w: 46, h: 7 }),
    e('patientAge', { x: 102, y: 37, w: 38, h: 7 }),
    e('patientGender', { x: 58, y: 37, w: 40, h: 7 }),
    e('patientWeight', { x: 8, y: 37, w: 46, h: 7 }),
    e('diagnosis', { x: 8, y: 44, w: 132, h: 7 }),
    e('medicines', {
      x: 8,
      y: 53,
      w: 132,
      h: 108,
      style: st({ fontFamily: 'Roboto', fontSizePt: 11, direction: 'ltr' }),
      medicines: { ...DEFAULT_MEDICINES, style: 'list' }
    }),
    e('notes', { x: 8, y: 162, w: 132, h: 12, style: st({ fontSizePt: 10 }) }),
    e('labTests', { x: 58, y: 175, w: 82, h: 9, style: st({ fontSizePt: 9 }) }),
    e('nextVisit', { x: 8, y: 175, w: 48, h: 9, style: st({ fontSizePt: 9 }) }),
    e('signature', { x: 8, y: 185, w: 48, h: 11, style: st({ fontSizePt: 9, align: 'center' }) }),
    e('qr', { x: 124, y: 184, w: 14, h: 14, pages: 'last' }),
    e('line', { x: 8, y: 199, w: 132, h: 1, strokeWidthMm: 0.3, strokeColor: '#0b3d6b' }),
    e('clinicAddress', { x: 8, y: 200, w: 132, h: 5, style: st({ fontSizePt: 8, align: 'center' }) }),
    e('clinicPhone', { x: 8, y: 204.5, w: 132, h: 5, label: { show: true, text: 'ت:' }, style: st({ fontSizePt: 8, align: 'center' }) })
  ]
  return L
}

/** Built-in A4 layout: bilingual labels, medicines table with borders. */
export function sampleA4Layout(): Layout {
  const L = blankLayout('A4')
  L.marginsMm = { top: 10, right: 10, bottom: 10, left: 10 }
  const e = (type: ElementType, p: Partial<LayoutElement>) => createElement(type, p, 'ar')
  const lbl = (text: string) => ({ show: true, text })
  L.elements = [
    e('doctorNameAr', { x: 125, y: 10, w: 75, h: 10, style: st({ fontSizePt: 17, bold: true, color: '#14532d' }) }),
    e('specialtyAr', { x: 125, y: 20, w: 75, h: 7, style: st({ fontSizePt: 11 }) }),
    e('logo', { x: 94, y: 9, w: 22, h: 20 }),
    e('doctorNameEn', { x: 10, y: 10, w: 75, h: 10, style: st({ fontFamily: 'Roboto', fontSizePt: 15, bold: true, direction: 'ltr', color: '#14532d' }) }),
    e('specialtyEn', { x: 10, y: 20, w: 75, h: 7, style: st({ fontFamily: 'Roboto', fontSizePt: 10, direction: 'ltr' }) }),
    e('clinicName', { x: 10, y: 30, w: 190, h: 7, style: st({ fontSizePt: 12, bold: true, align: 'center' }) }),
    e('line', { x: 10, y: 38, w: 190, h: 1, strokeWidthMm: 0.6, strokeColor: '#14532d' }),
    e('patientName', { x: 95, y: 42, w: 105, h: 8, label: lbl('الاسم / Name:'), style: st({ fontSizePt: 12 }) }),
    e('date', { x: 10, y: 42, w: 70, h: 8, label: lbl('التاريخ / Date:'), style: st({ fontSizePt: 12 }) }),
    e('patientAge', { x: 150, y: 50, w: 50, h: 8, label: lbl('السن / Age:') }),
    e('patientGender', { x: 100, y: 50, w: 46, h: 8, label: lbl('النوع / Sex:') }),
    e('patientWeight', { x: 50, y: 50, w: 46, h: 8, label: lbl('الوزن / Wt:') }),
    e('prescriptionId', { x: 10, y: 50, w: 36, h: 8, label: lbl('No.') }),
    e('diagnosis', { x: 10, y: 59, w: 190, h: 8, label: lbl('التشخيص / Dx:') }),
    e('medicines', {
      x: 10,
      y: 70,
      w: 190,
      h: 150,
      style: st({ fontFamily: 'Roboto', fontSizePt: 10.5, direction: 'ltr' }),
      medicines: {
        ...DEFAULT_MEDICINES,
        style: 'table',
        columns: ['number', 'drug', 'dose', 'frequency', 'duration', 'instructions'],
        rowGapMm: 1.2,
        detailFontSizePt: 10
      }
    }),
    e('labTests', { x: 10, y: 223, w: 190, h: 12, label: lbl('التحاليل / Investigations:'), style: st({ fontSizePt: 10 }) }),
    e('notes', { x: 10, y: 236, w: 190, h: 16, label: lbl('تعليمات / Advice:'), style: st({ fontSizePt: 10 }) }),
    e('nextVisit', { x: 10, y: 254, w: 80, h: 8, label: lbl('الإعادة / Follow-up:'), style: st({ fontSizePt: 10 }) }),
    e('qr', { x: 100, y: 253, w: 17, h: 17, pages: 'last' }),
    e('signature', { x: 140, y: 254, w: 60, h: 15, label: lbl('التوقيع / Signature'), style: st({ fontSizePt: 10, align: 'center' }) }),
    e('line', { x: 10, y: 273, w: 190, h: 1, strokeWidthMm: 0.4, strokeColor: '#14532d' }),
    e('clinicAddress', { x: 10, y: 275, w: 190, h: 6, style: st({ fontSizePt: 9, align: 'center' }) }),
    e('clinicPhone', { x: 10, y: 281, w: 120, h: 6, label: lbl('Tel / ت:'), style: st({ fontSizePt: 9, align: 'center' }) }),
    e('licenseNumber', { x: 130, y: 281, w: 70, h: 6, label: lbl('ترخيص / Lic:'), style: st({ fontSizePt: 9, align: 'center' }) }),
    e('pageNumber', { x: 10, y: 287, w: 190, h: 5, label: lbl('Page'), style: st({ fontSizePt: 7, align: 'center', color: '#666666', direction: 'ltr' }) })
  ]
  return L
}

const ELEMENT_TYPES: ElementType[] = [
  'doctorNameAr', 'doctorNameEn', 'specialtyAr', 'specialtyEn', 'clinicName', 'clinicAddress', 'clinicPhone',
  'licenseNumber', 'logo', 'patientName', 'patientAge', 'patientGender', 'patientWeight', 'date', 'diagnosis',
  'medicines', 'notes', 'labTests', 'nextVisit', 'signature', 'prescriptionId', 'pageNumber', 'text', 'line', 'rect', 'qr'
]

const num = (v: unknown, fallback: number, min = -10000, max = 10000): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

/**
 * Makes any layout object (old version, imported file, partial) safe to render by
 * filling missing values with defaults and dropping unknown elements.
 */
export function normalizeLayout(input: any): Layout {
  const base = blankLayout('A5')
  const src = input && typeof input === 'object' ? input : {}
  const paper = src.paper ?? {}
  const preset: PaperPreset = ['A4', 'A5', 'Letter', 'custom'].includes(paper.preset) ? paper.preset : 'A5'
  const size = preset === 'custom' ? null : PAPER_SIZES[preset]
  const layout: Layout = {
    version: LAYOUT_VERSION,
    paper: {
      preset,
      widthMm: size ? size.widthMm : num(paper.widthMm, 148, 30, 1000),
      heightMm: size ? size.heightMm : num(paper.heightMm, 210, 30, 2000)
    },
    marginsMm: {
      top: num(src.marginsMm?.top, base.marginsMm.top, 0, 100),
      right: num(src.marginsMm?.right, base.marginsMm.right, 0, 100),
      bottom: num(src.marginsMm?.bottom, base.marginsMm.bottom, 0, 100),
      left: num(src.marginsMm?.left, base.marginsMm.left, 0, 100)
    },
    offsetMm: { x: num(src.offsetMm?.x, 0, -50, 50), y: num(src.offsetMm?.y, 0, -50, 50) },
    background: {
      dataUrl: typeof src.background?.dataUrl === 'string' && src.background.dataUrl.startsWith('data:image/') ? src.background.dataUrl : '',
      print: !!src.background?.print,
      opacity: num(src.background?.opacity, 1, 0.05, 1)
    },
    grid: {
      sizeMm: num(src.grid?.sizeMm, 2, 0.5, 20),
      snap: src.grid?.snap !== false,
      show: src.grid?.show !== false
    },
    direction: src.direction === 'ltr' ? 'ltr' : 'rtl',
    elements: []
  }
  const els: any[] = Array.isArray(src.elements) ? src.elements : []
  for (const raw of els) {
    if (!raw || !ELEMENT_TYPES.includes(raw.type)) continue
    const def = createElement(raw.type)
    const style = { ...def.style, ...(raw.style ?? {}) }
    if (!FONT_FAMILIES.includes(style.fontFamily)) style.fontFamily = 'Cairo'
    style.fontSizePt = num(style.fontSizePt, 11, 4, 96)
    style.lineHeight = num(style.lineHeight, 1.35, 0.8, 3)
    const el: LayoutElement = {
      ...def,
      ...raw,
      id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
      x: num(raw.x, def.x),
      y: num(raw.y, def.y),
      w: num(raw.w, def.w, 0.5, 2000),
      h: num(raw.h, def.h, 0.5, 2000),
      pages: ['all', 'first', 'last'].includes(raw.pages) ? raw.pages : def.pages,
      style,
      label: { show: !!(raw.label?.show ?? def.label.show), text: String(raw.label?.text ?? def.label.text) }
    }
    if (el.type === 'medicines') {
      const m = { ...DEFAULT_MEDICINES, ...(raw.medicines ?? {}) }
      m.columns = (Array.isArray(m.columns) ? m.columns : DEFAULT_MEDICINES.columns).filter((c: any) =>
        ALL_MEDICINE_COLUMNS.includes(c)
      )
      if (!m.columns.includes('drug')) m.columns.splice(m.columns.includes('number') ? 1 : 0, 0, 'drug')
      m.style = m.style === 'table' ? 'table' : 'list'
      m.rowGapMm = num(m.rowGapMm, 2.5, 0, 30)
      m.detailFontSizePt = num(m.detailFontSizePt, 10, 4, 72)
      m.headerLabels = m.headerLabels && typeof m.headerLabels === 'object' ? m.headerLabels : {}
      el.medicines = m
    }
    layout.elements.push(el)
  }
  return layout
}
